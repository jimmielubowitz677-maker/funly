-- ── Likes ──────────────────────────────────────────────────────────────────
create table if not exists public.likes (
  user_id    uuid not null references public.users(id) on delete cascade,
  post_id    uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists likes_post_idx on public.likes (post_id);

alter table public.likes enable row level security;

create policy "likes: read"        on public.likes for select using (true);
create policy "likes: insert own"  on public.likes for insert with check (user_id = auth.uid());
create policy "likes: delete own"  on public.likes for delete using (user_id = auth.uid());

-- Trigger: keep posts.like_count in sync
create or replace function public.update_like_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'insert' then
    update public.posts set like_count = like_count + 1 where id = new.post_id;
  elsif tg_op = 'delete' then
    update public.posts set like_count = greatest(0, like_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists likes_count_trigger on public.likes;
create trigger likes_count_trigger
  after insert or delete on public.likes
  for each row execute function public.update_like_count();

-- ── Comments ────────────────────────────────────────────────────────────────
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

alter table public.comments enable row level security;

create policy "comments: read" on public.comments for select using (true);
create policy "comments: insert own" on public.comments for insert with check (user_id = auth.uid());
create policy "comments: delete own" on public.comments for delete
  using (
    user_id = auth.uid()
    or exists (select 1 from public.posts where id = post_id and creator_id = auth.uid())
  );

-- Trigger: keep posts.comment_count in sync
create or replace function public.update_comment_count()
returns trigger language plpgsql as $$
begin
  if tg_op = 'insert' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  elsif tg_op = 'delete' then
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_count_trigger on public.comments;
create trigger comments_count_trigger
  after insert or delete on public.comments
  for each row execute function public.update_comment_count();

-- ── Post creator controls ────────────────────────────────────────────────────
alter table public.posts
  add column if not exists comments_disabled  boolean not null default false,
  add column if not exists display_like_count integer;
