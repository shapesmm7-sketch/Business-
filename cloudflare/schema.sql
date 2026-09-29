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

CREATE TABLE IF NOT EXISTS inventory_sales (
  id TEXT PRIMARY KEY,
  product_id TEXT,
  product_name TEXT,
  quantity REAL DEFAULT 1,
  total_price REAL NOT NULL DEFAULT 0,
  profit REAL DEFAULT 0,
  date TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_expenses (
  id TEXT PRIMARY KEY,
  category TEXT,
  amount REAL NOT NULL DEFAULT 0,
  description TEXT,
  date TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventory_debts (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'unpaid',
  due_date TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  location TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  shop_name TEXT,
  contact TEXT,
  address TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_ledger (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  record_type TEXT,
  amount REAL DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT,
  salary REAL DEFAULT 0,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_sales (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  amount REAL DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id TEXT PRIMARY KEY,
  item_name TEXT NOT NULL,
  quantity REAL DEFAULT 1,
  checked INTEGER DEFAULT 0,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
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
