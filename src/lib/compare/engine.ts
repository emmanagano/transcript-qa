/**
 * SRT comparison engine.
 *
 * Runs entirely in the browser: nothing here touches the network.
 *
 * - Accuracy mode: reference = QA's SRT, hypothesis = transcriber's SRT.
 * - Effort mode:   reference = AI template, hypothesis = transcriber's SRT.
 *
 * Both files are flattened into one stream of words and aligned word by word,
 * so different line splits never cause false mistakes. Every difference is then
 * classified (wrong / missed / extra word, punctuation, capitalization, dialog dash).
 * Effort mode also counts re-segmented lines and adjusted timestamps.
 */

export type Mode = 'accuracy' | 'effort';
export type ErrKind = 'wrong' | 'missed' | 'extra' | 'punct' | 'caps' | 'dash';
export type Kind = ErrKind | 'seg' | 'time';

export interface Cue {
  n: number; // position in the original file, 1-based
  start: number; // ms
  end: number; // ms
  lines: string[];
}

export interface Tok {
  raw: string;
  key: string;
  cue: number; // index into the cue array
  line: number;
  lineStart: boolean;
  lineEnd: boolean;
  dash: boolean; // the line this word starts begins with "- "
  cueLines: number; // how many text lines its subtitle has
}

export interface Op {
  r: number; // reference token index, -1 if none
  h: number; // hypothesis token index, -1 if none
  errs: ErrKind[];
}

export interface Piece {
  text: string;
  changed: boolean;
  caret?: boolean; // marks where a word is missing
}

export interface ChangeItem {
  id: number;
  line: number | null; // cue number in the reference file
  kinds: Kind[];
  ref: Piece[];
  hyp: Piece[];
  /** re-segmented rows only: the text of each whole subtitle on each side, so the table can draw them as boxes */
  refCues?: string[];
  hypCues?: string[];
}

export type Counts = Record<Kind, number>;

export interface CompareResult {
  mode: Mode;
  transcriber: string | null;
  refWords: number;
  hypWords: number;
  refLines: number;
  hypLines: number;
  counts: Counts;
  wordErrors: number; // wrong + missed + extra
  formatErrors: number; // punct + caps + dash
  totalErrors: number; // word + format
  accuracy: number; // 0..1, accuracy mode headline
  changedShare: number; // 0..1, share of reference words changed (effort headline)
  totalChanges: number; // effort: errors + re-segmented lines + adjusted timestamps
  cleanLines: number; // reference lines with no errors
  linesAdded: number;
  linesRemoved: number;
  items: ChangeItem[];
  /**
   * Whole subtitles with no counterpart in the other file, left out of the score because nobody corrected them:
   * side 'qa' = narration the QA's editor added, side 'you' = footage the editor cut before QA.
   */
  skipped: { side: 'qa' | 'you'; n: number; text: string }[];
}

export const TIMESTAMP_THRESHOLD_MS = 250;

// ---------------------------------------------------------------- parsing

const TS =
  /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/;

const toMs = (h: string, m: string, s: string, ms: string) =>
  ((+h * 60 + +m) * 60 + +s) * 1000 + +ms.padEnd(3, '0');

// Formatting that is not spoken text: <font color='...'>, <b>, <i>, <u>, WebVTT <c.yellow>, {\an8} / {\c&HFFFF&}
// position and colour codes, and HTML entities. Removed so it can never count as an error.
// Only real-looking tags are removed, so "(Unintelligible)" and a stray "<" in normal text are untouched.
const MARKUP = /<\/?[a-z][a-z0-9._:-]*(?:\s[^>]*)?>|\{\\[^}]*\}/gi;
const ENTITIES: Record<string, string> = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

export function stripMarkup(line: string): string {
  return line
    .replace(MARKUP, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos);/gi, (e) => ENTITIES[e.toLowerCase()])
    .replace(/\s{2,}/g, ' ');
}

