import fs from 'node:fs';
import path from 'node:path';

const SESSION_STORE_PATH = path.resolve(process.cwd(), 'server/data/sessions.json');

function ensureSessionStore() {
  if (!fs.existsSync(SESSION_STORE_PATH)) {
    fs.mkdirSync(path.dirname(SESSION_STORE_PATH), { recursive: true });
    fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify({ sessions: {} }, null, 2), 'utf-8');
  }
}

function readSessionStore() {
  ensureSessionStore();
  const raw = fs.readFileSync(SESSION_STORE_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || typeof parsed.sessions !== 'object' || parsed.sessions === null) {
    return { sessions: {} };
  }
  return parsed;
}

function writeSessionStore(store) {
  fs.writeFileSync(SESSION_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export function setSession(token, userId, expiresAtMs) {
  const store = readSessionStore();
  store.sessions[token] = {
    userId,
    expiresAtMs,
  };
  writeSessionStore(store);
}

export function getSessionUserId(token) {
  const store = readSessionStore();
  const session = store.sessions[token];
  if (!session) {
    return null;
  }

  if (typeof session.expiresAtMs !== 'number' || session.expiresAtMs <= Date.now()) {
    delete store.sessions[token];
    writeSessionStore(store);
    return null;
  }

  return typeof session.userId === 'string' ? session.userId : null;
}

export function refreshSession(token, expiresAtMs) {
  const store = readSessionStore();
  const session = store.sessions[token];
  if (!session || typeof session.userId !== 'string') {
    return null;
  }

  session.expiresAtMs = expiresAtMs;
  writeSessionStore(store);
  return session.userId;
}

export function deleteSession(token) {
  const store = readSessionStore();
  if (store.sessions[token]) {
    delete store.sessions[token];
    writeSessionStore(store);
  }
}

export function pruneExpiredSessions() {
  const store = readSessionStore();
  let changed = false;

  for (const [token, session] of Object.entries(store.sessions)) {
    if (!session || typeof session !== 'object' || typeof session.expiresAtMs !== 'number' || session.expiresAtMs <= Date.now()) {
      delete store.sessions[token];
      changed = true;
    }
  }

  if (changed) {
    writeSessionStore(store);
  }
}
