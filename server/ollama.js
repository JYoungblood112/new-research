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
  const header = 'You are a resume parser. Return RAW JSON only, no markdown fences, no prose.';

  if (mode === 'skills') {
    return `${header}\nExtract skills from the resume text.\nRules:\n- Copy only skills that explicitly appear in the resume text.\n- Include business/data skills such as Tableau, Databricks, Excel, Power BI, financial modeling, market research, leadership, communication when present.\n- Do not infer skills from school, job titles, projects, or repository names.\nReturn JSON array of short strings.\n\nResume text:\n${resumeText}`;
  }

  return `${header}\nExtract these fields from the resume text:\n- fullName (string)\n- email (string)\n- major (string)\n- academicYear (one of: Freshman, Sophomore, Junior, Senior, Master's, PhD)\n- skills (array of strings)\nRules:\n- Copy facts only when the resume text explicitly supports them.\n- major is the declared primary field of study only. If the education line says "B.S. in Business, Additional Major in CS/AI", major must be "Business".\n- academicYear must be based on the most recent in-progress academic degree. If it is PhD/Doctor of Philosophy/PhD Candidate, return "PhD". If it is MS/MA/MBA/Master of..., return "Master's". If it is BS/BA/Bachelor of..., infer Freshman/Sophomore/Junior/Senior from expected graduation year. Do not return Graduate.\n- skills must appear in the resume text.\nReturn a JSON object only.\n\nResume text:\n${resumeText}`;
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
  if (score >= 75) return 'Good Fit';
  if (score >= 55) return 'Possible Fit';
  return 'Weak Fit';
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
    fallback.push(`[Resume] ${skillsLine || majorLine || 'Saved resume/profile fields provide the baseline evidence for this match.'}`);
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
  console.log('[parseJson] Raw Ollama response:', responseText?.slice(0, 500));

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
      'Profile includes baseline academic and skills signals to evaluate against the posting.',
      'Recommendation fallback applied while enrichment analysis was unavailable.',
    ],
    fit_reasoning: [
      'The score was estimated from available profile context while keeping the resume baseline central.',
      'Detailed GitHub/LinkedIn enrichment was unavailable for this specific request.',
    ],
    gaps: ['Provide more role-specific project evidence in application responses for stronger confidence.'],
    recommendation: confidence >= 80 ? 'Good Fit' : confidence >= 65 ? 'Possible Fit' : 'Weak Fit',
  };
}

