-- ── Messages ──────────────────────────────────────────────────────────────────

CREATE TABLE messages (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid        NOT NULL REFERENCES households(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  edited_at    timestamptz
);

CREATE INDEX messages_household_created ON messages (household_id, created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_messages" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = messages.household_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_messages" ON messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = messages.household_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "author_delete_message" ON messages
  FOR DELETE USING (user_id = auth.uid());

-- ── Message reactions ─────────────────────────────────────────────────────────

CREATE TABLE message_reactions (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  emoji      text        NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮','🎉','🔥')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX message_reactions_message ON message_reactions (message_id);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_reactions" ON message_reactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM messages m
      JOIN household_members hm ON hm.household_id = m.household_id
      WHERE m.id = message_reactions.message_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_reactions" ON message_reactions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM messages m
      JOIN household_members hm ON hm.household_id = m.household_id
      WHERE m.id = message_reactions.message_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "author_delete_reaction" ON message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ── Chore comments ────────────────────────────────────────────────────────────

CREATE TABLE chore_comments (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  chore_id     uuid        NOT NULL REFERENCES chores(id)      ON DELETE CASCADE,
  household_id uuid        NOT NULL REFERENCES households(id)  ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX chore_comments_chore ON chore_comments (chore_id, created_at);

ALTER TABLE chore_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_chore_comments" ON chore_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = chore_comments.household_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "members_insert_chore_comments" ON chore_comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = chore_comments.household_id AND hm.user_id = auth.uid()
    )
  );

CREATE POLICY "author_delete_chore_comment" ON chore_comments
  FOR DELETE USING (user_id = auth.uid());

-- ── Announcements ─────────────────────────────────────────────────────────────

CREATE TABLE announcements (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   uuid        NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  content      text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_pinned    boolean     NOT NULL DEFAULT false,
  pinned_at    timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX announcements_household ON announcements (household_id, is_pinned DESC, created_at DESC);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_announcements" ON announcements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = announcements.household_id AND hm.user_id = auth.uid()
    )
  );

-- Admins can do everything
CREATE POLICY "admins_manage_announcements" ON announcements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = announcements.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = announcements.household_id
        AND hm.user_id = auth.uid()
        AND hm.role = 'admin'
    )
  );

-- ── Realtime ──────────────────────────────────────────────────────────────────

ALTER TABLE messages          REPLICA IDENTITY FULL;
ALTER TABLE message_reactions REPLICA IDENTITY FULL;
ALTER TABLE announcements     REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
