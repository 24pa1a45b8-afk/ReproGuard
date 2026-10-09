import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'grey';

const toneClass: Record<Tone, string> = {
  green: 'bg-accent/15 text-accent',
  blue: 'bg-primary/10 text-primary',
  amber: 'bg-warning/15 text-warning',
  red: 'bg-error/10 text-error',
  grey: 'bg-border/70 text-muted',
};

export function statusTone(status?: string | null): Tone {
  switch (status) {
    case 'PASS':
    case 'Completed':
      return 'green';
    case 'WARNING':
    case 'Needs verification':
      return 'amber';
    case 'FAIL':
    case 'Failed':
      return 'red';
    default:
      return 'grey';
  }
}

export function Tag({ tone = 'grey', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold lowercase whitespace-nowrap', toneClass[tone])}>
      {children}
    </span>
  );
}

export function Btn({
  variant = 'ghost',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default',
        variant === 'primary'
          ? 'bg-primary text-white hover:bg-primary/90'
          : 'bg-surface border border-border text-text hover:bg-background',
        className
      )}
    >
      {children}
    </button>
  );
}

/* Page frame: a slim toolbar row, then full-bleed content */
export function Page({
  title,
  hint,
  actions,
  children,
}: {
  title: string;
  hint?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="min-h-11 px-4 py-1.5 border-b border-border flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-sm font-semibold text-text whitespace-nowrap">{title}</h1>
          {hint && <div className="text-xs text-muted truncate flex items-center gap-2">{hint}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionLabel({
  children,
  count,
  aside,
}: {
  children: ReactNode;
  count?: number;
  aside?: ReactNode;
}) {
  return (
    <div className="h-9 px-4 flex items-center justify-between gap-3 bg-background border-b border-border">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11px] font-semibold text-muted tracking-widest uppercase truncate">{children}</span>
        {count !== undefined && (
          <span className="text-[11px] font-medium text-muted bg-border/70 rounded px-1.5 py-px">{count}</span>
        )}
      </div>
      {aside && <div className="text-xs text-muted flex items-center gap-2 shrink-0">{aside}</div>}
    </div>
  );
}

/* Label-over-value cell, used in hairline-divided strips */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-4 py-3 border-r border-b border-border min-w-0">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-medium text-text truncate flex items-center gap-2">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted truncate">{sub}</div>}
    </div>
  );
}

/* Column header with the small type glyph (T text, # number, D date) */
export function Th({
  t = 'T',
  className,
  children,
}: {
  t?: 'T' | '#' | 'D';
  className?: string;
  children: ReactNode;
}) {
  return (
    <th className={className}>
      <span className="inline-flex items-center justify-center w-4 h-4 mr-1.5 rounded-[4px] bg-background border border-border text-[10px] leading-none text-muted align-[-2px]">
        {t}
      </span>
      {children}
    </th>
  );
}

/* Key on the left, value on the right */
export function KV({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs py-0.5">
      <dt className="text-muted shrink-0">{k}</dt>
      <dd className="text-text text-right truncate">{children}</dd>
    </div>
  );
}
