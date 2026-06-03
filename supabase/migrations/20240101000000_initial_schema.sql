-- ============================================================
-- Content Monetization Platform Schema
-- ============================================================

-- Extensions
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type subscription_status as enum ('active', 'cancelled', 'expired', 'past_due');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type payment_provider as enum ('stripe', 'paypal');
create type media_type as enum ('image', 'video', 'audio', 'document');
create type message_status as enum ('sent', 'delivered', 'read');

-- ============================================================
-- USERS
-- ============================================================

create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  display_name    text,
  email           text unique not null,
  bio             text,
  avatar_url      text,
  banner_url      text,
  is_creator      boolean not null default false,
  -- creator-only: monthly subscription price in cents
  subscription_price_cents integer check (subscription_price_cents is null or subscription_price_cents >= 0),
  -- creator stripe/paypal payout account
  payout_account_id text,
  is_verified     boolean not null default false,
  is_banned       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index users_username_idx on public.users (username);
create index users_is_creator_idx on public.users (is_creator) where is_creator = true;

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  subscriber_id   uuid not null references public.users(id) on delete cascade,
  creator_id      uuid not null references public.users(id) on delete cascade,
  status          subscription_status not null default 'active',
  price_paid_cents integer not null check (price_paid_cents >= 0),
  currency        char(3) not null default 'USD',
  -- billing period
  current_period_start timestamptz not null default now(),
  current_period_end   timestamptz not null,
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint no_self_subscribe check (subscriber_id <> creator_id),
  constraint unique_subscription unique (subscriber_id, creator_id)
);

create index subscriptions_subscriber_idx on public.subscriptions (subscriber_id);
create index subscriptions_creator_idx on public.subscriptions (creator_id);
create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_period_end_idx on public.subscriptions (current_period_end);

-- ============================================================
-- POSTS
-- ============================================================

create table public.posts (
  id              uuid primary key default gen_random_uuid(),
  creator_id      uuid not null references public.users(id) on delete cascade,
  title           text,
  body            text,
  is_premium      boolean not null default false,  -- requires active subscription
  is_published    boolean not null default false,
  published_at    timestamptz,
  like_count      integer not null default 0,
  comment_count   integer not null default 0,
  tip_total_cents integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index posts_creator_idx on public.posts (creator_id);
create index posts_published_idx on public.posts (creator_id, published_at desc) where is_published = true;
create index posts_premium_idx on public.posts (is_premium);

-- ============================================================
-- MEDIA
-- ============================================================

create table public.media (
  id              uuid primary key default gen_random_uuid(),
  post_id         uuid references public.posts(id) on delete cascade,
  uploader_id     uuid not null references public.users(id) on delete cascade,
  media_type      media_type not null,
  url             text not null,
  thumbnail_url   text,
  file_name       text,
  file_size_bytes bigint,
  duration_secs   integer,        -- for video/audio
  width           integer,        -- for image/video
  height          integer,
  sort_order      smallint not null default 0,
  created_at      timestamptz not null default now()
);

create index media_post_idx on public.media (post_id);
create index media_uploader_idx on public.media (uploader_id);

-- ============================================================
-- MESSAGES
-- ============================================================

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  sender_id       uuid not null references public.users(id) on delete cascade,
  recipient_id    uuid not null references public.users(id) on delete cascade,
  body            text,
  -- optional paid message (tip to unlock)
  tip_amount_cents integer check (tip_amount_cents is null or tip_amount_cents >= 0),
  is_paid_content boolean not null default false,
  status          message_status not null default 'sent',
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint no_self_message check (sender_id <> recipient_id)
);

create index messages_sender_idx on public.messages (sender_id);
create index messages_recipient_idx on public.messages (recipient_id);
-- conversation view: all messages between two users
create index messages_conversation_idx on public.messages (
  least(sender_id, recipient_id),
  greatest(sender_id, recipient_id),
  created_at desc
);

-- ============================================================
-- PAYMENTS
-- ============================================================

create table public.payments (
  id                   uuid primary key default gen_random_uuid(),
  payer_id             uuid not null references public.users(id) on delete restrict,
  payee_id             uuid not null references public.users(id) on delete restrict,
  subscription_id      uuid references public.subscriptions(id) on delete set null,
  message_id           uuid references public.messages(id) on delete set null,
  post_id              uuid references public.posts(id) on delete set null,
  amount_cents         integer not null check (amount_cents > 0),
  platform_fee_cents   integer not null default 0 check (platform_fee_cents >= 0),
  currency             char(3) not null default 'USD',
  status               payment_status not null default 'pending',
  provider             payment_provider not null,
  provider_payment_id  text unique,     -- stripe PaymentIntent id, etc.
  provider_fee_cents   integer default 0,
  refunded_at          timestamptz,
  refund_reason        text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint no_self_payment check (payer_id <> payee_id)
);

