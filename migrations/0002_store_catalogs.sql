-- Migration: 0002_store_catalogs.sql
-- Description: Dedicated Live Stock Catalog table cleanly separated from qr_pages

CREATE TABLE IF NOT EXISTS store_catalogs (
  slug TEXT PRIMARY KEY,
  catalog_id TEXT,
  user_email TEXT,
  business_name TEXT,
  catalog_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_store_catalogs_slug ON store_catalogs(slug);
CREATE INDEX IF NOT EXISTS idx_store_catalogs_user ON store_catalogs(user_email);
CREATE INDEX IF NOT EXISTS idx_store_catalogs_catalog_id ON store_catalogs(catalog_id);
