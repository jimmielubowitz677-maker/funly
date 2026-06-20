-- Creator-controlled displayed subscriber count
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_subscriber_count integer;

-- Page view log for platform admin
CREATE TABLE IF NOT EXISTS public.page_views (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email      text,
  path       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS page_views_created_at_idx ON public.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS page_views_email_idx     ON public.page_views (email) WHERE email IS NOT NULL;

-- Lock down to service role only
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
