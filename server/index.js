import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { readStore, writeStore, randomId } from './store.js';
import { getOllamaRecommendations, parseResumeWithOllama, scoreOnePosting } from './ollama.js';
import { fetchGitHubData } from './utils/fetchGitHubData.js';
import { fetchLinkedInData } from './utils/fetchLinkedInData.js';
import { profileRouter } from './profile.js';
import { validateCmuEmail } from './sso.js';
import { deleteSession, getSessionUserId, pruneExpiredSessions, refreshSession, setSession } from './sessionStore.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const recommendationCache = new Map();
const externalDataCache = new Map();
const pendingRecommendationJobs = new Set();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  })
);
// Resume uploads are sent as base64 JSON payloads, so use a larger limit than Express default.
app.use(express.json({ limit: '12mb' }));
app.use(cookieParser());
app.use('/api/profile', profileRouter);

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
      Array.isArray(profile.interests) &&
      profile.interests.length > 0;

    return {
      completed,
      profile,
      steps: {
        basic: !!profile?.name?.trim() && !!profile?.major?.trim() && !!profile?.graduationYear?.trim(),
        resume: !!profile?.resume?.name,
        interests: Array.isArray(profile?.interests) && profile.interests.length > 0,
      },
    };
  }

  const profile = store.professorProfiles.find((p) => p.userId === user.id) ?? null;
  const completed =
    !!profile &&
    !!user.name?.trim() &&
    !!profile.department?.trim() &&
    !!profile.title?.trim() &&
    !!profile.contactEmail?.trim();

  return {
    completed,
    profile,
    steps: {
      basic: !!user?.name?.trim() && !!profile?.department?.trim() && !!profile?.title?.trim(),
      contact: !!profile?.contactEmail?.trim(),
    },
  };
}

