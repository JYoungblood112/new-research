import {
  RESEARCH_SUBJECT_GROUPS as PDF_RESEARCH_SUBJECT_GROUPS,
  type ResearchSubjectGroup,
} from './researchTaxonomyData';

export type { ResearchSubjectGroup };
export const RESEARCH_SUBJECT_GROUPS: ResearchSubjectGroup[] = PDF_RESEARCH_SUBJECT_GROUPS.map((group) => ({
  title: group.title,
  subjects: [...group.subjects].sort((a, b) => a.localeCompare(b)),
}));

export type ResearchPostingCategoryGroup = {
  category: string;
  subcategories: string[];
};

export const RESEARCH_POSTING_TAXONOMY: ResearchPostingCategoryGroup[] = [
  {
    category: 'Computer Science',
    subcategories: [
      'Artificial Intelligence',
      'Machine Learning',
      'Cybersecurity',
      'Software Engineering',
      'Human-Computer Interaction',
      'Systems',
      'Databases',
      'Theory',
      'Robotics',
      'Computer Vision',
      'Natural Language Processing',
      'Distributed Systems',
      'Programming Languages',
    ],
  },
  {
    category: 'Engineering',
    subcategories: [
      'Mechanical Engineering',
      'Electrical Engineering',
      'Civil Engineering',
      'Biomedical Engineering',
      'Chemical Engineering',
      'Materials Science',
      'Aerospace Engineering',
      'Industrial Engineering',
      'Environmental Engineering',
    ],
  },
  {
    category: 'Biology',
    subcategories: ['Molecular Biology', 'Genetics', 'Cell Biology', 'Ecology', 'Microbiology', 'Evolutionary Biology', 'Systems Biology'],
  },
  {
    category: 'Chemistry',
    subcategories: ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Analytical Chemistry', 'Biochemistry', 'Materials Chemistry'],
  },
  {
    category: 'Physics',
    subcategories: ['Condensed Matter Physics', 'Particle Physics', 'Quantum Physics', 'Astrophysics', 'Biophysics', 'Plasma Physics'],
  },
  {
    category: 'Mathematics',
    subcategories: ['Algebra', 'Analysis', 'Applied Mathematics', 'Topology', 'Optimization', 'Discrete Mathematics', 'Graph Theory'],
  },
  {
    category: 'Medicine & Health',
    subcategories: ['Public Health', 'Clinical Research', 'Epidemiology', 'Health Policy', 'Bioinformatics', 'Global Health', 'Medical Imaging'],
  },
  {
    category: 'Neuroscience',
    subcategories: ['Cognitive Neuroscience', 'Computational Neuroscience', 'Neuroimaging', 'Systems Neuroscience', 'Behavioral Neuroscience'],
  },
  {
    category: 'Psychology',
    subcategories: ['Cognitive Psychology', 'Clinical Psychology', 'Developmental Psychology', 'Social Psychology', 'Behavioral Science'],
  },
  {
    category: 'Economics',
    subcategories: ['Microeconomics', 'Macroeconomics', 'Econometrics', 'Behavioral Economics', 'Development Economics', 'Labor Economics'],
  },
  {
    category: 'Business',
    subcategories: ['Entrepreneurship', 'Marketing', 'Operations', 'Strategy', 'Organizational Behavior', 'Accounting', 'Management'],
  },
  {
    category: 'Finance',
    subcategories: ['Corporate Finance', 'Asset Pricing', 'Financial Markets', 'Risk Management', 'FinTech', 'Behavioral Finance'],
  },
  {
    category: 'Public Policy',
    subcategories: ['Policy Analysis', 'Urban Policy', 'Health Policy', 'Education Policy', 'Technology Policy', 'Social Policy'],
  },
  {
    category: 'Political Science',
    subcategories: ['Comparative Politics', 'International Relations', 'Political Theory', 'Security Studies', 'Public Administration'],
  },
  {
    category: 'Sociology',
    subcategories: ['Social Inequality', 'Urban Sociology', 'Medical Sociology', 'Organizations', 'Demography', 'Social Networks'],
  },
  {
    category: 'Education',
    subcategories: ['STEM Education', 'Learning Sciences', 'Educational Technology', 'Higher Education', 'Curriculum Design', 'Assessment'],
  },
  {
    category: 'Environmental Science',
    subcategories: ['Climate Science', 'Sustainability', 'Conservation', 'Environmental Policy', 'Remote Sensing', 'Hydrology'],
  },
  {
    category: 'Data Science',
    subcategories: ['Data Mining', 'Big Data', 'Data Visualization', 'Data Engineering', 'Applied Machine Learning', 'Responsible AI'],
  },
  {
    category: 'Statistics',
    subcategories: ['Statistical Learning', 'Bayesian Statistics', 'Causal Inference', 'Biostatistics', 'Experimental Design', 'Time Series'],
  },
  {
    category: 'Humanities',
    subcategories: ['History', 'Philosophy', 'Literature', 'Digital Humanities', 'Religious Studies', 'Cultural Studies'],
  },
  {
    category: 'Law',
    subcategories: ['Constitutional Law', 'Intellectual Property', 'Cyber Law', 'Health Law', 'Environmental Law', 'Human Rights Law'],
  },
  {
    category: 'Design',
    subcategories: ['Design Research', 'Interaction Design', 'Service Design', 'Product Design', 'Design Strategy', 'Accessibility'],
  },
  {
    category: 'Architecture',
    subcategories: ['Urban Planning', 'Sustainable Architecture', 'Housing Studies', 'Smart Cities', 'Urban Design', 'Landscape Architecture'],
  },
  {
    category: 'Communications',
    subcategories: ['Digital Media', 'Journalism', 'Science Communication', 'Health Communication', 'Organizational Communication'],
  },
  {
    category: 'Interdisciplinary Research',
    subcategories: ['Computational Social Science', 'Science & Technology Studies', 'Human-Centered AI', 'Sustainability Transitions', 'Ethics & Society'],
  },
];

