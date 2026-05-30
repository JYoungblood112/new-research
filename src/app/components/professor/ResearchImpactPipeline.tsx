import {
  Award,
  BookOpen,
  Briefcase,
  Download,
  FileText,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LineChart,
  Medal,
  Mic,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Cell, Funnel, FunnelChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { toast } from 'sonner';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

type ResearchImpactPipelineProps = {
  darkMode?: boolean;
};

type KpiMetric = {
  label: string;
  value: number;
  previous: number;
};

type PipelineStage = {
  label: string;
  count: number;
  note: string;
};

type ReportKind = 'annual' | 'tenure' | 'grant';

const KPI_METRICS: KpiMetric[] = [
  { label: 'Students Recruited', value: 14, previous: 10 },
  { label: 'Active Researchers', value: 8, previous: 7 },
  { label: 'Student Publications', value: 3, previous: 2 },
  { label: 'Conference Presentations', value: 5, previous: 3 },
  { label: 'Graduate School Placements', value: 2, previous: 1 },
  { label: 'Industry Research Placements', value: 4, previous: 3 },
  { label: 'Research Retention Rate', value: 87, previous: 71 },
];

const PIPELINE_STAGES: PipelineStage[] = [
  { label: 'Applicants', count: 124, note: 'Students who submitted complete applications this cycle.' },
  { label: 'Students Accepted', count: 22, note: 'Students admitted into active lab opportunities.' },
  { label: 'Active Researchers', count: 14, note: 'Students consistently contributing to lab work.' },
  { label: 'Research Contributors', count: 10, note: 'Researchers with measurable project deliverables.' },
  { label: 'Conference Presenters', count: 5, note: 'Students presenting talks or posters externally.' },
  { label: 'Published Authors', count: 3, note: 'Students with accepted or published research outputs.' },
  { label: 'Graduate School Placements', count: 2, note: 'Students entering graduate research programs.' },
];

const OUTCOME_METRICS = [
  { label: 'PhD Programs', value: 2, trend: '+1', icon: GraduationCap },
  { label: 'Masters Programs', value: 3, trend: '+1', icon: BookOpen },
  { label: 'Research Industry Placements', value: 4, trend: '+2', icon: Briefcase },
  { label: 'Startups Founded', value: 1, trend: '+1', icon: Lightbulb },
  { label: 'Publications Coauthored', value: 3, trend: '+50%', icon: FileText },
  { label: 'Patents Contributed', value: 1, trend: 'flat', icon: Award },
  { label: 'Conference Talks', value: 5, trend: '+2', icon: Mic },
  { label: 'Poster Presentations', value: 8, trend: '+3', icon: LineChart },
  { label: 'Research Awards', value: 2, trend: '+1', icon: Trophy },
];

const TIMELINE = [
  {
    year: '2026',
    items: ['2 students admitted to PhD programs', '1 publication accepted at NeurIPS', '3 conference presentations'],
  },
  {
    year: '2025',
    items: ['1 publication accepted', '2 graduate placements'],
  },
  {
    year: '2024',
    items: ['5 undergraduate researchers recruited'],
  },
];

const MENTORSHIP_METRICS = [
  { label: 'Average Student Tenure', value: '11 months' },
  { label: 'Average Weekly Commitment', value: '10.5 hours' },
  { label: 'Returning Student Rate', value: '72%' },
  { label: 'Student Satisfaction', value: '4.8 / 5' },
  { label: 'Recommendation Rate', value: '96%' },
];

const BENCHMARKING = [
  { label: 'Students Recruited', yourLab: '14', dept: '8' },
  { label: 'Retention Rate', yourLab: '87%', dept: '65%' },
  { label: 'Student Publications', yourLab: '3', dept: '1.4' },
  { label: 'Graduate Placements', yourLab: '2', dept: '0.8' },
];

function changeText(current: number, previous: number, isPercentMetric = false) {
  const delta = current - previous;
  const pct = previous === 0 ? 0 : Math.round((delta / previous) * 100);
  const prefix = pct >= 0 ? '↑' : '↓';
  const absolutePct = Math.abs(pct);

  if (isPercentMetric) {
    return `${prefix} ${absolutePct}% from last year (${previous}%)`;
  }

  return `${prefix} ${absolutePct}% from last year`;
}

function stageConversion(index: number) {
  const stage = PIPELINE_STAGES[index];
  const previous = index === 0 ? stage.count : PIPELINE_STAGES[index - 1].count;
  return index === 0 ? 100 : Math.round((stage.count / previous) * 100);
}

function buildNarrative() {
  return (
    'Over the past academic year, your lab mentored 14 student researchers, resulting in 3 publications, ' +
    '5 conference presentations, and 2 graduate school placements. Your retention rate exceeds the ' +
    'departmental average by 22%, demonstrating strong student engagement and mentorship effectiveness.'
  );
}

function buildReportText(kind: ReportKind) {
  const titleByKind: Record<ReportKind, string> = {
    annual: 'Research Impact Annual Report',
    tenure: 'Research Impact Tenure Summary',
    grant: 'Research Impact Grant Report',
  };

  const objectiveByKind: Record<ReportKind, string> = {
    annual: 'Annual impact snapshot across recruitment, mentorship, and student outcomes.',
    tenure: 'Tenure portfolio summary focused on sustained mentorship and scholarly outputs.',
    grant: 'Grant impact evidence focused on measurable student development and outcomes.',
  };

  const header = [
    titleByKind[kind],
    `Generated: ${new Date().toLocaleString()}`,
    objectiveByKind[kind],
    '',
    'Research Impact Narrative',
    buildNarrative(),
    '',
  ];

  const kpiSection = [
    'Hero Metrics',
    ...KPI_METRICS.map((metric) => {
      const isRate = metric.label === 'Research Retention Rate';
      const valueText = `${metric.value}${isRate ? '%' : ''}`;
      const prevText = `${metric.previous}${isRate ? '%' : ''}`;
      return `- ${metric.label}: ${valueText} (previous: ${prevText}, ${changeText(metric.value, metric.previous, isRate)})`;
    }),
    '',
  ];

  const pipelineSection = [
    'Pipeline',
    ...PIPELINE_STAGES.map((stage, index) => `- ${stage.label}: ${stage.count} (${stageConversion(index)}% conversion)`),
    '',
  ];

  const mentorshipSection = [
    'Mentorship Analytics',
    ...MENTORSHIP_METRICS.map((metric) => `- ${metric.label}: ${metric.value}`),
    '',
  ];

  const outcomesSection = [
    'Student Outcomes',
    ...OUTCOME_METRICS.map((metric) => `- ${metric.label}: ${metric.value} (${metric.trend})`),
    '',
  ];

  const benchmarkingSection = [
    'Department Benchmarking (Private)',
    ...BENCHMARKING.map((entry) => `- ${entry.label}: your lab ${entry.yourLab} vs department ${entry.dept}`),
    '',
  ];

  const timelineSection = [
    'Impact Timeline',
    ...TIMELINE.flatMap((yearBlock) => [
      `- ${yearBlock.year}:`,
      ...yearBlock.items.map((item) => `  - ${item}`),
    ]),
    '',
  ];

  const growthSection = [
    'Historical Growth Snapshot',
    '- Recruitment: 14',
    '- Mentorship: 11',
    '- Publications: 3',
    '- Presentations: 5',
    '- Outcomes: 7',
    '',
  ];

  return [
    ...header,
    ...kpiSection,
    ...pipelineSection,
    ...outcomesSection,
    ...mentorshipSection,
    ...benchmarkingSection,
    ...timelineSection,
    ...growthSection,
  ].join('\n');
}

function downloadFile(fileName: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function buildReportJson(kind: ReportKind) {
  return JSON.stringify(
    {
      reportKind: kind,
      generatedAt: new Date().toISOString(),
      narrative: buildNarrative(),
      metrics: KPI_METRICS,
      pipeline: PIPELINE_STAGES.map((stage, index) => ({
        ...stage,
        conversionPct: stageConversion(index),
      })),
      outcomes: OUTCOME_METRICS.map((metric) => ({
        label: metric.label,
        value: metric.value,
        trend: metric.trend,
      })),
      mentorship: MENTORSHIP_METRICS,
      benchmarking: BENCHMARKING,
      timeline: TIMELINE,
    },
    null,
    2
  );
}

export default function ResearchImpactPipeline({ darkMode = false }: ResearchImpactPipelineProps) {
  const sectionTitleClass = darkMode ? 'text-[#f2f2f2]' : 'text-[#111111]';
  const sectionSubText = darkMode ? 'text-[#b3b3b3]' : 'text-[#6f6f6f]';
  const cardSurface = darkMode ? 'border-[#2d2d2d] bg-[#181818]' : 'border-[#d0ceca] bg-white';

  const pipelineChartData = PIPELINE_STAGES.map((stage) => ({
    name: stage.label,
    value: stage.count,
  }));
  const narrativeText = buildNarrative();

  const handleExportTextReport = (kind: ReportKind) => {
    const text = buildReportText(kind);
    const fileSuffix = kind === 'annual' ? 'annual-report' : kind === 'tenure' ? 'tenure-summary' : 'grant-impact-report';
    downloadFile(`research-impact-${fileSuffix}.txt`, text, 'text/plain;charset=utf-8');
    toast.success('Report exported successfully.');
  };

  const handleExportGrantJson = () => {
    const json = buildReportJson('grant');
    downloadFile('research-impact-grant-impact-report.json', json, 'application/json;charset=utf-8');
    toast.success('Grant impact JSON exported.');
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'letter' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 48;
      const maxTextWidth = pageWidth - margin * 2;
      const lineHeight = 15;
      let cursorY = margin;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text('Research Impact Pipeline Report', margin, cursorY);
      cursorY += 22;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, cursorY);
      cursorY += 20;

      const bodyText = buildReportText('annual');
      const lines = doc.splitTextToSize(bodyText, maxTextWidth) as string[];

      for (const line of lines) {
        if (cursorY > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(line, margin, cursorY);
        cursorY += lineHeight;
      }

      doc.save('research-impact-pipeline.pdf');
      toast.success('PDF downloaded successfully.');
    } catch {
      toast.error('Failed to generate PDF report.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-red-200 bg-[linear-gradient(115deg,#fff4ef_0%,#fff8f4_48%,#fffefb_100%)] p-5 dark:border-[#59312b] dark:bg-[linear-gradient(115deg,#2a1b18_0%,#231a1a_48%,#171717_100%)]">
        <div className="flex flex-wrap items-center gap-3">
          <Badge className="border border-red-200 bg-red-50 text-red-700">
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Research Impact Pipeline
          </Badge>
          <Badge className="border border-[#dedede] bg-white text-[#575757] dark:border-[#3a3a3a] dark:bg-[#202020] dark:text-[#d0d0d0]">
            Annual review ready
          </Badge>
        </div>
        <h2 className={`mt-3 text-2xl font-semibold ${sectionTitleClass}`}>Research Impact Pipeline</h2>
        <p className={`mt-1 max-w-3xl text-sm ${sectionSubText}`}>
          Measure how your lab develops students into researchers, authors, presenters, and future scholars.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_METRICS.map((metric) => {
          const isPercentMetric = metric.label === 'Research Retention Rate';
          return (
            <Card key={metric.label} className={cardSurface}>
              <CardHeader className="pb-2">
                <CardDescription>{metric.label}</CardDescription>
                <CardTitle className="text-3xl">
                  {metric.value}
                  {isPercentMetric ? '%' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-emerald-600">{changeText(metric.value, metric.previous, isPercentMetric)}</p>
                <p className={`mt-1 text-xs ${sectionSubText}`}>
                  Previous year: {metric.previous}
                  {isPercentMetric ? '%' : ''}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle>Progression Pipeline</CardTitle>
          <CardDescription>Follow student movement from applicant pool to long-term outcomes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="overflow-x-auto">
            <div className="flex min-w-[980px] items-center gap-3">
              {PIPELINE_STAGES.map((stage, index) => {
                const prev = index === 0 ? stage.count : PIPELINE_STAGES[index - 1].count;
                const conversion = index === 0 ? 100 : Math.round((stage.count / prev) * 100);
                return (
                  <div key={stage.label} className="flex items-center gap-3">
                    <div
                      className="group w-[180px] rounded-xl border border-[#ecd8cf] bg-[#fff8f3] px-3 py-3 text-sm dark:border-[#4c3731] dark:bg-[#231a1a]"
                      title={stage.note}
                    >
                      <p className="font-semibold text-[#111111] dark:text-[#f0f0f0]">{stage.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-red-700">{stage.count}</p>
                      <p className="text-xs text-[#7d625c] dark:text-[#c8aaa2]">{conversion}% conversion</p>
                    </div>
                    {index < PIPELINE_STAGES.length - 1 ? <span className="text-xl text-red-400">→</span> : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-60 rounded-xl border border-[#eadad2] bg-[#fffdfa] p-3 dark:border-[#3e2f2a] dark:bg-[#1b1818]">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: '#e8d8cf', backgroundColor: '#fffaf7' }}
                  formatter={(value: number, _name: string, data: any) => [value, data?.payload?.name]}
                />
                <Funnel dataKey="value" data={pipelineChartData} isAnimationActive>
                  <LabelList position="right" fill={darkMode ? '#ececec' : '#3b2f2a'} stroke="none" dataKey="name" />
                  {pipelineChartData.map((entry, index) => (
                    <Cell
                      key={`${entry.name}-${index}`}
                      fill={index % 2 === 0 ? '#c93a2f' : '#e16a5e'}
                      stroke="#fff3ef"
                    />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle>Student Outcomes</CardTitle>
            <CardDescription>Track downstream outcomes from lab participation and mentorship.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {OUTCOME_METRICS.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-xl border border-[#ececec] bg-[#fafafa] p-3 dark:border-[#343434] dark:bg-[#202020]">
                  <div className="flex items-center justify-between">
                    <Icon className="h-4 w-4 text-red-700" />
                    <span className="text-xs text-emerald-600">{metric.trend}</span>
                  </div>
                  <p className="mt-2 text-xl font-semibold">{metric.value}</p>
                  <p className={`mt-1 text-xs ${sectionSubText}`}>{metric.label}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle>Impact Timeline</CardTitle>
            <CardDescription>Scrollable annual highlights for reporting and grant narratives.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {TIMELINE.map((year) => (
              <div key={year.year} className="rounded-xl border border-[#ececec] p-3 dark:border-[#343434]">
                <p className="text-sm font-semibold text-red-700">{year.year}</p>
                <div className="mt-2 space-y-2">
                  {year.items.map((item) => (
                    <p key={item} className={`text-sm ${sectionSubText}`}>• {item}</p>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle>Mentorship Analytics</CardTitle>
            <CardDescription>Quality indicators that emphasize student experience and growth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {MENTORSHIP_METRICS.map((metric) => (
              <div key={metric.label} className="flex items-center justify-between rounded-xl border border-[#ececec] px-3 py-2 text-sm dark:border-[#343434]">
                <span>{metric.label}</span>
                <span className="font-semibold text-red-700">{metric.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={cardSurface}>
          <CardHeader>
            <CardTitle>Department Benchmarking</CardTitle>
            <CardDescription>Private comparison view to contextualize your lab outcomes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {BENCHMARKING.map((item) => (
              <div key={item.label} className="rounded-xl border border-[#ececec] p-3 dark:border-[#343434]">
                <p className={`text-sm ${sectionSubText}`}>{item.label}</p>
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-sm font-medium">Your Lab: <span className="text-red-700">{item.yourLab}</span></p>
                  <p className={`text-sm ${sectionSubText}`}>Department Average: {item.dept}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-red-200 bg-red-50/70 dark:border-[#5a3430] dark:bg-[#2a1e1e]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-900 dark:text-[#ffd7d0]">
            <FlaskConical className="h-4 w-4" />
            Research Impact Narrative
          </CardTitle>
          <CardDescription className="text-red-800 dark:text-[#f0bcb2]">
            AI-generated summary for annual reviews, tenure packets, and external reporting.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-red-900 dark:text-[#ffd7d0]">
            {narrativeText}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-xl bg-red-700 text-white hover:bg-red-800" onClick={() => handleExportTextReport('annual')}>
              <FileText className="mr-2 h-4 w-4" />
              Export Annual Report
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => handleExportTextReport('tenure')}>
              <Medal className="mr-2 h-4 w-4" />
              Generate Tenure Summary
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={handleExportGrantJson}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Grant Impact Report
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={() => void handleDownloadPdf()}>
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={cardSurface}>
        <CardHeader>
          <CardTitle>Historical Growth Snapshot</CardTitle>
          <CardDescription>
            Summary trend for recruitment, mentorship, publications, presentations, and student outcomes.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-64 rounded-xl border border-[#eadad2] bg-[#fffdfa] p-3 dark:border-[#3d2e2b] dark:bg-[#191919]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { category: 'Recruitment', value: 14 },
                { category: 'Mentorship', value: 11 },
                { category: 'Publications', value: 3 },
                { category: 'Presentations', value: 5 },
                { category: 'Outcomes', value: 7 },
              ]}
            >
              <XAxis dataKey="category" tick={{ fill: darkMode ? '#d8d8d8' : '#4a3f3b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: darkMode ? '#a7a7a7' : '#7a6a64', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 12, borderColor: '#e8d8cf', backgroundColor: '#fffaf7' }}
                formatter={(value: number) => [`${value}`, 'Impact score']}
              />
              <Bar dataKey="value" fill="#c93a2f" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
