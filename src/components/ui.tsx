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

export function KindPill({ mode, kind }: { mode: Mode; kind: Kind }) {
  const k = KINDS[mode][kind];
  return <Pill bg={k.bg} fg={k.fg}>{k.label}</Pill>;
}

export function GradeBadge({ percent, size = 'sm' }: { percent: number; size?: 'sm' | 'lg' }) {
  const g = gradeFor(percent);
  const cls = size === 'lg' ? 'h-14 w-14 text-[28px]' : 'h-7 min-w-7 px-2 text-sm';
  return (
    <span aria-label={`Grade ${g.letter}`} className={`inline-flex items-center justify-center rounded-full font-extrabold ${cls}`} style={{ background: g.bg, color: g.fg }}>
      {g.letter}
    </span>
  );
}

export function Card({ children, className = '', accent }: { children: ReactNode; className?: string; accent?: string }) {
  return (
    <section className={`border border-line bg-white ${className}`} style={accent ? { borderTop: `6px solid ${accent}` } : undefined}>
      {children}
    </section>
  );
}

export function StatCard({ label, value, note }: { label: string; value: ReactNode; note?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1.5 p-6">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="text-4xl font-extrabold">{value}</span>
      {note && <span className="text-[13px] text-muted">{note}</span>}
    </Card>
  );
}

/** Stacked bar + legend of counts per change type. */
export function KindBreakdown({ mode, counts, title, aside }: { mode: Mode; counts: Record<Kind, number>; title: string; aside?: ReactNode }) {
  const kinds = KIND_ORDER[mode];
  const total = kinds.reduce((s, k) => s + counts[k], 0);
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {aside && <span className="text-[13px] text-muted">{aside}</span>}
      </div>
      {total > 0 ? (
        <div aria-hidden="true" className="flex h-5 gap-0.5">
          {kinds.filter((k) => counts[k] > 0).map((k) => (
            <span key={k} style={{ width: `${(counts[k] / total) * 100}%`, background: KINDS[mode][k].bg }} />
          ))}
        </div>
      ) : (
        <p className="text-muted">No changes at all.</p>
      )}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {kinds.map((k) => (
          <li key={k} className="flex items-center gap-2">
            <span aria-hidden="true" className="h-3 w-3" style={{ background: KINDS[mode][k].bg }} />
            {KINDS[mode][k].label} <strong>{counts[k].toLocaleString()}</strong>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export const buttonPrimary =
  'inline-flex h-11 items-center justify-center bg-brand px-5 text-[15px] font-bold text-white no-underline hover:bg-brand-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50';
export const buttonSecondary =
  'inline-flex h-11 items-center justify-center border border-brand bg-white px-5 text-[15px] font-bold text-brand no-underline hover:bg-[#EEF3FC]';
