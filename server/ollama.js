// Proxy for Ollama AI recommendations and resume parsing.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { fetchGitHubData } from './utils/fetchGitHubData.js';
import { fetchLinkedInData } from './utils/fetchLinkedInData.js';

function getOllamaConfig() {
  return {
    url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 120000),
    maxConcurrency: Math.max(1, Number(process.env.OLLAMA_MAX_CONCURRENCY || 1)),
    retryCount: Math.max(0, Number(process.env.OLLAMA_RETRY_COUNT || 2)),
  };
}

let activeOllamaCalls = 0;
const ollamaQueue = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runNextOllamaJob() {
  const config = getOllamaConfig();
  while (activeOllamaCalls < config.maxConcurrency && ollamaQueue.length > 0) {
    const job = ollamaQueue.shift();
    activeOllamaCalls += 1;

    void job()
      .finally(() => {
        activeOllamaCalls -= 1;
        runNextOllamaJob();
      });
  }
}

function enqueueOllamaJob(task) {
  return new Promise((resolve, reject) => {
    ollamaQueue.push(async () => {
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      }
    });
    runNextOllamaJob();
  });
}

function isRetryableOllamaError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch failed|aborted|terminated|socket|econnrefused|econnreset|etimedout|timeout|5\d\d/i.test(message);
}

function createOllamaUnavailableError(error, config) {
  const message = error instanceof Error ? error.message : String(error);
  const next = new Error(`Ollama unavailable after retries at ${config.url}: ${message}`);
  next.code = 'OLLAMA_UNAVAILABLE';
  next.cause = error;
  return next;
}

async function callOllamaOnce(prompt, config) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt,
        stream: false,
        format: 'json',
        options: {
          temperature: 0.1,
          num_predict: 1800,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    return typeof data?.response === 'string' ? data.response : '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callOllama(prompt) {
  const config = getOllamaConfig();

  return enqueueOllamaJob(async () => {
    let lastError = null;
    for (let attempt = 0; attempt <= config.retryCount; attempt += 1) {
      try {
        return await callOllamaOnce(prompt, config);
      } catch (error) {
        lastError = error;
        if (attempt >= config.retryCount || !isRetryableOllamaError(error)) {
          break;
        }
        await sleep(600 * (attempt + 1));
      }
    }

    throw createOllamaUnavailableError(lastError, config);
  });
}

