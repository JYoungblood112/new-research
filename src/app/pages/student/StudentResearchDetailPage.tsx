import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { LogOut, ArrowLeft, ExternalLink } from 'lucide-react';
import ApplyToResearchDialog from '../../components/student/ApplyToResearchDialog';

const COMPENSATION_LABELS = {
  stipend: 'Stipend',
  volunteer: 'Volunteer',
  'course credit': 'Course Credit',
  tbd: 'To Be Determined',
} as const;

export default function StudentResearchDetailPage() {
  const { postingId } = useParams();
  const navigate = useNavigate();
  const { user, logout, setupState } = useAuth();
  const { postings } = useData();
  const [selectedPosting, setSelectedPosting] = useState<string | null>(null);

  const posting = useMemo(
    () => postings.find((p) => p.id === postingId && p.status === 'published') ?? null,
    [postings, postingId],
  );

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#eeecea]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl">Student Research Portal</h1>
            <p className="text-sm text-gray-500">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Button
          variant="outline"
          className="group mb-3 rounded-md border-[#d0ceca] bg-white px-3 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:border-[#bfbab4] hover:bg-[#f8f6f4] active:translate-y-0.5 active:bg-[#f2efec] focus-visible:ring-2 focus-visible:ring-red-700/25"
          onClick={() => navigate('/student/dashboard')}
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
          Back to Browse Research
        </Button>

        {!posting ? (
          <Card className="rounded-2xl border border-[#d0ceca] bg-white shadow-none">
            <CardContent className="py-10 text-center">
              <p className="text-gray-600">This research posting is no longer available.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl border border-[#d0ceca] bg-white shadow-none transition-all duration-200 hover:border-[#c1bdb7] hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)]">
            <CardHeader>
              <CardTitle className="text-[34px] leading-tight tracking-[-0.01em] text-foreground">{posting.title}</CardTitle>
              <CardDescription className="mt-1 text-[15px] text-muted-foreground">
                {posting.professorName} • {posting.professorDepartment}
                <span> • </span>
                <span className="ml-2 inline-flex rounded-full border border-red-700/20 bg-red-700/[0.06] px-2 py-0.5 text-[11px] text-red-800 transition-colors duration-150 hover:bg-red-700/[0.16]">
                  {posting.category}
                </span>
              </CardDescription>
              {posting.professorBioUrl ? (
                <a
                  href={posting.professorBioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-red-700 hover:text-red-800"
                >
                  View professor bio
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-0 text-sm">
              <div className="mb-0 rounded-lg border-b border-[#f0ece8] pb-4 transition-colors duration-150 hover:bg-[#faf6f3]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-red-700">Basics</p>
                <p className="text-[15px] leading-7 text-foreground/90">{posting.overview}</p>
                <p className="mt-2">
                  <span className="font-medium">Student Role:</span> {posting.studentRoleDescription}
                </p>
                <p>
                  <span className="font-medium">What You Gain:</span> {posting.studentGain}
                </p>
              </div>
              <div className="mb-0 rounded-lg border-b border-[#f0ece8] pb-4 pt-5 transition-colors duration-150 hover:bg-[#faf6f3]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-red-700">Qualifications</p>
                <p>
                  <span className="font-medium">Required:</span> {posting.requiredQualifications}
                </p>
                <p>
                  <span className="font-medium">Preferred:</span> {posting.preferredQualifications}
                </p>
                <p>
                  <span className="font-medium">Time Commitment:</span> {posting.timeCommitmentExpected}
                </p>
              </div>
              <div className="mb-0 rounded-lg border-b border-[#f0ece8] pb-4 pt-5 transition-colors duration-150 hover:bg-[#faf6f3]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-red-700">Timeline</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2.5">
                  <div className="rounded-md p-2 transition-colors duration-150 hover:bg-white/95">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start Date</p>
                    <p className="text-[13px] font-medium text-foreground">{new Date(posting.startDate).toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-md p-2 transition-colors duration-150 hover:bg-white/95">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">End Date</p>
                    <p className="text-[13px] font-medium text-foreground">{posting.duration}</p>
                  </div>
                  <div className="rounded-md p-2 transition-colors duration-150 hover:bg-white/95">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Application Deadline</p>
                    <p className="text-[13px] font-medium text-foreground">{new Date(posting.applicationDeadline).toLocaleDateString()}</p>
                  </div>
                  <div className="rounded-md p-2 transition-colors duration-150 hover:bg-white/95">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Compensation</p>
                    <p className="text-[13px] font-medium text-foreground">{COMPENSATION_LABELS[posting.compensation]}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg pt-5 transition-colors duration-150 hover:bg-[#faf6f3]">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-red-700">Application Questions</p>
                <ul className="list-inside list-disc space-y-1">
                  {posting.questions.map((question, index) => (
                    <li key={`${posting.id}-${index}`}>
                      {question.question}
                      {question.wordLimit ? ` (${question.wordLimit} words)` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-3 flex justify-end border-t border-[#e8e4e0] pt-5">
                <Button
                  onClick={() => setSelectedPosting(posting.id)}
                  className="rounded-md bg-[#c92e1f] px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:bg-[#b3271b] active:translate-y-0.5 active:shadow-sm active:bg-[#a92318] focus-visible:ring-2 focus-visible:ring-red-700/25"
                >
                  Apply →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {selectedPosting && (
        <ApplyToResearchDialog
          postingId={selectedPosting}
          open={!!selectedPosting}
          onOpenChange={(open) => !open && setSelectedPosting(null)}
        />
      )}
    </div>
  );
}
