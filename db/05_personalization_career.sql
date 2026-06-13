-- ============================================================================
--  Phase 5 — Personalization + Career Compass
--  Run in the Supabase SQL Editor after 04. Safe to re-run.
-- ============================================================================

-- Richer profile so the System can tailor everything to the Hunter.
alter table public.users add column if not exists interests text;
alter table public.users add column if not exists education_level text;  -- e.g. "Class 11", "Undergraduate"

-- ---------------------------------------------------------------------------
--  CAREER_PATHS  (System-recommended fields, interest + growth driven)
-- ---------------------------------------------------------------------------
create table if not exists public.career_paths (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.users(id) on delete cascade,
  field           text not null,
  fit_reason      text default '',
  growth_outlook  text default '',
  demand          text default '',          -- "High" | "Growing" | "Stable" | "Niche"
  key_skills      jsonb not null default '[]'::jsonb,
  first_step      text default '',
  created_at      timestamptz not null default now()
);
create index if not exists career_paths_user_idx on public.career_paths (user_id, created_at desc);

alter table public.career_paths enable row level security;
drop policy if exists "own career select" on public.career_paths;
drop policy if exists "own career insert" on public.career_paths;
drop policy if exists "own career delete" on public.career_paths;
create policy "own career select" on public.career_paths for select using (auth.uid() = user_id);
create policy "own career insert" on public.career_paths for insert with check (auth.uid() = user_id);
create policy "own career delete" on public.career_paths for delete using (auth.uid() = user_id);
