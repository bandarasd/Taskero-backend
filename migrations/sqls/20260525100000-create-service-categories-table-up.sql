CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  icon VARCHAR(10) NOT NULL DEFAULT '',
  requires_certification BOOLEAN NOT NULL DEFAULT FALSE,
  image_url TEXT,
  booking_fields JSONB NOT NULL DEFAULT '[]',
  cert_requirements JSONB NOT NULL DEFAULT '[]',
  cert_description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
