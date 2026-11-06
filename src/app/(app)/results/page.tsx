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
        <h1 className="text-2xl font-extrabold">No comparison open</h1>
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

  let encouragement =
    r.totalChanges > 0 ? 'That’s careful work on this case. Nice job.' : 'The AI template needed no changes this time.';
  if (isAcc) {
    const g = gradeFor(score).letter;
    if (average !== null) {
      const diff = score - average;
      encouragement =
        diff >= 0.05
          ? `${g === 'A' ? 'Great work. ' : ''}${diff.toFixed(1)} points above your average.`
          : diff <= -0.05
            ? `${Math.abs(diff).toFixed(1)} points below your average. Check the mistakes below for patterns.`
            : 'Right on your average.';
    } else encouragement = g === 'A' ? 'Great work.' : 'Check the mistakes below for patterns.';
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2.5">
          <Link href="/upload" className="text-sm font-medium">← Back to Upload</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[32px] font-extrabold tracking-tight">{caseName}</h1>
            <Pill bg={MODE_COLOR[mode]} fg="#FFFFFF">{isAcc ? 'Accuracy · You vs QA' : 'Effort · You vs AI'}</Pill>
            {current.aiTool && <Pill bg="#E1E4EC" fg="#1F2433">{current.aiTool}</Pill>}
          </div>
          {current.saveError ? (
            <p role="alert" className="flex flex-wrap items-center gap-3 border border-[#C62F46] bg-del-bg px-4 py-2.5 text-sm text-del-fg">
              Your score couldn’t be saved: {current.saveError}
              <button onClick={retry} disabled={retrying} className="font-bold underline">
                {retrying ? 'Trying…' : 'Try again'}
              </button>
            </p>
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2E8B57" strokeWidth="2.4">
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
            <Card accent={MODE_COLOR.accuracy} className="flex flex-wrap items-center gap-6 p-6 sm:col-span-2">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-muted">Accuracy</span>
                <span className="text-[64px] font-extrabold leading-none tracking-tighter">{pct(score)}</span>
              </div>
              <div className="flex flex-col items-start gap-2">
                <GradeBadge percent={score} size="lg" />
                <span className="text-sm text-muted">{encouragement}</span>
              </div>
            </Card>
            <StatCard label="Errors" value={r.totalErrors.toLocaleString()} note="corrections by the QA" />
            <StatCard
              label="Words in QA version"
              value={r.refWords.toLocaleString()}
              note={`${r.refLines ? Math.round((r.cleanLines / r.refLines) * 100) : 0}% of lines exactly right`}
            />
          </>
        ) : (
          <>
            <Card accent={MODE_COLOR.effort} className="flex flex-col gap-2.5 p-6 sm:col-span-2">
              <span className="text-sm font-semibold text-muted">Changes you made</span>
              <div className="flex flex-wrap items-baseline gap-4">
                <span className="text-[64px] font-extrabold leading-none tracking-tighter">{r.totalChanges.toLocaleString()}</span>
                <span className="text-lg font-semibold">{pct(r.changedShare * 100, 0)} of the AI&apos;s words changed</span>
              </div>
              <span className="text-[15px] text-muted">{encouragement}</span>
            </Card>
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
