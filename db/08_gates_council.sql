-- ============================================================================
--  Phase 9 — Gates (weekly dungeon challenges) + Council debate storage
--  Run in the Supabase SQL Editor after 07. Safe to re-run.
-- ============================================================================

-- Store the Council's in-character debate + audits alongside the verdict.
alter table public.active_quests add column if not exists council jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
--  GATES  (one System-opened weekly challenge; objectives stored as JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.gates (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references public.users(id) on delete cascade,
  title        text not null default 'Gate',
  description  text default '',
  objectives   jsonb not null default '[]'::jsonb,   -- [{text, done}]
  rank         text default 'E',                     -- difficulty rank E..SS
  target_stat  text default 'intellect'              -- intellect | wealth | strength
                 check (target_stat in ('intellect','wealth','strength')),
  reward_xp    int not null default 150,
  status       text not null default 'active'
                 check (status in ('active','cleared','collapsed')),
  opened_at    timestamptz not null default now(),
  deadline     timestamptz,
  cleared_at   timestamptz
);
create index if not exists gates_user_idx on public.gates (user_id, opened_at desc);

alter table public.gates enable row level security;
drop policy if exists "own gates select" on public.gates;
drop policy if exists "own gates insert" on public.gates;
drop policy if exists "own gates update" on public.gates;
drop policy if exists "own gates delete" on public.gates;
create policy "own gates select" on public.gates for select using (auth.uid() = user_id);
create policy "own gates insert" on public.gates for insert with check (auth.uid() = user_id);
create policy "own gates update" on public.gates for update using (auth.uid() = user_id);
create policy "own gates delete" on public.gates for delete using (auth.uid() = user_id);
