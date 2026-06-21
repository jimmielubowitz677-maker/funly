-- Track when a creator accepted the platform terms (15% commission)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS creator_terms_accepted_at timestamptz;
