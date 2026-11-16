export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  DB?: any;
  brivu_db?: any;
  d1?: any;
  D1?: any;
  brivu_d1?: any;
  DATABASE?: any;
  BUCKET?: any;
  brivu_bucket?: any;
  MY_BUCKET?: any;
  r2?: any;
  R2?: any;
  brivu_r2?: any;
  BRIVU_BUCKET?: any;
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_REDIRECT_URI?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-User-Email, X-User-Id, X-Requested-With, X-WorkOS-Client-Id, X-WorkOS-Api-Key, Origin, Accept',
  'Access-Control-Max-Age': '86400',
};

// Digital Asset Links for Google Play Deep Links & Credential Sharing domain verification
const ASSET_LINKS_DATA = [
  {
    relation: [
      'delegate_permission/common.handle_all_urls',
      'delegate_permission/common.get_login_creds',
    ],
    target: {
      namespace: 'android_app',
      package_name: 'com.brivu.myapp',
      sha256_cert_fingerprints: [
        '79:9D:31:8F:BE:76:28:28:7E:49:0C:2F:1A:C8:A4:D3:C5:E9:63:C3:14:4A:D2:ED:4C:CA:D5:C0:6D:26:16:31',
        '3B:4E:4B:A1:71:DC:23:9E:DC:C7:8D:5D:16:9E:98:B3:65:74:14:0E:13:F1:6B:F2:BE:0F:D9:CC:89:C7:F1:07',
        'F1:49:EC:19:44:7A:A8:17:84:1D:F9:D8:F3:2D:DB:16:F2:E5:D3:89:14:33:E2:54:15:87:E8:99:A8:80:3F:DE',
      ],
    },
  },
];

// Flexible detector for any attached R2 storage bucket
export function getR2Bucket(env: any): any {
  if (env.BUCKET && typeof env.BUCKET.put === 'function') return env.BUCKET;
  if (env.brivu_bucket && typeof env.brivu_bucket.put === 'function') return env.brivu_bucket;
  if (env.MY_BUCKET && typeof env.MY_BUCKET.put === 'function') return env.MY_BUCKET;
  if (env.r2 && typeof env.r2.put === 'function') return env.r2;
  if (env.R2 && typeof env.R2.put === 'function') return env.R2;
  if (env.brivu_r2 && typeof env.brivu_r2.put === 'function') return env.brivu_r2;
  if (env.BRIVU_BUCKET && typeof env.BRIVU_BUCKET.put === 'function') return env.BRIVU_BUCKET;
  if (env.STORAGE && typeof env.STORAGE.put === 'function') return env.STORAGE;
  if (env.FILES && typeof env.FILES.put === 'function') return env.FILES;
  for (const [key, val] of Object.entries(env)) {
    if (key !== 'ASSETS' && val && typeof val === 'object' && typeof (val as any).put === 'function' && typeof (val as any).get === 'function') {
      return val;
    }
  }
  return null;
}

// Flexible detector for any attached D1 relational database
export function getD1Database(env: any): any {
  if (env.DB && typeof env.DB.prepare === 'function') return env.DB;
  if (env.brivu_db && typeof env.brivu_db.prepare === 'function') return env.brivu_db;
  if (env.d1 && typeof env.d1.prepare === 'function') return env.d1;
  if (env.D1 && typeof env.D1.prepare === 'function') return env.D1;
  if (env.brivu_d1 && typeof env.brivu_d1.prepare === 'function') return env.brivu_d1;
  if (env.BRIVU_DB && typeof env.BRIVU_DB.prepare === 'function') return env.BRIVU_DB;
  if (env.DATABASE && typeof env.DATABASE.prepare === 'function') return env.DATABASE;
  if (env.db && typeof env.db.prepare === 'function') return env.db;
  for (const [key, val] of Object.entries(env)) {
    if (val && typeof val === 'object' && typeof (val as any).prepare === 'function' && typeof (val as any).batch === 'function') {
      return val;
    }
  }
  return null;
}

// In-memory auth session cache for fast instant login polling across web and Android
const authSessionsCache = new Map<string, { status: string; code?: string; user?: any; createdAt: number }>();

export function hasRealQrPageContent(page: any): boolean {
  if (!page || typeof page !== 'object') return false;
  if (Array.isArray(page.eventsQrItems) && page.eventsQrItems.length > 0) return true;
  if (Array.isArray(page.websitesQrItems) && page.websitesQrItems.length > 0) return true;
  if (Array.isArray(page.socialsQrItems) && page.socialsQrItems.length > 0) return true;
  if (Array.isArray(page.menuItems) && page.menuItems.length > 0) return true;
  if (
    Array.isArray(page.photos) &&
    page.photos.some((p: any) => (typeof p === 'string' ? p.trim() !== '' : Boolean(p && p.url)))
  ) {
    return true;
  }
  if (Array.isArray(page.customSocialLinks) && page.customSocialLinks.length > 0) return true;
  if (Array.isArray(page.socialLinks) && page.socialLinks.length > 0) return true;
  if (
    page.socialLinks &&
    typeof page.socialLinks === 'object' &&
    !Array.isArray(page.socialLinks) &&
    Object.values(page.socialLinks).some((v: any) => typeof v === 'string' && v.trim() !== '')
  ) {
    return true;
  }
  if (page.logo || page.coverImage) return true;
  if (
    (typeof page.phone === 'string' && page.phone.trim() !== '') ||
    (typeof page.whatsapp === 'string' && page.whatsapp.trim() !== '') ||
    (typeof page.address === 'string' && page.address.trim() !== '') ||
    (typeof page.googleMapsUrl === 'string' && page.googleMapsUrl.trim() !== '') ||
    (typeof page.openingHours === 'string' && page.openingHours.trim() !== '') ||
    (typeof page.wifiName === 'string' && page.wifiName.trim() !== '') ||
    (typeof page.wifiPassword === 'string' && page.wifiPassword.trim() !== '') ||
    (typeof page.announcement === 'string' && page.announcement.trim() !== '') ||
    (typeof page.description === 'string' && page.description.trim() !== '')
  ) {
    return true;
  }
  const tagline = typeof page.tagline === 'string' ? page.tagline.trim() : '';
  if (tagline !== '' && tagline !== 'Welcome to our official business page') {
    return true;
  }
  const title = typeof page.title === 'string' ? page.title.trim() : '';
  const defaultTitles = new Set([
    '',
    'Brivu Business',
    'My Business',
    'Our Events',
    'Our Sites',
    'Social Media Hub',
    'Official Social Links',
    'our social media platforms',
  ]);
  if (title && !defaultTitles.has(title) && !title.endsWith("'s Business")) {
    return true;
  }
  return false;
}

export function hasRealUserContent(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const backup = data.backupData || data;
  if (Array.isArray(backup.receipts) && backup.receipts.length > 0) return true;
  if (Array.isArray(backup.inventoryProducts) && backup.inventoryProducts.length > 0) return true;
  if (Array.isArray(backup.inventorySales) && backup.inventorySales.length > 0) return true;
  if (Array.isArray(backup.inventoryExpenses) && backup.inventoryExpenses.length > 0) return true;
  if (Array.isArray(backup.inventoryDebts) && backup.inventoryDebts.length > 0) return true;
  if (Array.isArray(backup.customers) && backup.customers.length > 0) return true;
  if (Array.isArray(backup.agents) && backup.agents.length > 0) return true;
  if (Array.isArray(backup.workers) && backup.workers.length > 0) return true;
  if (Array.isArray(backup.shoppingListItems) && backup.shoppingListItems.length > 0) return true;
  if (Array.isArray(backup.eventsQrItems) && backup.eventsQrItems.length > 0) return true;
  if (Array.isArray(backup.websitesQrItems) && backup.websitesQrItems.length > 0) return true;
  if (Array.isArray(backup.socialsQrItems) && backup.socialsQrItems.length > 0) return true;
  if (Array.isArray(backup.photos) && backup.photos.length > 0) return true;
  if (Array.isArray(backup.qrHostedPages) && backup.qrHostedPages.some(hasRealQrPageContent)) return true;

  const prof = backup.profile;
  if (prof && typeof prof === 'object') {
    if (prof.phone || prof.whatsapp || prof.address || prof.logo || prof.signature || prof.taxNumber || prof.bankName || prof.website || prof.description) return true;
    if (prof.name && prof.name !== 'Brivu Business' && prof.name !== 'QuickReceipt' && prof.name !== 'My Business' && prof.name !== 'brivu' && prof.name.trim() !== '') return true;
  }
  return false;
}

// 60s Query Cache & D1 metrics logger
const queryCache = new Map<string, { data: any; expiry: number }>();

export function getCachedQuery(key: string): any | null {
  const cached = queryCache.get(key);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }
  queryCache.delete(key);
  return null;
}

export function setCachedQuery(key: string, data: any, ttlSeconds = 60): void {
  queryCache.set(key, { data, expiry: Date.now() + ttlSeconds * 1000 });
}

export function invalidateCachePattern(pattern: string): void {
  for (const k of queryCache.keys()) {
    if (k.includes(pattern)) {
      queryCache.delete(k);
    }
  }
}

export async function executeMeasuredQuery(stmt: any, queryName = 'D1_QUERY'): Promise<any> {
  const start = Date.now();
  let res: any;
  try {
    res = await stmt.all();
  } catch (err) {
    try {
      res = await stmt.run();
    } catch (err2) {
      res = { results: [], meta: { rows_read: 0, rows_written: 0, duration: Date.now() - start } };
    }
  }
  const duration = Date.now() - start;
  const meta = res?.meta || {};
  const rowsRead = meta.rows_read ?? meta.rowsRead ?? 0;
  const rowsWritten = meta.rows_written ?? meta.rowsWritten ?? 0;
  console.info(`[D1 METRICS] query=${queryName} rows_read=${rowsRead} rows_written=${rowsWritten} duration_ms=${duration}`);
  return res;
}

// Per-isolate schema cache so D1 DDL runs at most ONCE per cold start
let d1SchemaReady = false;
let d1SchemaPromise: Promise<void> | null = null;

function decodeBase64ToUint8Array(base64Input: string): Uint8Array {
  const cleanBase64 = base64Input.includes(',') ? base64Input.split(',')[1] : base64Input;
  if (!cleanBase64) return new Uint8Array(0);
  if (typeof (Uint8Array as any).fromBase64 === 'function') {
    try {
      return (Uint8Array as any).fromBase64(cleanBase64);
    } catch (_) {}
  }
  const binary = atob(cleanBase64);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = binary.charCodeAt(i);
  }
  return buffer;
}

async function executeD1Batch(db: any, statements: any[], chunkSize = 40): Promise<void> {
  if (!db || !statements || statements.length === 0) return;
  if (typeof db.batch === 'function') {
    for (let i = 0; i < statements.length; i += chunkSize) {
      await db.batch(statements.slice(i, i + chunkSize));
    }
    return;
  }
  for (const stmt of statements) {
    await stmt.run();
  }
}

export function isQrGalleryPhotoFile(keyOrId: string, filename?: string, mimeType?: string): boolean {
  const k = String(keyOrId || '').toLowerCase();
  const f = String(filename || k.split('/').pop() || '').toLowerCase();
  const m = String(mimeType || '').toLowerCase();
  if (!k) return false;
  if (m && !m.startsWith('image/')) {
    if (!/\.(jpg|jpeg|png|webp|gif|bmp)$/i.test(f)) return false;
  }
  if (f.endsWith('.pdf') || f.endsWith('.json') || f.endsWith('.csv') || f.endsWith('.txt')) return false;
  const inPhotosFolder = k.includes('/photos/');
  const isQrNamed =
    f.includes('qr_photo') ||
    f.includes('qr_business') ||
    /^(\d+_)?qr_\d+\.(jpg|jpeg|png|webp)$/i.test(f) ||
    /^(\d+_)?qr_photo/i.test(f);
  if (!inPhotosFolder && !isQrNamed) return false;
  if (
    f.includes('logo') ||
    f.includes('signature') ||
    f.includes('product_') ||
    f.includes('customer_') ||
    f.includes('agent_') ||
    f.includes('staff_') ||
    f.includes('event_photo') ||
    f.includes('qr_item') ||
    f.includes('qr_cover')
  ) {
    return false;
  }
  return true;
}

export function recoverQrPhotosFromFileRecords(filesList: any[], origin: string): {
  photos: any[];
  coverImage?: string;
  logo?: string;
} {
  if (!Array.isArray(filesList) || filesList.length === 0) {
    return { photos: [] };
  }
  const photos: any[] = [];
  const seenUrls = new Set<string>();
  let coverImage: string | undefined;
  let logo: string | undefined;

  const sorted = [...filesList].sort((a, b) => {
    const ta = new Date(a?.uploadedAt || a?.created_at || 0).getTime() || 0;
    const tb = new Date(b?.uploadedAt || b?.created_at || 0).getTime() || 0;
    return tb - ta;
  });

  for (const f of sorted) {
    const key = String(f?.key || f?.id || '');
    const fname = String(f?.filename || key.split('/').pop() || '').toLowerCase();
    const mime = String(f?.mimeType || f?.mime_type || '');
    const url = f?.url || (key ? `${origin}/api/files/${encodeURIComponent(key)}` : '');
    if (!url) continue;

    if (!logo && (fname === 'logo.webp' || fname.includes('qr_logo') || (key.includes('/logo.webp')))) {
      logo = url;
      continue;
    }
    if (!coverImage && fname.includes('qr_cover')) {
      coverImage = url;
      continue;
    }
    if (isQrGalleryPhotoFile(key, fname, mime) && !seenUrls.has(url)) {
      seenUrls.add(url);
      photos.push({
        id: `photo-r2-${photos.length}-${key.slice(-12).replace(/[^a-zA-Z0-9]/g, '')}`,
        url,
        title: 'Business Photo',
        description: '',
      });
      if (photos.length >= 20) break;
    }
  }

  return { photos, coverImage, logo };
}

// Automatically create D1 tables and indexes ONCE per Worker isolate cold start
export async function ensureD1Tables(db: any): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;
  if (d1SchemaReady) return;
  if (d1SchemaPromise) return d1SchemaPromise;

  d1SchemaPromise = (async () => {
    try {
      const ddlStatements = [
        db.prepare(`
          CREATE TABLE IF NOT EXISTS backups (
            id TEXT PRIMARY KEY,
            user_email TEXT,
            backup_data TEXT,
            updated_at TEXT
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_backups_user_email ON backups(user_email)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS files (
            id TEXT PRIMARY KEY,
            user_email TEXT,
            filename TEXT,
            mime_type TEXT,
            size INTEGER,
            r2_key TEXT,
            file_type TEXT,
            data_base64 TEXT,
            created_at TEXT
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_user_email ON files(user_email)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS receipts (
            id TEXT PRIMARY KEY,
            user_email TEXT,
            receipt_number TEXT,
            total REAL,
            data_json TEXT,
            items_json TEXT,
            customer_json TEXT,
            created_at TEXT
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_receipts_user_email ON receipts(user_email)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            first_name TEXT,
            last_name TEXT,
            profile_picture_url TEXT,
            provider TEXT DEFAULT 'google',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            last_login TEXT NOT NULL
          )
        `),
        db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS auth_sessions (
            session_id TEXT PRIMARY KEY,
            status TEXT,
            code TEXT,
            user_json TEXT,
            created_at INTEGER
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS qr_pages (
            id TEXT PRIMARY KEY,
            user_email TEXT,
            page_json TEXT,
            content_hash TEXT,
            updated_at TEXT
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_qr_pages_user_email ON qr_pages(user_email)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS shopping_lists (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            title TEXT NOT NULL,
            items_json TEXT NOT NULL,
            total_estimated REAL DEFAULT 0,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_email)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS staff_directory (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT,
            phone TEXT,
            email TEXT,
            hourly_rate REAL,
            notes TEXT,
            updated_at TEXT NOT NULL
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_staff_user ON staff_directory(user_email)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS client_directory (
            id TEXT PRIMARY KEY,
            user_email TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            address TEXT,
            notes TEXT,
            updated_at TEXT NOT NULL
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_client_user ON client_directory(user_email)`),
        db.prepare(`
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
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_shop_updated ON products(shop_id, updated_at)`),
        db.prepare(`
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
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_shop_updated ON invoices(shop_id, updated_at)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL,
            product_id TEXT,
            quantity INTEGER,
            unit_price REAL,
            total REAL
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS menus (
            id TEXT PRIMARY KEY,
            hotel_id TEXT NOT NULL,
            title TEXT,
            menu_data TEXT,
            updated_at TEXT
          )
        `),
        db.prepare(`
          CREATE TABLE IF NOT EXISTS store_catalogs (
            slug TEXT PRIMARY KEY,
            catalog_id TEXT,
            user_email TEXT,
            business_name TEXT,
            catalog_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
          )
        `),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_store_catalogs_slug ON store_catalogs(slug)`),
        db.prepare(`CREATE INDEX IF NOT EXISTS idx_store_catalogs_user ON store_catalogs(user_email)`),
      ];

      await executeD1Batch(db, ddlStatements, 35);
      // Safely upgrade existing store_catalogs tables to include catalog_id column + index
      await db.prepare(`ALTER TABLE store_catalogs ADD COLUMN catalog_id TEXT`).run().catch(() => {});
      await db.prepare(`CREATE INDEX IF NOT EXISTS idx_store_catalogs_catalog_id ON store_catalogs(catalog_id)`).run().catch(() => {});
      d1SchemaReady = true;
    } catch (_) {
      // Fallback safely on next call if batch failed transiently
      d1SchemaPromise = null;
    }
  })();

  return d1SchemaPromise;
}

// 200 MB user cloud storage cap
export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB (209,715,200 bytes)

/**
 * Calculates total cloud storage bytes consumed by a user using a fast D1 aggregate first, falling back to R2 listing.
 */
export async function getUserStorageUsageBytes(userEmail: string, env: Env): Promise<number> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  if (!cleanEmail) return 0;
  const bucket = getR2Bucket(env);
  const db = getD1Database(env);

  // 1. Fast path: single D1 SUM aggregate when files table has user rows
  if (db) {
    try {
      await ensureD1Tables(db);
      const agg: any = await db.prepare(`
        SELECT COALESCE(SUM(size), 0) as total_bytes, COUNT(*) as cnt
        FROM files
        WHERE user_email = ? OR id LIKE ? OR id LIKE ?
      `).bind(cleanEmail, `users/${encodeURIComponent(cleanEmail)}/%`, `users/${cleanEmail}/%`).first();
      if (agg && Number(agg.cnt) > 0) {
        return Number(agg.total_bytes) || 0;
      }
    } catch (d1Err) {
      console.warn('D1 user storage calculate note:', d1Err);
    }
  }

  // 2. Fallback: R2 bucket listing if D1 had no rows
  let totalBytes = 0;
  const seenKeys = new Set<string>();
  if (bucket && typeof bucket.list === 'function') {
    try {
      const pfx = `users/${encodeURIComponent(cleanEmail)}/`;
      let cursor: string | undefined = undefined;
      let hasMore = true;
      let iterations = 0;
      while (hasMore && iterations < 5) {
        iterations++;
        const listed: any = await bucket.list({ prefix: pfx, limit: 1000, cursor });
        if (listed && Array.isArray(listed.objects)) {
          for (const obj of listed.objects) {
            if (!seenKeys.has(obj.key)) {
              seenKeys.add(obj.key);
              totalBytes += (Number(obj.size) || 0);
            }
          }
        }
        if (listed?.truncated && listed?.cursor) {
          cursor = listed.cursor;
        } else {
          hasMore = false;
        }
      }
    } catch (r2Err) {
      console.warn('R2 user storage calculate note:', r2Err);
    }
  }

  return totalBytes;
}

/**
 * Sanitizes a QR Hosted Page before sending it to public clients.
 * Whitelists ONLY public business/menu/event/social details.
 * Strips all private banking, TIN/tax numbers, mobile money numbers, cost prices, internal notes.
 */
export function sanitizePublicQrPage(rawPage: any): any {
  if (!rawPage || typeof rawPage !== 'object') return null;

  // Clean menu items - strip cost prices, internal margins, suppliers, AND never include stock inventory (`prod-...`) items
  const rawItems = Array.isArray(rawPage.menuItems) ? rawPage.menuItems : [];
  const filteredRawItems = rawItems.filter((item: any) => item && !String(item?.id || '').startsWith('prod-'));
  const hadStockItemsStripped = filteredRawItems.length !== rawItems.length;
  const cleanMenuItems = filteredRawItems.map((item: any) => ({
    id: item?.id ? String(item.id) : `item_${Math.random().toString(36).slice(2, 8)}`,
    name: String(item?.name || ''),
    category: String(item?.category || 'All'),
    price: Number(item?.price || item?.sellingPrice || 0),
    size: item?.size ? String(item.size) : undefined,
    description: item?.description ? String(item.description).slice(0, 500) : '',
    photoUrl: item?.photoUrl || item?.image || undefined,
    url: item?.url || undefined,
    websiteUrl: item?.websiteUrl || undefined,
    guestOfHonor: item?.guestOfHonor ? String(item.guestOfHonor) : undefined,
    speakers: Array.isArray(item?.speakers) ? item.speakers : undefined,
    ctaText: item?.ctaText || undefined,
    itemType: item?.itemType || undefined,
    phone: item?.phone || undefined,
    phoneAction: item?.phoneAction || undefined,
    tags: Array.isArray(item?.tags) ? item.tags : undefined,
    isSpecial: Boolean(item?.isSpecial),
    isAvailable: item?.isAvailable !== false,
    hasPromo: Boolean(item?.hasPromo),
    promoPrice: item?.promoPrice !== undefined ? Number(item.promoPrice) : undefined,
    promoDescription: item?.promoDescription ? String(item.promoDescription) : undefined,
    promoStartDate: item?.promoStartDate || undefined,
    promoEndDate: item?.promoEndDate || undefined,
  }));

  // Clean photos
  const rawPhotos = Array.isArray(rawPage.photos) ? rawPage.photos : [];
  const cleanPhotos = rawPhotos
    .filter((p: any) => (typeof p === 'string' ? p.trim() !== '' : Boolean(p && p.url)))
    .map((p: any, idx: number) => {
      if (typeof p === 'string') return { id: `photo-${idx}`, url: p, title: 'Photo' };
      return {
        id: p?.id || `photo-${idx}`,
        url: p?.url || '',
        title: p?.title || 'Photo',
        description: p?.description || '',
        category: p?.category || undefined,
        badge: p?.badge || undefined,
        caption: p?.caption || undefined,
      };
    });

  const cleanCustomSocials = Array.isArray(rawPage.customSocialLinks)
    ? rawPage.customSocialLinks
        .filter((s: any) => s && (typeof s === 'string' || s.url || s.name || s.label))
        .map((s: any, idx: number) => {
          if (typeof s === 'string') {
            return { id: `soc-link-${idx}`, name: 'Link', label: 'Link', url: s };
          }
          const resolvedName = String(s.name || s.label || s.platform || 'Link');
          return {
            id: s.id || `soc-link-${idx}`,
            name: resolvedName,
            label: resolvedName,
            url: String(s.url || ''),
          };
        })
    : undefined;

  const rawEvents = Array.isArray(rawPage.eventsQrItems) ? rawPage.eventsQrItems : [];
  const isEvtType =
    rawPage.pageType === 'event' ||
    rawPage.pageType === 'events_hub' ||
    String(rawPage.id || '').toLowerCase().startsWith('event');

  // Enrich menuItems with full event details (photoUrl, guestOfHonor, speakers, websiteUrl, description)
  // when legacy D1 qr_pages rows hold older menuItems alongside newer eventsQrItems.
  const normalizeHttpUrl = (raw?: string): string => {
    const s = String(raw || '').trim();
    if (!s || s === 'https://' || s === 'http://' || /wa\.me\/|whatsapp\.com\//i.test(s)) return '';
    return /^https?:\/\//i.test(s) ? s : `https://${s}`;
  };

  let enrichedMenuItems = cleanMenuItems;
  if (isEvtType && rawEvents.length > 0) {
    if (enrichedMenuItems.length === 0) {
      enrichedMenuItems = rawEvents.map((e: any) => {
        const evtSite = normalizeHttpUrl(e?.websiteUrl || e?.rsvpUrl);
        return {
          id: `rsvp-${e.id}`,
          name: String(e?.title || ''),
          category: 'Our Events',
          price: 0,
          size: undefined,
          description: String(e?.description || '').slice(0, 500),
          photoUrl: Array.isArray(e?.photos) ? e.photos[0] : undefined,
          url: evtSite || e?.rsvpUrl || undefined,
          websiteUrl: evtSite || undefined,
          guestOfHonor: e?.guestOfHonor ? String(e.guestOfHonor) : undefined,
          speakers: Array.isArray(e?.speakers) && e.speakers.length > 0 ? e.speakers : undefined,
          ctaText: e?.ctaText || 'RSVP & Join',
          itemType: undefined,
          phone: undefined,
          phoneAction: undefined,
          tags: ['RSVP', 'Invitation', 'Entry Pass'],
          isSpecial: true,
          isAvailable: true,
          hasPromo: false,
          promoPrice: undefined,
          promoDescription: undefined,
          promoStartDate: undefined,
          promoEndDate: undefined,
        };
      });
    } else {
      enrichedMenuItems = cleanMenuItems.map((item: any, idx: number) => {
        const matched =
          rawEvents.find(
            (e: any) =>
              e &&
              (`rsvp-${e.id}` === item.id ||
                `evt-${e.id}` === item.id ||
                `event-pass-${e.id}` === item.id ||
                `event-${e.id}` === item.id ||
                e.id === item.id ||
                (e.title && item.name && String(e.title).trim().toLowerCase() === String(item.name).trim().toLowerCase()))
          ) || (rawEvents.length === cleanMenuItems.length ? rawEvents[idx] : null);
        if (!matched) return item;
        const evtSite = normalizeHttpUrl(matched.websiteUrl || item.websiteUrl || matched.rsvpUrl || item.url);
        return {
          ...item,
          photoUrl: item.photoUrl || (Array.isArray(matched.photos) ? matched.photos[0] : undefined),
          description: matched.description ? String(matched.description).slice(0, 500) : item.description,
          guestOfHonor: item.guestOfHonor || (matched.guestOfHonor ? String(matched.guestOfHonor) : undefined),
          speakers:
            Array.isArray(item.speakers) && item.speakers.length > 0
              ? item.speakers
              : Array.isArray(matched.speakers) && matched.speakers.length > 0
                ? matched.speakers
                : undefined,
          websiteUrl: item.websiteUrl || evtSite || undefined,
          url: item.url || evtSite || matched.rsvpUrl || undefined,
        };
      });
    }
  }

  const rawAccent = String(rawPage.accentColor || '');
  const cleanAccent =
    rawAccent.includes(';') || rawAccent.includes('}') || rawAccent.includes('{')
      ? (isEvtType ? '#7c3aed' : '#059669')
      : (rawAccent || '#059669');
  const rawBorder = rawPage.qrBoxBorderColor ? String(rawPage.qrBoxBorderColor) : '';
  const cleanBorder = rawBorder.includes('<') ? '#cbd5e1' : (rawBorder || undefined);
  const firstEventPhoto = rawEvents[0] && Array.isArray(rawEvents[0].photos) ? rawEvents[0].photos[0] : undefined;

  return {
    id: String(rawPage.id || 'business'),
    pageType: rawPage.pageType || 'menu',
    title: rawPage.title || rawPage.name || 'Brivu Business',
    tagline: rawPage.tagline || '',
    description: rawPage.description || '',
    accentColor: cleanAccent,
    theme: rawPage.theme || 'emerald',
    logo: rawPage.logo || undefined,
    coverImage: rawPage.coverImage || (isEvtType ? firstEventPhoto : undefined) || undefined,
    phone: rawPage.phone || '',
    whatsapp: rawPage.whatsapp ? String(rawPage.whatsapp).replace(/[^0-9+]/g, '') : '',
    email: rawPage.email || '',
    userEmail: rawPage.userEmail || rawPage.email || '',
    address: rawPage.address || '',
    googleMapsUrl: rawPage.googleMapsUrl || undefined,
    currency: rawPage.currency || 'UGX',
    language: rawPage.language || undefined,
    openingHours: rawPage.openingHours || '',
    wifiName: rawPage.wifiName || undefined,
    wifiPassword: rawPage.wifiPassword || undefined,
    allowWhatsAppOrdering: rawPage.allowWhatsAppOrdering !== false,
    announcement: isEvtType ? '' : (rawPage.announcement || ''),
    customSocialLinks: cleanCustomSocials,
    socialLinks: rawPage.socialLinks || undefined,
    photos: cleanPhotos,
    menuCategories: (() => {
      const baseCats = Array.isArray(rawPage.menuCategories) && rawPage.menuCategories.length > 0 ? rawPage.menuCategories : ['All'];
      const cleaned = hadStockItemsStripped
        ? baseCats.filter((c: any) => !(c === 'Items' && !enrichedMenuItems.some((m: any) => m.category === 'Items')))
        : baseCats;
      return cleaned.length > 0 ? cleaned : ['All'];
    })(),
    menuItems: enrichedMenuItems,
    websitesQrItems: Array.isArray(rawPage.websitesQrItems) ? rawPage.websitesQrItems : [],
    socialsQrItems: Array.isArray(rawPage.socialsQrItems) ? rawPage.socialsQrItems : [],
    eventsQrItems: rawEvents,
    qrDarkColor: rawPage.qrDarkColor || undefined,
    qrLightColor: rawPage.qrLightColor || undefined,
    qrEyeColor: rawPage.qrEyeColor || undefined,
    qrBoxBgColor: rawPage.qrBoxBgColor || undefined,
    qrBoxBorderColor: cleanBorder,
    createdAt: rawPage.createdAt || undefined,
    updatedAt: rawPage.updatedAt || new Date().toISOString(),
  };
}

function matchEventItemById(events: any[], rawTargetId: string): any | null {
  if (!Array.isArray(events) || events.length === 0 || !rawTargetId) return null;
  const target = rawTargetId.toLowerCase().trim();
  const strippedTarget = target.replace(/^event-/, '').replace(/^qr-/, '');
  return (
    events.find((e: any) => {
      if (!e || !e.id) return false;
      const eId = String(e.id).toLowerCase().trim();
      const strippedE = eId.replace(/^event-/, '').replace(/^qr-/, '');
      return eId === target || strippedE === strippedTarget || `event-${eId}` === target;
    }) || null
  );
}

function buildSingleEventPublicPage(evt: any, userEmail: string, baseInfo?: any): any {
  const cleanPhone = String(evt?.contactPhone || evt?.phone || baseInfo?.phone || baseInfo?.whatsapp || '').replace(/[^0-9+]/g, '');
  let cleanWa = '';
  if (evt?.rsvpUrl && String(evt.rsvpUrl).includes('wa.me/')) {
    const m = String(evt.rsvpUrl).match(/wa\.me\/([0-9]+)/);
    if (m?.[1]) cleanWa = m[1];
  }
  if (!cleanWa) cleanWa = cleanPhone.replace(/[^0-9]/g, '');
  const isWaRsvp = Boolean(evt?.rsvpUrl && /wa\.me\/|whatsapp\.com\//i.test(String(evt.rsvpUrl)));
  const rawSite = String(evt?.websiteUrl || (!isWaRsvp ? evt?.rsvpUrl : '') || '').trim();
  const evtWebsiteUrl = rawSite && rawSite !== 'https://' && rawSite !== 'http://'
    ? (/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`)
    : '';
  const evtPhotos = Array.isArray(evt?.photos) ? evt.photos : [];
  const photos = evtPhotos.map((u: string, idx: number) => ({
    id: `${evt.id}-photo-${idx}`,
    url: u,
    title: evt.title,
    description: `Location: ${evt.location || ''}`,
    badge: 'Event Photo',
    caption: evt.title,
  }));

  return sanitizePublicQrPage({
    id: evt.id,
    title: evt.title || 'Event Invitation',
    tagline: evt.ctaText || 'Official Event Invitation & RSVP Pass',
    description: evt.description || '',
    pageType: 'event',
    accentColor: evt.darkColor || '#7c3aed',
    theme: 'indigo',
    coverImage: evtPhotos[0] || undefined,
    logo: evtPhotos[0] || baseInfo?.logo || undefined,
    phone: evt.contactPhone || baseInfo?.phone || baseInfo?.whatsapp || '',
    whatsapp: cleanWa,
    email: evt.contactEmail || baseInfo?.email || userEmail,
    userEmail: userEmail || baseInfo?.email || '',
    address: evt.location || baseInfo?.address || '',
    googleMapsUrl: evt.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}` : undefined,
    socialLinks: evtWebsiteUrl ? { website: evtWebsiteUrl } : undefined,
    currency: baseInfo?.currency || 'UGX',
    announcement: '',
    allowWhatsAppOrdering: true,
    photos,
    menuCategories: ['Event Pass & RSVP'],
    menuItems: [
      {
        id: `rsvp-${evt.id}`,
        name: `${evt.title} - Entry & RSVP Pass`,
        category: 'Event Pass & RSVP',
        price: 0,
        description: evt.description || '',
        url: evtWebsiteUrl || evt.rsvpUrl,
        websiteUrl: evtWebsiteUrl || undefined,
        guestOfHonor: evt.guestOfHonor || undefined,
        speakers: Array.isArray(evt.speakers) && evt.speakers.length > 0 ? evt.speakers : undefined,
        ctaText: evt.ctaText || 'RSVP & Join',
        tags: ['RSVP', 'Invitation', 'Entry Pass'],
        isSpecial: true,
        isAvailable: true,
        photoUrl: evtPhotos[0] || undefined,
      },
    ],
    eventsQrItems: [evt],
    qrDarkColor: evt.darkColor || '#7c3aed',
    qrLightColor: evt.lightColor || '#ffffff',
    qrEyeColor: evt.eyeColor || evt.darkColor || '#6d28d9',
    qrBoxBgColor: evt.boxBgColor || '#ffffff',
    qrBoxBorderColor: evt.boxBorderColor || '#cbd5e1',
    createdAt: evt.createdAt || new Date().toISOString(),
  });
}

/**
 * Saves a canonical QR page to D1 with hash-comparison write reduction.
 * Strictly canonical records per user: business, events, socials, websites (plus optional individual event IDs).
 */
export async function saveCanonicalQrPage(
  db: any,
  userEmail: string,
  category: 'business' | 'events' | 'socials' | 'websites',
  rawPage: any,
  options?: { preserveExistingPhotosIfEmpty?: boolean; preserveExistingIfEmpty?: boolean; explicitId?: string }
): Promise<void> {
  if (!db || !userEmail || !rawPage) return;
  const cleanEmail = userEmail.toLowerCase().trim();
  const canonicalId = options?.explicitId || `user_${cleanEmail}_${category}`;

  try {
    await ensureD1Tables(db);
    const existing: any = await db.prepare('SELECT content_hash, page_json FROM qr_pages WHERE id = ?').bind(canonicalId).first();

    let pageToSave = {
      ...rawPage,
      id: options?.explicitId ? rawPage.id || canonicalId : canonicalId,
      userEmail: cleanEmail,
      email: rawPage.email || cleanEmail,
    };

    const preserveEmpty = Boolean(options?.preserveExistingPhotosIfEmpty || options?.preserveExistingIfEmpty);
    if (preserveEmpty && existing?.page_json) {
      try {
        const existingParsed = JSON.parse(existing.page_json);
        if (Array.isArray(existingParsed?.photos) && existingParsed.photos.length > 0 && (!Array.isArray(pageToSave.photos) || pageToSave.photos.length === 0)) {
          pageToSave.photos = existingParsed.photos;
        }
        if (!pageToSave.coverImage && existingParsed?.coverImage) {
          pageToSave.coverImage = existingParsed.coverImage;
        }
        if (!pageToSave.logo && existingParsed?.logo) {
          pageToSave.logo = existingParsed.logo;
        }
        const existingNonStockMenu = Array.isArray(existingParsed?.menuItems)
          ? existingParsed.menuItems.filter((i: any) => i && !String(i.id || '').startsWith('prod-'))
          : [];
        if (existingNonStockMenu.length > 0 && (!Array.isArray(pageToSave.menuItems) || pageToSave.menuItems.length === 0)) {
          pageToSave.menuItems = existingNonStockMenu;
        }
        if (Array.isArray(existingParsed?.customSocialLinks) && existingParsed.customSocialLinks.length > 0 && (!Array.isArray(pageToSave.customSocialLinks) || pageToSave.customSocialLinks.length === 0)) {
          pageToSave.customSocialLinks = existingParsed.customSocialLinks;
        }
        if (!pageToSave.wifiName && existingParsed?.wifiName) {
          pageToSave.wifiName = existingParsed.wifiName;
          pageToSave.wifiPassword = existingParsed.wifiPassword;
        }
        if (!pageToSave.openingHours && existingParsed?.openingHours) {
          pageToSave.openingHours = existingParsed.openingHours;
        }
        if (!pageToSave.phone && existingParsed?.phone) pageToSave.phone = existingParsed.phone;
        if (!pageToSave.whatsapp && existingParsed?.whatsapp) pageToSave.whatsapp = existingParsed.whatsapp;
        if (!pageToSave.address && existingParsed?.address) pageToSave.address = existingParsed.address;
        if (!pageToSave.announcement && existingParsed?.announcement) pageToSave.announcement = existingParsed.announcement;
        if (Array.isArray(existingParsed?.websitesQrItems) && existingParsed.websitesQrItems.length > 0 && (!Array.isArray(pageToSave.websitesQrItems) || pageToSave.websitesQrItems.length === 0)) {
          pageToSave.websitesQrItems = existingParsed.websitesQrItems;
        }
        if (Array.isArray(existingParsed?.socialsQrItems) && existingParsed.socialsQrItems.length > 0 && (!Array.isArray(pageToSave.socialsQrItems) || pageToSave.socialsQrItems.length === 0)) {
          pageToSave.socialsQrItems = existingParsed.socialsQrItems;
        }
        if (Array.isArray(existingParsed?.eventsQrItems) && existingParsed.eventsQrItems.length > 0 && (!Array.isArray(pageToSave.eventsQrItems) || pageToSave.eventsQrItems.length === 0)) {
          pageToSave.eventsQrItems = existingParsed.eventsQrItems;
        }
      } catch (_) {}
    }

    const sanitized = sanitizePublicQrPage(pageToSave);
    const sanitizedJson = JSON.stringify(sanitized);

    const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sanitizedJson));
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

    if (existing?.content_hash === hashHex) return; // Skip identical write!

    const now = new Date().toISOString();
    await db.prepare(`
      INSERT INTO qr_pages (id, user_email, page_json, content_hash, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET 
        user_email = excluded.user_email,
        page_json = excluded.page_json,
        content_hash = excluded.content_hash,
        updated_at = excluded.updated_at
    `).bind(canonicalId, cleanEmail, sanitizedJson, hashHex, now).run();
    invalidateCachePattern(`qrCache:`);
  } catch (err) {
    console.warn('saveCanonicalQrPage note:', err);
  }
}

