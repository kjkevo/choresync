-- ── 004_badges_and_streaks.sql ───────────────────────────────────────────────
-- Run with: supabase db push  (or apply in Supabase SQL editor)

-- ── 1. badges ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.badges (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  household_id uuid        NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  badge_type   text        NOT NULL
                           CHECK (badge_type IN (
                             'first_chore',
                             'chores_10',
                             'chores_100',
                             'streak_7',
                             'streak_30',
                             'top_contributor'
                           )),
  earned_at    timestamptz NOT NULL DEFAULT now()
);

-- Prevent awarding the same one-time badge twice.
-- top_contributor is repeatable (once per month) so it is excluded from this index.
CREATE UNIQUE INDEX IF NOT EXISTS badges_unique_one_time
  ON public.badges (user_id, household_id, badge_type)
  WHERE badge_type NOT IN ('top_contributor');

CREATE INDEX IF NOT EXISTS idx_badges_user_household
  ON public.badges (user_id, household_id, earned_at DESC);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can view badges"
  ON public.badges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = badges.household_id
    )
  );

CREATE POLICY "members can earn own badges"
  ON public.badges FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = badges.household_id
    )
  );

-- ── 2. user_streaks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_streaks (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.users(id)       ON DELETE CASCADE,
  household_id      uuid        NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  current_streak    integer     NOT NULL DEFAULT 0  CHECK (current_streak    >= 0),
  longest_streak    integer     NOT NULL DEFAULT 0  CHECK (longest_streak    >= 0),
  last_active_date  date,
  total_completions integer     NOT NULL DEFAULT 0  CHECK (total_completions >= 0),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, household_id)
);

COMMENT ON COLUMN public.user_streaks.current_streak IS
  'Consecutive days on which the user completed at least one chore.';
COMMENT ON COLUMN public.user_streaks.total_completions IS
  'All-time chore completion count for this user in this household.';

CREATE INDEX IF NOT EXISTS idx_user_streaks_household_streak
  ON public.user_streaks (household_id, current_streak DESC);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can view streaks"
  ON public.user_streaks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.household_members
      WHERE user_id = auth.uid()
        AND household_id = user_streaks.household_id
    )
  );

CREATE POLICY "members can insert own streak"
  ON public.user_streaks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "members can update own streak"
  ON public.user_streaks FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
