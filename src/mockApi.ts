import type { Project, ProjectInput } from './types'

const STORAGE_KEY = 'research-collab-projects'

const seedProjects: Project[] = [
  {
    id: 1,
    title: 'AI Diagnostics for Rural Clinics',
    lead: 'Dr. A. Morales',
    institution: 'Pacific Medical Lab',
    status: 'Active',
    collaborators: 12,
    completion: 68,
    tags: ['Healthcare', 'ML', 'Field Trials'],
  },
  {
    id: 2,
    title: 'Coastal Carbon Mapping Initiative',
    lead: 'Prof. N. Chen',
    institution: 'Blue Horizon Institute',
    status: 'Review',
    collaborators: 8,
    completion: 91,
    tags: ['Climate', 'GIS', 'Remote Sensing'],
  },
  {
    id: 3,
    title: 'Open Genomics Data Mesh',
    lead: 'Dr. R. Patel',
    institution: 'Genome Nexus',
    status: 'Planning',
    collaborators: 6,
    completion: 24,
    tags: ['Bioinformatics', 'Data Infrastructure'],
  },
]

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function loadFromStorage(): Project[] {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seedProjects))
    return seedProjects
  }

  try {
    const parsed = JSON.parse(raw) as Project[]
    return Array.isArray(parsed) ? parsed : seedProjects
  } catch {
    return seedProjects
  }
}

function saveToStorage(projects: Project[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export async function fetchProjects(): Promise<Project[]> {
  await delay(240)
  return loadFromStorage()
}

export async function createProject(input: ProjectInput): Promise<Project> {
  await delay(180)
  const projects = loadFromStorage()
  const nextId = projects.reduce((max, p) => Math.max(max, p.id), 0) + 1
  const created: Project = { id: nextId, ...input }
  saveToStorage([created, ...projects])
  return created
}

export async function updateProject(id: number, input: ProjectInput): Promise<Project> {
  await delay(180)
  const projects = loadFromStorage()
  const updated: Project = { id, ...input }
  const next = projects.map((project) => (project.id === id ? updated : project))
  saveToStorage(next)
  return updated
}
