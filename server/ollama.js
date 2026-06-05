// Proxy for Ollama AI recommendations and resume parsing.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { fetchGitHubData } from './utils/fetchGitHubData.js';
import { fetchLinkedInData } from './utils/fetchLinkedInData.js';

function getOllamaConfig() {
  return {
    url: process.env.OLLAMA_URL || 'http://localhost:11434/api/generate',
    model: process.env.OLLAMA_MODEL || 'llama3.2:1b',
    timeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS || 120000),
  };
}

async function callOllama(prompt) {
  const config = getOllamaConfig();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: config.model, prompt, stream: false }),
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
  const yearMatch = text.match(/\b(Freshman|Sophomore|Junior|Senior|Graduate)\b/i);

  const majorPatterns = [
    /(?:major|field of study)\s*[:\-]\s*([^\n]+)/i,
    /(?:bachelor(?:'s)?|b\.?s\.?|master(?:'s)?|m\.?s\.?)\s+(?:of\s+)?(?:science|arts)?\s*(?:in)?\s*([^\n,;]+)/i,
  ];

  let major;
  for (const pattern of majorPatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      major = match[1].trim();
      break;
    }
  }

  return {
    email: emailMatch?.[0]?.trim(),
    academicYear: yearMatch?.[1] ? `${yearMatch[1][0].toUpperCase()}${yearMatch[1].slice(1).toLowerCase()}` : undefined,
    major,
    skills: extractSkillsHeuristically(text),
  };
}