function tryParseJsonText(text, expectedArray) {
  try {
    const parsed = JSON.parse(text);
    if (expectedArray && Array.isArray(parsed)) return parsed;
    if (!expectedArray && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Continue with extraction fallback.
  }

  const pattern = expectedArray ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const match = text.match(pattern);
  if (!match) {
    return expectedArray ? [] : {};
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (expectedArray && Array.isArray(parsed)) return parsed;
    if (!expectedArray && parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {
    // Fall through to safe default.
  }

  return expectedArray ? [] : {};
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return [];
  }

  return [...new Set(skills
    .filter((skill) => typeof skill === 'string')
    .map((skill) => skill.trim())
    .filter(Boolean))];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cleanResumeField(value) {
  return String(value ?? '')
    .replace(/[\u2022|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:GPA|Relevant Coursework|Coursework|Honors|Awards)\b.*$/i, '')
    .replace(/[.;,\s]+$/g, '')
    .trim();
}

function toTitleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDegreeLevel(text) {
  if (/\b(?:ph\.?\s*d\.?|doctor(?:ate|al)?|doctor\s+of\s+philosophy|phd\s+candidate|ph\.?\s*d\.?\s+candidate)\b/i.test(text)) {
    return 'PhD';
  }

  if (/\b(?:m\.?\s*s\.?|m\.?\s*a\.?|m\.?\s*b\.?\s*a\.?|master(?:'s)?|master\s+of|mba)\b/i.test(text)) {
    return "Master's";
  }

  if (/\b(?:b\.?\s*s\.?|b\.?\s*a\.?|bachelor(?:'s)?|bachelor\s+of|associate(?:'s)?)\b/i.test(text)) {
    return 'Bachelor';
  }

  return null;
}

function getEducationYearCandidates(text) {
  const currentYear = new Date().getFullYear();
  return Array.from(
    text.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/gi),
    (match) => Number(match[1])
  ).filter((year) => Number.isFinite(year) && year > currentYear);
}

function getUndergradYearFromGraduationYear(gradYear) {
  const currentYear = new Date().getFullYear();
  const diff = gradYear - currentYear;

  if (diff <= 1) return 'Senior';
  if (diff === 2) return 'Junior';
  if (diff === 3) return 'Sophomore';
  return 'Freshman';
}

function getCurrentEducationInfo(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates = [];

  for (let index = 0; index < lines.length; index += 1) {
    const segment = [lines[index], lines[index + 1], lines[index + 2]].filter(Boolean).join(' ');
    const level = getDegreeLevel(segment);
    if (!level) {
      continue;
    }

    const years = getEducationYearCandidates(segment);
    if (years.length > 0) {
      candidates.push({ level, year: Math.max(...years) });
    } else if (level === 'PhD' && /\bcandidate\b/i.test(segment)) {
      candidates.push({ level, year: Number.POSITIVE_INFINITY });
    }
  }

  if (candidates.length === 0) {
    const wholeResumeLevel = getDegreeLevel(text);
    if (wholeResumeLevel === 'PhD' && /\bcandidate\b/i.test(text)) {
      return { level: 'PhD', year: null };
    }
    return null;
  }

  candidates.sort((left, right) => {
    if (right.year !== left.year) {
      return right.year - left.year;
    }
    const priority = { PhD: 3, "Master's": 2, Bachelor: 1 };
    return priority[right.level] - priority[left.level];
  });

  return candidates[0];
}

function appearsInResume(value, text) {
  const cleaned = cleanResumeField(value);
  if (!cleaned) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, 'i').test(text);
}

async function extractPdfTextFromBase64(base64String) {
  const buffer = Buffer.from(base64String, 'base64');
  const parsed = await pdfParse(buffer);
  const raw = String(parsed?.text || '');
  return raw
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

function extractSkillsHeuristically(text) {
  const dictionary = [
    'python', 'java', 'javascript', 'typescript', 'c++', 'c', 'matlab', 'r',
    'react', 'node', 'sql', 'mongodb', 'postgresql', 'pytorch', 'tensorflow',
    'machine learning', 'deep learning', 'data analysis', 'statistics', 'nlp',
    'computer vision', 'git', 'linux', 'aws', 'docker', 'kubernetes',
    'tableau', 'databricks', 'excel', 'power bi', 'salesforce', 'financial modeling',
    'market research', 'business analytics', 'data visualization', 'project management',
    'leadership', 'communication', 'public speaking', 'research writing',
  ];

  const normalized = text.toLowerCase();
  return normalizeSkills(
    dictionary.filter((skill) => {
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
    }),
  );
}

function parseResumeHeuristically(text) {
  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const yearMatch = text.match(/\b(Freshman|Sophomore|Junior|Senior)\b/i);

  const majorPatterns = [
    /(?:major|field of study)\s*[:\-]\s*([^\n]+)/i,
    /\b(?:Master(?:'s)?(?:\s+of\s+(?:Science|Arts|Business Administration))?|M\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*B\.?\s*A\.?|Doctor\s+of\s+Philosophy|Ph\.?\s*D\.?|PhD\s+Candidate)\s+(?:Candidate\s+)?(?:in|,)\s*([^\n,;]+)/i,
    /(?:bachelor(?:'s)?|b\.?s\.?|master(?:'s)?|m\.?s\.?)\s+(?:of\s+)?(?:science|arts)?\s*,\s*([^\n,;]+)/i,
    /(?:bachelor(?:'s)?|b\.?s\.?|master(?:'s)?|m\.?s\.?)\s+(?:of\s+)?(?:science|arts)?\s*(?:in)?\s*([^\n,;]+)/i,
  ];

  let major;
  for (const pattern of majorPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = cleanResumeField(match[1]);
      const business = cleaned.match(/\b(?:business administration|business analytics|business|finance|accounting|marketing|economics|information systems)\b/i)?.[0];
      major = business
        ? toTitleCase(business)
        : cleaned.replace(/\b(?:additional|second|minor|concentration|track)\b.*$/i, '').trim();
      break;
    }
  }

  const currentEducation = getCurrentEducationInfo(text);
  const inferredAcademicYear =
    currentEducation?.level === 'PhD' ? 'PhD' :
    currentEducation?.level === "Master's" ? "Master's" :
    currentEducation?.level === 'Bachelor' && Number.isFinite(currentEducation.year)
      ? getUndergradYearFromGraduationYear(currentEducation.year)
      : undefined;

  return {
    email: emailMatch?.[0]?.trim(),
    academicYear: yearMatch?.[1] ? `${yearMatch[1][0].toUpperCase()}${yearMatch[1].slice(1).toLowerCase()}` : inferredAcademicYear,
    major,
    skills: extractSkillsHeuristically(text),
  };
}

function buildResumePrompt(mode, resumeText) {
  const header = 'You extract structured resume facts. Return RAW JSON only, no markdown fences, no prose.';

  if (mode === 'skills') {
    return `${header}
Task: extract evidence-backed skills from the resume text.

Rules:
- Copy only skills that explicitly appear in the resume text.
- Include technical, research, business, data, and communication skills when present.
- Do not infer skills from school names, job titles, course titles, project titles, or repository names.
- Return a JSON array of short strings. Return [] if no explicit skills are found.

Resume text:
${resumeText}`;
  }

  return `${header}
Task: extract only fields directly supported by the resume text.

Rules:
- Use null for unknown scalar fields and [] for unknown arrays.
- Do not infer facts from job titles, project titles, course names, or school reputation.
- major is the declared primary field of study only. If the education line says "B.S. in Business, Additional Major in CS/AI", major must be "Business".
- academicYear must be exactly one of: Freshman, Sophomore, Junior, Senior, Master's, PhD.
- academicYear is based on the most recent in-progress degree. Use PhD for PhD/Doctor of Philosophy/PhD Candidate, Master's for MS/MA/MBA/Master of..., or infer Freshman/Sophomore/Junior/Senior from expected graduation year for BS/BA/Bachelor of...
- skills must be exact skills that appear in the resume text.

Return exactly:
{
  "fullName": null,
  "email": null,
  "major": null,
  "academicYear": null,
  "skills": []
}

Resume text:
${resumeText}`;
}

function toInt(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.trunc(numeric);
}

function clampInt(value, min, max) {
  return Math.min(max, Math.max(min, toInt(value, min)));
}

function toBool(value, fallback = false) {
  if (typeof value === 'boolean') {
    return value;
  }
  return fallback;
}

function cleanAiSignalString(value) {
  return String(value ?? '')
    .trim()
    .replace(/^\[(?:Gaps?|Reason|Fit|Score|Qualifications?|Evidence)\]\s*:\s*/i, '')
    .trim();
}

function sanitizeStringList(input, fallback = []) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  return input
    .filter((entry) => typeof entry === 'string')
    .map((entry) => cleanAiSignalString(entry))
    .filter(Boolean);
}

function isUsefulEvidenceString(value) {
  const trimmed = value.trim();
  return (
    !/^\s*(?:\[(?:Resume|GitHub|LinkedIn)\]\s*,?\s*)+$/i.test(trimmed) &&
    !/^\s*(?:\[[^\]]+\]\s*)+$/i.test(trimmed) &&
    !/^\s*\[[a-z_]+:/i.test(trimmed) &&
    !/\[(?:github|linkedin|resume)_[a-z_]+\]/i.test(trimmed)
  );
}

function isRecommendationLabelString(value) {
  return /^(?:Strong Fit|Good Fit|Possible Fit|Weak Fit)$/i.test(String(value ?? '').trim());
}

const SCORING_STOP_WORDS = new Set([
  'with', 'from', 'this', 'that', 'have', 'your', 'their', 'role', 'position', 'research',
  'and', 'or', 'the', 'for', 'are', 'you', 'our', 'can', 'will', 'not', 'but', 'all',
  'an', 'as', 'at', 'be', 'by', 'if', 'in', 'is', 'it', 'of', 'on', 'to',
  'student', 'candidate', 'experience', 'skills', 'requirements', 'qualification',
  'qualifications', 'fundamentals', 'coursework', 'project', 'projects', 'work',
]);

function tokenizeForScoring(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/c\+\+/g, 'cplusplus')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2)
    .filter((word) => !SCORING_STOP_WORDS.has(word));
}

function normalizeRequirementList(input) {
  return sanitizeStringList(
    Array.isArray(input)
      ? input
      : String(input ?? '')
        .split(/\r?\n|;|\|/)
        .flatMap((line) => line.split(/\.\s+(?=[A-Z0-9])/)),
    [],
  );
}

function collectPostingRequirements(posting) {
  return [
    ...normalizeRequirementList(posting?.requiredQualifications),
    ...normalizeRequirementList(posting?.preferredQualifications),
    ...normalizeRequirementList(posting?.requirements),
    ...normalizeRequirementList(posting?.qualifications),
  ]
    .map((item) => item.replace(/^[-*\d)\s]+/, '').trim())
    .filter((item) => item.length > 0)
    .filter((item, index, arr) => arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 12);
}

function collectPostingRequirementItems(posting) {
  const required = normalizeRequirementList(posting?.requiredQualifications)
    .map((item) => item.replace(/^[-*\d)\s]+/, '').trim())
    .filter(Boolean)
    .map((requirement) => ({ requirement, importance: 'required' }));

  const preferred = normalizeRequirementList(posting?.preferredQualifications)
    .map((item) => item.replace(/^[-*\d)\s]+/, '').trim())
    .filter(Boolean)
    .map((requirement) => ({ requirement, importance: 'preferred' }));

  return [...required, ...preferred]
    .filter((item, index, arr) => arr.findIndex((entry) => entry.requirement.toLowerCase() === item.requirement.toLowerCase()) === index)
    .slice(0, 12);
}

