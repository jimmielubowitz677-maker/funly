-- Creator profiles owned by a single auth user.
--
-- Problem: public.users.id has a FK → auth.users(id) which means every row
-- must correspond to a real Supabase Auth account.  Creator profiles created
-- by an owner on behalf of a model do NOT have their own Auth account, so we
-- need to drop that constraint.
--
-- Solution:
--   1. Drop the id → auth.users FK so profile-only rows can exist.
--   2. Add owner_id → auth.users(id) so the managing account must still be
--      a real Auth user (real accounts can also own themselves).
--   3. Back-fill owner_id = id for existing is_creator rows so they continue
--      to appear in the admin's "My Models" list.

-- 1. Drop the constraint that ties every users row to an auth.users entry.
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. Add owner_id column (nullable — regular subscriber rows have no owner).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS owner_id uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 3. Index for the common admin query: "give me all models owned by user X".
CREATE INDEX IF NOT EXISTS users_owner_id_idx ON public.users (owner_id)
  WHERE owner_id IS NOT NULL;

-- 4. Back-fill: existing creators own themselves.
UPDATE public.users
  SET owner_id = id
  WHERE is_creator = true
    AND owner_id IS NULL
    AND id IN (SELECT id FROM auth.users);