function buildResumePrompt(mode, resumeText) {
  const header = 'You are a resume parser. Return RAW JSON only, no markdown fences, no prose.';

  if (mode === 'skills') {
    return `${header}\nExtract technical and soft skills from the resume text.\nReturn JSON array of short strings.\n\nResume text:\n${resumeText}`;
  }

  return `${header}\nExtract these fields from the resume text:\n- fullName (string)\n- email (string)\n- major (string)\n- academicYear (one of: Freshman, Sophomore, Junior, Senior, Graduate)\n- skills (array of strings)\nOnly include fields you are reasonably confident in.\nReturn a JSON object only.\n\nResume text:\n${resumeText}`;
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

function sanitizeStringList(input, fallback = []) {
  if (!Array.isArray(input)) {
    return fallback;
  }

  return input
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);
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
      .replace(/(['"])?([a-zA-Z_][a-zA-Z0-9_]*)(['"])?:/g, '"$2":')
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

function normalizeRecommendationObject(posting, parsed, githubData, linkedinData) {
  const baseScore = clampInt(parsed?.score_breakdown?.base_score, 0, 100);
  const githubAvailable = toBool(parsed?.score_breakdown?.github_available, Boolean(githubData));
  const linkedinAvailable = toBool(parsed?.score_breakdown?.linkedin_available, Boolean(linkedinData));

  const githubBonusRaw = githubAvailable ? clampInt(parsed?.score_breakdown?.github_bonus, 0, 15) : 0;
  const linkedinBonusRaw = linkedinAvailable ? clampInt(parsed?.score_breakdown?.linkedin_bonus, 0, 10) : 0;

  const githubSparse = githubAvailable ? toBool(parsed?.score_breakdown?.github_sparse, false) : false;
  const linkedinSparse = linkedinAvailable ? toBool(parsed?.score_breakdown?.linkedin_sparse, false) : false;

  const githubBonus = githubSparse ? Math.min(3, githubBonusRaw) : githubBonusRaw;
  const linkedinBonus = linkedinSparse ? Math.min(2, linkedinBonusRaw) : linkedinBonusRaw;

  const confidenceScore = Math.min(100, baseScore + githubBonus + linkedinBonus);

  const qualifications = sanitizeStringList(parsed?.qualifications, []);
  const fitReasoning = sanitizeStringList(parsed?.fit_reasoning, []);
  const gaps = sanitizeStringList(parsed?.gaps, []).filter((gap) => !/no\s+github|no\s+linkedin/i.test(gap));

  const fitReasoningWithSparseNotes = [...fitReasoning];
  if (githubSparse && !fitReasoningWithSparseNotes.some((item) => /github available but limited signal for this position/i.test(item))) {
    fitReasoningWithSparseNotes.push('GitHub available but limited signal for this position');
  }
  if (linkedinSparse && !fitReasoningWithSparseNotes.some((item) => /linkedin available but limited additional context beyond resume/i.test(item))) {
    fitReasoningWithSparseNotes.push('LinkedIn available but limited additional context beyond resume');
  }

  const oneLineReason =
    pickFirstNonEmpty(
      fitReasoningWithSparseNotes[0],
      qualifications[0],
      typeof parsed?.reason === 'string' ? parsed.reason : '',
    ) || 'Profile shows meaningful overlap with this research position.';

  return {
    postingId: String(posting.id),
    confidence: confidenceScore,
    reason: oneLineReason,
    score_breakdown: {
      base_score: baseScore,
      github_bonus: githubBonus,
      github_available: githubAvailable,
      github_sparse: githubSparse,
      linkedin_bonus: linkedinBonus,
      linkedin_available: linkedinAvailable,
      linkedin_sparse: linkedinSparse,
    },
    qualifications: qualifications.length > 0 ? qualifications.slice(0, 6) : ['Resume provides baseline qualifications aligned to this role.'],
    fit_reasoning: fitReasoningWithSparseNotes.length > 0
      ? fitReasoningWithSparseNotes.slice(0, 6)
      : ['This candidate has partial evidence aligned to the listed research requirements.'],
    gaps: gaps.length > 0 ? gaps.slice(0, 4) : ['Demonstrate deeper, role-specific examples during application review.'],
    recommendation: normalizeRecommendationLabel(parsed?.recommendation),
  };
}

function buildScoringPrompt(researchPosition, resumeText, githubData, linkedinData) {
  return `You are an expert academic research advisor evaluating a student applicant for a research position.

You have access to the following information about the student:

RESEARCH POSITION REQUIREMENTS:
${JSON.stringify(researchPosition, null, 2)}

STUDENT RESUME TEXT:
${resumeText.slice(0, 2000)}

${githubData ? `
STUDENT GITHUB PROFILE:
- Username: ${githubData.username}
- Bio: ${githubData.bio}
- Public repos: ${githubData.public_repos} total, ${githubData.original_repo_count} original (non-forked)
- Followers: ${githubData.followers}
- Total stars across original repos: ${githubData.total_stars}
- Top languages: ${githubData.top_languages.join(', ')}
- Top repositories:
${githubData.top_repos.map((r) => `  * ${r.name}: ${r.description || 'no description'} [${r.language}] (${r.stars} stars) topics: ${r.topics?.join(', ') || 'none'}`).join('\n')}
` : 'GITHUB: Not provided or unavailable.'}

${linkedinData ? `
STUDENT LINKEDIN PROFILE (extracted text):
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
    <4-6 strings - specific qualifications from their actual resume/github/linkedin.
    Only reference GitHub if github_available is true. Only reference LinkedIn if linkedin_available is true.>
  ],
  "fit_reasoning": [
    <4-6 strings - specific reasons why they fit or don't fit THIS position's stated requirements.
    Reference the actual position requirements by name.
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

    return normalizeRecommendationObject(posting, parsed, githubData, linkedinData);
  } catch (err) {
    console.error('[scoreOnePosting] Failed for posting', posting?.id || posting?.postingId, err.message);
    console.log('[fallback] Triggered. Last parse error:', err?.message);
    console.log('[fallback] Raw text that failed:', responseText?.slice(0, 500));
    return {
      postingId: posting?.id || posting?.postingId,
      confidence: 50,
      reason: `Scoring failed: ${err.message}`,
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

  const githubUrl = pickFirstNonEmpty(student?.github, student?.githubUrl);
  const linkedinUrl = pickFirstNonEmpty(student?.linkedin, student?.linkedInUrl);
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
    const merged = normalizeSkills([...(Array.isArray(parsed) ? parsed : []), ...heuristic.skills]);
    return merged;
  }

  const parsed = tryParseJsonText(responseText, false);
  return {
    fullName: typeof parsed.fullName === 'string' ? parsed.fullName.trim() : undefined,
    email: typeof parsed.email === 'string' && parsed.email.trim() ? parsed.email.trim() : heuristic.email,
    major: typeof parsed.major === 'string' && parsed.major.trim() ? parsed.major.trim() : heuristic.major,
    academicYear:
      typeof parsed.academicYear === 'string' && parsed.academicYear.trim()
        ? parsed.academicYear.trim()
        : heuristic.academicYear,
    skills: normalizeSkills([...(Array.isArray(parsed.skills) ? parsed.skills : []), ...heuristic.skills]),
  };
}