function normalizeSourceList(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const valid = new Set(['resume', 'transcript', 'github', 'linkedin']);
  return [...new Set(input
    .map((item) => String(item ?? '').trim().toLowerCase())
    .filter((item) => valid.has(item)))];
}

function sourceLabel(source) {
  if (source === 'github') return '[GitHub]';
  if (source === 'linkedin') return '[LinkedIn]';
  if (source === 'transcript') return '[Transcript]';
  return '[Resume]';
}

function normalizeRequirementAssessments(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const requirement = String(item?.requirement ?? '').trim();
      const importance = item?.importance === 'preferred' ? 'preferred' : 'required';
      const rawSupport = String(item?.support ?? '').trim().toLowerCase();
      const support = rawSupport === 'strong' || rawSupport === 'partial' || rawSupport === 'none'
        ? rawSupport
        : 'none';
      const sources = normalizeSourceList(item?.sources);
      const evidence = cleanAiSignalString(item?.evidence ?? item?.evidence_quote ?? '');
      const gap = cleanAiSignalString(item?.gap ?? '');

      if (!requirement) {
        return null;
      }

      return { requirement, importance, support, sources, evidence, gap };
    })
    .filter(Boolean)
    .slice(0, 12);
}

function scoreFromRequirementAssessments(assessments) {
  if (!Array.isArray(assessments) || assessments.length === 0) {
    return 60;
  }

  let earned = 0;
  let possible = 0;

  for (const assessment of assessments) {
    const weight = assessment.importance === 'required' ? 2 : 1;
    possible += weight;
    if (assessment.support === 'strong') {
      earned += weight;
    } else if (assessment.support === 'partial') {
      earned += weight * 0.55;
    }
  }

  if (possible === 0) {
    return 60;
  }

  return clampInt(Math.round((earned / possible) * 100), 0, 100);
}

function buildStringsFromRequirementAssessments(assessments) {
  const qualifications = [];
  const fitReasoning = [];
  const gaps = [];

  for (const assessment of assessments) {
    const label = sourceLabel(assessment.sources[0]);
    if (assessment.support === 'strong' || assessment.support === 'partial') {
      const evidence = assessment.evidence || 'available profile evidence';
      qualifications.push(`${label} ${assessment.requirement}: ${evidence}`);
      fitReasoning.push(`${assessment.support === 'strong' ? 'Strong' : 'Partial'} support for "${assessment.requirement}" from ${assessment.sources.length > 0 ? assessment.sources.join(', ') : 'resume/profile evidence'}.`);
    }

    if (assessment.support !== 'strong') {
      gaps.push(assessment.gap || `Demonstrate direct evidence for: ${assessment.requirement}`);
    }
  }

  return { qualifications, fitReasoning, gaps };
}

function compactGithubEvidence(githubData) {
  if (!githubData) {
    return null;
  }

  const repos = Array.isArray(githubData.top_repos)
    ? githubData.top_repos.slice(0, 5).map((repo) => ({
        name: repo?.name ?? '',
        description: repo?.description ?? '',
        language: repo?.language ?? '',
        stars: Number(repo?.stars ?? 0),
        topics: Array.isArray(repo?.topics) ? repo.topics.slice(0, 8) : [],
        url: repo?.url ?? '',
      }))
    : [];

  return {
    username: githubData.username ?? '',
    bio: githubData.bio ?? '',
    original_repo_count: Number(githubData.original_repo_count ?? 0),
    public_repos: Number(githubData.public_repos ?? 0),
    followers: Number(githubData.followers ?? 0),
    total_stars: Number(githubData.total_stars ?? 0),
    top_languages: Array.isArray(githubData.top_languages) ? githubData.top_languages.slice(0, 8) : [],
    top_repos: repos,
  };
}

function compactLinkedInEvidence(linkedinData) {
  if (!linkedinData?.rawText) {
    return null;
  }

  return {
    sourceUrl: linkedinData.sourceUrl ?? '',
    rawText: String(linkedinData.rawText).slice(0, 2500),
  };
}

function githubEvidenceText(githubData) {
  if (!githubData) {
    return '';
  }

  const repos = Array.isArray(githubData.top_repos) ? githubData.top_repos : [];
  return [
    githubData.username,
    githubData.bio,
    Array.isArray(githubData.top_languages) ? githubData.top_languages.join(' ') : '',
    repos.map((repo) => [
      repo?.name,
      repo?.description,
      repo?.language,
      Array.isArray(repo?.topics) ? repo.topics.join(' ') : '',
    ].filter(Boolean).join(' ')).join(' '),
  ].filter(Boolean).join(' ');
}

