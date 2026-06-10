import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  Link as LinkIcon,
  Plus,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Textarea } from '../ui/textarea';
import {
  MOCK_PROGRESS_REPORTS,
  PROGRESS_EVIDENCE_TYPES,
  type ProgressEvidenceLink,
  type ProgressEvidenceType,
  type ProgressReport,
  type ProgressVerificationStatus,
} from '../../mock/progressReports';

type ProgressReportDraft = {
  projectName: string;
  reportingPeriod: string;
  hoursWorked: string;
  tasksCompleted: string;
  resultsAchieved: string;
  challenges: string;
  nextSteps: string;
  skillsUsed: string;
  evidenceLinks: ProgressEvidenceLink[];
};

const EMPTY_DRAFT: ProgressReportDraft = {
  projectName: '',
  reportingPeriod: '',
  hoursWorked: '',
  tasksCompleted: '',
  resultsAchieved: '',
  challenges: '',
  nextSteps: '',
  skillsUsed: '',
  evidenceLinks: [
    {
      id: 'draft-evidence-1',
      type: 'GitHub Repo',
      url: '',
      description: '',
    },
  ],
};

const STATUS_CONFIG: Record<
  ProgressVerificationStatus,
  {
    label: string;
    className: string;
    Icon: typeof Clock;
  }
> = {
  Pending: {
    label: 'Pending Verification',
    className: 'border border-amber-200 bg-amber-50 text-amber-700',
    Icon: Clock,
  },
  Approved: {
    label: 'Approved by Professor',
    className: 'border border-green-200 bg-green-50 text-green-700',
    Icon: ShieldCheck,
  },
  'Needs Changes': {
    label: 'Needs Changes',
    className: 'border border-red-200 bg-red-50 text-red-700',
    Icon: FileCheck2,
  },
};

function getShortSummary(report: ProgressReport) {
  return report.resultsAchieved || report.tasksCompleted;
}

