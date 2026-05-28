import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { readStore, writeStore, randomId } from './store.js';
import { validateCmuEmail } from './sso.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const sessions = new Map();
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5174',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

function getPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

function getSetupState(store, user) {
  if (user.role === 'student') {
    const profile = store.studentProfiles.find((p) => p.userId === user.id) ?? null;
    const completed =
      !!profile &&
      !!profile.name?.trim() &&
      !!profile.major?.trim() &&
      !!profile.graduationYear?.trim() &&
      !!profile.resume?.name &&
      Array.isArray(profile.skills) &&
      profile.skills.length > 0;

    return {
      completed,
      profile,
      steps: {
        basic: !!profile?.name?.trim() && !!profile?.major?.trim() && !!profile?.graduationYear?.trim(),
        resume: !!profile?.resume?.name,
        skills: Array.isArray(profile?.skills) && profile.skills.length > 0,
      },
    };
  }

  const profile = store.professorProfiles.find((p) => p.userId === user.id) ?? null;
  const completed =
    !!profile &&
    !!profile.department?.trim() &&
    !!profile.title?.trim() &&
    !!profile.contactEmail?.trim() &&
    !!profile.officeHours?.trim();

  return {
    completed,
    profile,
    steps: {
      basic: !!profile?.department?.trim() && !!profile?.title?.trim(),
      contact: !!profile?.contactEmail?.trim() && !!profile?.officeHours?.trim(),
    },
  };
}

function authRequired(req, res, next) {
  const token = req.cookies.cmu_session;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.sessionUserId = sessions.get(token);
  return next();
}

function getResumePrompt(mode) {
  if (mode === 'skills') {
    return "Extract a list of technical and soft skills from this resume as a JSON array of short strings (e.g. 'Python', 'data analysis', 'teamwork'). Return raw JSON array only.";
  }

  return 'Parse this resume and return a JSON object with these fields: fullName, email, major, academicYear (one of: Freshman, Sophomore, Junior, Senior, Graduate), skills (array of strings). Only include fields you are confident about. Return raw JSON only, no markdown.';
}

function stripJsonFences(text) {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    return [];
  }

  return skills
    .filter((skill) => typeof skill === 'string')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

async function callAnthropicResumeParser({ resumeBase64, fileName, mode }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: resumeBase64,
              },
              title: fileName || 'resume.pdf',
            },
            {
              type: 'text',
              text: getResumePrompt(mode),
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload?.error?.message || 'Resume parsing failed.');
  }

  const payload = await response.json();
  const text = payload?.content
    ?.filter((entry) => entry?.type === 'text')
    ?.map((entry) => entry.text)
    ?.join('\n')
    ?.trim();

  if (!text) {
    throw new Error('Resume parser returned an empty response.');
  }

  const parsed = JSON.parse(stripJsonFences(text));
  if (mode === 'skills') {
    return normalizeSkills(parsed);
  }

  return {
    fullName: typeof parsed?.fullName === 'string' ? parsed.fullName.trim() : undefined,
    email: typeof parsed?.email === 'string' ? parsed.email.trim() : undefined,
    major: typeof parsed?.major === 'string' ? parsed.major.trim() : undefined,
    academicYear: typeof parsed?.academicYear === 'string' ? parsed.academicYear.trim() : undefined,
    skills: normalizeSkills(parsed?.skills),
  };
}

