import type { ReactNode } from 'react';
import type { Kind, Mode } from '@/lib/compare/engine';
import { KINDS, KIND_ORDER } from '@/lib/kinds';
import { gradeFor } from '@/lib/grades';

export function Pill({ bg, fg, children, className = '' }: { bg: string; fg: string; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold ${className}`} style={{ background: bg, color: fg }}>
      {children}
    </span>
  );
}

/** Type tag: neutral pill, a coloured dot, and the label (the label carries the meaning, not the dot). */
export function KindPill({ mode, kind }: { mode: Mode; kind: Kind }) {
  const k = KINDS[mode][kind];
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-chip px-3 py-1 text-[13px] font-semibold text-ink">
      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: k.bg }} />
      {k.label}
    </span>
  );
}

/**
 * Grade letter. Small = soft tinted pill. Large = a white tile with an ink letter,
 * meant to sit on the teal score card.
 */
export function GradeBadge({ percent, size = 'sm' }: { percent: number; size?: 'sm' | 'lg' }) {
  const g = gradeFor(percent);
  if (size === 'lg') {
    return (
      <span aria-label={`Grade ${g.letter}`} className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white font-heading text-[34px] font-bold text-ink">
        {g.letter}
      </span>
    );
  }
  return (
    <span
      aria-label={`Grade ${g.letter}`}
      className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 font-heading text-sm font-bold"
      style={{ background: g.bg, color: g.fg }}
    >
      {g.letter}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-[20px] border border-line bg-white ${className}`}>{children}</section>;
}

export const labelSmall = 'text-xs font-semibold uppercase tracking-[0.1em] text-muted';

export function StatCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-6">
      <span className={labelSmall}>{label}</span>
      <span className="font-heading text-4xl font-bold">{value}</span>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </Card>
  );
}

/** Vertical bar chart of counts per change type. Only the most common type is coloured. */
export function KindBreakdown({ mode, counts, title, aside }: { mode: Mode; counts: Record<Kind, number>; title: string; aside?: ReactNode }) {
  const kinds = KIND_ORDER[mode];
  const total = kinds.reduce((s, k) => s + counts[k], 0);
  const top = kinds.reduce((best, k) => (counts[k] > counts[best] ? k : best), kinds[0]);
  const max = Math.max(1, ...kinds.map((k) => counts[k]));
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {aside && <span className="text-[13px] text-muted">{aside}</span>}
      </div>
      {total > 0 ? (
        <ul className="flex items-end gap-3 sm:gap-5">
          {kinds.map((k) => {
            const isTop = k === top && counts[k] > 0;
            return (
              <li key={k} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <span className={`font-heading text-lg ${isTop ? 'font-bold' : 'font-semibold text-muted'}`}>{counts[k].toLocaleString()}</span>
                <span
                  aria-hidden="true"
                  className="w-full max-w-14 rounded-lg"
                  style={{ height: Math.max(4, (counts[k] / max) * 120), background: isTop ? KINDS[mode][k].bg : '#E3E8E6' }}
                />
                <span className={`text-center text-[13px] leading-tight ${isTop ? 'font-bold text-ink' : 'text-muted'}`}>{KINDS[mode][k].label}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted">No changes at all.</p>
      )}
    </Card>
  );
}

export const buttonPrimary =
  'inline-flex h-12 items-center justify-center rounded-xl bg-brand px-6 text-[15px] font-bold text-white no-underline hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
export const buttonSecondary =
  'inline-flex h-12 items-center justify-center rounded-xl border-[1.5px] border-ink bg-white px-6 text-[15px] font-bold text-ink no-underline hover:bg-chip hover:text-ink';