function buildScoringEvidenceText({ resumeSignal, githubData, linkedinData }) {
  return [
    resumeSignal,
    githubEvidenceText(githubData),
    linkedinData?.rawText,
  ].filter(Boolean).join('\n');
}

function requirementOverlapScore(requirement, evidenceText) {
  const evidenceTokens = new Set(tokenizeForScoring(evidenceText));
  const requirementTokens = tokenizeForScoring(requirement);

  return requirementTokens.reduce((score, token) => score + (evidenceTokens.has(token) ? 1 : 0), 0);
}

function hasNegativeFitSignal(values) {
  return /\b(?:lack|lacks|lacking|missing|absent|no direct evidence|limited alignment|limited signal|does not demonstrate|doesn't demonstrate|not demonstrate|not shown|without)\b/i
    .test(values.filter(Boolean).join(' '));
}

function recommendationFromScore(score) {
  if (score >= 85) return 'Strong Fit';
  if (score >= 70) return 'Good Fit';
  if (score >= 55) return 'Possible Fit';
  if (score >= 40) return 'Weak Fit';
  return 'Low Fit';
}

function calibrateRecommendationScore({
  posting,
  resumeSignal,
  githubData,
  linkedinData,
  baseScore,
  githubBonus,
  linkedinBonus,
  fitReasoning,
  gaps,
  requirementAssessments = [],
}) {
  const requirements = collectPostingRequirements(posting);
  const evidenceText = buildScoringEvidenceText({ resumeSignal, githubData, linkedinData });

  let strongCount = 0;
  let moderateCount = 0;
  let limitedCount = 0;
  const limitedRequirements = [];

  requirements.forEach((requirement) => {
    const overlap = requirementOverlapScore(requirement, evidenceText);
    if (overlap >= 3) {
      strongCount += 1;
    } else if (overlap >= 1) {
      moderateCount += 1;
    } else {
      limitedCount += 1;
      limitedRequirements.push(requirement);
    }
  });

  const requirementCount = requirements.length;
  let cap = 100;
  const requiredAssessments = requirementAssessments.filter((assessment) => assessment.importance === 'required');
  const missingRequiredCount = requiredAssessments.filter((assessment) => assessment.support === 'none').length;
  const weakRequiredCount = requiredAssessments.filter((assessment) => assessment.support !== 'strong').length;

  if (requirementCount > 0) {
    if (strongCount === 0) {
      cap = Math.min(cap, limitedCount > 0 ? 65 : 72);
    }
    if (limitedCount >= Math.ceil(requirementCount / 2)) {
      cap = Math.min(cap, 60);
    }
    if (strongCount / requirementCount < 0.5) {
      cap = Math.min(cap, 78);
    }
  }

  if (requiredAssessments.length > 0) {
    if (missingRequiredCount > 0) {
      cap = Math.min(cap, missingRequiredCount >= Math.ceil(requiredAssessments.length / 2) ? 55 : 70);
    }
    if (weakRequiredCount === requiredAssessments.length) {
      cap = Math.min(cap, 65);
    }
  }

  if (hasNegativeFitSignal([...fitReasoning, ...gaps])) {
    cap = Math.min(cap, strongCount === 0 ? 65 : 75);
  }

  const rawFinalScore = Math.min(100, baseScore + githubBonus + linkedinBonus);
  const confidence = Math.min(rawFinalScore, cap);

  let calibratedBaseScore = baseScore;
  let calibratedGithubBonus = githubBonus;
  let calibratedLinkedinBonus = linkedinBonus;

  if (confidence < rawFinalScore) {
    calibratedBaseScore = clampInt(confidence - calibratedGithubBonus - calibratedLinkedinBonus, 0, 100);
    if (calibratedBaseScore + calibratedGithubBonus + calibratedLinkedinBonus > confidence) {
      calibratedGithubBonus = clampInt(confidence - calibratedBaseScore - calibratedLinkedinBonus, 0, calibratedGithubBonus);
    }
    if (calibratedBaseScore + calibratedGithubBonus + calibratedLinkedinBonus > confidence) {
      calibratedLinkedinBonus = clampInt(confidence - calibratedBaseScore - calibratedGithubBonus, 0, calibratedLinkedinBonus);
    }
  }

  return {
    confidence,
    baseScore: calibratedBaseScore,
    githubBonus: calibratedGithubBonus,
    linkedinBonus: calibratedLinkedinBonus,
    recommendation: recommendationFromScore(confidence),
    limitedRequirements,
  };
}

function buildEvidenceFallbacks({ posting, resumeSignal, githubData, linkedinData }) {
  const fallback = [];
  const requirementText = [
    posting?.requiredQualifications,
    posting?.preferredQualifications,
    posting?.overview,
    posting?.studentRoleDescription,
  ]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  if (typeof resumeSignal === 'string' && resumeSignal.trim()) {
    const resumeLines = resumeSignal
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const skillsLine = resumeLines.find((line) => /^skills:/i.test(line));
    const majorLine = resumeLines.find((line) => /^major:/i.test(line));
    const courseworkLine = resumeLines.find((line) => /^transcript coursework:/i.test(line));
    fallback.push(`[Resume] ${skillsLine || majorLine || 'Saved resume/profile fields provide the baseline evidence for this match.'}`);
    if (courseworkLine) {
      fallback.push(`[Transcript] ${courseworkLine.replace(/^transcript coursework:\s*/i, '')}`);
    }
  }

  if (githubData) {
    const repo = Array.isArray(githubData.top_repos) ? githubData.top_repos[0] : null;
    const languages = Array.isArray(githubData.top_languages) ? githubData.top_languages.filter(Boolean).join(', ') : '';
    const repoSummary = repo?.name
      ? `${repo.name}${repo.description ? `: ${repo.description}` : ''}${repo.language ? ` (${repo.language})` : ''}`
      : '';
    fallback.push(`[GitHub] ${repoSummary || (languages ? `Top languages include ${languages}.` : `GitHub profile ${githubData.username || ''} was available for scoring.`)}`);
  }

  if (linkedinData?.rawText) {
    const sentence =
      linkedinData.rawText
        .split(/[.!?]\s+/)
        .map((entry) => entry.trim())
        .find((entry) => {
          const lower = entry.toLowerCase();
          return requirementText.split(/\s+/).some((word) => word.length > 4 && lower.includes(word));
        }) ||
      linkedinData.rawText.slice(0, 180).trim();
    fallback.push(`[LinkedIn] ${sentence}`);
  }

  return fallback.filter(Boolean);
}

function stripJsonFences(text) {
  return String(text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function parseJsonObjectFromOllama(responseText) {
  if (!responseText || typeof responseText !== 'string') {
    throw new Error('Empty or non-string response from Ollama');
  }

  let cleaned = responseText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`No JSON object found in Ollama response. Raw: ${responseText.slice(0, 200)}`);
  }

  try {
    return JSON.parse(match[0]);
  } catch (e) {
    const fixed = match[0]
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/:\s*'([^']*)'/g, ': "$1"');

    try {
      return JSON.parse(fixed);
    } catch (e2) {
      throw new Error(`JSON parse failed after cleanup: ${e2.message} | Raw: ${responseText.slice(0, 200)}`);
    }
  }
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function getStudentGithubUrl(student) {
  return pickFirstNonEmpty(student?.github, student?.githubUrl, student?.github_url);
}

