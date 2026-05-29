ALTER TABLE tasks
  DROP COLUMN IF EXISTS tasker_responded_at,
  DROP COLUMN IF EXISTS cancellation_reason;
