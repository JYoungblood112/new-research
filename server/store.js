import fs from 'node:fs';
import path from 'node:path';

const STORE_PATH = path.resolve(process.cwd(), 'server/data/store.json');

function ensureStore() {
  if (!fs.existsSync(STORE_PATH)) {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(
      STORE_PATH,
      JSON.stringify({
        users: [],
        studentProfiles: [],
        professorProfiles: [],
        postings: [],
        studentRecommendationCache: [],
        recommendationsVersion: new Date(0).toISOString(),
      }, null, 2),
      'utf-8'
    );
  }
}

export function readStore() {
  ensureStore();
  const raw = fs.readFileSync(STORE_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function writeStore(data) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}
