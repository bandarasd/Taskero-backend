ALTER TABLE users
  DROP COLUMN IF EXISTS completed_jobs,
  DROP COLUMN IF EXISTS no_show_cancellations,
  DROP COLUMN IF EXISTS completion_rate;
