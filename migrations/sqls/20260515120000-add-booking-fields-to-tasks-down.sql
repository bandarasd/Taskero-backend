ALTER TABLE tasks
  DROP COLUMN IF EXISTS category,
  DROP COLUMN IF EXISTS notes,
  DROP COLUMN IF EXISTS details,
  DROP COLUMN IF EXISTS location_address,
  DROP COLUMN IF EXISTS location_lat,
  DROP COLUMN IF EXISTS location_lng,
  DROP COLUMN IF EXISTS scheduled_at,
  DROP COLUMN IF EXISTS base_price;