function getStudentLinkedInUrl(student) {
  return pickFirstNonEmpty(student?.linkedin, student?.linkedInUrl, student?.linkedinUrl, student?.linkedInURL, student?.linkedin_url);
}

function normalizeRecommendationLabel(value) {
  if (value === 'Strong Fit' || value === 'Good Fit' || value === 'Possible Fit' || value === 'Weak Fit') {
    return value;
  }
  return 'Possible Fit';
}

function buildFallbackRecommendation(posting, index, fallbackReason) {
  const confidence = clampInt(72 - index * 4, 45, 90);
  const baseScore = clampInt(confidence, 0, 100);
  return {
    postingId: String(posting.id),
    confidence,
    reason: fallbackReason,
    score_breakdown: {
      base_score: baseScore,
      github_bonus: 0,
      github_available: false,
      github_sparse: false,
      linkedin_bonus: 0,
      linkedin_available: false,
      linkedin_sparse: false,
    },
    qualifications: [
      'Available academic, skills, and interest signals were compared with this posting.',
      'This recommendation uses a backup match when personalized scoring is temporarily unavailable.',
    ],
    fit_reasoning: [
      fallbackReason,
      'Add more profile evidence to improve future recommendation quality.',
    ],
    gaps: ['Provide more role-specific project evidence in application responses for stronger confidence.'],
    recommendation: confidence >= 80 ? 'Good Fit' : confidence >= 65 ? 'Possible Fit' : 'Weak Fit',
    fallback: true,
  };
}

function normalizeRecommendationObject(posting, parsed, githubData, linkedinData, resumeSignal = '') {
  const requirementAssessments = normalizeRequirementAssessments(parsed?.requirement_assessments);
  const assessmentStrings = buildStringsFromRequirementAssessments(requirementAssessments);
  const assessmentBaseScore = scoreFromRequirementAssessments(requirementAssessments);
  const parsedBaseScore = parsed?.score_breakdown?.base_score ?? parsed?.base_score;
  const parsedBaseScoreNumber = Number(parsedBaseScore);
  const baseScore = !Number.isFinite(parsedBaseScoreNumber) || parsedBaseScoreNumber <= 0
    ? assessmentBaseScore
    : Math.min(clampInt(parsedBaseScore, 0, 100), requirementAssessments.length > 0 ? assessmentBaseScore + 8 : 100);
  const githubAvailable = Boolean(githubData);
  const linkedinAvailable = Boolean(linkedinData?.rawText);

  const githubBonusRaw = githubAvailable ? clampInt(parsed?.score_breakdown?.github_bonus, 0, 15) : 0;
  const linkedinBonusRaw = linkedinAvailable ? clampInt(parsed?.score_breakdown?.linkedin_bonus, 0, 10) : 0;

  const githubSparseFromData = Boolean(githubData && Number(githubData.original_repo_count ?? 0) < 3);
  const linkedinSparseFromData = Boolean(linkedinData?.rawText && linkedinData.rawText.length < 400);
  const githubSparse = githubAvailable
    ? githubSparseFromData || toBool(parsed?.score_breakdown?.github_sparse, false)
    : false;
  const linkedinSparse = linkedinAvailable
    ? linkedinSparseFromData || toBool(parsed?.score_breakdown?.linkedin_sparse, false)
    : false;

  const githubBonus = githubSparse ? Math.min(3, githubBonusRaw) : githubBonusRaw;
  const linkedinBonus = linkedinSparse ? Math.min(2, linkedinBonusRaw) : linkedinBonusRaw;

  const evidenceFallbacks = buildEvidenceFallbacks({ posting, resumeSignal, githubData, linkedinData });
  const qualifications = [
    ...assessmentStrings.qualifications,
    ...sanitizeStringList(parsed?.qualifications, []).filter(isUsefulEvidenceString),
    ...evidenceFallbacks,
  ].filter((entry, index, arr) => arr.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index);
  const fitReasoning = [
    ...assessmentStrings.fitReasoning,
    ...sanitizeStringList(parsed?.fit_reasoning, []),
  ]
    .filter(isUsefulEvidenceString)
    .filter((item) => !isRecommendationLabelString(item));
  const gaps = [
    ...assessmentStrings.gaps,
    ...sanitizeStringList(parsed?.gaps, []),
  ]
    .filter(isUsefulEvidenceString)
    .filter((gap) => !isRecommendationLabelString(gap))
    .filter((gap) => !/no\s+github|no\s+linkedin/i.test(gap));

  const fitReasoningWithSparseNotes = [...fitReasoning];
  if (githubSparse && !fitReasoningWithSparseNotes.some((item) => /github available but limited signal for this position/i.test(item))) {
    fitReasoningWithSparseNotes.push('GitHub available but limited signal for this position');
  }
  if (linkedinSparse && !fitReasoningWithSparseNotes.some((item) => /linkedin available but limited additional context beyond resume/i.test(item))) {
    fitReasoningWithSparseNotes.push('LinkedIn available but limited additional context beyond resume');
  }

  const dedupedFitReasoning = fitReasoningWithSparseNotes
    .map((item) => item.replace(/^\[(GitHub|LinkedIn)\]\s+/i, '$1 '))
    .filter((entry, index, arr) => arr.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index);

  const calibratedScore = calibrateRecommendationScore({
    posting,
    resumeSignal,
    githubData,
    linkedinData,
    baseScore,
    githubBonus,
    linkedinBonus,
    fitReasoning: dedupedFitReasoning,
    gaps,
    requirementAssessments,
  });

  const calibratedGaps = [
    ...gaps,
    ...calibratedScore.limitedRequirements.map((requirement) => `Demonstrate direct evidence for: ${requirement}`),
  ].filter((entry, index, arr) => arr.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index);

  const oneLineReason =
    pickFirstNonEmpty(
      dedupedFitReasoning.find((item) => !isRecommendationLabelString(item)),
      qualifications[0],
      typeof parsed?.reason === 'string' && !isRecommendationLabelString(parsed.reason) ? parsed.reason : '',
    ) || 'Profile shows meaningful overlap with this research position.';

  return {
    postingId: String(posting.id),
    confidence: calibratedScore.confidence,
    reason: oneLineReason,
    score_breakdown: {
      base_score: calibratedScore.baseScore,
      github_bonus: calibratedScore.githubBonus,
      github_available: githubAvailable,
      github_sparse: githubSparse,
      linkedin_bonus: calibratedScore.linkedinBonus,
      linkedin_available: linkedinAvailable,
      linkedin_sparse: linkedinSparse,
    },
    qualifications: qualifications.length > 0 ? qualifications.slice(0, 6) : ['Resume provides baseline qualifications aligned to this role.'],
    fit_reasoning: dedupedFitReasoning.length > 0
      ? dedupedFitReasoning.slice(0, 6)
      : ['This candidate has partial evidence aligned to the listed research requirements.'],
    gaps: calibratedGaps.length > 0 ? calibratedGaps.slice(0, 4) : ['Demonstrate deeper, role-specific examples during application review.'],
    recommendation: calibratedScore.recommendation,
    requirement_assessments: requirementAssessments,
    evidence_sources: {
      resume: {
        available: Boolean(typeof resumeSignal === 'string' && resumeSignal.trim()),
      },
      github: {
        available: Boolean(githubData),
        username: githubData?.username ?? null,
        url: githubData?.profile_url ?? (githubData?.username ? `https://github.com/${githubData.username}` : null),
        repositories_considered: Array.isArray(githubData?.top_repos) ? githubData.top_repos.length : 0,
      },
      linkedin: {
        available: Boolean(linkedinData?.rawText),
        url: linkedinData?.sourceUrl ?? null,
        characters_considered: typeof linkedinData?.rawText === 'string' ? linkedinData.rawText.length : 0,
      },
    },
    githubData: githubData ?? null,
    linkedinData: linkedinData ?? null,
  };
}

