import type React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { cn } from './utils';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneClasses: Record<Tone, string> = {
  neutral: 'border-[#dedede] bg-white text-[#1f1f1f]',
  success: 'status-success',
  warning: 'status-warning',
  danger: 'status-danger',
  info: 'status-info',
};

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8b7f79]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-[#111111] md:text-[1.9rem]">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-[#666666]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold leading-tight text-[#111111]">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-[#666666]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function DashboardCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('dashboard-surface rounded-2xl', className)}>
      {title || description || action ? (
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {title ? <CardTitle>{title}</CardTitle> : null}
              {description ? <CardDescription>{description}</CardDescription> : null}
            </div>
            {action}
          </div>
        </CardHeader>
      ) : null}
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  helper?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#777777]">{label}</p>
          <p className="text-2xl font-semibold leading-tight text-[#111111]">{value}</p>
          {helper ? <p className="text-xs leading-5 text-[#666666]">{helper}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('rounded-xl border p-2', toneClasses[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="dashboard-surface rounded-2xl">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-red-700">
          <Icon className="h-8 w-8" />
        </div>
        <div className="max-w-xl space-y-2">
          <h3 className="text-lg font-semibold text-[#111111]">{title}</h3>
          <p className="text-sm leading-6 text-[#666666]">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function ErrorState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardContent className="flex flex-col gap-4 py-10 text-center sm:items-center">
        <AlertCircle className="mx-auto h-8 w-8 text-red-700" />
        <div>
          <p className="font-semibold text-red-950">{title}</p>
          <p className="mt-1 text-sm leading-6 text-red-800">{description}</p>
        </div>
        {action}
      </CardContent>
    </Card>
  );
}

export function LoadingState({ label = 'Loading workspace data...' }: { label?: string }) {
  return (
    <Card className="dashboard-surface rounded-2xl" aria-busy="true">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-red-700" />
        <p className="text-sm font-medium text-[#555555]">{label}</p>
        <div className="grid w-full max-w-xl gap-2">
          <div className="h-3 animate-pulse rounded-full bg-[#eeeeee]" />
          <div className="mx-auto h-3 w-3/4 animate-pulse rounded-full bg-[#f3f3f3]" />
        </div>
      </CardContent>
    </Card>
  );
}

export function StatusBadge({
  status,
  label,
  icon: Icon,
}: {
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'published' | 'draft' | 'completed' | 'sent' | 'failed' | 'info';
  label?: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const tone =
    status === 'approved' || status === 'active' || status === 'published' || status === 'completed' || status === 'sent'
      ? 'success'
      : status === 'pending' || status === 'draft'
        ? 'warning'
        : status === 'rejected' || status === 'failed'
          ? 'danger'
          : 'info';

  return (
    <Badge className={cn('rounded-full border px-3 py-1 text-xs', toneClasses[tone])}>
      {Icon ? <Icon className="mr-1 h-3.5 w-3.5" /> : null}
      {label ?? status}
    </Badge>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  const status = score >= 88 ? 'success' : score >= 72 ? 'info' : 'warning';
  const label = score >= 88 ? 'High confidence' : score >= 72 ? 'Medium confidence' : 'Low confidence';
  return <Badge className={cn('rounded-full border px-3 py-1 text-xs', toneClasses[status])}>{label}</Badge>;
}

export function SkillChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#dddddd] bg-white px-3 py-1 text-xs font-medium text-[#555555]">
      {children}
    </span>
  );
}

export function FormHint({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return <p className={cn('text-xs leading-5', tone === 'danger' ? 'text-red-700' : 'text-[#666666]')}>{children}</p>;
}
