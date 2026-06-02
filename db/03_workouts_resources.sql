-- ============================================================================
--  Phase 3 — Workouts + Resources  (run in the Supabase SQL Editor, after 02)
--  Safe to re-run (IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS).
-- ============================================================================

-- Equipment the Hunter has access to (drives equipment-aware workouts).
alter table public.users add column if not exists equipment text;

-- ---------------------------------------------------------------------------
--  WORKOUTS  (one System-designed session per row; exercises stored as JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.workouts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  title         text not null default 'Training Session',
  exercises     jsonb not null default '[]'::jsonb,
  equipment     text default '',
  xp_reward     int  not null default 60,
  status        text not null default 'active' check (status in ('active','completed')),
  source        text not null default 'system',
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index if not exists workouts_user_idx on public.workouts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
--  RESOURCES  (System-curated books / courses / tools mapped to goals)
-- ---------------------------------------------------------------------------
create table if not exists public.resources (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  author      text default '',
  type        text default 'book',
  category    text default 'general'
                check (category in ('intellect','wealth','strength','general')),
  reason      text default '',
  created_at  timestamptz not null default now()
);
create index if not exists resources_user_idx on public.resources (user_id, created_at desc);

-- ---------------------------------------------------------------------------
--  RLS (defense-in-depth; the backend uses the service_role key, bypassing it)
-- ---------------------------------------------------------------------------
alter table public.workouts  enable row level security;
alter table public.resources enable row level security;

drop policy if exists "own workouts select" on public.workouts;
drop policy if exists "own workouts insert" on public.workouts;
drop policy if exists "own workouts update" on public.workouts;
drop policy if exists "own workouts delete" on public.workouts;
create policy "own workouts select" on public.workouts for select using (auth.uid() = user_id);
create policy "own workouts insert" on public.workouts for insert with check (auth.uid() = user_id);
create policy "own workouts update" on public.workouts for update using (auth.uid() = user_id);
create policy "own workouts delete" on public.workouts for delete using (auth.uid() = user_id);

drop policy if exists "own resources select" on public.resources;
drop policy if exists "own resources insert" on public.resources;
drop policy if exists "own resources delete" on public.resources;
create policy "own resources select" on public.resources for select using (auth.uid() = user_id);
create policy "own resources insert" on public.resources for insert with check (auth.uid() = user_id);
create policy "own resources delete" on public.resources for delete using (auth.uid() = user_id);
