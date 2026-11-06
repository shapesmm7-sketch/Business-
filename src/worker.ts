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

// Automatically create D1 backups, files, receipts, products, invoices, invoice_items, menus and auth_sessions tables and indexes if D1 is bound
export async function ensureD1Tables(db: any): Promise<void> {
  if (!db || typeof db.prepare !== 'function') return;
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY,
        user_email TEXT,
        backup_data TEXT,
        updated_at TEXT
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_backups_user_email ON backups(user_email)`).run();
  } catch (_) {}

  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_user_email ON files(user_email)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_files_file_type ON files(file_type)`).run();
  } catch (_) {}
  try { await db.prepare(`ALTER TABLE files ADD COLUMN user_email TEXT`).run(); } catch (_) {}
  try { await db.prepare(`ALTER TABLE files ADD COLUMN r2_key TEXT`).run(); } catch (_) {}
  try { await db.prepare(`ALTER TABLE files ADD COLUMN file_type TEXT`).run(); } catch (_) {}

  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_receipts_user_email ON receipts(user_email)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_receipts_number ON receipts(receipt_number)`).run();
  } catch (_) {}
  try { await db.prepare(`ALTER TABLE receipts ADD COLUMN items_json TEXT`).run(); } catch (_) {}
  try { await db.prepare(`ALTER TABLE receipts ADD COLUMN customer_json TEXT`).run(); } catch (_) {}

  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)`).run();
  } catch (_) {}

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id TEXT PRIMARY KEY,
        status TEXT,
        code TEXT,
        user_json TEXT,
        created_at INTEGER
      )
    `).run();
  } catch (_) {}

  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS qr_pages (
        id TEXT PRIMARY KEY,
        user_email TEXT,
        page_json TEXT,
        content_hash TEXT,
        updated_at TEXT
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_qr_pages_user_email ON qr_pages(user_email)`).run();
  } catch (_) {}
  try { await db.prepare(`ALTER TABLE qr_pages ADD COLUMN user_email TEXT`).run(); } catch (_) {}
  try { await db.prepare(`ALTER TABLE qr_pages ADD COLUMN content_hash TEXT`).run(); } catch (_) {}

  // Shopping Lists table (scoped by user_email, replacing R2 reports)
  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_shopping_lists_user ON shopping_lists(user_email)`).run();
  } catch (_) {}

  // Staff Directory table (scoped by user_email, strictly in D1 for privacy)
  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_staff_user ON staff_directory(user_email)`).run();
  } catch (_) {}

  // Client Directory table (scoped by user_email, strictly in D1 for privacy)
  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_client_user ON client_directory(user_email)`).run();
  } catch (_) {}

  // Products table & indexes
  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_shop_id ON products(shop_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_products_shop_updated ON products(shop_id, updated_at)`).run();
  } catch (_) {}

  // Invoices table & indexes
  try {
    await db.prepare(`
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
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_shop_id ON invoices(shop_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoices_shop_updated ON invoices(shop_id, updated_at)`).run();
  } catch (_) {}

  // Invoice Items table & indexes
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        product_id TEXT,
        quantity INTEGER,
        unit_price REAL,
        total REAL
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id)`).run();
  } catch (_) {}

  // Menus table & indexes
  try {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS menus (
        id TEXT PRIMARY KEY,
        hotel_id TEXT NOT NULL,
        title TEXT,
        menu_data TEXT,
        updated_at TEXT
      )
    `).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_menus_hotel_id ON menus(hotel_id)`).run();
    await db.prepare(`CREATE INDEX IF NOT EXISTS idx_menus_hotel_updated ON menus(hotel_id, updated_at)`).run();
  } catch (_) {}
}

// 200 MB user cloud storage cap
export const MAX_USER_STORAGE_BYTES = 200 * 1024 * 1024; // 200 MB (209,715,200 bytes)

/**
 * Calculates total cloud storage bytes consumed by a user across R2 and D1.
 */
export async function getUserStorageUsageBytes(userEmail: string, env: Env): Promise<number> {
  const cleanEmail = (userEmail || '').toLowerCase().trim();
  if (!cleanEmail) return 0;
  const bucket = getR2Bucket(env);
  const db = getD1Database(env);
  let totalBytes = 0;
  const seenKeys = new Set<string>();

  // 1. Check R2 bucket objects
  if (bucket && typeof bucket.list === 'function') {
    try {
      const prefixes = [
        `users/${encodeURIComponent(cleanEmail)}/`,
        `users/${cleanEmail}/`,
      ];
      for (const pfx of prefixes) {
        let cursor: string | undefined = undefined;
        let hasMore = true;
        let iterations = 0;
        while (hasMore && iterations < 10) {
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
      }
    } catch (r2Err) {
      console.warn('R2 user storage calculate note:', r2Err);
    }
  }

  // 2. Also check D1 files table
  if (db) {
    try {
      await ensureD1Tables(db);
      const rows: any = await db.prepare(`
        SELECT id, size FROM files 
        WHERE id LIKE ? OR id LIKE ?
      `).bind(`users/${encodeURIComponent(cleanEmail)}/%`, `users/${cleanEmail}/%`).all();
      if (rows && Array.isArray(rows.results)) {
        for (const row of rows.results) {
          if (!seenKeys.has(row.id)) {
            seenKeys.add(row.id);
            totalBytes += (Number(row.size) || 0);
          }
        }
      }
    } catch (d1Err) {
      console.warn('D1 user storage calculate note:', d1Err);
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

  // Clean menu items - strip cost prices, internal margins, suppliers
  const rawItems = Array.isArray(rawPage.menuItems) ? rawPage.menuItems : [];
  const cleanMenuItems = rawItems.map((item: any) => ({
    id: item?.id ? String(item.id) : `item_${Math.random().toString(36).slice(2, 8)}`,
    name: String(item?.name || ''),
    category: String(item?.category || 'All'),
    price: Number(item?.price || item?.sellingPrice || 0),
    description: item?.description ? String(item.description).slice(0, 500) : '',
    photoUrl: item?.photoUrl || item?.image || undefined,
    url: item?.url || undefined,
    ctaText: item?.ctaText || undefined,
    tags: Array.isArray(item?.tags) ? item.tags : undefined,
    isSpecial: Boolean(item?.isSpecial),
    isAvailable: item?.isAvailable !== false,
  }));

  // Clean photos
  const rawPhotos = Array.isArray(rawPage.photos) ? rawPage.photos : [];
  const cleanPhotos = rawPhotos.map((p: any, idx: number) => {
    if (typeof p === 'string') return { id: `photo-${idx}`, url: p, title: 'Photo' };
    return {
      id: p?.id || `photo-${idx}`,
      url: p?.url || '',
      title: p?.title || 'Photo',
      description: p?.description || '',
    };
  });

  return {
    id: String(rawPage.id || 'business'),
    pageType: rawPage.pageType || 'menu',
    title: rawPage.title || rawPage.name || 'Brivu Business',
    tagline: rawPage.tagline || '',
    description: rawPage.description || '',
    accentColor: rawPage.accentColor || '#059669',
    theme: rawPage.theme || 'emerald',
    logo: rawPage.logo || undefined,
    coverImage: rawPage.coverImage || undefined,
    phone: rawPage.phone || '',
    whatsapp: rawPage.whatsapp ? String(rawPage.whatsapp).replace(/[^0-9+]/g, '') : '',
    email: rawPage.email || '',
    address: rawPage.address || '',
    currency: rawPage.currency || 'UGX',
    openingHours: rawPage.openingHours || '',
    allowWhatsAppOrdering: rawPage.allowWhatsAppOrdering !== false,
    announcement: rawPage.announcement || '',
    photos: cleanPhotos,
    menuCategories: Array.isArray(rawPage.menuCategories) && rawPage.menuCategories.length > 0 ? rawPage.menuCategories : ['All'],
    menuItems: cleanMenuItems,
    websitesQrItems: Array.isArray(rawPage.websitesQrItems) ? rawPage.websitesQrItems : [],
    socialsQrItems: Array.isArray(rawPage.socialsQrItems) ? rawPage.socialsQrItems : [],
    eventsQrItems: Array.isArray(rawPage.eventsQrItems) ? rawPage.eventsQrItems : [],
    updatedAt: rawPage.updatedAt || new Date().toISOString(),
  };
}

/**
 * Saves a canonical QR page to D1 with hash-comparison write reduction.
 * Strictly 4 records per user: business, events, socials, websites.
 */
export async function saveCanonicalQrPage(
  db: any,
  userEmail: string,
  category: 'business' | 'events' | 'socials' | 'websites',
  rawPage: any
): Promise<void> {
  if (!db || !userEmail || !rawPage) return;
  const cleanEmail = userEmail.toLowerCase().trim();
  const canonicalId = `user_${cleanEmail}_${category}`;
  const sanitized = sanitizePublicQrPage({
    ...rawPage,
    id: canonicalId,
    userEmail: cleanEmail,
    email: cleanEmail,
  });
  const sanitizedJson = JSON.stringify(sanitized);

  // Compute fast content hash (SHA-256)
  const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sanitizedJson));
  const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

  try {
    await ensureD1Tables(db);
    const existing: any = await db.prepare('SELECT content_hash FROM qr_pages WHERE id = ?').bind(canonicalId).first();
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
  } catch (err) {
    console.warn('saveCanonicalQrPage note:', err);
  }
}

// Resolver for QR Hosted Pages - D1 Single Source of Truth
export async function resolveHostedQrPage(
  env: Env,
  rawPageId: string,
  rawUserEmail?: string
): Promise<any | null> {
  const pageId = (rawPageId || '').trim();
  const normId = pageId.toLowerCase().trim();
  let userEmail = (rawUserEmail || '').toLowerCase().trim();
  const db = getD1Database(env);

  // Identify category
  const isWebsites = normId.includes('website') || normId === 'websites_hub';
  const isSocials = !isWebsites && (normId.includes('social') || normId === 'socials_hub');
  const isEvents = !isWebsites && !isSocials && (normId.includes('event') || normId === 'events_hub');
  const category: 'business' | 'events' | 'socials' | 'websites' = isWebsites
    ? 'websites'
    : isSocials
    ? 'socials'
    : isEvents
    ? 'events'
    : 'business';

  // If userEmail not passed in query/headers, look up in D1
  if (!userEmail && db && pageId && pageId !== 'default' && pageId !== 'latest') {
    try {
      await ensureD1Tables(db);
      // Check qr_pages by ID
      const row: any = await db.prepare('SELECT user_email, page_json FROM qr_pages WHERE id = ?').bind(pageId).first();
      if (row?.user_email) {
        userEmail = row.user_email.toLowerCase().trim();
      } else if (row?.page_json) {
        try {
          const parsed = JSON.parse(row.page_json);
          userEmail = (parsed?.userEmail || parsed?.email || '').toLowerCase().trim();
        } catch (_) {}
      }
      // If still not found, check backups table
      if (!userEmail) {
        const bRow: any = await db.prepare("SELECT user_email FROM backups WHERE backup_data LIKE ? ORDER BY updated_at DESC LIMIT 1").bind(`%"${pageId}"%`).first();
        if (bRow?.user_email) {
          userEmail = bRow.user_email.toLowerCase().trim();
        }
      }
    } catch (_) {}
  }

  // 1. Primary lookup in D1 qr_pages table for canonical record
  if (db && userEmail) {
    try {
      await ensureD1Tables(db);
      const canonicalId = `user_${userEmail}_${category}`;
      const row: any = await db.prepare('SELECT page_json FROM qr_pages WHERE id = ?').bind(canonicalId).first();
      if (row?.page_json) {
        try {
          const parsed = JSON.parse(row.page_json);
          if (parsed) return sanitizePublicQrPage(parsed);
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 2. Direct fallback lookup in D1 by pageId
  if (db && pageId) {
    try {
      await ensureD1Tables(db);
      const row: any = await db.prepare('SELECT page_json FROM qr_pages WHERE id = ?').bind(pageId).first();
      if (row?.page_json) {
        try {
          const parsed = JSON.parse(row.page_json);
          if (parsed) return sanitizePublicQrPage(parsed);
        } catch (_) {}
      }
    } catch (_) {}
  }

  // 3. Fallback: Reconstruct from user's D1 backup data if page row not yet created
  if (db && userEmail) {
    try {
      await ensureD1Tables(db);
      const bRow: any = await db.prepare(`
        SELECT backup_data FROM backups
        WHERE id = ? OR LOWER(user_email) = ?
        ORDER BY updated_at DESC LIMIT 1
      `).bind(`user_${userEmail}`, userEmail).first();

      if (bRow?.backup_data) {
        const bData = JSON.parse(bRow.backup_data);
        const profile = bData?.profile || {};
        const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

        if (category === 'websites') {
          const webItems = Array.isArray(bData.websitesQrItems) ? bData.websitesQrItems : [];
          return sanitizePublicQrPage({
            id: `user_${userEmail}_websites`,
            title: 'Our Sites',
            tagline: profile.tagline || '',
            description: `Official web links and verified online apps directory for ${profile.name || 'our company'}.`,
            pageType: 'websites_hub',
            accentColor: '#2563eb',
            theme: 'indigo',
            logo: profile.logo,
            phone: profile.phone || '',
            whatsapp: cleanWa,
            email: profile.email || userEmail,
            address: profile.address || '',
            currency: profile.currency || 'USD',
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
            })),
          });
        }

        if (category === 'socials') {
          const socItems = Array.isArray(bData.socialsQrItems) ? bData.socialsQrItems : [];
          return sanitizePublicQrPage({
            id: `user_${userEmail}_socials`,
            title: 'Official Social Links',
            tagline: 'Connect Across All Official Channels & Messaging Apps',
            description: `Official social media profiles and community links for ${profile.name || 'our brand'}.`,
            pageType: 'socials_hub',
            accentColor: '#059669',
            theme: 'emerald',
            logo: profile.logo,
            phone: profile.phone || '',
            whatsapp: cleanWa,
            email: profile.email || userEmail,
            address: profile.address || '',
            currency: profile.currency || 'USD',
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
            })),
          });
        }

        if (category === 'events') {
          const evtItems = Array.isArray(bData.eventsQrItems) ? bData.eventsQrItems : [];
          return sanitizePublicQrPage({
            id: `user_${userEmail}_events`,
            title: 'Our Events',
            description: `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
            pageType: 'events_hub',
            accentColor: '#7c3aed',
            theme: 'indigo',
            logo: profile.logo,
            phone: profile.phone || '',
            whatsapp: cleanWa,
            email: profile.email || userEmail,
            address: profile.address || '',
            currency: profile.currency || 'USD',
            eventsQrItems: evtItems,
            menuCategories: ['Our Events'],
            menuItems: evtItems.map((e: any) => ({
              id: `evt-${e.id}`,
              name: e.title,
              category: 'Our Events',
              price: 0,
              description: `${e.startDate ? e.startDate + ' • ' : ''}${e.location || ''}`,
              url: e.rsvpUrl,
              ctaText: e.ctaText || 'RSVP & Join',
            })),
          });
        }

        // Business Showcase / Menu Page
        const inventory = Array.isArray(bData.inventoryProducts) ? bData.inventoryProducts : (Array.isArray(bData.inventory) ? bData.inventory : []);
        const photos = Array.isArray(bData.photos) ? bData.photos : [];
        return sanitizePublicQrPage({
          id: `user_${userEmail}_business`,
          title: profile.name || (userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business'),
          tagline: profile.description || 'Welcome to our official business page',
          description: profile.description || '',
          pageType: 'menu',
          accentColor: profile.themeColor || '#059669',
          theme: 'emerald',
          logo: profile.logo,
          coverImage: photos[0]?.url || (typeof photos[0] === 'string' ? photos[0] : undefined),
          phone: profile.phone || '',
          whatsapp: cleanWa,
          email: profile.email || userEmail,
          address: profile.address || '',
          currency: profile.currency || 'UGX',
          openingHours: '',
          allowWhatsAppOrdering: true,
          photos,
          menuCategories: Array.from(new Set(['All', ...inventory.map((i: any) => i.category || 'Items')])),
          menuItems: inventory.map((item: any) => ({
            id: item.id || `item-${Math.random().toString(36).slice(2, 8)}`,
            name: item.name,
            category: item.category || 'All',
            price: item.sellingPrice || item.price || 0,
            description: item.description || '',
            photoUrl: item.image || item.photoUrl,
            isAvailable: item.inStock !== false,
          })),
        });
      }
    } catch (_) {}
  }

  // 4. Default empty fallback
  return sanitizePublicQrPage({
    id: pageId || 'business',
    title: userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business',
    tagline: 'Welcome to our official business page',
    pageType: 'menu',
    email: userEmail,
    currency: 'UGX',
    menuCategories: ['All'],
    menuItems: [],
    photos: [],
  });
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
        return new Response(JSON.stringify({
          ok: true,
          success: true,
          status: 'completed',
          user: session.user,
          code: session.code,
        }), {
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

            await db.prepare(`
              INSERT INTO auth_sessions (session_id, status, code, user_json, created_at)
              VALUES (?, 'authenticated', 'workos', ?, ?)
              ON CONFLICT(session_id) DO UPDATE SET user_json = excluded.user_json
            `).bind(cleanEmail, JSON.stringify(user), Date.now()).run();
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

            await db.prepare(`
              INSERT INTO auth_sessions (session_id, status, code, user_json, created_at)
              VALUES (?, 'authenticated', 'profile', ?, ?)
              ON CONFLICT(session_id) DO UPDATE SET user_json = excluded.user_json
            `).bind(cleanEmail, JSON.stringify(userPayload), Date.now()).run();

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

    // GET /api/receipts/:id - View hosted receipt / invoice info page (with boxes and details)
    if (url.pathname.startsWith('/api/receipts/') && request.method === 'GET') {
      return new Response(
        JSON.stringify({
          ok: false,
          error: 'Hosted receipt web copies have been decommissioned. Receipts are generated on demand on client.',
        }),
        { status: 410, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
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
          } catch (_) {}
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

        const lowerFolder = (folder || '').toLowerCase();
        const lowerFilename = (filename || '').toLowerCase();

        // 1. Never save generated documents, reports, shopping lists, or receipts to R2
        if (
          lowerFolder === 'documents' ||
          lowerFolder === 'reports' ||
          lowerFolder === 'receipts' ||
          mimeType.includes('pdf') ||
          lowerFilename.endsWith('.pdf')
        ) {
          return new Response(
            JSON.stringify({
              ok: false,
              success: false,
              error: 'Generated documents and reports are generated on demand and not stored in R2.',
            }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // 2. Fixed key for logo and signature to prevent duplicate files
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
          let buffer: Uint8Array;
          if (typeof data === 'string') {
            const cleanBase64 = data.includes(',') ? data.split(',')[1] : data;
            const binary = atob(cleanBase64);
            buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              buffer[i] = binary.charCodeAt(i);
            }
          } else {
            buffer = new Uint8Array(0);
          }

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
            '(id LIKE ? OR id LIKE ?)'
          ];
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
        if (bucket && key) {
          try {
            await bucket.delete(key);
            deletedR2 = true;
          } catch {}
        }
        if (db && key) {
          try {
            await ensureD1Tables(db);
            await db.prepare('DELETE FROM files WHERE id = ?').bind(key).run();
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
      if (bucket && key) {
        try {
          const object = await bucket.get(key);
          if (object) {
            const headers = new Headers(CORS_HEADERS);
            object.writeHttpMetadata(headers);
            headers.set('etag', object.httpEtag);
            return new Response(object.body, { headers });
          }
        } catch {}
      }

      if (db && key) {
        try {
          await ensureD1Tables(db);
          const row: any = await db.prepare('SELECT data_base64, mime_type FROM files WHERE id = ?').bind(key).first();
          if (row && row.data_base64) {
            const binary = atob(row.data_base64);
            const buffer = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) {
              buffer[i] = binary.charCodeAt(i);
            }
            return new Response(buffer, {
              headers: {
                ...CORS_HEADERS,
                'Content-Type': row.mime_type || 'application/octet-stream',
              },
            });
          }
        } catch {}
      }
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

        if (!userEmail) {
          return new Response(
            JSON.stringify({ ok: false, error: 'User email is required to save QR page' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        // Determine category: exactly 1 of 4 canonical types (business, events, socials, websites)
        const rawType = (page?.pageType || page?.id || '').toLowerCase();
        let category = 'business';
        if (rawType.includes('website') || rawType === 'websites_hub') {
          category = 'websites';
        } else if (rawType.includes('social') || rawType === 'socials_hub') {
          category = 'socials';
        } else if (rawType.includes('event') || rawType === 'events_hub') {
          category = 'events';
        }

        const canonicalId = `user_${userEmail}_${category}`;
        const sanitized = sanitizePublicQrPage({
          ...page,
          id: canonicalId,
          userEmail,
          email: userEmail,
        });
        const sanitizedJson = JSON.stringify(sanitized);

        // Compute fast content hash (SHA-256) to eliminate redundant writes
        const hashBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(sanitizedJson));
        const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);

        if (db) {
          await ensureD1Tables(db);
          // Check if content hash matches existing record
          const existing: any = await db.prepare('SELECT content_hash FROM qr_pages WHERE id = ?').bind(canonicalId).first();
          if (existing?.content_hash === hashHex) {
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

      const page = await resolveHostedQrPage(env, pageId, userEmail);

      if (page) {
        return new Response(
          JSON.stringify({ ok: true, success: true, data: { page } }),
          { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'QR Page not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
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
        ).toLowerCase().trim() || 'default_user';

        if (backupData && db) {
          const backupJson = JSON.stringify(backupData);
          const now = new Date().toISOString();

          await ensureD1Tables(db);

          // 1. Persist exactly 1 row per user in D1 backups table (No latest_backup un-scoped row)
          await db.prepare(`
            INSERT INTO backups (id, user_email, backup_data, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET 
              backup_data = excluded.backup_data,
              user_email = excluded.user_email,
              updated_at = excluded.updated_at
          `).bind(`user_${userEmail}`, userEmail, backupJson, now).run();

          // 2. Persist compact receipts to D1 receipts table
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

                await db.prepare(`
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
                ).run();
              }
            }
          }

          // 3. Persist products to D1 products table
          const productsList = Array.isArray(backupData.inventoryProducts)
            ? backupData.inventoryProducts
            : (Array.isArray(backupData.products) ? backupData.products : []);

          for (const p of productsList) {
            if (p && p.id) {
              await db.prepare(`
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
                p.barcode || null,
                p.category || 'General',
                Number(p.sellingPrice || p.price || 0),
                Number(p.costPrice || 0),
                Number(p.stockQuantity || p.stock || 0),
                p.image || null,
                now
              ).run();
            }
          }

          // 4. Persist Shopping Lists to D1
          const shoppingList = Array.isArray(backupData.shoppingList)
            ? backupData.shoppingList
            : (Array.isArray(backupData.shopping) ? backupData.shopping : []);

          if (shoppingList.length > 0) {
            await db.prepare(`
              INSERT INTO shopping_lists (id, user_email, title, items_json, total_estimated, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
              ON CONFLICT(id) DO UPDATE SET 
                items_json = excluded.items_json,
                total_estimated = excluded.total_estimated,
                updated_at = excluded.updated_at
            `).bind(
              `shop_${userEmail}`,
              userEmail,
              'My Shopping List',
              JSON.stringify(shoppingList),
              0,
              now,
              now
            ).run();
          }

          // 5. Persist Staff Directory to D1
          const staffList = Array.isArray(backupData.staff)
            ? backupData.staff
            : (Array.isArray(backupData.workers) ? backupData.workers : []);

          for (const s of staffList) {
            if (s && (s.id || s.name)) {
              const staffId = s.id || `staff_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              await db.prepare(`
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
              ).run();
            }
          }

          // 6. Persist Client Directory to D1
          const clientList = Array.isArray(backupData.clients)
            ? backupData.clients
            : (Array.isArray(backupData.customers) ? backupData.customers : []);

          for (const c of clientList) {
            if (c && (c.id || c.name)) {
              const clientId = c.id || `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              await db.prepare(`
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
              ).run();
            }
          }

          // 7. Update exactly 4 canonical QR records in D1 with content-hash checking
          const profile = backupData.profile || {};
          const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

          // A. Websites
          if (Array.isArray(backupData.websitesQrItems) && backupData.websitesQrItems.length > 0) {
            const webPage = {
              title: 'Our Sites',
              description: `Official web links and verified online apps directory for ${profile.name || 'our company'}.`,
              pageType: 'websites_hub',
              accentColor: '#2563eb',
              theme: 'indigo',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || userEmail,
              address: profile.address || '',
              currency: profile.currency || 'USD',
              websitesQrItems: backupData.websitesQrItems,
              menuCategories: ['Our Sites'],
              menuItems: backupData.websitesQrItems.map((w: any) => ({
                id: `web-${w.id}`,
                name: w.title,
                category: 'Our Sites',
                price: 0,
                description: w.description || w.url,
                url: w.url,
                ctaText: w.ctaText || 'Visit Website',
              })),
            };
            await saveCanonicalQrPage(db, userEmail, 'websites', webPage);
          }

          // B. Socials
          if (Array.isArray(backupData.socialsQrItems) && backupData.socialsQrItems.length > 0) {
            const socPage = {
              title: 'Official Social Links',
              tagline: 'Connect Across All Official Social Channels & Messaging Apps',
              description: `Official social media profiles and community links for ${profile.name || 'our brand'}.`,
              pageType: 'socials_hub',
              accentColor: '#059669',
              theme: 'emerald',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || userEmail,
              address: profile.address || '',
              currency: profile.currency || 'USD',
              socialsQrItems: backupData.socialsQrItems,
              menuCategories: ['Social Channels'],
              menuItems: backupData.socialsQrItems.map((s: any) => ({
                id: `soc-${s.id}`,
                name: s.title || s.customPlatformName || s.platform,
                category: 'Social Channels',
                price: 0,
                description: s.prefilledMessage || s.fullUrl,
                url: s.fullUrl,
                ctaText: s.ctaText || 'Connect',
              })),
            };
            await saveCanonicalQrPage(db, userEmail, 'socials', socPage);
          }

          // C. Events
          if (Array.isArray(backupData.eventsQrItems) && backupData.eventsQrItems.length > 0) {
            const evtPage = {
              title: 'Our Events',
              description: `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
              pageType: 'events_hub',
              accentColor: '#7c3aed',
              theme: 'indigo',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || userEmail,
              address: profile.address || '',
              currency: profile.currency || 'USD',
              eventsQrItems: backupData.eventsQrItems,
              menuCategories: ['Our Events'],
              menuItems: backupData.eventsQrItems.map((e: any) => ({
                id: `evt-${e.id}`,
                name: e.title,
                category: 'Our Events',
                price: 0,
                description: `${e.startDate ? e.startDate + ' • ' : ''}${e.location || ''}`,
                url: e.rsvpUrl,
                ctaText: e.ctaText || 'RSVP & Join',
              })),
            };
            await saveCanonicalQrPage(db, userEmail, 'events', evtPage);
          }

          // D. Business Showcase
          const inv = Array.isArray(backupData.inventoryProducts) ? backupData.inventoryProducts : (Array.isArray(backupData.inventory) ? backupData.inventory : []);
          const photos = Array.isArray(backupData.photos) ? backupData.photos : [];
          const bizPage = {
            title: profile.name || (userEmail ? `${userEmail.split('@')[0]}'s Business` : 'Brivu Business'),
            tagline: profile.description || 'Welcome to our official business page',
            description: profile.description || '',
            pageType: 'menu',
            accentColor: profile.themeColor || '#059669',
            theme: 'emerald',
            logo: profile.logo,
            coverImage: photos[0]?.url || (typeof photos[0] === 'string' ? photos[0] : undefined),
            phone: profile.phone || '',
            whatsapp: cleanWa,
            email: profile.email || userEmail,
            address: profile.address || '',
            currency: profile.currency || 'UGX',
            openingHours: '',
            allowWhatsAppOrdering: true,
            photos,
            menuCategories: Array.from(new Set(['All', ...inv.map((i: any) => i.category || 'Items')])),
            menuItems: inv.map((item: any) => ({
              id: item.id || `item-${Math.random().toString(36).slice(2, 8)}`,
              name: item.name,
              category: item.category || 'All',
              price: item.sellingPrice || item.price || 0,
              description: item.description || '',
              photoUrl: item.image || item.photoUrl,
              isAvailable: item.inStock !== false,
            })),
          };
          await saveCanonicalQrPage(db, userEmail, 'business', bizPage);
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
            const row: any = await db.prepare('SELECT backup_data FROM backups WHERE id = ? OR user_email = ?').bind(`user_${userEmail}`, userEmail).first();
            if (row && row.backup_data) {
              backupData = JSON.parse(row.backup_data);
            }
          } catch (_) {}
        }

        // 3. Enrich backupData with all live hosted QR pages stored in D1 qr_pages table for this user email
        if (db) {
          try {
            await ensureD1Tables(db);
            const qrRows = await db.prepare('SELECT page_json FROM qr_pages WHERE user_email = ?').bind(userEmail).all();
            const hostedPages: any[] = [];
            if (qrRows?.results) {
              for (const r of qrRows.results as any[]) {
                if (r?.page_json) {
                  try {
                    const parsedPage = JSON.parse(r.page_json);
                    if (parsedPage && parsedPage.id && parsedPage.id !== 'default' && parsedPage.id !== 'latest') {
                      hostedPages.push(parsedPage);
                    }
                  } catch (_) {}
                }
              }
            }
            if (hostedPages.length > 0) {
              if (!backupData) backupData = {};
              const existingPages = Array.isArray(backupData.qrHostedPages) ? backupData.qrHostedPages : [];
              const pageMap = new Map();
              for (const p of [...existingPages, ...hostedPages]) {
                if (p?.id) pageMap.set(p.id, p);
              }
              backupData.qrHostedPages = Array.from(pageMap.values());
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

    // 5. Try serving exact static asset from ASSETS binding
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

    // 6. SPA Fallback: Serve /index.html for client-side React routes with pre-injected QR data
    try {
      const indexUrl = new URL('/index.html', url.origin);
      const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
      let html = await indexResponse.text();

      // Check if this is a QR customer request or request with email / qr params
      const isQrRoute =
        url.pathname.includes('/qr') ||
        url.searchParams.has('qr') ||
        url.searchParams.has('email') ||
        url.searchParams.has('u') ||
        url.searchParams.has('user') ||
        url.searchParams.has('event') ||
        url.searchParams.has('website') ||
        url.searchParams.has('social') ||
        url.pathname.includes('/menu') ||
        url.pathname === '/' ||

        url.pathname === '';

      const emailParam = (
        url.searchParams.get('email') ||
        url.searchParams.get('u') ||
        url.searchParams.get('user') ||
        url.searchParams.get('user_id') ||
        request.headers.get('X-User-Email') ||
        request.headers.get('X-User-Id') ||
        ''
      ).toLowerCase().trim();

      let pageIdParam = url.searchParams.get('qr') || url.searchParams.get('event') || url.searchParams.get('website') || url.searchParams.get('social') || '';
      if (!pageIdParam && url.pathname.includes('/qr/')) {
        pageIdParam = decodeURIComponent(url.pathname.split('/qr/')[1]?.split('?')[0]?.split('/')[0] || '').trim();
      }
      if (!pageIdParam && isQrRoute) {
        pageIdParam = 'latest';
      }

      if (isQrRoute) {
        try {
          const preloadedPage = await resolveHostedQrPage(env, pageIdParam, emailParam);
          const hasItems = (p: any): boolean => {
            if (!p) return false;
            if (Array.isArray(p.websitesQrItems) && p.websitesQrItems.length > 0) return true;
            if (Array.isArray(p.socialsQrItems) && p.socialsQrItems.length > 0) return true;
            if (Array.isArray(p.eventsQrItems) && p.eventsQrItems.length > 0) return true;
            if (Array.isArray(p.menuItems) && p.menuItems.length > 0) return true;
            if (Array.isArray(p.photos) && p.photos.length > 0) return true;
            return false;
          };

          if (preloadedPage && hasItems(preloadedPage)) {
            const resolvedEmail = emailParam || preloadedPage.userEmail || preloadedPage.email || '';
            const scriptTag = `<script id="__INITIAL_QR_DATA__">window.__INITIAL_QR_PAGE__=${JSON.stringify(preloadedPage)};window.__OWNER_EMAIL__=${JSON.stringify(resolvedEmail)};</script>`;
            if (html.includes('</head>')) {
              html = html.replace('</head>', `${scriptTag}</head>`);
            } else {
              html = `${scriptTag}${html}`;
            }
            if (preloadedPage.title) {
              html = html.replace(/<title>.*?<\/title>/i, `<title>${preloadedPage.title} | Brivu</title>`);
            }
          }
        } catch (_) {}
      }

      const newHeaders = new Headers(indexResponse.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
      newHeaders.set('Content-Type', 'text/html; charset=utf-8');
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
