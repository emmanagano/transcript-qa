'use client';

import { useMemo, useState } from 'react';
import type { ChangeItem, Counts, Kind, Mode, Piece } from '@/lib/compare/engine';
import { KINDS, KIND_ORDER } from '@/lib/kinds';
import { KindPill } from './ui';

const PAGE = 100;

function Text({ pieces, side }: { pieces: Piece[]; side: 'old' | 'new' }) {
  return (
    <>
      {pieces.map((p, i) =>
        !p.changed ? (
          <span key={i}>{p.text}</span>
        ) : p.caret ? (
          // a missing word is already highlighted on the other side, so no marker in the text.
          // Only when this side has nothing at all do we say so.
          pieces.length === 1 ? (
            <span key={i} className="italic text-muted">(nothing here)</span>
          ) : null
        ) : side === 'old' ? (
          <del key={i} className="rounded-[5px] bg-del-bg px-[3px] py-px text-del-fg">
            {p.text}
          </del>
        ) : (
          <ins key={i} className="rounded-[5px] bg-ins-bg px-[3px] py-px font-bold text-ins-fg underline decoration-2 decoration-ins-line underline-offset-[3px]">
            {p.text}
          </ins>
        ),
      )}
    </>
  );
}

// The transcriber's column switches sides between comparisons, so it always gets the same
// colour: a light blue background, and a darker blue header labelled "You".
const MINE_HEAD = 'bg-tint text-brand-dark';
const MINE_CELL = 'bg-tint-soft';

/** One side of a row. Re-segmented rows draw each whole subtitle as its own numbered box. */
function Side({ it, side, mark }: { it: ChangeItem; side: 'ref' | 'hyp'; mark: 'old' | 'new' }) {
  const cues = side === 'ref' ? it.refCues : it.hypCues;
  if (!cues) return <Text pieces={it[side]} side={mark} />;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-muted">
        {cues.length} subtitle{cues.length === 1 ? '' : 's'}
      </span>
      {cues.map((c, i) => (
        <div key={i} className="flex gap-2.5 rounded-lg border border-field bg-white px-3 py-2 leading-snug">
          <span className="font-bold tabular-nums text-muted">{i + 1}</span>
          <span>{c}</span>
        </div>
      ))}
    </div>
  );
}

interface Props {
  mode: Mode;
  items: ChangeItem[];
  counts: Counts;
  title: string;
  oldLabel: string; // column for the left text
  newLabel: string;
  /** which side of each item goes in the left column */
  left: 'hyp' | 'ref';
}

export function ChangeTable({ mode, items, counts, title, oldLabel, newLabel, left }: Props) {
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [limit, setLimit] = useState(PAGE);

  // timestamp moves are counted in the totals but have no rows to show, so no filter chip for them
  const leftMine = left === 'hyp'; // is the left column the transcriber's text?
  const kinds = KIND_ORDER[mode].filter((k) => k !== 'time');
  const total = kinds.reduce((s, k) => s + counts[k], 0);
  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.kinds.includes(filter))), [items, filter]);

  // selected filter = solid teal with white text; the rest are plain white
  const chip = (key: Kind | 'all', label: string, n: number) => {
    const on = filter === key;
    return (
      <button
        key={key}
        aria-pressed={on}
        onClick={() => {
          setFilter(key);
          setLimit(PAGE);
        }}
        className={`min-h-9 rounded-full border-[1.5px] px-3.5 text-sm font-semibold ${
          on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-field'
        }`}
      >
        {label} {n.toLocaleString()}
      </button>
    );
  };

  return (
    <section className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
      <div className="flex flex-col gap-3.5 border-b border-line px-6 py-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{title}</h2>
          <span className="text-[13px] text-muted">Cleared when you leave or refresh this page</span>
        </div>
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-2">
          {chip('all', 'All', total)}
          {kinds.filter((k) => counts[k] > 0).map((k) => chip(k, KINDS[mode][k].label, counts[k]))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="px-6 py-10 text-center text-muted">Nothing to show here. Clean work!</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-[15px]">
            <thead>
              <tr className="bg-page text-left text-[13px] font-bold text-muted">
                <th scope="col" className="w-16 px-6 py-3">Line</th>
                <th scope="col" className="w-44 px-4 py-3">Type</th>
                <th scope="col" className={`w-[38%] px-4 py-3 ${leftMine ? MINE_HEAD : ''}`}>
                  {oldLabel}
                </th>
                <th scope="col" className={`w-[38%] border-l border-line py-3 pl-6 pr-6 ${leftMine ? '' : MINE_HEAD}`}>
                  {newLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, limit).map((it) => (
                <tr key={it.id} className="border-t border-line-soft align-top">
                  <td className="px-6 py-4 font-semibold tabular-nums text-muted">{it.line ?? '–'}</td>
                  <td className="px-4 py-4">
                    <span className="flex flex-wrap gap-1.5">
                      {it.kinds.map((k) => (
                        <KindPill key={k} mode={mode} kind={k} />
                      ))}
                    </span>
                    {it.kinds.includes('seg') && (
                      <span className="mt-2 block text-[13px] leading-snug text-muted">
                        Same words, but the subtitles are split or joined differently.
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-pre-line px-4 py-4 leading-loose ${leftMine ? MINE_CELL : ''}`}>
                    <Side it={it} side={left} mark="old" />
                  </td>
                  <td className={`whitespace-pre-line border-l border-line py-4 pl-6 pr-6 leading-loose ${leftMine ? '' : MINE_CELL}`}>
                    <Side it={it} side={left === 'hyp' ? 'ref' : 'hyp'} mark="new" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 text-sm text-muted">
        <span>
          Showing {Math.min(limit, shown.length).toLocaleString()} of {shown.length.toLocaleString()}
          {shown.length !== items.length && ` (${items.length.toLocaleString()} in total)`}
        </span>
        {limit < shown.length && (
          <button onClick={() => setLimit((l) => l + PAGE)} className="min-h-11 px-2 font-semibold text-brand hover:text-brand-dark">
            Show {Math.min(PAGE, shown.length - limit)} more
          </button>
        )}
      </div>
    </section>
  );
}