export function parseSrt(text: string): Cue[] {
  const lines = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const cues: Cue[] = [];
  let cur: Cue | null = null;
  for (const line of lines) {
    const t = line.match(TS);
    if (t) {
      // the index number line before a timestamp belongs to the new cue, not the old one
      if (cur && cur.lines.length && /^\d+$/.test(cur.lines[cur.lines.length - 1])) cur.lines.pop();
      cur = {
        n: cues.length + 1,
        start: toMs(t[1], t[2], t[3], t[4]),
        end: toMs(t[5], t[6], t[7], t[8]),
        lines: [],
      };
      cues.push(cur);
      continue;
    }
    if (!cur) continue;
    const clean = stripMarkup(line).trim();
    if (clean === '') continue;
    cur.lines.push(clean);
  }
  return dropCutMarkers(cues).filter((c) => c.lines.length > 0);
}

// "[Cut]" is put in by the video editor where footage was removed. It is not spoken text, so it
// never counts as an error, wherever it appears in the file. Matches "[Cut]", "- [CUT]", "[ cut ]".
const CUT_LINE = /^-?\s*\[\s*cut\s*\]\s*$/i;
const CUT_INLINE = /\[\s*cut\s*\]/gi;

function dropCutMarkers(cues: Cue[]): Cue[] {
  return cues.map((c) => {
    const kept = c.lines.filter((l) => !CUT_LINE.test(l)).map((l) => l.replace(CUT_INLINE, ' ').replace(/\s{2,}/g, ' ').trim());
    // a two-speaker cue that lost one speaker no longer needs its dialog dash
    if (kept.length === 1 && c.lines.length > 1) kept[0] = kept[0].replace(/^-\s+/, '');
    return { ...c, lines: kept.filter(Boolean) };
  });
}

// "Transcribed by Emma", "- Transcribed by Darrel", "*Emma*"
const CREDIT = /^-?\s*(?:transcribed\s+by\s+(.+?)|\*\s*([^*]+?)\s*\*)\s*$/i;

export function stripCredits(cues: Cue[]): { cues: Cue[]; name: string | null } {
  let name: string | null = null;
  const out: Cue[] = [];
  cues.forEach((c, ci) => {
    if (ci > 2) {
      out.push(c);
      return;
    }
    const kept: string[] = [];
    for (const l of c.lines) {
      const m = l.match(CREDIT);
      if (m) name = name ?? (m[1] || m[2]).trim();
      else kept.push(l);
    }
    // a credit shared a two-speaker cue: the remaining single line no longer needs its dash
    if (kept.length === 1 && kept.length < c.lines.length) kept[0] = kept[0].replace(/^-\s+/, '');
    if (kept.length) out.push({ ...c, lines: kept });
  });
  return { cues: out, name };
}

// ---------------------------------------------------------------- tokens

