-- TranscriptQA database setup
-- Paste this whole file into Supabase dashboard > SQL Editor > New query, then Run.
-- It stores only scores and counts. No transcript text is ever saved.

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'junior' check (role in ('senior', 'junior')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- every logged-in team member can see everyone's name
create policy "Team can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

-- people can change their own name, but not their role
create policy "Users update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- create a profile automatically when an invited user is added
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- results
create table if not exists public.results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('accuracy', 'effort')),
  case_name text not null,
  ai_tool text,                       -- effort only, e.g. 'ElevenLabs'
  score numeric(6, 3) not null,       -- accuracy: accuracy %; effort: % of AI words changed
  ref_words integer not null,         -- words in the QA version / AI template
  total_errors integer not null,      -- word + punctuation + caps + dash changes
  total_changes integer not null,     -- effort: errors + re-segmented lines + timestamps
  counts jsonb not null,              -- per type: wrong, missed, extra, punct, caps, dash, seg, time
  created_at timestamptz not null default now()
);

create index if not exists results_user_created_idx on public.results (user_id, created_at desc);
create index if not exists results_kind_created_idx on public.results (kind, created_at desc);

alter table public.results enable row level security;

-- everyone on the team sees everyone's scores
create policy "Team can read results"
  on public.results for select
  to authenticated
  using (true);

-- people can only add scores under their own account
create policy "Users insert own results"
  on public.results for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- people can delete their own scores, and rename the case on their own scores.
-- Nothing else on a result can be edited, so scores can't be changed after the fact.
create policy "Users delete own results"
  on public.results for delete
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users rename own results"
  on public.results for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke update on public.results from authenticated;
grant update (case_name) on public.results to authenticated;

-- ---------------------------------------------------------------- make yourself senior
-- After you accept your own invite, run this once with your email:
-- update public.profiles set role = 'senior'
--   where id = (select id from auth.users where email = 'you@example.com');
