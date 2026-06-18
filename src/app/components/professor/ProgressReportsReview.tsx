import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  FileCheck2,
  FileText,
  Link as LinkIcon,
  MessageSquare,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { useData, type ProgressReport, type ProgressReportEvidence } from '../../contexts/DataContext';
import type { ProgressEvidenceType, ProgressReportStatus } from '../../lib/database.types';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Textarea } from '../ui/textarea';

const EVIDENCE_LABELS: Record<ProgressEvidenceType, string> = {
  github_repo: 'GitHub Repo',
  commit: 'Commit',
  pull_request: 'Pull Request',
  website: 'Website',
  paper: 'Paper',
  dataset: 'Dataset',
  notebook: 'Notebook',
  presentation: 'Presentation',
  poster: 'Poster',
  demo_video: 'Demo Video',
  research_report: 'Research Report',
  other: 'Other',
};

const STATUS_CONFIG: Record<ProgressReportStatus, { label: string; className: string; Icon: typeof Clock }> = {
  pending_approval: {
    label: 'Pending Approval',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Clock,
  },
  approved: {
    label: 'Approved',
    className: 'border-green-200 bg-green-50 text-green-800',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rejected',
    className: 'border-red-200 bg-red-50 text-red-800',
    Icon: XCircle,
  },
};

function StatusBadge({ status }: { status: ProgressReportStatus }) {
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.Icon;

  return (
    <Badge className={`rounded-full border px-3 py-1 text-xs ${config.className}`}>
      <StatusIcon className="mr-1 h-3.5 w-3.5" />
      {config.label}
    </Badge>
  );
}

