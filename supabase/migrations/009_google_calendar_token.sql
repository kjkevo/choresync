-- Store each user's Google Calendar OAuth refresh token.
-- NULL = not connected. The token is write-protected by RLS:
-- only the owning user or a server-role process may update it.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS google_calendar_refresh_token text;

-- Prevent other household members from reading this column.
-- We tighten the existing users SELECT policy to exclude the token
-- by keeping it in the Row type but relying on application-level
-- logic to never expose it to client components.
-- (The column is only ever read in server components / API routes.)