function normalizeRecommendationObject(posting, parsed, githubData, linkedinData, resumeSignal = '') {
  const baseScore = clampInt(parsed?.score_breakdown?.base_score, 0, 100);
  const githubAvailable = toBool(parsed?.score_breakdown?.github_available, Boolean(githubData));
  const linkedinAvailable = toBool(parsed?.score_breakdown?.linkedin_available, Boolean(linkedinData));

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
    ...sanitizeStringList(parsed?.qualifications, []).filter(isUsefulEvidenceString),
    ...evidenceFallbacks,
  ].filter((entry, index, arr) => arr.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index);
  const fitReasoning = sanitizeStringList(parsed?.fit_reasoning, [])
    .filter(isUsefulEvidenceString)
    .filter((item) => !isRecommendationLabelString(item));
  const gaps = sanitizeStringList(parsed?.gaps, [])
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
  return `You are an expert academic research advisor evaluating a student applicant for a research position.

You have access to the following information about the student:

RESEARCH POSITION REQUIREMENTS:
${JSON.stringify(researchPosition, null, 2)}

STUDENT RESUME TEXT:
${resumeText.slice(0, 2000)}

SOURCE COVERAGE:
- Resume/profile text included: ${typeof resumeText === 'string' && resumeText.trim() ? 'yes' : 'no'}
- GitHub fetched and included: ${githubData ? 'yes' : 'no'}
- LinkedIn fetched and included: ${linkedinData?.rawText ? 'yes' : 'no'}

${githubData ? `
STUDENT GITHUB PROFILE:
- Username: ${githubData.username}
- Profile URL: ${githubData.profile_url || `https://github.com/${githubData.username}`}
- Bio: ${githubData.bio}
- Public repos: ${githubData.public_repos} total, ${githubData.original_repo_count} original (non-forked)
- Followers: ${githubData.followers}
- Total stars across original repos: ${githubData.total_stars}
- Top languages: ${githubData.top_languages.join(', ')}
- Top repositories:
${githubData.top_repos.map((r) => `  * ${r.name}: ${r.description || 'no description'} [${r.language}] (${r.stars} stars) URL: ${r.url || `${githubData.profile_url || `https://github.com/${githubData.username}`}/${r.name}`} topics: ${r.topics?.join(', ') || 'none'}`).join('\n')}
` : 'GITHUB: Not provided or unavailable.'}

${linkedinData ? `
STUDENT LINKEDIN PROFILE (extracted text):
Source URL: ${linkedinData.sourceUrl || 'LinkedIn URL provided'}
${linkedinData.rawText}
` : 'LINKEDIN: Not provided or unavailable.'}

---

YOUR TASK: Score this student using the additive system below. Return ONLY a raw JSON object. No markdown, no code fences, no backticks, no explanation. Start with { and end with }.

---

SCORING SYSTEM - follow these steps exactly:

STAGE 1 - Base score from resume alone (0 to 100)
Score the student purely on their resume against the research position requirements.
This score stands on its own even if no GitHub or LinkedIn is provided.
Evaluate: relevant coursework, projects, technical skills, research/work experience, awards.
Assign: base_score (integer 0-100)

STAGE 2 - GitHub bonus (0 to 15 points, only if GitHub data is available)
Only score this if githubData is not null.
Only award points for content genuinely relevant to this research position.
Never subtract points for a sparse GitHub - award 0 if nothing is useful.
- Original repos in languages relevant to this research: 0-6 pts
- Repo descriptions or topics that directly relate to the research area: 0-5 pts
- Evidence of complexity or sustained work (stars, detailed READMEs): 0-4 pts
Set github_available: true
If GitHub has fewer than 3 original repos or no useful signal: set github_sparse: true and cap bonus at 3

If GitHub is not available:
Set github_bonus: 0, github_available: false, github_sparse: false

STAGE 3 - LinkedIn bonus (0 to 10 points, only if LinkedIn data is available)
Only score this if linkedinData is not null.
Only award points for content genuinely relevant to this research position.
Never subtract points for a sparse LinkedIn - award 0 if nothing is useful.
- Relevant internships or work experience not already on resume: 0-5 pts
- Relevant skills, endorsements, or certifications: 0-3 pts
- Research experience or academic projects listed: 0-2 pts
Set linkedin_available: true
If LinkedIn text is under 400 characters of real content: set linkedin_sparse: true and cap bonus at 2

If LinkedIn is not available:
Set linkedin_bonus: 0, linkedin_available: false, linkedin_sparse: false

STAGE 3.5 - Cross-source evidence check
Before assigning the final score, compare the position requirements against all available sources:
- Resume/profile text for degree, major, skills, interests, coursework, projects, and work experience.
- GitHub profile and repositories when githubData is available.
- LinkedIn profile text when linkedinData is available.
Do not invent evidence. If a source is available but irrelevant, mark it sparse or give 0 bonus.
Every qualification and fit_reasoning item must name the source it came from: [Resume], [GitHub], or [LinkedIn].
When GitHub is available, inspect repository names, descriptions, languages, topics, and URLs before assigning github_bonus.
When LinkedIn is available, inspect the extracted LinkedIn text before assigning linkedin_bonus.
Critical calibration rule: if no stated position requirement is strongly supported by direct evidence, confidence_score must be 65 or lower and recommendation cannot be "Strong Fit" or "Good Fit".
If a required skill/tool/domain such as ROS, robotics, algorithms, systems programming, lab technique, language, or framework is absent from all available sources, list it as a gap and keep the score proportional to the missing requirement.

STAGE 4 - Final score
confidence_score = min(100, base_score + github_bonus + linkedin_bonus)

---

Return exactly this JSON shape:
{
  "confidence_score": <integer 0-100>,
  "score_breakdown": {
    "base_score": <integer 0-100>,
    "github_bonus": <integer 0-15>,
    "github_available": <boolean>,
    "github_sparse": <boolean>,
    "linkedin_bonus": <integer 0-10>,
    "linkedin_available": <boolean>,
    "linkedin_sparse": <boolean>
  },
  "qualifications": [
    <4-6 strings - specific qualifications from their actual evidence.
    Prefix each with [Resume], [GitHub], or [LinkedIn].
    Include at least one [Resume] item.
    Include [GitHub] only if github_available is true.
    Include [LinkedIn] only if linkedin_available is true.>
  ],
  "fit_reasoning": [
    <4-6 strings - specific reasons why they fit or don't fit THIS position's stated requirements.
    Reference the actual position requirements by name and explain which source supports each claim.
    If github_sparse is true, include: "GitHub available but limited signal for this position"
    If linkedin_sparse is true, include: "LinkedIn available but limited additional context beyond resume"
    Never mention GitHub or LinkedIn negatively if they were not provided.>
  ],
  "gaps": [
    <2-4 strings - what is missing relative to this position. Frame constructively, not harshly.
    Never list "no GitHub" or "no LinkedIn" as a gap - these are optional.>
  ],
  "recommendation": <"Strong Fit" | "Good Fit" | "Possible Fit" | "Weak Fit">
}

Return ONLY a raw JSON object starting with { and ending with }.`;
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
    console.log('[fallback] Triggered. Last parse error:', err?.message);
    console.log('[fallback] Raw text that failed:', responseText?.slice(0, 500));
    if (err?.code === 'OLLAMA_UNAVAILABLE') {
      throw err;
    }
    return {
      postingId: posting?.id || posting?.postingId,
      confidence: 50,
      reason: 'Detailed scoring was unavailable because the model response could not be parsed. Retry after the model finishes processing.',
      score_breakdown: null,
      qualifications: [],
      fit_reasoning: [`Model output could not be parsed - ${err.message}`],
      gaps: [],
      recommendation: 'Possible Fit',
    };
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
    githubUrl ? fetchGitHubData(githubUrl) : Promise.resolve(null),
    linkedinUrl ? fetchLinkedInData(linkedinUrl) : Promise.resolve(null),
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
