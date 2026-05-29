ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes INT,
  ADD COLUMN IF NOT EXISTS scheduled_start_time TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_tasker_status_due ON tasks(tasker_id, status, due_date);
