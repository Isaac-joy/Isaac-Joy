-- ============================================================================
--  Phase 4 — The Academy (books + study plans)
--  Run in the Supabase SQL Editor after 03. Safe to re-run.
-- ============================================================================

create table if not exists public.books (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.users(id) on delete cascade,
  title            text not null,
  author           text default '',
  cover_url        text default '',
  ol_work_key      text default '',   -- Open Library work key, e.g. /works/OL123W
  ebook_access     text default '',   -- public | borrowable | printdisabled | no_ebook
  free_text_url    text default '',   -- legal full text (Gutenberg/Archive), if public domain
  free_reader_url  text default '',   -- in-browser reader link, if public domain
  status           text not null default 'active' check (status in ('active','completed')),
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);
create index if not exists books_user_idx on public.books (user_id, created_at desc);

create table if not exists public.book_chapters (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references public.users(id) on delete cascade,
  book_id        bigint not null references public.books(id) on delete cascade,
  ordinal        int not null default 1,
  title          text not null,
  objective      text default '',
  key_concepts   jsonb not null default '[]'::jsonb,
  youtube_query  text default '',
  notes          text default '',          -- System-generated study notes (on demand)
  xp_reward      int not null default 40,
  status         text not null default 'active' check (status in ('active','completed')),
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists book_chapters_book_idx on public.book_chapters (book_id, ordinal);
create index if not exists book_chapters_user_idx on public.book_chapters (user_id, created_at desc);

-- RLS (defense-in-depth; the backend's service_role key bypasses it)
alter table public.books         enable row level security;
alter table public.book_chapters enable row level security;

drop policy if exists "own books select" on public.books;
drop policy if exists "own books insert" on public.books;
drop policy if exists "own books update" on public.books;
drop policy if exists "own books delete" on public.books;
create policy "own books select" on public.books for select using (auth.uid() = user_id);
create policy "own books insert" on public.books for insert with check (auth.uid() = user_id);
create policy "own books update" on public.books for update using (auth.uid() = user_id);
create policy "own books delete" on public.books for delete using (auth.uid() = user_id);

drop policy if exists "own chapters select" on public.book_chapters;
drop policy if exists "own chapters insert" on public.book_chapters;
drop policy if exists "own chapters update" on public.book_chapters;
drop policy if exists "own chapters delete" on public.book_chapters;
create policy "own chapters select" on public.book_chapters for select using (auth.uid() = user_id);
create policy "own chapters insert" on public.book_chapters for insert with check (auth.uid() = user_id);
create policy "own chapters update" on public.book_chapters for update using (auth.uid() = user_id);
create policy "own chapters delete" on public.book_chapters for delete using (auth.uid() = user_id);
