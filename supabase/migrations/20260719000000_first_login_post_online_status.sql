ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_login_post_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_online boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS online_status_updated_at timestamptz;

CREATE TABLE public.first_login_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enabled boolean NOT NULL DEFAULT false,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  animation_delay_ms integer NOT NULL DEFAULT 1000 CHECK (animation_delay_ms BETWEEN 500 AND 3000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX first_login_campaign_singleton_idx
  ON public.first_login_campaigns ((true));

CREATE TABLE public.first_login_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.first_login_campaigns(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.posts(id) ON DELETE SET NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  animation_shown_at timestamptz,
  is_test boolean NOT NULL DEFAULT false,
  UNIQUE (user_id)
);

CREATE INDEX first_login_deliveries_campaign_idx ON public.first_login_deliveries (campaign_id);

CREATE TRIGGER first_login_campaigns_updated_at
  BEFORE UPDATE ON public.first_login_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.first_login_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.first_login_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "first login delivery: read own"
  ON public.first_login_deliveries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "first login delivery: mark own animation"
  ON public.first_login_deliveries FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE INSERT, DELETE, UPDATE ON public.first_login_deliveries FROM authenticated;
GRANT SELECT ON public.first_login_deliveries TO authenticated;
GRANT UPDATE (animation_shown_at) ON public.first_login_deliveries TO authenticated;

CREATE OR REPLACE FUNCTION public.claim_first_login_delivery()
RETURNS TABLE (
  delivery_id uuid,
  campaign_id uuid,
  post_id uuid,
  delivered_at timestamptz,
  animation_delay_ms integer,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  active_campaign public.first_login_campaigns%ROWTYPE;
  inserted_delivery public.first_login_deliveries%ROWTYPE;
  eligibility_claimed uuid;
BEGIN
  IF current_user_id IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;

  SELECT c.* INTO active_campaign
  FROM public.first_login_campaigns c
  WHERE c.enabled = true AND c.post_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = c.post_id)
  ORDER BY c.updated_at DESC LIMIT 1;
  IF active_campaign.id IS NULL THEN RETURN; END IF;

  -- Only consume eligibility when an active campaign is configured. This keeps
  -- disabled or incomplete campaigns from permanently losing new users.
  UPDATE public.users u
  SET first_login_post_eligible = false
  WHERE u.id = current_user_id
    AND u.first_login_post_eligible = true
    AND u.is_creator = false
    AND u.owner_id IS NULL
  RETURNING u.id INTO eligibility_claimed;
  IF eligibility_claimed IS NULL THEN RETURN; END IF;

  INSERT INTO public.first_login_deliveries (user_id, campaign_id, post_id)
  VALUES (current_user_id, active_campaign.id, active_campaign.post_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING * INTO inserted_delivery;

  IF inserted_delivery.id IS NULL THEN
    RETURN QUERY SELECT d.id, d.campaign_id, d.post_id, d.delivered_at,
      active_campaign.animation_delay_ms, false
    FROM public.first_login_deliveries d WHERE d.user_id = current_user_id;
  ELSE
    RETURN QUERY SELECT inserted_delivery.id, inserted_delivery.campaign_id,
      inserted_delivery.post_id, inserted_delivery.delivered_at,
      active_campaign.animation_delay_ms, true;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_first_login_delivery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_login_delivery() TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;