app.get('/api/health', (_, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/stub-sso', (req, res) => {
  const { email, name, role } = req.body ?? {};

  if (!validateCmuEmail(email)) {
    return res.status(400).json({ error: 'Use an andrew.cmu.edu email address.' });
  }

  if (!['student', 'professor'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role.' });
  }

  const trimmedName = String(name ?? '').trim();
  if (!trimmedName) {
    return res.status(400).json({ error: 'Name is required.' });
  }

  const store = readStore();
  let user = store.users.find((u) => u.email.toLowerCase() === String(email).toLowerCase() && u.role === role);

  if (!user) {
    user = {
      id: randomId('u'),
      email: String(email).toLowerCase(),
      name: trimmedName,
      role,
      createdAt: new Date().toISOString(),
    };
    store.users.push(user);

    if (role === 'student') {
      store.studentProfiles.push({
        id: randomId('sp'),
        userId: user.id,
        name: trimmedName,
        major: '',
        graduationYear: '',
        skills: [],
        interests: [],
        resume: null,
      });
    }

    if (role === 'professor') {
      store.professorProfiles.push({
        id: randomId('pp'),
        userId: user.id,
        department: '',
        title: '',
        contactEmail: user.email,
        officeHours: '',
      });
    }

    writeStore(store);
  }

  const token = randomId('sess');
  sessions.set(token, user.id);
  res.cookie('cmu_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8,
  });

  const freshStore = readStore();
  const setup = getSetupState(freshStore, user);

  return res.json({ user: getPublicUser(user), setup });
});

app.get('/api/auth/session', authRequired, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.sessionUserId);
  if (!user) {
    return res.status(401).json({ error: 'Session expired.' });
  }

  const setup = getSetupState(store, user);
  return res.json({ user: getPublicUser(user), setup });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  const token = req.cookies.cmu_session;
  sessions.delete(token);
  res.clearCookie('cmu_session');
  res.json({ ok: true });
});

app.put('/api/setup/student', authRequired, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.sessionUserId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ error: 'Student role required.' });
  }

  const profile = store.studentProfiles.find((p) => p.userId === user.id);
  if (!profile) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const next = req.body ?? {};
  if (typeof next.email === 'string' && next.email.trim()) {
    user.email = next.email.trim();
  }
  profile.name = typeof next.name === 'string' ? next.name : profile.name;
  profile.photoBase64 = typeof next.photoBase64 === 'string' ? next.photoBase64 : profile.photoBase64;
  profile.major = typeof next.major === 'string' ? next.major : profile.major;
  profile.graduationYear = typeof next.graduationYear === 'string' ? next.graduationYear : profile.graduationYear;
  profile.resume = next.resume ?? profile.resume;
  profile.skills = Array.isArray(next.skills) ? next.skills : profile.skills;
  profile.interests = Array.isArray(next.interests) ? next.interests : profile.interests;

  writeStore(store);
  return res.json({ setup: getSetupState(store, user) });
});

app.put('/api/setup/professor', authRequired, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.sessionUserId);
  if (!user || user.role !== 'professor') {
    return res.status(403).json({ error: 'Professor role required.' });
  }

  const profile = store.professorProfiles.find((p) => p.userId === user.id);
  if (!profile) {
    return res.status(404).json({ error: 'Professor profile not found.' });
  }

  const next = req.body ?? {};
  profile.department = typeof next.department === 'string' ? next.department : profile.department;
  profile.title = typeof next.title === 'string' ? next.title : profile.title;
  profile.contactEmail = typeof next.contactEmail === 'string' ? next.contactEmail : profile.contactEmail;
  profile.officeHours = typeof next.officeHours === 'string' ? next.officeHours : profile.officeHours;

  writeStore(store);
  return res.json({ setup: getSetupState(store, user) });
});

app.post('/api/ai/parse-resume', authRequired, async (req, res) => {
  const { resumeBase64, fileName, mode } = req.body ?? {};

  if (typeof resumeBase64 !== 'string' || !resumeBase64.trim()) {
    return res.status(400).json({ error: 'resumeBase64 is required.' });
  }

  if (!['autofill', 'skills'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be autofill or skills.' });
  }

  try {
    const result = await callAnthropicResumeParser({
      resumeBase64: resumeBase64.replace(/^data:application\/pdf;base64,/, ''),
      fileName: typeof fileName === 'string' ? fileName : 'resume.pdf',
      mode: mode === 'skills' ? 'skills' : 'autofill',
    });

    return res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume parsing failed.';
    const status = message.includes('ANTHROPIC_API_KEY') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`CMU Research Match server listening on http://localhost:${port}`);
});