function formatBytes(value?: number) {
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function EvidenceLinks({
  evidence,
  openFile,
}: {
  evidence: ProgressReportEvidence[];
  openFile: (filePath: string) => Promise<void>;
}) {
  if (evidence.length === 0) {
    return <p className="text-sm text-[#777777]">No evidence attached.</p>;
  }

  return (
    <div className="grid gap-2">
      {evidence.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-[#e6e2dc] bg-white p-3 text-sm transition-colors hover:border-[#c92e1f]/40 hover:bg-red-50/40"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[#111111]">{item.title}</p>
              <p className="text-xs text-[#777777]">{EVIDENCE_LABELS[item.type]}</p>
            </div>
            {item.externalUrl ? (
              <Button asChild variant="outline" size="sm" className="rounded-xl">
                <a href={item.externalUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-4 w-4" />
                  Open Link
                </a>
              </Button>
            ) : item.filePath ? (
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void openFile(item.filePath!)}>
                <FileText className="mr-1 h-4 w-4" />
                View File
              </Button>
            ) : null}
          </div>
          <p className="mt-1 text-xs leading-5 text-[#555555]">{item.description || item.externalUrl || item.fileName}</p>
          {item.fileName ? (
            <p className="mt-1 text-xs text-[#777777]">
              {item.fileName}
              {item.fileType ? ` | ${item.fileType}` : ''}
              {item.fileSize ? ` | ${formatBytes(item.fileSize)}` : ''}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function MetricCard({
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
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#8f8f8f]">{label}</p>
          <p className="text-2xl font-semibold text-[#111111]">{value}</p>
          <p className="text-xs text-[#666666]">{helper}</p>
        </div>
        <div className="rounded-xl border border-red-100 bg-red-50 p-2 text-red-700">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DetailBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#e8e5df] bg-[#fbfaf8] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#333333]">{value || 'Not provided.'}</p>
    </div>
  );
}

export default function ProgressReportsReview() {
  const { user } = useAuth();
  const {
    progressReportsLoading,
    progressReportsError,
    refreshProgressReports,
    reviewProgressReport,
    openProgressReportEvidenceFile,
    getProgressReportsByProfessor,
  } = useData();
  const [selectedReport, setSelectedReport] = useState<ProgressReport | null>(null);
  const [comment, setComment] = useState('');
  const [savingAction, setSavingAction] = useState<ProgressReportStatus | null>(null);

  const reports = useMemo(() => {
    if (!user) {
      return [];
    }

    return getProgressReportsByProfessor(user.id).sort((left, right) => {
      if (left.status !== right.status) {
        if (left.status === 'pending_approval') return -1;
        if (right.status === 'pending_approval') return 1;
      }
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [getProgressReportsByProfessor, user, progressReportsLoading]);

  const metrics = useMemo(() => {
    return {
      total: reports.length,
      pending: reports.filter((report) => report.status === 'pending_approval').length,
      approved: reports.filter((report) => report.status === 'approved').length,
      rejected: reports.filter((report) => report.status === 'rejected').length,
      hours: reports.reduce((sum, report) => sum + report.hoursWorked, 0),
    };
  }, [reports]);

  const openDetails = (report: ProgressReport) => {
    setSelectedReport(report);
    setComment(report.professorComment ?? '');
  };

  const reviewReport = async (status: ProgressReportStatus) => {
    if (!selectedReport) {
      return;
    }

    if (status === 'rejected' && !comment.trim()) {
      toast.error('Add a comment before rejecting a progress report.');
      return;
    }

    setSavingAction(status);
    try {
      const updated = await reviewProgressReport(selectedReport.id, status, comment);
      setSelectedReport(updated);
      toast.success(status === 'approved' ? 'Progress report approved.' : 'Progress report rejected.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to review progress report.');
    } finally {
      setSavingAction(null);
    }
  };

  const openFile = async (filePath: string) => {
    try {
      const signedUrl = await openProgressReportEvidenceFile(filePath);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to open evidence file.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f8f8f]">Student Progress Reports</p>
          <h2 className="text-2xl font-semibold text-[#111111]">Review submitted research work</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[#666666]">
            Approve verified work, reject reports that need changes, and keep a reviewed record of student research hours.
          </p>
        </div>
        <Button variant="outline" className="rounded-xl" onClick={() => void refreshProgressReports()}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Total Reports" value={metrics.total} helper="Submitted by students" Icon={FileCheck2} />
        <MetricCard label="Pending Approval" value={metrics.pending} helper="Review first" Icon={Clock} />
        <MetricCard label="Approved" value={metrics.approved} helper="Verified reports" Icon={CheckCircle2} />
        <MetricCard label="Rejected" value={metrics.rejected} helper="Needs changes" Icon={XCircle} />
        <MetricCard label="Research Hours" value={metrics.hours} helper="Logged total" Icon={Timer} />
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

      {progressReportsLoading ? (
        <Card className="dashboard-surface rounded-2xl">
          <CardContent className="py-12 text-center text-sm text-[#666666]">Loading progress reports...</CardContent>
        </Card>
      ) : reports.length === 0 ? (
        <Card className="dashboard-surface rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
              <FileCheck2 className="h-8 w-8" />
            </div>
            <div className="max-w-xl space-y-2">
              <h3 className="text-xl font-semibold text-[#111111]">No student progress reports yet.</h3>
              <p className="text-sm leading-6 text-[#666666]">
                Reports submitted for your research projects will appear here for approval.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card
              key={report.id}
              className={`dashboard-surface rounded-2xl ${
                report.status === 'pending_approval' ? 'ring-1 ring-amber-100' : ''
              }`}
            >
              <CardHeader className="space-y-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{report.projectTitle}</CardTitle>
                    <CardDescription>
                      {report.studentName} | {report.reportingPeriod} | Submitted {new Date(report.createdAt).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <StatusBadge status={report.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-[130px_1fr]">
                  <div className="rounded-xl border border-[#ece8e0] bg-[#fbfaf8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">Hours</p>
                    <p className="mt-1 text-2xl font-semibold text-[#111111]">{report.hoursWorked}</p>
                  </div>
                  <div className="rounded-xl border border-[#ece8e0] bg-[#fbfaf8] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">Tasks Completed</p>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-[#333333]">{report.tasksCompleted}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {report.evidence.slice(0, 3).map((item) => (
                    <Badge key={item.id} variant="secondary" className="rounded-full bg-[#f3f1ed] text-[#555555]">
                      <LinkIcon className="mr-1 h-3.5 w-3.5" />
                      {EVIDENCE_LABELS[item.type]}
                    </Badge>
                  ))}
                  {report.evidence.length > 3 ? (
                    <Badge variant="secondary" className="rounded-full bg-[#f3f1ed] text-[#555555]">
                      +{report.evidence.length - 3} more
                    </Badge>
                  ) : null}
                </div>

                {report.professorComment ? (
                  <div className="rounded-xl border border-[#e6e2dc] bg-[#fbfaf8] p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-[#333333]">
                      <MessageSquare className="h-4 w-4" />
                      Professor Comment
                    </p>
                    <p className="mt-1 text-sm leading-6 text-[#555555]">{report.professorComment}</p>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => openDetails(report)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  {report.status === 'pending_approval' ? (
                    <>
                      <Button className="rounded-xl bg-green-700 text-white hover:bg-green-800" onClick={() => openDetails(report)}>
                        Review
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selectedReport ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedReport.projectTitle}</DialogTitle>
                <DialogDescription>
                  {selectedReport.studentName} | {selectedReport.reportingPeriod} | {selectedReport.hoursWorked} hours
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StatusBadge status={selectedReport.status} />
                  {selectedReport.reviewedAt ? (
                    <p className="text-xs text-[#777777]">Reviewed {new Date(selectedReport.reviewedAt).toLocaleDateString()}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <DetailBlock title="Tasks Completed" value={selectedReport.tasksCompleted} />
                  <DetailBlock title="Results Achieved" value={selectedReport.resultsAchieved} />
                  <DetailBlock title="Challenges / Blockers" value={selectedReport.challenges} />
                  <DetailBlock title="Next Steps" value={selectedReport.nextSteps} />
                </div>

                <div className="rounded-xl border border-[#e8e5df] bg-[#fbfaf8] p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">Skills Used</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedReport.skillsUsed.length > 0 ? (
                      selectedReport.skillsUsed.map((skill) => (
                        <Badge key={skill} variant="secondary" className="rounded-full bg-white text-[#555555]">
                          {skill}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-[#777777]">No skills listed.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[#e8e5df] bg-[#fbfaf8] p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111111]">
                    <LinkIcon className="h-4 w-4" />
                    Evidence
                  </p>
                  <EvidenceLinks evidence={selectedReport.evidence} openFile={openFile} />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f8f8f]">Professor Comment</p>
                  <Textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    rows={4}
                    placeholder="Add feedback for the student."
                  />
                </div>

                <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" className="rounded-xl" onClick={() => setSelectedReport(null)} disabled={Boolean(savingAction)}>
                    Close
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => void reviewReport('rejected')}
                    disabled={Boolean(savingAction)}
                  >
                    {savingAction === 'rejected' ? 'Rejecting...' : 'Reject / Request Changes'}
                  </Button>
                  <Button
                    className="rounded-xl bg-green-700 text-white hover:bg-green-800"
                    onClick={() => void reviewReport('approved')}
                    disabled={Boolean(savingAction)}
                  >
                    {savingAction === 'approved' ? 'Approving...' : 'Approve'}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
