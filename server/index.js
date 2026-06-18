import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { lookup } from 'node:dns/promises';
import net from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { config as loadDotenv } from 'dotenv';
import WebSocket from 'ws';
import { readStore, writeStore, randomId } from './store.js';
import {
  getOllamaRecommendations,
  getDeanDepartmentResearchReport,
  getDeanInsights,
  getRecruiterCandidateMatches,
  getRecruiterCandidateSummary,
  getRecruiterOutreachMessage,
  parseResumeWithOllama,
  scoreOnePosting,
} from './ollama.js';
import { fetchGitHubData } from './utils/fetchGitHubData.js';
import { fetchLinkedInData } from './utils/fetchLinkedInData.js';
import { sendEmail } from './email.js';
import { profileRouter } from './profile.js';
import { validateCmuEmail } from './sso.js';
import { deleteSession, getSessionUserId, pruneExpiredSessions, refreshSession, setSession } from './sessionStore.js';

loadDotenv({ path: '.env.local' });

const app = express();
const port = Number(process.env.PORT ?? 4000);
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 8;
const recommendationCache = new Map();
const externalDataCache = new Map();
const pendingRecommendationJobs = new Set();
const professorProfileImportCache = new Map();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const PROFESSOR_IMPORT_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5174',
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
  if (user.role === 'recruiter' || user.role === 'dean') {
    return {
      completed: true,
      profile: null,
      steps: {
        basic: true,
      },
    };
  }

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
        transcript: !!profile?.transcript?.name,
        interests: Array.isArray(profile?.interests) && profile.interests.length > 0,
      },
    };
  }

  const profile = store.professorProfiles.find((p) => p.userId === user.id) ?? null;
  const researchAreas = normalizeResearchList(profile?.researchAreas, { limit: 12 });
  const researchInterests = cleanResearchInterestTags(profile?.researchInterests);
  const completed =
    !!profile &&
    !!user.name?.trim() &&
    !!profile.department?.trim() &&
    !!profile.title?.trim() &&
    !!profile.contactEmail?.trim() &&
    researchAreas.length > 0 &&
    researchInterests.length > 0;

  return {
    completed,
    profile: profile ? { ...profile, researchAreas, researchInterests } : null,
    steps: {
      basic: !!user?.name?.trim() && !!profile?.department?.trim() && !!profile?.title?.trim() && researchAreas.length > 0,
      contact: !!profile?.contactEmail?.trim(),
    },
  };
}

function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string') {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function createSupabaseUserClient(accessToken) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase is not configured on the server.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: WebSocket,
    },
  });
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function getUploadedFile(value) {
  const record = asObject(value);
  return typeof record.name === 'string' && record.name.trim()
    ? {
        name: record.name,
        uploadDate: typeof record.uploadDate === 'string' ? record.uploadDate : new Date().toISOString(),
      }
    : null;
}

async function getSupabaseUserFromRequest(req) {
  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return null;
  }

  const supabase = createSupabaseUserClient(accessToken);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user?.email) {
    return null;
  }

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  const role = profileRow?.role ?? data.user.user_metadata?.role ?? 'student';
  const user = {
    id: data.user.id,
    email: data.user.email,
    name: profileRow?.full_name ?? data.user.user_metadata?.full_name ?? data.user.email,
    role,
  };

  let studentProfile = null;
  if (role === 'student') {
    const { data: studentRow, error: studentError } = await supabase
      .from('students')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle();

    if (studentError) {
      throw studentError;
    }

    if (studentRow) {
      const metadata = asObject(studentRow.metadata);
      studentProfile = {
        id: studentRow.id,
        userId: studentRow.id,
        name: user.name,
        major: studentRow.major ?? '',
        graduationYear: studentRow.academic_year ?? '',
        degree: studentRow.degree ?? '',
        github: studentRow.github_url ?? '',
        githubUrl: studentRow.github_url ?? '',
        linkedin: studentRow.linkedin_url ?? '',
        linkedInUrl: studentRow.linkedin_url ?? '',
        skills: Array.isArray(metadata.skills) ? metadata.skills.filter((entry) => typeof entry === 'string') : [],
        interests: Array.isArray(studentRow.research_interests)
          ? studentRow.research_interests
          : Array.isArray(metadata.interests)
            ? metadata.interests.filter((entry) => typeof entry === 'string')
            : [],
        resume: getUploadedFile(studentRow.resume),
        resumeText: studentRow.resume_text ?? '',
        transcript: getUploadedFile(studentRow.transcript),
        transcriptText: studentRow.transcript_text ?? '',
        coursework: Array.isArray(studentRow.coursework) ? studentRow.coursework : [],
      };
    }
  }

  return { user, studentProfile };
}

async function authRequired(req, res, next) {
  try {
    const supabaseSession = await getSupabaseUserFromRequest(req);
    if (supabaseSession) {
      req.user = supabaseSession.user;
      req.sessionUserId = supabaseSession.user.id;
      req.studentProfile = supabaseSession.studentProfile;
      return next();
    }
  } catch (error) {
    return next(error);
  }

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
    coursework: Array.isArray(profile?.coursework) ? profile.coursework : [],
    summary: profile?.summary ?? '',
    university: profile?.university ?? '',
    degree: profile?.degree ?? '',
    github: profile?.github ?? profile?.githubUrl ?? profile?.github_url ?? '',
    linkedin: profile?.linkedin ?? profile?.linkedInUrl ?? profile?.linkedinUrl ?? profile?.linkedInURL ?? profile?.linkedin_url ?? '',
    resumeText: profile?.resumeText ?? '',
    transcriptText: profile?.transcriptText ?? '',
  });
}

function formatCourseworkEntry(course) {
  if (typeof course === 'string') {
    return course.trim();
  }

  if (!course || typeof course !== 'object') {
    return '';
  }

  const courseNumber = typeof course.courseNumber === 'string' ? course.courseNumber.trim() : '';
  const courseName = typeof course.courseName === 'string' ? course.courseName.trim() : '';
  return [courseNumber, courseName].filter(Boolean).join(' - ');
}

function recruiterRequired(req, res, next) {
  if (!req.user || req.user.role !== 'recruiter') {
    return res.status(403).json({ error: 'Recruiter role required.' });
  }
  return next();
}

function deanRequired(req, res, next) {
  if (!req.user || req.user.role !== 'dean') {
    return res.status(403).json({ error: 'Dean role required.' });
  }
  return next();
}

