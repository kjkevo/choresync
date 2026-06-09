-- Add notification preferences to users table
-- notification_chore_reminders: ON/OFF for chore reminders
-- notification_new_messages: ON/OFF for new message alerts
-- quiet_hours_start: Start time for quiet hours (e.g., "21:00")
-- quiet_hours_end: End time for quiet hours (e.g., "08:00")
-- quiet_hours_enabled: ON/OFF toggle for quiet hours

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_chore_reminders boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS notification_new_messages boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS quiet_hours_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiet_hours_start text DEFAULT '21:00',
  ADD COLUMN IF NOT EXISTS quiet_hours_end text DEFAULT '08:00';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS users_notification_prefs_idx
  ON users (id, notification_chore_reminders, notification_new_messages, quiet_hours_enabled);
