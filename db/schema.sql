-- ============================================================================
--  Solo Leveling Council — Database Schema  (Phase 1: The Foundation)
--  Run this top-to-bottom in the Supabase SQL Editor.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. USERS  (profile, 1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id                uuid primary key references auth.users(id) on delete cascade,
  name              text,
  age               int,
  occupation        text,
  academic_goal     text,
  financial_system  text,
  wealth_goal       text,
  weight            numeric,
  height            numeric,
  physical_goal     text,
  -- live gamified stats
  intellect         int  not null default 0,
  wealth            int  not null default 0,
  strength          int  not null default 0,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. DAILY_LOGS  (the durable, crash-proof queue)
-- ---------------------------------------------------------------------------
create table if not exists public.daily_logs (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.users(id) on delete cascade,
  log_data     text not null,
  status       text not null default 'pending'
                 check (status in ('pending','processing','completed','failed')),
  attempts     int  not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  processed_at timestamptz
);
create index if not exists daily_logs_queue_idx on public.daily_logs (status, created_at);
create index if not exists daily_logs_user_idx  on public.daily_logs (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. ACTIVE_QUESTS  (the synthesizer's JSON output)
-- ---------------------------------------------------------------------------
create table if not exists public.active_quests (
  id                bigint generated always as identity primary key,
  user_id           uuid not null references public.users(id) on delete cascade,
  log_id            bigint references public.daily_logs(id) on delete cascade,
  system_verdict    text,
  quests            jsonb not null default '[]'::jsonb,
  stat_adjustments  jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists active_quests_user_idx on public.active_quests (user_id, created_at desc);

-- ============================================================================
--  ATOMIC QUEUE CLAIM  — fixes the SELECT-then-UPDATE race.
--  Locks and flips exactly one pending row; concurrent workers never collide.
-- ============================================================================
create or replace function public.claim_next_log()
returns setof public.daily_logs
language sql
security definer
set search_path = public
as $$
  update public.daily_logs
     set status = 'processing'
   where id = (
     select id from public.daily_logs
      where status = 'pending'
      order by created_at
      limit 1
      for update skip locked
   )
  returning *;
$$;

-- ============================================================================
--  ATOMIC STAT APPLICATION
-- ============================================================================
create or replace function public.apply_stat_deltas(
  p_user_id uuid, p_intellect int, p_wealth int, p_strength int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set intellect = intellect + coalesce(p_intellect, 0),
         wealth    = wealth    + coalesce(p_wealth, 0),
         strength  = strength  + coalesce(p_strength, 0)
   where id = p_user_id;
$$;

-- ============================================================================
--  PRIVILEGE LOCKDOWN
--  Both functions are SECURITY DEFINER, so they must NOT be callable by the
--  mobile app (anon / authenticated) or a user could flip the queue or pump
--  their own stats. Only the backend's service_role may execute them.
-- ============================================================================
revoke all on function public.claim_next_log()                         from public, anon, authenticated;
revoke all on function public.apply_stat_deltas(uuid, int, int, int)   from public, anon, authenticated;
grant  execute on function public.claim_next_log()                       to service_role;
grant  execute on function public.apply_stat_deltas(uuid, int, int, int) to service_role;

-- ============================================================================
--  AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name)
  values (new.id, nullif(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
--  ROW-LEVEL SECURITY
--  These policies govern the MOBILE APP (anon key + user JWT).
--  The backend uses the service_role key, which bypasses RLS by design.
-- ============================================================================
alter table public.users         enable row level security;
alter table public.daily_logs    enable row level security;
alter table public.active_quests enable row level security;

-- users: see / edit only your own profile
create policy "own profile select" on public.users
  for select using (auth.uid() = id);
create policy "own profile insert" on public.users
  for insert with check (auth.uid() = id);
create policy "own profile update" on public.users
  for update using (auth.uid() = id);

-- daily_logs: insert / read only your own logs
create policy "own logs select" on public.daily_logs
  for select using (auth.uid() = user_id);
create policy "own logs insert" on public.daily_logs
  for insert with check (auth.uid() = user_id);

-- active_quests: read-only to the owner (only the backend writes them)
create policy "own quests select" on public.active_quests
  for select using (auth.uid() = user_id);
