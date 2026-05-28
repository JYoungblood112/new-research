import { useEffect, useMemo, useState } from 'react'
import { createProject, fetchProjects, updateProject } from './mockApi'
import type { Message, Project, ProjectInput, ProjectStatus } from './types'

const messages: Message[] = [
  { id: 1, from: 'Mina', text: 'Uploaded the revised ethics appendix for cohort B.', time: '09:14' },
  { id: 2, from: 'Ethan', text: 'Need one reviewer for geospatial anomaly batch #44.', time: '10:02' },
  { id: 3, from: 'You', text: 'I can review by this afternoon.', time: '10:07' },
]

function statusClass(status: Project['status']): string {
  switch (status) {
    case 'Active':
      return 'pill active'
    case 'Planning':
      return 'pill planning'
    case 'Review':
      return 'pill review'
    case 'Published':
      return 'pill published'
    default:
      return 'pill'
  }
}

const statusOptions: ProjectStatus[] = ['Planning', 'Active', 'Review', 'Published']

const emptyProjectInput: ProjectInput = {
  title: '',
  lead: '',
  institution: '',
  status: 'Planning',
  collaborators: 1,
  completion: 0,
  tags: [],
}

export default function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectInput>(emptyProjectInput)
  const [tagsText, setTagsText] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchProjects()
      .then((data) => {
        if (isMounted) {
          setProjects(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load projects right now.')
          setLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const metrics = useMemo(() => {
    const activeStudies = projects.filter((project) => project.status === 'Active').length
    const globalCollaborators = projects.reduce((sum, project) => sum + project.collaborators, 0)
    const pendingReviews = projects.filter((project) => project.status === 'Review').length

    return { activeStudies, globalCollaborators, pendingReviews }
  }, [projects])

  function openCreateForm(): void {
    setEditingProjectId(null)
    setForm(emptyProjectInput)
    setTagsText('')
    setIsFormOpen(true)
  }

  function openEditForm(project: Project): void {
    setEditingProjectId(project.id)
    setForm({
      title: project.title,
      lead: project.lead,
      institution: project.institution,
      status: project.status,
      collaborators: project.collaborators,
      completion: project.completion,
      tags: project.tags,
    })
    setTagsText(project.tags.join(', '))
    setIsFormOpen(true)
  }

  function closeForm(): void {
    if (isSaving) {
      return
    }
    setIsFormOpen(false)
  }

  function parseTags(raw: string): string[] {
    return raw
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setIsSaving(true)
    setError('')

    const payload: ProjectInput = {
      ...form,
      title: form.title.trim(),
      lead: form.lead.trim(),
      institution: form.institution.trim(),
      collaborators: Math.max(1, form.collaborators),
      completion: Math.min(100, Math.max(0, form.completion)),
      tags: parseTags(tagsText),
    }

    try {
      if (editingProjectId === null) {
        const created = await createProject(payload)
        setProjects((current) => [created, ...current])
      } else {
        const updated = await updateProject(editingProjectId, payload)
        setProjects((current) => current.map((project) => (project.id === editingProjectId ? updated : project)))
      }
      setIsFormOpen(false)
    } catch {
      setError('Save failed. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <nav className="topbar">
          <div className="brand">Synapse Grid</div>
          <div className="top-actions">
            <button className="ghost">Invite Researcher</button>
            <button className="primary" onClick={openCreateForm} type="button">
              New Project
            </button>
          </div>
        </nav>

        <div className="hero-content">
          <h1>Research Collaboration Platform</h1>
          <p>
            Coordinate teams, data, and publication milestones in one workspace designed for fast-moving,
            multi-institution research.
          </p>
          <div className="metrics">
            <div>
              <span>Active Studies</span>
              <strong>{metrics.activeStudies}</strong>
            </div>
            <div>
              <span>Global Collaborators</span>
              <strong>{metrics.globalCollaborators}</strong>
            </div>
            <div>
              <span>Pending Reviews</span>
              <strong>{metrics.pendingReviews}</strong>
            </div>
          </div>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {isFormOpen && (
        <section className="card form-card">
          <div className="card-title-row">
            <h2>{editingProjectId === null ? 'Create Project' : 'Edit Project'}</h2>
            <button className="text-btn" type="button" onClick={closeForm}>
              Close
            </button>
          </div>

          <form className="project-form" onSubmit={handleSubmit}>
            <label>
              Title
              <input
                required
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              />
            </label>

            <label>
              Lead
              <input
                required
                value={form.lead}
                onChange={(event) => setForm((current) => ({ ...current, lead: event.target.value }))}
              />
            </label>

            <label>
              Institution
              <input
                required
                value={form.institution}
                onChange={(event) => setForm((current) => ({ ...current, institution: event.target.value }))}
              />
            </label>

            <label>
              Status
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as ProjectStatus }))
                }
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Collaborators
              <input
                required
                min={1}
                type="number"
                value={form.collaborators}
                onChange={(event) =>
                  setForm((current) => ({ ...current, collaborators: Number(event.target.value) }))
                }
              />
            </label>

            <label>
              Completion %
              <input
                required
                min={0}
                max={100}
                type="number"
                value={form.completion}
                onChange={(event) => setForm((current) => ({ ...current, completion: Number(event.target.value) }))}
              />
            </label>

            <label className="full-width">
              Tags (comma separated)
              <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
            </label>

            <div className="form-actions full-width">
              <button className="ghost" type="button" onClick={closeForm} disabled={isSaving}>
                Cancel
              </button>
              <button className="primary" type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : editingProjectId === null ? 'Create' : 'Save Changes'}
              </button>
            </div>
          </form>
        </section>
      )}

      <main className="layout">
        <section className="card projects">
          <div className="card-title-row">
            <h2>Projects</h2>
            <button className="text-btn" type="button">
              {projects.length} total
            </button>
          </div>

          <div className="project-list">
            {!loading && projects.map((project) => (
              <article key={project.id} className="project-item">
                <div className="project-head">
                  <h3>{project.title}</h3>
                  <div className="project-actions">
                    <span className={statusClass(project.status)}>{project.status}</span>
                    <button className="text-btn" type="button" onClick={() => openEditForm(project)}>
                      Edit
                    </button>
                  </div>
                </div>

                <p className="project-meta">
                  {project.lead} · {project.institution}
                </p>

                <div className="progress-block">
                  <div className="progress-label">
                    <span>Completion</span>
                    <span>{project.completion}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${project.completion}%` }} />
                  </div>
                </div>

                <div className="project-footer">
                  <div className="tags">
                    {project.tags.map((tag) => (
                      <span key={tag} className="tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="collaborators">{project.collaborators} collaborators</span>
                </div>
              </article>
            ))}

            {loading && <p className="empty-state">Loading projects...</p>}
            {!loading && projects.length === 0 && <p className="empty-state">No projects yet. Create one above.</p>}
          </div>
        </section>

        <aside className="side-column">
          <section className="card timeline">
            <h2>Today</h2>
            <ul>
              <li>
                <strong>11:30</strong>
                <span>Protocol sync with ethics board</span>
              </li>
              <li>
                <strong>13:00</strong>
                <span>Data harmonization checkpoint</span>
              </li>
              <li>
                <strong>16:45</strong>
                <span>Draft publication review</span>
              </li>
            </ul>
          </section>

          <section className="card chat">
            <div className="card-title-row">
              <h2>Team Channel</h2>
              <button className="text-btn">Open</button>
            </div>
            <div className="messages">
              {messages.map((msg) => (
                <div key={msg.id} className="message">
                  <div>
                    <strong>{msg.from}</strong>
                    <p>{msg.text}</p>
                  </div>
                  <time>{msg.time}</time>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  )
}
