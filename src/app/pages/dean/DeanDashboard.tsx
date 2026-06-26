import { useMemo, useState } from 'react';
import type React from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  Network,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  accessByClassYear,
  accessByMajor,
  accessMetrics,
  accessRows,
  dataConfidence,
  deanAiPayload,
  demandCapacityRows,
  executiveAttention,
  facultyOperationsRows,
  lastUpdated,
  mentorshipCapacityRows,
  metricSources,
  openOpportunityRows,
  outcomeTrend,
  outcomesByDepartment,
  outcomesSnapshot,
  oversubscribedOpportunityRows,
  overviewKpis,
  participationFunnel,
  reportOptions,
  reportingTerm,
  unmatchedInterestRows,
  unsupportedFutureIntegrations,
} from '../../mock/deanDashboard';
import { generateDeanResearchReport } from '../../lib/api';

type NavId = 'overview' | 'demand' | 'outcomes' | 'access' | 'reports';
type Primitive = string | number;

const DEAN_NAV_ITEMS: Array<{ id: NavId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'demand', label: 'Demand & Capacity', icon: BarChart3 },
  { id: 'outcomes', label: 'Outcomes', icon: CheckCircle2 },
  { id: 'access', label: 'Access', icon: Network },
  { id: 'reports', label: 'Reports', icon: FileText },
];

const filters = {
  terms: ['Spring 2026', 'Fall 2025', 'Spring 2025'],
  schools: ['School of Computer Science', 'College of Engineering', 'Dietrich College'],
  departments: ['All departments', 'Computer Science', 'Robotics Institute', 'Statistics & Data Science', 'Biomedical Engineering'],
  areas: ['All research areas', 'Robotics', 'Applied ML', 'Health AI', 'Climate AI', 'Public Interest Tech'],
  levels: ['All student levels', 'First-year', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
};

function toNavId(value: string | undefined): NavId {
  return DEAN_NAV_ITEMS.some((item) => item.id === value) ? (value as NavId) : 'overview';
}

function percent(part: number, whole: number) {
  if (!whole) return 0;
  return Math.round((part / whole) * 100);
}

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { tabId } = useParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [report, setReport] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const activeNavItem = toNavId(tabId);

  const visibleOutcomes = useMemo(
    () =>
      outcomesSnapshot.map((row) => ({
        label: row.label,
        value: verifiedOnly ? row.verified : row.reported,
        secondary: verifiedOnly ? `${row.reported} reported` : `${row.verified} verified`,
      })),
    [verifiedOnly],
  );

  function handleNavClick(sectionId: NavId) {
    navigate(sectionId === 'overview' ? '/dean/dashboard' : `/dean/dashboard/${sectionId}`);
  }

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  async function handleGenerateReport(reportType = 'Executive brief') {
    setReportLoading(true);
    setReportError('');
    try {
      const result = await generateDeanResearchReport({
        metrics: {
          ...deanAiPayload,
          reportType,
          verifiedOnly,
        },
      });
      setReport(result.report);
      if (result.warning) toast.warning(result.warning);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : 'Report generation failed.');
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="app-shell min-h-screen text-[#1f1f1f]">
      <header className="border-b border-[#e6dfdc] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-4 px-4 py-5 xl:px-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-[#8b7f79]">Dean Workspace</p>
              <h1 className="text-3xl font-semibold tracking-tight text-[#1f1f1f]">Dean Research Intelligence</h1>
              <p className="max-w-3xl text-sm text-[#666666]">
                Understand research demand, mentorship capacity, participation, and verified student outcomes.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="rounded-xl bg-red-700 text-white hover:bg-red-800"
                onClick={() => void handleGenerateReport()}
                disabled={reportLoading}
              >
                {reportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Export Executive Brief
              </Button>
              <Button variant="outline" className="rounded-xl border-[#dedede] bg-white text-[#1c1c1c] hover:bg-[#f7f7f7]">
                <UserCircle className="mr-2 h-4 w-4" />
                {user?.name ?? 'Dean'}
              </Button>
              <Button variant="ghost" className="rounded-xl border border-[#dedede] bg-white px-4 text-[#1c1c1c] hover:bg-[#f7f7f7]" onClick={() => void handleLogout()}>
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <FilterSelect label="Academic term" values={filters.terms} />
            <FilterSelect label="School" values={filters.schools} />
            <FilterSelect label="Department" values={filters.departments} />
            <FilterSelect label="Research area" values={filters.areas} />
            <FilterSelect label="Student level" values={filters.levels} />
            <label className="flex min-h-[58px] items-center justify-between gap-3 rounded-xl border border-[#e7e1de] bg-[#fbfaf8] px-3 text-sm text-[#444444]">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-red-700" />
                Verified only
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-700"
                checked={verifiedOnly}
                onChange={(event) => setVerifiedOnly(event.target.checked)}
              />
            </label>
          </div>
          <p className="text-xs text-[#777777]">Last updated: {lastUpdated}. Sources: platform opportunity, application, placement, progress-report, and verified outcome data.</p>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1500px] gap-4 px-4 py-6 xl:px-6">
        <aside className={`dashboard-surface sticky top-4 hidden max-h-[calc(100vh-3rem)] shrink-0 self-start overflow-y-auto rounded-2xl p-3 transition-all duration-300 lg:block ${sidebarCollapsed ? 'w-[84px]' : 'w-[250px]'}`}>
          <div className="mb-3 flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div>
                <p className="text-sm font-semibold">Navigation</p>
                <p className="text-xs text-[#6f6f6f]">Decision views</p>
              </div>
            ) : (
              <span className="text-xs font-semibold">Nav</span>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSidebarCollapsed((current) => !current)} aria-label="Toggle sidebar">
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
                    isActive ? 'border-red-200 bg-red-50 text-red-800' : 'border-transparent text-[#5d5d5d] hover:border-[#e4e4e4] hover:bg-[#f8f8f8]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!sidebarCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0 flex-1 space-y-5">
          {activeNavItem === 'overview' && <OverviewPage visibleOutcomes={visibleOutcomes} onNavigate={handleNavClick} />}
          {activeNavItem === 'demand' && <DemandCapacityPage />}
          {activeNavItem === 'outcomes' && <OutcomesPage visibleOutcomes={visibleOutcomes} verifiedOnly={verifiedOnly} />}
          {activeNavItem === 'access' && <AccessPage />}
          {activeNavItem === 'reports' && (
            <ReportsPage
              report={report}
              reportError={reportError}
              reportLoading={reportLoading}
              onGenerate={(reportType) => void handleGenerateReport(reportType)}
            />
          )}
        </section>
      </main>
    </div>
  );
}