export const RESEARCH_POSTING_CATEGORY_OPTIONS = RESEARCH_POSTING_TAXONOMY.map((group) => group.category);

export const RESEARCH_AREA_OPTIONS = Array.from(
  new Set(RESEARCH_POSTING_TAXONOMY.flatMap((group) => [group.category, ...group.subcategories]))
).sort((a, b) => a.localeCompare(b));

export const RESEARCH_SKILL_OPTIONS = [
  'Archival Research',
  'Clinical Protocols',
  'Data Analysis',
  'Data Visualization',
  'Experimental Design',
  'Field Research',
  'Grant Writing',
  'Interviewing',
  'IRB Protocols',
  'Lab Techniques',
  'Literature Review',
  'Machine Learning',
  'Policy Analysis',
  'Python',
  'Qualitative Coding',
  'R',
  'Research Communication',
  'Statistical Modeling',
  'Survey Design',
  'Technical Writing',
  'Wet Lab',
].sort((a, b) => a.localeCompare(b));

export function getResearchAreasForPostingCategory(category: string) {
  const group = RESEARCH_POSTING_TAXONOMY.find((entry) => entry.category === category);
  return group ? group.subcategories : RESEARCH_AREA_OPTIONS;
}

const SUBJECT_ALIAS_TO_TITLE: Record<string, string> = {};

const TITLE_TO_SUBFIELDS = new Map(RESEARCH_SUBJECT_GROUPS.map((group) => [group.title, group.subjects]));
const NORMALIZED_SUBFIELD_TO_SUBJECTS = new Map<string, Set<string>>();

type TrieNode = {
  children: Map<string, TrieNode>;
  terminalTokens: Set<string>;
};

type BKTreeNode = {
  term: string;
  children: Map<number, BKTreeNode>;
};

type TaxonomyEntry = {
  id: number;
  subject: string;
  subField: string;
  tokens: string[];
};

function normalizeText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const group of RESEARCH_SUBJECT_GROUPS) {
  SUBJECT_ALIAS_TO_TITLE[normalizeText(group.title)] = group.title;

  for (const subField of group.subjects) {
    const normalizedSubField = normalizeText(subField);
    if (!NORMALIZED_SUBFIELD_TO_SUBJECTS.has(normalizedSubField)) {
      NORMALIZED_SUBFIELD_TO_SUBJECTS.set(normalizedSubField, new Set<string>());
    }
    NORMALIZED_SUBFIELD_TO_SUBJECTS.get(normalizedSubField)!.add(group.title);
  }
}

