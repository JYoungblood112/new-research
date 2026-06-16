import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { BookOpen, Calendar, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

const STATUS_CONFIG = {
  Pending: {
    label: 'Pending',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
    description: 'Your application is waiting to be reviewed',
  },
  Shortlisted: {
    label: 'Shortlisted',
    color: 'bg-blue-100 text-blue-800',
    icon: FileText,
    description: 'You have been shortlisted by the professor',
  },
  Interview: {
    label: 'Interview',
    color: 'bg-indigo-100 text-indigo-800',
    icon: Calendar,
    description: 'Interview stage in progress',
  },
  Accepted: {
    label: 'Accepted',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
    description: 'Congratulations! Your application was accepted',
  },
  Rejected: {
    label: 'Rejected',
    color: 'bg-red-100 text-red-800',
    icon: XCircle,
    description: 'Your application was not selected for this position',
  },
};

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
    return (
      <Card>
        <CardContent className="space-y-3 py-12">
          <div className="mx-auto h-4 w-44 animate-pulse rounded bg-[#efefef]" />
          <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-[#f4f4f4]" />
        </CardContent>
      </Card>
    );
  }

  if (applicationsError) {
    return (
      <Card>
        <CardContent className="space-y-4 py-12 text-center">
          <div>
            <p className="font-medium text-[#111111]">Unable to load applications</p>
            <p className="mt-1 text-sm text-gray-500">{applicationsError}</p>
          </div>
          <Button variant="outline" onClick={() => void refreshApplications()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">You haven't applied to any research opportunities yet.</p>
          <p className="text-sm text-gray-400 mt-2">
            Browse the research tab to find opportunities!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl">My Applications</h2>
          <p className="text-sm text-gray-500">{applications.length} total applications</p>
        </div>
      </div>

      <div className="space-y-4">
        {applications.map((application) => {
          const posting = postings.find((p) => p.id === application.postingId);
          if (!posting) return null;

          const statusConfig = STATUS_CONFIG[application.status];
          const StatusIcon = statusConfig.icon;

          return (
            <Card key={application.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <CardTitle>{posting.title}</CardTitle>
                    <CardDescription>
                      {posting.professorName} • {posting.professorDepartment}
                    </CardDescription>
                  </div>
                  <Badge className={statusConfig.color}>
                    <StatusIcon className="w-3 h-3 mr-1" />
                    {statusConfig.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-600">{statusConfig.description}</p>

                <div className="flex gap-4 text-sm text-gray-500">
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
                  <div className="bg-gray-50 p-3 rounded">
                    <p className="text-xs text-gray-500 mb-1">Quick note:</p>
                    <p className="text-sm">{application.quickNote}</p>
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
                          <Badge key={`${label}-${index}`} variant="secondary" className="rounded-full bg-gray-50 text-gray-700">
                            {label}
                          </Badge>
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
                      <div key={question} className="bg-gray-50 p-3 rounded space-y-1">
                        <p className="text-xs text-gray-500">{question}</p>
                        <p className="text-sm">{answer as string}</p>
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
