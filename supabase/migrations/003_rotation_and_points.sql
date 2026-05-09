-- ── 003_rotation_and_points.sql ───────────────────────────────────────────────
-- Run with: supabase db push  (or apply in Supabase SQL editor)

-- ── 1. Extend chores with rotation + points ───────────────────────────────────

ALTER TABLE public.chores
  ADD COLUMN IF NOT EXISTS rotation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotation_members jsonb   NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rotation_index   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points           integer NOT NULL DEFAULT 0
                                            CHECK (points >= 0 AND points <= 100);

COMMENT ON COLUMN public.chores.rotation_enabled IS
  'When true, completing the chore advances assigned_to to the next member in rotation_members.';
COMMENT ON COLUMN public.chores.rotation_members IS
  'Ordered JSON array of user_ids participating in the rotation.';
COMMENT ON COLUMN public.chores.rotation_index IS
  'Index into rotation_members of the currently assigned member.';
COMMENT ON COLUMN public.chores.points IS
  'Points awarded to the completer. 0 = no points. Max 100.';

-- Enforce: rotation requires at least one member when enabled (soft constraint via app logic)
-- Hard constraint: rotation_index must be non-negative
ALTER TABLE public.chores
  ADD CONSTRAINT chores_rotation_index_non_negative CHECK (rotation_index >= 0);

-- ── 2. swap_requests ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.swap_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id      uuid        NOT NULL REFERENCES public.chores(id)      ON DELETE CASCADE,
  household_id  uuid        NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  requester_id  uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  requestee_id  uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT swap_different_users CHECK (requester_id <> requestee_id)
);

-- Speed up "show me my pending swap requests" query
CREATE INDEX IF NOT EXISTS idx_swap_requests_requestee_pending
  ON public.swap_requests (requestee_id, status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_swap_requests_chore_pending
  ON public.swap_requests (chore_id)
  WHERE status = 'pending';

CREATE TRIGGER set_swap_requests_updated_at
  BEFORE UPDATE ON public.swap_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;

-- Any household member may view swap requests in their household
CREATE POLICY "household members can view swap requests"
  ON public.swap_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = swap_requests.household_id
    )
  );

-- Only the current assignee (requester) may open a swap request
CREATE POLICY "current assignee can request swap"
  ON public.swap_requests FOR INSERT
  WITH CHECK (
    requester_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = swap_requests.household_id
    )
  );

-- Requester may cancel; requestee may accept/decline
CREATE POLICY "involved parties can update swap request"
  ON public.swap_requests FOR UPDATE
  USING  (requestee_id = auth.uid() OR requester_id = auth.uid())
  WITH CHECK (requestee_id = auth.uid() OR requester_id = auth.uid());

-- ── 3. point_events ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.point_events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id)      ON DELETE CASCADE,
  household_id uuid        NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  chore_id     uuid        REFERENCES public.chores(id)              ON DELETE SET NULL,
  chore_name   text        NOT NULL DEFAULT '',  -- snapshot so leaderboard survives deletions
  points       integer     NOT NULL CHECK (points > 0),
  earned_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_events_leaderboard
  ON public.point_events (household_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_point_events_user
  ON public.point_events (user_id, household_id, earned_at DESC);

ALTER TABLE public.point_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can view point events"
  ON public.point_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = point_events.household_id
    )
  );

-- Server actions insert on behalf of the completing user
CREATE POLICY "members can record own points"
  ON public.point_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = point_events.household_id
    )
  );