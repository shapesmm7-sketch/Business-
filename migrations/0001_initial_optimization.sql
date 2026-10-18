-- Migration: 0001_initial_optimization.sql
-- Description: Optimized schema and indexes for products, invoices, invoice_items, menus with multi-tenant shop_id and hotel_id isolation

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT,
  category TEXT,
  selling_price REAL,
  cost_price REAL,
  stock_quantity INTEGER,
  image TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_shop_updated ON products(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL,
  invoice_number TEXT,
  customer_name TEXT,
  total REAL,
  tax REAL,
  status TEXT,
  updated_at TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_shop_updated ON invoices(shop_id, updated_at);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  product_id TEXT,
  quantity INTEGER,
  unit_price REAL,
  total REAL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

CREATE TABLE IF NOT EXISTS menus (
  id TEXT PRIMARY KEY,
  hotel_id TEXT NOT NULL,
  title TEXT,
  menu_data TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_menus_hotel_id ON menus(hotel_id);
CREATE INDEX IF NOT EXISTS idx_menus_hotel_updated ON menus(hotel_id, updated_at);
