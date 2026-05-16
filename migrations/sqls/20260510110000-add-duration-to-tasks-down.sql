DROP INDEX IF EXISTS idx_tasks_tasker_status_due;

ALTER TABLE tasks
  DROP COLUMN IF EXISTS estimated_duration_minutes,
  DROP COLUMN IF EXISTS scheduled_start_time;