async function runWithMissingTableRetry<T>(db: any, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('no such table') || msg.includes('no such column')) {
      await ensureD1Tables(db);
      return await fn();
    }
    throw err;
  }
}

// Resolver for QR Hosted Pages - D1 Single Source of Truth (Fast Path)
export async function resolveHostedQrPage(
  env: Env,
  rawPageId: string,
  rawUserEmail?: string,
  options?: { skipCache?: boolean }
): Promise<any | null> {
  const pageId = (rawPageId || '').trim();
  const normId = pageId.toLowerCase().trim();
  let userEmail = (rawUserEmail || '').toLowerCase().trim();
  const db = getD1Database(env);
  const bucket = getR2Bucket(env);

  const cacheKey = `qrCache:${userEmail || 'anon'}:${normId}`;
  if (!options?.skipCache) {
    const cached = getCachedQuery(cacheKey);
    if (cached) return cached;
  }

  // Identify category
  const isWebsites = normId.includes('website') || normId.includes('web-hub') || normId === 'websites_hub' || normId === 'websites';
  const isSocials = !isWebsites && (normId.includes('social') || normId === 'socials_hub' || normId === 'socials');
  const isEvents = !isWebsites && !isSocials && (normId.includes('event') || normId === 'events_hub' || normId === 'events');
  const isSingleEvent = isEvents && !normId.includes('events-hub') && !normId.includes('event-hub') && normId !== 'events' && normId !== 'events_hub';
  const category: 'business' | 'events' | 'socials' | 'websites' = isWebsites
    ? 'websites'
    : isSocials
    ? 'socials'
    : isEvents
    ? 'events'
    : 'business';

  // If userEmail not passed in query/headers, do fast indexed lookup in D1 first (avoiding full-table scans)
  if (!userEmail && db && pageId && pageId !== 'default' && pageId !== 'latest') {
    try {
      const row: any = await runWithMissingTableRetry(db, () =>
        db.prepare('SELECT user_email, page_json FROM qr_pages WHERE id = ? LIMIT 1').bind(pageId).first()
      );
      if (row?.page_json) {
        try {
          const parsedDirect = JSON.parse(row.page_json);
          if (parsedDirect && !isSingleEvent && hasRealQrPageContent(parsedDirect)) {
            const result = sanitizePublicQrPage(parsedDirect);
            setCachedQuery(cacheKey, result, 10);
            return result;
          }
          userEmail = (row.user_email || parsedDirect?.userEmail || parsedDirect?.email || '').toLowerCase().trim();
        } catch (_) {
          if (row?.user_email) userEmail = row.user_email.toLowerCase().trim();
        }
      } else if (row?.user_email) {
        userEmail = row.user_email.toLowerCase().trim();
      }
      // Bounded suffix match on indexed id / recent backups only if exact PK didn't yield email
      if (!userEmail) {
        const suffixRow: any = await db
          .prepare('SELECT user_email FROM qr_pages WHERE id LIKE ? LIMIT 1')
          .bind(`%_${pageId}`)
          .first()
          .catch(() => null);
        if (suffixRow?.user_email) {
          userEmail = suffixRow.user_email.toLowerCase().trim();
        }
      }
      if (!userEmail) {
        const bRow: any = await db
          .prepare('SELECT user_email FROM (SELECT user_email, backup_data FROM backups ORDER BY updated_at DESC LIMIT 20) WHERE backup_data LIKE ? LIMIT 1')
          .bind(`%"${pageId}"%`)
          .first()
          .catch(() => null);
        if (bRow?.user_email) {
          userEmail = bRow.user_email.toLowerCase().trim();
        }
      }
    } catch (_) {}
  }

  // 1. Primary lookup in D1 qr_pages table (single batched roundtrip per case)
  if (db && userEmail) {
    try {
      // 1a. Standalone single-event lookup (single IN query for both standalone & canonical hub)
      if (isSingleEvent) {
        const singleKey = `user_${userEmail}_event_${pageId}`;
        const hubKey = `user_${userEmail}_events`;
        const rowsRes: any = await runWithMissingTableRetry(db, () =>
          db.prepare('SELECT id, page_json FROM qr_pages WHERE id IN (?, ?, ?)').bind(singleKey, pageId, hubKey).all()
        );
        const rowsList: any[] = rowsRes?.results || [];
        const singleRow = rowsList.find((r) => r.id === singleKey || r.id === pageId);
        const hubRow = rowsList.find((r) => r.id === hubKey);

        let parsedSingle: any = null;
        if (singleRow?.page_json) {
          try {
            parsedSingle = JSON.parse(singleRow.page_json);
          } catch (_) {}
        }

        let parsedHub: any = null;
        if (hubRow?.page_json) {
          try {
            parsedHub = JSON.parse(hubRow.page_json);
          } catch (_) {}
        }

        const matchedHubEvt =
          parsedHub && Array.isArray(parsedHub.eventsQrItems)
            ? matchEventItemById(parsedHub.eventsQrItems, pageId)
            : null;

        if (parsedSingle && hasRealQrPageContent(parsedSingle)) {
          if (matchedHubEvt) {
            const singleEvt = parsedSingle.eventsQrItems?.[0] || {};
            const singleTs = new Date(parsedSingle.updatedAt || singleEvt.createdAt || 0).getTime();
            const hubTs = new Date(parsedHub.updatedAt || matchedHubEvt.createdAt || 0).getTime();
            const hubHasExtraFields = Boolean(
              (matchedHubEvt.guestOfHonor && !singleEvt.guestOfHonor) ||
              (Array.isArray(matchedHubEvt.speakers) && matchedHubEvt.speakers.length > 0 && (!Array.isArray(singleEvt.speakers) || singleEvt.speakers.length === 0)) ||
              (matchedHubEvt.websiteUrl && !singleEvt.websiteUrl)
            );
            if (hubTs >= singleTs || hubHasExtraFields) {
              const result = buildSingleEventPublicPage(matchedHubEvt, userEmail, parsedHub);
              setCachedQuery(cacheKey, result, 10);
              return result;
            }
          }
          const result = sanitizePublicQrPage(parsedSingle);
          setCachedQuery(cacheKey, result, 10);
          return result;
        }

        if (matchedHubEvt) {
          const result = buildSingleEventPublicPage(matchedHubEvt, userEmail, parsedHub);
          setCachedQuery(cacheKey, result, 10);
          return result;
        }
      }

      // 1b. Business (including optional specific biz key) OR hub lookup in ONE single D1 query
      const canonicalId = `user_${userEmail}_${category}`;
      const isSpecificBusinessId =
        category === 'business' &&
        pageId &&
        normId !== 'default' &&
        normId !== 'latest' &&
        normId !== 'business' &&
        normId !== 'business-latest' &&
        !normId.startsWith('business-hub-');

      if (isSpecificBusinessId) {
        const strippedBizId = pageId.replace(/^business-/, '');
        const specKey1 = `user_${userEmail}_biz_${pageId}`;
        const specKey2 = `user_${userEmail}_biz_${strippedBizId}`;
        const rowsRes: any = await runWithMissingTableRetry(db, () =>
          db.prepare('SELECT id, page_json FROM qr_pages WHERE id IN (?, ?, ?, ?)').bind(specKey1, specKey2, pageId, canonicalId).all()
        );
        const rowsList: any[] = rowsRes?.results || [];
        for (const candidateId of [specKey1, specKey2, pageId, canonicalId]) {
          const matchRow = rowsList.find((r) => r.id === candidateId);
          if (matchRow?.page_json) {
            try {
              const parsed = JSON.parse(matchRow.page_json);
              if (parsed && hasRealQrPageContent(parsed)) {
                const result = sanitizePublicQrPage(parsed);
                setCachedQuery(cacheKey, result, 10);
                return result;
              }
            } catch (_) {}
          }
        }
      } else if (!isSingleEvent) {
        const row: any = await runWithMissingTableRetry(db, () =>
          db.prepare('SELECT page_json FROM qr_pages WHERE id = ? LIMIT 1').bind(canonicalId).first()
        );
        if (row?.page_json) {
          try {
            const parsed = JSON.parse(row.page_json);
            if (parsed && hasRealQrPageContent(parsed)) {
              const result = sanitizePublicQrPage(parsed);
              setCachedQuery(cacheKey, result, 10);
              return result;
            }
          } catch (_) {}
        }
      }

      // 1c. Indexed email scan in qr_pages (capped to 10 rows) before hitting multi-MB backups
      const emailRowsRes: any = await db
        .prepare('SELECT id, page_json FROM qr_pages WHERE user_email = ? LIMIT 10')
        .bind(userEmail)
        .all()
        .catch(() => null);
      if (emailRowsRes?.results && emailRowsRes.results.length > 0) {
        for (const r of emailRowsRes.results as any[]) {
          if (!r?.page_json) continue;
          try {
            const parsed = JSON.parse(r.page_json);
            if (!parsed || !hasRealQrPageContent(parsed)) continue;
            const pType = String(parsed.pageType || '').toLowerCase();
            if (isSingleEvent && Array.isArray(parsed.eventsQrItems)) {
              const matchedEvt = matchEventItemById(parsed.eventsQrItems, pageId);
              if (matchedEvt) {
                const result = buildSingleEventPublicPage(matchedEvt, userEmail, parsed);
                setCachedQuery(cacheKey, result, 10);
                return result;
              }
            } else if (
              (category === 'websites' && (pType === 'websites_hub' || r.id.includes('websites'))) ||
              (category === 'socials' && (pType === 'socials_hub' || r.id.includes('socials'))) ||
              (category === 'events' && !isSingleEvent && (pType === 'events_hub' || r.id.includes('events'))) ||
              (category === 'business' && !pType.includes('website') && !pType.includes('social') && !pType.includes('event'))
            ) {
              const result = sanitizePublicQrPage(parsed);
              setCachedQuery(cacheKey, result, 10);
              return result;
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // 2. Direct fallback lookup in D1 by exact pageId (only if not already checked when userEmail was empty)
  if (db && pageId && userEmail) {
    try {
      const row: any = await db.prepare('SELECT page_json FROM qr_pages WHERE id = ? LIMIT 1').bind(pageId).first();
      if (row?.page_json) {
        try {
          const parsed = JSON.parse(row.page_json);
          if (parsed && hasRealQrPageContent(parsed)) {
            const result = sanitizePublicQrPage(parsed);
            setCachedQuery(cacheKey, result, 10);
            return result;
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 3. Fallback: Reconstruct from user's D1 backup (or R2 latest_backup.json) if qr_pages row missing or empty
  if (userEmail && (db || bucket)) {
    try {
      let bData: any = null;
      if (db) {
        let bRow: any = await db
          .prepare('SELECT backup_data FROM backups WHERE id = ? OR user_email = ? LIMIT 1')
          .bind(`user_${userEmail}`, userEmail)
          .first()
          .catch(() => null);
        if (!bRow?.backup_data) {
          bRow = await db
            .prepare('SELECT backup_data FROM backups WHERE LOWER(user_email) = ? ORDER BY updated_at DESC LIMIT 1')
            .bind(userEmail)
            .first()
            .catch(() => null);
        }
        if (bRow?.backup_data) {
          bData = JSON.parse(bRow.backup_data);
        }
      }
      if (!bData && bucket) {
        try {
          const userKey = encodeURIComponent(userEmail);
          let backupObj = await bucket.get(`users/${userKey}/latest_backup.json`);
          if (!backupObj) {
            backupObj = await bucket.get(`users/${userKey}/backup.json`);
          }
          if (backupObj) {
            bData = JSON.parse(await backupObj.text());
          }
        } catch (_) {}
      }

      if (bData) {
        const profile = bData?.profile || {};
        const hostedPages = Array.isArray(bData.qrHostedPages) ? bData.qrHostedPages : [];
        const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

        if (category === 'websites') {
          const webHubPage = hostedPages.find((p: any) => p && (p.pageType === 'websites_hub' || String(p.id || '').includes('websites')));
          const webItems = Array.isArray(bData.websitesQrItems) && bData.websitesQrItems.length > 0
            ? bData.websitesQrItems
            : (Array.isArray(webHubPage?.websitesQrItems) ? webHubPage.websitesQrItems : []);
          if (webItems.length > 0 || (webHubPage && hasRealQrPageContent(webHubPage))) {
            return sanitizePublicQrPage({
              ...(webHubPage || {}),
              id: `user_${userEmail}_websites`,
              userEmail,
              title: webHubPage?.title || 'Our Sites',
              tagline: webHubPage?.tagline ?? (profile.tagline || ''),
              description: webHubPage?.description || `Official web links and verified online apps directory for ${profile.name || 'our company'}.`,
              pageType: 'websites_hub',
              accentColor: '#2563eb',
              theme: 'indigo',
              logo: webHubPage?.logo || profile.logo,
              phone: webHubPage?.phone || profile.phone || '',
              whatsapp: webHubPage?.whatsapp || cleanWa,
              email: webHubPage?.email || profile.email || userEmail,
              address: webHubPage?.address || profile.address || '',
              currency: webHubPage?.currency || profile.currency || 'USD',
              websitesQrItems: webItems,
              menuCategories: ['Our Sites'],
              menuItems: webItems.map((w: any) => ({
                id: `web-${w.id}`,
                name: w.title,
                category: 'Our Sites',
                price: 0,
                description: w.description || w.url,
                url: w.url,
                ctaText: w.ctaText || 'Visit Website',
                itemType: w.type,
                phone: w.phone,
                phoneAction: w.phoneAction,
              })),
            });
          }
        }

        if (category === 'socials') {
          const socHubPage = hostedPages.find((p: any) => p && (p.pageType === 'socials_hub' || String(p.id || '').includes('socials')));
          const socItems = Array.isArray(bData.socialsQrItems) && bData.socialsQrItems.length > 0
            ? bData.socialsQrItems
            : (Array.isArray(socHubPage?.socialsQrItems) ? socHubPage.socialsQrItems : []);
          if (socItems.length > 0 || (socHubPage && hasRealQrPageContent(socHubPage))) {
            return sanitizePublicQrPage({
              ...(socHubPage || {}),
              id: `user_${userEmail}_socials`,
              userEmail,
              title: socHubPage?.title || 'Official Social Links',
              tagline: socHubPage?.tagline || 'Connect Across All Official Social Channels & Messaging Apps',
              description: socHubPage?.description || `Official social media profiles and community links for ${profile.name || 'our brand'}.`,
              pageType: 'socials_hub',
              accentColor: '#059669',
              theme: 'emerald',
              logo: socHubPage?.logo || profile.logo,
              phone: socHubPage?.phone || profile.phone || '',
              whatsapp: socHubPage?.whatsapp || cleanWa,
              email: socHubPage?.email || profile.email || userEmail,
              address: socHubPage?.address || profile.address || '',
              currency: socHubPage?.currency || profile.currency || 'USD',
              socialsQrItems: socItems,
              menuCategories: ['Social Channels'],
              menuItems: socItems.map((s: any) => ({
                id: `soc-${s.id}`,
                name: s.title || s.customPlatformName || s.platform,
                category: 'Social Channels',
                price: 0,
                description: s.prefilledMessage || s.fullUrl,
                url: s.fullUrl,
                ctaText: s.ctaText || 'Connect',
                itemType: s.platform,
              })),
            });
          }
        }

        if (category === 'events') {
          const evtHubPage = hostedPages.find((p: any) => p && (p.pageType === 'events_hub' || String(p.id || '').includes('events-hub')));
          const topLevelEvents = Array.isArray(bData.eventsQrItems) ? bData.eventsQrItems : [];
          const hubEvents = Array.isArray(evtHubPage?.eventsQrItems) ? evtHubPage.eventsQrItems : [];
          const singleEventItems = hostedPages
            .filter((p: any) => p && p.pageType === 'event' && Array.isArray(p.eventsQrItems))
            .flatMap((p: any) => p.eventsQrItems);
          const mergedEvtMap = new Map<string, any>();
          for (const e of [...topLevelEvents, ...hubEvents, ...singleEventItems]) {
            if (e && e.id && !mergedEvtMap.has(e.id)) mergedEvtMap.set(e.id, e);
          }
          const evtItems = Array.from(mergedEvtMap.values());

          if (isSingleEvent) {
            const matchedEvt = matchEventItemById(evtItems, pageId);
            if (matchedEvt) {
              return buildSingleEventPublicPage(matchedEvt, userEmail, profile);
            }
            const matchedHostedEvt = hostedPages.find((p: any) => p && p.id === pageId && hasRealQrPageContent(p));
            if (matchedHostedEvt) {
              return sanitizePublicQrPage({ ...matchedHostedEvt, userEmail });
            }
          }

          if (evtItems.length > 0 || (evtHubPage && hasRealQrPageContent(evtHubPage))) {
            return sanitizePublicQrPage({
              ...(evtHubPage || {}),
              id: `user_${userEmail}_events`,
              userEmail,
              title: evtHubPage?.title || 'Our Events',
              description: evtHubPage?.description || `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
              pageType: 'events_hub',
              accentColor: '#7c3aed',
              theme: 'indigo',
              logo: evtHubPage?.logo || profile.logo,
              phone: evtHubPage?.phone || profile.phone || '',
              whatsapp: evtHubPage?.whatsapp || cleanWa,
              email: evtHubPage?.email || profile.email || userEmail,
              address: evtHubPage?.address || profile.address || '',
              currency: evtHubPage?.currency || profile.currency || 'USD',
              announcement: '',
              eventsQrItems: evtItems,
              menuCategories: ['Our Events'],
              menuItems: evtItems.map((e: any) => {
                const isWa = Boolean(e?.rsvpUrl && /wa\.me\/|whatsapp\.com\//i.test(String(e.rsvpUrl)));
                const rawSite = String(e?.websiteUrl || (!isWa ? e?.rsvpUrl : '') || '').trim();
                const evtSite = rawSite && rawSite !== 'https://' && rawSite !== 'http://'
                  ? (/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`)
                  : '';
                return {
                  id: `rsvp-${e.id}`,
                  name: e.title,
                  category: 'Our Events',
                  price: 0,
                  description: e.description || '',
                  url: evtSite || e.rsvpUrl,
                  websiteUrl: evtSite || undefined,
                  guestOfHonor: e.guestOfHonor || undefined,
                  speakers: Array.isArray(e.speakers) && e.speakers.length > 0 ? e.speakers : undefined,
                  ctaText: e.ctaText || 'RSVP & Join',
                  photoUrl: e.photos?.[0] || undefined,
                };
              }),
            });
          }
        }

        // Business Showcase / Menu Page (prefer exact match or populated qrHostedPages business entry, fall back to backup inventory/photos)
        const bizCandidates = hostedPages.filter((p: any) =>
          p &&
          p.pageType !== 'websites_hub' &&
          p.pageType !== 'socials_hub' &&
          p.pageType !== 'events_hub' &&
          p.pageType !== 'event' &&
          !String(p.id || '').startsWith('event-') &&
          !String(p.id || '').startsWith('events-hub') &&
          !String(p.id || '').startsWith('websites-hub') &&
          !String(p.id || '').startsWith('socials-hub')
        );
        const matchesBizPageId = (p: any) => {
          if (!p?.id || !pageId) return false;
          const pid = String(p.id).trim();
          return (
            pid === pageId ||
            `business-${pid}` === pageId ||
            pid.replace(/^qr-/, 'business-') === pageId ||
            pageId.replace(/^business-/, '') === pid
          );
        };
        const hostedBiz =
          bizCandidates.find((p: any) => matchesBizPageId(p) && hasRealQrPageContent(p)) ||
          bizCandidates.find((p: any) => hasRealQrPageContent(p)) ||
          bizCandidates[0];
        let photos = Array.isArray(hostedBiz?.photos) && hostedBiz.photos.length > 0
          ? hostedBiz.photos
          : (Array.isArray(bData.photos) ? bData.photos : []);

        // If photos are still empty, try recovering orphaned QR photos from D1 files table (bounded) or R2
        let recoveredCover: string | undefined = hostedBiz?.coverImage;
        let recoveredLogo: string | undefined = hostedBiz?.logo || profile.logo;
        if (photos.length === 0 && userEmail) {
          try {
            if (db) {
              const fileRows: any = await db
                .prepare('SELECT id, filename, mime_type, created_at FROM files WHERE user_email = ? OR id LIKE ? OR id LIKE ? ORDER BY created_at DESC LIMIT 50')
                .bind(userEmail, `users/${encodeURIComponent(userEmail)}/%`, `users/${userEmail}/%`)
                .all();
              if (fileRows?.results && fileRows.results.length > 0) {
                const recovered = recoverQrPhotosFromFileRecords(fileRows.results, 'https://brivu.shapesmm7.workers.dev');
                if (recovered.photos.length > 0) photos = recovered.photos;
                if (!recoveredCover && recovered.coverImage) recoveredCover = recovered.coverImage;
                if (!recoveredLogo && recovered.logo) recoveredLogo = recovered.logo;
              }
            }
            if (photos.length === 0 && bucket && typeof bucket.list === 'function') {
              const listed = await bucket.list({ prefix: `users/${encodeURIComponent(userEmail)}/photos/`, limit: 20 });
              if (listed?.objects && listed.objects.length > 0) {
                const r2Records = listed.objects.map((obj: any) => ({
                  key: obj.key,
                  id: obj.key,
                  filename: (obj.key.split('/').pop() || obj.key).replace(/^\d+_/, ''),
                  mime_type: obj.httpMetadata?.contentType || 'image/jpeg',
                  created_at: obj.uploaded ? new Date(obj.uploaded).toISOString() : '',
                }));
                const recovered = recoverQrPhotosFromFileRecords(r2Records, 'https://brivu.shapesmm7.workers.dev');
                if (recovered.photos.length > 0) photos = recovered.photos;
              }
            }
          } catch (_) {}
        }

        // Strict Separation: Business QR Digital Items MUST NEVER auto-import inventory/stock products
        const menuItemsSource = Array.isArray(hostedBiz?.menuItems)
          ? hostedBiz.menuItems.filter((item: any) => item && !String(item.id || '').startsWith('prod-'))
          : [];

        return sanitizePublicQrPage({
          ...(hostedBiz || {}),
          id: `user_${userEmail}_business`,
          userEmail,
          title: hostedBiz?.title || profile.name || (userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business'),
          tagline: hostedBiz?.tagline || profile.description || 'Welcome to our official business page',
          description: hostedBiz?.description || profile.description || '',
          pageType: hostedBiz?.pageType || 'menu',
          accentColor: hostedBiz?.accentColor || profile.themeColor || '#059669',
          theme: hostedBiz?.theme || 'emerald',
          logo: recoveredLogo,
          coverImage: recoveredCover || photos[0]?.url || (typeof photos[0] === 'string' ? photos[0] : undefined),
          phone: hostedBiz?.phone || profile.phone || '',
          whatsapp: hostedBiz?.whatsapp || cleanWa,
          email: hostedBiz?.email || profile.email || userEmail,
          address: hostedBiz?.address || profile.address || '',
          currency: hostedBiz?.currency || profile.currency || 'UGX',
          openingHours: hostedBiz?.openingHours || '',
          allowWhatsAppOrdering: hostedBiz?.allowWhatsAppOrdering ?? true,
          photos,
          menuCategories: Array.isArray(hostedBiz?.menuCategories) && hostedBiz.menuCategories.length > 0
            ? hostedBiz.menuCategories
            : ['All'],
          menuItems: menuItemsSource,
        });
      }
    } catch (_) {}
  }

  // 4. Default empty fallback (marked so client can distinguish empty template from saved data and run backup recovery)
  return {
    ...sanitizePublicQrPage({
      id: pageId || 'business',
      title: userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business',
      tagline: 'Welcome to our official business page',
      pageType: isSingleEvent ? 'event' : isEvents ? 'events_hub' : isWebsites ? 'websites_hub' : isSocials ? 'socials_hub' : 'menu',
      email: userEmail,
      userEmail,
      currency: 'UGX',
      menuCategories: ['All'],
      menuItems: [],
      photos: [],
    }),
    isEmptyFallback: true,
  };
}

export function sanitizePublicStoreSlug(rawSlug: string): string {
  const cleaned = String(rawSlug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'store';
}

export function deriveFallbackCatalogId(userEmail: string, slug: string): string {
  const seed = `${String(userEmail || '').toLowerCase().trim()}::${sanitizePublicStoreSlug(slug || 'store')}`;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `cat-${(h >>> 0).toString(36)}`;
}

export function sanitizePublicStoreCatalogPayload(
  payload: any,
  slugOverride?: string,
  userEmailOverride?: string,
  catalogIdOverride?: string
): any {
  if (!payload || typeof payload !== 'object') return null;
  const rawSettings = payload.settings || {};
  const rawBiz = payload.business || {};
  const cleanEmail = String(
    userEmailOverride || rawSettings.email || rawBiz.email || ''
  )
    .toLowerCase()
    .trim();
  const cleanSlug = sanitizePublicStoreSlug(slugOverride || rawSettings.slug || rawBiz.name || 'store');
  const rawCatalogId = String(catalogIdOverride || rawSettings.catalogId || '').trim();
  const cleanCatalogId = rawCatalogId && !rawCatalogId.startsWith('qr-')
    ? rawCatalogId
    : deriveFallbackCatalogId(cleanEmail || cleanSlug, cleanSlug);
  const rawProducts = Array.isArray(payload.products) ? payload.products : [];

  const sanitizedProducts = rawProducts.map((p: any) => {
    const qty = Number(p?.quantity ?? p?.stockQuantity ?? 0);
    const isAvailable = qty > 0;
    const status = qty === 0 ? 'out-of-stock' : qty < 5 ? 'low-stock' : 'in-stock';
    return {
      id: String(p?.id || ''),
      itemId: String(p?.itemId || ''),
      name: String(p?.name || 'Unnamed Product'),
      description: p?.description ? String(p.description) : undefined,
      image: p?.image ? String(p.image) : undefined,
      sizes: Array.isArray(p?.sizes) ? p.sizes : undefined,
      color: p?.color ? String(p.color) : undefined,
      quantity: qty,
      unit: p?.unit ? String(p.unit) : undefined,
      sellingPrice: Number(p?.sellingPrice ?? p?.price ?? 0),
      categoryId: p?.categoryId ? String(p.categoryId) : undefined,
      categoryName: p?.categoryName ? String(p.categoryName) : undefined,
      categoryColor: p?.categoryColor ? String(p.categoryColor) : undefined,
      isAvailable,
      status,
    };
  });

  const rawCategories = Array.isArray(payload.categories) ? payload.categories : [];
  const sanitizedCategories = rawCategories.map((c: any) => ({
    id: String(c?.id || ''),
    name: String(c?.name || ''),
    color: c?.color ? String(c.color) : undefined,
    count:
      typeof c?.count === 'number'
        ? c.count
        : sanitizedProducts.filter((cp: any) => cp.categoryId === c?.id).length,
  }));

  return {
    settings: {
      catalogId: cleanCatalogId,
      enabled: rawSettings.enabled !== false,
      slug: cleanSlug,
      businessName: rawSettings.businessName || rawBiz.name || '',
      tagline: rawSettings.tagline || rawBiz.description || '',
      phone: rawSettings.phone || rawBiz.phone || '',
      whatsapp: rawSettings.whatsapp || rawBiz.whatsapp || rawBiz.phone || '',
      email: cleanEmail,
      address: rawSettings.address || rawBiz.address || '',
      currency: rawSettings.currency || rawBiz.currency || 'UGX',
      showExactQuantity: rawSettings.showExactQuantity !== false,
      hideOutOfStock: rawSettings.hideOutOfStock === true,
      allowWhatsAppOrders: rawSettings.allowWhatsAppOrders !== false,
      updatedAt: rawSettings.updatedAt || payload.lastUpdated || new Date().toISOString(),
    },
    business: {
      name: rawBiz.name || rawSettings.businessName || 'Brivu Store',
      description: rawBiz.description || rawSettings.tagline || '',
      logo: rawBiz.logo || undefined,
      phone: rawBiz.phone || rawSettings.phone || '',
      whatsapp: rawBiz.whatsapp || rawBiz.phone || rawSettings.whatsapp || '',
      email: cleanEmail || rawBiz.email || rawSettings.email || '',
      address: rawBiz.address || rawSettings.address || '',
      currency: rawBiz.currency || rawSettings.currency || 'UGX',
    },
    categories: sanitizedCategories,
    products: sanitizedProducts,
    lastUpdated: payload.lastUpdated || new Date().toISOString(),
  };
}

export function buildPublicStoreCatalogFromBackup(
  backupData: any,
  userEmail: string,
  overrideSlug?: string,
  existingSettings?: any,
  overrideCatalogId?: string
): any | null {
  if (!backupData || typeof backupData !== 'object') return null;
  const profile = backupData.profile || {};
  const savedSettings = backupData.publicCatalogSettings || existingSettings || {};
  const rawProducts = Array.isArray(backupData.inventoryProducts)
    ? backupData.inventoryProducts
    : Array.isArray(backupData.products)
    ? backupData.products
    : [];
  const rawCategories = Array.isArray(backupData.productCategories) ? backupData.productCategories : [];

  const cleanEmail = String(userEmail || savedSettings.email || profile.email || '')
    .toLowerCase()
    .trim();
  const slugCandidate =
    overrideSlug ||
    (savedSettings.slug && savedSettings.slug !== 'store' ? savedSettings.slug : '') ||
    (profile.name ? sanitizePublicStoreSlug(profile.name) : '') ||
    savedSettings.slug ||
    'store';
  const cleanSlug = sanitizePublicStoreSlug(slugCandidate);
  const cleanCatalogId = String(
    overrideCatalogId || savedSettings.catalogId || deriveFallbackCatalogId(cleanEmail || cleanSlug, cleanSlug)
  ).trim();

  const settings = {
    catalogId: cleanCatalogId,
    enabled: savedSettings.enabled !== false,
    slug: cleanSlug,
    businessName: savedSettings.businessName || profile.name || '',
    tagline: savedSettings.tagline || profile.description || '',
    phone: savedSettings.phone || profile.phone || '',
    whatsapp: savedSettings.whatsapp || profile.whatsapp || profile.phone || '',
    email: cleanEmail,
    address: savedSettings.address || profile.address || '',
    currency: savedSettings.currency || profile.currency || 'UGX',
    showExactQuantity: savedSettings.showExactQuantity !== false,
    hideOutOfStock: savedSettings.hideOutOfStock === true,
    allowWhatsAppOrders: savedSettings.allowWhatsAppOrders !== false,
    updatedAt: savedSettings.updatedAt || backupData.exportedAt || new Date().toISOString(),
  };

  const publicProducts = rawProducts.filter((p: any) => p && p.isPublicInCatalog !== false);
  const visibleProducts = settings.hideOutOfStock
    ? publicProducts.filter((p: any) => Number(p.quantity ?? p.stockQuantity ?? 0) > 0)
    : publicProducts;

  const catMap = new Map<string, any>(rawCategories.map((c: any) => [c.id, c]));

  const catalogProducts = visibleProducts.map((p: any) => {
    const qty = Number(p.quantity ?? p.stockQuantity ?? 0);
    const cat = p.categoryId ? catMap.get(p.categoryId) : undefined;
    const isAvailable = qty > 0;
    const status = qty === 0 ? 'out-of-stock' : qty < 5 ? 'low-stock' : 'in-stock';

    return {
      id: p.id,
      itemId: p.itemId || '',
      name: p.name || 'Unnamed Product',
      description: p.description || undefined,
      image: p.image || undefined,
      sizes: Array.isArray(p.sizes) ? p.sizes : undefined,
      color: p.color || undefined,
      quantity: qty,
      unit: p.unit || undefined,
      sellingPrice: Number(p.sellingPrice ?? p.price ?? 0),
      categoryId: p.categoryId || undefined,
      categoryName: cat?.name || p.category || undefined,
      categoryColor: cat?.color || undefined,
      isAvailable,
      status,
    };
  });

  const categories = rawCategories.map((c: any) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    count: catalogProducts.filter((cp: any) => cp.categoryId === c.id).length,
  }));

  if (catalogProducts.length === 0 && !profile.name && !backupData.publicCatalogSettings) {
    return null;
  }

  return sanitizePublicStoreCatalogPayload(
    {
      settings,
      business: {
        name: profile.name || settings.businessName || 'Brivu Store',
        description: profile.description || settings.tagline || '',
        logo: profile.logo || undefined,
        phone: profile.phone || settings.phone || '',
        whatsapp: profile.whatsapp || profile.phone || settings.whatsapp || '',
        email: cleanEmail,
        address: profile.address || settings.address || '',
        currency: profile.currency || settings.currency || 'UGX',
      },
      categories,
      products: catalogProducts,
      lastUpdated: new Date().toISOString(),
    },
    cleanSlug,
    cleanEmail,
    cleanCatalogId
  );
}

export async function upsertUserStoreCatalog(
  db: any,
  userEmail: string,
  rawSlug: string,
  payload: any,
  nowIso?: string,
  catalogIdOverride?: string
): Promise<{ slug: string; catalogId: string }> {
  const cleanSlug = sanitizePublicStoreSlug(rawSlug || 'store');
  const cleanEmail = String(userEmail || '').toLowerCase().trim();
  const isRealEmail = Boolean(cleanEmail && cleanEmail.includes('@') && !cleanEmail.startsWith('brivu-usr-'));
  const rowKey = isRealEmail ? `${cleanSlug}::${cleanEmail}` : cleanSlug;
  const sanitized = sanitizePublicStoreCatalogPayload(
    payload,
    cleanSlug,
    isRealEmail ? cleanEmail : undefined,
    catalogIdOverride
  );
  const resolvedCatalogId = String(sanitized?.settings?.catalogId || deriveFallbackCatalogId(cleanEmail || cleanSlug, cleanSlug));
  const catalogJson = JSON.stringify(sanitized);
  const now = nowIso || new Date().toISOString();

  await ensureD1Tables(db);
  if (isRealEmail) {
    try {
      await db
        .prepare('DELETE FROM store_catalogs WHERE LOWER(user_email) = ? AND slug != ?')
        .bind(cleanEmail, rowKey)
        .run();
    } catch (_) {}
  }

  await db
    .prepare(
      `
      INSERT INTO store_catalogs (slug, catalog_id, user_email, business_name, catalog_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        catalog_id = excluded.catalog_id,
        user_email = excluded.user_email,
        business_name = excluded.business_name,
        catalog_json = excluded.catalog_json,
        updated_at = excluded.updated_at
    `
    )
    .bind(rowKey, resolvedCatalogId, isRealEmail ? cleanEmail : null, sanitized?.business?.name || cleanSlug, catalogJson, now)
    .run();

  if (isRealEmail) {
    invalidateCachePattern(`storeCache:${cleanEmail}:`);
  }
  invalidateCachePattern('storeCache:');

  return { slug: cleanSlug, catalogId: resolvedCatalogId };
}

export async function resolvePublicStoreCatalog(
  env: Env,
  slug: string,
  userEmail: string,
  catalogId?: string
): Promise<any | null> {
  const db = getD1Database(env);
  const bucket = getR2Bucket(env);
  if (!db && !bucket) return null;

  const cleanSlug = sanitizePublicStoreSlug(slug || 'store');
  const cleanCatalogId = String(catalogId || '').trim();
  let cleanEmail = String(userEmail || '').toLowerCase().trim();
  if (cleanEmail.startsWith('brivu-usr-') || !cleanEmail.includes('@')) {
    cleanEmail = '';
  }

  const cacheKey = `storeCache:${cleanEmail || 'anon'}:${cleanCatalogId || 'nocat'}:${cleanSlug}`;
  const cached = getCachedQuery(cacheKey);
  if (cached) return cached;

  try {
    let storeRow: any = null;
    if (db) {
      if (cleanEmail && cleanCatalogId) {
        storeRow = await runWithMissingTableRetry(db, () =>
          db
            .prepare(
              `SELECT slug, user_email, catalog_json, updated_at FROM store_catalogs
               WHERE LOWER(user_email) = ?
               ORDER BY CASE WHEN catalog_id = ? OR catalog_json LIKE ? THEN 0 WHEN slug = ? OR slug = ? THEN 1 ELSE 2 END, updated_at DESC
               LIMIT 1`
            )
            .bind(cleanEmail, cleanCatalogId, `%"catalogId":"${cleanCatalogId}"%`, `${cleanSlug}::${cleanEmail}`, cleanSlug)
            .first()
        );
      } else if (cleanCatalogId) {
        storeRow = await runWithMissingTableRetry(db, () =>
          db
            .prepare(
              `SELECT slug, user_email, catalog_json, updated_at FROM store_catalogs
               WHERE catalog_id = ? OR catalog_json LIKE ? OR slug = ? OR slug LIKE ?
               ORDER BY updated_at DESC
               LIMIT 1`
            )
            .bind(cleanCatalogId, `%"catalogId":"${cleanCatalogId}"%`, cleanCatalogId, `${cleanCatalogId}::%`)
            .first()
        );
        if (!storeRow) {
          const bCatRow: any = await db
            .prepare('SELECT user_email FROM (SELECT user_email, backup_data FROM backups ORDER BY updated_at DESC LIMIT 30) WHERE backup_data LIKE ? LIMIT 1')
            .bind(`%"catalogId":"${cleanCatalogId}"%`)
            .first()
            .catch(() => null);
          if (bCatRow?.user_email) {
            cleanEmail = String(bCatRow.user_email).toLowerCase().trim();
          }
        }
      } else if (cleanEmail) {
        storeRow = await runWithMissingTableRetry(db, () =>
          db
            .prepare(
              `SELECT slug, user_email, catalog_json, updated_at FROM store_catalogs
               WHERE LOWER(user_email) = ?
               ORDER BY CASE WHEN slug = ? OR slug = ? THEN 0 ELSE 1 END, updated_at DESC
               LIMIT 1`
            )
            .bind(cleanEmail, `${cleanSlug}::${cleanEmail}`, cleanSlug)
            .first()
        );
      } else {
        storeRow = await runWithMissingTableRetry(db, () =>
          db
            .prepare(
              `SELECT slug, user_email, catalog_json, updated_at FROM store_catalogs
               WHERE slug = ? OR slug LIKE ?
               ORDER BY updated_at DESC
               LIMIT 1`
            )
            .bind(cleanSlug, `${cleanSlug}::%`)
            .first()
        );
      }

      if (!cleanEmail && storeRow?.user_email) {
        const rowEmail = String(storeRow.user_email).toLowerCase().trim();
        if (rowEmail.includes('@') && !rowEmail.startsWith('brivu-usr-')) {
          cleanEmail = rowEmail;
        }
      }
    }

    let parsedStore: any = null;
    if (storeRow?.catalog_json) {
      try {
        parsedStore = JSON.parse(storeRow.catalog_json);
      } catch (_) {}
    }

    // Check D1 backups (or R2 backup fallback) for email to fill missing catalogs or fresher inventory updates
    if (cleanEmail && (db || bucket)) {
      let backupRow: any = null;
      let bData: any = null;
      if (db) {
        backupRow = await db
          .prepare(
            `SELECT backup_data, updated_at FROM backups
             WHERE id = ? OR LOWER(user_email) = ?
             ORDER BY updated_at DESC
             LIMIT 1`
          )
          .bind(`user_${cleanEmail}`, cleanEmail)
          .first()
          .catch(() => null);
        if (backupRow?.backup_data) {
          try {
            bData = JSON.parse(backupRow.backup_data);
          } catch (_) {}
        }
      }

      if (!bData && bucket) {
        try {
          const userKey = encodeURIComponent(cleanEmail);
          let backupObj = await bucket.get(`users/${userKey}/latest_backup.json`);
          if (!backupObj) {
            backupObj = await bucket.get(`users/${userKey}/backup.json`);
          }
          if (backupObj) {
            bData = JSON.parse(await backupObj.text());
          }
        } catch (_) {}
      }

      if (bData) {
        const storeProductsCount = Array.isArray(parsedStore?.products) ? parsedStore.products.length : 0;
        const storeTs = new Date(storeRow?.updated_at || parsedStore?.lastUpdated || 0).getTime();
        const backupTs = new Date(backupRow?.updated_at || bData?.exportedAt || 0).getTime();

        if (!parsedStore || storeProductsCount === 0 || backupTs > storeTs) {
          const fromBackup = buildPublicStoreCatalogFromBackup(
            bData,
            cleanEmail,
            cleanSlug !== 'store' ? cleanSlug : undefined,
            parsedStore?.settings,
            cleanCatalogId || parsedStore?.settings?.catalogId
          );
          if (fromBackup && (fromBackup.products.length > 0 || !parsedStore)) {
            setCachedQuery(cacheKey, fromBackup, 10);
            return fromBackup;
          }
        }
      }
    }

    if (parsedStore) {
      const sanitized = sanitizePublicStoreCatalogPayload(
        parsedStore,
        cleanSlug !== 'store' ? cleanSlug : undefined,
        cleanEmail || undefined,
        cleanCatalogId || undefined
      );
      setCachedQuery(cacheKey, sanitized, 10);
      return sanitized;
    }
  } catch (_) {}

  return null;
}

function escapeCatalogHtmlText(str: any): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeCatalogScriptJson(val: any): string {
  return JSON.stringify(val ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function renderStandaloneCatalogHtml(
  catalog: any | null,
  opts: { catalogId?: string; slug?: string; email?: string; origin?: string }
): string {
  const bizName = String(catalog?.business?.name || catalog?.settings?.businessName || 'Live Stock Catalog').trim() || 'Live Stock Catalog';
  const bizDesc = String(catalog?.business?.description || catalog?.settings?.tagline || 'Browse real-time available stock, prices, sizes, and inquire directly.').trim();
  const logoUrl = String(catalog?.business?.logo || '').trim();
  const safeLogoMeta = logoUrl.startsWith('https://') || logoUrl.startsWith('http://') ? logoUrl : '';
  const resolvedSlug = sanitizePublicStoreSlug(opts.slug || catalog?.settings?.slug || 'store');
  const resolvedCatalogId = String(opts.catalogId || catalog?.settings?.catalogId || '').trim();
  const resolvedEmail = String(opts.email || catalog?.settings?.email || catalog?.business?.email || '').toLowerCase().trim();
  const canonicalUrl = `${opts.origin || ''}${resolvedCatalogId ? `/catalog/${encodeURIComponent(resolvedCatalogId)}` : `/store/${encodeURIComponent(resolvedSlug)}`}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeCatalogHtmlText(bizName)} | Live Stock Catalog | Brivu</title>
  <meta name="description" content="${escapeCatalogHtmlText(bizDesc)}" />
  <meta property="og:title" content="${escapeCatalogHtmlText(bizName)} — Live Stock Catalog" />
  <meta property="og:description" content="${escapeCatalogHtmlText(bizDesc)}" />
  <meta property="og:type" content="website" />
  ${canonicalUrl ? `<meta property="og:url" content="${escapeCatalogHtmlText(canonicalUrl)}" />` : ''}
  ${safeLogoMeta ? `<meta property="og:image" content="${escapeCatalogHtmlText(safeLogoMeta)}" />` : ''}
  <style>
    :root {
      --bg: #f1f5f9;
      --surface: #ffffff;
      --surface-alt: #f8fafc;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --text-soft: #94a3b8;
      --sky: #0284c7;
      --sky-hover: #0369a1;
      --sky-tint: #f0f9ff;
      --emerald: #059669;
      --emerald-hover: #047857;
      --emerald-tint: #ecfdf5;
      --amber: #d97706;
      --amber-tint: #fef3c7;
      --rose: #e11d48;
      --rose-tint: #ffe4e6;
      --purple: #7e22ce;
      --purple-tint: #faf5ff;
      --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.05);
      --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #020617;
        --surface: #0f172a;
        --surface-alt: #1e293b;
        --border: #1e293b;
        --text: #f8fafc;
        --text-muted: #94a3b8;
        --text-soft: #64748b;
        --sky: #38bdf8;
        --sky-hover: #0ea5e9;
        --sky-tint: rgba(14, 165, 233, 0.14);
        --emerald: #10b981;
        --emerald-hover: #059669;
        --emerald-tint: rgba(16, 185, 129, 0.14);
        --amber: #f59e0b;
        --amber-tint: rgba(245, 158, 11, 0.14);
        --rose: #fb7185;
        --rose-tint: rgba(244, 63, 94, 0.16);
        --purple: #d8b4fe;
        --purple-tint: rgba(126, 34, 206, 0.22);
        --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35);
        --shadow-md: 0 12px 30px rgba(0, 0, 0, 0.55);
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; }
    button, input, a { font-family: inherit; }
    .page-shell { min-height: 100vh; display: flex; flex-direction: column; padding-bottom: 48px; }
    .container { width: 100%; max-width: 768px; margin: 0 auto; }

    /* Top Header */
    .topbar { position: sticky; top: 0; z-index: 40; background: var(--surface); border-bottom: 1px solid var(--border); box-shadow: var(--shadow-sm); backdrop-filter: blur(10px); }
    .topbar-inner { padding: 12px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .brand-logo { width: 38px; height: 38px; border-radius: 12px; object-fit: cover; border: 1px solid var(--border); flex-shrink: 0; }
    .brand-initials { width: 38px; height: 38px; border-radius: 12px; background: #0284c7; color: #fff; font-weight: 800; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .brand-title { margin: 0; font-size: 14px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.25; }
    .live-pill { display: flex; align-items: center; gap: 6px; font-size: 10px; font-weight: 700; color: var(--emerald); margin-top: 2px; }
    .live-dot { width: 7px; height: 7px; border-radius: 999px; background: var(--emerald); animation: pulse 1.8s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(0.85); } }
    .icon-btn { border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); border-radius: 12px; padding: 8px 10px; display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 700; cursor: pointer; transition: transform 0.12s, background 0.15s; flex-shrink: 0; }
    .icon-btn:active { transform: scale(0.96); }

    /* Hero */
    .hero { background: var(--surface); border-bottom: 1px solid var(--border); }
    .hero-inner { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .hero-desc { margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
    .actions-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .btn-wa { border: none; background: #059669; color: #fff; border-radius: 12px; padding: 9px 14px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; text-decoration: none; box-shadow: var(--shadow-sm); }
    .btn-wa:hover { background: #047857; }
    .btn-call { border: 1px solid var(--border); background: var(--surface-alt); color: var(--text); border-radius: 12px; padding: 8px 13px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
    .addr-tag { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-muted); padding: 4px 6px; }

    /* Main Catalog */
    .main { padding: 16px 12px; display: flex; flex-direction: column; gap: 16px; flex: 1; }
    @media (min-width: 640px) { .main { padding: 18px 16px; } }
    .search-wrap { position: relative; }
    .search-icon { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-soft); pointer-events: none; }
    .search-input { width: 100%; padding: 11px 36px 11px 38px; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 13px; font-weight: 500; outline: none; box-shadow: var(--shadow-sm); }
    .search-input:focus { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.16); }
    .search-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); border: none; background: transparent; color: var(--text-soft); cursor: pointer; padding: 4px; display: inline-flex; }

    /* Categories */
    .cat-header { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; margin-bottom: 6px; }
    .cat-title { font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
    .cat-count { font-size: 11px; color: var(--text-soft); }
    .cat-strip { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
    .cat-strip::-webkit-scrollbar { display: none; }
    .cat-pill { border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: 16px; padding: 8px 13px; font-size: 12px; font-weight: 800; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 7px; cursor: pointer; transition: transform 0.12s; }
    .cat-pill.active { background: #0284c7; border-color: transparent; color: #fff; box-shadow: var(--shadow-sm); }
    .cat-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
    .cat-badge { font-size: 10px; padding: 1px 6px; border-radius: 999px; background: var(--surface-alt); color: var(--text-muted); }
    .cat-pill.active .cat-badge { background: rgba(255, 255, 255, 0.22); color: #fff; }

    /* Grid */
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    @media (min-width: 640px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 18px; overflow: hidden; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; justify-content: space-between; cursor: pointer; transition: transform 0.15s, box-shadow 0.2s; }
    .card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
    .card-media { position: relative; aspect-ratio: 1 / 1; width: 100%; background: var(--surface-alt); overflow: hidden; }
    .card-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .card-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: var(--text-soft); padding: 12px; background: linear-gradient(135deg, var(--surface-alt), var(--sky-tint)); }
    .stock-badge { position: absolute; top: 8px; right: 8px; border-radius: 999px; padding: 3px 8px; font-size: 10px; font-weight: 800; color: #fff; display: inline-flex; align-items: center; gap: 4px; box-shadow: var(--shadow-sm); }
    .stock-in { background: #059669; }
    .stock-low { background: #d97706; }
    .stock-out { background: #e11d48; }
    .stock-dot { width: 5px; height: 5px; border-radius: 999px; background: #fff; }
    .cat-overlay { position: absolute; bottom: 8px; left: 8px; max-width: 82%; border-radius: 6px; padding: 2px 6px; font-size: 9.5px; font-weight: 800; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .card-body { padding: 11px; display: flex; flex-direction: column; justify-content: space-between; gap: 8px; flex: 1; }
    .card-title { margin: 0; font-size: 13px; font-weight: 800; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tags-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .tag-size { font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: var(--surface-alt); color: var(--text-muted); }
    .tag-color { font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 6px; background: var(--purple-tint); color: var(--purple); }
    .card-footer { padding-top: 8px; border-top: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .price-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-soft); display: block; }
    .price-val { font-size: 13px; font-weight: 900; color: var(--sky); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .wa-mini { border: none; border-radius: 10px; padding: 7px; background: var(--emerald-tint); color: var(--emerald); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .wa-mini:hover { background: #059669; color: #fff; }

    /* Empty / Loading / Error / Paused */
    .state-box { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 28px 18px; }
    .state-card { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 36px 20px; text-align: center; }
    .state-icon { width: 64px; height: 64px; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; }
    .state-title { margin: 0; font-size: 17px; font-weight: 800; }
    .state-sub { margin: 6px auto 0; max-width: 340px; font-size: 12.5px; color: var(--text-muted); line-height: 1.5; }
    .spinner { width: 28px; height: 28px; border: 3px solid var(--sky-tint); border-top-color: var(--sky); border-radius: 999px; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(2, 6, 23, 0.76); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 14px; }
    .modal-panel { position: relative; width: 100%; max-width: 440px; max-height: 90vh; background: var(--surface); border: 1px solid var(--border); border-radius: 24px; overflow: hidden; display: flex; flex-direction: column; box-shadow: var(--shadow-md); }
    .modal-close { position: absolute; top: 12px; right: 12px; z-index: 5; width: 34px; height: 34px; border: none; border-radius: 999px; background: rgba(15, 23, 42, 0.68); color: #fff; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
    .modal-img-wrap { width: 100%; aspect-ratio: 1 / 1; max-height: 320px; background: var(--surface-alt); overflow: hidden; flex-shrink: 0; }
    .modal-img-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .modal-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
    .modal-price { font-size: 20px; font-weight: 900; color: var(--sky); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin-top: 4px; }
    .modal-section-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-soft); margin-bottom: 5px; display: block; }
    .chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
    .size-chip { padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-alt); font-size: 12px; font-weight: 800; }

    .footer { text-align: center; padding: 26px 16px 10px; font-size: 11px; color: var(--text-soft); }
    .footer strong { color: var(--text-muted); }
  </style>
</head>
<body>
  <div id="catalog-root" class="page-shell"></div>

  <script>
    window.__INITIAL_STORE_CATALOG__ = ${safeCatalogScriptJson(catalog)};
    window.__STORE_CATALOG_ID__ = ${safeCatalogScriptJson(resolvedCatalogId)};
    window.__STORE_SLUG__ = ${safeCatalogScriptJson(resolvedSlug)};
    window.__OWNER_EMAIL__ = ${safeCatalogScriptJson(resolvedEmail)};

    (function () {
      var root = document.getElementById('catalog-root');
      var catalog = window.__INITIAL_STORE_CATALOG__;
      var catalogId = window.__STORE_CATALOG_ID__ || '';
      var slug = window.__STORE_SLUG__ || 'store';
      var ownerEmail = window.__OWNER_EMAIL__ || '';
      var selectedCategoryId = 'all';
      var searchQuery = '';
      var selectedProduct = null;
      var copiedTimeout = null;
      var copied = false;

      function safeImg(src) {
        if (!src || typeof src !== 'string') return '';
        var s = src.trim();
        if (s.indexOf('https://') === 0 || s.indexOf('http://') === 0 || s.indexOf('data:image/') === 0) return s;
        return '';
      }
      function safeHex(c, fallback) {
        if (typeof c === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(c.trim())) return c.trim();
        return fallback || '#0284c7';
      }
      function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
      }
      function svgEl(pathD, size, strokeWidth) {
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', String(size || 16));
        svg.setAttribute('height', String(size || 16));
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', String(strokeWidth || 2));
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        var paths = Array.isArray(pathD) ? pathD : [pathD];
        for (var i = 0; i < paths.length; i++) {
          var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          p.setAttribute('d', paths[i]);
          svg.appendChild(p);
        }
        return svg;
      }
      var ICONS = {
        bag: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
        wa: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
        phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
        pin: ['M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z', 'M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0'],
        search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.3-4.3'],
        share: ['M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M16 6l-4-4-4 4', 'M12 2v13'],
        check: 'M20 6 9 17l-5-5',
        close: ['M18 6 6 18', 'm6 6 12 12'],
        clock: ['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 6v6l4 2']
      };
      function formatPrice(amount, currency) {
        var n = Number(amount || 0);
        return (currency || 'UGX') + ' ' + n.toLocaleString();
      }
      function openWa(biz, currency, prod) {
        var phone = (biz && (biz.whatsapp || biz.phone)) || '';
        var clean = String(phone).replace(/[^0-9]/g, '');
        if (!clean) return;
        var msg = 'Hello *' + (biz.name || 'Store') + '*!';
        if (prod) {
          msg += ' I am interested in ordering *' + prod.name + '* (' + formatPrice(prod.sellingPrice, currency) + ').';
          if (Array.isArray(prod.sizes) && prod.sizes.length) {
            msg += ' Available sizes: ' + prod.sizes.join(', ') + '.';
          }
          msg += ' Is this item currently in stock?';
        } else {
          msg += ' I am browsing your live stock catalog and would like to make an inquiry.';
        }
        window.open('https://wa.me/' + clean + '?text=' + encodeURIComponent(msg), '_blank', 'noopener,noreferrer');
      }

      function renderLoading() {
        root.textContent = '';
        var box = el('div', 'state-box');
        var icon = el('div', 'state-icon');
        icon.style.background = 'var(--sky-tint)';
        icon.appendChild(el('div', 'spinner'));
        box.appendChild(icon);
        box.appendChild(el('h3', 'state-title', 'Loading Live Catalog...'));
        box.appendChild(el('p', 'state-sub', 'Fetching real-time stock and pricing.'));
        root.appendChild(box);
      }

      function renderNotFound(msg) {
        root.textContent = '';
        var box = el('div', 'state-box');
        var icon = el('div', 'state-icon');
        icon.style.background = 'var(--rose-tint)';
        icon.style.color = 'var(--rose)';
        icon.appendChild(svgEl(ICONS.bag, 28, 2));
        box.appendChild(icon);
        box.appendChild(el('h3', 'state-title', 'Store Catalog Not Found'));
        box.appendChild(el('p', 'state-sub', msg || 'This live stock catalog link is inactive or does not exist.'));
        root.appendChild(box);
      }

      function renderModal(biz, settings, currency) {
        var existing = document.getElementById('catalog-modal');
        if (existing) existing.remove();
        if (!selectedProduct) return;

        var p = selectedProduct;
        var backdrop = el('div', 'modal-backdrop');
        backdrop.id = 'catalog-modal';
        backdrop.onclick = function () { selectedProduct = null; renderModal(biz, settings, currency); };

        var panel = el('div', 'modal-panel');
        panel.onclick = function (e) { e.stopPropagation(); };

        var closeBtn = el('button', 'modal-close');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.appendChild(svgEl(ICONS.close, 16, 2.5));
        closeBtn.onclick = function () { selectedProduct = null; renderModal(biz, settings, currency); };
        panel.appendChild(closeBtn);

        var imgWrap = el('div', 'modal-img-wrap');
        var pImg = safeImg(p.image);
        if (pImg) {
          var img = document.createElement('img');
          img.src = pImg;
          img.alt = p.name || '';
          imgWrap.appendChild(img);
        } else {
          var ph = el('div', 'card-placeholder');
          ph.appendChild(svgEl(ICONS.bag, 44, 1.8));
          if (p.itemId) ph.appendChild(el('span', 'tag-size', '#' + p.itemId));
          imgWrap.appendChild(ph);
        }
        panel.appendChild(imgWrap);

        var body = el('div', 'modal-body');
        var badges = el('div', 'chip-wrap');
        if (p.categoryName) {
          var catBadge = el('span', 'size-chip', p.categoryName);
          catBadge.style.background = safeHex(p.categoryColor, '#475569');
          catBadge.style.color = '#fff';
          catBadge.style.borderColor = 'transparent';
          badges.appendChild(catBadge);
        }
        var qty = Number(p.quantity || 0);
        var stkTxt = qty <= 0 ? 'Out of Stock' : (settings.showExactQuantity !== false ? qty + ' units available' : 'In Stock');
        var stkChip = el('span', 'size-chip', stkTxt);
        stkChip.style.background = qty <= 0 ? 'var(--rose-tint)' : qty < 5 ? 'var(--amber-tint)' : 'var(--emerald-tint)';
        stkChip.style.color = qty <= 0 ? 'var(--rose)' : qty < 5 ? 'var(--amber)' : 'var(--emerald)';
        stkChip.style.borderColor = 'transparent';
        badges.appendChild(stkChip);
        body.appendChild(badges);

        var headInfo = el('div');
        headInfo.appendChild(el('h2', 'state-title', p.name || 'Product'));
        headInfo.appendChild(el('div', 'modal-price', formatPrice(p.sellingPrice, currency)));
        body.appendChild(headInfo);

        if (Array.isArray(p.sizes) && p.sizes.length) {
          var szSec = el('div');
          szSec.appendChild(el('span', 'modal-section-label', 'Available Sizes'));
          var szWrap = el('div', 'chip-wrap');
          p.sizes.forEach(function (s) { szWrap.appendChild(el('span', 'size-chip', s)); });
          szSec.appendChild(szWrap);
          body.appendChild(szSec);
        }
        if (p.color) {
          var clrSec = el('div');
          clrSec.appendChild(el('span', 'modal-section-label', 'Color'));
          clrSec.appendChild(el('span', 'tag-color', p.color));
          body.appendChild(clrSec);
        }
        if (p.description) {
          var dSec = el('div');
          dSec.appendChild(el('span', 'modal-section-label', 'Description'));
          dSec.appendChild(el('p', 'hero-desc', p.description));
          body.appendChild(dSec);
        }

        var ctas = el('div', 'actions-row');
        ctas.style.flexDirection = 'column';
        ctas.style.alignItems = 'stretch';
        if (biz.whatsapp || biz.phone) {
          var waBtn = el('button', 'btn-wa');
          waBtn.type = 'button';
          waBtn.style.justifyContent = 'center';
          waBtn.style.padding = '12px 16px';
          waBtn.appendChild(svgEl(ICONS.wa, 16, 2));
          waBtn.appendChild(el('span', '', 'Inquire / Order via WhatsApp'));
          waBtn.onclick = function () { openWa(biz, currency, p); };
          ctas.appendChild(waBtn);
        }
        if (biz.phone) {
          var telA = el('a', 'btn-call');
          telA.href = 'tel:' + biz.phone;
          telA.style.justifyContent = 'center';
          telA.appendChild(svgEl(ICONS.phone, 15, 2));
          telA.appendChild(el('span', '', 'Call Store: ' + biz.phone));
          ctas.appendChild(telA);
        }
        body.appendChild(ctas);
        panel.appendChild(body);
        backdrop.appendChild(panel);
        document.body.appendChild(backdrop);
      }

      function renderCatalog() {
        if (!catalog) { renderLoading(); return; }
        var biz = catalog.business || { name: 'Brivu Store', currency: 'UGX' };
        var settings = catalog.settings || { enabled: true, showExactQuantity: true, hideOutOfStock: false, allowWhatsAppOrders: true };
        var currency = biz.currency || settings.currency || 'UGX';

        if (biz.name) {
          document.title = biz.name + ' | Live Stock Catalog | Brivu';
        }

        if (settings.enabled === false) {
          root.textContent = '';
          var box = el('div', 'state-box');
          var icon = el('div', 'state-icon');
          icon.style.background = 'var(--amber-tint)';
          icon.style.color = 'var(--amber)';
          icon.appendChild(svgEl(ICONS.clock, 28, 2));
          box.appendChild(icon);
          box.appendChild(el('h3', 'state-title', (biz.name || 'Store') + ' is Currently Closed'));
          box.appendChild(el('p', 'state-sub', 'The live stock catalog is temporarily paused. Please contact the business directly.'));
          var acts = el('div', 'actions-row');
          acts.style.marginTop = '16px';
          acts.style.justifyContent = 'center';
          if (biz.phone) {
            var cA = el('a', 'btn-call');
            cA.href = 'tel:' + biz.phone;
            cA.appendChild(svgEl(ICONS.phone, 14, 2));
            cA.appendChild(el('span', '', 'Call Business'));
            acts.appendChild(cA);
          }
          if (biz.whatsapp || biz.phone) {
            var wB = el('button', 'btn-wa');
            wB.type = 'button';
            wB.appendChild(svgEl(ICONS.wa, 14, 2));
            wB.appendChild(el('span', '', 'Message on WhatsApp'));
            wB.onclick = function () { openWa(biz, currency); };
            acts.appendChild(wB);
          }
          box.appendChild(acts);
          root.appendChild(box);
          return;
        }

        var rawProducts = Array.isArray(catalog.products) ? catalog.products : [];
        var categories = Array.isArray(catalog.categories) ? catalog.categories : [];

        root.textContent = '';

        // Top Bar
        var header = el('header', 'topbar');
        var headerInner = el('div', 'container topbar-inner');
        var brand = el('div', 'brand');
        var logoSrc = safeImg(biz.logo);
        if (logoSrc) {
          var logoImg = document.createElement('img');
          logoImg.className = 'brand-logo';
          logoImg.src = logoSrc;
          logoImg.alt = biz.name || '';
          brand.appendChild(logoImg);
        } else {
          brand.appendChild(el('div', 'brand-initials', String(biz.name || 'BS').substring(0, 2).toUpperCase()));
        }
        var brandText = el('div');
        brandText.style.minWidth = '0';
        brandText.appendChild(el('h1', 'brand-title', biz.name || 'Brivu Store'));
        var livePill = el('div', 'live-pill');
        livePill.appendChild(el('span', 'live-dot'));
        livePill.appendChild(el('span', '', 'Live Stock Catalog'));
        brandText.appendChild(livePill);
        brand.appendChild(brandText);
        headerInner.appendChild(brand);

        var shareBtn = el('button', 'icon-btn');
        shareBtn.type = 'button';
        shareBtn.appendChild(svgEl(copied ? ICONS.check : ICONS.share, 15, 2));
        shareBtn.appendChild(el('span', '', copied ? 'Copied' : 'Share'));
        shareBtn.onclick = function () {
          var url = window.location.href;
          if (navigator.share) {
            navigator.share({ title: (biz.name || 'Store') + ' | Live Catalog', url: url }).catch(function () {});
          } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function () {
              copied = true;
              renderCatalog();
              clearTimeout(copiedTimeout);
              copiedTimeout = setTimeout(function () { copied = false; renderCatalog(); }, 2000);
            }).catch(function () {});
          }
        };
        headerInner.appendChild(shareBtn);
        header.appendChild(headerInner);
        root.appendChild(header);

        // Hero Banner
        if (biz.description || biz.whatsapp || biz.phone || biz.address) {
          var hero = el('section', 'hero');
          var heroInner = el('div', 'container hero-inner');
          if (biz.description) {
            heroInner.appendChild(el('p', 'hero-desc', biz.description));
          }
          var row = el('div', 'actions-row');
          if (biz.whatsapp || biz.phone) {
            var waCta = el('button', 'btn-wa');
            waCta.type = 'button';
            waCta.appendChild(svgEl(ICONS.wa, 15, 2));
            waCta.appendChild(el('span', '', 'Chat on WhatsApp'));
            waCta.onclick = function () { openWa(biz, currency); };
            row.appendChild(waCta);
          }
          if (biz.phone) {
            var callCta = el('a', 'btn-call');
            callCta.href = 'tel:' + biz.phone;
            callCta.appendChild(svgEl(ICONS.phone, 14, 2));
            callCta.appendChild(el('span', '', biz.phone));
            row.appendChild(callCta);
          }
          if (biz.address) {
            var addr = el('span', 'addr-tag');
            addr.appendChild(svgEl(ICONS.pin, 13, 2));
            addr.appendChild(el('span', '', biz.address));
            row.appendChild(addr);
          }
          if (row.childNodes.length) heroInner.appendChild(row);
          hero.appendChild(heroInner);
          root.appendChild(hero);
        }

        // Main Content
        var main = el('main', 'container main');

        // Search Bar
        var searchWrap = el('div', 'search-wrap');
        var sIcon = el('span', 'search-icon');
        sIcon.appendChild(svgEl(ICONS.search, 16, 2));
        searchWrap.appendChild(sIcon);
        var searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchInput.placeholder = 'Search products by name, size, or color...';
        searchInput.value = searchQuery;
        searchInput.oninput = function (e) {
          searchQuery = e.target.value || '';
          renderProductsSection(productsHost, rawProducts, settings, biz, currency);
          clearBtn.style.display = searchQuery ? 'inline-flex' : 'none';
        };
        searchWrap.appendChild(searchInput);
        var clearBtn = el('button', 'search-clear');
        clearBtn.type = 'button';
        clearBtn.style.display = searchQuery ? 'inline-flex' : 'none';
        clearBtn.appendChild(svgEl(ICONS.close, 15, 2));
        clearBtn.onclick = function () {
          searchQuery = '';
          searchInput.value = '';
          clearBtn.style.display = 'none';
          renderProductsSection(productsHost, rawProducts, settings, biz, currency);
        };
        searchWrap.appendChild(clearBtn);
        main.appendChild(searchWrap);

        // Categories
        if (categories.length > 0) {
          var catSec = el('div');
          var catHdr = el('div', 'cat-header');
          catHdr.appendChild(el('span', 'cat-title', 'Categories'));
          catHdr.appendChild(el('span', 'cat-count', rawProducts.length + ' items available'));
          catSec.appendChild(catHdr);

          var strip = el('div', 'cat-strip');
          var allPill = el('button', 'cat-pill' + (selectedCategoryId === 'all' ? ' active' : ''));
          allPill.type = 'button';
          allPill.appendChild(el('span', '', 'All Products'));
          allPill.appendChild(el('span', 'cat-badge', String(rawProducts.length)));
          allPill.onclick = function () { selectedCategoryId = 'all'; renderCatalog(); };
          strip.appendChild(allPill);

          categories.forEach(function (cat) {
            var isAct = selectedCategoryId === cat.id;
            var pill = el('button', 'cat-pill' + (isAct ? ' active' : ''));
            pill.type = 'button';
            var clr = safeHex(cat.color, '#0284c7');
            if (isAct) pill.style.background = clr;
            var dot = el('span', 'cat-dot');
            dot.style.background = isAct ? '#ffffff' : clr;
            pill.appendChild(dot);
            pill.appendChild(el('span', '', cat.name || 'Category'));
            pill.appendChild(el('span', 'cat-badge', String(cat.count || 0)));
            pill.onclick = function () { selectedCategoryId = cat.id; renderCatalog(); };
            strip.appendChild(pill);
          });

          catSec.appendChild(strip);
          main.appendChild(catSec);
        }

        var productsHost = el('div');
        renderProductsSection(productsHost, rawProducts, settings, biz, currency);
        main.appendChild(productsHost);
        root.appendChild(main);

        var footer = el('footer', 'footer');
        var fp1 = el('p', '', 'Powered by ');
        fp1.appendChild(el('strong', '', 'Brivu'));
        fp1.appendChild(document.createTextNode(' • Live Stock Catalog'));
        footer.appendChild(fp1);
        root.appendChild(footer);

        renderModal(biz, settings, currency);
      }

      function renderProductsSection(host, rawProducts, settings, biz, currency) {
        host.textContent = '';
        var q = searchQuery.toLowerCase().trim();
        var filtered = rawProducts.filter(function (p) {
          if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) return false;
          if (settings.hideOutOfStock && Number(p.quantity || 0) <= 0) return false;
          if (!q) return true;
          return (
            String(p.name || '').toLowerCase().indexOf(q) !== -1 ||
            String(p.categoryName || '').toLowerCase().indexOf(q) !== -1 ||
            String(p.color || '').toLowerCase().indexOf(q) !== -1 ||
            (Array.isArray(p.sizes) && p.sizes.some(function (s) { return String(s).toLowerCase().indexOf(q) !== -1; }))
          );
        });

        if (filtered.length === 0) {
          var empty = el('div', 'state-card');
          var icon = el('div', 'state-icon');
          icon.style.background = 'var(--surface-alt)';
          icon.style.color = 'var(--text-soft)';
          icon.appendChild(svgEl(ICONS.bag, 24, 2));
          empty.appendChild(icon);
          empty.appendChild(el('h3', 'state-title', 'No products found'));
          empty.appendChild(el('p', 'state-sub', q ? 'No items match "' + searchQuery + '".' : 'Check back soon for new stock arrivals!'));
          host.appendChild(empty);
          return;
        }

        var grid = el('div', 'grid');
        filtered.forEach(function (prod) {
          var card = el('div', 'card');
          card.onclick = function () { selectedProduct = prod; renderModal(biz, settings, currency); };

          var media = el('div', 'card-media');
          var pImg = safeImg(prod.image);
          if (pImg) {
            var img = document.createElement('img');
            img.src = pImg;
            img.alt = prod.name || '';
            img.loading = 'lazy';
            media.appendChild(img);
          } else {
            var ph = el('div', 'card-placeholder');
            ph.appendChild(svgEl(ICONS.bag, 30, 1.8));
            if (prod.itemId) ph.appendChild(el('span', 'tag-size', '#' + prod.itemId));
            media.appendChild(ph);
          }

          var qty = Number(prod.quantity || 0);
          var isOut = qty <= 0;
          var isLow = qty > 0 && qty < 5;
          var sBadge = el('span', 'stock-badge ' + (isOut ? 'stock-out' : isLow ? 'stock-low' : 'stock-in'));
          sBadge.appendChild(el('span', 'stock-dot'));
          var sLabel = isOut
            ? 'Out of Stock'
            : isLow
            ? (settings.showExactQuantity !== false ? 'Only ' + qty + ' left' : 'Low Stock')
            : (settings.showExactQuantity !== false ? qty + ' in stock' : 'In Stock');
          sBadge.appendChild(el('span', '', sLabel));
          media.appendChild(sBadge);

          if (prod.categoryName) {
            var cBadge = el('span', 'cat-overlay', prod.categoryName);
            cBadge.style.background = safeHex(prod.categoryColor, '#475569');
            media.appendChild(cBadge);
          }
          card.appendChild(media);

          var body = el('div', 'card-body');
          var top = el('div');
          top.appendChild(el('h3', 'card-title', prod.name || 'Product'));
          if ((Array.isArray(prod.sizes) && prod.sizes.length) || prod.color) {
            var tags = el('div', 'tags-row');
            if (Array.isArray(prod.sizes) && prod.sizes.length) {
              tags.appendChild(el('span', 'tag-size', 'Sizes: ' + prod.sizes.join(', ')));
            }
            if (prod.color) {
              tags.appendChild(el('span', 'tag-color', prod.color));
            }
            top.appendChild(tags);
          }
          body.appendChild(top);

          var foot = el('div', 'card-footer');
          var priceBox = el('div');
          priceBox.appendChild(el('span', 'price-label', 'Price'));
          priceBox.appendChild(el('span', 'price-val', formatPrice(prod.sellingPrice, currency)));
          foot.appendChild(priceBox);

          if (settings.allowWhatsAppOrders !== false && (biz.whatsapp || biz.phone)) {
            var waMini = el('button', 'wa-mini');
            waMini.type = 'button';
            waMini.title = 'Order via WhatsApp';
            waMini.appendChild(svgEl(ICONS.wa, 16, 2));
            waMini.onclick = function (e) {
              e.stopPropagation();
              openWa(biz, currency, prod);
            };
            foot.appendChild(waMini);
          }
          body.appendChild(foot);
          card.appendChild(body);
          grid.appendChild(card);
        });
        host.appendChild(grid);
      }

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && selectedProduct) {
          selectedProduct = null;
          var biz = (catalog && catalog.business) || {};
          var settings = (catalog && catalog.settings) || {};
          renderModal(biz, settings, biz.currency || settings.currency || 'UGX');
        }
      });

      function fetchLiveCatalog(silent) {
        var qs = [];
        if (slug) qs.push('slug=' + encodeURIComponent(slug));
        if (ownerEmail) qs.push('email=' + encodeURIComponent(ownerEmail));
        var endpoint = catalogId
          ? '/api/catalog/' + encodeURIComponent(catalogId) + (qs.length ? '?' + qs.join('&') : '')
          : '/api/store/' + encodeURIComponent(slug || 'store') + (ownerEmail ? '?email=' + encodeURIComponent(ownerEmail) : '');

        fetch(endpoint, { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (json) {
            if (json && json.data && (Array.isArray(json.data.products) || json.data.business)) {
              catalog = json.data;
              renderCatalog();
            } else if (!silent && !catalog) {
              renderNotFound('This store catalog could not be found.');
            }
          })
          .catch(function () {
            if (!silent && !catalog) {
              renderNotFound('Unable to connect to the live catalog server.');
            }
          });
      }

      if (catalog && (Array.isArray(catalog.products) || catalog.business)) {
        renderCatalog();
        fetchLiveCatalog(true);
      } else {
        renderLoading();
        fetchLiveCatalog(false);
      }
    })();
  </script>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Read WorkOS overrides from custom headers or search params
    const headerClientId = request.headers.get('X-WorkOS-Client-Id') || url.searchParams.get('workos_client_id');
    const headerApiKey = request.headers.get('X-WorkOS-Api-Key') || url.searchParams.get('workos_api_key');

    const workosClientId = (headerClientId || env.WORKOS_CLIENT_ID || 'client_01M4BGNT60CPMEA9P83WD6NRSB').trim().replace(/^['"]|['"]$/g, '');
    const workosApiKey = (headerApiKey || env.WORKOS_API_KEY || 'sk_a2V5XzAxTTRCVzFBRjBaMTg1RU1SR1lRNE5SWVZYLGZ2RWhseTNSUEJOVVZaSmJqOUM3Mk5lQWnl').trim().replace(/^['"]|['"]$/g, '');

    // 1. Handle CORS Preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      const reqHeaders = request.headers.get('Access-Control-Request-Headers');
      return new Response(null, {
        status: 204,
        headers: {
          ...CORS_HEADERS,
          ...(reqHeaders ? { 'Access-Control-Allow-Headers': reqHeaders } : {}),
        },
      });
    }

    // 1b. Digital Asset Links for Google Play Deep Links & Credential Sharing domain verification
    if (
      url.pathname === '/.well-known/assetlinks.json' ||
      url.pathname === '/.well-known/assetlinks'
    ) {
      return new Response(JSON.stringify(ASSET_LINKS_DATA, null, 2), {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    // 2. Health check endpoint (/api/health)
    if (url.pathname === '/api/health') {
      const bucket = getR2Bucket(env);
      const db = getD1Database(env);
      const d1Bound = Boolean(db);
      const r2Bound = Boolean(bucket);
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'connected',
          d1Bound,
          r2Bound,
          workosConfigured: Boolean(workosClientId && workosApiKey),
          cloudflareClientIdConfigured: Boolean(env.WORKOS_CLIENT_ID),
          cloudflareApiKeyConfigured: Boolean(env.WORKOS_API_KEY),
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Optimized D1 Products API GET (/api/products)
    if (url.pathname === '/api/products' && request.method === 'GET') {
      try {
        const db = getD1Database(env);
        if (!db) {
          return new Response(JSON.stringify({ ok: true, results: [] }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
        await ensureD1Tables(db);
        const shopId = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('shop_id') ||
          url.searchParams.get('email') ||
          'default_shop'
        ).toLowerCase().trim();

        const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
        let limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
        const offset = (page - 1) * limit;
        const cacheKey = `products_${shopId}_p${page}_l${limit}`;

        const cached = getCachedQuery(cacheKey);
        if (cached) {
          return new Response(JSON.stringify({ ok: true, cached: true, ...cached }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        const stmt = db.prepare(`
          SELECT id, shop_id, name, barcode, category, selling_price, cost_price, stock_quantity, updated_at
          FROM products
          WHERE shop_id = ?
          ORDER BY updated_at DESC
          LIMIT ? OFFSET ?
        `).bind(shopId, limit, offset);

        const res = await executeMeasuredQuery(stmt, 'GET_PRODUCTS');
        const results = res.results || [];
        const payload = { results, meta: res.meta || {} };
        setCachedQuery(cacheKey, payload, 60);

        return new Response(JSON.stringify({ ok: true, ...payload }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }

    // Optimized D1 Products API POST (/api/products)
    if (url.pathname === '/api/products' && request.method === 'POST') {
      try {
        const db = getD1Database(env);
        if (!db) {
          return new Response(JSON.stringify({ ok: false, error: 'Database not bound' }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
        await ensureD1Tables(db);
        const body: any = await request.json().catch(() => ({}));
        const shopId = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          body?.shopId ||
          body?.userEmail ||
          'default_shop'
        ).toLowerCase().trim();

        const id = body.id || `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const name = body.name || 'Unnamed Product';
        const barcode = body.barcode || null;
        const category = body.category || 'General';
        const sellingPrice = Number(body.sellingPrice || body.price || 0);
        const costPrice = Number(body.costPrice || 0);
        const stockQuantity = Number(body.stockQuantity || body.stock || 0);
        const image = body.image || null;
        const updatedAt = new Date().toISOString();

        const stmt = db.prepare(`
          INSERT INTO products (id, shop_id, name, barcode, category, selling_price, cost_price, stock_quantity, image, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            barcode = excluded.barcode,
            category = excluded.category,
            selling_price = excluded.selling_price,
            cost_price = excluded.cost_price,
            stock_quantity = excluded.stock_quantity,
            image = excluded.image,
            updated_at = excluded.updated_at
        `).bind(id, shopId, name, barcode, category, sellingPrice, costPrice, stockQuantity, image, updatedAt);

        await executeMeasuredQuery(stmt, 'UPSERT_PRODUCT');
        invalidateCachePattern(`products_${shopId}`);

        return new Response(JSON.stringify({ ok: true, success: true, id }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }

    // Optimized D1 Menu / Hotel Public API GET (/api/m/:hotelId)
    if (url.pathname.startsWith('/api/m/') && request.method === 'GET') {
      try {
        const hotelId = decodeURIComponent(url.pathname.replace('/api/m/', '')).trim();
        const db = getD1Database(env);
        if (!hotelId || !db) {
          return new Response(JSON.stringify({ ok: false, error: 'Not found' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }
        await ensureD1Tables(db);
        const cacheKey = `menu_${hotelId}`;
        const cached = getCachedQuery(cacheKey);
        if (cached) {
          return new Response(JSON.stringify({ ok: true, cached: true, ...cached }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        const stmt = db.prepare(`
          SELECT id, hotel_id, title, menu_data, updated_at
          FROM menus
          WHERE hotel_id = ?
          LIMIT 1
        `).bind(hotelId);

        const res = await executeMeasuredQuery(stmt, 'GET_MENU');
        const row = res.results?.[0];
        if (!row) {
          return new Response(JSON.stringify({ ok: false, error: 'Menu not found' }), { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
        }

        const menuData = JSON.parse(row.menu_data || '{}');
        const payload = { menu: menuData, meta: res.meta || {} };
        setCachedQuery(cacheKey, payload, 60);

        return new Response(JSON.stringify({ ok: true, ...payload }), { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }), { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
      }
    }

    // 2a. WorkOS OAuth Callback Handler (/callback and /auth/callback)
    // Pure Web-based OAuth handling for both Website and Android app (zero Play Store links or custom schemes)
    if (url.pathname === '/callback' || url.pathname === '/auth/callback') {
      const authCode = url.searchParams.get('code') || '';
      const authError = url.searchParams.get('error') || url.searchParams.get('error_description') || '';
      const rawState = url.searchParams.get('state') || '';

      let sessionId = '';
      let returnUrl = '';
      let platform = '';

      if (rawState) {
        try {
          const parsed = JSON.parse(decodeURIComponent(rawState));
          if (parsed && typeof parsed === 'object') {
            sessionId = parsed.sessionId || '';
            returnUrl = parsed.returnUrl || '';
            platform = parsed.platform || '';
          }
        } catch (_) {
          if (rawState.startsWith('http://') || rawState.startsWith('https://')) {
            returnUrl = decodeURIComponent(rawState);
          }
        }
      }

      // Check referer header if returnUrl is not explicitly in state
      if (!returnUrl) {
        const referer = request.headers.get('Referer') || request.headers.get('referrer') || '';
        if (referer && !referer.includes('google.com') && !referer.includes('workos.com') && !referer.includes(url.hostname)) {
          returnUrl = referer;
        }
      }

      // CRITICAL: NEVER permit localhost or 127.0.0.1 as returnUrl on mobile or web
      if (returnUrl && (returnUrl.includes('localhost') || returnUrl.includes('127.0.0.1') || returnUrl.includes('capacitor:'))) {
        returnUrl = 'https://brivu.shapesmm7.workers.dev/';
      }

      // 1. Direct server-side exchange on worker for immediate zero-delay sign-in
      let authenticatedUser: any = null;
      if (authCode) {
        try {
          const cleanApiKey = (env.WORKOS_API_KEY || workosApiKey || '').trim().replace(/^['"]|['"]$/g, '');
          const cleanClientId = (env.WORKOS_CLIENT_ID || workosClientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB').trim().replace(/^['"]|['"]$/g, '');

          if (cleanApiKey) {
            const wRes = await fetch('https://api.workos.com/user_management/authenticate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanApiKey}`,
              },
              body: JSON.stringify({
                client_id: cleanClientId,
                client_secret: cleanApiKey,
                code: authCode,
                grant_type: 'authorization_code',
              }),
            });

            if (wRes.ok) {
              const wData: any = await wRes.json();
              const u = wData.user || wData;
              const firstName = u.first_name || u.firstName || '';
              const lastName = u.last_name || u.lastName || '';
              const email = (u.email || '').toLowerCase().trim();
              const name = (u.name || `${firstName} ${lastName}`.trim() || email || 'Google User').trim();
              const profilePictureUrl = u.profile_picture_url || u.profilePictureUrl || u.avatar_url || '';

              authenticatedUser = {
                id: email || u.id || `workos_usr_${Date.now()}`,
                email,
                firstName,
                lastName,
                name,
                profilePictureUrl,
                emailVerified: true,
                provider: 'google',
                updatedAt: new Date().toISOString(),
                syncedToCloudflare: true,
              };
            }
          }
        } catch (exErr) {
          console.warn('Callback direct server-side exchange note:', exErr);
        }
      }

      // 2. Persist session for instant polling in web and Android
      if (sessionId) {
        authSessionsCache.set(sessionId, {
          status: 'completed',
          user: authenticatedUser,
          code: authCode,
          createdAt: Date.now(),
        });

        const db = getD1Database(env);
        if (db) {
          try {
            await ensureD1Tables(db);
            const fifteenMinsAgo = Date.now() - (15 * 60 * 1000);
            await db.prepare(`DELETE FROM auth_sessions WHERE created_at < ? OR session_id LIKE '%@%'`).bind(fifteenMinsAgo).run().catch(() => {});
            await db.prepare(`
              INSERT OR REPLACE INTO auth_sessions (session_id, status, code, user_json, created_at)
              VALUES (?, ?, ?, ?, ?)
            `).bind(sessionId, 'completed', authCode, authenticatedUser ? JSON.stringify(authenticatedUser) : null, Date.now()).run();
          } catch (_) {}
        }
      }

      // 3. Serve the clean, web-only callback landing page (never triggers Play Store or custom scheme errors)
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Brivu - Google Sign-In Approved</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #030712;
      color: #f9fafb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
    }
    .card {
      background-color: #111827;
      border: 1px solid #1f2937;
      border-radius: 1.5rem;
      padding: 2.25rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }
    .icon-error {
      width: 56px;
      height: 56px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 1.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
    }
    .icon-error svg { width: 28px; height: 28px; stroke: #ef4444; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    .icon-success {
      width: 56px;
      height: 56px;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 1.25rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.25rem;
    }
    .icon-success svg { width: 28px; height: 28px; stroke: #10b981; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    h1 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.5rem; color: #ffffff; }
    p { font-size: 0.875rem; color: #9ca3af; line-height: 1.5; margin-bottom: 1.25rem; }
    .user-pill {
      display: inline-block;
      background: #1f2937;
      border: 1px solid #374151;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      color: #e5e7eb;
      margin-bottom: 1.25rem;
      max-width: 90%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .btn {
      display: block;
      width: 100%;
      padding: 0.875rem 1.25rem;
      border-radius: 1rem;
      font-weight: 700;
      font-size: 0.875rem;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s;
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #ffffff;
      border: none;
    }
    .btn:hover { opacity: 0.95; }
    .btn-secondary {
      background: #1f2937;
      color: #e5e7eb;
      border: 1px solid #374151;
      margin-top: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="card">
    ${authError ? `
      <div class="icon-error">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      </div>
      <h1>Authentication Notice</h1>
      <p>${authError}</p>
      <a href="/" class="btn">Return Home</a>
    ` : `
      <div class="icon-success">
        <svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      </div>
      <h1>Sign-In Approved!</h1>
      ${authenticatedUser?.email ? `<div class="user-pill">${authenticatedUser.email}</div>` : ''}
      <p id="statusMsg">Your Google account has been verified. Returning to Brivu...</p>
      <div id="actionButtons" style="margin-top: 1.25rem;">
        <a id="btnPrimary" href="/" class="btn">Open Brivu App</a>
        <a id="btnWebSecondary" href="https://brivu.shapesmm7.workers.dev/" class="btn btn-secondary" style="display: none;">Continue on Web Instead</a>
      </div>
    `}
  </div>

  <script>
    (function() {
      var code = ${JSON.stringify(authCode)};
      var user = ${JSON.stringify(authenticatedUser)};
      var returnUrl = ${JSON.stringify(returnUrl)};
      var sessionId = ${JSON.stringify(sessionId)};
      var platform = ${JSON.stringify(platform)};

      if (!code && !user) return;

      // 1. Web Popup Flow: post message to opener window and close cleanly
      if (window.opener) {
        try {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code: code, user: user, sessionId: sessionId }, '*');
          setTimeout(function() {
            try { window.close(); } catch (_) {}
          }, 400);
          return;
        } catch (_) {}
      }

      var userAgent = (navigator.userAgent || '').toLowerCase();
      var isAndroid = userAgent.indexOf('android') >= 0;
      var isMobile = isAndroid || userAgent.indexOf('iphone') >= 0 || userAgent.indexOf('ipad') >= 0;
      var isAndroidApp = platform === 'android' || isAndroid || isMobile;

      // Build payload parameters
      var userParam = user ? '&user=' + encodeURIComponent(JSON.stringify(user)) : '';
      var sessionParam = sessionId ? '&auth_session=' + encodeURIComponent(sessionId) : '';
      var codeParam = code ? '&code=' + encodeURIComponent(code) : '';

      // Direct Android app deep link schemes registered in AndroidManifest.xml
      var appSchemeUrl = 'brivu://auth/callback?' + codeParam + sessionParam + userParam;
      var appIntentUrl = 'intent://auth/callback?' + codeParam + sessionParam + userParam + '#Intent;scheme=brivu;package=com.brivu.myapp;end';

      var btnPrimary = document.getElementById('btnPrimary');
      var btnWebSecondary = document.getElementById('btnWebSecondary');
      var statusMsg = document.getElementById('statusMsg');

      function openAndroidApp(e) {
        if (e && e.preventDefault) e.preventDefault();
        try {
          window.location.href = appSchemeUrl;
        } catch (_) {}
        setTimeout(function() {
          try {
            window.location.href = appIntentUrl;
          } catch (_) {}
        }, 200);
      }

      if (isAndroidApp) {
        if (statusMsg) {
          statusMsg.textContent = 'Account verified! Opening your Brivu Android App...';
        }
        if (btnPrimary) {
          btnPrimary.textContent = 'Open Brivu App & Log In';
          btnPrimary.href = appSchemeUrl;
          btnPrimary.onclick = openAndroidApp;
        }
        if (btnWebSecondary) {
          btnWebSecondary.style.display = 'block';
          btnWebSecondary.href = 'https://brivu.shapesmm7.workers.dev/?auth_session=' + encodeURIComponent(sessionId || '') + userParam;
        }

        // Auto-launch into Android app immediately
        setTimeout(function() {
          openAndroidApp();
        }, 200);
      } else {
        // Desktop Web Flow
        var targetUrl = returnUrl;
        try {
          if (!targetUrl) {
            targetUrl = localStorage.getItem('workos_web_return_url') || sessionStorage.getItem('workos_web_return_url');
          }
        } catch (_) {}

        if (targetUrl && (targetUrl.indexOf('localhost') >= 0 || targetUrl.indexOf('127.0.0.1') >= 0 || targetUrl.indexOf('capacitor:') >= 0)) {
          targetUrl = 'https://brivu.shapesmm7.workers.dev/';
        }

        var dest = targetUrl || 'https://brivu.shapesmm7.workers.dev/';
        var sep = dest.indexOf('?') >= 0 ? '&' : '?';
        var webDestination = dest + sep + (code ? 'code=' + encodeURIComponent(code) : '') + sessionParam + userParam;

        if (btnPrimary) {
          btnPrimary.textContent = 'Continue to Brivu';
          btnPrimary.href = webDestination;
        }

        if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://'))) {
          try {
            var target = new URL(targetUrl);
            if (target.hostname !== 'localhost' && target.hostname !== '127.0.0.1' && target.origin !== window.location.origin) {
              target.searchParams.set('code', code);
              if (sessionId) target.searchParams.set('auth_session', sessionId);
              if (user) target.searchParams.set('user', JSON.stringify(user));
              window.location.replace(target.toString());
            }
          } catch (_) {}
        }
      }
    })();
  </script>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // 2b. WorkOS Auth Session Polling Endpoint (/api/auth/session/status)
    // Instant real-time status check for web and Android login without any custom URL schemes
    if (url.pathname === '/api/auth/session/status' && request.method === 'GET') {
      const sessionId = url.searchParams.get('session_id') || '';
      if (!sessionId) {
        return new Response(JSON.stringify({ ok: false, error: 'Missing session_id' }), {
          status: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      let session = authSessionsCache.get(sessionId);
      if (!session) {
        const db = getD1Database(env);
        if (db) {
          try {
            await ensureD1Tables(db);
            const row: any = await db.prepare('SELECT * FROM auth_sessions WHERE session_id = ?').bind(sessionId).first();
            if (row) {
              session = {
                status: row.status,
                code: row.code,
                user: row.user_json ? JSON.parse(row.user_json) : null,
                createdAt: row.created_at,
              };
              authSessionsCache.set(sessionId, session);
            }
          } catch (_) {}
        }
      }

      if (session && session.status === 'completed') {
        const payload = {
          ok: true,
          success: true,
          status: 'completed',
          user: session.user,
          code: session.code,
        };
        // Handshake consumed: clean up temporary session from in-memory cache and D1 table
        authSessionsCache.delete(sessionId);
        const db = getD1Database(env);
        if (db) {
          try {
            await db.prepare('DELETE FROM auth_sessions WHERE session_id = ?').bind(sessionId).run();
          } catch (_) {}
        }
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        status: 'pending',
      }), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 2c. WorkOS Auth Authorize / Config endpoint (/api/auth/workos/authorize)
    if (url.pathname === '/api/auth/workos/authorize') {
      const redirectUri = 'https://brivu.shapesmm7.workers.dev/callback';

      const clientId = workosClientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB';
      const codeChallenge = url.searchParams.get('code_challenge');
      const isConfigured = Boolean(clientId);
      
      let authUrl = `https://api.workos.com/user_management/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&provider=GoogleOAuth`;
      if (codeChallenge) {
        authUrl += `&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          configured: isConfigured,
          clientId,
          redirectUri,
          authUrl,
          provider: 'GoogleOAuth',
          cloudflareClientIdConfigured: Boolean(env.WORKOS_CLIENT_ID),
          cloudflareApiKeyConfigured: Boolean(env.WORKOS_API_KEY),
          isUsingFallback: !Boolean(env.WORKOS_CLIENT_ID) && !headerClientId,
          message: 'WorkOS AuthKit Google Sign-In ready',
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 2c. WorkOS Auth Code Authenticate endpoint (/api/auth/workos/authenticate)
    if (url.pathname === '/api/auth/workos/authenticate' && request.method === 'POST') {
      try {
        const body: any = await request.json().catch(() => ({}));
        const { code, redirectUri, codeVerifier } = body;
        const bucket = getR2Bucket(env);
        const db = getD1Database(env);

        // Resolve clean API key and Client ID from request body, headers, or Cloudflare Worker env
        const cleanApiKey = (body?.workosApiKey || headerApiKey || env.WORKOS_API_KEY || workosApiKey || '').trim().replace(/^['"]|['"]$/g, '');
        const cleanClientId = (body?.workosClientId || headerClientId || env.WORKOS_CLIENT_ID || workosClientId || 'client_01M4BGNT60CPMEA9P83WD6NRSB').trim().replace(/^['"]|['"]$/g, '');

        if (!code) {
          return new Response(
            JSON.stringify({ ok: false, success: false, error: 'No authorization code received from Google Sign-In.' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        let user: any = null;
        let workosRes: Response | null = null;

        // 1. If PKCE codeVerifier is present, use official PKCE exchange
        if (codeVerifier) {
          const pkceBody: any = {
            client_id: cleanClientId,
            code,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
          };
          if (cleanApiKey) {
            pkceBody.client_secret = cleanApiKey;
          }

          const pkceHeaders: any = { 'Content-Type': 'application/json' };
          if (cleanApiKey) {
            pkceHeaders['Authorization'] = `Bearer ${cleanApiKey}`;
          }

          workosRes = await fetch('https://api.workos.com/user_management/authenticate', {
            method: 'POST',
            headers: pkceHeaders,
            body: JSON.stringify(pkceBody),
          });

          // If rejected with secret error, retry PKCE without secret
          if (!workosRes.ok && pkceBody.client_secret) {
            try {
              const retryPkceRes = await fetch('https://api.workos.com/user_management/authenticate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  client_id: cleanClientId,
                  code,
                  code_verifier: codeVerifier,
                  grant_type: 'authorization_code',
                }),
              });
              if (retryPkceRes.ok) {
                workosRes = retryPkceRes;
              }
            } catch (_) {}
          }
        }

        // 2. If PKCE not used or failed, try standard API key code exchange
        if (!workosRes || !workosRes.ok) {
          if (cleanApiKey) {
            workosRes = await fetch('https://api.workos.com/user_management/authenticate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanApiKey}`,
              },
              body: JSON.stringify({
                client_id: cleanClientId,
                client_secret: cleanApiKey,
                code,
                grant_type: 'authorization_code',
              }),
            });
          }
        }

        if (workosRes && workosRes.ok) {
          const wData: any = await workosRes.json();
          const u = wData.user || wData;
          const firstName = u.first_name || u.firstName || '';
          const lastName = u.last_name || u.lastName || '';
          const email = (u.email || '').toLowerCase().trim();
          const name = (u.name || `${firstName} ${lastName}`.trim() || email || 'Google User').trim();
          const profilePictureUrl = u.profile_picture_url || u.profilePictureUrl || u.avatar_url || '';
          const emailVerified = u.email_verified ?? u.emailVerified ?? true;

          // User ID on Cloudflare is the user's authentic email
          user = {
            id: email || u.id || `workos_usr_${Date.now()}`,
            email,
            firstName,
            lastName,
            name,
            profilePictureUrl,
            emailVerified,
            provider: 'google',
            updatedAt: new Date().toISOString(),
            syncedToCloudflare: true,
          };
        } else {
          const errData: any = workosRes ? await workosRes.json().catch(() => null) : null;
          const rawMsg = errData?.error_description || errData?.message || errData?.error || 'Authentication code exchange failed';
          return new Response(
            JSON.stringify({
              ok: false,
              success: false,
              error: `WorkOS Error: ${rawMsg}`,
              details: errData,
            }),
            {
              status: 400,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            }
          );
        }

        if (user && user.email && db) {
          const cleanEmail = user.email.toLowerCase().trim();
          const nowIso = new Date().toISOString();
          user.id = cleanEmail;
          user.syncedToCloudflare = true;
          user.cloudflareStoredAt = nowIso;

          try {
            await ensureD1Tables(db);
            await db.prepare(`
              INSERT INTO users (id, email, name, first_name, last_name, profile_picture_url, provider, created_at, updated_at, last_login)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET
                name = excluded.name,
                first_name = excluded.first_name,
                last_name = excluded.last_name,
                profile_picture_url = excluded.profile_picture_url,
                updated_at = excluded.updated_at,
                last_login = excluded.last_login
            `).bind(
              cleanEmail,
              cleanEmail,
              user.name || '',
              user.firstName || '',
              user.lastName || '',
              user.profilePictureUrl || '',
              user.provider || 'google',
              nowIso,
              nowIso,
              nowIso
            ).run();
          } catch (d1Err) {
            console.warn('D1 auth user store note:', d1Err);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            user,
            storedInCloudflare: true,
            message: 'Authenticated and saved user profile & email in D1',
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, success: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2d. Cloudflare User Profile & Emails Storage endpoint (/api/user/profile)
    if (url.pathname === '/api/user/profile' && request.method === 'POST') {
      try {
        const db = getD1Database(env);
        const body: any = await request.json().catch(() => ({}));
        const { user, businessProfile, appData } = body;

        if (!user || !user.email) {
          return new Response(
            JSON.stringify({ ok: false, success: false, error: 'User email and details are required' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        const cleanEmail = user.email.toLowerCase().trim();
        const nowIso = new Date().toISOString();
        const userPayload = {
          ...user,
          id: cleanEmail,
          email: cleanEmail,
          syncedToCloudflare: true,
          cloudflareStoredAt: nowIso,
          businessProfile,
          appData,
        };

        if (db) {
          try {
            await ensureD1Tables(db);
            await db.prepare(`
              INSERT INTO users (id, email, name, first_name, last_name, profile_picture_url, provider, created_at, updated_at, last_login)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET
                name = excluded.name,
                updated_at = excluded.updated_at,
                last_login = excluded.last_login
            `).bind(
              cleanEmail,
              cleanEmail,
              user.name || '',
              user.firstName || '',
              user.lastName || '',
              user.profilePictureUrl || '',
              user.provider || 'google',
              nowIso,
              nowIso,
              nowIso
            ).run();

            if (businessProfile) {
              await db.prepare(`
                INSERT INTO business_profile (user_email, name, description, phone, email, address, currency, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_email) DO UPDATE SET
                  name = excluded.name,
                  description = excluded.description,
                  phone = excluded.phone,
                  email = excluded.email,
                  address = excluded.address,
                  currency = excluded.currency,
                  updated_at = excluded.updated_at
              `).bind(
                cleanEmail,
                businessProfile.name || '',
                businessProfile.description || '',
                businessProfile.phone || '',
                businessProfile.email || cleanEmail,
                businessProfile.address || '',
                businessProfile.currency || 'UGX',
                nowIso
              ).run();
            }
          } catch (d1Err) {
            console.warn('D1 profile store note:', d1Err);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'User profile, email, and data stored successfully in Cloudflare D1',
            user: userPayload,
            timestamp: nowIso,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, success: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2e. Get stored user profile from Cloudflare (/api/user/profile?email=... or ?id=...)
    if (url.pathname === '/api/user/profile' && request.method === 'GET') {
      const db = getD1Database(env);
      const email = url.searchParams.get('email');
      const id = url.searchParams.get('id');
      const targetEmail = (email || id || '').toLowerCase().trim();

      if (db && targetEmail) {
        try {
          await ensureD1Tables(db);
          const uRow: any = await db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR id = ?').bind(targetEmail, targetEmail).first();
          if (uRow) {
            const userObj = {
              id: uRow.email,
              email: uRow.email,
              name: uRow.name || uRow.email,
              firstName: uRow.first_name || '',
              lastName: uRow.last_name || '',
              profilePictureUrl: uRow.profile_picture_url || '',
              provider: uRow.provider || 'google',
              updatedAt: uRow.updated_at,
              createdAt: uRow.created_at,
              lastLogin: uRow.last_login,
            };
            return new Response(JSON.stringify({ ok: true, success: true, user: userObj }), {
              status: 200,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        } catch (_) {}
      }

      return new Response(
        JSON.stringify({ ok: false, success: false, message: 'User profile not found in Cloudflare' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 2f. List all stored users & emails from Cloudflare (/api/users/all)
    if (url.pathname === '/api/users/all') {
      const db = getD1Database(env);
      let users: any[] = [];
      if (db) {
        try {
          await ensureD1Tables(db);
          const rows: any = await db.prepare('SELECT * FROM users ORDER BY last_login DESC').all();
          if (rows && Array.isArray(rows.results)) {
            users = rows.results.map((u: any) => ({
              id: u.email,
              email: u.email,
              name: u.name || u.email,
              firstName: u.first_name || '',
              lastName: u.last_name || '',
              profilePictureUrl: u.profile_picture_url || '',
              provider: u.provider || 'google',
              updatedAt: u.updated_at,
              createdAt: u.created_at,
              lastLogin: u.last_login,
            }));
          }
        } catch (_) {}
      }
      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          users,
          emails: users.map((u) => u.email),
          total: users.length,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    // DELETE /api/receipts/:id - Delete receipt from D1 receipts table and update D1 backups
    if (url.pathname.startsWith('/api/receipts/') && request.method === 'DELETE') {
      try {
        const receiptId = decodeURIComponent(url.pathname.replace('/api/receipts/', '')).trim();
        const db = getD1Database(env);
        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          ''
        ).toLowerCase().trim();

        if (db && receiptId) {
          await ensureD1Tables(db);
          await db.prepare('DELETE FROM receipts WHERE id = ? OR receipt_number = ?').bind(receiptId, receiptId).run();

          if (userEmail) {
            try {
              const bRow: any = await db.prepare('SELECT backup_data FROM backups WHERE id = ?').bind(`user_${userEmail}`).first();
              if (bRow?.backup_data) {
                const bData = JSON.parse(bRow.backup_data);
                if (Array.isArray(bData.receipts)) {
                  bData.receipts = bData.receipts.filter((r: any) => r && r.id !== receiptId && r.receiptNumber !== receiptId);
                  await db.prepare('UPDATE backups SET backup_data = ?, updated_at = ? WHERE id = ?')
                    .bind(JSON.stringify(bData), new Date().toISOString(), `user_${userEmail}`).run();
                }
              }
            } catch (_) {}
          }
        }

        return new Response(
          JSON.stringify({ ok: true, success: true, message: `Receipt ${receiptId} deleted from D1` }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }
    if (false) {
      try {
        const receiptId = decodeURIComponent(url.pathname.replace('/api/receipts/', '')).trim();
        const db = getD1Database(env);
        const bucket = getR2Bucket(env);
        let receipt: any = null;

        if (db && receiptId) {
          try {
            await ensureD1Tables(db);
            const row: any = await db.prepare('SELECT data_json FROM receipts WHERE id = ?').bind(receiptId).first();
            if (row && row.data_json) {
              receipt = JSON.parse(row.data_json);
            }
          } catch (_) {}
        }

        if (!receipt && bucket && receiptId) {
          try {
            const obj = await bucket.get(`receipts/${encodeURIComponent(receiptId)}.json`);
            if (obj) {
              receipt = JSON.parse(await obj.text());
              if (db && receipt) {
                try {
                  await ensureD1Tables(db);
                  await db.prepare(`
                    INSERT INTO receipts (id, user_email, receipt_number, total, data_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json
                  `).bind(receiptId, receipt.userEmail || receipt.email || 'global', receipt.receiptNumber || receiptId, receipt.total || 0, JSON.stringify(receipt), receipt.createdAt || new Date().toISOString()).run();
                } catch (_) {}
              }
            }
          } catch (_) {}
        }

        const acceptHeader = request.headers.get('Accept') || '';
        if (acceptHeader.includes('application/json')) {
          if (receipt) {
            return new Response(JSON.stringify({ ok: true, success: true, receipt }), {
              status: 200,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
          return new Response(JSON.stringify({ ok: false, error: 'Receipt not found' }), {
            status: 404,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        const isInvoice = receipt?.documentType === 'invoice';
        const docTitle = isInvoice ? `Invoice #${receipt?.receiptNumber || receiptId}` : `Receipt #${receipt?.receiptNumber || receiptId}`;
        const bizName = receipt?.businessSnapshot?.name || 'Brivu Business';
        const currency = receipt?.businessSnapshot?.currency || 'UGX';
        const total = receipt?.total || 0;
        const amountPaid = receipt?.amountPaid || 0;
        const balance = receipt?.balance || (amountPaid - total);
        const items = Array.isArray(receipt?.items) ? receipt.items : [];

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${docTitle} | ${bizName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      min-height: 100vh;
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .receipt-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 1rem;
      max-width: 520px;
      width: 100%;
      padding: 2rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      margin-bottom: 1.5rem;
    }
    .header { text-align: center; border-bottom: 2px dashed #e2e8f0; padding-bottom: 1.5rem; margin-bottom: 1.25rem; }
    .logo { width: 64px; height: 64px; object-fit: contain; border-radius: 50%; margin: 0 auto 0.75rem; display: block; border: 1px solid #e2e8f0; background: #f1f5f9; }
    .biz-name { font-size: 1.25rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.025em; margin-bottom: 0.25rem; }
    .biz-meta { font-size: 0.8rem; color: #64748b; line-height: 1.4; }
    .badge {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      text-transform: uppercase;
      margin-top: 0.75rem;
    }
    .badge.invoice { background: #e0e7ff; color: #3730a3; }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.75rem;
      padding: 1rem;
      margin-bottom: 1.25rem;
      font-size: 0.85rem;
    }
    .meta-row { display: flex; justify-content: space-between; margin-bottom: 0.35rem; }
    .meta-row:last-child { margin-bottom: 0; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 600; text-align: right; }
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 1.25rem; font-size: 0.875rem; }
    .items-table th { background: #f1f5f9; color: #475569; font-weight: 600; text-align: left; padding: 0.65rem 0.75rem; border-bottom: 1px solid #cbd5e1; }
    .items-table th:last-child { text-align: right; }
    .items-table td { padding: 0.75rem; border-bottom: 1px solid #f1f5f9; color: #1e293b; }
    .items-table td:last-child { text-align: right; font-weight: 600; }
    .summary-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.75rem; padding: 1rem; margin-bottom: 1.25rem; font-size: 0.9rem; }
    .summary-row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
    .summary-row.total { font-size: 1.15rem; font-weight: 800; color: #0f172a; border-top: 1px solid #e2e8f0; padding-top: 0.65rem; margin-top: 0.5rem; }
    .footer-note { text-align: center; font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem; }
    .btn {
      display: block;
      width: 100%;
      background: #0f172a;
      color: #ffffff;
      text-align: center;
      padding: 0.85rem;
      border-radius: 0.75rem;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
      margin-top: 1rem;
      transition: background 0.2s;
      cursor: pointer;
      border: none;
    }
    .btn:hover { background: #1e293b; }
    .empty-state { text-align: center; padding: 3rem 1rem; color: #64748b; }
  </style>
</head>
<body>
  <div class="receipt-container">
    ${receipt ? `
      <div class="header">
        ${receipt.businessSnapshot?.logo ? `<img src="${receipt.businessSnapshot.logo}" class="logo" alt="Logo">` : ''}
        <div class="biz-name">${receipt.businessSnapshot?.name || 'Brivu Business'}</div>
        <div class="biz-meta">
          ${receipt.businessSnapshot?.address ? `${receipt.businessSnapshot.address}<br>` : ''}
          ${receipt.businessSnapshot?.phone ? `Tel: ${receipt.businessSnapshot.phone}` : ''}
          ${receipt.businessSnapshot?.taxNumber ? `<br>TIN/VAT: ${receipt.businessSnapshot.taxNumber}` : ''}
        </div>
        <div class="badge ${isInvoice ? 'invoice' : ''}">${isInvoice ? 'Official Invoice' : 'Verified Receipt'}</div>
      </div>

      <div class="meta-box">
        <div class="meta-row">
          <span class="label">${isInvoice ? 'Invoice No' : 'Receipt No'}</span>
          <span class="value">${receipt.receiptNumber || 'N/A'}</span>
        </div>
        <div class="meta-row">
          <span class="label">Date & Time</span>
          <span class="value">${receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : 'N/A'}</span>
        </div>
        ${receipt.customerName ? `
          <div class="meta-row">
            <span class="label">Customer</span>
            <span class="value">${receipt.customerName}</span>
          </div>
        ` : ''}
        ${receipt.customerPhone ? `
          <div class="meta-row">
            <span class="label">Cust Phone</span>
            <span class="value">${receipt.customerPhone}</span>
          </div>
        ` : ''}
        <div class="meta-row">
          <span class="label">Payment Method</span>
          <span class="value">${receipt.paymentMethod || 'Cash'}</span>
        </div>
        ${receipt.dueDate ? `
          <div class="meta-row">
            <span class="label">Due Date</span>
            <span class="value">${receipt.dueDate}</span>
          </div>
        ` : ''}
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Item / Description</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item: any) => `
            <tr>
              <td>
                <div style="font-weight: 600;">${item.name}</div>
                ${item.unitPrice ? `<div style="font-size: 0.75rem; color: #64748b;">${item.quantity} × ${currency} ${Number(item.unitPrice).toLocaleString()}</div>` : ''}
              </td>
              <td>${item.quantity || 1}</td>
              <td>${currency} ${Number(item.subtotal || (item.quantity * item.unitPrice) || 0).toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="summary-box">
        <div class="summary-row">
          <span class="label">Subtotal</span>
          <span class="value">${currency} ${Number(receipt.subtotal || 0).toLocaleString()}</span>
        </div>
        ${receipt.discountAmount && receipt.discountAmount > 0 ? `
          <div class="summary-row">
            <span class="label">Discount</span>
            <span class="value" style="color: #ef4444;">-${currency} ${Number(receipt.discountAmount).toLocaleString()}</span>
          </div>
        ` : ''}
        <div class="summary-row total">
          <span>TOTAL</span>
          <span>${currency} ${Number(receipt.total || 0).toLocaleString()}</span>
        </div>
        <div class="summary-row" style="margin-top: 0.5rem; font-size: 0.85rem;">
          <span class="label">Amount Paid</span>
          <span class="value">${currency} ${Number(receipt.amountPaid || 0).toLocaleString()}</span>
        </div>
        ${balance > 0 ? `
          <div class="summary-row" style="font-size: 0.85rem;">
            <span class="label">Change Due</span>
            <span class="value">${currency} ${Number(balance).toLocaleString()}</span>
          </div>
        ` : balance < 0 ? `
          <div class="summary-row" style="font-size: 0.85rem; color: #ef4444;">
            <span class="label">Balance Due</span>
            <span class="value">${currency} ${Number(Math.abs(balance)).toLocaleString()}</span>
          </div>
        ` : ''}
      </div>

      ${receipt.notes ? `
        <div style="background: #fefce8; border: 1px solid #fde047; border-radius: 0.75rem; padding: 0.85rem; font-size: 0.8rem; color: #854d0e; margin-bottom: 1.25rem;">
          <strong>Notes:</strong> ${receipt.notes}
        </div>
      ` : ''}

      <div class="footer-note">
        Receipt ID: ${receipt.id}<br>
        🔒 Securely Verified & Synced via Brivu Cloud
      </div>

      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    ` : `
      <div class="empty-state">
        <h2>Receipt Not Found</h2>
        <p style="margin-top: 0.5rem; font-size: 0.85rem;">The requested receipt or invoice record could not be found or has not been synchronized to cloud storage yet.</p>
        <a href="/" class="btn" style="margin-top: 1.5rem;">Return to Brivu</a>
      </div>
    `}
  </div>
</body>
</html>`;

        return new Response(html, {
          status: receipt ? 200 : 404,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/html; charset=utf-8',
          },
        });
      } catch (err: any) {
        return new Response('Error loading receipt: ' + String(err?.message || err), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain' },
        });
      }
    }

    // 2c. Single Receipt Sync endpoint (/api/receipts)
    if (url.pathname === '/api/receipts' && request.method === 'POST') {
      try {
        const db = getD1Database(env);
        const receipt: any = await request.json().catch(() => ({}));
        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          receipt?.userEmail ||
          url.searchParams.get('email') ||
          ''
        ).toLowerCase().trim() || 'global';

        if (receipt && receipt.id && db) {
          try {
            await ensureD1Tables(db);
            const items = Array.isArray(receipt.items) ? receipt.items : [];
            const compactItems = items.map((it: any) => ({
              n: it.name || it.description || '',
              q: Number(it.quantity || 1),
              p: Number(it.unitPrice || it.price || 0),
              t: Number(it.total || (it.quantity * it.unitPrice) || 0),
            }));
            const customerObj = receipt.customer || {
              name: receipt.customerName || '',
              phone: receipt.customerPhone || '',
              email: receipt.customerEmail || '',
            };
            const itemsJson = JSON.stringify(compactItems);
            const customerJson = JSON.stringify({
              name: customerObj.name || '',
              phone: customerObj.phone || '',
              email: customerObj.email || '',
            });

            // Compact data_json omitting base64/pdf bytes
            const compactData = {
              id: receipt.id,
              receiptNumber: receipt.receiptNumber || receipt.id,
              total: Number(receipt.total || 0),
              subtotal: Number(receipt.subtotal || 0),
              discountAmount: Number(receipt.discountAmount || 0),
              taxAmount: Number(receipt.taxAmount || 0),
              paymentMethod: receipt.paymentMethod || 'cash',
              currency: receipt.currency || 'UGX',
              items: compactItems,
              customer: customerObj,
              notes: receipt.notes || '',
              createdAt: receipt.createdAt || new Date().toISOString(),
            };

            await db.prepare(`
              INSERT INTO receipts (id, user_email, receipt_number, total, data_json, items_json, customer_json, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET 
                user_email = excluded.user_email,
                receipt_number = excluded.receipt_number,
                total = excluded.total,
                data_json = excluded.data_json,
                items_json = excluded.items_json,
                customer_json = excluded.customer_json
            `).bind(
              receipt.id,
              userEmail,
              receipt.receiptNumber || receipt.id,
              Number(receipt.total || 0),
              JSON.stringify(compactData),
              itemsJson,
              customerJson,
              receipt.createdAt || new Date().toISOString()
            ).run();

            // Also keep the user's backups record updated with this receipt
            if (userEmail && userEmail.includes('@') && !userEmail.startsWith('brivu-usr-')) {
              try {
                const bRow: any = await db.prepare('SELECT backup_data FROM backups WHERE id = ?').bind(`user_${userEmail}`).first();
                let bData: any = null;
                if (bRow?.backup_data) {
                  try { bData = JSON.parse(bRow.backup_data); } catch (_) {}
                }
                if (!bData) {
                  bData = {
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    profile: { name: '', currency: 'UGX' },
                    receipts: [],
                    inventoryProducts: [],
                    customers: [],
                  };
                }
                if (!Array.isArray(bData.receipts)) {
                  bData.receipts = [];
                }
                const existingIdx = bData.receipts.findIndex((r: any) => r.id === receipt.id || r.receiptNumber === receipt.receiptNumber);
                if (existingIdx >= 0) {
                  bData.receipts[existingIdx] = { ...bData.receipts[existingIdx], ...compactData };
                } else {
                  bData.receipts.unshift(compactData);
                }
                await db.prepare(`
                  INSERT INTO backups (id, user_email, backup_data, updated_at)
                  VALUES (?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    backup_data = excluded.backup_data,
                    user_email = excluded.user_email,
                    updated_at = excluded.updated_at
                `).bind(`user_${userEmail}`, userEmail, JSON.stringify(bData), new Date().toISOString()).run();
              } catch (bErr) {
                console.warn('Backup sync on receipt save note:', bErr);
              }
            }
          } catch (insertErr) {
            console.error('Error inserting receipt into D1:', insertErr);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, success: true, message: 'Receipt synchronized' }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 3. File Upload endpoint (/api/files/upload)
    if (url.pathname === '/api/files/upload' && request.method === 'POST') {
      try {
        const bucket = getR2Bucket(env);
        const db = getD1Database(env);
        const body: any = await request.json().catch(() => ({}));
        const { filename, data, mimeType = 'application/octet-stream', folder = 'receipts' } = body;

        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          body?.userEmail ||
          body?.email ||
          url.searchParams.get('email') ||
          ''
        ).toLowerCase().trim();

        if (!userEmail || !userEmail.includes('@') || userEmail.startsWith('brivu-usr-')) {
          return new Response(
            JSON.stringify({
              ok: false,
              success: false,
              error: 'Authentication required. File uploads are restricted to logged-in users with a valid email address.',
            }),
            { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        const lowerFolder = (folder || '').toLowerCase();
        const lowerFilename = (filename || '').toLowerCase();

        // Fixed key for logo and signature to prevent duplicate files
        const isSignature = lowerFolder === 'signatures' || lowerFilename.includes('signature');
        const isLogo = lowerFolder === 'photos' && (lowerFilename.includes('logo') || lowerFilename === 'logo.webp');

        let cleanFilename = (filename || `file_${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        let fileType = 'file';
        let key = '';

        if (isSignature && userEmail) {
          cleanFilename = 'signature.webp';
          fileType = 'signature';
          key = `users/${encodeURIComponent(userEmail)}/signature.webp`;
        } else if (isLogo && userEmail) {
          cleanFilename = 'logo.webp';
          fileType = 'logo';
          key = `users/${encodeURIComponent(userEmail)}/logo.webp`;
        } else {
          const userPrefix = userEmail ? `users/${encodeURIComponent(userEmail)}/` : '';
          key = `${userPrefix}${lowerFolder}/${Date.now()}_${cleanFilename}`;
        }

        const publicUrl = `${url.origin}/api/files/${encodeURIComponent(key)}`;

        // Calculate incoming size in bytes
        let incomingBytes = 0;
        if (typeof data === 'string') {
          const cleanBase64 = data.includes(',') ? data.split(',')[1] : data;
          incomingBytes = Math.round((cleanBase64.length * 3) / 4);
        } else if (data && typeof data === 'object' && 'byteLength' in data) {
          incomingBytes = (data as any).byteLength;
        }

        // Enforce 200 MB limit per user account / email
        if (userEmail) {
          const currentUsage = await getUserStorageUsageBytes(userEmail, env);
          if (currentUsage + incomingBytes > MAX_USER_STORAGE_BYTES) {
            const limitMB = 200;
            const usedMB = (currentUsage / (1024 * 1024)).toFixed(1);
            return new Response(
              JSON.stringify({
                ok: false,
                success: false,
                storageLimitExceeded: true,
                usedBytes: currentUsage,
                limitBytes: MAX_USER_STORAGE_BYTES,
                usedMB: Number(usedMB),
                limitMB,
                error: 'You have used up your 200mbs so delete some files that are nolonger needed to save new files',
                message: 'You have used up your 200mbs so delete some files that are nolonger needed to save new files',
              }),
              {
                status: 400,
                headers: {
                  ...CORS_HEADERS,
                  'Content-Type': 'application/json',
                },
              }
            );
          }
        }

        // Overwrite file in R2
        if (bucket) {
          const buffer = typeof data === 'string' ? decodeBase64ToUint8Array(data) : new Uint8Array(0);

          await bucket.put(key, buffer, {
            httpMetadata: { contentType: mimeType },
          });
        }

        // In D1: Store METADATA ONLY, NEVER store data_base64
        if (db) {
          try {
            await ensureD1Tables(db);
            // If signature or logo, purge old metadata records for this user
            if ((isSignature || isLogo) && userEmail) {
              await db.prepare('DELETE FROM files WHERE user_email = ? AND file_type = ?').bind(userEmail, fileType).run();
            }
            await db.prepare(`
              INSERT INTO files (id, user_email, filename, mime_type, size, r2_key, file_type, data_base64, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)
              ON CONFLICT(id) DO UPDATE SET 
                user_email = excluded.user_email,
                filename = excluded.filename,
                mime_type = excluded.mime_type,
                size = excluded.size,
                r2_key = excluded.r2_key,
                file_type = excluded.file_type,
                data_base64 = NULL,
                created_at = excluded.created_at
            `).bind(
              key,
              userEmail || null,
              cleanFilename,
              mimeType,
              incomingBytes,
              key,
              fileType,
              new Date().toISOString()
            ).run();
          } catch (d1Err) {
            console.warn('D1 file metadata note:', d1Err);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            url: publicUrl,
            key,
            filename: cleanFilename,
            size: incomingBytes,
            message: `File ${cleanFilename} saved to Cloudflare`,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            ok: false,
            success: false,
            error: String(err?.message || err),
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    }

    // 3b. File Listing endpoint (GET /api/files)
    if ((url.pathname === '/api/files' || url.pathname === '/api/files/') && request.method === 'GET') {
      const bucket = getR2Bucket(env);
      const db = getD1Database(env);
      const userEmail = (
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        url.searchParams.get('email') ||
        url.searchParams.get('user_id') ||
        ''
      ).toLowerCase().trim();
      const prefixParam = url.searchParams.get('prefix') || '';
      const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

      const files: any[] = [];
      const seenKeys = new Set<string>();

      const isSystemBackupFile = (k: string) => {
        const lower = k.toLowerCase();
        return (
          lower.endsWith('backup.json') ||
          lower.endsWith('latest_backup.json') ||
          lower.endsWith('data.json') ||
          lower.endsWith('profile.json') ||
          lower.endsWith('all_users.json')
        );
      };

      const parseFileRecord = (key: string, size: number, mimeType: string, uploadedAt: string) => {
        const parts = key.split('/');
        let folder = 'files';
        let rawFilename = parts[parts.length - 1] || key;
        if (key.startsWith('users/') && parts.length >= 4) {
          folder = parts[2];
          rawFilename = parts.slice(3).join('_');
        } else if (parts.length > 1) {
          folder = parts[parts.length - 2];
        }
        const cleanFilename = rawFilename.replace(/^\d+_/, '');
        return {
          key,
          filename: cleanFilename,
          size,
          mimeType,
          uploadedAt,
          url: `${url.origin}/api/files/${encodeURIComponent(key)}`,
          folder,
        };
      };

      // If no user email provided, return empty files list to prevent data leakage
      if (!userEmail) {
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            files: [],
            count: 0,
            message: 'User email is required to list files',
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      // 1. Fetch from R2 if bucket is bound strictly for this user email
      if (bucket && typeof bucket.list === 'function') {
        try {
          const listPrefixes: string[] = [
            `users/${encodeURIComponent(userEmail)}/`,
            `users/${userEmail}/`,
          ];
          if (prefixParam && prefixParam.startsWith('users/')) {
            listPrefixes.push(prefixParam);
          }

          for (const pfx of listPrefixes) {
            const listed = await bucket.list({ prefix: pfx, limit });
            if (listed && Array.isArray(listed.objects)) {
              for (const obj of listed.objects) {
                if (isSystemBackupFile(obj.key)) continue;
                if (!seenKeys.has(obj.key)) {
                  seenKeys.add(obj.key);
                  files.push(
                    parseFileRecord(
                      obj.key,
                      obj.size || 0,
                      obj.httpMetadata?.contentType || 'application/octet-stream',
                      obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString()
                    )
                  );
                }
              }
            }
          }
        } catch (r2Err) {
          console.warn('R2 file list note:', r2Err);
        }
      }

      // 2. Also check D1 if db is bound strictly for this user email
      if (db) {
        try {
          await ensureD1Tables(db);
          let query = 'SELECT id, filename, mime_type, size, created_at FROM files';
          const params: any[] = [];
          const whereClauses: string[] = [
            '(user_email = ? OR id LIKE ? OR id LIKE ?)'
          ];
          params.push(userEmail);
          params.push(`users/${encodeURIComponent(userEmail)}/%`);
          params.push(`users/${userEmail}/%`);

          if (whereClauses.length > 0) {
            query += ' WHERE ' + whereClauses.join(' AND ');
          }
          query += ' ORDER BY created_at DESC LIMIT ?';
          params.push(limit);

          const rows: any = await db.prepare(query).bind(...params).all();
          if (rows && Array.isArray(rows.results)) {
            for (const row of rows.results) {
              if (isSystemBackupFile(row.id)) continue;
              if (!seenKeys.has(row.id)) {
                seenKeys.add(row.id);
                files.push(
                  parseFileRecord(
                    row.id,
                    row.size || 0,
                    row.mime_type || 'application/octet-stream',
                    row.created_at || new Date().toISOString()
                  )
                );
              }
            }
          }
        } catch (d1Err) {
          console.warn('D1 file list note:', d1Err);
        }
      }

      const totalUsedBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
      const isExceeded = totalUsedBytes >= MAX_USER_STORAGE_BYTES;
      const percent = Math.min(100, Math.round((totalUsedBytes / MAX_USER_STORAGE_BYTES) * 100));

      return new Response(
        JSON.stringify({
          ok: true,
          success: true,
          files,
          total: files.length,
          usedBytes: totalUsedBytes,
          limitBytes: MAX_USER_STORAGE_BYTES,
          usedMB: Number((totalUsedBytes / (1024 * 1024)).toFixed(2)),
          limitMB: 200,
          percent,
          isExceeded,
          warning: isExceeded
            ? 'You have used up your 200mbs so delete some files that are nolonger needed to save new files'
            : null,
          d1Bound: Boolean(db),
          r2Bound: Boolean(bucket),
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // 3c. Storage Quota endpoint (/api/storage/quota)
    if (url.pathname === '/api/storage/quota' && request.method === 'GET') {
      try {
        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          ''
        ).toLowerCase().trim();

        const usedBytes = await getUserStorageUsageBytes(userEmail, env);
        const limitBytes = MAX_USER_STORAGE_BYTES;
        const isExceeded = usedBytes >= limitBytes;
        const percent = Math.min(100, Math.round((usedBytes / limitBytes) * 100));

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            userEmail,
            usedBytes,
            limitBytes,
            usedMB: Number((usedBytes / (1024 * 1024)).toFixed(2)),
            limitMB: 200,
            percent,
            isExceeded,
            warning: isExceeded
              ? 'You have used up your 200mbs so delete some files that are nolonger needed to save new files'
              : null,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 4. File Download & Delete endpoint (/api/files/:key)
    if (url.pathname.startsWith('/api/files/')) {
      const bucket = getR2Bucket(env);
      const db = getD1Database(env);
      const key = decodeURIComponent(url.pathname.replace('/api/files/', ''));

      // Delete file
      if (request.method === 'DELETE') {
        let deletedR2 = false;
        let deletedD1 = false;
        const decodedKey = decodeURIComponent(key);
        const encodedKey = encodeURIComponent(decodedKey);

        if (bucket && key) {
          try {
            await bucket.delete(key);
            if (decodedKey !== key) await bucket.delete(decodedKey).catch(() => {});
            deletedR2 = true;
          } catch {}
        }
        if (db && key) {
          try {
            await ensureD1Tables(db);
            await db.prepare(`
              DELETE FROM files 
              WHERE id = ? OR r2_key = ? OR id = ? OR r2_key = ? OR id LIKE ? OR r2_key LIKE ?
            `).bind(key, key, decodedKey, decodedKey, `%${decodedKey.split('/').pop() || decodedKey}%`, `%${decodedKey.split('/').pop() || decodedKey}%`).run();
            deletedD1 = true;
          } catch {}
        }
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: `File ${key} deleted`,
            deletedR2,
            deletedD1,
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      // Get/Serve file
      const rawKey = url.pathname.replace('/api/files/', '');
      const candidateKeys = Array.from(
        new Set(
          [
            key,
            rawKey,
            (() => {
              try {
                return decodeURIComponent(key);
              } catch {
                return key;
              }
            })(),
            key.replace(/%40/gi, '@'),
            key.replace(/@/g, '%40'),
          ].filter(Boolean)
        )
      );

      if (bucket && candidateKeys.length > 0) {
        for (const k of candidateKeys) {
          try {
            const object = await bucket.get(k);
            if (object) {
              const headers = new Headers(CORS_HEADERS);
              object.writeHttpMetadata(headers);
              headers.set('etag', object.httpEtag);
              return new Response(object.body, { headers });
            }
          } catch {}
        }
      }

      if (db && candidateKeys.length > 0) {
        try {
          await ensureD1Tables(db);
          for (const k of candidateKeys) {
            const row: any = await db
              .prepare('SELECT data_base64, mime_type FROM files WHERE id = ? OR r2_key = ?')
              .bind(k, k)
              .first();
            if (row && row.data_base64) {
              const buffer = decodeBase64ToUint8Array(row.data_base64);
              return new Response(buffer, {
                headers: {
                  ...CORS_HEADERS,
                  'Content-Type': row.mime_type || 'application/octet-stream',
                },
              });
            }
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'File not found' }),
        {
          status: 404,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // 5. QR Page Save endpoint (/api/qr)
    if (url.pathname === '/api/qr' && request.method === 'POST') {
      try {
        const db = getD1Database(env);
        const page: any = await request.json().catch(() => ({}));
        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          page?.userEmail ||
          page?.email ||
          ''
        ).toLowerCase().trim();

        if (!userEmail || !userEmail.includes('@') || userEmail.startsWith('brivu-usr-')) {
          return new Response(
            JSON.stringify({ ok: false, error: 'Authentication required. Saving QR pages is restricted to logged-in users with a valid email.' }),
            { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // Determine category: canonical types (business, events, socials, websites) + single events
        const rawType = (page?.pageType || '').toLowerCase();
        const rawPageId = (page?.id || '').toLowerCase();
        let category: 'business' | 'events' | 'socials' | 'websites' = 'business';
        if (rawType.includes('website') || rawPageId.includes('website') || rawType === 'websites_hub') {
          category = 'websites';
        } else if (rawType.includes('social') || rawPageId.includes('social') || rawType === 'socials_hub') {
          category = 'socials';
        } else if (rawType.includes('event') || rawPageId.includes('event') || rawType === 'events_hub') {
          category = 'events';
        }

        const isSingleEvent =
          category === 'events' &&
          (rawType === 'event' || (rawPageId.startsWith('event-') && !rawPageId.startsWith('events-hub') && !rawPageId.startsWith('event-hub')));
        const canonicalId = isSingleEvent
          ? `user_${userEmail}_event_${String(page?.id || 'item').trim()}`
          : `user_${userEmail}_${category}`;

        let existing: any = null;
        let existingParsedPage: any = null;
        if (db) {
          await ensureD1Tables(db);
          existing = await db.prepare('SELECT content_hash, page_json FROM qr_pages WHERE id = ?').bind(canonicalId).first();
          if (existing?.page_json) {
            try {
              existingParsedPage = JSON.parse(existing.page_json);
            } catch (_) {}
          }
        }

        // Only skip empty template saves when creating a brand-new row; allow explicit updates to existing rows (e.g. deletions)
        const hasPageContent = hasRealQrPageContent(page);
        if (!hasPageContent && !existing) {
          return new Response(
            JSON.stringify({ ok: true, success: true, skipped: true, message: 'QR page contains default template data. Save skipped until content is added.' }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // Guard against sparse/photo-recovery payloads overwriting rich business QR text/menu/social fields in D1
        let pageToSanitize = {
          ...page,
          id: isSingleEvent ? (page?.id || canonicalId) : canonicalId,
          userEmail,
          email: page?.email || userEmail,
        };
        if (page?.preserveExistingIfEmpty && existingParsedPage && typeof existingParsedPage === 'object') {
          const hasMeaningfulTitle = (t?: string) => Boolean(t && t.trim() && t.trim() !== 'Brivu Business' && t.trim() !== 'My Business' && !t.trim().endsWith("'s Business"));
          pageToSanitize = {
            ...existingParsedPage,
            ...pageToSanitize,
            title: hasMeaningfulTitle(pageToSanitize.title) ? pageToSanitize.title : (existingParsedPage.title || pageToSanitize.title),
            tagline: pageToSanitize.tagline || existingParsedPage.tagline || '',
            description: pageToSanitize.description || existingParsedPage.description || '',
            phone: pageToSanitize.phone || existingParsedPage.phone || '',
            whatsapp: pageToSanitize.whatsapp || existingParsedPage.whatsapp || '',
            address: pageToSanitize.address || existingParsedPage.address || '',
            openingHours: pageToSanitize.openingHours || existingParsedPage.openingHours || '',
            wifiName: pageToSanitize.wifiName || existingParsedPage.wifiName,
            wifiPassword: pageToSanitize.wifiPassword || existingParsedPage.wifiPassword,
            announcement: pageToSanitize.announcement || existingParsedPage.announcement || '',
            coverImage: pageToSanitize.coverImage || existingParsedPage.coverImage,
            logo: pageToSanitize.logo || existingParsedPage.logo,
            photos: Array.isArray(pageToSanitize.photos) && pageToSanitize.photos.length > 0 ? pageToSanitize.photos : (existingParsedPage.photos || []),
            menuCategories: Array.isArray(pageToSanitize.menuCategories) && pageToSanitize.menuCategories.length > 1 ? pageToSanitize.menuCategories : (existingParsedPage.menuCategories || ['All']),
            menuItems: Array.isArray(pageToSanitize.menuItems) && pageToSanitize.menuItems.length > 0
              ? pageToSanitize.menuItems
              : (Array.isArray(existingParsedPage.menuItems)
                  ? existingParsedPage.menuItems.filter((i: any) => i && !String(i.id || '').startsWith('prod-'))
                  : []),
            customSocialLinks: Array.isArray(pageToSanitize.customSocialLinks) && pageToSanitize.customSocialLinks.length > 0 ? pageToSanitize.customSocialLinks : existingParsedPage.customSocialLinks,
            socialLinks: { ...(existingParsedPage.socialLinks || {}), ...(pageToSanitize.socialLinks || {}) },
            websitesQrItems: Array.isArray(pageToSanitize.websitesQrItems) && pageToSanitize.websitesQrItems.length > 0 ? pageToSanitize.websitesQrItems : (existingParsedPage.websitesQrItems || []),
            socialsQrItems: Array.isArray(pageToSanitize.socialsQrItems) && pageToSanitize.socialsQrItems.length > 0 ? pageToSanitize.socialsQrItems : (existingParsedPage.socialsQrItems || []),
            eventsQrItems: Array.isArray(pageToSanitize.eventsQrItems) && pageToSanitize.eventsQrItems.length > 0 ? pageToSanitize.eventsQrItems : (existingParsedPage.eventsQrItems || []),
          };
        }

        const sanitized = sanitizePublicQrPage(pageToSanitize);
        const sanitizedJson = JSON.stringify(sanitized);

        // Compute fast content hash (SHA-256) to eliminate redundant writes
        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sanitizedJson));
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

        if (db) {
          const isSpecificBizPage =
            category === 'business' &&
            page?.id &&
            rawPageId !== 'default' &&
            rawPageId !== 'latest' &&
            rawPageId !== 'business' &&
            rawPageId !== 'business-latest' &&
            !rawPageId.startsWith('business-hub-');
          const specificBizKey = isSpecificBizPage ? `user_${userEmail}_biz_${String(page.id).trim()}` : '';

          if (existing?.content_hash === hashHex && !specificBizKey) {
            return new Response(
              JSON.stringify({
                ok: true,
                success: true,
                unchanged: true,
                message: `QR page ${category} unchanged (write skipped)`,
                data: { page: sanitized },
              }),
              { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
            );
          }

          const now = new Date().toISOString();
          if (existing?.content_hash !== hashHex) {
            await db.prepare(`
              INSERT INTO qr_pages (id, user_email, page_json, content_hash, updated_at)
              VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET 
                user_email = excluded.user_email,
                page_json = excluded.page_json,
                content_hash = excluded.content_hash,
                updated_at = excluded.updated_at
            `).bind(canonicalId, userEmail, sanitizedJson, hashHex, now).run();
          }

          if (specificBizKey) {
            const specificExisting: any = await db.prepare('SELECT content_hash FROM qr_pages WHERE id = ?').bind(specificBizKey).first();
            if (specificExisting?.content_hash !== hashHex) {
              await db.prepare(`
                INSERT INTO qr_pages (id, user_email, page_json, content_hash, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                  user_email = excluded.user_email,
                  page_json = excluded.page_json,
                  content_hash = excluded.content_hash,
                  updated_at = excluded.updated_at
              `).bind(specificBizKey, userEmail, sanitizedJson, hashHex, now).run();
            }
          }
          invalidateCachePattern(`qrCache:`);
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: `QR page ${category} saved in D1`,
            data: { page: sanitized },
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, success: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6. QR Page Fetch endpoint (/api/qr/:pageId)
    if (url.pathname.startsWith('/api/qr/')) {
      const pageId = decodeURIComponent(url.pathname.replace('/api/qr/', '')).trim();
      const userEmail = (
        url.searchParams.get('email') ||
        url.searchParams.get('u') ||
        url.searchParams.get('user') ||
        url.searchParams.get('user_id') ||
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        ''
      ).toLowerCase().trim();

      const page = await resolveHostedQrPage(env, pageId, userEmail, {
        skipCache: url.searchParams.has('_t') || url.searchParams.has('verify'),
      });

      if (page) {
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            isEmptyFallback: Boolean(page.isEmptyFallback),
            data: { page },
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'QR Page not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 6.5. Live Stock Catalog Publish endpoint (/api/catalog/publish or legacy /api/store/publish)
    if (
      (url.pathname === '/api/catalog/publish' || url.pathname === '/api/store/publish') &&
      request.method === 'POST'
    ) {
      try {
        const body: any = await request.json().catch(() => ({}));
        const rawSlug = String(body?.slug || body?.settings?.slug || body?.payload?.settings?.slug || '').trim().toLowerCase();
        const slug = sanitizePublicStoreSlug(rawSlug || 'store');
        const payload = body?.payload || body;
        const catalogIdOverride = String(
          body?.catalogId || payload?.settings?.catalogId || url.searchParams.get('catalogId') || ''
        ).trim();

        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          body?.userEmail ||
          body?.email ||
          payload?.settings?.email ||
          payload?.business?.email ||
          ''
        ).toLowerCase().trim();

        const db = getD1Database(env);
        const now = new Date().toISOString();

        let savedSlug = slug;
        let savedCatalogId = catalogIdOverride || deriveFallbackCatalogId(userEmail || slug, slug);
        if (db) {
          const saved = await upsertUserStoreCatalog(db, userEmail, slug, payload, now, catalogIdOverride || undefined);
          savedSlug = saved.slug;
          savedCatalogId = saved.catalogId;
        }

        const qs = new URLSearchParams();
        if (savedSlug) qs.set('slug', savedSlug);
        if (userEmail && userEmail.includes('@') && !userEmail.startsWith('brivu-usr-')) {
          qs.set('email', userEmail);
        }
        const publicUrl = `/catalog/${encodeURIComponent(savedCatalogId)}${qs.toString() ? `?${qs.toString()}` : ''}`;

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            slug: savedSlug,
            catalogId: savedCatalogId,
            userEmail,
            url: publicUrl,
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: err?.message || 'Failed to publish store catalog' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 6.6. Live Stock Catalog Fetch endpoint (/api/catalog/:catalogId & /api/store/:slug) - PUBLIC NO AUTH REQUIRED
    if (
      url.pathname === '/api/catalog' ||
      url.pathname.startsWith('/api/catalog/') ||
      url.pathname === '/api/store' ||
      url.pathname.startsWith('/api/store/')
    ) {
      const isCatalogEndpoint = url.pathname === '/api/catalog' || url.pathname.startsWith('/api/catalog/');
      let catalogIdParam = (url.searchParams.get('catalogId') || url.searchParams.get('catalog') || '').trim();
      let rawSlug = (url.searchParams.get('slug') || url.searchParams.get('store') || '').trim().toLowerCase();

      if (isCatalogEndpoint) {
        const seg = url.pathname === '/api/catalog'
          ? ''
          : decodeURIComponent(url.pathname.replace('/api/catalog/', '').split('/')[0] || '').trim();
        if (seg && !catalogIdParam) {
          catalogIdParam = seg;
        }
      } else {
        const seg = url.pathname === '/api/store'
          ? 'store'
          : decodeURIComponent(url.pathname.replace('/api/store/', '').split('/')[0] || '').trim().toLowerCase();
        if (seg && !rawSlug) {
          rawSlug = seg;
        }
      }

      const slug = sanitizePublicStoreSlug(rawSlug || 'store');
      const userEmail = (
        url.searchParams.get('email') ||
        url.searchParams.get('u') ||
        url.searchParams.get('user') ||
        url.searchParams.get('user_id') ||
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        ''
      ).toLowerCase().trim();

      const data = await resolvePublicStoreCatalog(env, slug, userEmail, catalogIdParam || undefined);
      if (data) {
        return new Response(
          JSON.stringify({ ok: true, success: true, data }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: `Catalog "${catalogIdParam || slug}" not found` }),
        {
          status: 404,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        }
      );
    }

    // 7. Data Sync Push endpoint (/api/sync/push)
    if (url.pathname === '/api/sync/push' && request.method === 'POST') {
      try {
        const db = getD1Database(env);
        const body: any = await request.json().catch(() => ({}));
        const backupData = body?.backupData || body;

        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          body?.userEmail ||
          body?.user_id ||
          body?.email ||
          body?.user?.email ||
          backupData?.profile?.email ||
          ''
        ).toLowerCase().trim();

        // 1. REJECT UNAUTHENTICATED OR GUEST SYNC REQUESTS
        if (!userEmail || !userEmail.includes('@') || userEmail.startsWith('brivu-usr-') || userEmail.includes('default_user')) {
          return new Response(
            JSON.stringify({
              ok: false,
              success: false,
              error: 'Authentication required. Server sync is restricted to logged-in users with a valid email address.',
            }),
            { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // 2. CHECK IF USER HAS REAL CONTENT (Do not write empty default backups/qr_pages rows)
        const hasRealContent = hasRealUserContent(backupData);

        if (!hasRealContent) {
          return new Response(
            JSON.stringify({
              ok: true,
              success: true,
              skipped: true,
              message: 'User has no real content yet. Server backups/qr_pages write skipped until content is created.',
            }),
            { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        if (backupData && db) {
          const backupJson = JSON.stringify(backupData);
          const now = new Date().toISOString();

          await ensureD1Tables(db);

          // Fast short-circuit if backup_data is completely identical AND qr_pages & store_catalogs already populated
          let existingBackupRow: any = null;
          let existingQrRow: any = null;
          let existingStoreRow: any = null;
          const hasInventoryProducts = Array.isArray(backupData.inventoryProducts) && backupData.inventoryProducts.length > 0;
          try {
            existingBackupRow = await db.prepare('SELECT backup_data FROM backups WHERE id = ?').bind(`user_${userEmail}`).first();
            existingQrRow = await db.prepare('SELECT id FROM qr_pages WHERE user_email = ? LIMIT 1').bind(userEmail).first();
            if (hasInventoryProducts) {
              existingStoreRow = await db.prepare('SELECT slug FROM store_catalogs WHERE LOWER(user_email) = ? LIMIT 1').bind(userEmail).first();
            }
          } catch (_) {}

          if (existingBackupRow?.backup_data === backupJson && existingQrRow?.id && (!hasInventoryProducts || existingStoreRow?.slug)) {
            return new Response(
              JSON.stringify({
                ok: true,
                success: true,
                unchanged: true,
                d1Saved: true,
                r2Saved: false,
                message: 'Cloud records already up to date',
                timestamp: now,
              }),
              { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
            );
          }

          const batchStatements: any[] = [];

          // 1. User record
          batchStatements.push(
            db.prepare(`
              INSERT INTO users (id, email, name, provider, created_at, updated_at, last_login)
              VALUES (?, ?, ?, 'google', ?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET 
                last_login = excluded.last_login,
                updated_at = excluded.updated_at
            `).bind(userEmail, userEmail, userEmail.split('@')[0], now, now, now)
          );

          // 2. Single canonical backup row per user
          batchStatements.push(
            db.prepare(`
              INSERT INTO backups (id, user_email, backup_data, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET 
                backup_data = excluded.backup_data,
                user_email = excluded.user_email,
                updated_at = excluded.updated_at
            `).bind(`user_${userEmail}`, userEmail, backupJson, now)
          );

          // 3. Batch Receipts
          if (Array.isArray(backupData.receipts)) {
            for (const r of backupData.receipts) {
              if (r && r.id) {
                const items = Array.isArray(r.items) ? r.items : [];
                const compactItems = items.map((it: any) => ({
                  n: it.name || it.description || '',
                  q: Number(it.quantity || 1),
                  p: Number(it.unitPrice || it.price || 0),
                  t: Number(it.total || (it.quantity * it.unitPrice) || 0),
                }));
                const cust = r.customer || {
                  name: r.customerName || '',
                  phone: r.customerPhone || '',
                  email: r.customerEmail || '',
                };
                const itemsJson = JSON.stringify(compactItems);
                const customerJson = JSON.stringify({
                  name: cust.name || '',
                  phone: cust.phone || '',
                  email: cust.email || '',
                });
                const compactData = {
                  id: r.id,
                  receiptNumber: r.receiptNumber || r.id,
                  total: Number(r.total || 0),
                  subtotal: Number(r.subtotal || 0),
                  discountAmount: Number(r.discountAmount || 0),
                  taxAmount: Number(r.taxAmount || 0),
                  paymentMethod: r.paymentMethod || 'cash',
                  currency: r.currency || 'UGX',
                  items: compactItems,
                  customer: cust,
                  notes: r.notes || '',
                  createdAt: r.createdAt || now,
                };
                batchStatements.push(
                  db.prepare(`
                    INSERT INTO receipts (id, user_email, receipt_number, total, data_json, items_json, customer_json, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                      total = excluded.total,
                      data_json = excluded.data_json,
                      items_json = excluded.items_json,
                      customer_json = excluded.customer_json
                  `).bind(
                    r.id,
                    userEmail,
                    r.receiptNumber || r.id,
                    Number(r.total || 0),
                    JSON.stringify(compactData),
                    itemsJson,
                    customerJson,
                    r.createdAt || now
                  )
                );
              }
            }
          }

          // 4. Batch Products
          const productsList = Array.isArray(backupData.inventoryProducts)
            ? backupData.inventoryProducts
            : (Array.isArray(backupData.products) ? backupData.products : []);
          for (const p of productsList) {
            if (p && p.id) {
              batchStatements.push(
                db.prepare(`
                  INSERT INTO products (id, shop_id, name, barcode, category, selling_price, cost_price, stock_quantity, image, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    name = excluded.name,
                    barcode = excluded.barcode,
                    category = excluded.category,
                    selling_price = excluded.selling_price,
                    cost_price = excluded.cost_price,
                    stock_quantity = excluded.stock_quantity,
                    image = excluded.image,
                    updated_at = excluded.updated_at
                `).bind(
                  p.id,
                  userEmail,
                  p.name || 'Unnamed Product',
                  p.itemId || p.barcode || null,
                  p.category || 'General',
                  Number(p.sellingPrice || p.price || 0),
                  Number(p.costPrice || 0),
                  Number(p.quantity ?? p.stockQuantity ?? p.stock ?? 0),
                  p.image || null,
                  now
                )
              );
            }
          }

          // 5. Shopping List
          const shoppingList = Array.isArray(backupData.shoppingList)
            ? backupData.shoppingList
            : (Array.isArray(backupData.shopping)
              ? backupData.shopping
              : (Array.isArray(backupData.shoppingListItems) ? backupData.shoppingListItems : []));
          if (shoppingList.length > 0) {
            batchStatements.push(
              db.prepare(`
                INSERT INTO shopping_lists (id, user_email, title, items_json, total_estimated, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                ON CONFLICT(id) DO UPDATE SET 
                  items_json = excluded.items_json,
                  total_estimated = excluded.total_estimated,
                  updated_at = excluded.updated_at
              `).bind(`shop_${userEmail}`, userEmail, 'My Shopping List', JSON.stringify(shoppingList), 0, now, now)
            );
          }

          // 6. Batch Staff Directory
          const staffList = Array.isArray(backupData.staff)
            ? backupData.staff
            : (Array.isArray(backupData.workers) ? backupData.workers : []);
          for (const s of staffList) {
            if (s && (s.id || s.name)) {
              const staffId = s.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              batchStatements.push(
                db.prepare(`
                  INSERT INTO staff_directory (id, user_email, name, role, phone, email, hourly_rate, notes, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    name = excluded.name,
                    role = excluded.role,
                    phone = excluded.phone,
                    email = excluded.email,
                    hourly_rate = excluded.hourly_rate,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                `).bind(
                  staffId,
                  userEmail,
                  s.name || 'Staff Member',
                  s.role || null,
                  s.phone || null,
                  s.email || null,
                  Number(s.hourlyRate || s.rate || 0),
                  s.notes || null,
                  now
                )
              );
            }
          }

          // 7. Batch Client Directory
          const clientList = Array.isArray(backupData.clients)
            ? backupData.clients
            : (Array.isArray(backupData.customers) ? backupData.customers : []);
          for (const c of clientList) {
            if (c && (c.id || c.name)) {
              const clientId = c.id || `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              batchStatements.push(
                db.prepare(`
                  INSERT INTO client_directory (id, user_email, name, phone, email, address, notes, updated_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET 
                    name = excluded.name,
                    phone = excluded.phone,
                    email = excluded.email,
                    address = excluded.address,
                    notes = excluded.notes,
                    updated_at = excluded.updated_at
                `).bind(
                  clientId,
                  userEmail,
                  c.name || 'Client',
                  c.phone || null,
                  c.email || null,
                  c.address || null,
                  c.notes || null,
                  now
                )
              );
            }
          }

          await executeD1Batch(db, batchStatements, 40);

          // 8. Update canonical QR records safely (reading from qrHostedPages first so photos & styling are NEVER overwritten)
          const profile = backupData.profile || {};
          const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');
          const incomingPages = Array.isArray(backupData.qrHostedPages) ? backupData.qrHostedPages : [];

          const incomingWebHub = incomingPages.find((p: any) => p && (p.pageType === 'websites_hub' || String(p.id || '').includes('websites-hub')));
          const syncWebItems = Array.isArray(backupData.websitesQrItems) && backupData.websitesQrItems.length > 0
            ? backupData.websitesQrItems
            : (Array.isArray(incomingWebHub?.websitesQrItems) ? incomingWebHub.websitesQrItems : []);
          if (syncWebItems.length > 0) {
            const webPage = {
              ...(incomingWebHub || {}),
              title: incomingWebHub?.title || 'Our Sites',
              description: incomingWebHub?.description || `Official web links and verified online apps directory for ${profile.name || 'our company'}.`,
              pageType: 'websites_hub',
              accentColor: '#2563eb',
              theme: 'indigo',
              logo: incomingWebHub?.logo || profile.logo,
              phone: incomingWebHub?.phone || profile.phone || '',
              whatsapp: incomingWebHub?.whatsapp || cleanWa,
              email: incomingWebHub?.email || profile.email || userEmail,
              address: incomingWebHub?.address || profile.address || '',
              currency: incomingWebHub?.currency || profile.currency || 'USD',
              websitesQrItems: syncWebItems,
              menuCategories: ['Our Sites'],
              menuItems: syncWebItems.map((w: any) => ({
                id: `web-${w.id}`,
                name: w.title,
                category: 'Our Sites',
                price: 0,
                description: w.description || w.url,
                url: w.url,
                ctaText: w.ctaText || 'Visit Website',
                itemType: w.type,
                phone: w.phone,
                phoneAction: w.phoneAction,
              })),
            };
            await saveCanonicalQrPage(db, userEmail, 'websites', webPage, { preserveExistingIfEmpty: true });
          }

          const incomingSocHub = incomingPages.find((p: any) => p && (p.pageType === 'socials_hub' || String(p.id || '').includes('socials-hub')));
          const syncSocItems = Array.isArray(backupData.socialsQrItems) && backupData.socialsQrItems.length > 0
            ? backupData.socialsQrItems
            : (Array.isArray(incomingSocHub?.socialsQrItems) ? incomingSocHub.socialsQrItems : []);
          if (syncSocItems.length > 0) {
            const socPage = {
              ...(incomingSocHub || {}),
              title: incomingSocHub?.title || 'our social media platforms',
              tagline: incomingSocHub?.tagline || 'Connect Across All Official Social Channels & Messaging Apps',
              description: incomingSocHub?.description || `Official social media profiles and community links for ${profile.name || 'our brand'}.`,
              pageType: 'socials_hub',
              accentColor: '#059669',
              theme: 'emerald',
              logo: incomingSocHub?.logo || profile.logo,
              phone: incomingSocHub?.phone || profile.phone || '',
              whatsapp: incomingSocHub?.whatsapp || cleanWa,
              email: incomingSocHub?.email || profile.email || userEmail,
              address: incomingSocHub?.address || profile.address || '',
              currency: incomingSocHub?.currency || profile.currency || 'USD',
              socialsQrItems: syncSocItems,
              menuCategories: ['Official Social Media & Messaging'],
              menuItems: syncSocItems.map((s: any) => ({
                id: `social-${s.id}`,
                name: s.title || s.customPlatformName || s.platform,
                category: 'Official Social Media & Messaging',
                price: 0,
                description: s.prefilledMessage || s.fullUrl,
                url: s.fullUrl,
                ctaText: s.ctaText || 'Connect',
                itemType: s.platform,
              })),
            };
            await saveCanonicalQrPage(db, userEmail, 'socials', socPage, { preserveExistingIfEmpty: true });
          }

          const incomingEvtHub = incomingPages.find((p: any) => p && (p.pageType === 'events_hub' || String(p.id || '').includes('events-hub')));
          const syncEvtItems = Array.isArray(backupData.eventsQrItems) && backupData.eventsQrItems.length > 0
            ? backupData.eventsQrItems
            : (Array.isArray(incomingEvtHub?.eventsQrItems) ? incomingEvtHub.eventsQrItems : []);
          if (syncEvtItems.length > 0) {
            const evtPage = {
              ...(incomingEvtHub || {}),
              title: incomingEvtHub?.title || 'Our Events',
              description: incomingEvtHub?.description || `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
              pageType: 'events_hub',
              accentColor: incomingEvtHub?.accentColor || '#7c3aed',
              theme: 'indigo',
              logo: incomingEvtHub?.logo || profile.logo,
              phone: incomingEvtHub?.phone || profile.phone || '',
              whatsapp: incomingEvtHub?.whatsapp || cleanWa,
              email: incomingEvtHub?.email || profile.email || userEmail,
              address: incomingEvtHub?.address || profile.address || '',
              currency: incomingEvtHub?.currency || profile.currency || 'UGX',
              announcement: '',
              eventsQrItems: syncEvtItems,
              menuCategories: ['Our Events'],
              menuItems: syncEvtItems.map((e: any) => {
                const isWa = Boolean(e?.rsvpUrl && /wa\.me\/|whatsapp\.com\//i.test(String(e.rsvpUrl)));
                const rawSite = String(e?.websiteUrl || (!isWa ? e?.rsvpUrl : '') || '').trim();
                const evtSite = rawSite && rawSite !== 'https://' && rawSite !== 'http://'
                  ? (/^https?:\/\//i.test(rawSite) ? rawSite : `https://${rawSite}`)
                  : '';
                return {
                  id: `rsvp-${e.id}`,
                  name: e.title,
                  category: 'Our Events',
                  price: 0,
                  description: e.description || '',
                  url: evtSite || e.rsvpUrl,
                  websiteUrl: evtSite || undefined,
                  guestOfHonor: e.guestOfHonor || undefined,
                  speakers: Array.isArray(e.speakers) && e.speakers.length > 0 ? e.speakers : undefined,
                  ctaText: e.ctaText || 'RSVP & Join',
                  photoUrl: e.photos?.[0] || undefined,
                };
              }),
            };
            await saveCanonicalQrPage(db, userEmail, 'events', evtPage, { preserveExistingIfEmpty: true });
            for (const singleEvt of syncEvtItems) {
              if (singleEvt && singleEvt.id) {
                const singlePage = buildSingleEventPublicPage(singleEvt, userEmail, profile);
                await saveCanonicalQrPage(db, userEmail, 'events', singlePage, {
                  explicitId: `user_${userEmail}_event_${String(singleEvt.id).trim()}`,
                });
              }
            }
          }

          // D. Business Showcase — read from backupData.qrHostedPages instead of non-existent backupData.photos
          const bizCandidates = incomingPages.filter((p: any) =>
            p &&
            p.pageType !== 'websites_hub' &&
            p.pageType !== 'socials_hub' &&
            p.pageType !== 'events_hub' &&
            p.pageType !== 'event' &&
            !String(p.id || '').startsWith('event-') &&
            !String(p.id || '').startsWith('events-hub') &&
            !String(p.id || '').startsWith('websites-hub') &&
            !String(p.id || '').startsWith('socials-hub')
          );
          const incomingBizPage = bizCandidates.find(hasRealQrPageContent) || bizCandidates[0];
          const photos = Array.isArray(incomingBizPage?.photos) && incomingBizPage.photos.length > 0
            ? incomingBizPage.photos
            : (Array.isArray(backupData.photos) ? backupData.photos : []);

          // Strict Separation: Business QR Digital Items MUST NEVER copy stock/inventory products
          const bizMenuItems = Array.isArray(incomingBizPage?.menuItems)
            ? incomingBizPage.menuItems.filter((item: any) => item && !String(item.id || '').startsWith('prod-'))
            : [];

          const bizPage = {
            ...(incomingBizPage || {}),
            title: incomingBizPage?.title || profile.name || (userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business'),
            tagline: incomingBizPage?.tagline || profile.description || 'Welcome to our official business page',
            description: incomingBizPage?.description || profile.description || '',
            pageType: incomingBizPage?.pageType || 'menu',
            accentColor: incomingBizPage?.accentColor || profile.themeColor || '#059669',
            theme: incomingBizPage?.theme || 'emerald',
            logo: incomingBizPage?.logo || profile.logo,
            coverImage: incomingBizPage?.coverImage || photos[0]?.url || (typeof photos[0] === 'string' ? photos[0] : undefined),
            phone: incomingBizPage?.phone || profile.phone || '',
            whatsapp: incomingBizPage?.whatsapp || cleanWa,
            email: incomingBizPage?.email || profile.email || userEmail,
            address: incomingBizPage?.address || profile.address || '',
            currency: incomingBizPage?.currency || profile.currency || 'UGX',
            openingHours: incomingBizPage?.openingHours || '',
            allowWhatsAppOrdering: incomingBizPage?.allowWhatsAppOrdering ?? true,
            photos,
            menuCategories: Array.isArray(incomingBizPage?.menuCategories) && incomingBizPage.menuCategories.length > 0
              ? incomingBizPage.menuCategories
              : ['All'],
            menuItems: bizMenuItems,
          };
          if (hasRealQrPageContent(bizPage)) {
            await saveCanonicalQrPage(db, userEmail, 'business', bizPage, {
              preserveExistingPhotosIfEmpty: true,
              preserveExistingIfEmpty: true,
            });
          }

          // E. Auto-update user's Live Stock Catalog row whenever inventory or catalog settings sync
          const inv = Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts : (Array.isArray(backupData.inventory) ? backupData.inventory : []);
          if (inv.length > 0 || backupData.publicCatalogSettings) {
            try {
              const autoCatalog = buildPublicStoreCatalogFromBackup(backupData, userEmail);
              if (autoCatalog) {
                await upsertUserStoreCatalog(
                  db,
                  userEmail,
                  autoCatalog.settings.slug,
                  autoCatalog,
                  now,
                  autoCatalog.settings.catalogId
                );
              }
            } catch (_) {}
          } else {
            invalidateCachePattern(`storeCache:${userEmail}:`);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            d1Saved: Boolean(db),
            r2Saved: false,
            message: 'All records successfully synchronized to D1 database',
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 8. Data Sync Pull endpoint (/api/sync/pull)
    if (url.pathname === '/api/sync/pull' && request.method === 'GET') {
      try {
        const bucket = getR2Bucket(env);
        const db = getD1Database(env);
        const userEmail = (
          request.headers.get('X-User-Email') ||
          request.headers.get('X-User-Id') ||
          url.searchParams.get('email') ||
          url.searchParams.get('user_id') ||
          ''
        ).toLowerCase().trim();

        let backupData: any = null;

        // If no user email provided, return empty data (never leak someone else's data)
        if (!userEmail) {
          return new Response(
            JSON.stringify({
              ok: true,
              success: true,
              userEmail: '',
              backupData: null,
              data: { backupData: null },
              message: 'User email is required to pull cloud backup',
            }),
            {
              status: 200,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            }
          );
        }

        // 1. Attempt retrieving user-scoped backup from R2 under user email ID
        if (bucket) {
          try {
            const userKey = encodeURIComponent(userEmail);
            let backupObj = await bucket.get(`users/${userKey}/latest_backup.json`);
            if (!backupObj) {
              backupObj = await bucket.get(`users/${userKey}/backup.json`);
            }
            if (backupObj) {
              backupData = JSON.parse(await backupObj.text());
            }
          } catch (_) {}
        }

        // 2. If not found in R2, check D1 user backup strictly for this user email
        if (!backupData && db) {
          try {
            await ensureD1Tables(db);
            const row: any = await db.prepare('SELECT backup_data FROM backups WHERE id = ? OR LOWER(user_email) = ? ORDER BY updated_at DESC LIMIT 1').bind(`user_${userEmail}`, userEmail).first();
            if (row && row.backup_data) {
              backupData = JSON.parse(row.backup_data);
            }
          } catch (_) {}
        }

        // 3. Enrich backupData with all live records in D1 (receipts, products, clients, staff, qr_pages, files)
        if (db) {
          try {
            await ensureD1Tables(db);
            if (!backupData) backupData = {};

            const mergeQrPagesPreservingRich = (a: any, b: any): any => {
              if (!a) return b;
              if (!b) return a;
              const isGenericTitle = (t?: string) => !t || !t.trim() || t.trim() === 'Brivu Business' || t.trim() === 'My Business' || t.trim().endsWith("'s Business");
              const pickNonEmptyArr = (primary: any, fallback: any) =>
                Array.isArray(primary) && primary.length > 0 ? primary : (Array.isArray(fallback) ? fallback : []);
              const pickCats = (c1: any, c2: any) => {
                const set = new Set<string>(['All']);
                for (const c of [...(Array.isArray(c1) ? c1 : []), ...(Array.isArray(c2) ? c2 : [])]) {
                  if (typeof c === 'string' && c.trim() && c.trim() !== 'All') set.add(c.trim());
                }
                return Array.from(set);
              };
              const mergedSocialLinks = {
                instagram: b.socialLinks?.instagram || a.socialLinks?.instagram || '',
                facebook: b.socialLinks?.facebook || a.socialLinks?.facebook || '',
                website: b.socialLinks?.website || a.socialLinks?.website || '',
              };
              const tsA = new Date(a.updatedAt || 0).getTime() || 0;
              const tsB = new Date(b.updatedAt || 0).getTime() || 0;
              const newer = tsB >= tsA ? b : a;
              const older = tsB >= tsA ? a : b;
              return {
                ...older,
                ...newer,
                title: !isGenericTitle(newer.title) ? newer.title : (!isGenericTitle(older.title) ? older.title : (newer.title || older.title)),
                tagline: newer.tagline || older.tagline || '',
                description: newer.description || older.description || '',
                phone: newer.phone || older.phone || '',
                whatsapp: newer.whatsapp || older.whatsapp || '',
                email: newer.email || older.email || '',
                userEmail: newer.userEmail || older.userEmail || userEmail,
                address: newer.address || older.address || '',
                googleMapsUrl: newer.googleMapsUrl || older.googleMapsUrl,
                wifiName: newer.wifiName || older.wifiName,
                wifiPassword: newer.wifiPassword || older.wifiPassword,
                openingHours: newer.openingHours || older.openingHours || '',
                announcement: newer.announcement || older.announcement || '',
                coverImage: newer.coverImage || older.coverImage,
                logo: newer.logo || older.logo,
                socialLinks: mergedSocialLinks,
                customSocialLinks: pickNonEmptyArr(newer.customSocialLinks, older.customSocialLinks),
                photos: pickNonEmptyArr(newer.photos, older.photos),
                menuCategories: pickCats(older.menuCategories, newer.menuCategories),
                menuItems: pickNonEmptyArr(newer.menuItems, older.menuItems),
                websitesQrItems: pickNonEmptyArr(newer.websitesQrItems, older.websitesQrItems),
                socialsQrItems: pickNonEmptyArr(newer.socialsQrItems, older.socialsQrItems),
                eventsQrItems: pickNonEmptyArr(newer.eventsQrItems, older.eventsQrItems),
              };
            };

            // A. QR Pages
            const qrRows = await db.prepare('SELECT id, page_json, updated_at FROM qr_pages WHERE LOWER(user_email) = ? OR id LIKE ?').bind(userEmail, `user_${userEmail}_%`).all();
            const hostedPages: any[] = [];
            if (qrRows?.results) {
              for (const r of qrRows.results as any[]) {
                if (r?.page_json) {
                  try {
                    const parsedPage = JSON.parse(r.page_json);
                    if (parsedPage && parsedPage.id && parsedPage.id !== 'default' && parsedPage.id !== 'latest') {
                      if (!parsedPage.updatedAt && r.updated_at) parsedPage.updatedAt = r.updated_at;
                      hostedPages.push(parsedPage);
                    }
                  } catch (_) {}
                }
              }
            }
            const existingPages = Array.isArray(backupData.qrHostedPages) ? backupData.qrHostedPages : [];
            const pageMap = new Map<string, any>();
            for (const p of [...existingPages, ...hostedPages]) {
              if (p?.id) {
                const prev = pageMap.get(p.id);
                pageMap.set(p.id, prev ? mergeQrPagesPreservingRich(prev, p) : p);
              }
            }
            const combinedQrPages = Array.from(pageMap.values());
            if (combinedQrPages.length > 0) {
              backupData.qrHostedPages = combinedQrPages;
            }

            // A2. Ensure top-level websitesQrItems, socialsQrItems, eventsQrItems are reconstructed from qr_pages hubs if backupData lacks them
            const webHubs = combinedQrPages.filter((p: any) => p && (p.pageType === 'websites_hub' || String(p.id || '').includes('websites')));
            const mergedWebMap = new Map<string, any>();
            for (const w of (Array.isArray(backupData.websitesQrItems) ? backupData.websitesQrItems : [])) {
              if (w?.id) mergedWebMap.set(w.id, w);
            }
            for (const hub of webHubs) {
              if (Array.isArray(hub.websitesQrItems)) {
                for (const w of hub.websitesQrItems) {
                  if (w?.id && !mergedWebMap.has(w.id)) mergedWebMap.set(w.id, w);
                }
              }
            }
            if (mergedWebMap.size > 0) {
              backupData.websitesQrItems = Array.from(mergedWebMap.values());
            }

            const socHubs = combinedQrPages.filter((p: any) => p && (p.pageType === 'socials_hub' || String(p.id || '').includes('socials')));
            const mergedSocMap = new Map<string, any>();
            for (const s of (Array.isArray(backupData.socialsQrItems) ? backupData.socialsQrItems : [])) {
              if (s?.id) mergedSocMap.set(s.id, s);
            }
            for (const hub of socHubs) {
              if (Array.isArray(hub.socialsQrItems)) {
                for (const s of hub.socialsQrItems) {
                  if (s?.id && !mergedSocMap.has(s.id)) mergedSocMap.set(s.id, s);
                }
              }
            }
            if (mergedSocMap.size > 0) {
              backupData.socialsQrItems = Array.from(mergedSocMap.values());
            }

            const evtPages = combinedQrPages.filter((p: any) => p && (p.pageType === 'events_hub' || p.pageType === 'event' || String(p.id || '').includes('event')));
            const mergedEvtMap = new Map<string, any>();
            for (const e of (Array.isArray(backupData.eventsQrItems) ? backupData.eventsQrItems : [])) {
              if (e?.id) mergedEvtMap.set(e.id, e);
            }
            for (const ep of evtPages) {
              if (Array.isArray(ep.eventsQrItems)) {
                for (const e of ep.eventsQrItems) {
                  if (e?.id && !mergedEvtMap.has(e.id)) mergedEvtMap.set(e.id, e);
                }
              }
            }
            if (mergedEvtMap.size > 0) {
              backupData.eventsQrItems = Array.from(mergedEvtMap.values());
            }

            // B. Receipts & Invoices
            const receiptRows = await db.prepare('SELECT data_json FROM receipts WHERE LOWER(user_email) = ?').bind(userEmail).all();
            if (receiptRows?.results && receiptRows.results.length > 0) {
              const existingReceipts = Array.isArray(backupData.receipts) ? backupData.receipts : [];
              const receiptMap = new Map();
              for (const r of existingReceipts) {
                if (r?.id) receiptMap.set(r.id, r);
              }
              for (const row of receiptRows.results as any[]) {
                if (row?.data_json) {
                  try {
                    const parsed = JSON.parse(row.data_json);
                    if (parsed?.id && !receiptMap.has(parsed.id)) {
                      receiptMap.set(parsed.id, parsed);
                    }
                  } catch (_) {}
                }
              }
              backupData.receipts = Array.from(receiptMap.values());
            }

            // C. Inventory Products
            const productRows = await db.prepare('SELECT id, name, barcode, category, selling_price, cost_price, stock_quantity, image FROM products WHERE LOWER(shop_id) = ?').bind(userEmail).all();
            if (productRows?.results && productRows.results.length > 0) {
              const existingProducts = Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts : [];
              const productMap = new Map();
              for (const p of existingProducts) {
                if (p?.id) productMap.set(p.id, p);
              }
              for (const row of productRows.results as any[]) {
                if (row?.id) {
                  const existingProd = productMap.get(row.id);
                  if (!existingProd) {
                    productMap.set(row.id, {
                      id: row.id,
                      itemId: row.barcode || row.id,
                      name: row.name,
                      category: row.category || 'General',
                      sellingPrice: Number(row.selling_price || 0),
                      costPrice: Number(row.cost_price || 0),
                      quantity: Number(row.stock_quantity || 0),
                      image: row.image || undefined,
                      unit: 'Pcs'
                    });
                  } else if (!existingProd.image && row.image) {
                    productMap.set(row.id, {
                      ...existingProd,
                      image: row.image,
                    });
                  }
                }
              }
              backupData.inventoryProducts = Array.from(productMap.values());
            }

            // D. Uploaded Files & Photos (D1 files + R2 bucket photos fallback)
            const existingFiles = Array.isArray(backupData.files) ? backupData.files : [];
            const fileMap = new Map<string, any>();
            for (const f of existingFiles) {
              if (f?.key || f?.id) fileMap.set(f.key || f.id, f);
            }

            const fileRows = await db.prepare('SELECT id, filename, mime_type, size, created_at FROM files WHERE user_email = ? OR id LIKE ? OR id LIKE ?').bind(userEmail, `users/${encodeURIComponent(userEmail)}/%`, `users/${userEmail}/%`).all();
            if (fileRows?.results && fileRows.results.length > 0) {
              for (const row of fileRows.results as any[]) {
                if (row?.id && !fileMap.has(row.id)) {
                  fileMap.set(row.id, {
                    key: row.id,
                    id: row.id,
                    filename: row.filename,
                    mimeType: row.mime_type,
                    size: row.size,
                    uploadedAt: row.created_at,
                    url: `${url.origin}/api/files/${encodeURIComponent(row.id)}`,
                  });
                }
              }
            }

            // Also scan R2 photos prefix so R2-only photos are never missed
            if (bucket && typeof bucket.list === 'function') {
              try {
                const listed = await bucket.list({ prefix: `users/${encodeURIComponent(userEmail)}/photos/`, limit: 200 });
                if (listed && Array.isArray(listed.objects)) {
                  for (const obj of listed.objects) {
                    if (!fileMap.has(obj.key)) {
                      const rawName = (obj.key.split('/').pop() || obj.key).replace(/^\d+_/, '');
                      fileMap.set(obj.key, {
                        key: obj.key,
                        id: obj.key,
                        filename: rawName,
                        mimeType: obj.httpMetadata?.contentType || 'image/jpeg',
                        size: obj.size || 0,
                        uploadedAt: obj.uploaded ? new Date(obj.uploaded).toISOString() : new Date().toISOString(),
                        url: `${url.origin}/api/files/${encodeURIComponent(obj.key)}`,
                      });
                    }
                  }
                }
              } catch (_) {}
            }

            const allUserFiles = Array.from(fileMap.values());
            if (allUserFiles.length > 0) {
              backupData.files = allUserFiles;
            }

            // E. Protect and auto-recover QR gallery photos in qrHostedPages from R2/D1 files if any sync cleared them
            const recoveredAssets = recoverQrPhotosFromFileRecords(allUserFiles, url.origin);
            if (Array.isArray(backupData.qrHostedPages) && backupData.qrHostedPages.length > 0) {
              // Merge duplicate canonical `user_<email>_business` into real business page without losing photos
              const bizPages = backupData.qrHostedPages.filter((p: any) =>
                p &&
                p.pageType !== 'websites_hub' &&
                p.pageType !== 'socials_hub' &&
                p.pageType !== 'events_hub' &&
                p.pageType !== 'event'
              );
              const populatedBiz = bizPages.find((p: any) => Array.isArray(p.photos) && p.photos.length > 0);
              backupData.qrHostedPages = backupData.qrHostedPages.map((p: any) => {
                if (
                  p &&
                  p.pageType !== 'websites_hub' &&
                  p.pageType !== 'socials_hub' &&
                  p.pageType !== 'events_hub' &&
                  p.pageType !== 'event'
                ) {
                  let photos = Array.isArray(p.photos) ? p.photos : [];
                  if (photos.length === 0 && populatedBiz && populatedBiz.photos.length > 0) {
                    photos = populatedBiz.photos;
                  }
                  if (photos.length === 0 && recoveredAssets.photos.length > 0) {
                    photos = recoveredAssets.photos;
                  }
                  return {
                    ...p,
                    photos,
                    coverImage: p.coverImage || recoveredAssets.coverImage || photos[0]?.url,
                    logo: p.logo || recoveredAssets.logo,
                  };
                }
                return p;
              });
            } else if (recoveredAssets.photos.length > 0) {
              backupData.qrHostedPages = [
                {
                  id: `qr-${Date.now().toString(36)}`,
                  title: backupData?.profile?.name || 'Brivu Business',
                  tagline: backupData?.profile?.description || '',
                  description: '',
                  pageType: 'menu',
                  accentColor: '#059669',
                  theme: 'emerald',
                  logo: recoveredAssets.logo || backupData?.profile?.logo,
                  coverImage: recoveredAssets.coverImage || recoveredAssets.photos[0]?.url,
                  phone: backupData?.profile?.phone || '',
                  whatsapp: backupData?.profile?.whatsapp || backupData?.profile?.phone || '',
                  email: backupData?.profile?.email || userEmail,
                  address: backupData?.profile?.address || '',
                  currency: backupData?.profile?.currency || 'UGX',
                  allowWhatsAppOrdering: true,
                  photos: recoveredAssets.photos,
                  menuCategories: ['All'],
                  menuItems: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ];
            }

          } catch (_) {}
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            userEmail,
            backupData: backupData || null,
            data: { backupData: backupData || null },
          }),
          {
            status: 200,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, no-cache, must-revalidate',
            },
          }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

// 9. Admin Cleanup endpoint (/api/admin/cleanup)
    if (url.pathname === '/api/admin/cleanup' && request.method === 'POST') {
      try {
        const bucket = getR2Bucket(env);
        const db = getD1Database(env);
        const report: any = {
          r2DeletedObjects: [],
          d1Cleaned: {
            qrPagesAliasesRemoved: 0,
            backupsLatestRemoved: 0,
            filesBase64Purged: 0,
            duplicateSignaturesRemoved: 0,
          },
          errors: [],
        };

        // 1. Clean R2 Bucket
        if (bucket && typeof bucket.list === 'function') {
          try {
            const targetPrefixes = ['documents/', 'reports/', 'qr_pages/'];
            for (const pfx of targetPrefixes) {
              let cursor: string | undefined = undefined;
              let hasMore = true;
              while (hasMore) {
                const listed: any = await bucket.list({ prefix: pfx, limit: 500, cursor });
                if (listed?.objects && Array.isArray(listed.objects)) {
                  for (const obj of listed.objects) {
                    try {
                      await bucket.delete(obj.key);
                      report.r2DeletedObjects.push(obj.key);
                    } catch (e: any) {
                      report.errors.push(`Failed to delete R2 ${obj.key}: ${e.message}`);
                    }
                  }
                }
                if (listed?.truncated && listed?.cursor) {
                  cursor = listed.cursor;
                } else {
                  hasMore = false;
                }
              }
            }

            try {
              await bucket.delete('users/all_users.json');
              report.r2DeletedObjects.push('users/all_users.json');
            } catch (_) {}

            let userCursor: string | undefined = undefined;
            let userHasMore = true;
            while (userHasMore) {
              const listed: any = await bucket.list({ prefix: 'users/', limit: 500, cursor: userCursor });
              if (listed?.objects && Array.isArray(listed.objects)) {
                for (const obj of listed.objects) {
                  const key = obj.key;
                  const isDeprecatedUserFile =
                    key.endsWith('/backup.json') ||
                    key.endsWith('/latest_backup.json') ||
                    key.endsWith('/profile.json') ||
                    key.endsWith('/data.json') ||
                    key.includes('/qr_pages/') ||
                    (key.includes('/signatures/signature_') && !key.endsWith('signature.webp')) ||
                    (key.includes('/photos/logo_') && !key.endsWith('logo.webp'));

                  if (isDeprecatedUserFile) {
                    try {
                      await bucket.delete(key);
                      report.r2DeletedObjects.push(key);
                    } catch (e: any) {
                      report.errors.push(`Failed to delete R2 ${key}: ${e.message}`);
                    }
                  }
                }
              }
              if (listed?.truncated && listed?.cursor) {
                userCursor = listed.cursor;
              } else {
                userHasMore = false;
              }
            }
          } catch (r2Err: any) {
            report.errors.push(`R2 cleanup error: ${r2Err.message}`);
          }
        }

        // 2. Clean D1 Database
        if (db) {
          try {
            await ensureD1Tables(db);

            const d1Aliases = await db.prepare(`
              DELETE FROM qr_pages 
              WHERE id IN ('business', 'business-latest', 'events', 'socials', 'websites')
                 OR id LIKE '%-hub-%'
                 OR id LIKE 'qr-%'
                 OR id LIKE 'business-%'
                 OR id LIKE '%_latest'
            `).run();
            report.d1Cleaned.qrPagesAliasesRemoved = d1Aliases?.meta?.changes || 0;

            const d1Backups = await db.prepare("DELETE FROM backups WHERE id = 'latest_backup'").run();
            report.d1Cleaned.backupsLatestRemoved = d1Backups?.meta?.changes || 0;

            const d1FilesBase64 = await db.prepare("UPDATE files SET data_base64 = NULL WHERE data_base64 IS NOT NULL").run();
            report.d1Cleaned.filesBase64Purged = d1FilesBase64?.meta?.changes || 0;

            const d1Dups = await db.prepare(`
              DELETE FROM files 
              WHERE (file_type IN ('signature', 'logo') OR filename LIKE 'signature_%' OR filename LIKE 'logo_%')
                AND id NOT LIKE '%signature.webp'
                AND id NOT LIKE '%logo.webp'
            `).run();
            report.d1Cleaned.duplicateSignaturesRemoved = d1Dups?.meta?.changes || 0;
          } catch (d1Err: any) {
            report.errors.push(`D1 cleanup error: ${d1Err.message}`);
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'Cleanup executed successfully',
            report,
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 10. Audit Report Endpoint (/api/admin/audit-report)
    if (url.pathname === '/api/admin/audit-report' && request.method === 'GET') {
      try {
        const bucket = getR2Bucket(env);
        const db = getD1Database(env);
        const report: any = {
          r2Objects: [],
          d1Files: [],
          d1QrPages: [],
          d1Users: [],
          errors: [],
        };

        if (bucket && typeof bucket.list === 'function') {
          try {
            let cursor: string | undefined = undefined;
            let hasMore = true;
            while (hasMore) {
              const listed: any = await bucket.list({ limit: 1000, cursor });
              if (listed?.objects && Array.isArray(listed.objects)) {
                for (const obj of listed.objects) {
                  report.r2Objects.push({
                    key: obj.key,
                    size: obj.size,
                    uploaded: obj.uploaded,
                    httpMetadata: obj.httpMetadata,
                  });
                }
              }
              if (listed?.truncated && listed?.cursor) {
                cursor = listed.cursor;
              } else {
                hasMore = false;
              }
            }
          } catch (e: any) {
            report.errors.push(`R2 list error: ${e.message}`);
          }
        }

        if (db) {
          try {
            await ensureD1Tables(db);
            try {
              const filesRes = await db.prepare('SELECT id, user_email, r2_key, filename, mime_type, size, created_at FROM files').all();
              report.d1Files = filesRes?.results || [];
            } catch (fe: any) {
              report.errors.push(`Files query note: ${fe.message}`);
            }

            try {
              const qrRes = await db.prepare('SELECT id, user_email, content_hash, updated_at, LENGTH(page_json) as json_len, page_json FROM qr_pages').all();
              report.d1QrPages = (qrRes?.results || []).map((r: any) => {
                let parsed: any = null;
                try { parsed = JSON.parse(r.page_json); } catch (_) {}
                return {
                  id: r.id,
                  user_email: r.user_email,
                  content_hash: r.content_hash,
                  updated_at: r.updated_at,
                  json_len: r.json_len,
                  page_title: parsed?.title || '',
                  page_type: parsed?.pageType || '',
                  internal_id: parsed?.id || '',
                  is_brivu_usr: String(r.id || '').includes('brivu-usr') || String(r.user_email || '').includes('brivu-usr'),
                  has_content: parsed ? (
                    (parsed.eventsQrItems?.length || 0) > 0 ||
                    (parsed.websitesQrItems?.length || 0) > 0 ||
                    (parsed.socialsQrItems?.length || 0) > 0 ||
                    (parsed.menuItems?.length || 0) > 0 ||
                    (parsed.photos?.length || 0) > 0
                  ) : false,
                };
              });
            } catch (qe: any) {
              report.errors.push(`QrPages query note: ${qe.message}`);
            }

            try {
              const backupsRes = await db.prepare('SELECT id, user_email, updated_at, LENGTH(backup_data) as json_len, backup_data FROM backups').all();
              report.d1Backups = (backupsRes?.results || []).map((r: any) => {
                let parsed: any = null;
                try { parsed = JSON.parse(r.backup_data); } catch (_) {}
                const isReal = parsed ? (
                  (parsed.receipts?.length || 0) > 0 ||
                  (parsed.inventoryProducts?.length || 0) > 0 ||
                  (parsed.customers?.length || 0) > 0 ||
                  (parsed.shoppingListItems?.length || 0) > 0 ||
                  (parsed.eventsQrItems?.length || 0) > 0 ||
                  (parsed.websitesQrItems?.length || 0) > 0 ||
                  (parsed.socialsQrItems?.length || 0) > 0 ||
                  Boolean(parsed.profile?.phone || parsed.profile?.logo || parsed.profile?.signature)
                ) : false;
                return {
                  id: r.id,
                  user_email: r.user_email,
                  updated_at: r.updated_at,
                  json_len: r.json_len,
                  is_brivu_usr: String(r.id || '').includes('brivu-usr') || String(r.user_email || '').includes('brivu-usr'),
                  has_content: isReal,
                  is_default_only: !isReal,
                };
              });
            } catch (be: any) {
              report.errors.push(`Backups query note: ${be.message}`);
            }

            try {
              const usersRes = await db.prepare('SELECT * FROM users').all();
              report.d1Users = (usersRes?.results || []).map((u: any) => ({
                ...u,
                is_brivu_usr: String(u.id || '').includes('brivu-usr') || String(u.email || '').includes('brivu-usr'),
              }));
            } catch (ue: any) {
              report.errors.push(`Users query note: ${ue.message}`);
            }

            try {
              const recRes = await db.prepare('SELECT id, user_email, receipt_number, total, created_at FROM receipts').all();
              report.d1Receipts = recRes?.results || [];
            } catch (re: any) {
              report.errors.push(`Receipts query note: ${re.message}`);
            }
          } catch (e: any) {
            report.errors.push(`D1 query error: ${e.message}`);
          }
        }

        return new Response(
          JSON.stringify({ ok: true, report, timestamp: new Date().toISOString() }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Detect QR & Store/Catalog HTML routes upfront so `not_found_handling = "single-page-application"` doesn't short-circuit Step 6 SSR injection
    const isStaticAssetExt = /\.[a-z0-9]{1,8}$/i.test(url.pathname) && !url.pathname.endsWith('.html');
    const isStoreRoute =
      url.pathname === '/catalog' ||
      url.pathname.startsWith('/catalog/') ||
      url.pathname === '/store' ||
      url.pathname.startsWith('/store/') ||
      url.searchParams.has('catalogId') ||
      url.searchParams.has('catalog') ||
      url.searchParams.has('store');
    const isQrRoute =
      !isStoreRoute &&
      (url.pathname === '/qr' ||
        url.pathname.startsWith('/qr/') ||
        url.pathname === '/menu' ||
        url.pathname.startsWith('/menu/') ||
        url.searchParams.has('qr') ||
        url.searchParams.has('email') ||
        url.searchParams.has('u') ||
        url.searchParams.has('user') ||
        url.searchParams.has('event') ||
        url.searchParams.has('eventId') ||
        url.searchParams.has('events') ||
        url.searchParams.has('website') ||
        url.searchParams.has('websiteId') ||
        url.searchParams.has('websites') ||
        url.searchParams.has('social') ||
        url.searchParams.has('socialId') ||
        url.searchParams.has('socials'));
    const shouldServeStandaloneStore =
      request.method === 'GET' && !isStaticAssetExt && isStoreRoute;
    const shouldInjectSsrHtml =
      request.method === 'GET' && !isStaticAssetExt && isQrRoute;

    // 4b. Dedicated Standalone Live Stock Catalog HTML Page (completely separate from Business QR / SPA bundle)
    if (shouldServeStandaloneStore) {
      const emailParam = (
        url.searchParams.get('email') ||
        url.searchParams.get('u') ||
        url.searchParams.get('user') ||
        url.searchParams.get('user_id') ||
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        ''
      ).toLowerCase().trim();

      let storeCatalogIdParam = (url.searchParams.get('catalogId') || url.searchParams.get('catalog') || '').trim();
      if (!storeCatalogIdParam && url.pathname.includes('/catalog/')) {
        storeCatalogIdParam = decodeURIComponent(url.pathname.split('/catalog/')[1]?.split('?')[0]?.split('/')[0] || '').trim();
      }
      let storeSlugParam = (url.searchParams.get('slug') || url.searchParams.get('store') || '').trim().toLowerCase();
      if (!storeSlugParam && url.pathname.includes('/store/')) {
        storeSlugParam = decodeURIComponent(url.pathname.split('/store/')[1]?.split('?')[0]?.split('/')[0] || '').trim().toLowerCase();
      } else if (!storeSlugParam && (url.pathname === '/store' || url.pathname.endsWith('/store'))) {
        storeSlugParam = 'store';
      }

      const preloadedStore = await Promise.race([
        resolvePublicStoreCatalog(
          env,
          sanitizePublicStoreSlug(storeSlugParam || 'store'),
          emailParam,
          storeCatalogIdParam || undefined
        ).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500)),
      ]);

      const standaloneHtml = renderStandaloneCatalogHtml(preloadedStore, {
        catalogId: storeCatalogIdParam || preloadedStore?.settings?.catalogId || undefined,
        slug: storeSlugParam || preloadedStore?.settings?.slug || 'store',
        email: emailParam || preloadedStore?.settings?.email || preloadedStore?.business?.email || '',
        origin: url.origin,
      });

      return new Response(standaloneHtml, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // 5. Try serving exact static asset from ASSETS binding (skip for HTML QR routes so Step 6 preloads user data)
    if (!shouldInjectSsrHtml) {
      try {
        const response = await env.ASSETS.fetch(request);
        if (response.status !== 404) {
          const newHeaders = new Headers(response.headers);
          Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
      } catch {
        // Ignore asset lookup errors and proceed to SPA fallback
      }
    }

    // 6. SPA Fallback: Serve /index.html for client-side React routes with pre-injected QR data
    try {
      const indexUrl = new URL('/index.html', url.origin);
      const cleanIndexReq = new Request(indexUrl.toString(), { method: 'GET' });

      const safeScriptJson = (val: any): string =>
        JSON.stringify(val)
          .replace(/</g, '\\u003c')
          .replace(/>/g, '\\u003e')
          .replace(/&/g, '\\u0026')
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029');
      const escapeHtmlText = (str: string): string =>
        String(str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const emailParam = (
        url.searchParams.get('email') ||
        url.searchParams.get('u') ||
        url.searchParams.get('user') ||
        url.searchParams.get('user_id') ||
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        ''
      ).toLowerCase().trim();

      const tabParam = (url.searchParams.get('tab') || '').toLowerCase().trim();
      let pageIdParam = '';
      if (isQrRoute) {
        pageIdParam =
          url.searchParams.get('qr') ||
          url.searchParams.get('event') ||
          url.searchParams.get('eventId') ||
          (url.searchParams.get('events') ? 'events-hub-all' : '') ||
          url.searchParams.get('website') ||
          url.searchParams.get('websiteId') ||
          (url.searchParams.get('websites') ? 'websites-hub-all' : '') ||
          url.searchParams.get('social') ||
          url.searchParams.get('socialId') ||
          (url.searchParams.get('socials') ? 'socials-hub-all' : '') ||
          '';
        if (!pageIdParam && url.pathname.includes('/qr/')) {
          pageIdParam = decodeURIComponent(url.pathname.split('/qr/')[1]?.split('?')[0]?.split('/')[0] || '').trim();
        }
        if (!pageIdParam) {
          if (tabParam === 'websites' || tabParam === 'website') pageIdParam = 'websites-hub-all';
          else if (tabParam === 'socials' || tabParam === 'social') pageIdParam = 'socials-hub-all';
          else if (tabParam === 'events' || tabParam === 'event') pageIdParam = 'events-hub-all';
          else pageIdParam = 'latest';
        }
      }

      const withSsrTimeout = <T>(p: Promise<T>, ms = 2500): Promise<T | null> =>
        Promise.race([
          p.catch(() => null),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
        ]);

      const [indexResponse, preloadedPage] = await Promise.all([
        env.ASSETS.fetch(cleanIndexReq),
        isQrRoute ? withSsrTimeout(resolveHostedQrPage(env, pageIdParam, emailParam), 2500) : Promise.resolve(null),
      ]);

      let html = await indexResponse.text();

      if (isQrRoute && preloadedPage && !preloadedPage.isEmptyFallback && hasRealQrPageContent(preloadedPage)) {
        const resolvedEmail = emailParam || preloadedPage.userEmail || preloadedPage.email || '';
        const scriptTag = `<script id="__INITIAL_QR_DATA__">window.__INITIAL_QR_PAGE__=${safeScriptJson(preloadedPage)};window.__OWNER_EMAIL__=${safeScriptJson(resolvedEmail)};</script>`;
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${scriptTag}</head>`);
        } else {
          html = `${scriptTag}${html}`;
        }
        if (preloadedPage.title) {
          html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtmlText(preloadedPage.title)} | Brivu</title>`);
        }
      }

      const newHeaders = new Headers(indexResponse.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
      if (isQrRoute) {
        newHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
      return new Response(html, {
        status: indexResponse.status,
        statusText: indexResponse.statusText,
        headers: newHeaders,
      });
    } catch {
      return new Response('Not Found', {
        status: 404,
        headers: CORS_HEADERS,
      });
    }
  },
};
