-- ── Chore completions log ─────────────────────────────────────────────────────
-- Immutable record written every time a chore is completed.
-- Recurring chores reset their row on completion, so this table is the
-- only durable history for recurring completions.

CREATE TABLE chore_completions (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id    uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  chore_id        uuid        REFERENCES chores(id)             ON DELETE SET NULL,
  chore_name      text        NOT NULL,
  category        text        NOT NULL DEFAULT 'general',
  priority        text        NOT NULL DEFAULT 'medium',
  completed_by    uuid        NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  completed_at    timestamptz NOT NULL DEFAULT now(),
  due_date        date,
  was_on_time     boolean,           -- NULL when chore had no due date
  points          integer     NOT NULL DEFAULT 0,
  photo_proof_url text
);

CREATE INDEX cc_household_completed ON chore_completions (household_id, completed_at DESC);
CREATE INDEX cc_completed_by        ON chore_completions (household_id, completed_by, completed_at DESC);
CREATE INDEX cc_category            ON chore_completions (household_id, category);

ALTER TABLE chore_completions ENABLE ROW LEVEL SECURITY;

-- Members can read the completion log for their household
CREATE POLICY "members_select_completions" ON chore_completions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = chore_completions.household_id
        AND hm.user_id = auth.uid()
    )
  );

-- Members can insert their own completion records
CREATE POLICY "members_insert_completions" ON chore_completions
  FOR INSERT WITH CHECK (
    completed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = chore_completions.household_id
        AND hm.user_id = auth.uid()
    )
  );

-- ── Back-fill from already-completed one-time chores ─────────────────────────

INSERT INTO chore_completions (
  household_id, chore_id, chore_name, category, priority,
  completed_by, completed_at, due_date, was_on_time, points, photo_proof_url
)
SELECT
  household_id,
  id                AS chore_id,
  name              AS chore_name,
  category,
  priority,
  completed_by,
  completed_at,
  due_date::date,
  CASE
    WHEN due_date IS NULL THEN NULL
    WHEN completed_at::date <= due_date::date THEN true
    ELSE false
  END               AS was_on_time,
  points,
  photo_proof_url
FROM chores
WHERE status = 'completed'
  AND completed_at IS NOT NULL
  AND completed_by IS NOT NULL
ON CONFLICT DO NOTHING;
