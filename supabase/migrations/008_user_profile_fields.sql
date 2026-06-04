-- Add username and tagline to users
-- username: unique @handle (optional)
-- tagline:  personal one-liner (optional)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS tagline  text;

-- Enforce unique usernames (case-insensitive) where set
CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_key
  ON users (lower(username))
  WHERE username IS NOT NULL;

-- Allow users to update their own username + tagline
-- (the existing RLS policy for users allows SELECT for household members;
--  this policy allows each user to UPDATE their own row)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_update_own'
  ) THEN
    CREATE POLICY "users_update_own" ON users
      FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;