function professorRequired(req, res, next) {
  if (!req.user || req.user.role !== 'professor') {
    return res.status(403).json({ error: 'Professor role required.' });
  }
  return next();
}

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== 'string' || !value.trim()) {
    throw httpError(400, `${field} is required.`);
  }

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw httpError(400, `${field} is too long.`);
  }
  return trimmed;
}

function cleanEmailSubject(value) {
  return requiredText(value, 'subject', 200).replace(/[\r\n]+/g, ' ');
}

function isValidEmailAddress(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

async function resolveSupabaseMessageTarget({ accessToken, professorId, studentId, applicationId, projectId }) {
  if (!isUuid(studentId) || (applicationId && !isUuid(applicationId)) || (projectId && !isUuid(projectId))) {
    throw httpError(400, 'Real email sending requires a Supabase application record.');
  }

  const supabase = createSupabaseUserClient(accessToken);
  if (!applicationId && !projectId) {
    throw httpError(400, 'applicationId or projectId is required.');
  }

  const { data, error } = await supabase
    .rpc('resolve_professor_message_recipient', {
      p_student_id: studentId,
      p_application_id: applicationId,
      p_project_id: projectId,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!data) {
    throw httpError(404, 'Application relationship not found.');
  }

  const email = typeof data.student_email === 'string' ? data.student_email.trim() : '';
  if (!isValidEmailAddress(email)) {
    throw httpError(422, 'Student profile email is missing or invalid.');
  }

  return {
    supabase,
    applicationId: data.application_id,
    projectId: data.project_id,
    projectTitle: typeof data.project_title === 'string' ? data.project_title : '',
    recipient: {
      studentId: data.student_id,
      name: typeof data.student_name === 'string' && data.student_name.trim() ? data.student_name.trim() : 'Student Applicant',
      email,
    },
  };
}

function resolveLocalMessageTarget({ store, professorId, studentId, projectId }) {
  const posting = getPostingById(store, projectId);
  if (!posting) {
    throw httpError(404, 'Project not found.');
  }
  if (String(posting.professorId) !== String(professorId)) {
    throw httpError(403, 'You can only email students for your own projects.');
  }

  const student = store.users.find((entry) => String(entry.id) === String(studentId) && entry.role === 'student');
  if (!student || !isValidEmailAddress(student.email)) {
    throw httpError(422, 'Student email is missing or invalid.');
  }

  return {
    supabase: null,
    applicationId: null,
    projectId: posting.id,
    projectTitle: posting.title ?? '',
    recipient: {
      studentId: student.id,
      name: student.name ?? 'Student Applicant',
      email: student.email,
    },
  };
}

async function createPendingMessage({ target, professorId, subject, body }) {
  if (!target.supabase) {
    return null;
  }

  const { data, error } = await target.supabase.from('messages').insert({
    sender_id: professorId,
    recipient_id: target.recipient.studentId,
    recipient_email: target.recipient.email,
    project_id: target.projectId,
    application_id: target.applicationId,
    subject,
    body,
    delivery_status: 'pending',
  }).select('id').single();

  if (error) {
    throw error;
  }

  return data?.id ?? null;
}

async function updateMessageDelivery({ supabase, messageId, status, providerMessageId = null, errorMessage = null }) {
  if (!supabase || !messageId) {
    return;
  }

  const { error } = await supabase
    .from('messages')
    .update({
      delivery_status: status,
      provider_message_id: providerMessageId,
      error_message: errorMessage,
    })
    .eq('id', messageId);

  if (error) {
    console.warn('[messages/send-email] message delivery update failed:', error.message);
  }
}

function getRecommendationPostingFingerprint(posting) {
  return JSON.stringify({
    id: posting?.id ?? '',
    title: posting?.title ?? '',
    category: posting?.category ?? '',
    researchAreas: Array.isArray(posting?.researchAreas) ? posting.researchAreas : [],
    skillsNeeded: Array.isArray(posting?.skillsNeeded) ? posting.skillsNeeded : [],
    professorName: posting?.professorName ?? '',
    professorDepartment: posting?.professorDepartment ?? '',
    overview: posting?.overview ?? '',
    studentRoleDescription: posting?.studentRoleDescription ?? '',
    requiredQualifications: posting?.requiredQualifications ?? '',
    preferredQualifications: posting?.preferredQualifications ?? '',
    compensation: posting?.compensation ?? '',
    applicationDeadline: posting?.applicationDeadline ?? '',
    status: posting?.status ?? '',
  });
}

function getCacheKey(studentId, posting, profile) {
  return JSON.stringify({
    studentId,
    postingId: String(posting?.id ?? ''),
    posting: getRecommendationPostingFingerprint(posting),
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

function hasExternalCached(cacheKey) {
  return externalDataCache.has(cacheKey);
}

function buildStudentScoringSignal(profile) {
  const parts = [];

  const addLine = (label, value) => {
    if (typeof value === 'string' && value.trim()) {
      parts.push(`${label}: ${value.trim()}`);
    }
  };

  addLine('Name', profile?.name);
  addLine('Major', profile?.major);
  addLine('Academic year', profile?.graduationYear);
  addLine('Degree', profile?.degree);
  addLine('University', profile?.university);
  addLine('GPA', profile?.gpa);
  addLine('Summary', profile?.summary);
  addLine('Job title', profile?.jobTitle);
  addLine('Employer', profile?.employer);

  if (Array.isArray(profile?.skills) && profile.skills.length > 0) {
    parts.push(`Skills: ${profile.skills.filter(Boolean).join(', ')}`);
  }

  if (Array.isArray(profile?.interests) && profile.interests.length > 0) {
    parts.push(`Research interests: ${profile.interests.filter(Boolean).join(', ')}`);
  }

  if (Array.isArray(profile?.coursework) && profile.coursework.length > 0) {
    const coursework = profile.coursework.map(formatCourseworkEntry).filter(Boolean);
    if (coursework.length > 0) {
      parts.push(`Transcript coursework: ${coursework.join(', ')}`);
    }
  }

  addLine('GitHub URL', profile?.github ?? profile?.githubUrl ?? profile?.github_url);
  addLine('LinkedIn URL', profile?.linkedin ?? profile?.linkedInUrl ?? profile?.linkedinUrl ?? profile?.linkedInURL ?? profile?.linkedin_url);

  if (typeof profile?.resumeText === 'string' && profile.resumeText.trim()) {
    parts.push(`Resume text:\n${profile.resumeText.trim().slice(0, 12000)}`);
  } else if (profile?.resume?.name) {
    parts.push(`Resume file uploaded: ${profile.resume.name}`);
  }

  if (typeof profile?.transcriptText === 'string' && profile.transcriptText.trim()) {
    parts.push(`Transcript text:\n${profile.transcriptText.trim().slice(0, 6000)}`);
  } else if (profile?.transcript?.name) {
    parts.push(`Transcript file uploaded: ${profile.transcript.name}`);
  }

  return parts.join('\n');
}

function getSafeStudentProfile(student, profile) {
  return {
    ...(profile && typeof profile === 'object' ? profile : {}),
    userId: profile?.userId ?? student?.id ?? '',
    id: profile?.id ?? student?.id ?? '',
    name: profile?.name ?? student?.name ?? '',
    email: profile?.email ?? student?.email ?? '',
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    interests: Array.isArray(profile?.interests) ? profile.interests : [],
    coursework: Array.isArray(profile?.coursework) ? profile.coursework : [],
  };
}

function getProfileStrength(profile) {
  const githubUrl = String(profile?.github ?? profile?.githubUrl ?? profile?.github_url ?? '').trim();
  const linkedinUrl = String(profile?.linkedin ?? profile?.linkedInUrl ?? profile?.linkedinUrl ?? profile?.linkedInURL ?? profile?.linkedin_url ?? '').trim();
  const hasResume = Boolean(profile?.resume?.name || (typeof profile?.resumeText === 'string' && profile.resumeText.trim()));
  const hasTranscript = Boolean(profile?.transcript?.name || (typeof profile?.transcriptText === 'string' && profile.transcriptText.trim()) || (Array.isArray(profile?.coursework) && profile.coursework.length > 0));
  const hasInterests = Array.isArray(profile?.interests) && profile.interests.length > 0;
  const hasSkills = Array.isArray(profile?.skills) && profile.skills.length > 0;

  return {
    resume: hasResume ? 'Connected' : 'Missing',
    github: githubUrl ? 'Connected' : 'Missing',
    linkedin: linkedinUrl ? 'Connected' : 'Missing',
    transcript: hasTranscript ? 'Connected' : 'Missing',
    researchInterests: hasInterests ? 'Connected' : 'Missing',
    skills: hasSkills ? 'Connected' : 'Incomplete',
    progressReports: 'Missing',
    facultyVerification: 'Missing',
  };
}

function getMissingRecommendationSignals(profile) {
  const strength = getProfileStrength(profile);
  const labels = {
    resume: 'Resume not uploaded',
    github: 'GitHub not connected',
    linkedin: 'LinkedIn not connected',
    transcript: 'Transcript or coursework not added',
    researchInterests: 'Research interests incomplete',
    skills: 'Skills list incomplete',
    progressReports: 'No progress reports available',
    facultyVerification: 'No faculty verification available',
  };

  return Object.entries(strength)
    .filter(([, status]) => status !== 'Connected')
    .map(([key, status]) => ({
      key,
      status,
      message: labels[key] ?? 'Profile signal incomplete',
    }));
}

function tokenizeRecommendationText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9+#]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function scoreFallbackPosting(profile, posting, index) {
  const profileTerms = new Set(tokenizeRecommendationText([
    profile?.major,
    profile?.degree,
    ...(Array.isArray(profile?.skills) ? profile.skills : []),
    ...(Array.isArray(profile?.interests) ? profile.interests : []),
    ...(Array.isArray(profile?.coursework) ? profile.coursework.map(formatCourseworkEntry) : []),
  ].filter(Boolean).join(' ')));
  const postingTerms = tokenizeRecommendationText([
    posting?.title,
    posting?.category,
    posting?.professorDepartment,
    posting?.overview,
    posting?.studentRoleDescription,
    posting?.requiredQualifications,
    posting?.preferredQualifications,
    ...(Array.isArray(posting?.researchAreas) ? posting.researchAreas : []),
    ...(Array.isArray(posting?.skillsNeeded) ? posting.skillsNeeded : []),
  ].filter(Boolean).join(' '));
  const overlap = postingTerms.reduce((count, term) => count + (profileTerms.has(term) ? 1 : 0), 0);
  const basis = overlap > 0
    ? 'Recommended from your major, interests, and saved profile'
    : index < 3
      ? 'Recently posted opportunity'
      : 'Available research opportunity';
  const confidence = clampScore(Math.min(84, 58 + overlap * 6 - index * 2));

  return {
    postingId: String(posting.id),
    confidence,
    reason: basis,
    score_breakdown: {
      base_score: confidence,
      github_bonus: 0,
      github_available: false,
      github_sparse: false,
      linkedin_bonus: 0,
      linkedin_available: false,
      linkedin_sparse: false,
    },
    qualifications: overlap > 0 ? ['Saved profile terms overlap with this project.'] : ['This published project is available for student applications.'],
    fit_reasoning: [basis],
    gaps: ['Add more profile evidence to improve recommendation quality.'],
    recommendation: confidence >= 70 ? 'Good Fit' : confidence >= 55 ? 'Possible Fit' : 'Weak Fit',
    fallback: true,
    fallback_reason: basis,
  };
}

function buildFallbackRecommendations({ profile, postings }) {
  return (Array.isArray(postings) ? postings : [])
    .map(normalizePostingPayload)
    .filter(Boolean)
    .filter((posting) => posting.status === 'published' || !posting.status)
    .map((posting, index) => scoreFallbackPosting(profile, posting, index))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 12);
}

function buildRecommendationResponse({ recommendations = [], profile, warnings = [] }) {
  return {
    recommendations: Array.isArray(recommendations) ? recommendations : [],
    profileStrength: getProfileStrength(profile),
    missingSignals: getMissingRecommendationSignals(profile),
    warnings: warnings.filter(Boolean).map((warning) => String(warning)),
    generatedAt: new Date().toISOString(),
  };
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
    researchAreas: normalizeResearchList(posting.researchAreas, { limit: 12 }),
    skillsNeeded: normalizeResearchList(posting.skillsNeeded, { limit: 18 }),
  };
}

async function resolveExternalStudentData(student) {
  const studentId = String(student?.id ?? '');
  const githubUrl = String(student?.github ?? student?.githubUrl ?? student?.github_url ?? '').trim();
  const linkedinUrl = String(student?.linkedin ?? student?.linkedInUrl ?? student?.linkedinUrl ?? student?.linkedInURL ?? student?.linkedin_url ?? '').trim();

  const githubCacheKey = `github:${studentId}:${githubUrl.toLowerCase()}`;
  const linkedinCacheKey = `linkedin:${studentId}:${linkedinUrl.toLowerCase()}`;

  const cachedGithub = hasExternalCached(githubCacheKey) ? getExternalCached(githubCacheKey) : undefined;
  const cachedLinkedIn = hasExternalCached(linkedinCacheKey) ? getExternalCached(linkedinCacheKey) : undefined;

  const githubData = cachedGithub !== undefined ? cachedGithub : githubUrl ? await fetchGitHubData(githubUrl) : null;
  const linkedinData = cachedLinkedIn !== undefined ? cachedLinkedIn : linkedinUrl ? await fetchLinkedInData(linkedinUrl) : null;

  if (cachedGithub === undefined) {
    setExternalCached(githubCacheKey, githubData);
  }

  if (cachedLinkedIn === undefined) {
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
        resumeSignal: buildStudentScoringSignal(profile),
        githubData,
        linkedinData,
      });

      if (scoringResult?.score_breakdown) {
        setCached(cacheKey, scoringResult);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown background scoring error.';
      console.error('[bg score error]', posting?.id, message);
    } finally {
      pendingRecommendationJobs.delete(cacheKey);
    }
  });
}

