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

## Design — "Teal & gold" (redesign, Nov 2026; replaces the earlier sharp-cornered monday.com look)
Reference mockup: "Direction E · Teal & gold" on the "Transcript QA App — Screens" design canvas (Results screen).
Apply it to every screen (Login, Set password, Upload, Results, Stats). Layout, flow and copy stay as they are;
this is a visual restyle. Desktop-first, light mode only. "TranscriptQA" is still a placeholder name.

### Color roles (each color has ONE job — don't reuse a color outside its role)
| Token | Hex | Job |
|---|---|---|
| page | #F7F6F2 | page background (soft warm white, low glare for long reading) |
| surface | #FFFFFF | cards, top bar, tables |
| line | #E3E6E2 | card borders; row dividers #ECEEEA |
| ink | #17262B | text, headings, big numbers (the score reads as a neutral fact) |
| muted | #55636A | secondary text; small uppercase labels #5B6B66 |
| teal (primary) | #0F766E | main buttons (white text), active tab/filter, score card background, links |
| teal-tint | #DDF0EC (text #0B5A54) | soft teal cards, quiet highlights; neutral chip bg #EEF1EF |
| gold (reward) | #F2A93B (ink text on it) | ONLY praise: "↑ x pts above your average", personal bests, Effort headline accents, the "%" on the score. Gold never marks a mistake. |
| coral (removed) | text #A3261A on #FDE4E1 | struck-out words in the change table (`<del>`) |
| green (fix) | text #17603A on #DDF3E4, 2px underline #2F9E62 | corrected/added words (`<ins>`) |
Never use orange, red or gold as a general accent: they read as warnings or rewards. Teal is the only brand accent.

### Change-type colors (src/lib/kinds.ts) — warm = content errors, cool = formatting
| Kind | Dot color |
|---|---|
| wrong (Wrong word / Word fixed) | coral #E5644E |
| missed (Missed word / Word removed) | rose #D6457A |
| extra (Extra word / Word added) | magenta #B2459B |
| punct | blue #3E7BFA |
| caps | violet #6E6CF0 |
| dash | slate #64748B |
| seg (Effort) | gray #8B8D98 |
| time (Effort) | indigo #4F46E5 |
Type tags are soft pills: neutral bg #EEF1EF, ink text, a 7–8px colored dot before the label (dot = aria-hidden;
the label carries the meaning). Selected filter chip = solid teal with white text.
Charts: "Errors/Changes by type" is a vertical bar chart; all bars neutral #E3E8E6 except the most common type,
drawn in that type's dot color, with its label bolded. Trend chart line in teal; latest point in gold.

### Grades (src/lib/grades.ts) — soft traffic light, tinted pills with strong letters
A green (#DDF3E4 bg / #17603A text) · B lime (#ECF6D5 / #46601A) · C amber (#FBF0D6 / #7A5300) ·
D orange (#FCE6D6 / #8A3B0E) · F muted red (#FBE3E1 / #8E2A22). F must not shout. On the teal score card the grade is a
large white rounded tile with an ink letter.

### Shape and type
- Rounded corners (sharp corners looked tacky): cards 20px, top bar 16px, buttons/inputs/drop zones 12px,
  small tiles 9–10px, highlight marks in text 5px, pills/chips/avatars fully rounded.
- No hard shadows; cards = white + 1px line border. The top bar is a floating rounded white bar with 16px margin.
- Fonts: Space Grotesk (600/700) for headings, big numbers and the logo; Inter (400–700) for everything else.
  Replace Figtree (src/app/layout.tsx next/font). Small section labels: 12px, uppercase, letter-spacing 0.08–0.18em.
- Buttons: primary = teal bg, white text, 48px tall, 12px radius; secondary = white bg, 1.5px ink border, ink text.
- Contrast: body text ≥ 4.5:1, never white text on gold; focus ring = 3px teal outline, 2px offset.
- Every pill still has a text label; color is never the only signal (strikethrough/underline in the change table too).

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 (@theme tokens in src/app/globals.css) ·
Supabase · Netlify. Emma is a frontend developer; keep the code readable for her.
