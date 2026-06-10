import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  ArrowRight,
  BarChart3,
  Bookmark,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  Search,
  Sparkles,
  UserCircle,
  UserCheck,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  defaultRecruiterRole,
  portfolioFeed,
  recruiterAnalytics,
  recruiterCandidates,
  recruiterOverviewStats,
  watchlistAlerts,
  type RecruiterCandidate,
} from '../../mock/recruiterDashboard';
import {
  generateRecruiterOutreach,
  rankRecruiterCandidates,
  type RecruiterCandidateMatch,
} from '../../lib/api';

const ALL = 'all';

const RECRUITER_NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'candidates', label: 'Candidates', icon: Users },
  { id: 'matching', label: 'AI Matching', icon: Sparkles },
  { id: 'portfolio', label: 'Portfolio Feed', icon: FileText },
  { id: 'watchlist', label: 'Watchlist', icon: Bookmark },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

function uniqueValues(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function scoreBadgeClass(score: number) {
  if (score >= 90) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (score >= 80) return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function candidateSearchText(candidate: RecruiterCandidate) {
  return [
    candidate.name,
    candidate.university,
    candidate.major,
    candidate.graduationYear,
    candidate.department,
    candidate.lab,
    ...candidate.researchAreas,
    ...candidate.skills,
    ...candidate.publications,
    ...candidate.presentations,
    ...candidate.facultyEndorsements,
  ].join(' ').toLowerCase();
}

export default function RecruiterDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [university, setUniversity] = useState(ALL);
  const [major, setMajor] = useState(ALL);
  const [graduationYear, setGraduationYear] = useState(ALL);
  const [researchArea, setResearchArea] = useState(ALL);
  const [skill, setSkill] = useState(ALL);
  const [publicationFilter, setPublicationFilter] = useState(ALL);
  const [endorsementFilter, setEndorsementFilter] = useState(ALL);
  const [scoreFilter, setScoreFilter] = useState(ALL);
  const [savedIds, setSavedIds] = useState<string[]>(['jonathan-youngblood', 'maya-patel']);
  const [roleForm, setRoleForm] = useState(defaultRecruiterRole);
  const [aiMatches, setAiMatches] = useState<RecruiterCandidateMatch[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [outreachCandidateId, setOutreachCandidateId] = useState(recruiterCandidates[0]?.id ?? '');
  const [outreachPosition, setOutreachPosition] = useState('Data Science Internship');
  const [outreachMessage, setOutreachMessage] = useState('');
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('overview');

  const universities = useMemo(() => uniqueValues(recruiterCandidates.map((candidate) => candidate.university)), []);
  const majors = useMemo(() => uniqueValues(recruiterCandidates.map((candidate) => candidate.major)), []);
  const years = useMemo(() => uniqueValues(recruiterCandidates.map((candidate) => candidate.graduationYear)), []);
  const researchAreas = useMemo(
    () => uniqueValues(recruiterCandidates.flatMap((candidate) => candidate.researchAreas)),
    []
  );
  const skills = useMemo(() => uniqueValues(recruiterCandidates.flatMap((candidate) => candidate.skills)), []);

  const filteredCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return recruiterCandidates.filter((candidate) => {
      if (normalizedQuery && !candidateSearchText(candidate).includes(normalizedQuery)) return false;
      if (university !== ALL && candidate.university !== university) return false;
      if (major !== ALL && candidate.major !== major) return false;
      if (graduationYear !== ALL && candidate.graduationYear !== graduationYear) return false;
      if (researchArea !== ALL && !candidate.researchAreas.includes(researchArea)) return false;
      if (skill !== ALL && !candidate.skills.includes(skill)) return false;
      if (publicationFilter === 'with' && candidate.publications.length === 0) return false;
      if (endorsementFilter === 'with' && candidate.facultyEndorsements.length === 0) return false;
      if (scoreFilter === '90' && candidate.researchScore < 90) return false;
      if (scoreFilter === '80' && candidate.researchScore < 80) return false;
      return true;
    });
  }, [endorsementFilter, graduationYear, major, publicationFilter, query, researchArea, scoreFilter, skill, university]);

  const savedCandidates = recruiterCandidates.filter((candidate) => savedIds.includes(candidate.id));
  const outreachCandidate = recruiterCandidates.find((candidate) => candidate.id === outreachCandidateId) ?? recruiterCandidates[0];

  function toggleSaveCandidate(candidateId: string) {
    setSavedIds((current) => {
      if (current.includes(candidateId)) {
        toast.success('Candidate removed from watchlist');
        return current.filter((id) => id !== candidateId);
      }
      toast.success('Candidate saved to watchlist');
      return [...current, candidateId];
    });
  }

  async function handleAiMatch() {
    setAiLoading(true);
    setAiError('');
    try {
      const result = await rankRecruiterCandidates({
        role: roleForm,
        candidates: recruiterCandidates,
      });
      setAiMatches(result.matches);
      if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Candidate matching failed.';
      setAiError(message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleOutreach() {
    if (!outreachCandidate) return;
    setOutreachLoading(true);
    try {
      const result = await generateRecruiterOutreach({
        candidate: outreachCandidate,
        position: outreachPosition,
      });
      setOutreachMessage(result.message);
      if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Outreach generation failed.');
    } finally {
      setOutreachLoading(false);
    }
  }

  function handleNavClick(sectionId: string) {
    setActiveNavItem(sectionId);
    document.getElementById(`recruiter-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7] text-[#1f1f1f]">
      <header className="border-b border-[#dddddd] bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 py-5">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b7f79]">Recruiter Workspace</p>
            <h1 className="text-[1.85rem] font-semibold leading-none tracking-tight">Recruiter Dashboard</h1>
            <p className="text-sm text-[#6f6f6f]">Signed in as {user?.name ?? 'Recruiter'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="rounded-xl border-[#dedede] bg-white text-[#1c1c1c] hover:bg-[#f7f7f7]">
              <UserCircle className="mr-2 h-4 w-4" />
              Profile
            </Button>
            <Button variant="ghost" className="rounded-xl border border-[#dedede] bg-white px-4 text-[#1c1c1c] hover:bg-[#f7f7f7]" onClick={() => void handleLogout()}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1400px] gap-4 px-4 py-6">
        <aside className={`sticky top-4 hidden max-h-[calc(100vh-3rem)] self-start overflow-y-auto rounded-2xl border border-[#dddddd] bg-white p-3 shadow-sm transition-all duration-300 lg:block ${sidebarCollapsed ? 'w-[84px]' : 'w-[270px]'}`}>
          <div className="mb-3 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-sm font-semibold">Navigation</p>
                <p className="text-xs text-[#6f6f6f]">Recruiter tools</p>
              </div>
            ) : (
              <span className="text-xs font-semibold">Nav</span>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setSidebarCollapsed((current) => !current)}
              aria-label="Toggle sidebar"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
          <div className="space-y-1">
            {RECRUITER_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-transparent text-[#5d5d5d] hover:border-[#e4e4e4] hover:bg-[#f8f8f8]'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-4">
          <div id="recruiter-overview" className="grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {recruiterOverviewStats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-[#dddddd] bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[#777777]">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold text-[#1f1f1f]">{stat.value}</p>
              <p className="mt-1 text-xs text-[#666666]">{stat.detail}</p>
            </div>
          ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
          <div id="recruiter-candidates" className="scroll-mt-6 rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[#eeeeee] pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#1f1f1f]">Candidate Discovery</h2>
                <p className="text-sm text-[#666666]">Search by verified research evidence, skills, endorsements, and score.</p>
              </div>
              <div className="relative w-full md:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777777]" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search candidates"
                  className="rounded-xl pl-9"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <FilterSelect value={university} onChange={setUniversity} placeholder="University" options={universities} />
              <FilterSelect value={major} onChange={setMajor} placeholder="Major" options={majors} />
              <FilterSelect value={graduationYear} onChange={setGraduationYear} placeholder="Graduation Year" options={years} />
              <FilterSelect value={researchArea} onChange={setResearchArea} placeholder="Research Area" options={researchAreas} />
              <FilterSelect value={skill} onChange={setSkill} placeholder="Technical Skill" options={skills} />
              <FilterSelect value={publicationFilter} onChange={setPublicationFilter} placeholder="Publications" options={[['with', 'Has publications']]} />
              <FilterSelect value={endorsementFilter} onChange={setEndorsementFilter} placeholder="Endorsements" options={[['with', 'Has endorsements']]} />
              <FilterSelect value={scoreFilter} onChange={setScoreFilter} placeholder="Research Score" options={[['90', '90+'], ['80', '80+']]} />
            </div>

            <div className="mt-5 space-y-4">
              {filteredCandidates.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d0d0d0] bg-[#fafafa] p-8 text-center">
                  <UserCheck className="mx-auto h-8 w-8 text-[#777777]" />
                  <h3 className="mt-3 font-semibold text-[#1f1f1f]">No candidates match these filters</h3>
                  <p className="mt-1 text-sm text-[#666666]">Clear a filter or broaden the research area to continue searching.</p>
                </div>
              ) : (
                filteredCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    saved={savedIds.includes(candidate.id)}
                    onSave={() => toggleSaveCandidate(candidate.id)}
                  />
                ))
              )}
            </div>
          </div>

          <div id="recruiter-matching" className="scroll-mt-6 space-y-6">
            <section className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-red-700" />
                <h2 className="text-lg font-semibold text-[#1f1f1f]">AI Candidate Matching</h2>
              </div>
              <p className="mt-1 text-sm text-[#666666]">Ollama ranks candidates using profile, research history, skills, publications, and endorsements.</p>

              <div className="mt-4 space-y-3">
                <Input
                  value={roleForm.jobTitle}
                  onChange={(event) => setRoleForm((current) => ({ ...current, jobTitle: event.target.value }))}
                  placeholder="Job title"
                  className="rounded-xl"
                />
                <Textarea
                  value={roleForm.requiredSkills}
                  onChange={(event) => setRoleForm((current) => ({ ...current, requiredSkills: event.target.value }))}
                  placeholder="Required skills"
                  className="min-h-20 rounded-xl"
                />
                <Textarea
                  value={roleForm.preferredSkills}
                  onChange={(event) => setRoleForm((current) => ({ ...current, preferredSkills: event.target.value }))}
                  placeholder="Preferred skills"
                  className="min-h-20 rounded-xl"
                />
                <Input
                  value={roleForm.researchAreas}
                  onChange={(event) => setRoleForm((current) => ({ ...current, researchAreas: event.target.value }))}
                  placeholder="Research areas"
                  className="rounded-xl"
                />
                <Input
                  value={roleForm.experienceLevel}
                  onChange={(event) => setRoleForm((current) => ({ ...current, experienceLevel: event.target.value }))}
                  placeholder="Experience level"
                  className="rounded-xl"
                />
                <Button className="w-full rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={handleAiMatch} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Matches
                </Button>
              </div>

              {aiError && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{aiError}</p>}

              <div className="mt-4 space-y-3">
                {(aiMatches.length > 0 ? aiMatches : recruiterCandidates.slice(0, 3).map((candidate) => ({
                  candidateId: candidate.id,
                  candidateName: candidate.name,
                  matchScore: candidate.matchPercentage,
                  explanation: `${candidate.name} has verified research work in ${candidate.researchAreas.slice(0, 2).join(', ')} with faculty-backed evidence.`,
                  reasons: candidate.skills.slice(0, 3).map((item) => `${item} appears in verified project evidence`),
                }))).map((match) => (
                  <div key={match.candidateId} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Link to={`/recruiter/candidates/${match.candidateId}`} className="font-semibold text-[#1f1f1f] hover:text-red-700">
                        {match.candidateName}
                      </Link>
                      <Badge className={`rounded-full border ${scoreBadgeClass(match.matchScore)}`}>{match.matchScore}% Match</Badge>
                    </div>
                    <p className="mt-2 text-sm text-[#555555]">{match.explanation}</p>
                    <ul className="mt-3 space-y-1 text-sm text-[#666666]">
                      {match.reasons.slice(0, 3).map((reason) => (
                        <li key={reason} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-red-700" />
                <h2 className="text-lg font-semibold text-[#1f1f1f]">AI Outreach Assistant</h2>
              </div>
              <div className="mt-4 space-y-3">
                <Select value={outreachCandidateId} onValueChange={setOutreachCandidateId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select candidate" />
                  </SelectTrigger>
                  <SelectContent>
                    {recruiterCandidates.map((candidate) => (
                      <SelectItem key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={outreachPosition}
                  onChange={(event) => setOutreachPosition(event.target.value)}
                  placeholder="Position"
                  className="rounded-xl"
                />
                <Button variant="outline" className="w-full rounded-xl" onClick={handleOutreach} disabled={outreachLoading}>
                  {outreachLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Outreach
                </Button>
                {outreachMessage && (
                  <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-sm leading-6 text-[#444444]">
                    {outreachMessage}
                  </div>
                )}
              </div>
            </section>
          </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
          <div id="recruiter-portfolio" className="scroll-mt-6 rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-semibold text-[#1f1f1f]">Verified Research Portfolio Feed</h2>
            <div className="mt-4 space-y-4">
              {portfolioFeed.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-[#1f1f1f]">{item.projectTitle}</h3>
                      <p className="text-sm text-[#666666]">{item.student} - {item.researchArea}</p>
                    </div>
                    <Badge className="w-fit rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                      {item.verificationBadge}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-[#555555]">{item.contributionSummary}</p>
                  <p className="mt-2 text-sm font-medium text-[#444444]">{item.publicationStatus}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.evidenceLinks.map((link) => (
                      <a
                        key={`${item.id}-${link.label}`}
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
                  <p className="mt-3 text-xs text-[#666666]">{item.professorEndorsement}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section id="recruiter-watchlist" className="scroll-mt-6 rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-[#1f1f1f]">Watchlist</h2>
              <p className="mt-1 text-sm text-[#666666]">{savedCandidates.length} saved candidates</p>
              <div className="mt-4 space-y-3">
                {watchlistAlerts.map((alert) => (
                  <Link
                    key={`${alert.candidateId}-${alert.alert}`}
                    to={`/recruiter/candidates/${alert.candidateId}`}
                    className="block rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 hover:border-red-200"
                  >
                    <p className="text-sm font-semibold text-[#1f1f1f]">{alert.candidate}</p>
                    <p className="text-sm text-red-700">{alert.alert}</p>
                    <p className="mt-1 text-xs text-[#666666]">{alert.detail}</p>
                  </Link>
                ))}
              </div>
            </section>

            <section id="recruiter-analytics" className="scroll-mt-6 rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-red-700" />
                <h2 className="text-lg font-semibold text-[#1f1f1f]">Candidate Analytics</h2>
              </div>
              <AnalyticsBlock title="Top Universities" rows={recruiterAnalytics.topUniversities} />
              <AnalyticsBlock title="Top Departments" rows={recruiterAnalytics.topDepartments} />
              <AnalyticsBlock title="Top Labs" rows={recruiterAnalytics.topLabs} />
              <AnalyticsBlock title="Fastest Growing Areas" rows={recruiterAnalytics.growingAreas} />
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[#1f1f1f]">Talent Distribution</h3>
                <div className="mt-2 space-y-2">
                  {recruiterAnalytics.talentDistribution.map(([label, value]) => (
                    <div key={String(label)}>
                      <div className="flex justify-between text-xs text-[#666666]">
                        <span>{label}</span>
                        <span>{value}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-[#eeeeee]">
                        <div className="h-2 rounded-full bg-red-700" style={{ width: `${Number(value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: string[] | [string, string][];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{placeholder}</SelectItem>
        {options.map((option) => {
          const value = Array.isArray(option) ? option[0] : option;
          const label = Array.isArray(option) ? option[1] : option;
          return (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

function CandidateCard({
  candidate,
  saved,
  onSave,
}: {
  candidate: RecruiterCandidate;
  saved: boolean;
  onSave: () => void;
}) {
  return (
    <article className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-[#1f1f1f]">{candidate.name}</h3>
            <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              {candidate.verifiedContributions} verified contributions
            </Badge>
          </div>
          <p className="mt-1 text-sm text-[#666666]">
            {candidate.university} - {candidate.major} - Class of {candidate.graduationYear}
          </p>
          <p className="mt-2 text-sm text-[#555555]">{candidate.lab} - {candidate.department}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {candidate.researchAreas.map((area) => (
              <Badge key={area} variant="secondary" className="rounded-full bg-[#f2f2f2] text-[#555555]">
                {area}
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {candidate.skills.map((item) => (
              <span key={item} className="rounded-full border border-[#dddddd] px-3 py-1 text-xs text-[#555555]">
                {item}
              </span>
            ))}
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <Metric label="Publications" value={candidate.publications.length.toString()} />
            <Metric label="Presentations" value={candidate.presentations.length.toString()} />
            <Metric label="Endorsements" value={candidate.facultyEndorsements.length.toString()} />
          </div>
          <p className="mt-3 text-sm text-[#555555]">{candidate.facultyEndorsements[0]}</p>
        </div>

        <div className="w-full shrink-0 space-y-3 lg:w-52">
          <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-center">
            <div className="text-3xl font-bold text-[#1f1f1f]">{candidate.researchScore}</div>
            <p className="text-xs text-[#666666]">Research Score</p>
          </div>
          <Badge className={`w-full justify-center rounded-full border py-1 ${scoreBadgeClass(candidate.matchPercentage)}`}>
            {candidate.matchPercentage}% Match
          </Badge>
          <Button asChild variant="outline" className="w-full rounded-xl">
            <Link to={`/recruiter/candidates/${candidate.id}`}>
              View Profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" className="w-full rounded-xl" onClick={onSave}>
            <Bookmark className="mr-2 h-4 w-4" />
            {saved ? 'Saved' : 'Save Candidate'}
          </Button>
          <Button className="w-full rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => toast.success(`Contact request started for ${candidate.name}`)}>
            <Mail className="mr-2 h-4 w-4" />
            Contact
          </Button>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#eeeeee] bg-[#fafafa] p-3">
      <p className="font-semibold text-[#1f1f1f]">{value}</p>
      <p className="text-xs text-[#666666]">{label}</p>
    </div>
  );
}

function AnalyticsBlock({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <div className="mt-4">
      <h3 className="text-sm font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="mt-2 space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-[#eeeeee] bg-[#fafafa] p-3 text-sm">
            <span className="text-[#444444]">{label}</span>
            <span className="text-right font-medium text-[#666666]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