function warmRecommendationScoresForProfile({ store, studentId, profile }) {
  const postings = (Array.isArray(store.postings) ? store.postings : []).filter((posting) => posting?.status === 'published');

  for (const posting of postings) {
    const cacheKey = getCacheKey(studentId, posting, profile);
    if (getCached(cacheKey) || pendingRecommendationJobs.has(cacheKey)) {
      continue;
    }

    scorePostingInBackground({ cacheKey, posting, profile, studentId });
  }
}

function getResumePrompt(mode) {
  if (mode === 'skills') {
    return "Extract a list of technical and soft skills from this resume as a JSON array of short strings (e.g. 'Python', 'data analysis', 'teamwork'). Return raw JSON array only.";
  }

  return `Parse this resume and return a JSON object with these fields: fullName, email, major, academicYear (one of: Freshman, Sophomore, Junior, Senior, Master's, PhD), skills (array of strings). Base academicYear on the most recent in-progress academic degree: use PhD for PhD/Doctor of Philosophy/PhD Candidate, Master's for MS/MA/MBA/Master of..., or infer Freshman/Sophomore/Junior/Senior from the expected graduation year for BS/BA/Bachelor of.... Do not return Graduate. Only include fields you are confident about. Return raw JSON only, no markdown.`;
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

function isPrivateIp(address) {
  const version = net.isIP(address);
  if (version === 4) {
    const parts = address.split('.').map((part) => Number(part));
    const [a, b] = parts;
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === '::1' ||
      normalized === '::' ||
      normalized.startsWith('fc') ||
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80:')
    );
  }

  return false;
}