function authRequired(req, res, next) {
  const token = req.cookies.cmu_session;
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentSessionUserId = getSessionUserId(token);
  if (!currentSessionUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sessionUserId = refreshSession(token, Date.now() + SESSION_MAX_AGE_MS);
  if (!sessionUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  res.cookie('cmu_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_MAX_AGE_MS,
  });

  const store = readStore();
  const user = store.users.find((entry) => entry.id === sessionUserId) ?? null;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = user;
  req.sessionUserId = sessionUserId;
  return next();
}

function getStudentProfile(store, studentId) {
  return store.studentProfiles.find((profile) => profile.userId === studentId) ?? null;
}

function getPostingById(store, postingId) {
  return (Array.isArray(store.postings) ? store.postings : []).find((posting) => String(posting?.id) === String(postingId)) ?? null;
}

function getRecommendationProfileFingerprint(profile) {
  return JSON.stringify({
    major: profile?.major ?? '',
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    interests: Array.isArray(profile?.interests) ? profile.interests : [],
    summary: profile?.summary ?? '',
    university: profile?.university ?? '',
    degree: profile?.degree ?? '',
    github: profile?.github ?? profile?.githubUrl ?? '',
    linkedin: profile?.linkedin ?? profile?.linkedInUrl ?? '',
    resumeText: profile?.resumeText ?? '',
  });
}

function getCacheKey(studentId, postingId, profile) {
  return JSON.stringify({
    studentId,
    postingId,
    profile: getRecommendationProfileFingerprint(profile),
  });
}

function getCached(cacheKey) {
  return recommendationCache.get(cacheKey) ?? null;
}

function setCached(cacheKey, value) {
  recommendationCache.set(cacheKey, value);
}

function getExternalCached(cacheKey) {
  return externalDataCache.get(cacheKey) ?? null;
}

function setExternalCached(cacheKey, value) {
  externalDataCache.set(cacheKey, value);
}

function normalizePostingPayload(posting) {
  if (!posting || typeof posting !== 'object') {
    return null;
  }

  const id = String(posting.id ?? '').trim();
  if (!id) {
    return null;
  }

  return {
    ...posting,
    id,
  };
}

async function resolveExternalStudentData(student) {
  const studentId = String(student?.id ?? '');
  const githubUrl = String(student?.github ?? student?.githubUrl ?? '').trim();
  const linkedinUrl = String(student?.linkedin ?? student?.linkedInUrl ?? '').trim();

  const githubCacheKey = `github:${studentId}`;
  const linkedinCacheKey = `linkedin:${studentId}`;

  const cachedGithub = getExternalCached(githubCacheKey);
  const cachedLinkedIn = getExternalCached(linkedinCacheKey);

  const githubData = cachedGithub ?? (githubUrl ? await fetchGitHubData(githubUrl) : null);
  const linkedinData = cachedLinkedIn ?? (linkedinUrl ? await fetchLinkedInData(linkedinUrl) : null);

  if (githubData && !cachedGithub) {
    setExternalCached(githubCacheKey, githubData);
  }

  if (linkedinData && !cachedLinkedIn) {
    setExternalCached(linkedinCacheKey, linkedinData);
  }

  return { githubData, linkedinData };
}

async function scorePostingInBackground({ cacheKey, posting, profile, studentId }) {
  if (pendingRecommendationJobs.has(cacheKey)) {
    return;
  }

  pendingRecommendationJobs.add(cacheKey);

  setImmediate(async () => {
    try {
      const { githubData, linkedinData } = await resolveExternalStudentData({
        ...profile,
        id: studentId,
      });

      const scoringResult = await scoreOnePosting({
        posting,
        index: 0,
        resumeSignal: profile?.resumeText ?? profile?.summary ?? '',
        githubData,
        linkedinData,
      });

      if (scoringResult) {
        setCached(cacheKey, scoringResult);
        console.log('[bg score complete]', posting.id, 'confidence:', scoringResult.confidence);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown background scoring error.';
      console.error('[bg score error]', posting?.id, message);
    } finally {
      pendingRecommendationJobs.delete(cacheKey);
    }
  });
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

function normalizeInterestKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

function getRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
        linkedInUrl: '',
        githubUrl: '',
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
        bioUrl: '',
        researchAreas: '',
        professorWebsite: '',
        publicationsLink: '',
        researchInterests: '',
        photoBase64: '',
      });
    }

    writeStore(store);
  }

  const token = randomId('sess');
  setSession(token, user.id, Date.now() + SESSION_MAX_AGE_MS);
  res.cookie('cmu_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: SESSION_MAX_AGE_MS,
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
  deleteSession(token);
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
  profile.phone = typeof next.phone === 'string' ? next.phone : profile.phone;
  profile.location = typeof next.location === 'string' ? next.location : profile.location;
  profile.linkedin = typeof next.linkedin === 'string' ? next.linkedin : profile.linkedin;
  profile.github = typeof next.github === 'string' ? next.github : profile.github;
  profile.photoBase64 = typeof next.photoBase64 === 'string' ? next.photoBase64 : profile.photoBase64;
  profile.major = typeof next.major === 'string' ? next.major : profile.major;
  profile.university = typeof next.university === 'string' ? next.university : profile.university;
  profile.degree = typeof next.degree === 'string' ? next.degree : profile.degree;
  profile.gpa = typeof next.gpa === 'string' ? next.gpa : profile.gpa;
  profile.graduationDate = typeof next.graduationDate === 'string' ? next.graduationDate : profile.graduationDate;
  profile.graduationType = typeof next.graduationType === 'string' ? next.graduationType : profile.graduationType;
  profile.jobTitle = typeof next.jobTitle === 'string' ? next.jobTitle : profile.jobTitle;
  profile.employer = typeof next.employer === 'string' ? next.employer : profile.employer;
  profile.yearsOfExperience = typeof next.yearsOfExperience === 'string' ? next.yearsOfExperience : profile.yearsOfExperience;
  profile.workAuthorization = typeof next.workAuthorization === 'string' ? next.workAuthorization : profile.workAuthorization;
  profile.summary = typeof next.summary === 'string' ? next.summary : profile.summary;
  profile.graduationYear = typeof next.graduationYear === 'string' ? next.graduationYear : profile.graduationYear;
  profile.linkedInUrl = typeof next.linkedInUrl === 'string' ? next.linkedInUrl : profile.linkedInUrl;
  profile.githubUrl = typeof next.githubUrl === 'string' ? next.githubUrl : profile.githubUrl;
  if (Object.prototype.hasOwnProperty.call(next, 'resume')) {
    profile.resume = next.resume;
  }
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
  if (typeof next.name === 'string' && next.name.trim()) {
    user.name = next.name.trim();
  }
  profile.department = typeof next.department === 'string' ? next.department : profile.department;
  profile.title = typeof next.title === 'string' ? next.title : profile.title;
  profile.contactEmail = typeof next.contactEmail === 'string' ? next.contactEmail : profile.contactEmail;
  profile.officeHours =
    typeof next.officeHours === 'string'
      ? next.officeHours
      : typeof next.office === 'string'
        ? next.office
        : profile.officeHours;
  profile.bioUrl = typeof next.bioUrl === 'string' ? next.bioUrl : profile.bioUrl;
  profile.researchAreas = typeof next.researchAreas === 'string' ? next.researchAreas : profile.researchAreas;
  profile.professorWebsite =
    typeof next.professorWebsite === 'string'
      ? next.professorWebsite
      : typeof next.labWebsite === 'string'
        ? next.labWebsite
        : profile.professorWebsite;
  profile.publicationsLink =
    typeof next.publicationsLink === 'string'
      ? next.publicationsLink
      : typeof next.recruitingStatus === 'string'
        ? next.recruitingStatus
        : profile.publicationsLink;
  profile.researchInterests =
    typeof next.researchInterests === 'string' ? next.researchInterests : profile.researchInterests;
  profile.photoBase64 = typeof next.photoBase64 === 'string' ? next.photoBase64 : profile.photoBase64;

  writeStore(store);
  return res.json({ setup: getSetupState(store, user) });
});

