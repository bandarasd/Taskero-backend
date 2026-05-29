-- Revert gigs
ALTER TABLE gigs
  DROP COLUMN IF EXISTS visit_tiers,
  ADD COLUMN delivery_time INT;

-- Revert tasks
ALTER TABLE tasks
  DROP COLUMN IF EXISTS time_preference,
  DROP COLUMN IF EXISTS selected_tier_label,
  DROP COLUMN IF EXISTS selected_tier_days,
  DROP COLUMN IF EXISTS surcharge_amount,
  DROP COLUMN IF EXISTS promised_visit_date,
  DROP COLUMN IF EXISTS late_penalty_percent,
  DROP COLUMN IF EXISTS late_penalty_amount,
  ADD COLUMN scheduled_start_time TIMESTAMPTZ;

-- Revert tasker_schedules
ALTER TABLE tasker_schedules
  DROP COLUMN IF EXISTS morning_available,
  DROP COLUMN IF EXISTS afternoon_available,
  DROP COLUMN IF EXISTS evening_available,
  ADD COLUMN start_time TIME NOT NULL DEFAULT '09:00',
  ADD COLUMN end_time TIME NOT NULL DEFAULT '17:00',
  ADD COLUMN buffer_minutes INT NOT NULL DEFAULT 30;
