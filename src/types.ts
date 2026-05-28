export type ProjectStatus = 'Planning' | 'Active' | 'Review' | 'Published'

export type Project = {
  id: number
  title: string
  lead: string
  institution: string
  status: ProjectStatus
  collaborators: number
  completion: number
  tags: string[]
}

export type ProjectInput = {
  title: string
  lead: string
  institution: string
  status: ProjectStatus
  collaborators: number
  completion: number
  tags: string[]
}

export type Message = {
  id: number
  from: string
  text: string
  time: string
}
