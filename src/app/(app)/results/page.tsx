'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useCompare } from '@/lib/compare-store';
import { saveResult } from '@/lib/results-db';
import { supabase } from '@/lib/supabase';
import { formatDate, gradeFor, pct } from '@/lib/grades';
import { MODE_COLOR } from '@/lib/kinds';
import { ChangeTable } from '@/components/ChangeTable';
import { Card, GradeBadge, KindBreakdown, Pill, StatCard, buttonPrimary, buttonSecondary } from '@/components/ui';

export default function ResultsPage() {
  const { session } = useAuth();
  const { current, setCurrent } = useCompare();
  const [average, setAverage] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);

  // the user's earlier average for the same kind of comparison, for a friendly comparison line
  useEffect(() => {
    if (!current || !session || current.mode !== 'accuracy') return;
    supabase
      .from('results')
      .select('score, created_at')
      .eq('user_id', session.user.id)
      .eq('kind', 'accuracy')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const earlier = (data ?? []).filter((r) => r.created_at !== current.savedAt).map((r) => Number(r.score));
        setAverage(earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : null);
      });
  }, [current, session]);

  if (!current) {
    return (
      <Card className="mx-auto mt-10 flex max-w-[560px] flex-col items-start gap-4 p-8">
        <h1 className="text-2xl font-bold">No comparison open</h1>
        <p className="text-muted">
          Results only stay on screen until you refresh or leave, so transcripts never get stored. Your score was saved, and you can find it in Stats.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/upload" className={buttonPrimary}>Start a comparison</Link>
          <Link href="/stats" className={buttonSecondary}>View stats</Link>
        </div>
      </Card>
    );
  }

  const { mode, result: r, caseName } = current;
  const isAcc = mode === 'accuracy';
  const score = r.accuracy * 100;

  const retry = async () => {
    if (!session) return;
    setRetrying(true);
    const saved = await saveResult(current, session.user.id);
    setCurrent({ ...current, savedAt: saved.createdAt, saveError: saved.error });
    setRetrying(false);
  };

  let praise = false; // gold is only for praise
  let encouragement =
    r.totalChanges > 0 ? 'That’s careful work on this case. Nice job.' : 'The AI template needed no changes this time.';
  if (isAcc) {
    const g = gradeFor(score).letter;
    if (average !== null) {
      const diff = score - average;
      praise = diff >= 0.05;
      encouragement =
        diff >= 0.05
          ? `↑ ${diff.toFixed(1)} pts above your average`
          : diff <= -0.05
            ? `${Math.abs(diff).toFixed(1)} points below your average. Check the mistakes below for patterns.`
            : 'Right on your average.';
    } else {
      praise = g === 'A';
      encouragement = g === 'A' ? 'Great work.' : 'Check the mistakes below for patterns.';
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/upload" className="text-sm font-medium">← Back to Upload</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] font-bold tracking-tight">{caseName}</h1>
            <Pill bg={MODE_COLOR[mode]} fg="#FFFFFF">{isAcc ? 'Accuracy · You vs QA' : 'Effort · You vs AI'}</Pill>
            {current.aiTool && <Pill bg="#EEF1EF" fg="#17262B">{current.aiTool}</Pill>}
          </div>
          {current.saveError ? (
            <p role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[#F2B8B0] bg-del-bg px-4 py-2.5 text-sm text-del-fg">
              Your score couldn’t be saved: {current.saveError}
              <button onClick={retry} disabled={retrying} className="font-bold underline">
                {retrying ? 'Trying…' : 'Try again'}
              </button>
            </p>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F766E" strokeWidth="2.4">
                <path d="M5 12l5 5 9-10" />
              </svg>
              Saved to your stats{current.savedAt ? ` · ${formatDate(current.savedAt)}` : ''}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/upload" className={buttonSecondary}>Compare another</Link>
          <Link href="/stats" className={buttonPrimary}>View stats</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isAcc ? (
          <>
            <section className="flex flex-wrap items-center gap-6 rounded-[20px] bg-brand p-6 text-white sm:col-span-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/80">Accuracy</span>
                <span className="font-heading text-[64px] font-bold leading-none tracking-tighter">
                  {score.toFixed(1)}
                  <span className="text-gold">%</span>
                </span>
              </div>
              <div className="flex flex-col items-start gap-2.5">
                <GradeBadge percent={score} size="lg" />
                <Encouragement text={encouragement} praise={praise} />
              </div>
            </section>
            <StatCard label="Errors" value={r.totalErrors.toLocaleString()} note="corrections by the QA" />
            <StatCard
              label="Words in QA version"
              value={r.refWords.toLocaleString()}
              note={`${r.refLines ? Math.round((r.cleanLines / r.refLines) * 100) : 0}% of lines exactly right`}
            />
          </>
        ) : (
          <>
            <section className="flex flex-col gap-2.5 rounded-[20px] bg-brand p-6 text-white sm:col-span-2">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-white/80">Changes you made</span>
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="font-heading text-[64px] font-bold leading-none tracking-tighter">{r.totalChanges.toLocaleString()}</span>
                <span className="text-lg font-semibold">
                  <span className="text-gold">{pct(r.changedShare * 100, 0)}</span> of the AI&apos;s words changed
                </span>
              </div>
              <span className="text-[15px] text-white/90">{encouragement}</span>
            </section>
            <StatCard label="Lines re-segmented" value={r.counts.seg.toLocaleString()} note="split, merged or re-broken" />
            <StatCard label="Timestamps adjusted" value={r.counts.time.toLocaleString()} note="moved 0.25 s or more" />
          </>
        )}
      </div>

      <KindBreakdown
        mode={mode}
        counts={r.counts}
        title={isAcc ? 'Errors by type' : 'Changes by type'}
        aside={isAcc ? undefined : `AI template: ${r.refWords.toLocaleString()} words`}
      />

      {r.skipped.length > 0 && (
        <Card className="flex flex-col gap-4 p-6">
          <h2 className="text-lg font-bold">Not counted against you</h2>
          {(
            [
              ['qa', 'Added by the QA', 'in the QA version have nothing matching in your transcript, so they look like voiceover added later.'],
              ['you', 'Cut from the video', 'in your transcript have nothing matching in the QA version, so they look like footage that was cut before QA.'],
            ] as const
          ).map(([side, title, why]) => {
            const xs = r.skipped.filter((x) => x.side === side);
            if (xs.length === 0) return null;
            return (
              <div key={side} className="flex flex-col gap-1.5">
                <h3 className="font-bold">{title}</h3>
                <p className="text-[15px] text-muted">
                  {xs.length} subtitle{xs.length === 1 ? '' : 's'} ({lineRanges(xs.map((x) => x.n))}) {why}
                </p>
                <details className="text-[15px]">
                  <summary className="cursor-pointer font-semibold text-brand">Show these lines</summary>
                  <ul className="mt-2 flex flex-col gap-1">
                    {xs.map((x) => (
                      <li key={x.n} className="flex gap-3">
                        <span className="w-10 shrink-0 font-semibold tabular-nums text-muted">{x.n}</span>
                        <span>{x.text}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            );
          })}
        </Card>
      )}

      <ChangeTable
        mode={mode}
        items={r.items}
        counts={r.counts}
        title={isAcc ? 'You vs QA' : 'You vs AI'}
        oldLabel={isAcc ? 'You' : 'AI'}
        newLabel={isAcc ? 'QA' : 'You'}
        left={isAcc ? 'hyp' : 'ref'}
      />
    </>
  );
}

/** [260,261,262,263,270] -> "260–263, 270" */
function lineRanges(nums: number[]): string {
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}–${nums[j]}` : String(nums[i]));
    i = j;
  }
  return out.join(', ');
}

/** Praise gets a gold pill (ink text, never white on gold); everything else is plain white text on the teal card. */
function Encouragement({ text, praise }: { text: string; praise: boolean }) {
  if (praise) return <span className="rounded-full bg-gold px-3 py-1 text-sm font-semibold text-ink">{text}</span>;
  return <span className="text-sm text-white/90">{text}</span>;
}
