import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { randomId, readStore, writeStore } from './store.js';
import { getSessionUserId } from './sessionStore.js';

const OLLAMA_MODEL = 'llama3.2:1b';

const upload = multer({ storage: multer.memoryStorage() });

const profileRouter = express.Router();
const VALID_ACADEMIC_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'];

function coerceText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'null') {
    return null;
  }

  return trimmed;
}

function extractEmail(text) {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
}

function extractName(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    if (extractEmail(line)) {
      continue;
    }
    if (line.length >= 2 && line.length <= 80) {
      return line;
    }
  }
  return null;
}

function extractLinkedIn(text) {
  const match =
    text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s),;]+/i)?.[0] ??
    text.match(/(?:www\.)?linkedin\.com\/[^\s),;]+/i)?.[0] ??
    null;

  if (!match) {
    return null;
  }

  return match.startsWith('http') ? match : `https://${match.replace(/^www\./i, 'www.')}`;
}

function extractGithubOrPortfolio(text) {
  const match =
    text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s),;]+/i)?.[0] ??
    text.match(/(?:www\.)?github\.com\/[^\s),;]+/i)?.[0] ??
    null;

  if (!match) {
    return null;
  }

  return match.startsWith('http') ? match : `https://${match.replace(/^www\./i, 'www.')}`;
}

