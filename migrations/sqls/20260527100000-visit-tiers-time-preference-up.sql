-- Gigs: replace delivery_time with visit_tiers JSONB
ALTER TABLE gigs
  DROP COLUMN IF EXISTS delivery_time,
  ADD COLUMN visit_tiers JSONB NOT NULL DEFAULT '[{"label":"Standard","days":7,"surcharge_type":"percent","surcharge_value":0}]';

-- Tasks: add time preference, tier snapshot, surcharge, promised visit date, penalty fields
ALTER TABLE tasks
  DROP COLUMN IF EXISTS scheduled_start_time,
  ADD COLUMN time_preference VARCHAR(20),
  ADD COLUMN selected_tier_label VARCHAR(100),
  ADD COLUMN selected_tier_days INT,
  ADD COLUMN surcharge_amount DECIMAL(10,2),
  ADD COLUMN promised_visit_date DATE,
  ADD COLUMN late_penalty_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN late_penalty_amount DECIMAL(10,2);

-- tasker_schedules: replace HH:MM slot columns with morning/afternoon/evening availability
ALTER TABLE tasker_schedules
  DROP COLUMN IF EXISTS start_time,
  DROP COLUMN IF EXISTS end_time,
  DROP COLUMN IF EXISTS buffer_minutes,
  ADD COLUMN morning_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN afternoon_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN evening_available BOOLEAN NOT NULL DEFAULT TRUE;
