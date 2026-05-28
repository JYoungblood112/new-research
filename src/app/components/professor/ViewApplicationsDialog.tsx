import { useData } from '../../contexts/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { FileText, Mail, Calendar, CheckCircle, XCircle, Clock, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface ViewApplicationsDialogProps {
  postingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ViewApplicationsDialog({
  postingId,
  open,
  onOpenChange,
}: ViewApplicationsDialogProps) {
  const { postings, getApplicationsByPosting, updateApplicationStatus } = useData();
  const posting = postings.find((p) => p.id === postingId);
  const applications = getApplicationsByPosting(postingId);

  const pendingApps = applications.filter((a) => a.status === 'Pending');
  const shortlistedApps = applications.filter((a) => a.status === 'Shortlisted');
  const interviewApps = applications.filter((a) => a.status === 'Interview');
  const acceptedApps = applications.filter((a) => a.status === 'Accepted');
  const rejectedApps = applications.filter((a) => a.status === 'Rejected');

  const handleStatusChange = (
    appId: string,
    status: 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted'
  ) => {
    updateApplicationStatus(appId, status);
    toast.success(`Application ${status}`);
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
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function ApplicationCard({
  application,
  posting,
  onStatusChange,
}: {
  application: any;
  posting: any;
  onStatusChange: (
    id: string,
    status: 'Pending' | 'Shortlisted' | 'Interview' | 'Rejected' | 'Accepted'
  ) => void;
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
              onClick={() => onStatusChange(application.id, nextStatus)}
            >
              {nextStatus}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