const canonQuotes = (s: string) =>
  s
    .replace(/[‘’ʼ`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...');

export function keyOf(raw: string): string {
  return canonQuotes(raw)
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
    .replace(/[^a-z0-9'\-]/g, '');
}

export function tokenize(cues: Cue[]): Tok[] {
  const toks: Tok[] = [];
  cues.forEach((c, ci) => {
    c.lines.forEach((line, li) => {
      const parts = line.split(/\s+/).filter(Boolean);
      let first = true;
      let dash = false;
      let lastIdx = -1;
      for (const p of parts) {
        if (/^[-–—]$/.test(p)) {
          if (first) dash = true;
          continue;
        }
        const key = keyOf(p);
        if (!key) {
          // standalone punctuation such as "..." sticks to the previous word on this line
          if (lastIdx >= 0) toks[lastIdx].raw += ' ' + p;
          continue;
        }
        toks.push({
          raw: canonQuotes(p),
          key,
          cue: ci,
          line: li,
          lineStart: first,
          lineEnd: false,
          dash: first && dash,
          cueLines: c.lines.length,
        });
        lastIdx = toks.length - 1;
        first = false;
      }
      if (lastIdx >= 0) toks[lastIdx].lineEnd = true;
    });
  });
  return toks;
}

// ---------------------------------------------------------------- alignment

type Coarse = ['=' | '-' | '+', number, number];

/** Myers diff on word keys. '-' = only in a, '+' = only in b. */
export function myers(a: string[], b: string[]): Coarse[] {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace: Int32Array[] = [];
  outer: for (let d = 0; d <= max; d++) {
    trace.push(v.slice(off - d - 1, off + d + 2)); // window k = -d-1 .. d+1
    for (let k = -d; k <= d; k += 2) {
      let x =
        k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[off + k] = x;
      if (x >= n && y >= m) break outer;
    }
  }
  const ops: Coarse[] = [];
  let x = n;
  let y = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const w = trace[d];
    const get = (k: number) => w[k + d + 1];
    const k = x - y;
    let prevK = 0;
    if (d > 0) prevK = k === -d || (k !== d && get(k - 1) < get(k + 1)) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : get(prevK);
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push(['=', x - 1, y - 1]);
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push(['+', -1, y - 1]);
      else ops.push(['-', x - 1, -1]);
      x = prevX;
      y = prevY;
    }
  }
  return ops.reverse();
}

function charSim(a: string, b: string): number {
  if (a === b) return 1;
  const n = a.length;
  const m = b.length;
  if (!n || !m) return 0;
  let prev = new Array<number>(m + 1);
  let cur = new Array<number>(m + 1);
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    cur[0] = i;
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    [prev, cur] = [cur, prev];
  }
  return 1 - prev[m] / Math.max(n, m);
}

/** Pair up words inside one changed region (A = reference words, B = hypothesis words). */
function alignRegion(A: Tok[], B: Tok[]): Array<[number, number]> {
  const n = A.length;
  const m = B.length;
  if (!n) return B.map((_, j) => [-1, j] as [number, number]);
  if (!m) return A.map((_, i) => [i, -1] as [number, number]);
  if (n * m > 160000) {
    const r: Array<[number, number]> = [];
    const k = Math.min(n, m);
    for (let i = 0; i < k; i++) r.push([i, i]);
    for (let i = k; i < n; i++) r.push([i, -1]);
    for (let j = k; j < m; j++) r.push([-1, j]);
    return r;
  }
  const D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
  const P = Array.from({ length: n + 1 }, () => new Uint8Array(m + 1));
  for (let i = 1; i <= n; i++) {
    D[i][0] = i;
    P[i][0] = 1;
  }
  for (let j = 1; j <= m; j++) {
    D[0][j] = j;
    P[0][j] = 2;
  }
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = charSim(A[i - 1].key, B[j - 1].key);
      // a substitution always beats a delete + insert; similar words pair up first
      const sub = D[i - 1][j - 1] + (sim === 1 ? 0 : 1 + (1 - sim) * 0.6);
      const del = D[i - 1][j] + 1;
      const ins = D[i][j - 1] + 1;
      if (sub <= del && sub <= ins) {
        D[i][j] = sub;
        P[i][j] = 3;
      } else if (del <= ins) {
        D[i][j] = del;
        P[i][j] = 1;
      } else {
        D[i][j] = ins;
        P[i][j] = 2;
      }
    }
  }
  const r: Array<[number, number]> = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const p = P[i][j];
    if (p === 3) {
      r.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (p === 1) {
      r.push([i - 1, -1]);
      i--;
    } else {
      r.push([-1, j - 1]);
      j--;
    }
  }
  return r.reverse();
}

// ---------------------------------------------------------------- classification

const lettersOnly = (s: string) => s.replace(/[^A-Za-z0-9]/g, '');
const punctOnly = (s: string) => canonQuotes(s).replace(/[A-Za-z0-9]/g, '');
const dropEndCommaPeriod = (s: string) => s.replace(/[,.]$/, '');

function classifyPair(ref: Tok, hyp: Tok, mode: Mode): ErrKind[] {
  const errs: ErrKind[] = [];
  if (ref.key !== hyp.key) {
    errs.push('wrong');
  } else if (ref.raw !== hyp.raw) {
    const caps = lettersOnly(ref.raw) !== lettersOnly(hyp.raw);
    const punct = punctOnly(ref.raw) !== punctOnly(hyp.raw);
    // a trailing comma/period that differs only because one side ends a line here
    // comes from a moved line break, which doesn't count
    const lineBreakOnly =
      !caps &&
      punct &&
      ref.lineEnd !== hyp.lineEnd &&
      dropEndCommaPeriod(ref.raw) === dropEndCommaPeriod(hyp.raw);
    if (caps) errs.push('caps');
    if (punct && !lineBreakOnly) errs.push('punct');
  }
  if (mode === 'accuracy') {
    // dialog dashes only compare when both subtitles have the same line structure;
    // if one side was split or merged differently, the dash follows the segmenting (which doesn't count)
    if (ref.lineStart && hyp.lineStart && ref.cueLines === hyp.cueLines && ref.dash !== hyp.dash) errs.push('dash');
  } else {
    // effort: splitting the AI's run-together dialog into "- " lines (or removing a wrong dash) is real work
    const refDash = ref.lineStart && ref.dash;
    const hypDash = hyp.lineStart && hyp.dash;
    if (refDash !== hypDash && (ref.lineStart || hyp.lineStart)) errs.push('dash');
  }
  return errs;
}

// ---------------------------------------------------------------- main

const emptyCounts = (): Counts => ({
  wrong: 0,
  missed: 0,
  extra: 0,
  punct: 0,
  caps: 0,
  dash: 0,
  seg: 0,
  time: 0,
});

export function formatTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (x: number, w = 2) => String(x).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

/** A run of this many whole subtitles with nothing matching in the other file is left out of the score. */
export const SKIP_MIN_RUN = 3;

/**
 * If more than this share of a file's subtitles would be skipped, it is probably the wrong file or only part of
 * the case, not a few cuts or voiceovers. Nothing is skipped then, so the "might not belong together" warning still fires.
 */
export const SKIP_MAX_SHARE = 0.25;

/** Indices that sit in runs of >= SKIP_MIN_RUN consecutive flagged cues. */
function longRuns(flags: boolean[]): Set<number> {
  const out = new Set<number>();
  let run: number[] = [];
  const end = () => {
    if (run.length >= SKIP_MIN_RUN) run.forEach((i) => out.add(i));
    run = [];
  };
  flags.forEach((f, i) => (f ? run.push(i) : end()));
  end();
  return out;
}

export function compare(refText: string, hypText: string, mode: Mode): CompareResult {
  const ref = stripCredits(parseSrt(refText));
  const hyp = stripCredits(parseSrt(hypText));
  const first = analyze(ref.cues, hyp.cues, hyp.name, mode);
  if (mode !== 'accuracy') return first.result;

  // Nobody corrects a whole line that has no partner in the other file, so it is not an error:
  //  - QA side: narration the QA's video editor added (formatted like dialogue, so found by shape: not a "- " line)
  //  - transcriber side: footage the editor cut from the video, and its subtitles, before QA
  // Only runs of SKIP_MIN_RUN+ lines count, so a single line the QA deleted or the transcriber forgot still does.
  const isDialogue = (c: Cue) => c.lines.some((l) => /^[-–—]\s/.test(l));
  const capped = (drop: Set<number>, total: number) => (drop.size > total * SKIP_MAX_SHARE ? new Set<number>() : drop);
  const dropQa = capped(longRuns(ref.cues.map((c, i) => first.wholeMissed[i] && !isDialogue(c))), ref.cues.length);
  const dropYou = capped(longRuns(hyp.cues.map((_, i) => first.wholeExtra[i])), hyp.cues.length);
  if (dropQa.size === 0 && dropYou.size === 0) return first.result;

  const result = analyze(
    ref.cues.filter((_, i) => !dropQa.has(i)),
    hyp.cues.filter((_, i) => !dropYou.has(i)),
    hyp.name,
    mode,
  ).result;
  result.skipped = [
    ...ref.cues.flatMap((c, i) => (dropQa.has(i) ? [{ side: 'qa' as const, n: c.n, text: c.lines.join(' ') }] : [])),
    ...hyp.cues.flatMap((c, i) => (dropYou.has(i) ? [{ side: 'you' as const, n: c.n, text: c.lines.join(' ') }] : [])),
  ];
  return result;
}

function analyze(
  refCues: Cue[],
  hypCues: Cue[],
  hypName: string | null,
  mode: Mode,
): { result: CompareResult; wholeMissed: boolean[]; wholeExtra: boolean[] } {
  const R = tokenize(refCues);
  const H = tokenize(hypCues);

  // 1) coarse diff on normalised words, 2) refine each changed region
  const coarse = myers(
    R.map((t) => t.key),
    H.map((t) => t.key),
  );
  const ops: Op[] = [];
  let bufR: number[] = [];
  let bufH: number[] = [];
  const flush = () => {
    if (!bufR.length && !bufH.length) return;
    for (const [i, j] of alignRegion(
      bufR.map((x) => R[x]),
      bufH.map((x) => H[x]),
    )) {
      const r = i >= 0 ? bufR[i] : -1;
      const h = j >= 0 ? bufH[j] : -1;
      if (r >= 0 && h >= 0) ops.push({ r, h, errs: classifyPair(R[r], H[h], mode) });
      else ops.push({ r, h, errs: [r >= 0 ? 'missed' : 'extra'] });
    }
    bufR = [];
    bufH = [];
  };
  for (const [t, i, j] of coarse) {
    if (t === '=') {
      flush();
      ops.push({ r: i, h: j, errs: classifyPair(R[i], H[j], mode) });
    } else if (t === '-') bufR.push(i);
    else bufH.push(j);
  }
  flush();

  const counts = emptyCounts();
  for (const o of ops) for (const e of o.errs) counts[e]++;

  // ---- lines: which reference cue maps to which hypothesis cue
  const refToHyp = refCues.map(() => new Set<number>());
  const hypToRef = hypCues.map(() => new Set<number>());
  const refCueHasError = new Array<boolean>(refCues.length).fill(false);
  for (const o of ops) {
    if (o.r >= 0 && o.h >= 0) {
      refToHyp[R[o.r].cue].add(H[o.h].cue);
      hypToRef[H[o.h].cue].add(R[o.r].cue);
    }
    if (o.errs.length && o.r >= 0) refCueHasError[R[o.r].cue] = true;
  }
  // a reference line that lost its neighbouring extra words also counts as not clean
  ops.forEach((o, idx) => {
    if (o.r < 0 && o.errs.length) {
      const nb = ops[idx - 1]?.r ?? -1;
      if (nb >= 0) refCueHasError[R[nb].cue] = true;
    }
  });
  const cleanLines = refCues.filter((_, i) => !refCueHasError[i]).length;
  const linesAdded = hypToRef.filter((s) => s.size === 0).length;
  const linesRemoved = refToHyp.filter((s) => s.size === 0).length;

  // ---- tokens by cue, for showing whole lines around a change
  const cueToks = (toks: Tok[], nCues: number) => {
    const by: number[][] = Array.from({ length: nCues }, () => []);
    toks.forEach((t, i) => by[t.cue].push(i));
    return by;
  };
  const refByCue = cueToks(R, refCues.length);
  const hypByCue = cueToks(H, hypCues.length);

  const items: ChangeItem[] = [];

  // ---- word / formatting changes, grouped into contiguous regions
  const regions: number[][] = [];
  let curRegion: number[] | null = null;
  // a run of only missed words (or only extra words) is one row, even across several lines, so the other
  // side's neighbouring line is shown once instead of repeated next to every line. It splits when the kind flips.
  const pureCue = (o: Op) => (o.h < 0 && o.r >= 0 ? 'r' : o.r < 0 && o.h >= 0 ? 'h' : null);
  ops.forEach((o, idx) => {
    if (!o.errs.length) {
      curRegion = null;
      return;
    }
    const prev = idx > 0 ? ops[idx - 1] : null;
    const here = pureCue(o);
    if (curRegion && prev && here && pureCue(prev) && here !== pureCue(prev)) curRegion = null;
    if (!curRegion) {
      curRegion = [];
      regions.push(curRegion);
    }
    curRegion.push(idx);
  });

  const sidePieces = (
    regionOps: number[],
    side: 'r' | 'h',
    toks: Tok[],
    byCue: number[][],
  ): { pieces: Piece[]; cue: number | null } => {
    const inRegion = regionOps.map((i) => ops[i][side]).filter((x) => x >= 0);
    const changed = new Set<number>();
    for (const i of regionOps) {
      const o = ops[i];
      const ti = o[side];
      if (ti < 0) continue;
      // a word that matched but carries only a dash error is still "changed" for display
      changed.add(ti);
    }
    if (inRegion.length) {
      const cues = Array.from(new Set(inRegion.map((t) => toks[t].cue))).sort((a, b) => a - b);
      const pieces: Piece[] = [];
      cues.forEach((c, ci) => {
        if (ci > 0) pieces.push({ text: '\n', changed: false });
        byCue[c].forEach((ti, k) => {
          if (k > 0) pieces.push({ text: toks[ti].lineStart ? '\n' : ' ', changed: false });
          pieces.push({ text: (toks[ti].dash ? '- ' : '') + toks[ti].raw, changed: changed.has(ti) });
        });
      });
      return { pieces: mergePieces(pieces), cue: cues[0] };
    }
    // nothing on this side: show the neighbouring line with a caret where words are missing
    const last = regionOps[regionOps.length - 1];
    let pivot = -1;
    let before = true;
    for (let i = last + 1; i < ops.length; i++) {
      if (ops[i][side] >= 0) {
        pivot = ops[i][side];
        break;
      }
    }
    if (pivot < 0) {
      before = false;
      for (let i = regionOps[0] - 1; i >= 0; i--) {
        if (ops[i][side] >= 0) {
          pivot = ops[i][side];
          break;
        }
      }
    }
    if (pivot < 0) return { pieces: [{ text: '‸', changed: true, caret: true }], cue: null };
    const c = toks[pivot].cue;
    const pieces: Piece[] = [];
    byCue[c].forEach((ti, k) => {
      if (k > 0) pieces.push({ text: toks[ti].lineStart ? '\n' : ' ', changed: false });
      if (before && ti === pivot) pieces.push({ text: '‸', changed: true, caret: true }, { text: ' ', changed: false });
      pieces.push({ text: (toks[ti].dash ? '- ' : '') + toks[ti].raw, changed: false });
      if (!before && ti === pivot) pieces.push({ text: ' ', changed: false }, { text: '‸', changed: true, caret: true });
    });
    // the line containing the pivot only borders the gap; the gap itself belongs to no line
    return { pieces: mergePieces(pieces), cue: null };
  };

  for (const rg of regions) {
    const kinds = Array.from(new Set(rg.flatMap((i) => ops[i].errs))) as Kind[];
    const r = sidePieces(rg, 'r', R, refByCue);
    const h = sidePieces(rg, 'h', H, hypByCue);
    const refTok = rg.map((i) => ops[i].r).find((x) => x >= 0);
    let line: number | null = refTok !== undefined ? refCues[R[refTok].cue].n : null;
    if (line === null) {
      const next = ops.slice(rg[rg.length - 1] + 1).find((o) => o.r >= 0);
      if (next) line = refCues[R[next.r].cue].n;
    }
    items.push({ id: items.length, line, kinds, ref: r.pieces, hyp: h.pieces });
  }

  // ---- effort only: re-segmented lines and adjusted timestamps
  if (mode === 'effort') {
    const plain = (cue: Cue): Piece[] => [{ text: cue.lines.join('\n'), changed: false }];
    hypCues.forEach((hc, hi) => {
      const refs = hypToRef[hi];
      if (refs.size === 0) return; // a wholly new line: already counted as added words
      const ri = refs.size === 1 ? Array.from(refs)[0] : -1;
      const oneToOne = ri >= 0 && refToHyp[ri].size === 1;
      if (!oneToOne) {
        counts.seg++;
        const refList = Array.from(refs).sort((a, b) => a - b);
        const refPieces: Piece[] = [];
        refList.forEach((x, k) => {
          if (k > 0) refPieces.push({ text: '  |  ', changed: true });
          refPieces.push(...plain(refCues[x]));
        });
        items.push({
          id: items.length,
          line: refCues[refList[0]].n,
          kinds: ['seg'],
          ref: refPieces,
          hyp: plain(hc),
          refCues: refList.map((x) => refCues[x].lines.join('\n')),
          hypCues: [hc.lines.join('\n')],
        });
        return;
      }
      const rc = refCues[ri];
      if (
        Math.abs(rc.start - hc.start) >= TIMESTAMP_THRESHOLD_MS ||
        Math.abs(rc.end - hc.end) >= TIMESTAMP_THRESHOLD_MS
      ) {
        // counted in the Effort totals, but not listed: a bare timecode says nothing on its own
        counts.time++;
      }
    });
    items.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity) || a.id - b.id);
  }

  const wordErrors = counts.wrong + counts.missed + counts.extra;
  const formatErrors = counts.punct + counts.caps + counts.dash;
  const totalErrors = wordErrors + formatErrors;
  const refWords = R.length;
  const wholeMissed = refToHyp.map((set, i) => set.size === 0 && refByCue[i].length > 0);
  const wholeExtra = hypToRef.map((set, i) => set.size === 0 && hypByCue[i].length > 0);
  const result: CompareResult = {
    mode,
    transcriber: hypName,
    refWords,
    hypWords: H.length,
    refLines: refCues.length,
    hypLines: hypCues.length,
    counts,
    wordErrors,
    formatErrors,
    totalErrors,
    accuracy: refWords ? Math.max(0, 1 - totalErrors / refWords) : 0,
    changedShare: refWords ? Math.min(1, totalErrors / refWords) : 0,
    totalChanges: totalErrors + counts.seg + counts.time,
    cleanLines,
    linesAdded,
    linesRemoved,
    items,
    skipped: [],
  };
  return { result, wholeMissed, wholeExtra };
}

function mergePieces(pieces: Piece[]): Piece[] {
  const out: Piece[] = [];
  for (const p of pieces) {
    if (!p.text) continue;
    const last = out[out.length - 1];
    const prev = out[out.length - 2];
    if (last && !p.caret && !last.caret && last.changed === p.changed) last.text += p.text;
    else if (
      p.changed && !p.caret && last && !last.changed && last.text === ' ' &&
      prev && prev.changed && !prev.caret
    ) {
      // "changed changed" separated by a single space reads as one highlighted phrase
      out.pop();
      prev.text += ' ' + p.text;
    } else out.push({ ...p });
  }
  return out;
}

/** Case name from a file name: "Transcript-Halecia (1st half).srt" -> "Transcript-Halecia" */
export function caseNameFromFile(fileName: string): string {
  return fileName
    .replace(/\.srt$/i, '')
    .replace(/\s*\((?:\d+(?:st|nd|rd|th)\s+half|v\d+)\)\s*$/i, '')
    .trim();
}
