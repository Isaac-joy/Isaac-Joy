-- ============================================================================
--  Phase 6 — Hunter Rank/Level + System long-term memory
--  Run in the Supabase SQL Editor after 05. Safe to re-run.
-- ============================================================================

-- Monotonic XP that drives Level + Rank (separate from the +/- attribute stats).
alter table public.users add column if not exists total_xp int not null default 0;
-- The System's evolving "read" on the Hunter, injected into every AI prompt.
alter table public.users add column if not exists hunter_memory text default '';

-- ---------------------------------------------------------------------------
--  AWARD XP  (atomic, monotonic — only ever increases)
--  SECURITY DEFINER + locked down to the backend, like apply_stat_deltas.
-- ---------------------------------------------------------------------------
create or replace function public.award_xp(p_user_id uuid, p_xp int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.users
     set total_xp = total_xp + greatest(0, coalesce(p_xp, 0))
   where id = p_user_id;
$$;

revoke all on function public.award_xp(uuid, int) from public, anon, authenticated;
grant  execute on function public.award_xp(uuid, int) to service_role;
