import { useState } from 'react';
import type React from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Loader2,
  LogOut,
  Lightbulb,
  LineChart,
  Network,
  PieChart,
  Sparkles,
  TrendingUp,
  UserCircle,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  accessMetrics,
  deanAiPayload,
  deanKeyQuestions,
  deanOverviewStats,
  departmentComparisons,
  facultyImpactRows,
  fundingByArea,
  fundingMetrics,
  labDemandRows,
  outcomeTrend,
  portfolioAnalytics,
  researchGapSignals,
  researchOutputMetrics,
  semesterOutputTrend,
  studentOutcomeMetrics,
  supplyDemandMetrics,
} from '../../mock/deanDashboard';
import { generateDeanInsights, generateDeanResearchReport, type DeanInsight } from '../../lib/api';

const defaultInsights: DeanInsight[] = [
  {
    title: 'Research demand is concentrated',
    category: 'Resource',
    summary: 'Robotics and applied machine learning have the strongest student demand relative to available positions.',
    action: 'Open additional mentored roles or redistribute applicant demand toward adjacent labs.',
  },
  {
    title: 'Verified contributions are scaling',
    category: 'Growth',
    summary: 'Progress reports and faculty-approved evidence are becoming a measurable signal of student research output.',
    action: 'Ask faculty to verify reports at each project milestone for more complete institutional reporting.',
  },
  {
    title: 'Climate AI needs visibility',
    category: 'Improvement',
    summary: 'Computational sustainability has open positions but fewer applicants than available capacity.',
    action: 'Promote climate and sustainability projects in student discovery flows.',
  },
];

const DEAN_NAV_ITEMS = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'output', label: 'Research Output', icon: LineChart },
  { id: 'comparison', label: 'Comparison', icon: BarChart3 },
  { id: 'faculty', label: 'Faculty Impact', icon: GraduationCap },
  { id: 'outcomes', label: 'Student Outcomes', icon: Users },
  { id: 'gaps', label: 'Research Gaps', icon: Lightbulb },
  { id: 'funding', label: 'Funding', icon: TrendingUp },
  { id: 'access', label: 'Access', icon: Network },
  { id: 'portfolio', label: 'Portfolio Analytics', icon: PieChart },
];

