import { useState } from 'react';
import { useData, type Application, type ResearchPosting } from '../../contexts/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { BookOpen, FileText, Mail, Calendar, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ViewApplicationsDialogProps {
  postingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatCourseworkEntry(course: Application['coursework'][number]) {
  if (typeof course === 'string') {
    return course.trim();
  }

  const courseNumber = course.courseNumber?.trim();
  const courseName = course.courseName?.trim();
  return [courseNumber, courseName].filter(Boolean).join(' - ');
}

export default function ViewApplicationsDialog({
  postingId,
  open,
  onOpenChange,
}: ViewApplicationsDialogProps) {
  const {
    postings,
    getApplicationsByPosting,
    updateApplicationStatus,
    applicationsLoading,
    applicationsError,
    refreshApplications,
  } = useData();
  const [updatingApplicationId, setUpdatingApplicationId] = useState<string | null>(null);
  const posting = postings.find((p) => p.id === postingId);
  const applications = getApplicationsByPosting(postingId);

  const pendingApps = applications.filter((a) => a.status === 'Pending');
  const shortlistedApps = applications.filter((a) => a.status === 'Shortlisted');
  const interviewApps = applications.filter((a) => a.status === 'Interview');
  const acceptedApps = applications.filter((a) => a.status === 'Accepted');
  const rejectedApps = applications.filter((a) => a.status === 'Rejected');

  const handleStatusChange = async (
    appId: string,
    status: 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted'
  ) => {
    setUpdatingApplicationId(appId);
    try {
      await updateApplicationStatus(appId, status);
      toast.success(`Application ${status}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to update application status.');
    } finally {
      setUpdatingApplicationId(null);
    }
  };

  if (!posting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{posting.title} - Applications</DialogTitle>
          <DialogDescription>
            {applications.length} total applications
          </DialogDescription>
        </DialogHeader>

        {applicationsLoading ? (
          <Card>
            <CardContent className="space-y-3 py-10">
              <div className="mx-auto h-4 w-44 animate-pulse rounded bg-[#efefef]" />
              <div className="mx-auto h-4 w-72 max-w-full animate-pulse rounded bg-[#f4f4f4]" />
            </CardContent>
          </Card>
        ) : applicationsError ? (
          <Card>
            <CardContent className="space-y-4 py-10 text-center">
              <div>
                <p className="font-medium text-[#111111]">Unable to load applications</p>
                <p className="mt-1 text-sm text-gray-500">{applicationsError}</p>
              </div>
              <Button variant="outline" onClick={() => void refreshApplications()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending">
              Pending ({pendingApps.length})
            </TabsTrigger>
            <TabsTrigger value="shortlisted">
              Shortlisted ({shortlistedApps.length})
            </TabsTrigger>
            <TabsTrigger value="interview">
              Interview ({interviewApps.length})
            </TabsTrigger>
            <TabsTrigger value="accepted">
              Accepted ({acceptedApps.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedApps.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pendingApps.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No pending applications</p>
            ) : (
              pendingApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  posting={posting}
                  onStatusChange={handleStatusChange}
                  updating={updatingApplicationId === app.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="shortlisted" className="space-y-3">
            {shortlistedApps.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No shortlisted applications</p>
            ) : (
              shortlistedApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  posting={posting}
                  onStatusChange={handleStatusChange}
                  updating={updatingApplicationId === app.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="interview" className="space-y-3">
            {interviewApps.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No interview-stage applications</p>
            ) : (
              interviewApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  posting={posting}
                  onStatusChange={handleStatusChange}
                  updating={updatingApplicationId === app.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="accepted" className="space-y-3">
            {acceptedApps.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No accepted applications</p>
            ) : (
              acceptedApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  posting={posting}
                  onStatusChange={handleStatusChange}
                  updating={updatingApplicationId === app.id}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-3">
            {rejectedApps.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No rejected applications</p>
            ) : (
              rejectedApps.map((app) => (
                <ApplicationCard
                  key={app.id}
                  application={app}
                  posting={posting}
                  onStatusChange={handleStatusChange}
                  updating={updatingApplicationId === app.id}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ApplicationCard({
  application,
  posting,
  onStatusChange,
  updating,
}: {
  application: Application;
  posting: ResearchPosting;
  onStatusChange: (
    id: string,
    status: 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted'
  ) => void | Promise<void>;
  updating: boolean;
}) {
  const statusConfig = {
    Pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    Shortlisted: { color: 'bg-blue-100 text-blue-800', icon: UserCheck },
    Interview: { color: 'bg-indigo-100 text-indigo-800', icon: FileText },
    Accepted: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    Rejected: { color: 'bg-red-100 text-red-800', icon: XCircle },
  };

  const config = statusConfig[application.status];
  const StatusIcon = config.icon;

  const nextStatusesByCurrent = {
    Pending: ['Shortlisted', 'Rejected'],
    Shortlisted: ['Interview', 'Rejected'],
    Interview: ['Accepted', 'Rejected'],
    Accepted: [],
    Rejected: [],
  } as const;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{application.studentName}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <Mail className="w-3 h-3" />
              {application.studentEmail}
            </div>
          </div>
          <Badge className={config.color}>
            <StatusIcon className="w-3 h-3 mr-1" />
            {application.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-3 text-xs text-gray-600 bg-gray-50 rounded p-2">
          <span>Applicant: {application.studentName}</span>
          <span>Major: {application.studentMajor}</span>
          <span>Submitted: {new Date(application.submittedAt).toLocaleDateString()}</span>
          <span>Status: {application.status}</span>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Calendar className="w-3 h-3" />
          Submitted: {new Date(application.submittedAt).toLocaleDateString()}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-sm">Resume</span>
          </div>
          <p className="text-sm text-gray-600">{application.resume.name}</p>
        </div>

        {application.quickNote && (
          <div>
            <p className="text-sm mb-1">Quick note from applicant:</p>
            <p className="text-sm bg-gray-50 p-3 rounded">{application.quickNote}</p>
          </div>
        )}

        {application.coursework.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4" />
              Coursework from profile:
            </p>
            <div className="flex flex-wrap gap-2">
              {application.coursework.slice(0, 12).map((course, index) => {
                const label = formatCourseworkEntry(course);
                return label ? (
                  <Badge key={`${label}-${index}`} variant="secondary" className="rounded-full bg-gray-50 text-gray-700">
                    {label}
                  </Badge>
                ) : null;
              })}
              {application.coursework.length > 12 ? (
                <Badge variant="outline" className="rounded-full">
                  +{application.coursework.length - 12} more
                </Badge>
              ) : null}
            </div>
          </div>
        )}

        {application.answers && Object.keys(application.answers).length > 0 && (
          <div>
            <p className="text-sm mb-2">Responses to questions:</p>
            <div className="space-y-2">
              {Object.entries(application.answers).map(([question, answer]) => (
                <div key={question} className="bg-gray-50 p-3 rounded space-y-1">
                  <p className="text-sm">{question}</p>
                  <p className="text-sm text-gray-600">{answer as string}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {nextStatusesByCurrent[application.status].map((nextStatus) => (
            <Button
              key={nextStatus}
              variant={nextStatus === 'Rejected' ? 'destructive' : 'outline'}
              size="sm"
              disabled={updating}
              onClick={() => onStatusChange(application.id, nextStatus)}
            >
              {updating ? 'Updating...' : nextStatus}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
