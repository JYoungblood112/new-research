import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import { randomId, readStore, writeStore } from './store.js';
import { getSessionUserId } from './sessionStore.js';

const OLLAMA_MODEL = 'llama3.2:1b';

const upload = multer({ storage: multer.memoryStorage() });

const profileRouter = express.Router();
const VALID_ACADEMIC_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', "Master's", 'PhD'];
const TRANSCRIPT_COURSE_STOP_WORDS = new Set([
  'course',
  'courses',
  'title',
  'grade',
  'credits',
  'credit',
  'term',
  'semester',
  'transcript',
  'institution',
  'student',
  'attempted',
  'earned',
  'quality',
  'points',
  'gpa',
]);
const TRANSCRIPT_TITLE_REPLACEMENTS = [
  [/\bDIFFERENTIAL INT CAL\b/gi, 'Differential and Integral Calculus'],
  [/\bINTEGRTN & APPROX\b/gi, 'Integration and Approximation'],
  [/\bINTRO TO\b/gi, 'Introduction to'],
  [/\bPRINCPLS OF COMPUTNG\b/gi, 'Principles of Computing'],
  [/\bPRINCPLES OF MICROEC\b/gi, 'Principles of Microeconomics'],
  [/\bPRINCPLES OF MACROEC\b/gi, 'Principles of Macroeconomics'],
  [/\bMATRC & LINR TRNSF\b/gi, 'Matrices and Linear Transformations'],
  [/\bBUSINESS SCI\b/gi, 'Business Science'],
  [/\bFNDMTLS OF PGMG & CS\b/gi, 'Fundamentals of Programming and Computer Science'],
  [/\bCONCEPTS OF MATHMTCS\b/gi, 'Concepts of Mathematics'],
  [/\bDIFFRENTL EQUATIONS\b/gi, 'Differential Equations'],
  [/\bDEV BLOCKCHAIN CASE\b/gi, 'Developing Blockchain Use Cases'],
  [/\bREASONING DATA\b/gi, 'Reasoning with Data'],
  [/\bPROB & STAT INF\b/gi, 'Probability and Statistical Inference'],
  [/\bCONTRACT LAW & STRAT\b/gi, 'Contract Law and Strategy'],
  [/\bBUSINESS COMMUNCTNS\b/gi, 'Business Communications'],
  [/\bINTERPRETN & ARGMNT\b/gi, 'Interpretation and Argument'],
  [/\bBUS SOCIETY & ETHICS\b/gi, 'Business Society and Ethics'],
  [/\bINDIAN YOGA & MEDIT\b/gi, 'Indian Yoga and Meditation'],
  [/\bINTRO\. DEEP LRNG\./gi, 'Introduction to Deep Learning'],
  [/\bPRIN IMPRTV COMPTATN\b/gi, 'Principles of Imperative Computation'],
  [/\bINTR CMPTR SYSTEMS\b/gi, 'Introduction to Computer Systems'],
  [/\bNATURAL LANGUAGE PR\b/gi, 'Natural Language Processing'],
  [/\bORGNZTN BEHAVIOR\b/gi, 'Organizational Behavior'],
  [/\bBUSINESS PRSNTATIONS\b/gi, 'Business Presentations'],
  [/\bMGMT\b/gi, 'Management'],
  [/\bTRNSF\b/gi, 'Transformations'],
  [/\bCMPTR\b/gi, 'Computer'],
  [/\bPGMG\b/gi, 'Programming'],
  [/\bMATHMTCS\b/gi, 'Mathematics'],
  [/\bCOMMUNCTNS\b/gi, 'Communications'],
  [/\bPRSNTATIONS\b/gi, 'Presentations'],
  [/\bORGNZTN\b/gi, 'Organizational'],
  [/\bIMPRTV\b/gi, 'Imperative'],
  [/\bCOMPTATN\b/gi, 'Computation'],
  [/\bLRNG\b/gi, 'Learning'],
  [/\bINF\b/gi, 'Inference'],
];

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

