ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS original_amount_cents integer,
  ADD COLUMN IF NOT EXISTS discount_amount_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id uuid,
  ADD COLUMN IF NOT EXISTS promo_code_snapshot text,
  ADD COLUMN IF NOT EXISTS discount_percent integer;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS purchase_plan_id text;

CREATE TABLE public.promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  discount_percent integer NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  max_redemptions_per_user integer NOT NULL DEFAULT 1 CHECK (max_redemptions_per_user > 0),
  minimum_order_amount_cents integer CHECK (minimum_order_amount_cents IS NULL OR minimum_order_amount_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  applies_to text NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','subscription','plan','ppv','model','post')),
  target_id uuid,
  admin_note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX promo_codes_code_upper_idx ON public.promo_codes (upper(code));
CREATE INDEX promo_codes_active_idx ON public.promo_codes (is_active, starts_at, expires_at);

CREATE TABLE public.promo_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id uuid NOT NULL REFERENCES public.promo_codes(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  payment_id uuid NOT NULL UNIQUE REFERENCES public.payments(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','confirmed','released','expired','failed')),
  original_amount_cents integer NOT NULL CHECK (original_amount_cents > 0),
  discount_amount_cents integer NOT NULL CHECK (discount_amount_cents >= 0),
  final_amount_cents integer NOT NULL CHECK (final_amount_cents >= 0),
  currency char(3) NOT NULL,
  discount_percent_snapshot integer NOT NULL,
  promo_code_snapshot text NOT NULL,
  reserved_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  released_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promo_redemptions_code_status_idx ON public.promo_code_redemptions (promo_code_id, status);
CREATE INDEX promo_redemptions_user_idx ON public.promo_code_redemptions (user_id, status);

ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_code_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.promo_codes, public.promo_code_redemptions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.reserve_promo_code_for_payment(
  p_code text, p_user_id uuid, p_payment_id uuid, p_original_amount_cents integer,
  p_currency text, p_purchase_type text, p_target_id uuid DEFAULT NULL
) RETURNS TABLE(promo_code_id uuid, promo_code_snapshot text, discount_percent integer, original_amount_cents integer, discount_amount_cents integer, final_amount_cents integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.promo_codes%ROWTYPE; used_count integer; user_count integer; discount integer;
BEGIN
  SELECT * INTO c FROM public.promo_codes WHERE upper(code)=upper(trim(p_code)) FOR UPDATE;
  IF c.id IS NULL THEN RAISE EXCEPTION 'invalid_promo_code'; END IF;
  IF NOT c.is_active THEN RAISE EXCEPTION 'promo_code_inactive'; END IF;
  IF c.starts_at IS NOT NULL AND c.starts_at > now() THEN RAISE EXCEPTION 'promo_code_not_started'; END IF;
  IF c.expires_at IS NOT NULL AND c.expires_at <= now() THEN RAISE EXCEPTION 'promo_code_expired'; END IF;
  IF c.currency <> upper(p_currency) THEN RAISE EXCEPTION 'promo_code_invalid_purchase'; END IF;
  IF c.minimum_order_amount_cents IS NOT NULL AND p_original_amount_cents < c.minimum_order_amount_cents THEN RAISE EXCEPTION 'minimum_purchase_not_reached'; END IF;
  IF c.applies_to = 'subscription' AND p_purchase_type <> 'subscription' THEN RAISE EXCEPTION 'promo_code_invalid_purchase'; END IF;
  IF c.applies_to = 'plan' AND (p_purchase_type <> 'subscription' OR c.target_id IS DISTINCT FROM p_target_id) THEN RAISE EXCEPTION 'promo_code_invalid_purchase'; END IF;
  IF c.applies_to = 'ppv' AND p_purchase_type <> 'ppv' THEN RAISE EXCEPTION 'promo_code_invalid_purchase'; END IF;
  IF c.applies_to IN ('model','post') AND (c.target_id IS DISTINCT FROM p_target_id) THEN RAISE EXCEPTION 'promo_code_invalid_purchase'; END IF;
  SELECT count(*) INTO used_count FROM public.promo_code_redemptions WHERE promo_code_id=c.id AND status='confirmed';
  IF c.max_redemptions IS NOT NULL AND used_count >= c.max_redemptions THEN RAISE EXCEPTION 'promo_usage_limit_reached'; END IF;
  SELECT count(*) INTO user_count FROM public.promo_code_redemptions WHERE promo_code_id=c.id AND user_id=p_user_id AND status IN ('reserved','confirmed') AND expires_at > now();
  IF user_count >= c.max_redemptions_per_user THEN RAISE EXCEPTION 'promo_user_limit_reached'; END IF;
  discount := round(p_original_amount_cents::numeric * c.discount_percent / 100);
  INSERT INTO public.promo_code_redemptions(promo_code_id,user_id,payment_id,original_amount_cents,discount_amount_cents,final_amount_cents,currency,discount_percent_snapshot,promo_code_snapshot)
  VALUES(c.id,p_user_id,p_payment_id,p_original_amount_cents,discount,p_original_amount_cents-discount,upper(p_currency),c.discount_percent,upper(trim(p_code)));
  RETURN QUERY SELECT c.id, upper(trim(p_code)), c.discount_percent, p_original_amount_cents, discount, p_original_amount_cents-discount;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_promo_code_for_payment(text,uuid,uuid,integer,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_promo_code_for_payment(text,uuid,uuid,integer,text,text,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.confirm_promo_redemption(p_payment_id uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.promo_code_redemptions SET status='confirmed', confirmed_at=coalesce(confirmed_at,now()), updated_at=now()
  WHERE payment_id=p_payment_id AND status IN ('reserved','confirmed');
$$;
CREATE OR REPLACE FUNCTION public.release_promo_redemption(p_payment_id uuid, p_status text DEFAULT 'released') RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.promo_code_redemptions SET status=CASE WHEN p_status IN ('expired','failed') THEN p_status ELSE 'released' END, released_at=coalesce(released_at,now()), updated_at=now()
  WHERE payment_id=p_payment_id AND status='reserved';
$$;
REVOKE ALL ON FUNCTION public.confirm_promo_redemption(uuid), public.release_promo_redemption(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_promo_redemption(uuid), public.release_promo_redemption(uuid,text) TO service_role;