function StatCard({
  label,
  value,
  helper,
  Icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  Icon: typeof Clock;
}) {
  return (
    <Card className="border-[#d0ceca] bg-white">
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

function VerificationBadge({ status }: { status: ProgressVerificationStatus }) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.Icon;

  return (
    <Badge className={`rounded-full px-3 py-1 text-xs ${config.className}`}>
      <StatusIcon className="mr-1 h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function EvidenceLinks({ links }: { links: ProgressEvidenceLink[] }) {
  if (links.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-red-100 bg-red-50/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-red-900">
        <LinkIcon className="h-4 w-4" />
        Proof of Work
      </div>
      <div className="grid gap-2">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url || '#'}
            target={link.url ? '_blank' : undefined}
            rel={link.url ? 'noreferrer' : undefined}
            className="rounded-lg border border-red-100 bg-white p-3 text-sm transition-colors hover:border-red-200 hover:bg-red-50/60"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-[#111111]">{link.type}</span>
              {link.url ? <ExternalLink className="h-4 w-4 text-red-700" /> : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[#555555]">{link.description || link.url}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

function ReportTimelineCard({ report }: { report: ProgressReport }) {
  return (
    <Card className="border-[#d0ceca] bg-white shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="text-lg">{report.projectName}</CardTitle>
            <CardDescription>
              {report.reportingPeriod} | Submitted {new Date(report.submittedAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <VerificationBadge status={report.verificationStatus} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-[160px_1fr]">
          <div className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Hours Worked</p>
            <p className="mt-1 text-2xl font-semibold text-[#111111]">{report.hoursWorked}</p>
          </div>
          <div className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Short Summary</p>
            <p className="mt-1 text-sm leading-6 text-[#333333]">{getShortSummary(report)}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-[#ececec] p-3">
            <p className="text-sm font-semibold text-[#111111]">Tasks Completed</p>
            <p className="mt-1 text-sm leading-6 text-[#555555]">{report.tasksCompleted}</p>
          </div>
          <div className="rounded-xl border border-[#ececec] p-3">
            <p className="text-sm font-semibold text-[#111111]">Next Steps</p>
            <p className="mt-1 text-sm leading-6 text-[#555555]">{report.nextSteps}</p>
          </div>
        </div>

        <EvidenceLinks links={report.evidenceLinks} />

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

export default function ProgressReports() {
  const [reports, setReports] = useState<ProgressReport[]>(MOCK_PROGRESS_REPORTS);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ProgressReportDraft>(EMPTY_DRAFT);

  const stats = useMemo(() => {
    const pending = reports.filter((report) => report.verificationStatus === 'Pending').length;
    const approved = reports.filter((report) => report.verificationStatus === 'Approved').length;
    const hours = reports.reduce((sum, report) => sum + report.hoursWorked, 0);

    return {
      total: reports.length,
      pending,
      approved,
      hours,
    };
  }, [reports]);

  const resetDraft = () => {
    setDraft({
      ...EMPTY_DRAFT,
      evidenceLinks: EMPTY_DRAFT.evidenceLinks.map((link) => ({ ...link })),
    });
  };

  const updateDraft = (field: keyof Omit<ProgressReportDraft, 'evidenceLinks'>, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateEvidence = (id: string, updates: Partial<ProgressEvidenceLink>) => {
    setDraft((current) => ({
      ...current,
      evidenceLinks: current.evidenceLinks.map((link) => (link.id === id ? { ...link, ...updates } : link)),
    }));
  };

  const addEvidenceLink = () => {
    setDraft((current) => ({
      ...current,
      evidenceLinks: [
        ...current.evidenceLinks,
        {
          id: `draft-evidence-${Date.now()}`,
          type: 'Commit',
          url: '',
          description: '',
        },
      ],
    }));
  };

  const removeEvidenceLink = (id: string) => {
    setDraft((current) => ({
      ...current,
      evidenceLinks:
        current.evidenceLinks.length > 1
          ? current.evidenceLinks.filter((link) => link.id !== id)
          : current.evidenceLinks,
    }));
  };

  const submitReport = () => {
    const nextReport: ProgressReport = {
      id: `progress-${Date.now()}`,
      projectName: draft.projectName.trim() || 'Untitled Research Project',
      reportingPeriod: draft.reportingPeriod.trim() || 'Current reporting period',
      hoursWorked: Number.parseFloat(draft.hoursWorked) || 0,
      tasksCompleted: draft.tasksCompleted.trim() || 'Tasks submitted for professor review.',
      resultsAchieved: draft.resultsAchieved.trim() || 'Results pending documentation.',
      challenges: draft.challenges.trim() || 'No blockers reported.',
      nextSteps: draft.nextSteps.trim() || 'Continue research work and update the professor.',
      skillsUsed: draft.skillsUsed
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean),
      evidenceLinks: draft.evidenceLinks
        .map((link) => ({
          ...link,
          url: link.url.trim(),
          description: link.description.trim(),
        }))
        .filter((link) => link.url || link.description),
      verificationStatus: 'Pending',
      submittedAt: new Date().toISOString(),
    };

    // TODO: POST nextReport to the backend when progress report persistence is available.
    setReports((current) => [nextReport, ...current]);
    resetDraft();
    setOpen(false);
  };

  const openForm = () => {
    resetDraft();
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#8f8f8f]">Verified Research Portfolio</p>
          <h2 className="text-2xl font-semibold text-[#111111]">Progress Reports</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#666666]">
            Document weekly and milestone-based research work, attach proof of contribution, and track professor verification.
          </p>
        </div>
        <Button className="rounded-xl bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={openForm}>
          <FilePlus2 className="mr-2 h-4 w-4" />
          Submit Progress Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Reports Submitted" value={stats.total} helper="Milestones documented" Icon={FileCheck2} />
        <StatCard label="Pending Verification" value={stats.pending} helper="Awaiting professor review" Icon={Clock} />
        <StatCard label="Approved Reports" value={stats.approved} helper="Portfolio-ready proof" Icon={ShieldCheck} />
        <StatCard label="Total Research Hours Logged" value={stats.hours} helper="Across all reports" Icon={Timer} />
      </div>

      {reports.length === 0 ? (
        <Card className="border-[#d0ceca] bg-white">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <FilePlus2 className="h-8 w-8" />
            </div>
            <div className="max-w-xl space-y-2">
              <h3 className="text-xl font-semibold text-[#111111]">You haven't submitted any progress reports yet.</h3>
              <p className="text-sm leading-6 text-[#666666]">
                Start documenting your research contributions to build a verified portfolio.
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
          {reports.map((report) => (
            <ReportTimelineCard key={report.id} report={report} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit Progress Report</DialogTitle>
            <DialogDescription>
              Add a weekly or milestone update with proof of your research contribution.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1 md:col-span-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Project</p>
                <Input
                  value={draft.projectName}
                  onChange={(event) => updateDraft('projectName', event.target.value)}
                  placeholder="Frame-Level Speech Recognition"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Reporting Period / Week</p>
                <Input
                  value={draft.reportingPeriod}
                  onChange={(event) => updateDraft('reportingPeriod', event.target.value)}
                  placeholder="Week of Feb 2, 2026"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Hours Worked</p>
                <Input
                  value={draft.hoursWorked}
                  onChange={(event) => updateDraft('hoursWorked', event.target.value)}
                  inputMode="decimal"
                  placeholder="8"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Tasks Completed</p>
                <Textarea
                  value={draft.tasksCompleted}
                  onChange={(event) => updateDraft('tasksCompleted', event.target.value)}
                  rows={4}
                  placeholder="What did you complete this period?"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Results Achieved</p>
                <Textarea
                  value={draft.resultsAchieved}
                  onChange={(event) => updateDraft('resultsAchieved', event.target.value)}
                  rows={4}
                  placeholder="What changed, improved, or became measurable?"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Challenges / Blockers</p>
                <Textarea
                  value={draft.challenges}
                  onChange={(event) => updateDraft('challenges', event.target.value)}
                  rows={4}
                  placeholder="What slowed progress or needs professor input?"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Next Steps</p>
                <Textarea
                  value={draft.nextSteps}
                  onChange={(event) => updateDraft('nextSteps', event.target.value)}
                  rows={4}
                  placeholder="What will you do next?"
                />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-[#8f8f8f]">Skills Used</p>
              <Input
                value={draft.skillsUsed}
                onChange={(event) => updateDraft('skillsUsed', event.target.value)}
                placeholder="Python, PyTorch, data cleaning, literature review"
              />
            </div>

            <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-red-900">Evidence Links</p>
                  <p className="text-xs text-red-800">Attach proof such as commits, papers, notebooks, datasets, or demo videos.</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="rounded-xl bg-white" onClick={addEvidenceLink}>
                  <Plus className="mr-1 h-4 w-4" />
                  Add Evidence
                </Button>
              </div>

              <div className="space-y-3">
                {draft.evidenceLinks.map((link) => (
                  <div key={link.id} className="grid gap-3 rounded-xl border border-red-100 bg-white p-3 md:grid-cols-[180px_1fr_auto]">
                    <Select
                      value={link.type}
                      onValueChange={(value) => updateEvidence(link.id, { type: value as ProgressEvidenceType })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Evidence type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROGRESS_EVIDENCE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="grid gap-2">
                      <Input
                        value={link.url}
                        onChange={(event) => updateEvidence(link.id, { url: event.target.value })}
                        placeholder="https://github.com/user/repo/commit/..."
                      />
                      <Input
                        value={link.description}
                        onChange={(event) => updateEvidence(link.id, { description: event.target.value })}
                        placeholder="Short description of what this proves"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 rounded-full text-[#777777] hover:bg-red-50 hover:text-red-700"
                      onClick={() => removeEvidenceLink(link.id)}
                      aria-label="Remove evidence link"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="rounded-xl" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button className="rounded-xl bg-[#c92e1f] text-white hover:bg-[#b3271b]" onClick={submitReport}>
                Submit for Verification
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