async function sanitizeImportUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    throw Object.assign(new Error('URL is required.'), { status: 400 });
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw Object.assign(new Error('Enter a valid URL.'), { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('URL must start with http:// or https://.'), { status: 400 });
  }

  if (parsed.username || parsed.password) {
    throw Object.assign(new Error('URL credentials are not allowed.'), { status: 400 });
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname === '0.0.0.0' ||
    hostname === '::1'
  ) {
    throw Object.assign(new Error('Local URLs are not allowed.'), { status: 400 });
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw Object.assign(new Error('Private or local network URLs are not allowed.'), { status: 400 });
  }

  return parsed;
}

async function fetchImportUrl(rawUrl, redirectCount = 0) {
  if (redirectCount > 3) {
    throw Object.assign(new Error('Too many redirects.'), { status: 400 });
  }

  const parsed = await sanitizeImportUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(parsed.href, {
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.5',
        'User-Agent': 'CMUResearchPortalProfileImporter/1.0',
      },
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        throw Object.assign(new Error('Redirect response did not include a location.'), { status: 400 });
      }

      return fetchImportUrl(new URL(location, parsed.href).href, redirectCount + 1);
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Could not fetch page (${response.status}).`), { status: 400 });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml|text\/plain/i.test(contentType)) {
      throw Object.assign(new Error('URL must point to a readable web page.'), { status: 400 });
    }

    const text = await response.text();
    return {
      finalUrl: parsed.href,
      html: text.slice(0, 2_000_000),
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw Object.assign(new Error('Import timed out while fetching the page.'), { status: 408 });
    }
    if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
      const causeCode = typeof error.cause?.code === 'string' ? ` (${error.cause.code})` : '';
      throw Object.assign(
        new Error(`Could not fetch the faculty page from the server${causeCode}. Try opening the page in your browser, then retry or paste a different faculty/lab page URL.`),
        { status: 502 }
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(value) {
  return String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function extractMetaContent(html, names) {
  for (const name of names) {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
    const reversePattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["'][^>]*>`, 'i');
    const match = html.match(pattern) ?? html.match(reversePattern);
    if (match?.[1]) {
      return decodeHtmlEntities(match[1]).trim();
    }
  }

  return '';
}

