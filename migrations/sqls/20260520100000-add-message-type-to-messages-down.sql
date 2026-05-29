ALTER TABLE messages
  DROP COLUMN IF EXISTS message_type,
  DROP COLUMN IF EXISTS ref_task_id;
