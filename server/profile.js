import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse';

const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:1b';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/generate';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 30000);

const upload = multer({ storage: multer.memoryStorage() });

const profileRouter = express.Router();

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
  return text.match(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s)]+/i)?.[0] ?? null;
}

function extractGithubOrPortfolio(text) {
  return (
    text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s)]+/i)?.[0] ??
    text.match(/https?:\/\/[^\s)]+/i)?.[0] ??
    null
  );
}

function extractMajor(text) {
  return (
    text.match(/(?:major|field of study|concentration)\s*[:\-]\s*([^\n]+)/i)?.[1]?.trim() ??
    text.match(/(?:computer science|electrical engineering|mechanical engineering|data science|information systems|statistics|mathematics)/i)?.[0] ??
    null
  );
}

function extractSkills(text) {
  const dictionary = [
    'python', 'java', 'javascript', 'typescript', 'c++', 'c', 'sql', 'react', 'node', 'mongodb', 'postgresql',
    'pytorch', 'tensorflow', 'machine learning', 'data analysis', 'nlp', 'computer vision', 'git', 'linux',
    'docker', 'aws', 'kubernetes', 'html', 'css', 'figma', 'pandas', 'numpy', 'statistics',
  ];

  const normalized = text.toLowerCase();
  const skills = dictionary.filter((skill) => {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(normalized);
  });

  return skills.length > 0 ? skills.map((skill) => skill.trim()).join(', ') : null;
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
  return {
    full_name: coerceText(parsed?.full_name) ?? extractName(resumeText),
    email: coerceText(parsed?.email) ?? extractEmail(resumeText),
    linkedin: coerceText(parsed?.linkedin) ?? extractLinkedIn(resumeText),
    github_or_portfolio: coerceText(parsed?.github_or_portfolio) ?? extractGithubOrPortfolio(resumeText),
    major: coerceText(parsed?.major) ?? extractMajor(resumeText),
    skills:
      coerceText(parsed?.skills) ??
      (Array.isArray(parsed?.skills) ? parsed.skills.filter((skill) => typeof skill === 'string').map((skill) => skill.trim()).filter(Boolean).join(', ') || null : null) ??
      extractSkills(resumeText),
    professional_summary: coerceText(parsed?.professional_summary) ?? extractSummary(resumeText),
  };
}

function buildFallbackResumeFields(resumeText) {
  return normalizeParsedResume({}, resumeText);
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

  const promptText = `You are a resume parser. Return ONLY a raw JSON object. absolutely no markdown, no code fences, no backticks, no explanation. Only the JSON object itself, starting with { and ending with }.

Extract these fields exactly as named (use null if not found):
{
  "full_name": "...",
  "email": "...",
  "linkedin": "...",
  "github_or_portfolio": "...",
  "major": "...",
  "skills": "...",
  "professional_summary": "..."
}

Resume text:
${resumeText.slice(0, 3000)}`;

  const fallbackFields = buildFallbackResumeFields(resumeText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  let ollamaRes;
  try {
    console.log('File mimetype:', file?.mimetype);
    console.log('File size (bytes):', file?.buffer?.length);
    console.log('Resume text preview:', resumeText.slice(0, 300));
    ollamaRes = await fetch(OLLAMA_URL, {
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
      console.warn(`Ollama timed out after ${OLLAMA_TIMEOUT_MS}ms; using local resume parsing fallback.`);
      return fallbackFields;
    }
    console.warn('Ollama resume parsing unavailable; using local fallback:', error instanceof Error ? error.message : error);
    return fallbackFields;
  } finally {
    clearTimeout(timeout);
  }

  if (!ollamaRes.ok) {
    console.warn(`Ollama resume parsing failed with ${ollamaRes.status}; using local fallback.`);
    return fallbackFields;
  }

  let ollamaJson;
  try {
    ollamaJson = await ollamaRes.json();
  } catch (error) {
    console.warn('Failed to read Ollama resume response; using local fallback:', error instanceof Error ? error.message : error);
    return fallbackFields;
  }

  const raw = ollamaJson.response;
  if (!raw) {
    console.error('Ollama response field is undefined. Full object:', JSON.stringify(ollamaJson, null, 2));
    return fallbackFields;
  }

  const stripped = raw
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  const match = stripped.match(/\{[\s\S]*\}/);

  if (!match) {
    console.warn('No JSON found in Ollama output; using local resume parsing fallback.');
    return fallbackFields;
  }

  try {
    const parsed = JSON.parse(match[0]);
    return normalizeParsedResume(parsed, resumeText);
  } catch (error) {
    console.warn('Failed to parse Ollama resume JSON; using local fallback:', error instanceof Error ? error.message : error);
    return fallbackFields;
  }
}

profileRouter.post('/parse-resume', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'resume file is required' });
    }

    const result = await parseResumeBuffer(req.file);
    return res.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Ollama timed out after 30 seconds')) {
      return res.status(504).json({
        error: error.message,
      });
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
      raw: error?.raw,
    });
  }
});

export { OLLAMA_MODEL, profileRouter };