function htmlToReadableText(html) {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h1|h2|h3|h4|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
  ).trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function extractFirstEmail(text, html) {
  const mailto = html.match(/mailto:([^"'>?\s]+)/i)?.[1];
  if (mailto) {
    return decodeURIComponent(mailto).trim();
  }

  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
}

function field(value = '', confidence = 0) {
  return {
    value: Array.isArray(value) ? value : typeof value === 'string' ? value.trim() : '',
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
  };
}

function cleanExtractedValue(value, maxLength = 600) {
  return decodeHtmlEntities(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

function titleCaseResearchTag(value) {
  const smallWords = new Set(['and', 'or', 'of', 'in', 'for', 'to', 'with', 'the', 'a', 'an']);
  return value
    .split(/\s+/)
    .map((word, index) => {
      if (/^[A-Z0-9-]{2,}$/.test(word)) return word;
      const lower = word.toLowerCase();
      if (index > 0 && smallWords.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function cleanResearchFragment(value, { allowLong = false } = {}) {
  const fillerPatterns = [
    /\bpeople are actively working in\b/gi,
    /\binterests encompass\b/gi,
    /\bresearch interests include\b/gi,
    /\bresearch areas include\b/gi,
    /\bmy research interests include\b/gi,
    /\bmy research focuses on\b/gi,
    /\bresearch focuses on\b/gi,
    /\bworks on\b/gi,
    /\bworking on\b/gi,
    /\bacross the department\b/gi,
    /\binclude\b/gi,
  ];

  let cleaned = decodeHtmlEntities(String(value ?? ''))
    .replace(/[•·●]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.|\-–—]+|[\s:;,.|\-–—]+$/g, '')
    .trim();

  for (const pattern of fillerPatterns) {
    cleaned = cleaned.replace(pattern, ' ');
  }

  cleaned = cleaned
    .replace(/\s+/g, ' ')
    .replace(/^[\s:;,.|\-–—]+|[\s:;,.|\-–—]+$/g, '')
    .trim();

  if (cleaned.length < 3) return '';
  if (!allowLong && cleaned.length > 80) return '';
  if (/^(research|interests?|areas?|expertise|focus)$/i.test(cleaned)) return '';

  return allowLong ? cleaned : titleCaseResearchTag(cleaned);
}

function extractHeadings(html) {
  const headings = [];
  const pattern = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const text = cleanExtractedValue(match[2].replace(/<[^>]+>/g, ' '), 180);
    if (text) {
      headings.push({ level: Number(match[1]), text });
    }
  }
  return headings.slice(0, 40);
}

function extractLinks(html, finalUrl) {
  const links = [];
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(html))) {
    try {
      const href = new URL(decodeHtmlEntities(match[1]), finalUrl).href;
      const label = cleanExtractedValue(match[2].replace(/<[^>]+>/g, ' '), 160);
      links.push({ href, label });
    } catch {
      // Ignore malformed links found in the imported page.
    }
  }
  return links.slice(0, 160);
}

function extractSection(text, labels) {
  const escaped = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const nextHeading = '(?:Research Areas|Areas of Interest|Research Focus|Expertise|Research Interests|Interests|Current Research|Publications|Teaching|Education|Biography|Bio|Contact)';
  const pattern = new RegExp(`(?:${escaped})\\s*[:\\-]?\\s+([\\s\\S]{20,900}?)(?=\\s+${nextHeading}\\b|$)`, 'i');
  return cleanExtractedValue(text.match(pattern)?.[1] ?? '', 700);
}

function splitAreas(value) {
  return uniqueStrings(
    cleanExtractedValue(value, 1200)
      .split(/[,;|\n\r]+|(?:\s+-\s+)|(?:\s+•\s+)|(?:\s+and\s+)/i)
      .map((entry) => cleanResearchFragment(entry))
      .filter(Boolean)
  ).slice(0, 12);
}

function normalizeResearchList(value, { allowLong = false, limit = 12 } = {}) {
  const input = Array.isArray(value) ? value.join('\n') : value;
  return uniqueStrings(
    cleanExtractedValue(input, 1600)
      .split(/[,;|\n\r]+|(?:\s+-\s+)|(?:\s+•\s+)/i)
      .map((entry) => cleanResearchFragment(entry, { allowLong }))
      .filter(Boolean)
      .filter((entry) => !/\b(?:education|award|honou?r|publication|selected publications|cv|curriculum vitae|contacts?|key contacts?|phone|email|office|staff)\b/i.test(entry))
  ).slice(0, limit);
}

function cleanResearchInterestText(value) {
  const cleaned = cleanExtractedValue(value, 900)
    .split(/[\n\r]+|[;|]+/)
    .map((entry) => cleanResearchFragment(entry, { allowLong: true }))
    .filter(Boolean)
    .join('\n');

  return cleaned.length > 900 ? `${cleaned.slice(0, 897).trim()}...` : cleaned;
}

function cleanResearchInterestTags(value) {
  return normalizeResearchList(value, { allowLong: false, limit: 18 })
    .map((entry) => entry.replace(/\.$/, '').trim())
    .filter((entry) => entry.length >= 2 && entry.length <= 80);
}

function extractTitle(text) {
  return text.match(/\b(Assistant Professor|Associate Professor|Full Professor|Distinguished Professor|Teaching Professor|Research Professor|Adjunct Professor|Professor|Research Scientist|Senior Research Scientist|Lecturer|Senior Lecturer|Postdoctoral Fellow|Postdoctoral Researcher|Principal Investigator|PI)\b/i)?.[0] ?? '';
}

function inferDepartmentFromUrl(finalUrl) {
  const { hostname, pathname } = new URL(finalUrl);
  const target = `${hostname.toLowerCase()}${pathname.toLowerCase()}`;
  const mappings = [
    { pattern: /(^|\.)csd\.cs\.cmu\.edu\b|\/csd\b/, value: 'Computer Science Department' },
    { pattern: /(^|\.)lti\.cs\.cmu\.edu\b|\/lti\b/, value: 'Language Technologies Institute' },
    { pattern: /(^|\.)ri\.cmu\.edu\b|\/robotics\b|\/ri\b/, value: 'Robotics Institute' },
    { pattern: /(^|\.)ml\.cmu\.edu\b|\/machine-learning\b|\/ml\b/, value: 'Machine Learning Department' },
    { pattern: /(^|\.)hcii\.cmu\.edu\b|\/hcii\b/, value: 'Human-Computer Interaction Institute' },
    { pattern: /(^|\.)ece\.cmu\.edu\b|\/ece\b/, value: 'Electrical and Computer Engineering' },
    { pattern: /(^|\.)tepper\.cmu\.edu\b|\/tepper\b/, value: 'Tepper School of Business' },
    { pattern: /(^|\.)cs\.cmu\.edu\b|\/cs\b/, value: 'School of Computer Science' },
  ];

  return mappings.find((mapping) => mapping.pattern.test(target))?.value ?? '';
}

function extractDepartment(text) {
  const nearbyPattern = /\b(?:Department of|School of|Institute(?: for| of)?|College of|Faculty in|Affiliated with)\s+[A-Z][A-Za-z&,\-/\s]{3,90}/i;
  const nearby = text.match(nearbyPattern)?.[0] ?? '';
  return cleanExtractedValue(nearby.replace(/\s+(?:Home|People|Faculty|Research|Contact)\b.*$/i, ''), 140);
}

function extractPublicationUrl(links) {
  return links.find((link) => /scholar\.google\.com|dblp\.org|pubmed|publications?|papers?|semanticsscholar/i.test(link.href) || /google scholar|publications?|papers?/i.test(link.label))?.href ?? '';
}

function extractWebsiteUrl(links, finalUrl) {
  const personal = links.find((link) => /personal|website|homepage|lab|group/i.test(link.label) && !/mailto:/i.test(link.href));
  return personal?.href ?? finalUrl;
}

function buildRuleExtraction({ html, finalUrl }) {
  const titleTag = decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const metaTitle = extractMetaContent(html, ['og:title', 'twitter:title']);
  const description = extractMetaContent(html, ['description', 'og:description', 'twitter:description']);
  const headings = extractHeadings(html);
  const links = extractLinks(html, finalUrl);
  const text = htmlToReadableText(html);
  const compactText = text.slice(0, 20000);
  const combinedTitle = metaTitle || titleTag;
  const titleParts = combinedTitle.split(/\s[-|]\s/).map((part) => part.trim()).filter(Boolean);
  const h1 = headings.find((heading) => heading.level === 1)?.text ?? '';
  const nameCandidate =
    h1 && !/\b(home|people|faculty|profile|research|department|university|lab|publications)\b/i.test(h1)
      ? h1
      : titleParts.find((part) => /\b(professor|faculty|lab|research|department|university|college|school|publications)\b/i.test(part) === false) ??
        compactText.match(/(?:Professor|Dr\.)\s+([A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){1,3})/)?.[1] ??
        '';
  const title = extractTitle(compactText);
  const inferredDepartment = inferDepartmentFromUrl(finalUrl);
  const department = inferredDepartment || extractDepartment(compactText);
  const areasSection = extractSection(compactText, ['Research Areas', 'Areas of Interest', 'Research Focus', 'Expertise']);
  const interestsSection = extractSection(compactText, ['Research Interests', 'Interests', 'Current Research']);
  const keywordMatches = compactText.match(
    /\b(machine learning|artificial intelligence|robotics|computer vision|natural language processing|human-computer interaction|security|systems|data science|bioinformatics|computational biology|software engineering|theory|algorithms|databases|graphics|education technology|economics|public policy|neuroscience|psychology|human centered computing|computational social science)\b/gi
  ) ?? [];
  const researchAreas = splitAreas(areasSection).length > 0
    ? splitAreas(areasSection)
    : uniqueStrings(keywordMatches.map((match) => match.replace(/\s+/g, ' '))).slice(0, 8);
  const researchInterests = cleanResearchInterestTags(interestsSection || description);

  return {
    fields: {
      name: field(cleanExtractedValue(nameCandidate, 120), h1 || titleParts.length ? 0.85 : nameCandidate ? 0.65 : 0),
      title: field(cleanExtractedValue(title, 120), title ? 0.9 : 0),
      department: field(cleanExtractedValue(department, 140), inferredDepartment ? 0.95 : department ? 0.82 : 0),
      contactEmail: field(extractFirstEmail(compactText, html), extractFirstEmail(compactText, html) ? 0.95 : 0),
      bioUrl: field(finalUrl, 1),
      websiteUrl: field(extractWebsiteUrl(links, finalUrl), 0.85),
      publicationsUrl: field(extractPublicationUrl(links), extractPublicationUrl(links) ? 0.9 : 0),
      researchAreas: field(researchAreas, researchAreas.length > 0 ? (splitAreas(areasSection).length > 0 ? 0.85 : 0.65) : 0),
      researchInterests: field(researchInterests, researchInterests.length > 0 ? (interestsSection ? 0.85 : 0.55) : 0),
      summary: field(cleanExtractedValue(description, 280), description ? 0.45 : 0),
    },
    page: {
      title: cleanExtractedValue(combinedTitle, 180),
      description: cleanExtractedValue(description, 300),
      headings,
      links,
      text: compactText,
    },
  };
}

function needsOllamaFallback(fields) {
  return ['department', 'researchAreas', 'researchInterests', 'summary'].some((key) => {
    const value = fields[key]?.value;
    const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
    return isEmpty || fields[key].confidence < 0.8;
  });
}

function parseJsonObject(text) {
  const cleaned = String(text ?? '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const candidate = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? cleaned;
  return JSON.parse(candidate);
}

async function extractProfessorProfileWithOllama(pageText) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        prompt: `Extract current professor research metadata from this cleaned webpage text.
Return strict raw JSON only, no markdown:
{
  "department": "",
  "researchAreas": [],
  "researchInterests": [],
  "summary": ""
}

Rules:
- Use only evidence in the text.
- Use empty strings or empty arrays when unknown.
- Do not return biography text.
- Exclude education history, awards, honors, CV sections, contact information, and publication lists.
- Prioritize current research topics, lab focus, active methods, and domains.
- researchAreas must be broad field labels.
- researchInterests must be concise tag phrases, not paragraphs.
- summary must be one concise sentence about current research focus, not a biography.

Webpage text:
${pageText.slice(0, 9000)}`,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const parsed = parseJsonObject(payload?.response);
    return {
      department: typeof parsed?.department === 'string' ? cleanExtractedValue(parsed.department, 140) : '',
      researchAreas: normalizeResearchList(parsed?.researchAreas, { limit: 8 }),
      researchInterests: cleanResearchInterestTags(parsed?.researchInterests),
      summary: typeof parsed?.summary === 'string' ? cleanExtractedValue(parsed.summary, 280) : '',
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function mergeProfessorImport(ruleExtraction, ollamaExtraction, sourceUrl) {
  const fields = { ...ruleExtraction.fields };
  let usedOllama = false;

  if (ollamaExtraction) {
    for (const key of ['department', 'researchAreas', 'researchInterests', 'summary']) {
      const ollamaValue = key === 'researchAreas'
        ? normalizeResearchList(ollamaExtraction[key], { limit: 8 })
        : key === 'researchInterests'
          ? cleanResearchInterestTags(ollamaExtraction[key])
          : cleanExtractedValue(ollamaExtraction[key] ?? '', key === 'summary' ? 280 : 180);
      const isEmpty = Array.isArray(ollamaValue) ? ollamaValue.length === 0 : !ollamaValue;
      if (isEmpty) continue;
      if (!fields[key]?.value || fields[key].confidence <= 0.8) {
        fields[key] = field(ollamaValue, 0.72);
        usedOllama = true;
      }
    }
  }

  return {
    name: fields.name.value,
    title: fields.title.value,
    department: fields.department.value,
    contactEmail: fields.contactEmail.value,
    bioUrl: fields.bioUrl.value,
    websiteUrl: fields.websiteUrl.value,
    publicationsUrl: fields.publicationsUrl.value,
    researchAreas: normalizeResearchList(fields.researchAreas.value, { limit: 8 }),
    researchInterests: cleanResearchInterestTags(fields.researchInterests.value),
    summary: cleanExtractedValue(fields.summary?.value ?? '', 280),
    sourceUrl,
    extractionMethod: usedOllama ? 'rules+ollama' : 'rules',
    confidence: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.confidence])),
  };
}

async function importProfessorProfile(rawUrl) {
  const sanitizedUrl = (await sanitizeImportUrl(rawUrl)).href;
  const cacheKey = sanitizedUrl.toLowerCase();
  const cached = professorProfileImportCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < PROFESSOR_IMPORT_CACHE_TTL_MS) {
    return { ...cached.result, cached: true };
  }

  const fetched = await fetchImportUrl(sanitizedUrl);
  const ruleExtraction = buildRuleExtraction(fetched);
  const ollamaExtraction = needsOllamaFallback(ruleExtraction.fields)
    ? await extractProfessorProfileWithOllama(ruleExtraction.page.text)
    : null;
  const result = mergeProfessorImport(ruleExtraction, ollamaExtraction, fetched.finalUrl);
  professorProfileImportCache.set(cacheKey, { cachedAt: Date.now(), result });
  return result;
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

  if (!['student', 'professor', 'recruiter', 'dean'].includes(role)) {
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
        transcript: null,
        coursework: [],
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
        researchAreas: [],
        professorWebsite: '',
        publicationsLink: '',
        researchInterests: [],
        researchSummary: '',
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
  profile.coursework = Array.isArray(next.coursework) ? next.coursework : profile.coursework;
  if (Object.prototype.hasOwnProperty.call(next, 'transcript')) {
    profile.transcript = next.transcript;
    if (next.transcript === null) {
      profile.transcriptFileName = undefined;
      profile.transcriptUploadedAt = undefined;
      profile.transcriptData = undefined;
      profile.transcriptText = undefined;
      profile.coursework = [];
    }
  }

  writeStore(store);
  warmRecommendationScoresForProfile({ store, studentId: user.id, profile });
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
  profile.researchAreas = Array.isArray(next.researchAreas) || typeof next.researchAreas === 'string'
    ? normalizeResearchList(next.researchAreas, { limit: 12 })
    : normalizeResearchList(profile.researchAreas, { limit: 12 });
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
  profile.researchInterests = Array.isArray(next.researchInterests) || typeof next.researchInterests === 'string'
    ? cleanResearchInterestTags(next.researchInterests)
    : cleanResearchInterestTags(profile.researchInterests);
  profile.researchSummary =
    typeof next.researchSummary === 'string' ? cleanExtractedValue(next.researchSummary, 280) : profile.researchSummary;
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

app.post('/api/import-professor-profile', authRequired, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'professor') {
      return res.status(403).json({ error: 'Professor role required.' });
    }

    const { url } = req.body ?? {};
    const profile = await importProfessorProfile(url);
    return res.json(profile);
  } catch (error) {
    return next(error);
  }
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
  const profile = getSafeStudentProfile(student, req.studentProfile ?? getStudentProfile(store, studentId));

  const posting = getPostingById(store, postingId);
  if (!posting) {
    return res.status(404).json({ error: 'Recommendation is not available for this opportunity.' });
  }

  const cacheKey = getCacheKey(studentId, posting, profile);
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
  const profile = getSafeStudentProfile(student, req.studentProfile ?? getStudentProfile(store, studentId));

  const posting = getPostingById(store, postingId);
  if (!posting) {
    return res.status(404).json({ error: 'Recommendation is not available for this opportunity.' });
  }

  const cacheKey = getCacheKey(studentId, posting, profile);
  const cached = getCached(cacheKey);
  if (cached) {
    return res.json({ status: 'ready', result: cached });
  }

  if (posting && !pendingRecommendationJobs.has(cacheKey)) {
    scorePostingInBackground({ cacheKey, posting, profile, studentId });
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
        error: 'Recommendation inputs are incomplete.',
        requestId,
      });
    }

    // eslint-disable-next-line no-console
    console.log(
      `[ai/recommendations:${requestId}] postings=${postings.length} skills=${Array.isArray(profile?.skills) ? profile.skills.length : 0} interests=${Array.isArray(profile?.interests) ? profile.interests.length : 0}`
    );

    const safeProfile = getSafeStudentProfile(req.user, profile);
    const githubUrl = (safeProfile?.github || safeProfile?.githubUrl || safeProfile?.github_url || '').toString().trim() || null;
    const linkedinUrl = (safeProfile?.linkedin || safeProfile?.linkedInUrl || safeProfile?.linkedinUrl || safeProfile?.linkedInURL || safeProfile?.linkedin_url || '').toString().trim() || null;
    const resumeText = buildStudentScoringSignal(safeProfile);

    const student = {
      ...safeProfile,
      github: githubUrl,
      githubUrl: githubUrl,
      linkedin: linkedinUrl,
      linkedInUrl: linkedinUrl,
      linkedinUrl,
      resumeText,
    };

    const warnings = [];
    const safePostings = postings.map(normalizePostingPayload).filter(Boolean);
    const recommendations = await getOllamaRecommendations({
      student,
      postings: safePostings,
      resumeText,
    });
    if (recommendations.some((item) => item?.fallback)) {
      warnings.push('Personalized scoring is refreshing, so some recommendations use backup matching.');
    }
    return res.json({ ...buildRecommendationResponse({ recommendations, profile: safeProfile, warnings }), requestId });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`[ai/recommendations:${requestId}] error:`, error);
    const { profile, postings } = req.body ?? {};
    const safeProfile = getSafeStudentProfile(req.user, profile);
    const fallbackRecommendations = buildFallbackRecommendations({ profile: safeProfile, postings });
    return res.json({
      ...buildRecommendationResponse({
        recommendations: fallbackRecommendations,
        profile: safeProfile,
        warnings: ['Personalized recommendations are refreshing. Showing backup matches for now.'],
      }),
      requestId,
    });
  }
});

