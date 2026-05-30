import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { getStudentInterestCounts } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PlusCircle, LogOut, Eye, Users } from 'lucide-react';
import { useNavigate } from 'react-router';
import PostResearchDialog from '../../components/professor/PostResearchDialog';
import ViewApplicationsDialog from '../../components/professor/ViewApplicationsDialog';

export default function ProfessorDashboard() {
  const { user, logout } = useAuth();
  const { getPostingsByProfessor } = useData();
  const navigate = useNavigate();
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(null);
  const [editingPosting, setEditingPosting] = useState<any | null>(null);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});

  const myPostings = getPostingsByProfessor(user!.id);
  const publishedPostings = myPostings.filter((p) => p.status === 'published');
  const pendingApprovalPostings = myPostings.filter((p) => p.status === 'pending_approval');
  const closedPostings = myPostings.filter((p) => p.status === 'closed');

  useEffect(() => {
    let cancelled = false;

    void getStudentInterestCounts()
      .then((payload) => {
        if (!cancelled) {
          setInterestCounts(payload.counts ?? {});
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInterestCounts({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleViewApplications = (postingId: string) => {
    setSelectedPostingId(postingId);
  };

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <header className="border-b border-[#e6dfdc] bg-[linear-gradient(120deg,#fffdfa_0%,#fff7f5_45%,#f8f7fb_100%)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b7f79]">Professor Workspace</p>
            <h1 className="text-[2rem] font-semibold leading-none tracking-tight text-[#111111]">Professor Dashboard</h1>
            <p className="text-sm text-[#5f6f84]">Signed in as {user?.name}</p>
          </div>
          <Button
            variant="ghost"
            className="rounded-xl border border-[#dedede] bg-white px-4 text-[#1c1c1c] hover:bg-[#f7f7f7]"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-7">
        <Tabs defaultValue="postings" className="space-y-4">
          <TabsList className="h-auto rounded-2xl border border-[#dddddd] bg-white p-1.5">
            <TabsTrigger
              value="postings"
              className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
            >
              My Postings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="postings" className="space-y-4">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-[#111111]">My Research Postings</h2>
                <p className="text-sm text-[#6f6f6f]">Manage your research opportunities</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
                  onClick={() => navigate('/professor/profile')}
                >
                  Edit Profile
                </Button>
                <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => setShowPostDialog(true)}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Post New Research
                </Button>
              </div>
            </div>

            <Tabs defaultValue="open" className="space-y-4">
              <TabsList className="h-auto rounded-2xl border border-[#dddddd] bg-white p-1.5">
                <TabsTrigger
                  value="open"
                  className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                >
                  Published ({publishedPostings.length})
                </TabsTrigger>
                <TabsTrigger
                  value="approval"
                  className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                >
                  Pending Approval ({pendingApprovalPostings.length})
                </TabsTrigger>
                <TabsTrigger
                  value="closed"
                  className="rounded-xl border border-transparent bg-transparent px-4 py-2 text-[#666666] data-[state=active]:border-red-200 data-[state=active]:bg-red-50 data-[state=active]:text-red-800 data-[state=active]:shadow-none"
                >
                  Closed ({closedPostings.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="open" className="space-y-4">
            {publishedPostings.length === 0 ? (
              <Card className="border-[#d0ceca]">
                <CardContent className="py-12 text-center">
                  <p className="text-[#6f6f6f]">No published postings yet.</p>
                </CardContent>
              </Card>
            ) : (
              publishedPostings.map((posting) => (
                <PostingCard
                  key={posting.id}
                  posting={posting}
                  interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
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
                  <Card className="border-[#d0ceca]">
                    <CardContent className="py-12 text-center">
                      <p className="text-[#6f6f6f]">No postings awaiting approval</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingApprovalPostings.map((posting) => (
                    <PostingCard
                      key={posting.id}
                      posting={posting}
                      interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
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
                  <Card className="border-[#d0ceca]">
                    <CardContent className="py-12 text-center">
                      <p className="text-[#6f6f6f]">No closed postings</p>
                    </CardContent>
                  </Card>
                ) : (
                  closedPostings.map((posting) => (
                    <PostingCard
                      key={posting.id}
                      posting={posting}
                      interestedCount={interestCounts[normalizeInterestKey(posting.category)] ?? 0}
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

function normalizeInterestKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function PostingCard({
  posting,
  interestedCount,
  onViewApplications,
  onEditPosting,
}: {
  posting: any;
  interestedCount: number;
  onViewApplications: (id: string) => void;
  onEditPosting: (posting: any) => void;
}) {
  const { getApplicationsByPosting } = useData();
  const applications = getApplicationsByPosting(posting.id);
  const pendingCount = applications.filter((a) => a.status === 'Pending').length;
  const statusClassName =
    posting.status === 'published'
      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
      : posting.status === 'pending_approval'
        ? 'border border-amber-200 bg-amber-50 text-amber-700'
        : 'border border-[#d8d8d8] bg-[#f7f7f7] text-[#575757]';

  return (
    <Card className="border-[#d0ceca] transition-shadow hover:shadow-md">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-[#111111]">{posting.title}</CardTitle>
            <CardDescription>{posting.category} • {posting.professorDepartment}</CardDescription>
          </div>
          <Badge className={statusClassName}>
            {posting.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="line-clamp-2 text-sm text-[#333333]">{posting.overview}</p>
          <div className="flex gap-4 text-sm text-[#6f6f6f]">
            <span>End Date: {posting.duration}</span>
            <span>Commitment: {posting.timeCommitmentExpected}</span>
          </div>
          <div className="flex gap-4 text-sm text-[#6f6f6f]">
            <span>Deadline: {new Date(posting.applicationDeadline).toLocaleDateString()}</span>
            <span>Applications: {applications.length}</span>
            <span>Compensation: {posting.compensation}</span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-4 h-4" />
              Potential interest: {interestedCount}
            </span>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {pendingCount} new
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => onViewApplications(posting.id)}
              variant="outline"
              size="sm"
              className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Applications
            </Button>
            <Button
              onClick={() => onEditPosting(posting)}
              variant="outline"
              size="sm"
              className="rounded-xl border-[#d8d8d8] bg-white text-[#575757] hover:bg-[#f7f7f7] hover:text-[#111111]"
            >
              Edit Posting
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
