import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Github,
  GraduationCap,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { recruiterCandidates } from '../../mock/recruiterDashboard';
import { generateRecruiterCandidateSummary } from '../../lib/api';

function scoreClass(score: number) {
  if (score >= 90) return 'text-emerald-700';
  if (score >= 80) return 'text-blue-700';
  return 'text-amber-700';
}

export default function CandidateProfilePage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const candidate = recruiterCandidates.find((entry) => entry.id === candidateId);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  async function handleGenerateSummary() {
    if (!candidate) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await generateRecruiterCandidateSummary({ candidate });
      setSummary(result.summary);
      if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (error) {
      setSummaryError(error instanceof Error ? error.message : 'Summary generation failed.');
    } finally {
      setSummaryLoading(false);
    }
  }

  if (!candidate) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f7] px-4">
        <div className="max-w-md rounded-2xl border border-[#dddddd] bg-white p-8 text-center shadow-sm">
          <GraduationCap className="mx-auto h-10 w-10 text-[#777777]" />
          <h1 className="mt-4 text-xl font-semibold text-[#1f1f1f]">Candidate not found</h1>
          <p className="mt-2 text-sm text-[#666666]">This mock profile may have moved or the link may be incorrect.</p>
          <Button className="mt-5 rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => navigate('/recruiter/dashboard')}>
            Back to Recruiter Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <header className="border-b border-[#dddddd] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <Button variant="ghost" className="mb-3 rounded-xl px-0 text-[#666666] hover:text-red-700" asChild>
              <Link to="/recruiter/dashboard">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Recruiter Dashboard
              </Link>
            </Button>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-xl font-bold text-red-700">
                {candidate.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1f1f1f]">{candidate.name}</h1>
                <p className="text-sm text-[#666666]">
                  {candidate.university} - {candidate.major} - Class of {candidate.graduationYear}
                </p>
              </div>
            </div>
          </div>
          <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => toast.success(`Contact request started for ${candidate.name}`)}>
            <Mail className="mr-2 h-4 w-4" />
            Contact Candidate
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-4 md:grid-cols-4">
          <ScoreCard label="Research Score" value={candidate.researchScore.toString()} score={candidate.researchScore} />
          <ScoreCard label="Match Percentage" value={`${candidate.matchPercentage}%`} score={candidate.matchPercentage} />
          <ScoreCard label="Verified Contributions" value={candidate.verifiedContributions.toString()} score={candidate.researchScore} />
          <ScoreCard label="Research Hours" value={candidate.researchHours.toString()} score={candidate.researchScore} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1f1f1f]">AI Research Summary</h2>
                  <p className="text-sm text-[#666666]">Generated from projects, skills, publications, evidence, and endorsements.</p>
                </div>
                <Button variant="outline" className="rounded-xl" onClick={handleGenerateSummary} disabled={summaryLoading}>
                  {summaryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Summary
                </Button>
              </div>
              {summaryError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{summaryError}</p>}
              <div className="mt-4 rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-sm leading-6 text-[#444444]">
                {summary || `${candidate.name} has verified research experience in ${candidate.researchAreas.join(', ')} with ${candidate.verifiedContributions} professor-approved contributions, evidence-backed project work, and skills including ${candidate.skills.slice(0, 5).join(', ')}.`}
              </div>
            </div>

            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Research Experience</h2>
              <div className="mt-4 space-y-4">
                {candidate.projects.map((project) => (
                  <article key={project.title} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-[#1f1f1f]">{project.title}</h3>
                        <p className="text-sm text-[#666666]">{project.area}</p>
                      </div>
                      <Badge className="w-fit rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm text-[#555555]">{project.summary}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {project.evidence.map((link) => (
                        <a
                          key={`${project.title}-${link.label}`}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-[#d8d8d8] bg-white px-3 py-1 text-xs font-medium text-[#444444] hover:border-red-300 hover:text-red-700"
                        >
                          {link.type}: {link.label}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Research Timeline</h2>
              <div className="mt-4 space-y-3">
                {candidate.timeline.map((item, index) => (
                  <div key={item} className="flex gap-3 rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
                      {index + 1}
                    </div>
                    <p className="text-sm text-[#555555]">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Profile Signals</h2>
              <div className="mt-4 space-y-4">
                <SignalBlock title="Research Areas" items={candidate.researchAreas} />
                <SignalBlock title="Technical Skills" items={candidate.skills} />
                <SignalBlock title="Publications" items={candidate.publications.length ? candidate.publications : ['No publication listed yet']} />
                <SignalBlock title="Presentations" items={candidate.presentations} />
              </div>
            </div>

            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Professor Endorsements</h2>
              <div className="mt-4 space-y-3">
                {candidate.facultyEndorsements.map((endorsement) => (
                  <div key={endorsement} className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                    <CheckCircle2 className="mb-2 h-4 w-4" />
                    {endorsement}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-[#333333]" />
                <h2 className="text-lg font-semibold text-[#1f1f1f]">GitHub Activity</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#555555]">{candidate.githubActivity}</p>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

function ScoreCard({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="rounded-2xl border border-[#dddddd] bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-[#777777]">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${scoreClass(score)}`}>{value}</p>
    </div>
  );
}

function SignalBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <Badge key={item} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555555]">
            {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}
