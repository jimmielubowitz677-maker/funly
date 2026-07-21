-- Keep first-login campaign data server-managed. Public clients only need to
-- read their own delivery and mark its animation as shown.
REVOKE ALL ON public.first_login_campaigns FROM anon, authenticated;
REVOKE ALL ON public.first_login_deliveries FROM anon, authenticated;
GRANT SELECT ON public.first_login_deliveries TO authenticated;
GRANT UPDATE (animation_shown_at) ON public.first_login_deliveries TO authenticated;

REVOKE ALL ON FUNCTION public.claim_first_login_delivery() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_first_login_delivery() TO authenticated;

-- page_views is written by trusted server-side code only.
REVOKE ALL ON public.page_views FROM anon, authenticated;
