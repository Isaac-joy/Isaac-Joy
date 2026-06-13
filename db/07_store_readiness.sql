-- ============================================================================
--  Phase 7 — Store readiness (content reporting for AI-generated output)
--  Run in the Supabase SQL Editor after 06. Safe to re-run.
--  (Account deletion needs no schema: deleting the auth user cascades through
--   public.users -> all feature tables via existing ON DELETE CASCADE FKs.)
-- ============================================================================

create table if not exists public.content_reports (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  kind        text default 'verdict',   -- verdict | mission | career | other
  content     text default '',
  created_at  timestamptz not null default now()
);
create index if not exists content_reports_idx on public.content_reports (created_at desc);

alter table public.content_reports enable row level security;
drop policy if exists "own reports insert" on public.content_reports;
create policy "own reports insert" on public.content_reports
  for insert with check (auth.uid() = user_id);
