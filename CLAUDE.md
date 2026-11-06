# TranscriptQA — context for Claude Code

Web app for a team of bodycam transcribers (senior: Emma, plus juniors). Built in a planning session; the code
was written without being able to run `npm install` or `next build`, so the first run may surface small errors.
Fix them without changing the decisions below unless Emma asks.

## Two comparisons (src/lib/compare/engine.ts)
- **Accuracy**: reference = QA's corrected SRT, hypothesis = transcriber's SRT.
  Accuracy = 1 − errors ÷ words in QA version, graded A ≥90, B ≥80, C ≥70, D ≥60, F below (src/lib/grades.ts).
- **Effort**: reference = AI template (ElevenLabs + ChatGPT, sent by the client), hypothesis = transcriber's SRT.
  Shows total changes and % of AI words changed. Not graded. Meant to show transcribers their effort is appreciated.
- Errors (each counts 1, full weight): wrong word, missed word, extra word, punctuation, capitalization, dialog dash ("- ").
- NOT counted: timestamps (Accuracy only), line breaks / re-segmenting (Accuracy only), a comma/period that differs
  only because a line break moved, dialog dashes when the two subtitles have different line counts (Accuracy only;
  in Effort, splitting the AI's run-together dialog into "- " lines counts as a dash change), credit lines
  ("Transcribed by Name", "*Name*").
- SRT cleaning (parseSrt): colour/format tags (`<b><font color='…'>`, `{\an8}`, entities) are stripped, and `[Cut]`
  lines (added by the video editor) are dropped, so neither can count as an error.
- Uncorrected lines (Accuracy only): a whole subtitle with no partner in the other file is not a correction, so it is
  left out. QA side = narration the QA's editor added (formatted like dialogue, so found by shape: not a "- " line).
  Transcriber side = footage the editor cut before QA (no [Cut] marker in practice). Only runs of ≥ SKIP_MIN_RUN (3)
  count, so one line the QA deleted or the transcriber forgot still counts. If more than SKIP_MAX_SHARE (25%) of a
  file's subtitles would be skipped, nothing is skipped (wrong file / partial case; keeps the mismatch warning working).
  Skipped lines are listed on Results ("Not counted against you"). Words in them leave both the errors and the totals.
- Effort also counts re-segmented lines and timestamps moved ≥ 0.25 s (TIMESTAMP_THRESHOLD_MS).
- Matching is word-level across the whole file (Myers diff + per-region alignment), never line-by-line or by timestamp.
- Test without the UI: `npm run test:engine -- ref.srt mine.srt [accuracy|effort]`. Sample files: ../testers
  (old example: "Helicia v2.srt" is the QA version of the whole case; the "Transcript-Halecia (Nth half)" files are parts,
  so whole-vs-half scores are low by design). "Transcript-Halecia (merged).srt" = the six halves joined with timestamps
  shifted to the full video (~97.1% vs Helicia v2). "AI-template-Halecia (synthetic light|medium|heavy).srt" are FAKE
  AI templates generated from the merged file (not real ElevenLabs output) for testing Effort mode.

## Privacy (hard rule)
Transcripts are sensitive bodycam material. The comparison runs only in the browser. Never send transcript text to a
server, never store it (no localStorage, no DB). Only numbers are saved: score, ref word count, totals, per-type counts.
Results/mistakes live in memory (src/lib/compare-store.tsx) and disappear on refresh — that's intended.

## Users and data (Supabase, supabase/schema.sql)
- Invite-only (public sign-ups disabled; invites from the Supabase dashboard). Invite/reset links land on /set-password.
- profiles (name, role senior|junior), results (scores). RLS: every logged-in member reads all results; users insert
  only their own; users can delete their own results and rename the case on them (only case_name is updatable). Users can change their name, not their role.
- Client-side Supabase only (@supabase/supabase-js, no SSR helpers, no middleware).

## Screens (src/app)
Login → Upload → Results → Stats. Top bar (Upload, Stats, name, Log out) on every screen after login.
Results has "Compare another" and "View stats". Stats has Accuracy / Effort tabs, "My stats" (or the selected
transcriber's), a trend line, and a team board grouped by transcriber with colored header bars.

## Design
Inspired by monday.com's color psychology, own branding. White base, Figtree font, desktop-first.
Sharp corners everywhere (radius 0); pills (rounded-full) only for type tags, grades and small badges.
Change-type colors live in src/lib/kinds.ts. Every pill has a text label (never color alone).
Mockups: the "Transcript QA App — Screens" design artifact. "TranscriptQA" is a placeholder name.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 (@theme tokens in src/app/globals.css) ·
Supabase · Netlify. Emma is a frontend developer; keep the code readable for her.