create index payments_payer_idx on public.payments (payer_id);
create index payments_payee_idx on public.payments (payee_id);
create index payments_subscription_idx on public.payments (subscription_id);
create index payments_status_idx on public.payments (status);
create index payments_provider_payment_idx on public.payments (provider_payment_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_updated_at        before update on public.users        for each row execute function public.set_updated_at();
create trigger subscriptions_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger posts_updated_at        before update on public.posts        for each row execute function public.set_updated_at();
create trigger payments_updated_at     before update on public.payments     for each row execute function public.set_updated_at();

-- ============================================================
-- HELPER: check active subscription
-- ============================================================

create or replace function public.has_active_subscription(
  p_subscriber_id uuid,
  p_creator_id    uuid
) returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.subscriptions
    where subscriber_id = p_subscriber_id
      and creator_id    = p_creator_id
      and status        = 'active'
      and current_period_end > now()
  );
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.users        enable row level security;
alter table public.subscriptions enable row level security;
alter table public.posts        enable row level security;
alter table public.media        enable row level security;
alter table public.messages     enable row level security;
alter table public.payments     enable row level security;

-- ------------------------------------------------------------
-- USERS policies
-- ------------------------------------------------------------

-- Anyone (including anon) can read non-banned public profiles
create policy "users: public read"
  on public.users for select
  using (not is_banned);

-- Users can insert their own row (called on sign-up)
create policy "users: insert own"
  on public.users for insert
  with check (id = auth.uid());

-- Users can update only their own profile
create policy "users: update own"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ------------------------------------------------------------
-- SUBSCRIPTIONS policies
-- ------------------------------------------------------------

-- Subscribers can see their own subscriptions; creators can see who subscribes to them
create policy "subscriptions: read own"
  on public.subscriptions for select
  using (subscriber_id = auth.uid() or creator_id = auth.uid());

-- Subscribers create their own subscriptions
create policy "subscriptions: insert own"
  on public.subscriptions for insert
  with check (subscriber_id = auth.uid());

-- Subscribers can update (cancel) their own subscriptions
create policy "subscriptions: update own"
  on public.subscriptions for update
  using (subscriber_id = auth.uid())
  with check (subscriber_id = auth.uid());

-- ------------------------------------------------------------
-- POSTS policies
-- ------------------------------------------------------------

-- Free published posts are public; premium posts require active subscription
create policy "posts: public read free"
  on public.posts for select
  using (
    is_published = true
    and (
      is_premium = false
      or creator_id = auth.uid()
      or public.has_active_subscription(auth.uid(), creator_id)
    )
  );

-- Creators manage their own posts
create policy "posts: creator insert"
  on public.posts for insert
  with check (creator_id = auth.uid());

create policy "posts: creator update"
  on public.posts for update
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "posts: creator delete"
  on public.posts for delete
  using (creator_id = auth.uid());

-- ------------------------------------------------------------
-- MEDIA policies
-- ------------------------------------------------------------

-- Media visibility mirrors parent post visibility
create policy "media: read with post access"
  on public.media for select
  using (
    uploader_id = auth.uid()
    or post_id is null  -- profile/message media with no post
    or exists (
      select 1 from public.posts p
      where p.id = media.post_id
        and p.is_published = true
        and (
          p.is_premium = false
          or p.creator_id = auth.uid()
          or public.has_active_subscription(auth.uid(), p.creator_id)
        )
    )
  );

-- Uploader manages their own media
create policy "media: uploader insert"
  on public.media for insert
  with check (uploader_id = auth.uid());

create policy "media: uploader delete"
  on public.media for delete
  using (uploader_id = auth.uid());

-- ------------------------------------------------------------
-- MESSAGES policies
-- ------------------------------------------------------------

-- Only sender and recipient can read a message
create policy "messages: read own"
  on public.messages for select
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- Users send messages as themselves
create policy "messages: insert own"
  on public.messages for insert
  with check (sender_id = auth.uid());

-- Sender can delete their own message; recipient can mark as read
create policy "messages: update own"
  on public.messages for update
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- ------------------------------------------------------------
-- PAYMENTS policies
-- ------------------------------------------------------------

-- Payer sees their outgoing payments; payee sees incoming
create policy "payments: read own"
  on public.payments for select
  using (payer_id = auth.uid() or payee_id = auth.uid());

-- Only service role (backend) inserts payments — no client insert policy
-- Authenticated users cannot directly create payment rows