// Common alternate phrasings and typo alias support.
SUBJECT_ALIAS_TO_TITLE['computer sceince'] = 'Computer Science';
SUBJECT_ALIAS_TO_TITLE['business'] = 'Business & Management';
SUBJECT_ALIAS_TO_TITLE['medicine health'] = 'Medicine & Health Sciences';
SUBJECT_ALIAS_TO_TITLE['medicine and health'] = 'Medicine & Health Sciences';
SUBJECT_ALIAS_TO_TITLE['medicine and health sciences'] = 'Medicine & Health Sciences';
SUBJECT_ALIAS_TO_TITLE['architecture and design'] = 'Architecture & Urban Planning';
SUBJECT_ALIAS_TO_TITLE['architecture & design'] = 'Architecture & Urban Planning';
SUBJECT_ALIAS_TO_TITLE['communication'] = 'Communication & Media Studies';
SUBJECT_ALIAS_TO_TITLE['media studies'] = 'Communication & Media Studies';

function stemToken(token: string) {
  if (token.length <= 4) return token;
  if (token.endsWith('ing') && token.length > 5) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && token.length > 4) return token.slice(0, -1);
  return token;
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(' ')
    .map((token) => stemToken(token))
    .filter(Boolean);
}

function makeTrieNode(): TrieNode {
  return {
    children: new Map<string, TrieNode>(),
    terminalTokens: new Set<string>(),
  };
}

function insertTrieToken(root: TrieNode, token: string) {
  let node = root;
  for (const char of token) {
    if (!node.children.has(char)) {
      node.children.set(char, makeTrieNode());
    }
    node = node.children.get(char)!;
  }
  node.terminalTokens.add(token);
}

function addToBKTree(root: BKTreeNode | null, term: string): BKTreeNode {
  if (!root) {
    return { term, children: new Map<number, BKTreeNode>() };
  }

  let current = root;
  while (true) {
    const distance = levenshteinDistance(term, current.term);
    const next = current.children.get(distance);
    if (!next) {
      current.children.set(distance, { term, children: new Map<number, BKTreeNode>() });
      break;
    }
    current = next;
  }

  return root;
}

function searchBKTree(root: BKTreeNode | null, term: string, maxDistance: number): string[] {
  if (!root) {
    return [];
  }

  const result: string[] = [];
  const stack: BKTreeNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    const distance = levenshteinDistance(term, node.term);

    if (distance <= maxDistance) {
      result.push(node.term);
    }

    const lower = distance - maxDistance;
    const upper = distance + maxDistance;

    for (const [edgeDistance, child] of node.children) {
      if (edgeDistance >= lower && edgeDistance <= upper) {
        stack.push(child);
      }
    }
  }

  return result;
}

function getTokensByPrefix(root: TrieNode, prefix: string, limit = 25) {
  let node = root;
  for (const char of prefix) {
    const child = node.children.get(char);
    if (!child) {
      return [];
    }
    node = child;
  }

  const tokens: string[] = [];
  const stack: TrieNode[] = [node];
  while (stack.length > 0 && tokens.length < limit) {
    const current = stack.pop()!;
    for (const token of current.terminalTokens) {
      tokens.push(token);
      if (tokens.length >= limit) break;
    }
    if (tokens.length >= limit) break;
    for (const child of current.children.values()) {
      stack.push(child);
    }
  }

  return tokens;
}

function levenshteinDistance(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);

  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }

  return prev[b.length];
}

function buildTaxonomyIndex() {
  const entries: TaxonomyEntry[] = [];
  const inverted = new Map<string, Set<number>>();
  const vocabulary = new Set<string>();
  const trieRoot = makeTrieNode();
  let bkRoot: BKTreeNode | null = null;

  for (const group of RESEARCH_SUBJECT_GROUPS) {
    for (const subField of group.subjects) {
      const id = entries.length;
      const tokenSet = new Set([...tokenize(group.title), ...tokenize(subField)]);
      const tokens = [...tokenSet];
      entries.push({ id, subject: group.title, subField, tokens });

      for (const token of tokens) {
        if (!inverted.has(token)) {
          inverted.set(token, new Set<number>());
        }
        inverted.get(token)!.add(id);
        if (!vocabulary.has(token)) {
          vocabulary.add(token);
          insertTrieToken(trieRoot, token);
          bkRoot = addToBKTree(bkRoot, token);
        }
      }
    }
  }

  const vocabularyList = [...vocabulary];
  return { entries, inverted, trieRoot, vocabularyList, bkRoot };
}