function normalizeCourseName(value) {
  let cleaned = String(value ?? '')
    .replace(/\b(?:A\+?|A-|B\+?|B-|C\+?|C-|D\+?|D-|F|P|S|U|W|I)\b\s*$/i, '')
    .replace(/\b(?:\d+(?:\.\d+)?\s*)?(?:credits?|units?)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .trim();

  for (const [pattern, replacement] of TRANSCRIPT_TITLE_REPLACEMENTS) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  return cleaned
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-\s]+|[,;:\-\s]+$/g, '')
    .replace(/\b\w+\b/g, (word) => {
      if (/^(?:AI|ML|CS|CMU|BLE|I|II|III|IV|V)$/.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (['and', 'of', 'to', 'with', 'in', 'for'].includes(lower)) {
        return lower;
      }
      return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .trim();
}

function normalizeCourseNumber(value) {
  const match = String(value ?? '').match(/\b\d{5}\b|\b[A-Z]{2,6}\s*[- ]?\d{2,4}[A-Z]?\b/i);
  return match ? match[0].replace(/\s+/g, '').toUpperCase() : '';
}

function looksLikeCourseName(value) {
  const cleaned = normalizeCourseName(value);
  if (cleaned.length < 4 || cleaned.length > 90) {
    return false;
  }

  const normalized = cleaned.toLowerCase();
  if (TRANSCRIPT_COURSE_STOP_WORDS.has(normalized)) {
    return false;
  }

  return /[a-z]/i.test(cleaned) && !/^\d+$/.test(cleaned);
}

function getTranscriptSemesterBlocks(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const blocks = [];
  let current = { semester: 'Transfer / AP Credit', lines: [] };
  const semesterHeaderPattern = /^(?:(?:Fall|Spring|Summer)(?:\s+\d+|(?:\s+\d+)?\/All\s+\d+)|Advanced Placement \/ Transfer Credits)\b/i;

  for (const line of lines) {
    if (semesterHeaderPattern.test(line)) {
      if (current.lines.length > 0) {
        blocks.push(current);
      }
      current = { semester: line, lines: [] };
      continue;
    }

    current.lines.push(line);
  }

  if (current.lines.length > 0) {
    blocks.push(current);
  }

  return blocks;
}

function extractCourseRowsFromTranscriptBlock(block) {
  const blockText = block.lines.join('\n');
  const rowPattern = /(^|\n)(\d{5})([A-Z][A-Z0-9@/&.,' -]{1,90}?)(?=\d{1,2}\.0{1,2}(?:TR|A\+?|A-|B\+?|B-|C\+?|C-|D\+?|D-|F|P|R|S|U|W|I|\d|\.|[A-Z]{2,4}\b))/g;
  const rows = [];
  let match;

  while ((match = rowPattern.exec(blockText)) !== null) {
    rows.push({
      semester: block.semester,
      courseNumber: match[2],
      courseName: match[3],
    });
  }

  return rows;
}

function extractTranscriptCoursesHeuristically(text) {
  const courses = [];
  const seen = new Set();

  const addCourse = (courseNumber, value, semester) => {
    const courseName = normalizeCourseName(value);
    const normalizedCourseNumber = normalizeCourseNumber(courseNumber);
    const key = `${normalizedCourseNumber}:${courseName.toLowerCase()}`;
    if (!looksLikeCourseName(courseName) || seen.has(key)) {
      return;
    }
    seen.add(key);
    courses.push({
      courseNumber: normalizedCourseNumber,
      courseName,
      semester,
    });
  };

  const semesterBlocks = getTranscriptSemesterBlocks(text);
  for (const block of semesterBlocks) {
    const rows = extractCourseRowsFromTranscriptBlock(block);
    for (const row of rows) {
      addCourse(row.courseNumber, row.courseName, row.semester);
    }
  }

  if (courses.length > 0) {
    return courses.slice(0, 80);
  }

  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^(?:total|semester|cumulative|final|grade|units|points|quality|advanced placement|transfer credit|carnegie mellon|jonathan youngblood|note\b|not intended|as required|family rights|information contained|third party|page \d+)/i.test(line)) {
      continue;
    }

    const catalogMatch = line.match(/\b([A-Z]{2,6}\s*[- ]?\d{2,4}[A-Z]?)\b\s+(.+)/);
    if (catalogMatch?.[1]) {
      addCourse(catalogMatch[1], catalogMatch[2]);
      continue;
    }

    const trailingCatalogMatch = line.match(/^(.+?)\s+\b([A-Z]{2,6}\s*[- ]?\d{2,4}[A-Z]?)\b/);
    if (trailingCatalogMatch?.[1]) {
      addCourse(trailingCatalogMatch[2], trailingCatalogMatch[1]);
    }
  }

  return courses.slice(0, 80);
}

async function extractTextFromUploadedAcademicFile(file, label) {
  if (!file) {
    throw new Error(`${label} file is required`);
  }

  if (file.mimetype === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    return String(parsed?.text ?? '');
  }

  if (file.mimetype === 'text/plain') {
    return file.buffer.toString('utf-8');
  }

  throw new Error(`${label} must be a PDF or plain text file`);
}

async function parseTranscriptBuffer(file) {
  const transcriptText = await extractTextFromUploadedAcademicFile(file, 'transcript');
  const heuristicCourses = extractTranscriptCoursesHeuristically(transcriptText);

  const promptText = `You are parsing a college transcript. Return ONLY a raw JSON array of course objects.
No markdown. No code fences. No explanation.

Rules:
- Include completed, in-progress, and transfer courses when the transcript text explicitly lists them.
- Return objects with "courseNumber" and "courseName".
- courseNumber should be the catalog number when present, such as "15112" or "15-112".
- courseName should not include grades, credits, GPA, semester headers, or catalog numbers.
- Do not invent courses.
- Keep names short and readable.

Shape:
[
  { "courseNumber": "15112", "courseName": "Fundamentals of Programming and Computer Science" }
]

Transcript text:
${transcriptText.slice(0, 12000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: 'json',
        prompt: promptText,
      }),
    });

    const ollamaJson = await ollamaRes.json();
    const raw = typeof ollamaJson?.response === 'string' ? ollamaJson.response : '';
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : JSON.parse(raw);
    const modelCourses = Array.isArray(parsed) ? parsed : [];
    const merged = [];
    const seen = new Set();

    const coursesToMerge = heuristicCourses.length > 0 ? heuristicCourses : modelCourses;

    for (const course of coursesToMerge) {
      const courseNumber = typeof course === 'object' && course
        ? normalizeCourseNumber(course.courseNumber)
        : normalizeCourseNumber(course);
      const courseName = typeof course === 'object' && course
        ? normalizeCourseName(course.courseName)
        : normalizeCourseName(course);
      const key = `${courseNumber}:${courseName.toLowerCase()}`;
      if (!looksLikeCourseName(courseName) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      merged.push({ courseNumber, courseName });
    }

    return {
      coursework: merged.slice(0, 40),
      transcriptText,
    };
  } catch (error) {
    console.warn('[parse-transcript] Falling back to deterministic extraction:', error instanceof Error ? error.message : String(error));
    return {
      coursework: heuristicCourses,
      transcriptText,
    };
  } finally {
    clearTimeout(timeout);
  }
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

  const promptText = `You extract structured facts from a resume. Return ONLY a raw JSON object.
No markdown. No code fences. No explanation. Start with { and end with }.

Rules:
- Copy facts only when the resume text explicitly supports them.
- Use null for unknown scalar fields and [] for skills when none are explicit.
- Do not infer skills or major from projects, coursework, job titles, or school reputation.
- full_name: person's full name as written near the top of the resume.
- email: email address only.
- linkedin: LinkedIn URL only. Must contain "linkedin.com". Do not mix with GitHub.
- github: GitHub URL only. Must contain "github.com". Do not mix with LinkedIn.
- major: declared primary field of study only. If the education line says "B.S. in Business, Additional Major in CS/AI", major must be "Business".
- academic_year: exactly one of Freshman, Sophomore, Junior, Senior, Master's, PhD.
- academic_year is based on the most recent in-progress degree. Use PhD for PhD/Doctor of Philosophy/PhD Candidate, Master's for MS/MA/MBA/Master of..., or infer Freshman/Sophomore/Junior/Senior from expected graduation year for BS/BA/Bachelor of...
- skills: array of explicit skills that appear in the resume text.
- degree: e.g. Bachelor of Science, Master of Science, PhD, or null.

Return exactly this shape:
{
  "full_name": null,
  "email": null,
  "linkedin": null,
  "github": null,
  "major": null,
  "academic_year": null,
  "skills": [],
  "degree": null
}

Resume text:
${resumeText.slice(0, 12000)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  let ollamaRes;
  try {
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
        transcript: null,
        coursework: [],
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

profileRouter.post('/transcript', upload.single('transcript'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'transcript file is required' });
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
        transcript: null,
        coursework: [],
      };
      store.studentProfiles.push(profile);
    }

    const parsed = await parseTranscriptBuffer(req.file);
    const uploadedAt = new Date().toISOString();
    profile.transcriptFileName = req.file.originalname;
    profile.transcriptUploadedAt = uploadedAt;
    profile.transcriptData = req.file.buffer.toString('base64');
    profile.transcriptText = parsed.transcriptText.slice(0, 12000);
    profile.coursework = parsed.coursework;
    profile.transcript = {
      name: req.file.originalname,
      uploadDate: uploadedAt,
    };

    writeStore(store);
    return res.json({
      success: true,
      transcript: profile.transcript,
      coursework: profile.coursework,
    });
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

export { OLLAMA_MODEL, extractTranscriptCoursesHeuristically, profileRouter };
