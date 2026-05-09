ALTER TABLE gigs
  ADD COLUMN service_area_lat       DOUBLE PRECISION,
  ADD COLUMN service_area_lng       DOUBLE PRECISION,
  ADD COLUMN service_area_radius_km DOUBLE PRECISION DEFAULT 10;
