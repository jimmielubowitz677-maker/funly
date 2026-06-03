-- Extend payment_provider enum to include crypto (NOWPayments)
alter type payment_provider add value if not exists 'crypto';

-- Track subscription tier (fan / superfan / vip) on each subscription row
alter table public.subscriptions
  add column if not exists plan_id text;