const TAXONOMY_INDEX = buildTaxonomyIndex();

export type SubjectLookupResult = {
  subjectLabel: string;
  subFields: string[];
  source: 'exact' | 'indexed' | 'generated';
};

function getGeneratedSubFields(query: string) {
  const title = query
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

  return [
    `${title} Foundations`,
    `${title} Methods`,
    `${title} Analytics`,
    `${title} Policy`,
    `${title} Ethics`,
    `${title} Applications`,
    `${title} Systems`,
    `${title} Innovation`,
  ];
}

function getFuzzyTokens(token: string, maxDistance = 2, limit = 10) {
  const candidates = searchBKTree(TAXONOMY_INDEX.bkRoot, token, maxDistance).map((candidate) => ({
    token: candidate,
    distance: levenshteinDistance(token, candidate),
  }));

  return candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map((entry) => entry.token);
}

function intersectSets(sets: Array<Set<number>>): Set<number> {
  if (sets.length === 0) {
    return new Set<number>();
  }

  const sorted = [...sets].sort((a, b) => a.size - b.size);
  const base = sorted[0];
  const result = new Set<number>();

  for (const value of base) {
    let existsInAll = true;
    for (let i = 1; i < sorted.length; i += 1) {
      if (!sorted[i].has(value)) {
        existsInAll = false;
        break;
      }
    }
    if (existsInAll) {
      result.add(value);
    }
  }

  return result;
}

function unionSets(sets: Array<Set<number>>): Set<number> {
  const result = new Set<number>();
  for (const set of sets) {
    for (const value of set) {
      result.add(value);
    }
  }
  return result;
}

