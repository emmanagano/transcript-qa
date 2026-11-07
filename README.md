# TranscriptQA

Compare a transcriber's SRT with the QA's corrected version (**Accuracy**) or with the AI template (**Effort**). Scores are saved per transcriber so the team can track them over time.

Transcripts never leave the browser. The comparison runs on the page, and only numbers (score, word count, counts per change type) are saved to Supabase.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Supabase (Auth + Postgres) · Netlify

## Project map

```
src/
  lib/compare/engine.ts   the comparison logic (no dependencies, runs in the browser)
  lib/kinds.ts            change types: labels and pill colors
  lib/grades.ts           A–F grading scale
  lib/auth.tsx            login state (Supabase Auth)
  lib/compare-store.tsx   holds the open comparison in memory only
  lib/results-db.ts       saving and loading scores
  app/login               login + forgot password
  app/set-password        where invite and reset links land
  app/(app)/upload        screen 1: pick Accuracy or Effort, add files
  app/(app)/results       screen 2: score, breakdown, list of changes
  app/(app)/stats         screen 3: my stats + team board
  app/(app)/account       edit name, change password, delete own scores (opened from the name in the top bar)
supabase/schema.sql       tables and access rules
scripts/test-engine.ts    try the engine from the terminal
testers/                  real sample SRTs for testing (gitignored: sensitive, never commit)
```

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste all of `supabase/schema.sql` and run it.
3. **Authentication → Sign In / Providers**: turn off **Allow new users to sign up** (invite-only).
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` while developing, your Netlify URL once deployed.
   - Redirect URLs: add `http://localhost:3000/**` and `https://YOUR-SITE.netlify.app/**`.
5. **Project Settings → API**: copy the Project URL and the anon public key.

### 2. Run it locally

```bash
cp env.example.txt .env.local      # then paste the two values in
npm install
npm run dev                        # http://localhost:3000
```

### 3. Accounts

- **Authentication → Users → Invite user**, enter an email. The person gets a link, sets a password and name, and lands on Upload.
- Invite yourself first, then mark yourself as senior by running the `update` at the bottom of `schema.sql` with your email.

### 4. Deploy to Netlify

1. Push the project to GitHub and import it in Netlify (Next.js is detected automatically).
2. Add the same two `NEXT_PUBLIC_SUPABASE_…` variables under **Site configuration → Environment variables**.
3. Update the Supabase Site URL and Redirect URLs to the Netlify address.

## Scoring rules

| | Accuracy | Effort |
|---|---|---|
| Compares | your SRT vs the QA's | the AI template vs your SRT |
| Headline | 1 − errors ÷ QA words, graded A–F | total changes, % of AI words changed |
| Counted | wrong, missed, extra words, punctuation, capitalization, dialog dashes | the same, plus re-segmented lines and timestamps moved 0.25 s or more |
| Not counted | timestamps, line breaks, commas that move with a line break, credit lines, colour/format tags, `[Cut]` lines, runs of 3+ whole subtitles with no match (QA voiceover, footage cut before QA) | credit lines, colour/format tags, `[Cut]` lines |

Grades: A 90–100%, B 80–89.9%, C 70–79.9%, D 60–69.9%, F below 60%.

### Reading the list of changes (Results)

- Each row shows the whole subtitle(s) around a change; only the changed words are highlighted
  (red strike-through = removed, green underline = added/corrected).
- Changes that fall in the same subtitle share one row, so a subtitle never appears twice.
- When one side has no words at all (only extra or only missed words), that side's cell is left empty.

## Account page

Click your name in the top bar. You can change your name (shown on the team stats), change your password (your
current password is checked first), and **Reset my data**: delete your saved scores (all, Accuracy only, or Effort
only). It shows how many will be deleted and needs `DELETE` typed to confirm. Only your own scores can be deleted.

## Try the engine without the website

```bash
npm run test:engine -- qa-version.srt my-transcript.srt
npm run test:engine -- ai-template.srt my-transcript.srt effort
```

(Needs Node 22.18 or newer.)
