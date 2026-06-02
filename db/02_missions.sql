-- ============================================================================
--  Phase 2 — Missions  (run in the Supabase SQL Editor, after schema.sql)
--  Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- ============================================================================

create table if not exists public.missions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null,
  description   text default '',
  category      text default 'general'
                  check (category in ('intellect','wealth','strength','general')),
  xp_reward     int  not null default 50,
  status        text not null default 'active' check (status in ('active','completed')),
  source        text not null default 'system' check (source in ('system','user')),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists missions_user_idx on public.missions (user_id, created_at desc);
create index if not exists missions_user_status_idx on public.missions (user_id, status);

-- RLS (defense-in-depth; the backend uses the service_role key which bypasses it)
alter table public.missions enable row level security;

drop policy if exists "own missions select" on public.missions;
drop policy if exists "own missions insert" on public.missions;
drop policy if exists "own missions update" on public.missions;
drop policy if exists "own missions delete" on public.missions;

create policy "own missions select" on public.missions
  for select using (auth.uid() = user_id);
create policy "own missions insert" on public.missions
  for insert with check (auth.uid() = user_id);
create policy "own missions update" on public.missions
  for update using (auth.uid() = user_id);
create policy "own missions delete" on public.missions
  for delete using (auth.uid() = user_id);
