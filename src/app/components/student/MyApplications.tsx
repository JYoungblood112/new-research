import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BookOpen, Calendar, CheckCircle, Clock, FileText, Inbox, XCircle } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState, PageHeader, SkillChip, StatusBadge } from '../ui/dashboard';

const STATUS_CONFIG = {
  Pending: {
    label: 'Pending',
    status: 'pending',
    icon: Clock,
    description: 'Your application is waiting to be reviewed',
  },
  Shortlisted: {
    label: 'Shortlisted',
    status: 'info',
    icon: FileText,
    description: 'You have been shortlisted by the professor',
  },
  Interview: {
    label: 'Interview',
    status: 'info',
    icon: Calendar,
    description: 'Interview stage in progress',
  },
  Accepted: {
    label: 'Accepted',
    status: 'approved',
    icon: CheckCircle,
    description: 'Congratulations! Your application was accepted',
  },
  Rejected: {
    label: 'Rejected',
    status: 'rejected',
    icon: XCircle,
    description: 'Your application was not selected for this position',
  },
} as const;

function formatCourseworkEntry(course: string | { courseNumber?: string; courseName?: string; semester?: string }) {
  if (typeof course === 'string') {
    return course.trim();
  }

  const courseNumber = course.courseNumber?.trim();
  const courseName = course.courseName?.trim();
  return [courseNumber, courseName].filter(Boolean).join(' - ');
}

export default function MyApplications() {
  const { user } = useAuth();
  const { getApplicationsByStudent, postings, applicationsLoading, applicationsError, refreshApplications } = useData();
  const applications = getApplicationsByStudent(user?.id ?? '');

  if (applicationsLoading) {
    return <LoadingState label="Loading your applications..." />;
  }

  if (applicationsError) {
    return (
      <ErrorState
        title="Unable to load applications"
        description={applicationsError}
        action={
          <Button variant="outline" onClick={() => void refreshApplications()}>
            Try again
          </Button>
        }
      />
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No applications yet"
        description="Browse the research tab to find opportunities and track each submission here after you apply."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Application Tracker"
        title="My Applications"
        description={`${applications.length} total application${applications.length === 1 ? '' : 's'} across your research search.`}
      />

      <div className="space-y-4">
        {applications.map((application) => {
          const posting = postings.find((p) => p.id === application.postingId);
          if (!posting) return null;

          const statusConfig = STATUS_CONFIG[application.status];
          const StatusIcon = statusConfig.icon;

          return (
            <Card key={application.id} className="dashboard-surface rounded-2xl">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle>{posting.title}</CardTitle>
                    <CardDescription>
                      {posting.professorName} • {posting.professorDepartment}
                    </CardDescription>
                  </div>
                  <StatusBadge status={statusConfig.status} label={statusConfig.label} icon={StatusIcon} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-[#555555]">{statusConfig.description}</p>

                <div className="grid gap-2 rounded-xl border border-[#ececec] bg-[#fafafa] p-3 text-sm text-[#666666] md:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Applied: {new Date(application.submittedAt).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {application.resume.name}
                  </div>
                  <div className="flex items-center gap-2">
                    Major: {application.studentMajor}
                  </div>
                </div>

                {application.quickNote && (
                  <div className="rounded-xl border border-[#ececec] bg-white p-3">
                    <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-[#777777]">Quick note</p>
                    <p className="text-sm leading-6 text-[#333333]">{application.quickNote}</p>
                  </div>
                )}

                {application.coursework.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-2 text-xs text-gray-500">
                      <BookOpen className="h-3 w-3" />
                      Coursework included:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {application.coursework.slice(0, 10).map((course, index) => {
                        const label = formatCourseworkEntry(course);
                        return label ? (
                          <SkillChip key={`${label}-${index}`}>{label}</SkillChip>
                        ) : null;
                      })}
                      {application.coursework.length > 10 ? (
                        <Badge variant="outline" className="rounded-full">
                          +{application.coursework.length - 10} more
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                )}

                {application.answers && Object.keys(application.answers).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Your responses:</p>
                    {Object.entries(application.answers).map(([question, answer]) => (
                      <div key={question} className="space-y-1 rounded-xl border border-[#ececec] bg-[#fafafa] p-3">
                        <p className="text-xs font-medium text-[#666666]">{question}</p>
                        <p className="text-sm leading-6 text-[#333333]">{answer as string}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