function buildScoringPrompt(researchPosition, resumeText, githubData, linkedinData) {
  const requirementItems = collectPostingRequirementItems(researchPosition);
  const promptPayload = {
    research_posting: {
      id: researchPosition?.id ?? '',
      title: researchPosition?.title ?? '',
      category: researchPosition?.category ?? '',
      research_areas: Array.isArray(researchPosition?.researchAreas) ? researchPosition.researchAreas : [],
      required_skills: Array.isArray(researchPosition?.skillsNeeded) ? researchPosition.skillsNeeded : [],
      professor_research_areas: Array.isArray(researchPosition?.professorResearchAreas) ? researchPosition.professorResearchAreas : [],
      professor_research_interests: Array.isArray(researchPosition?.professorResearchInterests) ? researchPosition.professorResearchInterests : [],
      overview: researchPosition?.overview ?? '',
      student_background_expectations: researchPosition?.studentRoleDescription ?? '',
      requirements: requirementItems,
    },
    student_evidence: {
      resume_profile_transcript_text: String(resumeText ?? '').slice(0, 3500),
      github: compactGithubEvidence(githubData),
      linkedin: compactLinkedInEvidence(linkedinData),
    },
  };

  return `You score student evidence against a university research posting.
Return RAW JSON only. Use only the evidence in INPUT. Do not invent facts.

INPUT:
${JSON.stringify(promptPayload, null, 2)}

Instructions:
- First assess each requirement independently.
- support must be "strong", "partial", or "none".
- Use "strong" only when direct evidence clearly supports the requirement.
- Use "partial" when evidence is related but incomplete.
- Use "none" when no direct evidence is present.
- Required requirements matter more than preferred requirements.
- Use overlap between student interests and research_areas/professor_research_areas/professor_research_interests as a positive research-fit signal.
- Use required_skills as structured skill requirements when assessing student skills and evidence.
- Missing GitHub or LinkedIn is not a gap. Sparse or irrelevant GitHub/LinkedIn should receive 0 bonus.
- External-source bonuses must be directly relevant to this posting.
- Prefer exact evidence phrases from resume/profile/transcript/GitHub/LinkedIn.
- Never return placeholder instructions. Every string must be a real student-facing explanation.
- Do not expose JSON key names in user-facing strings.

Scoring guidance:
- base_score is 0-100 from resume/profile/transcript evidence only.
- github_bonus is 0-15, and 0 if GitHub is unavailable or irrelevant.
- linkedin_bonus is 0-10, and 0 if LinkedIn is unavailable or irrelevant.
- github_sparse is true when GitHub exists but has fewer than 3 original repos or little relevant evidence.
- linkedin_sparse is true when LinkedIn exists but has under 400 useful characters or little relevant evidence.
- Do not calculate final confidence; code will calculate and cap it from your component scores.

Return exactly:
{
  "score_breakdown": {
    "base_score": 0,
    "github_bonus": 0,
    "github_available": false,
    "github_sparse": false,
    "linkedin_bonus": 0,
    "linkedin_available": false,
    "linkedin_sparse": false
  },
  "requirement_assessments": [
    {
      "requirement": "requirement text",
      "importance": "required",
      "support": "strong",
      "sources": ["resume"],
      "evidence": "real evidence phrase from the submitted materials",
      "gap": "specific missing evidence or empty string when no gap exists"
    }
  ],
  "qualifications": [
    "source-backed qualification written in plain English"
  ],
  "fit_reasoning": [
    "specific plain-English explanation of how evidence supports a project requirement"
  ],
  "gaps": [
    "specific plain-English improvement area when evidence is missing or incomplete"
  ],
  "recommendation": "Strong Fit"
}
Return only the JSON object.`;
}

