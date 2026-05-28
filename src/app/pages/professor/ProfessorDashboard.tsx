import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PlusCircle, LogOut, Eye } from 'lucide-react';
import { useNavigate } from 'react-router';
import PostResearchDialog from '../../components/professor/PostResearchDialog';
import ViewApplicationsDialog from '../../components/professor/ViewApplicationsDialog';

export default function ProfessorDashboard() {
  const { user, logout, setupState, updateProfessorProfile } = useAuth();
  const { getPostingsByProfessor } = useData();
  const navigate = useNavigate();
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [editingPosting, setEditingPosting] = useState<any | null>(null);
  const professorProfile = (setupState?.profile as
    | { department?: string; title?: string; contactEmail?: string; officeHours?: string }
    | undefined) ?? { contactEmail: user?.email };
  const [department, setDepartment] = useState(professorProfile.department ?? '');
  const [title, setTitle] = useState(professorProfile.title ?? '');
  const [contactEmail, setContactEmail] = useState(professorProfile.contactEmail ?? user?.email ?? '');
  const [officeHours, setOfficeHours] = useState(professorProfile.officeHours ?? '');

  const myPostings = getPostingsByProfessor(user!.id);
  const publishedPostings = myPostings.filter((p) => p.status === 'published');
  const pendingApprovalPostings = myPostings.filter((p) => p.status === 'pending_approval');
  const closedPostings = myPostings.filter((p) => p.status === 'closed');

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const setupIncomplete = !setupState?.completed;

  const handleViewApplications = (postingId: string) => {
    setSelectedPostingId(postingId);
  };

  const handleSaveSetup = async () => {
    await updateProfessorProfile({
      department,
      title,
      contactEmail,
      officeHours,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl">Professor Dashboard</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {setupIncomplete && (
          <Card className="mb-6 border-yellow-300 bg-yellow-50">
            <CardHeader>
              <CardTitle>Complete Professor Setup</CardTitle>
              <CardDescription>
                Required before creating project postings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Department</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Contact Email</Label>
                  <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Office Hours</Label>
                  <Input value={officeHours} onChange={(e) => setOfficeHours(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveSetup}>Save Setup</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="postings" className="space-y-4">
          <TabsList>
            <TabsTrigger value="postings">My Postings</TabsTrigger>
          </TabsList>

          <TabsContent value="postings" className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl">My Research Postings</h2>
                <p className="text-sm text-gray-500">Manage your research opportunities</p>
              </div>
              <Button onClick={() => setShowPostDialog(true)} disabled={setupIncomplete}>
                <PlusCircle className="w-4 h-4 mr-2" />
                Post New Research
              </Button>
            </div>

            <Tabs defaultValue="open" className="space-y-4">
              <TabsList>
                <TabsTrigger value="open">Published ({publishedPostings.length})</TabsTrigger>
                <TabsTrigger value="approval">Pending Approval ({pendingApprovalPostings.length})</TabsTrigger>
                <TabsTrigger value="closed">Closed ({closedPostings.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="space-y-4">
            {publishedPostings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">No published postings yet.</p>
                </CardContent>
              </Card>
            ) : (
              publishedPostings.map((posting) => (
                <PostingCard
                  key={posting.id}
                  posting={posting}
                  onViewApplications={handleViewApplications}
                  onEditPosting={(nextPosting) => {
                    setEditingPosting(nextPosting);
                    setShowPostDialog(true);
                  }}
                />
              ))
            )}
          </TabsContent>

              <TabsContent value="approval" className="space-y-4">
                {pendingApprovalPostings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500">No postings awaiting approval</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingApprovalPostings.map((posting) => (
                    <PostingCard
                      key={posting.id}
                      posting={posting}
                      onViewApplications={handleViewApplications}
                      onEditPosting={(nextPosting) => {
                        setEditingPosting(nextPosting);
                        setShowPostDialog(true);
                      }}
                    />
                  ))
                )}
              </TabsContent>

              <TabsContent value="closed" className="space-y-4">
                {closedPostings.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500">No closed postings</p>
                    </CardContent>
                  </Card>
                ) : (
                  closedPostings.map((posting) => (
                    <PostingCard
                      key={posting.id}
                      posting={posting}
                      onViewApplications={handleViewApplications}
                      onEditPosting={(nextPosting) => {
                        setEditingPosting(nextPosting);
                        setShowPostDialog(true);
                      }}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

        </Tabs>
      </main>

      <PostResearchDialog
        open={showPostDialog}
        onOpenChange={(open) => {
          setShowPostDialog(open);
          if (!open) {
            setEditingPosting(null);
          }
        }}
        postingToEdit={editingPosting}
      />

      {selectedPostingId && (
        <ViewApplicationsDialog
          postingId={selectedPostingId}
          open={!!selectedPostingId}
          onOpenChange={(open) => !open && setSelectedPostingId(null)}
        />
      )}
    </div>
  );
}

function PostingCard({
  posting,
  onViewApplications,
  onEditPosting,
}: {
  posting: any;
  onViewApplications: (id: string) => void;
  onEditPosting: (posting: any) => void;
}) {
  const { getApplicationsByPosting } = useData();
  const applications = getApplicationsByPosting(posting.id);
  const pendingCount = applications.filter((a) => a.status === 'Pending').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle>{posting.title}</CardTitle>
            <CardDescription>{posting.category} • {posting.professorDepartment}</CardDescription>
          </div>
          <Badge variant={posting.status === 'published' ? 'default' : 'secondary'}>
            {posting.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm line-clamp-2">{posting.overview}</p>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>Duration: {posting.duration}</span>
            <span>Commitment: {posting.timeCommitmentExpected}</span>
          </div>
          <div className="flex gap-4 text-sm text-gray-600">
            <span>Deadline: {new Date(posting.applicationDeadline).toLocaleDateString()}</span>
            <span>Applications: {applications.length}</span>
            <span>Compensation: {posting.compensation}</span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingCount} new
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => onViewApplications(posting.id)} variant="outline" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View Applications
            </Button>
            <Button onClick={() => onEditPosting(posting)} variant="outline" size="sm">
              Edit Posting
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
