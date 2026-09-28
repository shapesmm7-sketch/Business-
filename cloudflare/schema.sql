-- D1 Database Schema for Brivu Cloudflare Worker
-- Run with: npx wrangler d1 execute brivu-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS sync_snapshots (
  id TEXT PRIMARY KEY,
  exported_at TEXT,
  version INTEGER DEFAULT 1,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL,
  document_type TEXT DEFAULT 'receipt',
  customer_name TEXT,
  customer_phone TEXT,
  total REAL NOT NULL,
  amount_paid REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  payment_status TEXT,
  payment_method TEXT,
  created_at TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_document_type ON receipts(document_type);
CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number);

CREATE TABLE IF NOT EXISTS files_meta (
  key TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER,
  folder TEXT,
  r2_key TEXT NOT NULL,
  uploaded_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_uploaded_at ON files_meta(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_files_folder ON files_meta(folder);

CREATE TABLE IF NOT EXISTS inventory_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  cost_price REAL DEFAULT 0,
  selling_price REAL DEFAULT 0,
  category_id TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS business_profile (
  id TEXT PRIMARY KEY DEFAULT 'current',
  name TEXT,
  currency TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS qr_pages (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  category TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qr_pages_updated_at ON qr_pages(updated_at);
