'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCompare } from '@/lib/compare-store';
import { deleteResult, fetchResults, renameResult, type ResultWithName } from '@/lib/results-db';
import { supabase, type Profile } from '@/lib/supabase';
import { formatDate, gradeFor, pct } from '@/lib/grades';
import { MODE_COLOR } from '@/lib/kinds';
import type { Mode } from '@/lib/compare/engine';
import { Card, GradeBadge, StatCard } from '@/components/ui';
import { TrendChart } from '@/components/TrendChart';
import { Spinner } from '@/components/Spinner';

const RANGES = [
  { id: '30', label: 'Last 30 days', days: 30 },
  { id: '90', label: 'Last 90 days', days: 90 },
  { id: 'year', label: 'This year', days: -1 },
  { id: 'all', label: 'All time', days: 0 },
];

const select = 'h-11 min-w-[180px] rounded-xl border border-field bg-white px-3 text-[15px] text-ink';
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export default function StatsPage() {
  const { session } = useAuth();
  const { lastMode } = useCompare();
  const [tab, setTab] = useState<Mode>(lastMode);
  const [rows, setRows] = useState<ResultWithName[] | null>(null);
  const [people, setPeople] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [who, setWho] = useState<string>('everyone');
  const [range, setRange] = useState('30');
  const [sort, setSort] = useState<'date' | 'score'>('date');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // which of your own rows is being renamed / asked to confirm delete
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults().then(({ rows, error }) => {
      setRows(rows);
      setError(error);
    });
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('full_name')
      .then(({ data }) => setPeople((data ?? []) as Profile[]));
  }, []);

  const me = session?.user.id ?? '';

  const saveName = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    const row = rows?.find((r) => r.id === editing.id);
    setEditing(null);
    if (!row || !name || name === row.case_name) return;
    const err = await renameResult(row.id, name);
    setActionError(err);
    if (!err) setRows((rs) => (rs ?? []).map((r) => (r.id === row.id ? { ...r, case_name: name } : r)));
  };

  const remove = async (id: number) => {
    setConfirmId(null);
    const err = await deleteResult(id);
    setActionError(err);
    if (!err) setRows((rs) => (rs ?? []).filter((r) => r.id !== id));
  };
  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name || 'Unknown';

  const inRange = useMemo(() => {
    const r = RANGES.find((x) => x.id === range)!;
    const now = new Date();
    const from =
      r.days > 0 ? new Date(now.getTime() - r.days * 864e5) : r.days < 0 ? new Date(now.getFullYear(), 0, 1) : new Date(0);
    return (rows ?? []).filter((x) => x.kind === tab && new Date(x.created_at) >= from);
  }, [rows, range, tab]);

  if (!rows) return <Spinner label="Loading stats" />;

  const isAcc = tab === 'accuracy';
  const focusId = who === 'everyone' ? me : who;
  const focusName = focusId === me ? 'My stats' : `${nameOf(focusId)}’s stats`;
  const mine = inRange.filter((x) => x.user_id === focusId); // newest first

  const cards = isAcc
    ? (() => {
        const scores = mine.map((x) => Number(x.score));
        const best = mine.reduce<ResultWithName | null>((b, x) => (!b || Number(x.score) > Number(b.score) ? x : b), null);
        const latest = mine[0];
        return [
          { label: 'Average accuracy', value: mine.length ? pct(avg(scores)) : '–', grade: mine.length ? avg(scores) : null, note: `across ${mine.length} case${mine.length === 1 ? '' : 's'}` },
          { label: 'Latest case', value: latest ? pct(Number(latest.score)) : '–', grade: latest ? Number(latest.score) : null, note: latest ? `${latest.case_name} · ${formatDate(latest.created_at)}` : 'No cases yet' },
          { label: 'Best case', value: best ? pct(Number(best.score)) : '–', grade: best ? Number(best.score) : null, note: best ? `${best.case_name} · ${formatDate(best.created_at)}` : 'No cases yet' },
          { label: 'Cases checked', value: String(mine.length), grade: null, note: RANGES.find((r) => r.id === range)!.label.toLowerCase() },
        ];
      })()
    : [
        { label: 'Total changes', value: sum(mine.map((x) => x.total_changes)).toLocaleString(), grade: null, note: `across ${mine.length} case${mine.length === 1 ? '' : 's'}` },
        { label: 'Average per case', value: mine.length ? Math.round(avg(mine.map((x) => x.total_changes))).toLocaleString() : '–', grade: null, note: mine.length ? `${pct(avg(mine.map((x) => Number(x.score))), 0)} of AI words changed` : 'No cases yet' },
        { label: 'Timestamps adjusted', value: sum(mine.map((x) => x.counts.time ?? 0)).toLocaleString(), grade: null, note: 'moved 0.25 s or more' },
        { label: 'Lines re-segmented', value: sum(mine.map((x) => x.counts.seg ?? 0)).toLocaleString(), grade: null, note: 'split, merged or re-broken' },
      ];

  const trend = mine
    .slice(0, 10)
    .reverse()
    .map((x) => ({
      label: `${x.case_name} · ${new Date(x.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      value: isAcc ? Number(x.score) : x.total_changes,
    }));

  // team board: one group per person
  const teamRows = who === 'everyone' ? inRange : inRange.filter((x) => x.user_id === who);
  const ids = Array.from(new Set(teamRows.map((x) => x.user_id))).sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  const groups = ids.map((id) => {
    const list = teamRows
      .filter((x) => x.user_id === id)
      .sort((a, b) => (sort === 'date' ? b.created_at.localeCompare(a.created_at) : Number(b.score) - Number(a.score)));
    return { id, name: nameOf(id), list };
  });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[32px] font-bold tracking-tight">Stats</h1>
          <p className="text-muted">Your progress and the whole team’s, case by case.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="who" className="text-[13px] font-semibold">Transcriber</label>
            <select id="who" value={who} onChange={(e) => setWho(e.target.value)} className={select}>
              <option value="everyone">Everyone</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name || 'Unnamed'}{p.id === me ? ' (you)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="range" className="text-[13px] font-semibold">Date range</label>
            <select id="range" value={range} onChange={(e) => setRange(e.target.value)} className={select}>
              {RANGES.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl border border-del-line bg-del-bg px-4 py-3 text-sm text-del-fg">Couldn’t load stats: {error}</p>}

      <div role="tablist" aria-label="Stats type" className="flex flex-wrap border-b border-field">
        {(['accuracy', 'effort'] as Mode[]).map((m) => {
          const on = tab === m;
          return (
            <button
              key={m}
              role="tab"
              aria-selected={on}
              onClick={() => setTab(m)}
              className={`-mb-px flex min-h-12 items-center gap-2.5 border-b-4 px-5 text-[15px] ${on ? 'bg-white font-bold text-ink' : 'border-transparent font-medium text-muted hover:text-ink'}`}
              style={on ? { borderBottomColor: MODE_COLOR[m] } : undefined}
            >
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: MODE_COLOR[m] }} />
              {m === 'accuracy' ? 'Accuracy · QA vs transcribers' : 'Effort · AI vs transcribers'}
            </button>
          );
        })}
      </div>

      <section aria-label={focusName} className="flex flex-col gap-4">
        <h2 className="text-xl font-bold">{focusName}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={
                <span className="flex items-center gap-2.5 text-[32px]">
                  {c.value}
                  {c.grade !== null && <GradeBadge percent={c.grade} />}
                </span>
              }
              note={c.note}
            />
          ))}
        </div>
        <TrendChart
          title={isAcc ? 'Accuracy over time' : 'Changes per case over time'}
          points={trend}
          color={MODE_COLOR[tab]}
          format={isAcc ? (v) => `${v.toFixed(1)}%` : (v) => Math.round(v).toLocaleString()}
          max={isAcc ? 100 : undefined}
        />
      </section>

      <section aria-label="Team" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold">Team</h2>
            <span className="text-[13px] text-muted">Visible to everyone on the team</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="sort" className="text-[13px] font-semibold">Sort cases by</label>
            <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as 'date' | 'score')} className={select}>
              <option value="date">Newest first</option>
              <option value="score">{isAcc ? 'Highest accuracy' : 'Most AI words changed'}</option>
            </select>
          </div>
        </div>

        {actionError && (
          <p role="alert" className="rounded-xl border border-del-line bg-del-bg px-4 py-3 text-sm text-del-fg">{actionError}</p>
        )}

        {groups.length === 0 && (
          <Card className="p-8 text-center text-muted">No {isAcc ? 'Accuracy' : 'Effort'} results in this date range yet.</Card>
        )}

        {groups.map((g) => {
          const open = expanded[g.id];
          const visible = open ? g.list : g.list.slice(0, 10);
          const a = avg(g.list.map((x) => Number(x.score)));
          return (
            <div key={g.id} className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-tint px-6 py-3 text-brand-dark">
                <span className="text-base font-bold">{g.name}</span>
                <span className="text-sm font-semibold">
                  {g.list.length} case{g.list.length === 1 ? '' : 's'} ·{' '}
                  {isAcc ? `average ${pct(a)} · ${gradeFor(a).letter}` : `average ${Math.round(avg(g.list.map((x) => x.total_changes)))} changes per case`}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-[15px]">
                  <thead>
                    <tr className="bg-page text-left text-[13px] font-bold text-muted">
                      <th scope="col" className="px-6 py-2.5">Case</th>
                      <th scope="col" className="w-36 px-4 py-2.5">Date</th>
                      <th scope="col" className="w-44 px-4 py-2.5">{isAcc ? 'Accuracy' : 'Changes'}</th>
                      <th scope="col" className="w-44 px-4 py-2.5">{isAcc ? 'Errors' : 'AI words changed'}</th>
                      <th scope="col" className="w-52 py-2.5 pl-4 pr-6"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((x) => (
                      <tr key={x.id} className="border-t border-line">
                        <td className="px-6 py-3 font-semibold">
                          {editing?.id === x.id ? (
                            <input
                              autoFocus
                              aria-label="Case name"
                              value={editing.name}
                              onChange={(e) => setEditing({ id: x.id, name: e.target.value })}
                              onFocus={(e) => e.target.select()}
                              onBlur={saveName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveName();
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              className="min-h-9 w-full rounded-lg border border-field bg-white px-2.5 font-semibold"
                            />
                          ) : (
                            x.case_name
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted">{formatDate(x.created_at)}</td>
                        <td className="px-4 py-3">
                          {isAcc ? (
                            <span className="inline-flex items-center gap-2.5 font-bold">
                              {pct(Number(x.score))} <GradeBadge percent={Number(x.score)} />
                            </span>
                          ) : (
                            <span className="font-bold">{x.total_changes.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isAcc ? `${x.total_errors.toLocaleString()} of ${x.ref_words.toLocaleString()} words` : `${pct(Number(x.score), 0)}${x.ai_tool ? ` · ${x.ai_tool}` : ''}`}
                        </td>
                        <td className="py-3 pl-4 pr-6">
                          {x.user_id === me && (
                            <span className="flex items-center justify-end gap-2">
                              {confirmId === x.id ? (
                                <>
                                  <span className="text-sm font-semibold">Delete?</span>
                                  <button onClick={() => remove(x.id)} className="min-h-9 rounded-lg bg-del-fg px-3 text-sm font-bold text-white hover:bg-del-strong">Yes, delete</button>
                                  <button onClick={() => setConfirmId(null)} className="min-h-9 rounded-lg border-[1.5px] border-field bg-white px-3 text-sm font-bold">Cancel</button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onMouseDown={(e) => editing?.id === x.id && e.preventDefault()}
                                    onClick={() => (editing?.id === x.id ? saveName() : setEditing({ id: x.id, name: x.case_name }))}
                                    className="min-h-9 rounded-lg border-[1.5px] border-brand bg-white px-3 text-sm font-bold text-brand hover:bg-tint-soft"
                                  >
                                    {editing?.id === x.id ? 'Save' : 'Rename'}
                                  </button>
                                  <button onClick={() => setConfirmId(x.id)} className="min-h-9 rounded-lg border-[1.5px] border-field bg-white px-3 text-sm font-bold text-ink hover:bg-page">Delete</button>
                                </>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {g.list.length > 10 && (
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [g.id]: !open }))}
                  className="min-h-11 border-t border-line px-6 text-left text-sm font-semibold text-brand hover:text-brand-dark"
                >
                  {open ? 'Show fewer' : `Show all ${g.list.length} cases`}
                </button>
              )}
            </div>
          );
        })}
      </section>
    </>
  );
}
