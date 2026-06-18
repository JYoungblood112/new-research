import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  FileText,
  Link as LinkIcon,
  Plus,
  ShieldCheck,
  Timer,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import {
  useData,
  type ProgressReport,
  type ProgressReportEvidence,
  type ProgressReportEvidenceDraft,
} from '../../contexts/DataContext';
import type { ProgressEvidenceType, ProgressReportStatus } from '../../lib/database.types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';

type DraftEvidence =
  | {
      id: string;
      mode: 'url';
      type: ProgressEvidenceType;
      title: string;
      externalUrl: string;
      description: string;
    }
  | {
      id: string;
      mode: 'file';
      type: ProgressEvidenceType;
      title: string;
      file: File | null;
      description: string;
    }
  | {
      id: string;
      mode: 'existing';
      evidence: ProgressReportEvidence;
    };

type ProgressReportDraft = {
  projectId: string;
  reportingPeriod: string;
  hoursWorked: string;
  tasksCompleted: string;
  resultsAchieved: string;
  challenges: string;
  nextSteps: string;
  skillsUsed: string;
  evidence: DraftEvidence[];
};

const EVIDENCE_OPTIONS: Array<{ value: ProgressEvidenceType; label: string }> = [
  { value: 'github_repo', label: 'GitHub Repo' },
  { value: 'commit', label: 'Commit' },
  { value: 'pull_request', label: 'Pull Request' },
  { value: 'website', label: 'Website' },
  { value: 'paper', label: 'Paper' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'notebook', label: 'Notebook' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'poster', label: 'Poster' },
  { value: 'demo_video', label: 'Demo Video' },
  { value: 'research_report', label: 'Research Report' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<ProgressReportStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending_approval: {
    label: 'Pending Approval',
    className: 'border border-amber-200 bg-amber-50 text-amber-700',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'border border-green-200 bg-green-50 text-green-700',
    Icon: ShieldCheck,
  },
  rejected: {
    label: 'Rejected',
    className: 'border border-red-200 bg-red-50 text-red-700',
    Icon: FileCheck2,
  },
};

const EMPTY_DRAFT: ProgressReportDraft = {
  projectId: '',
  reportingPeriod: '',
  hoursWorked: '',
  tasksCompleted: '',
  resultsAchieved: '',
  challenges: '',
  nextSteps: '',
  skillsUsed: '',
  evidence: [],
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function getEvidenceLabel(type: ProgressEvidenceType) {
  return EVIDENCE_OPTIONS.find((option) => option.value === type)?.label ?? 'Evidence';
}

function formatBytes(value?: number) {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function toEvidenceDrafts(report: ProgressReport): DraftEvidence[] {
  return report.evidence.map((evidence) => ({
    id: evidence.id,
    mode: 'existing',
    evidence,
  }));
}

function toEvidenceInputs(evidence: DraftEvidence[]): ProgressReportEvidenceDraft[] {
  return evidence
    .map((item) => {
      if (item.mode === 'existing') {
        return { mode: 'existing', evidence: item.evidence } as ProgressReportEvidenceDraft;
      }

      if (item.mode === 'file') {
        if (!item.file || !item.title.trim()) return null;
        return {
          mode: 'file',
          type: item.type,
          title: item.title.trim(),
          description: item.description.trim(),
          file: item.file,
        } as ProgressReportEvidenceDraft;
      }

      if (!item.externalUrl.trim() || !item.title.trim()) return null;
      return {
        mode: 'url',
        type: item.type,
        title: item.title.trim(),
        description: item.description.trim(),
        externalUrl: item.externalUrl.trim(),
      } as ProgressReportEvidenceDraft;
    })
    .filter((item): item is ProgressReportEvidenceDraft => Boolean(item));
}

function resettableDraft() {
  return { ...EMPTY_DRAFT, evidence: [] };
}

function VerificationBadge({ status }: { status: ProgressReportStatus }) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.Icon;

  return (
    <Badge className={`rounded-full px-3 py-1 text-xs ${config.className}`}>
      <StatusIcon className="mr-1 h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function EvidenceList({
  evidence,
  openFile,
}: {
  evidence: ProgressReportEvidence[];
  openFile: (filePath: string) => Promise<void>;
}) {
  if (evidence.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
        <LinkIcon className="h-4 w-4" />
        Proof of Work
      </div>
      <div className="grid gap-2">
        {evidence.map((item) => (
          <div key={item.id} className="rounded-lg border border-red-100 bg-white p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-[#111111]">{item.title}</p>
                <p className="text-xs text-[#777777]">{getEvidenceLabel(item.type)}</p>
              </div>
              {item.externalUrl ? (
                <Button asChild variant="outline" size="sm" className="rounded-xl">
                  <a href={item.externalUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Open
                  </a>
                </Button>
              ) : item.filePath ? (
                <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void openFile(item.filePath!)}>
                  <FileText className="mr-1 h-4 w-4" />
                  View File
                </Button>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#555555]">{item.description || item.fileName || item.externalUrl}</p>
            {item.fileName ? (
              <p className="mt-1 text-xs text-[#777777]">
                {item.fileName}
                {item.fileSize ? ` | ${formatBytes(item.fileSize)}` : ''}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportTimelineCard({
  report,
  onEdit,
  openFile,
}: {
  report: ProgressReport;
  onEdit: (report: ProgressReport) => void;
  openFile: (filePath: string) => Promise<void>;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{report.projectTitle}</CardTitle>
            <CardDescription>
              {report.reportingPeriod} | Submitted {new Date(report.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <VerificationBadge status={report.status} />
            {report.status === 'pending_approval' ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => onEdit(report)}>
                <Edit3 className="mr-1 h-4 w-4" />
                Edit
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div className="dashboard-muted-panel rounded-xl p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Hours Worked</p>
            <p className="mt-1 text-2xl font-semibold text-[#111111]">{report.hoursWorked}</p>
          </div>
          <div className="dashboard-muted-panel rounded-xl p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Short Summary</p>
            <p className="mt-1 text-sm leading-6 text-[#333333]">{report.resultsAchieved || report.tasksCompleted}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#ececec] p-3">
            <p className="text-sm font-semibold text-[#111111]">Tasks Completed</p>
            <p className="mt-1 text-sm leading-6 text-[#555555]">{report.tasksCompleted}</p>
          </div>
          <div className="rounded-xl border border-[#ececec] p-3">
            <p className="text-sm font-semibold text-[#111111]">Next Steps</p>
            <p className="mt-1 text-sm leading-6 text-[#555555]">{report.nextSteps || 'No next steps entered.'}</p>
          </div>
        </div>

        <EvidenceList evidence={report.evidence} openFile={openFile} />

        <div className="flex flex-wrap gap-2">
          {report.skillsUsed.map((skill) => (
            <Badge key={skill} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555555]">
              {skill}
            </Badge>
          ))}
        </div>

        {report.professorComment ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              Professor Comment
            </p>
            <p className="mt-1 text-sm leading-6 text-green-900">{report.professorComment}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, helper, Icon }: { label: string; value: string | number; helper: string; Icon: typeof Clock }) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
          <p className="text-2xl font-semibold text-[#111111]">{value}</p>
          <p className="text-xs text-[#6f6f6f]">{helper}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProgressReports() {
  const { user } = useAuth();
  const {
    applications,
    postings,
    progressReportsLoading,
    progressReportsError,
    refreshProgressReports,
    submitProgressReport,
    editProgressReport,
    openProgressReportEvidenceFile,
    getApplicationsByStudent,
    getProgressReportsByStudent,
  } = useData();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProgressReportDraft>(resettableDraft);

  const studentReports = useMemo(() => {
    if (!user) return [];
    return getProgressReportsByStudent(user.id).sort((left, right) => {
      if (left.status !== right.status) return left.status === 'pending_approval' ? -1 : 1;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [getProgressReportsByStudent, user, progressReportsLoading]);

  const projectOptions = useMemo(() => {
    if (!user) return [];
    const studentApplications = getApplicationsByStudent(user.id);
    const acceptedOrActive = studentApplications.filter((application) =>
      ['Accepted', 'Interview', 'Shortlisted'].includes(application.status)
    );
    const relevantApplications = acceptedOrActive.length > 0 ? acceptedOrActive : studentApplications;

    const applicationProjects = relevantApplications
      .map((application) => {
        const posting = postings.find((entry) => entry.id === application.postingId);
        return {
          id: application.postingId,
          title: application.postingTitle || posting?.title || 'Research Project',
          professorId: application.postingProfessorId || posting?.professorId || '',
        };
      })
      .filter(
        (entry): entry is { id: string; title: string; professorId: string } =>
          Boolean(entry) && isUuid(entry.id) && isUuid(entry.professorId)
      );

    if (applicationProjects.length > 0) {
      return applicationProjects;
    }

    return postings
      .filter((posting) => posting.status === 'published')
      .map((posting) => ({
        id: posting.id,
        title: posting.title,
        professorId: posting.professorId,
      }))
      .filter((entry) => isUuid(entry.id) && isUuid(entry.professorId));
  }, [applications, getApplicationsByStudent, postings, user]);

  useEffect(() => {
    if (!open || editingReportId || draft.projectId || projectOptions.length === 0) {
      return;
    }

    setDraft((current) => ({ ...current, projectId: projectOptions[0].id }));
  }, [draft.projectId, editingReportId, open, projectOptions]);

  const stats = useMemo(() => {
    const pending = studentReports.filter((report) => report.status === 'pending_approval').length;
    const approved = studentReports.filter((report) => report.status === 'approved').length;
    const hours = studentReports.reduce((sum, report) => sum + report.hoursWorked, 0);
    return { total: studentReports.length, pending, approved, hours };
  }, [studentReports]);

  const updateDraft = (field: keyof Omit<ProgressReportDraft, 'evidence'>, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const addUrlEvidence = () => {
    setDraft((current) => ({
      ...current,
      evidence: [
        ...current.evidence,
        { id: `url-${Date.now()}`, mode: 'url', type: 'github_repo', title: '', externalUrl: '', description: '' },
      ],
    }));
  };

  const addFileEvidence = () => {
    setDraft((current) => ({
      ...current,
      evidence: [
        ...current.evidence,
        { id: `file-${Date.now()}`, mode: 'file', type: 'paper', title: '', file: null, description: '' },
      ],
    }));
  };

  const updateEvidence = (id: string, updates: Partial<DraftEvidence>) => {
    setDraft((current) => ({
      ...current,
      evidence: current.evidence.map((item) => (item.id === id ? ({ ...item, ...updates } as DraftEvidence) : item)),
    }));
  };

  const removeEvidence = (id: string) => {
    setDraft((current) => ({ ...current, evidence: current.evidence.filter((item) => item.id !== id) }));
  };

  const openFile = async (filePath: string) => {
    try {
      const signedUrl = await openProgressReportEvidenceFile(filePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open evidence file.');
    }
  };

  const openForm = () => {
    setDraft({ ...resettableDraft(), projectId: projectOptions[0]?.id ?? '' });
    setEditingReportId(null);
    setOpen(true);
  };

  const openEditForm = (report: ProgressReport) => {
    setDraft({
      projectId: report.projectId,
      reportingPeriod: report.reportingPeriod,
      hoursWorked: String(report.hoursWorked),
      tasksCompleted: report.tasksCompleted,
      resultsAchieved: report.resultsAchieved,
      challenges: report.challenges,
      nextSteps: report.nextSteps,
      skillsUsed: report.skillsUsed.join(', '),
      evidence: toEvidenceDrafts(report),
    });
    setEditingReportId(report.id);
    setOpen(true);
  };

  const submitReport = async () => {
    if (!user) {
      toast.error('Please sign in before submitting a progress report.');
      return;
    }

    const selectedProject = projectOptions.find((project) => project.id === draft.projectId);
    if (!selectedProject) {
      toast.error('Choose a research project before submitting.');
      return;
    }

    if (!isUuid(selectedProject.id) || !isUuid(selectedProject.professorId)) {
      toast.error('This project is missing backend ownership information. Refresh and try again.');
      return;
    }

    const reportingPeriod = draft.reportingPeriod.trim();
    const tasksCompleted = draft.tasksCompleted.trim();
    const hoursWorked = Number.parseFloat(draft.hoursWorked);

    if (!reportingPeriod || !tasksCompleted) {
      toast.error('Reporting period and tasks completed are required.');
      return;
    }

    if (!Number.isFinite(hoursWorked) || hoursWorked < 0) {
      toast.error('Hours worked must be a valid non-negative number.');
      return;
    }

    const evidence = toEvidenceInputs(draft.evidence);
    const incompleteEvidence = draft.evidence.some((item) => {
      if (item.mode === 'existing') return false;
      if (!item.title.trim()) return true;
      if (item.mode === 'file') return !item.file;
      return !item.externalUrl.trim();
    });
    if (incompleteEvidence) {
      toast.error('Each evidence item needs a title and either a URL or a file.');
      return;
    }

    const skillsUsed = draft.skillsUsed.split(',').map((skill) => skill.trim()).filter(Boolean);

    setSaving(true);
    try {
      if (editingReportId) {
        await editProgressReport(editingReportId, {
          reportingPeriod,
          hoursWorked,
          tasksCompleted,
          resultsAchieved: draft.resultsAchieved,
          challenges: draft.challenges,
          nextSteps: draft.nextSteps,
          skillsUsed,
          evidence,
        });
        toast.success('Progress report updated.');
      } else {
        await submitProgressReport({
          projectId: selectedProject.id,
          studentId: user.id,
          professorId: selectedProject.professorId,
          reportingPeriod,
          hoursWorked,
          tasksCompleted,
          resultsAchieved: draft.resultsAchieved,
          challenges: draft.challenges,
          nextSteps: draft.nextSteps,
          skillsUsed,
          evidence,
        });
        toast.success('Progress report submitted for approval.');
      }
      setDraft(resettableDraft());
      setEditingReportId(null);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save progress report.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">Verified Research Portfolio</p>
          <h2 className="text-2xl font-semibold text-[#111111]">Progress Reports</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#666666]">
            Document research work, attach links or files, and track professor review.
          </p>
        </div>
        <Button className="rounded-xl bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={openForm} disabled={projectOptions.length === 0}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Submit Progress Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reports Submitted" value={stats.total} helper="Milestones documented" Icon={FileCheck2} />
        <StatCard label="Pending Approval" value={stats.pending} helper="Awaiting professor review" Icon={Clock} />
        <StatCard label="Approved Reports" value={stats.approved} helper="Portfolio-ready proof" Icon={ShieldCheck} />
        <StatCard label="Total Research Hours Logged" value={stats.hours} helper="Across all reports" Icon={Timer} />
      </div>

      {progressReportsError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex flex-col gap-3 p-4 text-sm text-red-900 md:flex-row md:items-center md:justify-between">
            <span>{progressReportsError}</span>
            <Button variant="outline" className="rounded-xl bg-white" onClick={() => void refreshProgressReports()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {projectOptions.length === 0 && !progressReportsLoading ? (
        <Card className="dashboard-surface rounded-2xl">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <FilePlus2 className="h-8 w-8" />
            </div>
            <div className="max-w-xl space-y-2">
              <h3 className="text-xl font-semibold text-[#111111]">No active research projects yet.</h3>
              <p className="text-sm leading-6 text-[#666666]">
                Progress reports need a real backend project. Apply to a project or ask a professor to publish one, then try again.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : progressReportsLoading ? (
        <Card className="dashboard-surface rounded-2xl">
          <CardContent className="py-12 text-center text-sm text-[#666666]">Loading progress reports...</CardContent>
        </Card>
      ) : studentReports.length === 0 ? (
        <Card className="border-[#d0ceca] bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <FilePlus2 className="h-8 w-8" />
            </div>
            <div className="max-w-xl space-y-2">
              <h3 className="text-xl font-semibold text-[#111111]">You haven't submitted any progress reports yet.</h3>
              <p className="text-sm leading-6 text-[#666666]">
                Start documenting your research contributions with links, reports, presentations, datasets, or notebooks.
              </p>
            </div>
            <Button className="rounded-xl bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={openForm}>
              Submit First Report
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[#dedede]" />
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">Report Timeline</p>
            <div className="h-px flex-1 bg-[#dedede]" />
          </div>
          {studentReports.map((report) => (
            <ReportTimelineCard key={report.id} report={report} onEdit={openEditForm} openFile={openFile} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingReportId ? 'Edit Progress Report' : 'Submit Progress Report'}</DialogTitle>
            <DialogDescription>Add a weekly or milestone update with evidence of your research contribution.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Project</p>
                <Select value={draft.projectId} onValueChange={(value) => updateDraft('projectId', value)} disabled={Boolean(editingReportId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Reporting Period / Week</p>
                <Input value={draft.reportingPeriod} onChange={(event) => updateDraft('reportingPeriod', event.target.value)} placeholder="Week of Feb 2, 2026" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Hours Worked</p>
                <Input value={draft.hoursWorked} onChange={(event) => updateDraft('hoursWorked', event.target.value)} inputMode="decimal" placeholder="8" />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Tasks Completed</p>
                <Textarea value={draft.tasksCompleted} onChange={(event) => updateDraft('tasksCompleted', event.target.value)} rows={4} placeholder="What did you complete this period?" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Results Achieved</p>
                <Textarea value={draft.resultsAchieved} onChange={(event) => updateDraft('resultsAchieved', event.target.value)} rows={4} placeholder="What changed, improved, or became measurable?" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Challenges / Blockers</p>
                <Textarea value={draft.challenges} onChange={(event) => updateDraft('challenges', event.target.value)} rows={4} placeholder="What slowed progress or needs professor input?" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Next Steps</p>
                <Textarea value={draft.nextSteps} onChange={(event) => updateDraft('nextSteps', event.target.value)} rows={4} placeholder="What will you do next?" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Skills Used</p>
              <Input value={draft.skillsUsed} onChange={(event) => updateDraft('skillsUsed', event.target.value)} placeholder="Python, PyTorch, data cleaning, literature review" />
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900">Evidence</p>
                  <p className="text-xs text-red-800">Attach external links or upload files such as PDFs, posters, datasets, notebooks, or demo videos.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="rounded-xl bg-white" onClick={addUrlEvidence}>
                    <LinkIcon className="mr-1 h-4 w-4" />
                    Add External Link
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="rounded-xl bg-white" onClick={addFileEvidence}>
                    <Upload className="mr-1 h-4 w-4" />
                    Upload File
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {draft.evidence.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-red-200 bg-white p-5 text-center text-sm text-[#777777]">
                    Add evidence links or uploaded files before submitting.
                  </div>
                ) : null}

                {draft.evidence.map((item) => (
                  <div key={item.id} className="grid gap-3 rounded-xl border border-red-100 bg-white p-3">
                    {item.mode === 'existing' ? (
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#111111]">{item.evidence.title}</p>
                          <p className="text-xs text-[#777777]">
                            {getEvidenceLabel(item.evidence.type)}
                            {item.evidence.fileName ? ` | ${item.evidence.fileName}` : ''}
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#555555]">{item.evidence.description || item.evidence.externalUrl}</p>
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 rounded-full" onClick={() => removeEvidence(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-[180px_1fr_auto]">
                        <Select value={item.type} onValueChange={(value) => updateEvidence(item.id, { type: value as ProgressEvidenceType })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Evidence type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EVIDENCE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <div className="grid gap-2">
                          <Input value={item.title} onChange={(event) => updateEvidence(item.id, { title: event.target.value })} placeholder="Evidence title" />
                          {item.mode === 'url' ? (
                            <Input value={item.externalUrl} onChange={(event) => updateEvidence(item.id, { externalUrl: event.target.value })} placeholder="https://github.com/user/repo/commit/..." />
                          ) : (
                            <Input
                              type="file"
                              onChange={(event) => updateEvidence(item.id, { file: event.target.files?.[0] ?? null })}
                              accept=".pdf,.ppt,.pptx,.csv,.xlsx,.xls,.ipynb,.png,.jpg,.jpeg,.mp4,.mov,.txt"
                            />
                          )}
                          <Input value={item.description} onChange={(event) => updateEvidence(item.id, { description: event.target.value })} placeholder="Short description of what this proves" />
                          {item.mode === 'file' && item.file ? (
                            <p className="text-xs text-[#777777]">{item.file.name} | {formatBytes(item.file.size)}</p>
                          ) : null}
                        </div>

                        <Button type="button" variant="ghost" size="sm" className="h-9 w-9 rounded-full" onClick={() => removeEvidence(item.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button className="rounded-xl bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={submitReport} disabled={saving}>
                {saving ? 'Saving...' : editingReportId ? 'Save Changes' : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