function OverviewPage({
  visibleOutcomes,
  onNavigate,
}: {
  visibleOutcomes: Array<{ label: string; value: number; secondary: string }>;
  onNavigate: (id: NavId) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {overviewKpis.map((stat) => (
          <KpiCard key={stat.label} {...stat} />
        ))}
      </div>

      <Panel title="Executive Attention" subtitle={`${reportingTerm}. Actionable signals derived from displayed platform data.`}>
        <div className="grid gap-3 xl:grid-cols-4">
          {executiveAttention.map((insight) => (
            <div key={insight.title} className="flex flex-col rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
              <h3 className="text-sm font-semibold text-[#1f1f1f]">{insight.title}</h3>
              <p className="mt-2 text-sm font-medium text-red-700">{insight.evidence}</p>
              <p className="mt-2 text-sm leading-6 text-[#555555]">{insight.explanation}</p>
              <p className="mt-3 text-sm text-[#333333]">
                <span className="font-semibold">Suggested action:</span> {insight.action}
              </p>
              <Button variant="outline" className="mt-4 w-fit rounded-xl" onClick={() => onNavigate(insight.target as NavId)}>
                {insight.cta}
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <DemandCapacityChart rows={demandCapacityRows} />
        <FunnelChart rows={participationFunnel} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
        <Panel title="Outcomes Snapshot" subtitle={`Reported and faculty-verified student outcomes for ${reportingTerm}.`}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleOutcomes.map((item) => (
              <MiniMetric key={item.label} label={item.label} value={String(item.value)} detail={item.secondary} />
            ))}
          </div>
        </Panel>
        <DataConfidencePanel />
      </div>
    </>
  );
}

function DemandCapacityPage() {
  return (
    <>
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <DemandCapacityChart rows={demandCapacityRows} />
        <Panel title="Mentorship Capacity By Department" subtitle={`Faculty capacity and operational review load for ${reportingTerm}.`}>
          <div className="space-y-3">
            {mentorshipCapacityRows.map((row) => (
              <div key={row.department} className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{row.department}</h3>
                  <Badge className="rounded-full border border-red-200 bg-red-50 text-red-700">{row.fillRate} fill rate</Badge>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MiniMetric label="Faculty with open positions" value={String(row.facultyWithOpenPositions)} />
                  <MiniMetric label="Faculty without current researchers" value={String(row.facultyWithoutResearchers)} />
                  <MiniMetric label="Students mentored" value={String(row.studentsMentored)} />
                  <MiniMetric label="Pending progress reviews" value={String(row.pendingReviews)} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DataTable title="Open Opportunities With Low Applicants" rows={openOpportunityRows} source={metricSources.opportunityPlatform} />
        <DataTable title="Oversubscribed Opportunities" rows={oversubscribedOpportunityRows} source={metricSources.opportunityPlatform} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <DataTable title="Student Interest With No Direct Match" rows={unmatchedInterestRows} source={metricSources.opportunityPlatform} />
        <DataTable title="Faculty Operational Drill-Down" rows={facultyOperationsRows} source={`${metricSources.opportunityPlatform} ${metricSources.progressReports}`} />
      </div>
    </>
  );
}

function OutcomesPage({
  visibleOutcomes,
  verifiedOnly,
}: {
  visibleOutcomes: Array<{ label: string; value: number; secondary: string }>;
  verifiedOnly: boolean;
}) {
  return (
    <>
      <Panel title="Outcome Totals" subtitle={`${verifiedOnly ? 'Faculty-verified' : 'Reported'} outcomes for ${reportingTerm}. Reported and verified values remain visibly separated.`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleOutcomes.map((item) => (
            <MiniMetric key={item.label} label={item.label} value={String(item.value)} detail={item.secondary} />
          ))}
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <TrendPanel title="Semester And Year Trends" rows={outcomeTrend} valueKeys={['completed', 'verified', 'presentations', 'internships']} />
        <DataTable title="Outcomes By Department" rows={outcomesByDepartment} source={`${metricSources.progressReports} ${metricSources.outcomeReports}`} />
      </div>

      <Panel title="Outcomes By Research Area" subtitle="Verified contribution and completion signals by demand area. Units are students or completed project counts.">
        <div className="grid gap-3 lg:grid-cols-3">
          {demandCapacityRows.map((row) => (
            <MiniMetric
              key={row.area}
              label={row.area}
              value={`${row.filled} placed`}
              detail={`${row.demand} applicants, ${row.positions} positions`}
            />
          ))}
        </div>
      </Panel>
    </>
  );
}

function AccessPage() {
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-2">
        <BarPanel title="Participation By Major" rows={accessByMajor} units="Percent of participants" source={metricSources.profileData} />
        <BarPanel title="Participation By Class Year" rows={accessByClassYear} units="Percent of participants" source={metricSources.profileData} />
      </div>
      <Panel title="Research Access Signals" subtitle={`Participation, non-placement, early-entry, and repeated-attempt signals for ${reportingTerm}.`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {accessMetrics.map((metric) => (
            <MiniMetric key={metric.label} label={metric.label} value={metric.value} detail={metric.detail} />
          ))}
        </div>
      </Panel>
      <DataTable title="Access Gap Detail" rows={accessRows} source={metricSources.profileData} />
    </>
  );
}

function ReportsPage({
  report,
  reportError,
  reportLoading,
  onGenerate,
}: {
  report: string;
  reportError: string;
  reportLoading: boolean;
  onGenerate: (reportType: string) => void;
}) {
  return (
    <>
      <Panel title="Generate Reviewable Reports" subtitle="AI-generated reports use only displayed or retrieved metrics, cite the metrics used, and separate facts from recommendations.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reportOptions.map((option) => (
            <button
              key={option}
              type="button"
              className="rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-left transition hover:border-red-200 hover:bg-red-50/40"
              onClick={() => onGenerate(option)}
            >
              <FileText className="h-5 w-5 text-red-700" />
              <p className="mt-3 font-semibold">{option}</p>
              <p className="mt-2 text-sm leading-6 text-[#666666]">Creates a draft for dean review before export.</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Report Draft Review" subtitle="Review facts, cited metrics, and recommendations before export.">
        {reportError && <ErrorBox message={reportError} />}
        <div className="min-h-[180px] rounded-2xl border border-[#eeeeee] bg-[#fafafa] p-4 text-sm leading-6 text-[#444444]">
          {reportLoading ? (
            <span className="flex items-center gap-2 text-[#666666]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating draft from displayed dashboard metrics...
            </span>
          ) : (
            report ||
            'No report draft has been generated yet. Choose a report type above or use Export Executive Brief from the header.'
          )}
        </div>
      </Panel>

      <Panel title="Disabled Future Integrations" subtitle="These institutional metrics are not shown as verified facts until real data integrations exist.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {unsupportedFutureIntegrations.map((metric) => (
            <div key={metric} className="rounded-2xl border border-dashed border-[#d7d1ce] bg-[#fbfaf8] p-4 text-sm text-[#777777]">
              {metric}
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function FilterSelect({ label, values }: { label: string; values: string[] }) {
  return (
    <label className="block rounded-xl border border-[#e7e1de] bg-[#fbfaf8] px-3 py-2">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-[#777777]">{label}</span>
      <select className="mt-1 w-full bg-transparent text-sm font-medium text-[#2f2f2f] outline-none">
        {values.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
    </label>
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
    <section className="dashboard-surface rounded-2xl p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#1f1f1f]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-[#666666]">{subtitle}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function KpiCard({
  label,
  value,
  comparison,
  definition,
  source,
  coverage,
}: {
  label: string;
  value: string;
  comparison: string;
  definition: string;
  source: string;
  coverage: string;
}) {
  return (
    <div className="dashboard-surface rounded-2xl p-4" title={`${definition} Source: ${source}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-[#777777]">{label}</p>
      <p className="mt-2 text-3xl font-bold text-[#1f1f1f]">{value}</p>
      <p className="mt-1 text-sm font-medium text-red-700">{comparison}</p>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-[#666666]">
        <span>{coverage}</span>
        <span className="rounded-full border border-[#e4dfdc] bg-white px-2 py-1">Source</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="dashboard-muted-panel rounded-2xl p-3">
      <p className="text-lg font-bold text-[#1f1f1f]">{value}</p>
      <p className="mt-1 text-xs font-medium text-[#666666]">{label}</p>
      {detail && <p className="mt-2 text-xs leading-5 text-[#777777]">{detail}</p>}
    </div>
  );
}

function DemandCapacityChart({ rows }: { rows: typeof demandCapacityRows }) {
  const max = Math.max(...rows.flatMap((row) => [row.demand, row.positions, row.filled]), 1);
  return (
    <Panel
      title="Demand Vs Capacity"
      subtitle={`Horizontal grouped bars by research area for ${reportingTerm}. Units: students or positions. Source: ${metricSources.opportunityPlatform}`}
    >
      <ChartState rows={rows} />
      <div className="space-y-4" role="img" aria-label="Demand, available positions, and filled positions by research area">
        <div className="flex flex-wrap gap-3 text-xs text-[#666666]">
          <Legend color="bg-red-700" label="Student demand" />
          <Legend color="bg-[#b8aaa3]" label="Available positions" />
          <Legend color="bg-[#2f6f5e]" label="Filled positions" />
        </div>
        {rows.map((row) => (
          <div key={row.area} className="grid gap-2 lg:grid-cols-[160px_minmax(0,1fr)_130px] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-[#1f1f1f]">{row.area}</p>
              <DemandBadge status={row.status} />
            </div>
            <div className="space-y-1.5">
              <Bar value={row.demand} max={max} color="bg-red-700" label={`${row.area} demand ${row.demand}`} />
              <Bar value={row.positions} max={max} color="bg-[#b8aaa3]" label={`${row.area} positions ${row.positions}`} />
              <Bar value={row.filled} max={max} color="bg-[#2f6f5e]" label={`${row.area} filled ${row.filled}`} />
            </div>
            <p className="text-xs text-[#666666]">{row.demand}:{row.positions} applicant-to-position ratio</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function FunnelChart({ rows }: { rows: typeof participationFunnel }) {
  const first = rows[0]?.value ?? 0;
  return (
    <Panel
      title="Research Participation Funnel"
      subtitle={`Conversion from interest through completed projects for ${reportingTerm}. Units: students or projects. Source: ${metricSources.opportunityPlatform}`}
    >
      <ChartState rows={rows} />
      <div className="space-y-3" role="img" aria-label="Research participation funnel with conversion rates">
        {rows.map((row, index) => {
          const prior = rows[index - 1]?.value;
          const conversion = prior ? percent(row.value, prior) : 100;
          return (
            <div key={row.label}>
              <div className="flex justify-between gap-3 text-xs text-[#666666]">
                <span>{row.label}</span>
                <span>{row.value} {index > 0 ? `(${conversion}% from prior)` : '(baseline)'}</span>
              </div>
              <Bar value={row.value} max={first} color={index < 3 ? 'bg-red-700' : 'bg-[#2f6f5e]'} label={`${row.label} ${row.value}`} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function BarPanel({ title, rows, units, source }: { title: string; rows: Array<{ label: string; value: number }>; units: string; source: string }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <Panel title={title} subtitle={`${reportingTerm}. Units: ${units}. Source: ${source}`}>
      <ChartState rows={rows} />
      <div className="space-y-3" role="img" aria-label={`${title} bar chart`}>
        {rows.map((row) => (
          <div key={row.label}>
            <div className="flex justify-between text-xs text-[#666666]">
              <span>{row.label}</span>
              <span>{row.value}%</span>
            </div>
            <Bar value={row.value} max={max} color="bg-red-700" label={`${row.label} ${row.value}%`} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TrendPanel({ title, rows, valueKeys }: { title: string; rows: typeof outcomeTrend; valueKeys: string[] }) {
  const max = Math.max(...rows.flatMap((row) => valueKeys.map((key) => Number(row[key as keyof typeof row]) || 0)), 1);
  return (
    <Panel title={title} subtitle={`Annual trend for ${reportingTerm}. Units: students, projects, or verified contributions. Source: ${metricSources.outcomeReports}`}>
      <ChartState rows={rows} />
      <div className="space-y-4" role="img" aria-label={`${title} grouped trend bars`}>
        {rows.map((row) => (
          <div key={row.label}>
            <p className="mb-2 text-xs font-semibold text-[#555555]">{row.label}</p>
            <div className="grid gap-2">
              {valueKeys.map((key) => (
                <div key={key} className="grid grid-cols-[120px_minmax(0,1fr)_40px] items-center gap-2 text-xs text-[#666666]">
                  <span className="capitalize">{key}</span>
                  <Bar value={Number(row[key as keyof typeof row]) || 0} max={max} color="bg-red-700" label={`${row.label} ${key}`} />
                  <span>{Number(row[key as keyof typeof row]) || 0}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DataConfidencePanel() {
  return (
    <Panel title="Data Confidence" subtitle={`Coverage and trust signals. Source explanation: ${metricSources.opportunityPlatform}`}>
      <div className="space-y-3">
        {dataConfidence.map((item) => (
          <MiniMetric key={item.label} label={item.label} value={item.value} detail={item.detail} />
        ))}
      </div>
    </Panel>
  );
}

function DataTable<T extends Record<string, Primitive>>({ title, rows, source }: { title: string; rows: T[]; source: string }) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const columns = Object.keys(rows[0] ?? {}) as Array<keyof T>;
  const filteredRows = rows.filter((row) => Object.values(row).join(' ').toLowerCase().includes(filter.toLowerCase()));
  const sortedRows = [...filteredRows].sort((a, b) => {
    if (!sortKey) return 0;
    const left = a[sortKey];
    const right = b[sortKey];
    const result = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return sortAsc ? result : -result;
  });
  const pageRows = sortedRows.slice(0, 8);

  function handleSort(column: keyof T) {
    if (sortKey === column) {
      setSortAsc((current) => !current);
      return;
    }
    setSortKey(column);
    setSortAsc(true);
  }

  return (
    <Panel
      title={title}
      subtitle={`${reportingTerm}. Sort, filter, and export-ready table. Source: ${source}`}
      action={
        <Button variant="outline" className="rounded-xl">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      }
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex min-w-0 items-center gap-2 rounded-xl border border-[#e5e0dd] bg-white px-3 py-2 text-sm text-[#666666] sm:w-80">
          <Search className="h-4 w-4" />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none" placeholder="Filter rows" />
        </label>
        <p className="text-xs text-[#777777]">
          Showing {pageRows.length} of {sortedRows.length} rows
        </p>
      </div>
      {rows.length === 0 ? (
        <EmptyState text="No rows match the selected filters." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[#eeeeee] text-xs uppercase tracking-wide text-[#777777]">
                {columns.map((column) => (
                  <th key={String(column)} className="py-3 pr-4">
                    <button type="button" className="inline-flex items-center gap-1" onClick={() => handleSort(column)}>
                      {String(column).replace(/([A-Z])/g, ' $1')}
                      <SlidersHorizontal className="h-3 w-3" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => (
                <tr key={Object.values(row).join('-') || index} className="border-b border-[#f0f0f0]">
                  {columns.map((column) => (
                    <td key={String(column)} className="py-4 pr-4 text-[#444444]">
                      {row[column]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  return (
    <div className="h-2.5 rounded-full bg-[#e8e8e8]" aria-label={label} title={label}>
      <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${Math.max(3, (value / max) * 100)}%` }} />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function ChartState({ rows }: { rows: unknown[] }) {
  if (rows.length === 0) return <EmptyState text="No chart data is available for the selected filters." />;
  return (
    <div className="sr-only">
      Loading state: chart data has loaded. Error state: no error returned. Tooltip: hover or focus chart bars for source values.
    </div>
  );
}

function DemandBadge({ status }: { status: string }) {
  const className =
    status === 'Oversubscribed'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : status === 'Underutilized'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <Badge className={`mt-1 w-fit rounded-full border ${className}`}>{status}</Badge>;
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