app.post('/api/recruiter/ai/match-candidates', authRequired, recruiterRequired, async (req, res) => {
  const { role, candidates } = req.body ?? {};

  if (!role || typeof role !== 'object') {
    return res.status(400).json({ error: 'role is required.' });
  }

  if (!Array.isArray(candidates)) {
    return res.status(400).json({ error: 'candidates must be an array.' });
  }

  try {
    const matches = await getRecruiterCandidateMatches({ role, candidates });
    return res.json({ matches, source: 'ollama' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Candidate matching failed.';
    console.error('[recruiter/match-candidates] error:', error);
    const fallback = candidates
      .map((candidate) => ({
        candidateId: String(candidate?.id ?? ''),
        candidateName: String(candidate?.name ?? 'Candidate'),
        matchScore: clampScore(candidate?.matchPercentage ?? candidate?.researchScore ?? 70),
        explanation: 'Fallback ranking used available verified research profile fields while Ollama was unavailable.',
        reasons: [
          `Research areas: ${Array.isArray(candidate?.researchAreas) ? candidate.researchAreas.slice(0, 3).join(', ') : 'available profile evidence'}`,
          `Skills: ${Array.isArray(candidate?.skills) ? candidate.skills.slice(0, 4).join(', ') : 'available skill evidence'}`,
          `${candidate?.verifiedContributions ?? 0} verified contributions`,
        ],
      }))
      .filter((match) => match.candidateId)
      .sort((a, b) => b.matchScore - a.matchScore);

    return res.json({ matches: fallback, source: 'fallback', warning: message });
  }
});

app.post('/api/recruiter/ai/candidate-summary', authRequired, recruiterRequired, async (req, res) => {
  const { candidate } = req.body ?? {};

  if (!candidate || typeof candidate !== 'object') {
    return res.status(400).json({ error: 'candidate is required.' });
  }

  try {
    const summary = await getRecruiterCandidateSummary({ candidate });
    return res.json({ summary, source: 'ollama' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Candidate summary failed.';
    console.error('[recruiter/candidate-summary] error:', error);
    return res.json({
      summary: `${candidate?.name ?? 'This candidate'} has verified research contributions, faculty-backed evidence, and project work that recruiters can evaluate beyond a traditional resume.`,
      source: 'fallback',
      warning: message,
    });
  }
});

app.post('/api/recruiter/ai/outreach', authRequired, recruiterRequired, async (req, res) => {
  const { candidate, position } = req.body ?? {};

  if (!candidate || typeof candidate !== 'object') {
    return res.status(400).json({ error: 'candidate is required.' });
  }

  if (typeof position !== 'string' || !position.trim()) {
    return res.status(400).json({ error: 'position is required.' });
  }

  try {
    const message = await getRecruiterOutreachMessage({ candidate, position: position.trim() });
    return res.json({ message, source: 'ollama' });
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Outreach generation failed.';
    console.error('[recruiter/outreach] error:', error);
    return res.json({
      message: `Hi ${candidate?.name ?? 'there'}, I saw your verified research work and faculty-backed contributions on the research platform. Your experience looks relevant for ${position.trim()}, and I would like to connect about the opportunity.`,
      source: 'fallback',
      warning,
    });
  }
});

app.post('/api/dean/ai/research-report', authRequired, deanRequired, async (req, res) => {
  const { metrics } = req.body ?? {};

  if (!metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: 'metrics are required.' });
  }

  try {
    const report = await getDeanDepartmentResearchReport({ metrics });
    return res.json({ report, source: 'ollama' });
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Department research report failed.';
    console.error('[dean/research-report] error:', error);
    return res.json({
      report:
        'The department supported a strong portfolio of student research, faculty mentorship, publications, presentations, grant funding, and verified progress-report activity. Review the research output, funding, and supply-demand panels for the strongest metric-backed opportunities.',
      source: 'fallback',
      warning,
    });
  }
});

app.post('/api/dean/ai/insights', authRequired, deanRequired, async (req, res) => {
  const { metrics } = req.body ?? {};

  if (!metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: 'metrics are required.' });
  }

  try {
    const insights = await getDeanInsights({ metrics });
    return res.json({ insights, source: 'ollama' });
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'Dean insights failed.';
    console.error('[dean/insights] error:', error);
    return res.json({
      insights: [
        {
          title: 'Balance high-demand research areas',
          category: 'Resource',
          summary: 'Platform metrics show student demand is not evenly matched with available research capacity.',
          action: 'Prioritize faculty support and position creation in oversubscribed areas.',
        },
        {
          title: 'Expand verified portfolio activity',
          category: 'Growth',
          summary: 'Progress reports and verified contributions are becoming a useful signal for student outcomes.',
          action: 'Encourage faculty to verify milestone reports consistently across labs.',
        },
      ],
      source: 'fallback',
      warning,
    });
  }
});