function cleanField(value) {
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

function extractMajor(text) {
  const explicit =
    text.match(/(?:major|field of study|concentration)\s*[:\-]\s*([^\n]+)/i)?.[1] ??
    text.match(/\b(?:Master(?:'s)?(?:\s+of\s+(?:Science|Arts|Business Administration))?|M\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*B\.?\s*A\.?|Doctor\s+of\s+Philosophy|Ph\.?\s*D\.?|PhD\s+Candidate)\s+(?:Candidate\s+)?(?:in|,)\s*([^\n,;]+)/i)?.[1] ??
    text.match(/\b(?:B\.?\s*S\.?|Bachelor(?:'s)?(?:\s+of\s+(?:Science|Arts|Business Administration))?)\s*,\s*([^\n,;]+)/i)?.[1] ??
    text.match(/\b(?:B\.?\s*S\.?|Bachelor(?:'s)?(?:\s+of\s+(?:Science|Arts|Business Administration))?)\s+(?:in\s+)?([^\n]+)/i)?.[1] ??
    null;

  if (!explicit) {
    return null;
  }

  const cleaned = cleanField(explicit);
  const business = cleaned.match(/\b(?:business administration|business analytics|business|finance|accounting|marketing|economics|information systems)\b/i)?.[0];
  if (business) {
    return toTitleCase(business);
  }

  const withoutAdditional = cleaned
    .replace(/\b(?:additional|second|minor|concentration|track)\b.*$/i, '')
    .trim();
  return withoutAdditional || cleaned;
}

function extractAcademicYear(text) {
  const currentEducation = getCurrentEducationInfo(text);
  if (currentEducation?.level === 'PhD') {
    return 'PhD';
  }
  if (currentEducation?.level === "Master's") {
    return "Master's";
  }
  if (currentEducation?.level === 'Bachelor' && Number.isFinite(currentEducation.year)) {
    return getUndergradYearFromGraduationYear(currentEducation.year);
  }

  const explicit = text.match(/\b(Freshman|Sophomore|Junior|Senior)\b/i)?.[1];
  if (explicit) {
    const normalized = `${explicit[0].toUpperCase()}${explicit.slice(1).toLowerCase()}`;
    return VALID_ACADEMIC_YEARS.includes(normalized) ? normalized : null;
  }

  let yearMatch =
    text.match(/(?:Class of|Expected(?:\s+Graduation)?|Graduation(?:\s+Year)?|Grad(?:uation)?(?:\s+Date)?)\s*[:\-]?\s*(20\d{2})/i) ??
    text.match(/\b(?:Bachelor|B\.?\s*S\.?|B\.?\s*A\.?)[^\n]*(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(20\d{2})/i);

  if (!yearMatch) {
    const currentYear = new Date().getFullYear();
    const futureYears = Array.from(
      text.matchAll(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+(20\d{2})\b/gi),
      (match) => Number(match[1])
    ).filter((year) => Number.isFinite(year) && year > currentYear);
    const inferredYear = futureYears.length > 0 ? Math.min(...futureYears) : null;
    yearMatch = inferredYear ? [String(inferredYear), String(inferredYear)] : null;
  }
  if (!yearMatch) {
    return null;
  }

  const gradYear = Number(yearMatch[1]);
  if (!Number.isFinite(gradYear)) {
    return null;
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const diff = gradYear - currentYear;

  if (diff <= 1) return 'Senior';
  if (diff === 2) return 'Junior';
  if (diff === 3) return 'Sophomore';
  return 'Freshman';
}

function extractDegree(text) {
  const match = text.match(/\b(Bachelor(?:\s+of\s+(?:Science|Arts|Business Administration))?|B\.?\s*S\.?|B\.?\s*A\.?|Master(?:\s+of\s+(?:Science|Arts|Business Administration))?|M\.?\s*S\.?|M\.?\s*A\.?|M\.?\s*B\.?\s*A\.?|Doctor\s+of\s+Philosophy|Ph\.?\s*D\.?|Doctorate)\b/i)?.[0] ?? null;
  if (!match) {
    return null;
  }

  const normalized = match.replace(/\s+/g, ' ').replace(/\./g, '').trim().toLowerCase();
  if (normalized === 'bs') return 'Bachelor of Science';
  if (normalized === 'ba') return 'Bachelor of Arts';
  if (normalized === 'ms') return 'Master of Science';
  if (normalized === 'ma') return 'Master of Arts';
  if (normalized === 'mba') return 'Master of Business Administration';
  if (normalized === 'doctor of philosophy') return 'PhD';
  if (normalized === 'phd') return 'PhD';
  return cleanField(match);
}

function extractSkills(text) {
  const dictionary = [
    'python', 'java', 'javascript', 'typescript', 'c++', 'c', 'sql', 'react', 'node', 'mongodb', 'postgresql',
    'pytorch', 'tensorflow', 'machine learning', 'data analysis', 'nlp', 'computer vision', 'git', 'linux',
    'docker', 'aws', 'kubernetes', 'html', 'css', 'figma', 'pandas', 'numpy', 'statistics',
    'tableau', 'databricks', 'excel', 'power bi', 'salesforce', 'financial modeling', 'market research',
    'business analytics', 'data visualization', 'project management', 'leadership', 'communication',
    'public speaking', 'research writing', 'technical communication',
  ];

  const normalized = text.toLowerCase();
  const skills = dictionary.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  });

  return skills.length > 0 ? skills.map((skill) => skill.trim()).join(', ') : null;
}

function splitSkills(value) {
  if (Array.isArray(value)) {
    return value.filter((skill) => typeof skill === 'string');
  }

  if (typeof value === 'string') {
    return value.split(/[,;\n]/);
  }

  return [];
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appearsInText(value, text) {
  const cleaned = cleanField(value);
  if (!cleaned) {
    return false;
  }

  return new RegExp(`\\b${escapeRegExp(cleaned)}\\b`, 'i').test(text);
}

function normalizeSkillList(...skillSources) {
  const seen = new Set();
  const skills = [];

  for (const source of skillSources) {
    for (const rawSkill of splitSkills(source)) {
      const skill = cleanField(rawSkill);
      const key = skill.toLowerCase();
      if (!skill || seen.has(key)) {
        continue;
      }

      seen.add(key);
      skills.push(skill);
    }
  }

  return skills.length > 0 ? skills.join(', ') : null;
}

function extractSummary(text) {
  const cleaned = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  return cleaned ? cleaned.slice(0, 240) : null;
}

function normalizeParsedResume(parsed, resumeText) {
  const parsedAcademicYear = coerceText(parsed?.academic_year);
  const normalizedAcademicYear = parsedAcademicYear
    ? VALID_ACADEMIC_YEARS.find((item) => item.toLowerCase() === parsedAcademicYear.toLowerCase()) ?? null
    : null;
  const parsedGithub = coerceText(parsed?.github);
  const parsedLinkedIn = coerceText(parsed?.linkedin);
  const parsedMajor = coerceText(parsed?.major);
  const parsedDegree = coerceText(parsed?.degree);
  const parsedSkills = splitSkills(parsed?.skills).filter((skill) => appearsInText(skill, resumeText));

  return {
    full_name: extractName(resumeText) ?? coerceText(parsed?.full_name),
    email: extractEmail(resumeText) ?? coerceText(parsed?.email),
    linkedin: extractLinkedIn(resumeText) ?? (parsedLinkedIn?.includes('linkedin.com') && appearsInText(parsedLinkedIn, resumeText) ? parsedLinkedIn : null),
    github: extractGithubOrPortfolio(resumeText) ?? (parsedGithub?.includes('github.com') && appearsInText(parsedGithub, resumeText) ? parsedGithub : null),
    major: extractMajor(resumeText) ?? (parsedMajor && appearsInText(parsedMajor, resumeText) ? parsedMajor : null),
    academic_year: extractAcademicYear(resumeText) ?? (normalizedAcademicYear && appearsInText(normalizedAcademicYear, resumeText) ? normalizedAcademicYear : null),
    skills: normalizeSkillList(parsedSkills, extractSkills(resumeText)),
    degree: extractDegree(resumeText) ?? (parsedDegree && appearsInText(parsedDegree, resumeText) ? parsedDegree : null),
  };
}

async function parseResumeBuffer(file) {
  if (!file) {
    throw new Error('resume file is required');
  }

  let resumeText = '';

  if (file.mimetype === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    resumeText = String(parsed?.text ?? '');
  } else if (file.mimetype === 'text/plain') {
    resumeText = file.buffer.toString('utf-8');
  } else {
    throw new Error('resume must be a PDF or plain text file');
  }

  const promptText = `You are a resume parser. Return ONLY a raw JSON object.
No markdown. No code fences. No explanation.
Start with { and end with }. One object, nothing else.

Rules:
- Copy facts only when the resume text explicitly supports them. Do not infer from projects, coursework, job titles, or skills.
- full_name: the person's full name as written at the top of the resume
- email: email address only
- linkedin: LinkedIn URL only - must contain "linkedin.com". Do NOT mix with GitHub.
- github: GitHub URL only - must contain "github.com". Do NOT mix with LinkedIn.
- major: declared primary field of study only. If the education line says "B.S. in Business, Additional Major in CS/AI", major must be "Business".
- academic_year: exactly one of Freshman Sophomore Junior Senior Master's PhD. If the most recent in-progress education is PhD/Doctor of Philosophy/PhD Candidate, return "PhD". If it is MS/MA/MBA/Master of..., return "Master's". If it is BS/BA/Bachelor of..., infer Freshman/Sophomore/Junior/Senior from expected graduation year.
- skills: comma-separated skills that appear in the resume text. Include business/data skills such as Tableau, Databricks, Excel, Power BI, financial modeling, market research, leadership, communication when present.
- degree: e.g. Bachelor of Science, Master of Science, PhD - or null

Return exactly this shape with null for any field not found:
{
  "full_name": "...",
  "email": "...",
  "linkedin": "...",
  "github": "...",
  "major": "...",
  "academic_year": "...",
  "skills": "...",
  "degree": "..."
}

Resume text:
${resumeText.slice(0, 12000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let ollamaRes;
  try {
    console.log('File mimetype:', file?.mimetype);
    console.log('File size (bytes):', file?.buffer?.length);
    console.log('Resume text preview:', resumeText.slice(0, 300));
    ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        prompt: promptText,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Ollama timed out after 120 seconds. Try a smaller model like llama3.2:1b.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const ollamaJson = await ollamaRes.json();
  const raw = ollamaJson.response;

  if (!raw || typeof raw !== 'string') {
    console.error('[parse-resume] No response field. Full ollamaJson:', JSON.stringify(ollamaJson));
    const error = new Error('Ollama returned no response field');
    error.ollamaJson = ollamaJson;
    throw error;
  }

  console.log('[parse-resume] Raw Ollama output:', raw.slice(0, 300));

  // Strip ALL variations of markdown fences
  const stripped = raw
    .replace(/^`{1,3}(json)?[\s]*/gim, '')
    .replace(/`{1,3}\s*$/gim, '')
    .trim();

  // Extract JSON object
  const match = stripped.match(/\{[\s\S]*\}/);
  const jsonCandidate = match?.[0] ?? (stripped.startsWith('{') ? `${stripped}\n}` : null);

  let parsed;
  if (!jsonCandidate) {
    console.warn('[parse-resume] No JSON found. Falling back to deterministic extraction.');
    parsed = {};
  } else {
    try {
      parsed = JSON.parse(jsonCandidate);
    } catch (e) {
      // Try fixing common JSON mistakes
      const fixed = jsonCandidate
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']')
        .replace(/:\s*undefined/g, ': null')
        .replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      try {
        parsed = JSON.parse(fixed);
      } catch (e2) {
        console.warn('[parse-resume] JSON parse failed. Falling back to deterministic extraction:', e2.message);
        parsed = {};
      }
    }
  }

  const normalized = normalizeParsedResume(parsed, resumeText);
  console.log('[parse-resume] Successfully parsed fields:', Object.keys(normalized));
  return normalized;
}

profileRouter.post('/resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

    const token = req.cookies?.cmu_session;
    const sessionUserId = token ? getSessionUserId(token) : null;
    if (!sessionUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const store = readStore();
    const user = store.users.find((entry) => entry.id === sessionUserId && entry.role === 'student');
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let profile = store.studentProfiles.find((entry) => entry.userId === user.id) ?? null;
    if (!profile) {
      profile = {
        id: randomId('sp'),
        userId: user.id,
        name: user.name ?? '',
        major: '',
        graduationYear: '',
        skills: [],
        interests: [],
        resume: null,
      };
      store.studentProfiles.push(profile);
    }

    const uploadedAt = new Date().toISOString();
    profile.resumeFileName = req.file.originalname;
    profile.resumeUploadedAt = uploadedAt;
    profile.resumeData = req.file.buffer.toString('base64');
    try {
      if (req.file.mimetype === 'application/pdf') {
        const parsed = await pdfParse(req.file.buffer);
        profile.resumeText = String(parsed?.text ?? '').slice(0, 12000);
      } else if (req.file.mimetype === 'text/plain') {
        profile.resumeText = req.file.buffer.toString('utf-8').slice(0, 12000);
      }
    } catch (error) {
      console.warn('[resume upload] Could not extract resume text for recommendations:', error instanceof Error ? error.message : String(error));
    }
    profile.resume = {
      name: req.file.originalname,
      uploadDate: uploadedAt,
    };

    writeStore(store);
    return res.json({ success: true, fileName: req.file.originalname });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

profileRouter.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

    const result = await parseResumeBuffer(req.file);
    return res.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Ollama timed out after 120 seconds')) {
      return res.status(504).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      raw: error?.raw,
      ollamaJson: error?.ollamaJson,
    });
  }
});

export { OLLAMA_MODEL, profileRouter };
