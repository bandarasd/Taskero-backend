CREATE TABLE IF NOT EXISTS tasker_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tasker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 6=Sat
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  buffer_minutes INT NOT NULL DEFAULT 30 CHECK (buffer_minutes >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tasker_id, day_of_week),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_tasker_schedules_tasker_id ON tasker_schedules(tasker_id);