app.post('/api/messages/send-email', authRequired, professorRequired, async (req, res, next) => {
  try {
    const studentId = requiredText(req.body?.studentId, 'studentId', 120);
    const applicationId =
      typeof req.body?.applicationId === 'string' && req.body.applicationId.trim()
        ? req.body.applicationId.trim()
        : null;
    const projectId =
      typeof req.body?.projectId === 'string' && req.body.projectId.trim()
        ? req.body.projectId.trim()
        : null;
    const subject = cleanEmailSubject(req.body?.subject);
    const body = requiredText(req.body?.body, 'body', 10000);
    const accessToken = getBearerToken(req);

    // TODO: add per-professor and per-recipient rate limiting before production launch.
    const target = accessToken
      ? await resolveSupabaseMessageTarget({
          accessToken,
          professorId: req.user.id,
          studentId,
          applicationId,
          projectId,
        })
      : resolveLocalMessageTarget({
          store: readStore(),
          professorId: req.user.id,
          studentId,
          projectId,
        });

    const messageId = await createPendingMessage({
      target,
      professorId: req.user.id,
      subject,
      body,
    });

    const delivery = await sendEmail({
      recipientEmail: target.recipient.email,
      replyTo: req.user.email,
      subject,
      text: body,
    });

    if (!delivery.success) {
      await updateMessageDelivery({
        supabase: target.supabase,
        messageId,
        status: 'failed',
        errorMessage: delivery.error,
      });
      const status = delivery.error === 'Email provider is not configured' ? 503 : 502;
      throw httpError(status, delivery.error || 'Resend email delivery failed.');
    }

    await updateMessageDelivery({
      supabase: target.supabase,
      messageId,
      status: 'sent',
      providerMessageId: delivery.providerMessageId,
    });

    return res.json({
      ok: true,
      recipient: target.recipient,
      projectId: target.projectId,
      applicationId: target.applicationId,
      messageId,
      provider: 'resend',
      providerMessageId: delivery.providerMessageId,
    });
  } catch (error) {
    return next(error);
  }
});

function clampScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 70;
  }
  return Math.min(100, Math.max(0, Math.trunc(numeric)));
}

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
