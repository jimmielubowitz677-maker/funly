-- ── Post type ──────────────────────────────────────────────────
create type post_type as enum ('free', 'premium', 'ppv');

alter table public.posts
  add column if not exists post_type       post_type not null default 'free',
  add column if not exists ppv_price_cents integer   check (ppv_price_cents is null or ppv_price_cents > 0);

-- back-fill existing rows
update public.posts set post_type = 'premium' where is_premium = true;

-- ── Supabase Storage bucket ─────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media', 'media', true,
  52428800,
  array[
    'image/jpeg','image/jpg','image/png','image/gif','image/webp',
    'video/mp4','video/quicktime','video/webm','video/mpeg'
  ]
)
on conflict (id) do nothing;

-- ── Storage RLS policies ────────────────────────────────────────
create policy "media: authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'media');

create policy "media: public read"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "media: authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'media');
