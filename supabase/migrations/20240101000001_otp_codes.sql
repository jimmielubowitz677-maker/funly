-- OTP codes for custom email verification
create table public.otp_codes (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  code_hash  text        not null,  -- SHA-256 hex of the 6-digit code
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Fast lookup: find a valid (unused, not expired) code by email
create index otp_codes_lookup_idx
  on public.otp_codes (email, expires_at desc)
  where not used;

-- Only the service role may read/write this table
alter table public.otp_codes enable row level security;