app.get('/api/postings', authRequired, (req, res) => {
  const store = readStore();
  return res.json({ postings: Array.isArray(store.postings) ? store.postings : [] });
});

app.post('/api/postings/sync', authRequired, (req, res) => {
  const { postings } = req.body ?? {};
  if (!Array.isArray(postings)) {
    return res.status(400).json({ error: 'postings must be an array.' });
  }

  const store = readStore();
  store.postings = postings.map(normalizePostingPayload).filter(Boolean);
  writeStore(store);
  return res.json({ ok: true, count: store.postings.length });
});

app.get('/api/insights/student-interest-counts', authRequired, (req, res) => {
  const store = readStore();
  const user = store.users.find((u) => u.id === req.sessionUserId);
  if (!user || user.role !== 'professor') {
    return res.status(403).json({ error: 'Professor role required.' });
  }

  const counts = {};

  for (const profile of store.studentProfiles) {
    const uniqueInterests = new Set(
      (Array.isArray(profile.interests) ? profile.interests : [])
        .filter((interest) => typeof interest === 'string')
        .map((interest) => normalizeInterestKey(interest))
        .filter(Boolean)
    );

    for (const interest of uniqueInterests) {
      counts[interest] = (counts[interest] ?? 0) + 1;
    }
  }

  return res.json({
    counts,
    totalStudents: store.studentProfiles.length,
  });
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
    const result = await parseResumeWithOllama({
      resumeBase64,
      fileName: typeof fileName === 'string' ? fileName : 'resume.pdf',
      mode: mode === 'skills' ? 'skills' : 'autofill',
    });

    return res.json({ result, source: 'ollama' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resume parsing failed.';
    // eslint-disable-next-line no-console
    console.error('Resume parsing failed:', error);
    return res.json({
      result: mode === 'skills' ? [] : {},
      source: 'fallback',
      warning: message,
    });
  }
});

app.get('/api/ai/recommendations/score-one', authRequired, async (req, res) => {
  const { postingId } = req.query ?? {};
  const student = req.user;
  const studentId = String(student?.id ?? student?._id?.toString?.() ?? '').trim();

  if (!student || student.role !== 'student') {
    return res.status(403).json({ error: 'Student role required.' });
  }

  if (!postingId || typeof postingId !== 'string') {
    return res.status(400).json({ error: 'postingId is required.' });
  }

  const store = readStore();
  const profile = getStudentProfile(store, studentId);
  if (!profile) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const posting = getPostingById(store, postingId);
  if (!posting) {
    return res.status(404).json({ error: 'Posting not found.' });
  }

  const cacheKey = getCacheKey(studentId, postingId, profile);
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ status: 'ready', postingId, result: cached });
  }

  scorePostingInBackground({ cacheKey, posting, profile, studentId });

  return res.json({ status: 'scoring', postingId });
});