export async function scoreOnePosting({ posting, index, resumeSignal, githubData, linkedinData }) {
  let responseText = '';
  try {
    const prompt = buildScoringPrompt(posting, resumeSignal, githubData, linkedinData);
    responseText = await callOllama(prompt);
    const parsed = parseJsonObjectFromOllama(responseText);

    return normalizeRecommendationObject(posting, parsed, githubData, linkedinData, resumeSignal);
  } catch (err) {
    console.error('[scoreOnePosting] Failed for posting', posting?.id || posting?.postingId, err.message);
    return buildFallbackRecommendation(
      posting,
      index,
      'Recommended from your saved profile and the project details while personalized scoring refreshes.'
    );
  }
}

export async function getOllamaRecommendations({ student, postings, resumeText }) {
  if (!Array.isArray(postings) || postings.length === 0) {
    return [];
  }

  const githubUrl = getStudentGithubUrl(student);
  const linkedinUrl = getStudentLinkedInUrl(student);
  const resumeSignal = pickFirstNonEmpty(student?.resumeText, resumeText, student?.summary, '') || '';

  const [githubData, linkedinData] = await Promise.all([
    githubUrl ? fetchGitHubData(githubUrl).catch(() => null) : Promise.resolve(null),
    linkedinUrl ? fetchLinkedInData(linkedinUrl).catch(() => null) : Promise.resolve(null),
  ]);

  const scored = await Promise.all(
    postings.map((posting, index) =>
      scoreOnePosting({
        posting,
        index,
        resumeSignal,
        githubData,
        linkedinData,
      })
    )
  );

  return scored.sort((a, b) => b.confidence - a.confidence);
}

