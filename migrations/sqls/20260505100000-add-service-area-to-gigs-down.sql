ALTER TABLE gigs
  DROP COLUMN IF EXISTS service_area_lat,
  DROP COLUMN IF EXISTS service_area_lng,
  DROP COLUMN IF EXISTS service_area_radius_km;