export function lookupSubjectByQuery(query: string): SubjectLookupResult {
  const normalized = normalizeText(query);
  if (!normalized) {
    return { subjectLabel: '', subFields: [], source: 'generated' };
  }

  const directTitle = SUBJECT_ALIAS_TO_TITLE[normalized];
  if (directTitle) {
    return {
      subjectLabel: directTitle,
      subFields: TITLE_TO_SUBFIELDS.get(directTitle) ?? [],
      source: 'exact',
    };
  }

  // Direct subfield phrase lookup: typing a sub-genre should map to its parent subject.
  const directSubFieldSubjects = NORMALIZED_SUBFIELD_TO_SUBJECTS.get(normalized);
  if (directSubFieldSubjects && directSubFieldSubjects.size > 0) {
    const subjectLabel = [...directSubFieldSubjects][0];
    return {
      subjectLabel,
      subFields: TITLE_TO_SUBFIELDS.get(subjectLabel) ?? [],
      source: 'exact',
    };
  }

  // Partial subfield phrase lookup for "resembles a sub-genre" queries.
  let bestPartialMatch: { subject: string; score: number; tieBreaker: number } | null = null;
  for (const [normalizedSubField, subjects] of NORMALIZED_SUBFIELD_TO_SUBJECTS) {
    const tokens = normalizedSubField.split(' ').filter(Boolean);
    const exactToken = tokens.some((token) => token === normalized);
    const prefixToken = tokens.find((token) => token.startsWith(normalized));
    const contains = normalizedSubField.includes(normalized) || normalized.includes(normalizedSubField);

    if (!exactToken && !prefixToken && !contains) {
      continue;
    }

    let score = 0;
    let tieBreaker = Number.MAX_SAFE_INTEGER;

    if (exactToken) {
      score = 120;
      tieBreaker = 0;
    } else if (prefixToken) {
      score = 100;
      tieBreaker = Math.max(0, prefixToken.length - normalized.length);
    } else {
      score = 70;
      tieBreaker = Math.max(0, normalizedSubField.length - normalized.length);
    }

    for (const subject of subjects) {
      if (
        !bestPartialMatch ||
        score > bestPartialMatch.score ||
        (score === bestPartialMatch.score && tieBreaker < bestPartialMatch.tieBreaker)
      ) {
        bestPartialMatch = { subject, score, tieBreaker };
      }
    }
  }

  if (bestPartialMatch) {
    return {
      subjectLabel: bestPartialMatch.subject,
      subFields: TITLE_TO_SUBFIELDS.get(bestPartialMatch.subject) ?? [],
      source: 'indexed',
    };
  }

  const queryTokens = tokenize(normalized);
  if (queryTokens.length === 0) {
    const generated = getGeneratedSubFields(query);
    return {
      subjectLabel: query.trim(),
      subFields: generated,
      source: 'generated',
    };
  }

  const candidateSetsByToken: Array<Set<number>> = [];
  const scoreByEntry = new Map<number, number>();

  for (const token of queryTokens) {
    const tokenSets: Array<Set<number>> = [];

    const exactEntryIds = TAXONOMY_INDEX.inverted.get(token);
    if (exactEntryIds) {
      tokenSets.push(exactEntryIds);
      for (const entryId of exactEntryIds) {
        scoreByEntry.set(entryId, (scoreByEntry.get(entryId) ?? 0) + 6);
      }
    }

    const prefixTokens = getTokensByPrefix(TAXONOMY_INDEX.trieRoot, token);
    const prefixSet = new Set<number>();
    for (const prefixToken of prefixTokens) {
      const ids = TAXONOMY_INDEX.inverted.get(prefixToken);
      if (!ids) continue;
      for (const entryId of ids) {
        prefixSet.add(entryId);
        scoreByEntry.set(entryId, (scoreByEntry.get(entryId) ?? 0) + 4);
      }
    }
    if (prefixSet.size > 0) {
      tokenSets.push(prefixSet);
    }

    const fuzzyTokens = getFuzzyTokens(token);
    const fuzzySet = new Set<number>();
    for (const fuzzyToken of fuzzyTokens) {
      const ids = TAXONOMY_INDEX.inverted.get(fuzzyToken);
      if (!ids) continue;
      for (const entryId of ids) {
        fuzzySet.add(entryId);
        scoreByEntry.set(entryId, (scoreByEntry.get(entryId) ?? 0) + 2);
      }
    }
    if (fuzzySet.size > 0) {
      tokenSets.push(fuzzySet);
    }

    if (tokenSets.length > 0) {
      candidateSetsByToken.push(unionSets(tokenSets));
    }
  }

  if (candidateSetsByToken.length === 0) {
    const generated = getGeneratedSubFields(query);
    return {
      subjectLabel: query.trim(),
      subFields: generated,
      source: 'generated',
    };
  }

  // Intersect posting lists for multi-token queries to preserve strict relevance.
  let finalCandidates = intersectSets(candidateSetsByToken);

  // If strict intersection is empty, fall back to union for graceful degradation.
  if (finalCandidates.size === 0) {
    finalCandidates = unionSets(candidateSetsByToken);
  }

  if (finalCandidates.size === 0) {
    const generated = getGeneratedSubFields(query);
    return {
      subjectLabel: query.trim(),
      subFields: generated,
      source: 'generated',
    };
  }

  const scoreBySubject = new Map<string, number>();
  for (const entryId of finalCandidates) {
    const score = scoreByEntry.get(entryId) ?? 1;
    const entry = TAXONOMY_INDEX.entries[entryId];
    scoreBySubject.set(entry.subject, (scoreBySubject.get(entry.subject) ?? 0) + score);
  }

  const rankedSubjects = [...scoreBySubject.entries()].sort((a, b) => b[1] - a[1]);
  const bestSubject = rankedSubjects[0]?.[0];

  if (!bestSubject) {
    const generated = getGeneratedSubFields(query);
    return {
      subjectLabel: query.trim(),
      subFields: generated,
      source: 'generated',
    };
  }

  return {
    subjectLabel: bestSubject,
    subFields: TITLE_TO_SUBFIELDS.get(bestSubject) ?? [],
    source: 'indexed',
  };
}
