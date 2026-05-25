ALTER TABLE tasks
  DROP COLUMN IF EXISTS overrun_notified_at,
  DROP COLUMN IF EXISTS delay_response,
  DROP COLUMN IF EXISTS tasker_new_eta;
