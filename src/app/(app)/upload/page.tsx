'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useCompare, type OpenComparison } from '@/lib/compare-store';
import { caseNameFromFile, compare, parseSrt, stripCredits, tokenize, type CompareResult, type Mode } from '@/lib/compare/engine';
import { saveResult } from '@/lib/results-db';
import { MODE_COLOR } from '@/lib/kinds';
import { DropZone, type LoadedFile } from '@/components/DropZone';
import { buttonPrimary } from '@/components/ui';

const MODES: Array<{ mode: Mode; title: string; refNoun: string }> = [
  { mode: 'accuracy', title: 'Accuracy · You vs QA', refNoun: 'QA version' },
  { mode: 'effort', title: 'Effort · You vs AI', refNoun: 'AI template' },
];

const parse = (text: string) => {
  const cues = stripCredits(parseSrt(text)).cues;
  return { lines: cues.length, words: tokenize(cues).length };
};

export default function UploadPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { setCurrent, lastMode, setLastMode } = useCompare();
  const [mode, setMode] = useState<Mode>(lastMode);
  const [mine, setMine] = useState<LoadedFile | null>(null);
  // keep each mode's reference file separately so switching tabs doesn't lose it
  const [refs, setRefs] = useState<Record<Mode, LoadedFile | null>>({ accuracy: null, effort: null });
  const [caseName, setCaseName] = useState('');
  const [aiTool, setAiTool] = useState('ElevenLabs');
  const [busy, setBusy] = useState(false);
  const [mismatch, setMismatch] = useState<{ result: CompareResult; ratio: number } | null>(null);

  const current = MODES.find((m) => m.mode === mode)!;
  const ref = refs[mode];
  const ready = !!mine && !!ref && caseName.trim().length > 0 && (mode === 'accuracy' || aiTool.trim().length > 0);

  const pickMode = (m: Mode) => {
    setMode(m);
    setLastMode(m);
  };

  const onMine = (f: LoadedFile | null) => {
    setMine(f);
    setMismatch(null);
    if (f) setCaseName(caseNameFromFile(f.name));
  };

  const run = async () => {
    if (!mine || !ref || !session) return;
    setBusy(true);
    setMismatch(null);
    // let the button show its busy state before the (fast, but synchronous) comparison runs
    await new Promise((r) => setTimeout(r, 20));
    const result = compare(ref.text, mine.text, mode);
    // very different lengths usually means the wrong file or only part of the case
    const ratio = result.refWords ? result.hypWords / result.refWords : 1;
    if (ratio < 0.6 || ratio > 1.67) {
      setMismatch({ result, ratio });
      setBusy(false);
      return;
    }
    await finish(result);
  };

  const finish = async (result: CompareResult) => {
    if (!session) return;
    setBusy(true);
    const open: OpenComparison = {
      mode,
      caseName: caseName.trim(),
      aiTool: mode === 'effort' ? aiTool.trim() : null,
      result,
      savedAt: null,
      saveError: null,
    };
    const saved = await saveResult(open, session.user.id);
    setCurrent({ ...open, savedAt: saved.createdAt, saveError: saved.error });
    router.push('/results');
  };

  return (
    <>
      <p className="text-muted">Files uploaded are not saved. Only the score is saved.</p>

      <div role="tablist" aria-label="Comparison type" className="grid max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-2">
        {MODES.map((m) => {
          const on = m.mode === mode;
          return (
            <button
              key={m.mode}
              role="tab"
              aria-selected={on}
              onClick={() => pickMode(m.mode)}
              className={`flex min-h-16 items-center rounded-xl border-[1.5px] px-5 py-4 text-left ${on ? 'border-brand bg-brand text-white' : 'border-line bg-white text-ink hover:border-field'}`}
            >
              <span className="text-base font-bold">{m.title}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-6">
        <DropZone title="My transcript" noun="transcript" barColor="#0F766E" file={mine} onFile={onMine} parse={parse} />
        <DropZone
          key={mode}
          title={current.refNoun}
          noun={current.refNoun}
          barColor={MODE_COLOR[mode]}
          file={ref}
          onFile={(f) => {
            setRefs((r) => ({ ...r, [mode]: f }));
            setMismatch(null);
          }}
          parse={parse}
        />
      </div>

      <div className="flex flex-wrap items-end gap-6 rounded-[20px] border border-line bg-white p-6">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
          <label htmlFor="case" className="text-sm font-semibold">Case name</label>
          <input
            id="case"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="Filled in from your file name"
            className="h-12 rounded-xl border border-field bg-white px-3.5 text-base"
          />
        </div>
        {mode === 'effort' && (
          <div className="flex min-w-0 flex-[0_1_220px] flex-col gap-2">
            <label htmlFor="tool" className="text-sm font-semibold">AI tool</label>
            <input id="tool" value={aiTool} onChange={(e) => setAiTool(e.target.value)} className="h-12 rounded-xl border border-field bg-white px-3.5 text-base" />
          </div>
        )}
        <button onClick={run} disabled={!ready || busy} className={`${buttonPrimary} px-8 text-base`}>
          {busy ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {mismatch && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border border-[#C2510F] bg-[#FDEEE4] p-5">
          <p className="font-bold">These two files might not belong together</p>
          <p className="text-[15px]">
            Your transcript has {(mine?.words ?? mismatch.result.hypWords).toLocaleString()} words and the {current.refNoun} has{' '}
            {(ref?.words ?? mismatch.result.refWords).toLocaleString()}. That usually means a wrong file, or only part of the case. Saving it would add a misleading score to your stats.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setMismatch(null)} className="inline-flex h-12 items-center rounded-xl border-[1.5px] border-ink bg-white px-5 font-bold">
              Check the files
            </button>
            <button
              onClick={() => finish(mismatch.result)}
              disabled={busy}
              className="inline-flex h-11 items-center px-3 font-semibold text-brand hover:text-brand-dark disabled:opacity-60"
            >
              Compare and save anyway
            </button>
          </div>
        </div>
      )}
    </>
  );
}