function metricIcon(index: number) {
  const icons = [LineChart, CheckCircle2, Users, Building2, FileText, BarChart3, TrendingUp, GraduationCap];
  return icons[index % icons.length];
}

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [insights, setInsights] = useState<DeanInsight[]>(defaultInsights);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState('overview');

  async function handleGenerateReport() {
    setReportLoading(true);
    setReportError('');
    try {
      const result = await generateDeanResearchReport({ metrics: deanAiPayload });
      setReport(result.report);
      if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Department report generation failed.');
    } finally {
      setReportLoading(false);
    }
  }

  async function handleGenerateInsights() {
    setInsightsLoading(true);
    setInsightsError('');
    try {
      const result = await generateDeanInsights({ metrics: deanAiPayload });
      setInsights(result.insights.length > 0 ? result.insights : defaultInsights);
      if (result.warning) {
        toast.warning(result.warning);
      }
    } catch (error) {
      setInsightsError(error instanceof Error ? error.message : 'Dean insights generation failed.');
    } finally {
      setInsightsLoading(false);
    }
  }

  function handleNavClick(sectionId: string) {
    setActiveNavItem(sectionId);
    document.getElementById(`dean-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b7f79]">Dean Workspace</p>
            <h1 className="text-[1.85rem] font-semibold leading-none tracking-tight">Dean Dashboard</h1>
            <p className="text-sm text-[#6f6f6f]">Signed in as {user?.name ?? 'Dean'}</p>
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
                <p className="text-xs text-[#6f6f6f]">Dean tools</p>
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
            {DEAN_NAV_ITEMS.map((item) => {
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
        <div id="dean-overview" className="grid scroll-mt-6 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {deanOverviewStats.map((stat, index) => {
            const Icon = metricIcon(index);
            return (
              <div key={stat.label} className="rounded-2xl border border-[#dddddd] bg-white p-4 shadow-sm">
                <Icon className="h-5 w-5 text-red-700" />
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#777777]">{stat.label}</p>
                <p className="mt-2 text-2xl font-bold text-[#1f1f1f]">{stat.value}</p>
                <p className="mt-1 text-xs text-[#666666]">{stat.detail}</p>
              </div>
            );
          })}
        </div>

        <Panel title="Dean Key Questions" subtitle="Direct answers to the decisions this dashboard is meant to support.">
          <div className="grid gap-3 lg:grid-cols-2">
            {deanKeyQuestions.map((item) => (
              <div key={item.question} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                <h3 className="text-sm font-semibold text-[#1f1f1f]">{item.question}</h3>
                <p className="mt-2 text-sm leading-6 text-[#444444]">{item.answer}</p>
                <p className="mt-3 text-xs font-medium uppercase tracking-wide text-[#777777]">Evidence: {item.proof}</p>
              </div>
            ))}
          </div>
        </Panel>

        <div id="dean-output" className="grid scroll-mt-6 gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
          <Panel title="Department Research Output" subtitle="Production, participation, publications, patents, and funding.">
            <MetricGrid rows={researchOutputMetrics} />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TrendChart title="Research Output by Semester" rows={semesterOutputTrend} valueKey="projects" suffix=" projects" />
              <TrendChart title="Publications by Semester" rows={semesterOutputTrend} valueKey="publications" suffix=" pubs" />
              <TrendChart title="Participation Growth" rows={semesterOutputTrend} valueKey="participation" suffix="%" />
              <TrendChart title="Grant Funding Trends" rows={semesterOutputTrend} valueKey="grants" prefix="$" suffix="M" />
            </div>
          </Panel>

          <Panel
            title="AI Department Research Report"
            subtitle="Executive summary generated from research output, funding, outcomes, and comparisons."
            action={
              <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={handleGenerateReport} disabled={reportLoading}>
                {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Generate Department Research Report
              </Button>
            }
          >
            {reportError && <ErrorBox message={reportError} />}
            <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-sm leading-6 text-[#444444]">
              {report ||
                'The Computer Science Department supported 142 student researchers, produced 41 publications, secured $4.2M in grant funding, and increased undergraduate research participation by 27% compared to the previous academic year.'}
            </div>
          </Panel>
        </div>

        <div id="dean-comparison" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
          <Panel title="Department Comparison" subtitle="Relative performance across university departments, history, and peers.">
            <div className="space-y-3">
              {departmentComparisons.map((row) => (
                <div key={row.name} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-[#1f1f1f]">{row.name}</h3>
                      <p className="text-sm text-[#666666]">{row.type}</p>
                    </div>
                    <Badge className="w-fit rounded-full border border-red-200 bg-red-50 text-red-700">{row.ranking}</Badge>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <MiniMetric label="Projects / Faculty" value={row.projectsPerFaculty.toString()} />
                    <MiniMetric label="Students / Faculty" value={row.studentsMentoredPerFaculty.toString()} />
                    <MiniMetric label="Pubs / Project" value={row.publicationsPerProject.toString()} />
                    <MiniMetric label="Funding / Faculty" value={row.grantFundingPerFaculty} />
                    <MiniMetric label="Participation" value={row.participationRate} />
                    <MiniMetric label="Verified / Student" value={row.verifiedContributionsPerStudent.toString()} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="AI Dean Insights"
            subtitle="Actionable recommendations generated from department metrics."
            action={
              <Button variant="outline" className="rounded-xl" onClick={handleGenerateInsights} disabled={insightsLoading}>
                {insightsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                Generate Insights
              </Button>
            }
          >
            {insightsError && <ErrorBox message={insightsError} />}
            <div className="space-y-3">
              {insights.length === 0 ? (
                <EmptyState text="No AI insights have been generated yet." />
              ) : (
                insights.map((insight) => (
                  <div key={`${insight.title}-${insight.category}`} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[#1f1f1f]">{insight.title}</h3>
                      <Badge variant="secondary" className="rounded-full bg-white text-[#555555]">
                        {insight.category}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-[#555555]">{insight.summary}</p>
                    <p className="mt-3 text-sm font-medium text-red-700">{insight.action}</p>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div id="dean-faculty" className="scroll-mt-6">
        <Panel title="Faculty Research Impact" subtitle="Mentorship, output, grants, approved progress reports, and verified contributions.">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#eeeeee] text-xs uppercase tracking-wide text-[#777777]">
                  <th className="py-3 pr-4">Faculty</th>
                  <th className="py-3 pr-4">Department</th>
                  <th className="py-3 pr-4">Active Projects</th>
                  <th className="py-3 pr-4">Students Mentored</th>
                  <th className="py-3 pr-4">Publications</th>
                  <th className="py-3 pr-4">Presentations</th>
                  <th className="py-3 pr-4">Grants</th>
                  <th className="py-3 pr-4">Reports Approved</th>
                  <th className="py-3 pr-4">Verified Contributions</th>
                  <th className="py-3">Impact Score</th>
                </tr>
              </thead>
              <tbody>
                {facultyImpactRows.map((faculty) => (
                  <tr key={faculty.name} className="border-b border-[#f0f0f0]">
                    <td className="py-4 pr-4 font-semibold text-[#1f1f1f]">{faculty.name}</td>
                    <td className="py-4 pr-4 text-[#555555]">{faculty.department}</td>
                    <td className="py-4 pr-4">{faculty.activeProjects}</td>
                    <td className="py-4 pr-4">{faculty.studentsMentored}</td>
                    <td className="py-4 pr-4">{faculty.publications}</td>
                    <td className="py-4 pr-4">{faculty.presentations}</td>
                    <td className="py-4 pr-4">{faculty.grantsSecured}</td>
                    <td className="py-4 pr-4">{faculty.reportsApproved}</td>
                    <td className="py-4 pr-4">{faculty.verifiedContributions}</td>
                    <td className="py-4">
                      <Badge className="rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
                        {faculty.impactScore}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        </div>

        <div id="dean-outcomes" className="grid scroll-mt-6 gap-6 lg:grid-cols-2">
          <Panel title="Student Outcomes" subtitle="Research involvement translated into publications, presentations, internships, jobs, and graduate study.">
            <MetricGrid rows={studentOutcomeMetrics} />
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <TrendChart title="Students Placed" rows={outcomeTrend} valueKey="placed" />
              <TrendChart title="Verified Contributions" rows={outcomeTrend} valueKey="verified" />
              <TrendChart title="Internships" rows={outcomeTrend} valueKey="internships" />
              <TrendChart title="Graduate Programs" rows={outcomeTrend} valueKey="graduatePrograms" />
            </div>
          </Panel>

          <Panel title="Research Opportunity Supply and Demand" subtitle="Bottlenecks by lab, position availability, and student demand.">
            <MetricGrid rows={supplyDemandMetrics} />
            <div className="mt-4 space-y-3">
              {labDemandRows.map((row) => (
                <div key={row.lab} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-[#1f1f1f]">{row.lab}</h3>
                      <p className="text-sm text-[#666666]">{row.area}</p>
                    </div>
                    <DemandBadge status={row.status} />
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <MiniMetric label="Applicants" value={row.applicants.toString()} />
                    <MiniMetric label="Positions" value={row.positions.toString()} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div id="dean-gaps" className="scroll-mt-6">
          <Panel title="Research Gaps Analysis" subtitle="Metric-backed capacity and coverage issues.">
            <div className="space-y-3">
              {researchGapSignals.map((signal) => (
                <div key={signal} className="flex gap-3 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{signal}</span>
                </div>
              ))}
            </div>
          </Panel>
          </div>

          <div id="dean-funding" className="scroll-mt-6">
          <Panel title="Funding and Grants" subtitle="Active funding, pending grants, student participation, and output per dollar.">
            <MetricGrid rows={fundingMetrics} />
            <div className="mt-5">
              <BarList title="Funding by Research Area" rows={fundingByArea.map((row) => [row.label, row.value])} suffix="M" prefix="$" />
            </div>
          </Panel>
          </div>

          <div id="dean-access" className="scroll-mt-6">
          <Panel title="Diversity and Access" subtitle="Participation by major, class year, department, and collaboration patterns.">
            <BarList title="Participation by Major" rows={accessMetrics.byMajor} suffix="%" />
            <div className="mt-5">
              <BarList title="Participation by Class Year" rows={accessMetrics.byClassYear} suffix="%" />
            </div>
            <div className="mt-5 space-y-2">
              {accessMetrics.collaboration.map(([label, value]) => (
                <MiniMetric key={label} label={label} value={value} />
              ))}
            </div>
          </Panel>
          </div>
        </div>

        <div id="dean-portfolio" className="scroll-mt-6">
        <Panel title="Research Portfolio Analytics" subtitle="Aggregated progress reports and verified contribution activity from the platform.">
          <div className="grid gap-4 md:grid-cols-3">
            <MiniMetric label="Total Progress Reports Submitted" value={portfolioAnalytics.totalProgressReports.toString()} />
            <MiniMetric label="Approved Progress Reports" value={portfolioAnalytics.verifiedProgressReports.toString()} />
            <MiniMetric label="Total Verified Contributions" value={portfolioAnalytics.totalVerifiedContributions.toString()} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <PortfolioList title="Most Active Research Areas" items={portfolioAnalytics.activeAreas} icon={PieChart} />
            <PortfolioList title="Most Active Labs" items={portfolioAnalytics.activeLabs} icon={Network} />
            <PortfolioList title="Most Active Students" items={portfolioAnalytics.activeStudents} icon={Users} />
            <PortfolioList title="Most Active Faculty Mentors" items={portfolioAnalytics.activeMentors} icon={GraduationCap} />
          </div>
        </Panel>
        </div>
        </section>
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#dddddd] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1f1f1f]">{title}</h2>
          <p className="mt-1 text-sm text-[#666666]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricGrid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map(([label, value]) => (
        <MiniMetric key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-3">
      <p className="text-lg font-bold text-[#1f1f1f]">{value}</p>
      <p className="mt-1 text-xs text-[#666666]">{label}</p>
    </div>
  );
}

function TrendChart({
  title,
  rows,
  valueKey,
  prefix = '',
  suffix = '',
}: {
  title: string;
  rows: Record<string, string | number>[];
  valueKey: string;
  prefix?: string;
  suffix?: string;
}) {
  const values = rows.map((row) => Number(row[valueKey]) || 0);
  const max = Math.max(...values, 1);
  return (
    <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
      <h3 className="text-sm font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="mt-4 space-y-3">
        {rows.map((row) => {
          const value = Number(row[valueKey]) || 0;
          return (
            <div key={String(row.label)}>
              <div className="flex justify-between text-xs text-[#666666]">
                <span>{row.label}</span>
                <span>
                  {prefix}
                  {value}
                  {suffix}
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-[#e8e8e8]">
                <div className="h-2 rounded-full bg-red-700" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarList({
  title,
  rows,
  prefix = '',
  suffix = '',
}: {
  title: string;
  rows: Array<[string, number]>;
  prefix?: string;
  suffix?: string;
}) {
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return (
    <div>
      <h3 className="text-sm font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <div className="flex justify-between text-xs text-[#666666]">
              <span>{label}</span>
              <span>
                {prefix}
                {value}
                {suffix}
              </span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-[#e8e8e8]">
              <div className="h-2 rounded-full bg-red-700" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DemandBadge({ status }: { status: string }) {
  const className =
    status === 'Oversubscribed'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'Undersubscribed'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <Badge className={`rounded-full border ${className}`}>{status}</Badge>;
}

function PortfolioList({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: string[];
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
      <Icon className="h-5 w-5 text-red-700" />
      <h3 className="mt-3 text-sm font-semibold text-[#1f1f1f]">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item} className="rounded-xl bg-white px-3 py-2 text-sm text-[#555555]">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d0d0d0] bg-[#fafafa] p-6 text-center text-sm text-[#666666]">
      {text}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p>;
}