function normalizeRecruiterMatches(parsed, candidates) {
  const byId = new Map(candidates.map((candidate) => [String(candidate?.id ?? ''), candidate]));
  const rawMatches = Array.isArray(parsed?.matches) ? parsed.matches : [];

  const normalized = rawMatches
    .map((match) => {
      const candidateId = String(match?.candidateId ?? match?.id ?? '').trim();
      const candidate = byId.get(candidateId);
      if (!candidate) {
        return null;
      }

      return {
        candidateId,
        candidateName: String(match?.candidateName ?? candidate.name ?? 'Candidate'),
        matchScore: clampInt(match?.matchScore ?? match?.score, 0, 100),
        explanation: String(match?.explanation ?? 'Candidate has verified research evidence aligned to this role.').trim(),
        reasons: sanitizeStringList(match?.reasons, []).slice(0, 5),
      };
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized.sort((a, b) => b.matchScore - a.matchScore);
  }

  return candidates
    .map((candidate) => ({
      candidateId: String(candidate.id),
      candidateName: String(candidate.name ?? 'Candidate'),
      matchScore: clampInt(candidate.matchPercentage ?? candidate.researchScore ?? 70, 0, 100),
      explanation: `${candidate.name} has verified research evidence, faculty endorsements, and project work relevant to this role.`,
      reasons: [
        `Research areas: ${Array.isArray(candidate.researchAreas) ? candidate.researchAreas.slice(0, 3).join(', ') : 'verified research area'}`,
        `Skills: ${Array.isArray(candidate.skills) ? candidate.skills.slice(0, 4).join(', ') : 'verified technical skills'}`,
        `${candidate.verifiedContributions ?? 0} verified contributions reviewed by faculty`,
      ],
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export async function getRecruiterCandidateMatches({ role, candidates }) {
  const safeCandidates = Array.isArray(candidates) ? candidates.slice(0, 12) : [];
  if (safeCandidates.length === 0) {
    return [];
  }

  const prompt = `You rank research candidates for a technical recruiting role. Return RAW JSON only.

Rank these students for the recruiting role using only the provided evidence: candidate profile, research history, skills, publications, presentations, verified contributions, and faculty endorsements.

ROLE:
${JSON.stringify(role, null, 2)}

CANDIDATES:
${JSON.stringify(safeCandidates, null, 2)}

Rules:
- Do not invent projects, publications, skills, schools, or endorsements.
- Favor verified research contributions and faculty endorsements over listed skills alone.
- Compare required skills, preferred skills, research areas, and experience level.
- Penalize missing required skills more than missing preferred skills.
- Each reason must cite an evidence field such as skills, researchAreas, verifiedContributions, publications, presentations, endorsements, projects, or GitHub.
- Return each score from 0 to 100.

Return exactly:
{
  "matches": [
    {
      "candidateId": "candidate id",
      "candidateName": "candidate name",
      "matchScore": 0,
      "explanation": "one concise evidence-backed explanation",
      "reasons": ["3 to 5 evidence-backed reasons"],
      "evidenceFields": ["skills"]
    }
  ]
}`;

  const responseText = await callOllama(prompt);
  const parsed = parseJsonObjectFromOllama(responseText);
  return normalizeRecruiterMatches(parsed, safeCandidates);
}

export async function getRecruiterCandidateSummary({ candidate }) {
  const prompt = `You summarize a student researcher for a recruiter. Return RAW JSON only.

Use only the evidence in this candidate profile. Mention verified contributions, skills, projects, publications, presentations, endorsements, evidence links, and GitHub activity when present.
Do not invent missing achievements. Prefer concrete evidence over generic praise.

CANDIDATE:
${JSON.stringify(candidate, null, 2)}

Return exactly:
{
  "summary": "4 to 6 sentence recruiter-facing summary"
}`;

  const responseText = await callOllama(prompt);
  const parsed = parseJsonObjectFromOllama(responseText);
  return typeof parsed?.summary === 'string' && parsed.summary.trim()
    ? parsed.summary.trim()
    : `${candidate?.name ?? 'This candidate'} has verified research contributions and evidence-backed project work.`;
}

export async function getRecruiterOutreachMessage({ candidate, position }) {
  const prompt = `You write concise, professional recruiter outreach. Return RAW JSON only.

Write a message to the candidate about this position. Use specific evidence from their research profile. Do not invent company details.
Mention at most two specific evidence points. Keep the message human, direct, and under 160 words.

POSITION:
${position}

CANDIDATE:
${JSON.stringify(candidate, null, 2)}

Return exactly:
{
  "message": "professional outreach message under 160 words"
}`;

  const responseText = await callOllama(prompt);
  const parsed = parseJsonObjectFromOllama(responseText);
  return typeof parsed?.message === 'string' && parsed.message.trim()
    ? parsed.message.trim()
    : `Hi ${candidate?.name ?? 'there'}, your verified research experience looks relevant for ${position}. I would like to connect about a role that aligns with your project work, skills, and faculty-endorsed contributions.`;
}

export async function getDeanDepartmentResearchReport({ metrics }) {
  const prompt = `You write executive research outcomes reports for a university dean. Return RAW JSON only.

Use only the provided metrics. Summarize research opportunity demand, mentorship capacity, student participation, access gaps, progress-report activity, and reported versus verified outcomes.

METRICS:
${JSON.stringify(metrics, null, 2)}

Rules:
- Do not invent numbers.
- Do not mention grant success rate, institutional grant funding, patents, peer rankings, funding per faculty, faculty productivity scores, or university-wide publication totals unless those exact metrics are present in METRICS.
- Distinguish facts from recommendations.
- Distinguish reported outcomes from faculty-verified outcomes.
- Write in a concise, professional executive style.
- Include 4 to 6 concrete metric-backed sentences.
- Every sentence must refer to a provided metric, trend, count, rate, or named category from METRICS.

Return exactly:
{
  "report": "executive summary"
}`;

  const responseText = await callOllama(prompt);
  const parsed = parseJsonObjectFromOllama(responseText);
  return typeof parsed?.report === 'string' && parsed.report.trim()
    ? parsed.report.trim()
    : 'Displayed platform metrics show current research demand, available positions, student placements, fill rate, participation funnel movement, and reported versus verified outcomes. Recommendations should be reviewed against the cited dashboard metrics before export.';
}

export async function getDeanInsights({ metrics }) {
  const prompt = `You are an institutional research strategy advisor for a dean. Return RAW JSON only.

Use only the provided metrics to generate actionable insights. Cover strengths, areas needing improvement, emerging trends, resource recommendations, faculty mentorship highlights, and research growth opportunities.

METRICS:
${JSON.stringify(metrics, null, 2)}

Rules:
- Do not invent facts or numbers.
- Keep recommendations actionable and specific.
- Each insight must cite the metric or dashboard field it is based on.
- Return 5 to 7 insight objects.

Return exactly:
{
  "insights": [
    {
      "title": "short title",
      "category": "Strength | Improvement | Trend | Resource | Mentorship | Growth",
      "summary": "metric-backed insight",
      "action": "recommended action",
      "evidenceField": "metric or field name"
    }
  ]
}`;

  const responseText = await callOllama(prompt);
  const parsed = parseJsonObjectFromOllama(responseText);
  const insights = Array.isArray(parsed?.insights) ? parsed.insights : [];
  return insights
    .map((insight) => ({
      title: String(insight?.title ?? 'Research insight').trim(),
      category: String(insight?.category ?? 'Growth').trim(),
      summary: String(insight?.summary ?? 'Platform metrics indicate a research growth opportunity.').trim(),
      action: String(insight?.action ?? 'Review department capacity and align resources to demand.').trim(),
    }))
    .filter((insight) => insight.title && insight.summary)
    .slice(0, 7);
}

export async function parseResumeWithOllama({ resumeBase64, mode, fileName: _fileName }) {
  if (typeof resumeBase64 !== 'string' || !resumeBase64.trim()) {
    throw new Error('resumeBase64 is required.');
  }

  const cleanBase64 = resumeBase64.replace(/^data:application\/pdf;base64,/, '');
  const text = await extractPdfTextFromBase64(cleanBase64);

  if (!text) {
    return mode === 'skills' ? [] : {};
  }

  // Keep prompt size reasonable.
  const cappedText = text.slice(0, 12000);
  const heuristic = parseResumeHeuristically(cappedText);

  let responseText = '';
  try {
    const prompt = buildResumePrompt(mode, cappedText);
    responseText = await callOllama(prompt);
  } catch {
    // Fall back to local heuristics if Ollama is unavailable for this request.
  }

  if (mode === 'skills') {
    const parsed = tryParseJsonText(responseText, true);
    const evidenceBackedParsed = Array.isArray(parsed)
      ? parsed.filter((skill) => typeof skill === 'string' && appearsInResume(skill, cappedText))
      : [];
    const merged = normalizeSkills([...evidenceBackedParsed, ...heuristic.skills]);
    return merged;
  }

  const parsed = tryParseJsonText(responseText, false);
  const parsedSkills = Array.isArray(parsed.skills)
    ? parsed.skills.filter((skill) => typeof skill === 'string' && appearsInResume(skill, cappedText))
    : [];
  const parsedMajor =
    typeof parsed.major === 'string' && parsed.major.trim() && appearsInResume(parsed.major, cappedText)
      ? parsed.major.trim()
      : undefined;
  const parsedAcademicYear =
    typeof parsed.academicYear === 'string' && ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'].includes(parsed.academicYear.trim())
      ? parsed.academicYear.trim()
      : undefined;

  return {
    fullName: typeof parsed.fullName === 'string' ? parsed.fullName.trim() : undefined,
    email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email.trim() : heuristic.email,
    major: heuristic.major ?? parsedMajor,
    academicYear: heuristic.academicYear ?? parsedAcademicYear,
    skills: normalizeSkills([...parsedSkills, ...heuristic.skills]),
  };
}
