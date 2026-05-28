import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Calendar, CheckCircle, Clock, XCircle, FileText } from 'lucide-react';

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

export default function MyApplications() {
  const { user } = useAuth();
  const { getApplicationsByStudent, postings } = useData();
  const applications = getApplicationsByStudent(user!.id);

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