app.get('/api/ai/recommendations/get-score', authRequired, (req, res) => {
  const { postingId } = req.query ?? {};
  const student = req.user;
  const studentId = String(student?.id ?? student?._id?.toString?.() ?? '').trim();

  if (!student || student.role !== 'student') {
    return res.status(403).json({ error: 'Student role required.' });
  }

  if (!postingId || typeof postingId !== 'string') {
    return res.status(400).json({ error: 'postingId is required.' });
  }

  const store = readStore();
  const profile = getStudentProfile(store, studentId);
  if (!profile) {
    return res.status(404).json({ error: 'Student profile not found.' });
  }

  const cacheKey = getCacheKey(studentId, postingId, profile);
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ status: 'ready', result: cached });
  }

  return res.json({ status: 'pending' });
});

// AI Recommendations endpoint (Ollama)
app.post('/api/ai/recommendations', authRequired, async (req, res) => {
  const requestId = getRequestId();
  try {
    const { profile, postings } = req.body ?? {};
    const contentLength = req.headers['content-length'] ?? 'unknown';
    // eslint-disable-next-line no-console
    console.log(`[ai/recommendations:${requestId}] content-length=${contentLength}`);

    if (!profile || !Array.isArray(postings)) {
      return res.status(400).json({
        error: 'profile and postings are required',
        requestId,
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ai/recommendations:${requestId}] postings=${postings.length} skills=${Array.isArray(profile?.skills) ? profile.skills.length : 0} interests=${Array.isArray(profile?.interests) ? profile.interests.length : 0}`
    );

    const githubUrl = (profile?.github || profile?.githubUrl || '').toString().trim() || null;
    const linkedinUrl = (profile?.linkedin || profile?.linkedInUrl || '').toString().trim() || null;
    const resumeText = (profile?.resumeText || '').toString();

    const student = {
      ...profile,
      github: githubUrl,
      githubUrl: githubUrl,
      linkedin: linkedinUrl,
      linkedInUrl: linkedinUrl,
      resumeText,
    };

    const recommendations = await getOllamaRecommendations({
      student,
      postings,
      resumeText,
    });
    return res.json({ recommendations, requestId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[ai/recommendations:${requestId}] error:`, error);
    const message = error instanceof Error ? error.message : 'Recommendation request failed.';
    return res.status(500).json({
      error: message,
      requestId,
    });
  }
});

app.use((err, req, res, next) => {
  if (!err) {
    return next();
  }

  const requestId = getRequestId();
  // eslint-disable-next-line no-console
  console.error(`[api-error:${requestId}] ${req.method} ${req.originalUrl}`, err);

  if (res.headersSent) {
    return next(err);
  }

  const status =
    typeof err.status === 'number'
      ? err.status
      : typeof err.statusCode === 'number'
        ? err.statusCode
        : 500;

  return res.status(status).json({
    error: err.message || 'Internal server error',
    requestId,
  });
});

app.listen(port, () => {
  pruneExpiredSessions();
  // eslint-disable-next-line no-console
  console.log(`CMU Research Match server listening on http://localhost:${port}`);
});
