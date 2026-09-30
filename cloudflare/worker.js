// cloudflare/worker.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Sync-Key, X-Filename, X-Mime-Type, X-Folder",
  "Access-Control-Max-Age": "86400"
};
function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}
function htmlResponse(html, status = 200, extraHeaders = {}) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      ...CORS_HEADERS,
      ...extraHeaders
    }
  });
}
function errorResponse(message, status = 400, details) {
  return jsonResponse({ success: false, error: message, details }, status);
}
function checkAuth(request, env) {
  if (!env.SYNC_SECRET_KEY || env.SYNC_SECRET_KEY.trim() === "") {
    return true;
  }
  const syncKey = request.headers.get("X-Sync-Key");
  if (syncKey && syncKey === env.SYNC_SECRET_KEY) {
    return true;
  }
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === env.SYNC_SECRET_KEY) {
      return true;
    }
  }
  return false;
}
var dbInitialized = false;
async function ensureTables(db) {
  if (!db || dbInitialized) return;
  try {
    await db.exec(`
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
    `);
    dbInitialized = true;
  } catch (err) {
    console.warn("Auto D1 table creation warning:", err);
  }
}
async function getHostedQrPage(env, pageId) {
  if (env.DB) {
    try {
      const row = await env.DB.prepare("SELECT data_json FROM qr_pages WHERE id = ?").bind(pageId).first();
      if (row?.data_json) {
        return JSON.parse(row.data_json);
      }
    } catch {
    }
    try {
      const snap = await env.DB.prepare("SELECT data_json FROM sync_snapshots WHERE id = ?").bind("latest").first();
      if (snap?.data_json) {
        const backup = JSON.parse(snap.data_json);
        if (Array.isArray(backup.qrHostedPages)) {
          const found = backup.qrHostedPages.find((p) => p.id === pageId);
          if (found) return found;
          if (pageId === "default" || backup.qrHostedPages.length === 1) {
            return backup.qrHostedPages[0];
          }
        }
      }
    } catch {
    }
  }
  return null;
}
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function renderCustomerPageHtml(page, options = {}) {
  const title = page.title || "Digital Showcase & Hub";
  const tagline = page.tagline || page.description || "Welcome! Browse our items & details.";
  const currency = page.currency || "UGX";
  const logo = page.logo || "";
  const coverImage = page.coverImage || "";
  const phone = page.phone || "";
  const whatsapp = page.whatsapp || page.phone || "";
  const cleanWa = whatsapp.replace(/[^0-9]/g, "");
  const email = page.email || "";
  const announcement = page.announcement || "";
  const address = page.address || "";
  const openingHours = page.openingHours || "";
  const wifiName = page.wifiName || "";
  const wifiPassword = page.wifiPassword || "";
  const menuItems = Array.isArray(page.menuItems) ? page.menuItems : [];
  const photos = Array.isArray(page.photos) ? page.photos : [];
  const categories = Array.isArray(page.menuCategories) && page.menuCategories.length > 0 ? page.menuCategories : ["All"];
  const allowWhatsAppOrdering = page.allowWhatsAppOrdering !== false;
  const pageDataJson = JSON.stringify(page).replace(/</g, "\\u003c");
  const initialItemIdStr = options.initialItemId ? escapeHtml(options.initialItemId) : "";
  const initialPhotoIdStr = options.initialPhotoId ? escapeHtml(options.initialPhotoId) : "";
  const initialTabStr = options.initialTab ? escapeHtml(options.initialTab) : "";
  return `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(title)} | Items & Digital Showcase</title>
  <meta name="description" content="${escapeHtml(tagline)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(tagline)}">
  ${logo ? `<meta property="og:image" content="${escapeHtml(logo)}">` : ""}
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; }
    .no-scrollbar::-webkit-scrollbar { display: none; }
    .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  </style>
</head>
<body class="bg-slate-50 text-slate-900 antialiased min-h-screen pb-28">

  <!-- TOP HERO HEADER -->
  <header class="relative bg-slate-900 text-white overflow-hidden shadow-lg">
    ${coverImage ? `<div class="absolute inset-0 bg-cover bg-center opacity-35 filter blur-[1px] scale-105 transition duration-700" style="background-image: url('${escapeHtml(coverImage)}');"></div>` : `<div class="absolute inset-0 bg-gradient-to-br from-emerald-950 via-slate-900 to-indigo-950 opacity-95"></div>`}
    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent"></div>

    <div class="relative max-w-2xl mx-auto px-4 pt-8 pb-6">
      <div class="flex items-start gap-4">
        ${logo ? `<img src="${escapeHtml(logo)}" alt="Logo" class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-white/10 border-2 border-white/20 shadow-xl shrink-0" />` : `<div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white/15 border-2 border-white/20 flex items-center justify-center font-black text-2xl shrink-0 text-emerald-400 shadow-xl">${escapeHtml(title.slice(0, 2).toUpperCase())}</div>`}
        <div class="flex-1 min-w-0">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold tracking-wide uppercase border border-emerald-500/30 mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Open for Guests</span>
          </div>
          <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">${escapeHtml(title)}</h1>
          <p class="text-xs sm:text-sm text-slate-300 font-medium mt-1 leading-snug line-clamp-2">${escapeHtml(tagline)}</p>
        </div>
      </div>

      <!-- Quick Action Buttons -->
      <div class="flex items-center gap-2 mt-5 overflow-x-auto no-scrollbar py-1">
        ${phone ? `<a href="tel:${escapeHtml(phone)}" class="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 border border-white/15 transition active:scale-95 shrink-0">
                <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                <span>Call Venue</span>
              </a>` : ""}
        ${cleanWa ? `<a href="https://wa.me/${cleanWa}?text=${encodeURIComponent(`Hello ${title}, I am browsing your items online!`)}" target="_blank" class="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition active:scale-95 shrink-0">
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.981.542 1.83.829 2.796.83h.005c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm0-1.872c4.214 0 7.636 3.422 7.637 7.638 0 4.215-3.422 7.637-7.637 7.637-.001 0-.003 0-.005 0-1.309 0-2.476-.35-3.504-.963l-4.522 1.186 1.207-4.407c-.687-1.077-1.076-2.316-1.076-3.453 0-4.216 3.422-7.638 7.637-7.638zm3.627 10.742c-.157.442-.916.848-1.282.902-.34.05-.768.082-2.348-.574-1.905-.791-3.13-2.73-3.226-2.858-.095-.128-.771-1.026-.771-1.956 0-.931.488-1.387.662-1.579.174-.191.38-.239.507-.239.127 0 .254.002.365.007.118.006.277-.044.433.332.16.386.547 1.334.595 1.431.048.097.08.21.016.337-.064.127-.096.206-.191.317-.095.111-.2.248-.286.333-.095.095-.195.199-.084.389.111.19.493.813 1.058 1.316.727.647 1.34.847 1.53.942.191.095.302.079.413-.048.111-.127.476-.555.603-.745.127-.19.254-.159.429-.095.174.063 1.111.524 1.302.619.19.095.317.143.365.222.048.079.048.46-.109.902z"/></svg>
                <span>WhatsApp</span>
              </a>` : ""}
        ${wifiName || wifiPassword ? `<button onclick="copyWifiPassword('${escapeHtml(wifiPassword)}')" class="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 border border-white/15 transition active:scale-95 shrink-0">
                <svg class="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>
                <span>Free WiFi</span>
              </button>` : ""}
        ${address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold backdrop-blur-md flex items-center gap-1.5 border border-white/15 transition active:scale-95 shrink-0">
                <svg class="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Find Us</span>
              </a>` : ""}
      </div>
    </div>
  </header>

  <!-- ANNOUNCEMENT BANNER -->
  ${announcement ? `<div class="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 font-medium flex items-center gap-2">
          <span class="text-amber-600 font-bold text-sm">\u2728</span>
          <p class="flex-1 font-semibold">${escapeHtml(announcement)}</p>
        </div>` : ""}

  <!-- NAVIGATION TABS -->
  <div class="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
    <div class="max-w-2xl mx-auto px-4">
      <div class="flex items-center justify-around">
        <button id="tab-btn-menu" onclick="switchTab('menu')" class="flex-1 py-3.5 text-center font-bold text-xs sm:text-sm border-b-2 border-emerald-600 text-emerald-700 transition flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
          <span>Items (${menuItems.length})</span>
        </button>
        <button id="tab-btn-photos" onclick="switchTab('photos')" class="flex-1 py-3.5 text-center font-bold text-xs sm:text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          <span>Gallery & Photos (${photos.length})</span>
        </button>
        <button id="tab-btn-about" onclick="switchTab('about')" class="flex-1 py-3.5 text-center font-bold text-xs sm:text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1.5">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          <span>About & Venue</span>
        </button>
      </div>
    </div>
  </div>

  <main class="max-w-2xl mx-auto px-4 pt-4">

    <!-- TAB 1: ITEMS & PRODUCTS -->
    <section id="tab-content-menu" class="space-y-4">
      <!-- Search & Category Filters -->
      <div class="space-y-3">
        <div class="relative">
          <input
            type="text"
            id="item-search-input"
            oninput="handleSearch(this.value)"
            placeholder="Search items, dishes, or specials..."
            class="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
          />
          <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 sm:top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>

        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1" id="category-pills-container">
          ${categories.map(
    (cat, idx) => `
            <button
              onclick="selectCategory('${escapeHtml(cat)}')"
              data-cat="${escapeHtml(cat)}"
              class="cat-pill px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 ${idx === 0 ? "bg-emerald-600 text-white shadow-sm shadow-emerald-600/20" : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"}"
            >
              ${escapeHtml(cat)}
            </button>
          `
  ).join("")}
        </div>
      </div>

      <!-- Items Grid: Big, prominent 2-column card grid matching app customer view -->
      <div id="items-grid" class="grid grid-cols-2 gap-3 sm:gap-4">
        <!-- Rendered via JS -->
      </div>
      <div id="no-items-state" class="hidden text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
        <p class="text-sm font-bold text-slate-700">No items found</p>
        <p class="text-xs text-slate-400 mt-1">Try another search keyword or category filter</p>
      </div>
    </section>

    <!-- TAB 2: PHOTOS GALLERY -->
    <section id="tab-content-photos" class="hidden space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" id="photos-grid">
        ${photos.map(
    (photo) => `
          <div onclick="openLightbox('${escapeHtml(photo.url)}', '${escapeHtml(photo.title || photo.description || "")}')" class="group relative rounded-2xl overflow-hidden bg-slate-200 aspect-[4/3] shadow-xs cursor-pointer border border-slate-200 hover:border-emerald-500/60 transition">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.title || "Photo")}" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
            <div class="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-2.5 flex items-end">
              <span class="text-white text-[11px] font-bold line-clamp-1">${escapeHtml(photo.title || photo.category || "")}</span>
            </div>
            ${photo.badge ? `<span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[9.5px] font-black uppercase tracking-wider shadow-xs">${escapeHtml(photo.badge)}</span>` : ""}
          </div>
        `
  ).join("")}
      </div>
      ${photos.length === 0 ? `<div class="text-center py-12 bg-white rounded-3xl border border-slate-200 p-6">
              <p class="text-sm font-bold text-slate-700">No photos in gallery yet</p>
            </div>` : ""}
    </section>

    <!-- TAB 3: ABOUT & INFO -->
    <section id="tab-content-about" class="hidden space-y-4">
      ${announcement ? `<div class="bg-gradient-to-br from-amber-50 via-amber-50/60 to-transparent border border-amber-200 rounded-3xl p-5 shadow-xs space-y-2">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-sm">
                  \u2728
                </div>
                <div>
                  <span class="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">Special Promo & Notice</span>
                  <h4 class="text-xs sm:text-sm font-bold text-amber-950 leading-snug">Active Special Offer</h4>
                </div>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-slate-800 pl-10 leading-relaxed whitespace-pre-line">
                ${escapeHtml(announcement)}
              </p>
            </div>` : ""}

      <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div>
          <h2 class="text-sm font-bold uppercase tracking-wider text-emerald-700 mb-1">About Us</h2>
          <p class="text-xs sm:text-sm text-slate-600 leading-relaxed">${escapeHtml(page.description || tagline)}</p>
        </div>

        ${phone || whatsapp || email ? `<div class="pt-4 border-t border-slate-100 space-y-3">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact & Helplines</h3>

                ${phone ? `<div class="flex items-center justify-between gap-3">
                        <div class="flex items-start gap-3 min-w-0">
                          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                          </div>
                          <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-slate-400">Phone Number / Voice Call</p>
                            <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">${escapeHtml(phone)}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button onclick="copyToClipboard('${escapeHtml(phone)}', 'Phone number copied!')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                            Copy
                          </button>
                          <a href="tel:${escapeHtml(phone)}" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Call</span>
                          </a>
                        </div>
                      </div>` : ""}

                ${whatsapp ? `<div class="flex items-center justify-between gap-3 ${phone ? "pt-3 border-t border-slate-100" : ""}">
                        <div class="flex items-start gap-3 min-w-0">
                          <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.981.542 1.83.829 2.796.83h.005c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm0-1.872c4.214 0 7.636 3.422 7.637 7.638 0 4.215-3.422 7.637-7.637 7.637-.001 0-.003 0-.005 0-1.309 0-2.476-.35-3.504-.963l-4.522 1.186 1.207-4.407c-.687-1.077-1.076-2.316-1.076-3.453 0-4.216 3.422-7.638 7.637-7.638zm3.627 10.742c-.157.442-.916.848-1.282.902-.34.05-.768.082-2.348-.574-1.905-.791-3.13-2.73-3.226-2.858-.095-.128-.771-1.026-.771-1.956 0-.931.488-1.387.662-1.579.174-.191.38-.239.507-.239.127 0 .254.002.365.007.118.006.277-.044.433.332.16.386.547 1.334.595 1.431.048.097.08.21.016.337-.064.127-.096.206-.191.317-.095.111-.2.248-.286.333-.095.095-.195.199-.084.389.111.19.493.813 1.058 1.316.727.647 1.34.847 1.53.942.191.095.302.079.413-.048.111-.127.476-.555.603-.745.127-.19.254-.159.429-.095.174.063 1.111.524 1.302.619.19.095.317.143.365.222.048.079.048.46-.109.902z"/></svg>
                          </div>
                          <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-slate-400">WhatsApp Direct Support</p>
                            <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">${escapeHtml(whatsapp)}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button onclick="copyToClipboard('${escapeHtml(whatsapp)}', 'WhatsApp number copied!')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                            Copy
                          </button>
                          <a href="https://wa.me/${cleanWa}" target="_blank" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Chat</span>
                          </a>
                        </div>
                      </div>` : ""}

                ${email ? `<div class="flex items-center justify-between gap-3 ${phone || whatsapp ? "pt-3 border-t border-slate-100" : ""}">
                        <div class="flex items-start gap-3 min-w-0">
                          <div class="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                          </div>
                          <div class="min-w-0">
                            <p class="text-[11px] font-semibold text-slate-400">Official Email</p>
                            <p class="text-xs sm:text-sm font-bold text-slate-900 truncate">${escapeHtml(email)}</p>
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <button onclick="copyToClipboard('${escapeHtml(email)}', 'Email address copied!')" class="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition">
                            Copy
                          </button>
                          <a href="mailto:${escapeHtml(email)}" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs">
                            <span>Email</span>
                          </a>
                        </div>
                      </div>` : ""}
              </div>` : ""}

        ${address ? `<div class="pt-3 border-t border-slate-100 flex items-start gap-3">
                <div class="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-slate-800">Physical Address</h3>
                  <p class="text-xs text-slate-600 mt-0.5">${escapeHtml(address)}</p>
                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" target="_blank" class="inline-block mt-1.5 text-xs font-bold text-emerald-600 hover:underline">Open in Google Maps &rarr;</a>
                </div>
              </div>` : ""}

        ${openingHours ? `<div class="pt-3 border-t border-slate-100 flex items-start gap-3">
                <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div>
                  <h3 class="text-xs font-bold text-slate-800">Working Hours</h3>
                  <p class="text-xs text-slate-600 mt-0.5">${escapeHtml(openingHours)}</p>
                </div>
              </div>` : ""}

        ${wifiName || wifiPassword ? `<div class="pt-3 border-t border-slate-100 flex items-start gap-3">
                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"/></svg>
                </div>
                <div class="flex-1">
                  <h3 class="text-xs font-bold text-slate-800">Guest Wi-Fi</h3>
                  <p class="text-xs text-slate-600 mt-0.5">Network: <strong class="text-slate-800">${escapeHtml(wifiName || "Guest WiFi")}</strong></p>
                  <p class="text-xs text-slate-600">Password: <strong class="text-slate-800 font-mono">${escapeHtml(wifiPassword || "None")}</strong></p>
                  ${wifiPassword ? `<button onclick="copyWifiPassword('${escapeHtml(wifiPassword)}')" class="mt-2 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[11px] font-bold border border-indigo-200 hover:bg-indigo-100 transition">Copy Password</button>` : ""}
                </div>
              </div>` : ""}
      </div>
    </section>

  </main>

  <!-- FLOATING ORDER TRAY BAR -->
  ${allowWhatsAppOrdering ? `<div id="floating-tray-bar" class="hidden fixed bottom-4 left-4 right-4 max-w-lg mx-auto z-40">
          <button onclick="toggleTrayDrawer(true)" class="w-full p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-2xl shadow-emerald-600/50 flex items-center justify-between transition active:scale-98">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center font-bold text-xs" id="tray-count-badge">0</div>
              <span class="text-xs sm:text-sm">View Current Order</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs sm:text-sm font-black" id="tray-total-display">${escapeHtml(currency)} 0</span>
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7"/></svg>
            </div>
          </button>
        </div>` : ""}

  <!-- TRAY DRAWER MODAL -->
  <div id="tray-drawer-backdrop" class="hidden fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 transition opacity-0" onclick="toggleTrayDrawer(false)"></div>
  <div id="tray-drawer" class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white rounded-t-3xl z-50 shadow-2xl p-5 transform translate-y-full transition duration-300 max-h-[85vh] flex flex-col">
    <div class="flex items-center justify-between pb-3 border-b border-slate-100">
      <div>
        <h3 class="text-base font-black text-slate-900">Your Order Tray</h3>
        <p class="text-[11px] text-slate-500">Review items before sending to WhatsApp</p>
      </div>
      <button onclick="toggleTrayDrawer(false)" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800">&times;</button>
    </div>

    <div class="flex-1 overflow-y-auto py-3 space-y-2.5 no-scrollbar" id="tray-items-list">
      <!-- Items populated via JS -->
    </div>

    <div class="pt-3 border-t border-slate-100 space-y-3">
      <div class="grid grid-cols-2 gap-2">
        <input type="text" id="order-table-number" placeholder="Table # / Room" class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <input type="text" id="order-customer-name" placeholder="Your Name" class="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      </div>
      <textarea id="order-notes" placeholder="Special instructions (e.g. less spicy, extra sauce)..." rows="1" class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"></textarea>

      <div class="flex items-center justify-between pt-1">
        <span class="text-xs font-bold text-slate-600">Total Amount:</span>
        <span class="text-base font-black text-emerald-700" id="tray-modal-total">${escapeHtml(currency)} 0</span>
      </div>

      <button onclick="sendOrderViaWhatsApp()" class="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition active:scale-98">
        <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.664-.699c.981.542 1.83.829 2.796.83h.005c3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.768-5.77-5.768zm0-1.872c4.214 0 7.636 3.422 7.637 7.638 0 4.215-3.422 7.637-7.637 7.637-.001 0-.003 0-.005 0-1.309 0-2.476-.35-3.504-.963l-4.522 1.186 1.207-4.407c-.687-1.077-1.076-2.316-1.076-3.453 0-4.216 3.422-7.638 7.637-7.638zm3.627 10.742c-.157.442-.916.848-1.282.902-.34.05-.768.082-2.348-.574-1.905-.791-3.13-2.73-3.226-2.858-.095-.128-.771-1.026-.771-1.956 0-.931.488-1.387.662-1.579.174-.191.38-.239.507-.239.127 0 .254.002.365.007.118.006.277-.044.433.332.16.386.547 1.334.595 1.431.048.097.08.21.016.337-.064.127-.096.206-.191.317-.095.111-.2.248-.286.333-.095.095-.195.199-.084.389.111.19.493.813 1.058 1.316.727.647 1.34.847 1.53.942.191.095.302.079.413-.048.111-.127.476-.555.603-.745.127-.19.254-.159.429-.095.174.063 1.111.524 1.302.619.19.095.317.143.365.222.048.079.048.46-.109.902z"/></svg>
        <span>Send Order to WhatsApp</span>
      </button>
    </div>
  </div>

  <!-- FULLSCREEN ITEM DETAILS MODAL (MATCHING APP CUSTOMER VIEW) -->
  <div id="item-modal" class="hidden fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto" onclick="closeItemModal()">
    <div class="relative w-full max-w-lg bg-slate-900 text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col" onclick="event.stopPropagation()">
      <div class="overflow-y-auto flex-1" id="item-modal-body">
        <!-- Injected via openItemModal(itemId) -->
      </div>
      <div class="p-3 bg-black/40 border-t border-white/10 flex items-center justify-end">
        <button onclick="closeItemModal()" class="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs transition">
          Close
        </button>
      </div>
    </div>
  </div>

  <!-- LIGHTBOX MODAL -->
  <div id="lightbox-modal" class="hidden fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-md" onclick="closeLightbox()">
    <button class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center hover:bg-white/30">&times;</button>
    <div class="max-w-xl w-full text-center" onclick="event.stopPropagation()">
      <img id="lightbox-img" src="" alt="Fullscreen view" class="w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl mx-auto" />
      <p id="lightbox-caption" class="text-white text-sm font-semibold mt-3"></p>
    </div>
  </div>

  <!-- TOAST NOTIFICATION -->
  <div id="toast" class="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-bold shadow-xl transition-all duration-300 opacity-0 pointer-events-none transform -translate-y-4">
    Copied!
  </div>

  <!-- CLIENT LOGIC SCRIPT -->
  <script>
    const PAGE_DATA = ${pageDataJson};
    const CURRENCY = '${escapeHtml(currency)}';
    const WHATSAPP_NUMBER = '${escapeHtml(cleanWa)}';
    const INITIAL_ITEM_ID = '${initialItemIdStr}';
    const INITIAL_PHOTO_ID = '${initialPhotoIdStr}';
    const INITIAL_TAB = '${initialTabStr}';

    let currentCategory = 'All';
    let searchQuery = '';
    let tray = {}; // itemId -> { item, quantity }

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.classList.remove('opacity-0', '-translate-y-4', 'pointer-events-none');
      setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-4', 'pointer-events-none');
      }, 2500);
    }

    function copyWifiPassword(pw) {
      if (!pw) return;
      navigator.clipboard.writeText(pw).then(() => {
        showToast('WiFi Password Copied!');
      }).catch(() => {
        showToast('Password: ' + pw);
      });
    }

    function copyToClipboard(text, msg) {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        showToast(msg || 'Copied to clipboard!');
      }).catch(() => {
        showToast('Copied: ' + text);
      });
    }

    function switchTab(tab) {
      ['menu', 'photos', 'about'].forEach(t => {
        const btn = document.getElementById('tab-btn-' + t);
        const content = document.getElementById('tab-content-' + t);
        if (!btn || !content) return;
        if (t === tab) {
          btn.className = 'flex-1 py-3.5 text-center font-bold text-xs sm:text-sm border-b-2 border-emerald-600 text-emerald-700 transition flex items-center justify-center gap-1.5';
          content.classList.remove('hidden');
        } else {
          btn.className = 'flex-1 py-3.5 text-center font-bold text-xs sm:text-sm border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition flex items-center justify-center gap-1.5';
          content.classList.add('hidden');
        }
      });
    }

    function selectCategory(cat) {
      currentCategory = cat;
      document.querySelectorAll('.cat-pill').forEach(btn => {
        if (btn.getAttribute('data-cat') === cat) {
          btn.className = 'cat-pill px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20';
        } else {
          btn.className = 'cat-pill px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition active:scale-95 bg-white text-slate-600 hover:bg-slate-100 border border-slate-200';
        }
      });
      renderItems();
    }

    function handleSearch(val) {
      searchQuery = (val || '').toLowerCase().trim();
      renderItems();
    }

    function addToTray(itemId) {
      const item = (PAGE_DATA.menuItems || []).find(i => i.id === itemId);
      if (!item) return;
      if (tray[itemId]) {
        tray[itemId].quantity += 1;
      } else {
        tray[itemId] = { item, quantity: 1 };
      }
      updateTrayUI();
      renderItems();
      // If modal is open for this item, re-render modal footer
      if (currentOpenModalItemId === itemId) {
        openItemModal(itemId);
      }
      showToast('Added ' + item.name + ' to order!');
    }

    function changeQty(itemId, delta) {
      if (!tray[itemId]) return;
      tray[itemId].quantity += delta;
      if (tray[itemId].quantity <= 0) {
        delete tray[itemId];
      }
      updateTrayUI();
      renderItems();
      if (currentOpenModalItemId === itemId) {
        openItemModal(itemId);
      }
    }

    function updateTrayUI() {
      const items = Object.values(tray);
      let count = 0;
      let total = 0;

      items.forEach(t => {
        count += t.quantity;
        const price = t.item.hasPromo && t.item.promoPrice ? t.item.promoPrice : t.item.price;
        total += price * t.quantity;
      });

      const floatingBar = document.getElementById('floating-tray-bar');
      const countBadge = document.getElementById('tray-count-badge');
      const totalDisplay = document.getElementById('tray-total-display');
      const modalTotal = document.getElementById('tray-modal-total');
      const trayList = document.getElementById('tray-items-list');

      if (count > 0) {
        if (floatingBar) floatingBar.classList.remove('hidden');
        if (countBadge) countBadge.textContent = count;
        if (totalDisplay) totalDisplay.textContent = CURRENCY + ' ' + total.toLocaleString();
        if (modalTotal) modalTotal.textContent = CURRENCY + ' ' + total.toLocaleString();
      } else {
        if (floatingBar) floatingBar.classList.add('hidden');
        toggleTrayDrawer(false);
      }

      if (trayList) {
        if (items.length === 0) {
          trayList.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">Your order tray is empty.</p>';
        } else {
          trayList.innerHTML = items.map(t => {
            const price = t.item.hasPromo && t.item.promoPrice ? t.item.promoPrice : t.item.price;
            return '<div class="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">' +
              '<div class="flex-1 min-w-0 pr-2">' +
                '<h4 class="text-xs font-bold text-slate-900 truncate">' + t.item.name + '</h4>' +
                '<p class="text-[11px] font-semibold text-emerald-700">' + CURRENCY + ' ' + (price * t.quantity).toLocaleString() + '</p>' +
              '</div>' +
              '<div class="flex items-center gap-2 bg-white rounded-lg border border-slate-200 p-1 shrink-0">' +
                '<button onclick="changeQty(\\'' + t.item.id + '\\', -1)" class="w-6 h-6 rounded bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs hover:bg-slate-200">-</button>' +
                '<span class="text-xs font-black w-4 text-center">' + t.quantity + '</span>' +
                '<button onclick="changeQty(\\'' + t.item.id + '\\', 1)" class="w-6 h-6 rounded bg-emerald-600 text-white font-bold flex items-center justify-center text-xs hover:bg-emerald-500">+</button>' +
              '</div>' +
            '</div>';
          }).join('');
        }
      }
    }

    function toggleTrayDrawer(show) {
      const backdrop = document.getElementById('tray-drawer-backdrop');
      const drawer = document.getElementById('tray-drawer');
      if (show) {
        backdrop.classList.remove('hidden');
        setTimeout(() => backdrop.classList.remove('opacity-0'), 10);
        drawer.classList.remove('translate-y-full');
      } else {
        backdrop.classList.add('opacity-0');
        drawer.classList.add('translate-y-full');
        setTimeout(() => backdrop.classList.add('hidden'), 300);
      }
    }

    function sendOrderViaWhatsApp() {
      const items = Object.values(tray);
      if (items.length === 0) {
        showToast('Your tray is empty');
        return;
      }

      const tableNum = (document.getElementById('order-table-number')?.value || '').trim();
      const custName = (document.getElementById('order-customer-name')?.value || '').trim();
      const notes = (document.getElementById('order-notes')?.value || '').trim();

      let msg = '*NEW ORDER - ' + PAGE_DATA.title + '*\\n';
      if (tableNum) msg += '\u{1F4CD} *Table/Room:* ' + tableNum + '\\n';
      if (custName) msg += '\u{1F464} *Customer:* ' + custName + '\\n';
      msg += '-------------------------\\n';

      let total = 0;
      items.forEach(t => {
        const price = t.item.hasPromo && t.item.promoPrice ? t.item.promoPrice : t.item.price;
        const itemTotal = price * t.quantity;
        total += itemTotal;
        msg += '\u2022 ' + t.quantity + 'x ' + t.item.name + ' - ' + CURRENCY + ' ' + itemTotal.toLocaleString() + '\\n';
      });

      msg += '-------------------------\\n';
      msg += '*TOTAL: ' + CURRENCY + ' ' + total.toLocaleString() + '*\\n';

      if (notes) {
        msg += '\u{1F4DD} *Notes:* ' + notes + '\\n';
      }

      const waUrl = 'https://wa.me/' + (WHATSAPP_NUMBER || '') + '?text=' + encodeURIComponent(msg);
      window.open(waUrl, '_blank');
    }

    function openLightbox(url, caption) {
      document.getElementById('lightbox-img').src = url;
      document.getElementById('lightbox-caption').textContent = caption;
      document.getElementById('lightbox-modal').classList.remove('hidden');
    }

    function closeLightbox() {
      document.getElementById('lightbox-modal').classList.add('hidden');
    }

    let currentOpenModalItemId = null;

    function openItemModal(itemId) {
      const item = (PAGE_DATA.menuItems || []).find(i => i.id === itemId);
      if (!item) return;

      currentOpenModalItemId = itemId;
      const inTray = tray[item.id]?.quantity || 0;
      const hasPromo = item.hasPromo && item.promoPrice && item.promoPrice < item.price;
      const displayPrice = hasPromo ? item.promoPrice : item.price;
      const modalBody = document.getElementById('item-modal-body');

      let promoBannerHtml = '';
      if (hasPromo) {
        const savings = item.price - item.promoPrice;
        let dateRange = 'Limited-time special offer';
        if (item.promoStartDate && item.promoEndDate) {
          dateRange = 'Valid from ' + item.promoStartDate + ' to ' + item.promoEndDate;
        } else if (item.promoEndDate) {
          dateRange = 'Ends on ' + item.promoEndDate;
        }
        promoBannerHtml = '<div class="p-3 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex flex-col gap-2">' +
          '<div class="flex items-center justify-between gap-3">' +
            '<div class="flex items-center gap-2.5">' +
              '<div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 font-bold text-sm">\u{1F525}</div>' +
              '<div>' +
                '<p class="text-xs font-bold text-amber-300">Special Promotion Active</p>' +
                '<p class="text-[11px] text-slate-300">' + dateRange + '</p>' +
              '</div>' +
            '</div>' +
            '<span class="shrink-0 text-[11px] font-extrabold text-amber-200 px-2 py-1 rounded-lg bg-amber-500/30 border border-amber-500/40">SAVE ' + CURRENCY + ' ' + savings.toLocaleString() + '</span>' +
          '</div>' +
          (item.promoDescription ? '<div class="pt-2 border-t border-amber-500/20 text-xs text-amber-200/90 font-medium">\\"' + item.promoDescription + '\\"</div>' : '') +
        '</div>';
      }

      let tagsHtml = '';
      const tagsList = Array.isArray(item.tags) ? item.tags : [];
      if (item.isSpicy && !tagsList.includes('Spicy')) tagsList.push('Spicy');
      if (item.isVegetarian && !tagsList.includes('Vegetarian')) tagsList.push('Vegetarian');
      if (item.isSpecial && !tagsList.includes('Special')) tagsList.push('Special');

      if (tagsList.length > 0) {
        tagsHtml = '<div class="flex flex-wrap gap-1.5">' +
          tagsList.map(t => '<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-slate-200 border border-white/10">' + t + '</span>').join('') +
        '</div>';
      }

      let actionRowHtml = '';
      if (inTray > 0) {
        actionRowHtml = '<div class="flex items-center gap-2 bg-white/10 rounded-xl p-1 border border-white/10">' +
          '<button onclick="changeQty(\\'' + item.id + '\\', -1)" class="w-8 h-8 rounded-lg bg-white/20 text-white flex items-center justify-center font-bold hover:bg-white/30 active:scale-95">-</button>' +
          '<span class="text-sm font-bold text-emerald-300 px-2 font-mono">' + inTray + '</span>' +
          '<button onclick="addToTray(\\'' + item.id + '\\')" class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold hover:bg-emerald-500 active:scale-95">+</button>' +
        '</div>';
      } else {
        actionRowHtml = '<button onclick="addToTray(\\'' + item.id + '\\')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 active:scale-95 transition">' +
          '<span>+ Add to Order</span>' +
        '</button>';
      }

      modalBody.innerHTML =
        (item.photoUrl ?
          '<div class="w-full bg-slate-950 flex items-center justify-center p-3 sm:p-4 cursor-zoom-in group relative" onclick="openLightbox(\\'' + item.photoUrl + '\\', \\'' + item.name + '\\')">' +
            '<img src="' + item.photoUrl + '" alt="' + item.name + '" class="w-full h-auto max-h-72 object-cover rounded-2xl shadow-xl border border-white/10 group-hover:scale-[1.01] transition-transform duration-300" />' +
            '<div class="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-2xl m-3 sm:m-4">' +
              '<span class="px-3 py-1.5 rounded-full bg-black/75 text-white text-xs font-bold backdrop-blur-xs flex items-center gap-1.5">View Full Photo</span>' +
            '</div>' +
          '</div>' : '') +
        '<div class="p-5 sm:p-6 space-y-4">' +
          '<div class="flex flex-wrap items-center justify-between gap-2">' +
            '<div class="flex items-center gap-2">' +
              (item.category ? '<span class="px-2.5 py-0.5 rounded-full bg-white/10 text-emerald-400 text-xs font-bold uppercase tracking-wider border border-white/10">' + item.category + '</span>' : '') +
              (item.isAvailable !== false ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Available</span>' : '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-xs font-semibold"><span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>Currently Unavailable</span>') +
            '</div>' +
            '<div class="flex flex-col items-end">' +
              (hasPromo ? '<span class="text-xl sm:text-2xl font-black text-amber-400 font-mono leading-tight">' + CURRENCY + ' ' + item.promoPrice.toLocaleString() + '</span><span class="text-xs line-through text-slate-400 font-medium">' + CURRENCY + ' ' + item.price.toLocaleString() + '</span>' : '<span class="text-xl sm:text-2xl font-black text-emerald-400 font-mono">' + CURRENCY + ' ' + (item.price || 0).toLocaleString() + '</span>') +
            '</div>' +
          '</div>' +

          '<h2 class="text-xl sm:text-2xl font-extrabold text-white leading-snug">' + item.name + '</h2>' +

          promoBannerHtml +
          tagsHtml +

          (item.description ? '<div class="space-y-1 pt-2 border-t border-white/10"><h4 class="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Item Description & Details</h4><p class="text-sm text-slate-200 leading-relaxed font-normal">' + item.description + '</p></div>' : '') +

          '<div class="pt-3 border-t border-white/10 flex items-center justify-between gap-3">' +
            '<div class="text-xs text-slate-400">' +
              (inTray > 0 ? '<span class="text-emerald-400 font-semibold">In your order (' + inTray + ')</span>' : '<span>Ready to order?</span>') +
            '</div>' +
            '<div>' + actionRowHtml + '</div>' +
          '</div>' +
        '</div>';

      document.getElementById('item-modal').classList.remove('hidden');
    }

    function closeItemModal() {
      currentOpenModalItemId = null;
      document.getElementById('item-modal').classList.add('hidden');
    }

    // Renders the 2-column large item cards matching the app customer view
    function renderItems() {
      const grid = document.getElementById('items-grid');
      const noItems = document.getElementById('no-items-state');
      const items = PAGE_DATA.menuItems || [];

      const filtered = items.filter(item => {
        const matchCat = currentCategory === 'All' || item.category === currentCategory;
        const matchSearch = !searchQuery ||
          (item.name || '').toLowerCase().includes(searchQuery) ||
          (item.description || '').toLowerCase().includes(searchQuery);
        return matchCat && matchSearch;
      });

      if (filtered.length === 0) {
        grid.innerHTML = '';
        noItems.classList.remove('hidden');
        return;
      }

      noItems.classList.add('hidden');
      grid.innerHTML = filtered.map(item => {
        const hasPromo = item.hasPromo && item.promoPrice && item.promoPrice < item.price;
        const displayPrice = hasPromo ? item.promoPrice : item.price;
        const inTray = tray[item.id]?.quantity || 0;

        let badgesOverlayHtml = '';
        if (hasPromo) {
          badgesOverlayHtml += '<span class="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[9.5px] font-bold shadow-xs uppercase tracking-wider flex items-center gap-0.5 backdrop-blur-xs">\u{1F525} Promo</span>';
        }
        if (Array.isArray(item.tags)) {
          item.tags.forEach(tag => {
            badgesOverlayHtml += '<span class="px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9.5px] font-bold shadow-xs uppercase tracking-wider backdrop-blur-xs">' + tag + '</span>';
          });
        }
        if (item.isSpecial) {
          badgesOverlayHtml += '<span class="px-2 py-0.5 rounded-md bg-indigo-600/90 text-white text-[9.5px] font-bold shadow-xs uppercase tracking-wider backdrop-blur-xs">\u2728 Special</span>';
        }

        let cartButtonHtml = '';
        if (PAGE_DATA.allowWhatsAppOrdering !== false) {
          if (inTray > 0) {
            cartButtonHtml = '<div class="w-full flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl p-1">' +
              '<button onclick="event.stopPropagation(); changeQty(\\'' + item.id + '\\', -1)" class="w-7 h-7 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold shadow-xs hover:bg-slate-100 text-sm active:scale-90" title="Decrease">-</button>' +
              '<div class="flex items-center gap-1 font-bold text-emerald-800 text-xs px-1">' +
                '<span class="font-mono font-black text-sm">' + inTray + '</span>' +
                '<span class="text-[10px] text-emerald-600 uppercase font-semibold">in order</span>' +
              '</div>' +
              '<button onclick="event.stopPropagation(); addToTray(\\'' + item.id + '\\')" class="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs hover:bg-emerald-500 text-sm active:scale-90" title="Increase">+</button>' +
            '</div>';
          } else {
            cartButtonHtml = '<button onclick="event.stopPropagation(); addToTray(\\'' + item.id + '\\')" class="w-full py-1.5 px-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 transition" title="Add to Order">' +
              '<svg class="w-3.5 h-3.5 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>' +
              '<span>+ Add to Order</span>' +
            '</button>';
          }
        }

        return '<div class="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-md transition duration-300 flex flex-col overflow-hidden group cursor-pointer" onclick="openItemModal(\\'' + item.id + '\\')">' +
          '<!-- Product Image Container: Large size matching app customer view -->' +
          '<div class="relative aspect-[3/4] sm:aspect-square bg-slate-100 overflow-hidden shrink-0">' +
            (item.photoUrl ?
              '<img src="' + item.photoUrl + '" alt="' + item.name + '" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />' :
              '<div class="w-full h-full flex flex-col items-center justify-center text-slate-300 p-4"><svg class="w-8 h-8 opacity-40 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg><span class="text-[10px] font-medium opacity-60">No Photo</span></div>'
            ) +
            (badgesOverlayHtml ? '<div class="absolute top-2 left-2 right-2 z-10 flex flex-wrap items-center gap-1">' + badgesOverlayHtml + '</div>' : '') +
          '</div>' +

          '<!-- Details Area -->' +
          '<div class="p-3 flex flex-col justify-between flex-1 min-w-0">' +
            '<div>' +
              '<h3 class="text-sm font-extrabold text-slate-900 leading-snug line-clamp-1 group-hover:text-emerald-600 transition" title="' + item.name + '">' + item.name + '</h3>' +
              (item.description ? '<p class="text-[11px] text-slate-500 font-normal line-clamp-2 mt-1 leading-normal">' + item.description + '</p>' : '') +
            '</div>' +

            '<div class="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-2">' +
              '<div class="flex items-baseline justify-between min-w-0">' +
                (hasPromo ?
                  '<div class="flex flex-col min-w-0">' +
                    '<span class="text-[10px] line-through text-slate-400 font-medium leading-none mb-0.5">' + CURRENCY + ' ' + (item.price || 0).toLocaleString() + '</span>' +
                    '<span class="text-xs sm:text-sm font-black text-amber-500 leading-tight truncate">' + CURRENCY + ' ' + (item.promoPrice || 0).toLocaleString() + '</span>' +
                  '</div>' :
                  '<span class="text-xs sm:text-sm font-black text-emerald-600 leading-tight truncate">' + CURRENCY + ' ' + (displayPrice || 0).toLocaleString() + '</span>'
                ) +
              '</div>' +
              (cartButtonHtml ? '<div class="w-full">' + cartButtonHtml + '</div>' : '') +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Initialize on page load
    document.addEventListener('DOMContentLoaded', () => {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab') || INITIAL_TAB;
      const itemIdParam = urlParams.get('item') || urlParams.get('itemId') || INITIAL_ITEM_ID;
      const photoIdParam = urlParams.get('photo') || urlParams.get('photoId') || INITIAL_PHOTO_ID;

      if (photoIdParam) {
        switchTab('photos');
        const photo = (PAGE_DATA.photos || []).find(p => p.id === photoIdParam);
        if (photo) {
          openLightbox(photo.url, photo.title || photo.description || '');
        }
      } else if (itemIdParam) {
        switchTab('menu');
        renderItems();
        openItemModal(itemIdParam);
      } else if (tabParam === 'photos' || tabParam === 'gallery') {
        switchTab('photos');
      } else if (tabParam === 'about' || tabParam === 'info') {
        switchTab('about');
      } else {
        switchTab('menu');
        renderItems();
      }
    });
  <\/script>
</body>
</html>`;
}
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS
      });
    }
    if (env.DB) {
      await ensureTables(env.DB);
    }
    if (url.pathname === "/api/health" || url.pathname === "/api/status") {
      const hasD1 = !!env.DB;
      const hasR2 = !!env.R2_BUCKET;
      let d1Status = "not_bound";
      if (hasD1) {
        try {
          await env.DB.prepare("SELECT 1").first();
          d1Status = "connected";
        } catch (err) {
          d1Status = `error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }
      let r2Status = "not_bound";
      if (hasR2) {
        r2Status = "connected";
      }
      return jsonResponse({
        status: "ok",
        service: "Brivu Cloudflare Worker",
        version: "1.3.0",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        d1Bound: hasD1,
        r2Bound: hasR2,
        storage: {
          d1: d1Status,
          r2: r2Status
        },
        requiresAuth: !!(env.SYNC_SECRET_KEY && env.SYNC_SECRET_KEY.trim() !== "")
      });
    }
    const isQrRoute = url.pathname.startsWith("/qr") || url.searchParams.has("qr") || url.pathname.startsWith("/p/");
    if (method === "GET" && isQrRoute) {
      let pageId = "";
      if (url.pathname.startsWith("/qr/")) {
        pageId = decodeURIComponent(url.pathname.slice("/qr/".length));
      } else if (url.pathname.startsWith("/p/")) {
        pageId = decodeURIComponent(url.pathname.slice("/p/".length));
      } else {
        pageId = url.searchParams.get("qr") || url.searchParams.get("id") || "default";
      }
      const format = url.searchParams.get("format");
      const acceptHeader = request.headers.get("accept") || "";
      const wantsJson = format === "json" || acceptHeader.includes("application/json");
      const page = await getHostedQrPage(env, pageId);
      if (!page) {
        if (wantsJson) {
          return errorResponse(`QR Page not found: ${pageId}`, 404);
        }
        return htmlResponse(
          `<div style="font-family:sans-serif;padding:40px;text-align:center;color:#334155;">
            <h2 style="font-size:24px;font-weight:bold;color:#0f172a;">Menu / QR Page Not Found</h2>
            <p style="margin-top:8px;font-size:14px;color:#64748b;">The requested page (<strong>${escapeHtml(pageId)}</strong>) has not been synced to Cloudflare yet.</p>
            <p style="margin-top:16px;font-size:12px;color:#94a3b8;">Please open your Brivu merchant app and tap <strong>Sync All to Cloudflare</strong> in Settings.</p>
          </div>`,
          404
        );
      }
      if (wantsJson) {
        return jsonResponse({ success: true, page });
      }
      const initialTab = url.searchParams.get("tab") || void 0;
      const initialItemId = url.searchParams.get("itemId") || url.searchParams.get("item") || void 0;
      const initialPhotoId = url.searchParams.get("photoId") || url.searchParams.get("photo") || void 0;
      const html = renderCustomerPageHtml(page, { initialTab, initialItemId, initialPhotoId });
      return htmlResponse(html);
    }
    if (method === "GET" && url.pathname.startsWith("/api/qr")) {
      let pageId = "";
      if (url.pathname.startsWith("/api/qr/")) {
        pageId = decodeURIComponent(url.pathname.slice("/api/qr/".length));
      } else {
        pageId = url.searchParams.get("id") || url.searchParams.get("qr") || "default";
      }
      const page = await getHostedQrPage(env, pageId);
      if (!page) {
        return errorResponse(`QR Page ${pageId} not found`, 404);
      }
      return jsonResponse({ success: true, page });
    }
    if (method === "GET" && url.pathname.startsWith("/api/files/") && url.pathname.length > "/api/files/".length) {
      if (!env.R2_BUCKET) {
        return errorResponse("R2 Storage bucket is not bound to this worker.", 503);
      }
      const key = decodeURIComponent(url.pathname.slice("/api/files/".length));
      try {
        const object = await env.R2_BUCKET.get(key);
        if (!object) {
          return errorResponse(`File not found: ${key}`, 404);
        }
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        const filename = key.split("/").pop() || "file";
        if (!headers.has("content-disposition")) {
          headers.set("content-disposition", `inline; filename="${filename}"`);
        }
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/octet-stream");
        }
        return new Response(object.body, { headers });
      } catch (err) {
        return errorResponse(`Failed to retrieve file from R2: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (!checkAuth(request, env)) {
      return errorResponse("Unauthorized: Invalid or missing X-Sync-Key or Authorization header", 401);
    }
    if (method === "GET" && url.pathname === "/api/files") {
      try {
        const prefix = url.searchParams.get("prefix") || "";
        let fileRecords = [];
        if (env.DB) {
          try {
            let query = "SELECT * FROM files_meta";
            const params = [];
            if (prefix) {
              query += " WHERE folder = ? OR key LIKE ?";
              params.push(prefix, `${prefix}%`);
            }
            query += " ORDER BY uploaded_at DESC LIMIT 150";
            const dbRes = await env.DB.prepare(query).bind(...params).all();
            if (dbRes.results && dbRes.results.length > 0) {
              fileRecords = dbRes.results.map((r) => ({
                key: r.key || r.r2_key,
                filename: r.filename,
                mimeType: r.mime_type,
                size: r.size,
                folder: r.folder,
                url: `${url.origin}/api/files/${encodeURIComponent(r.r2_key || r.key)}`,
                uploadedAt: r.uploaded_at
              }));
            }
          } catch (dbErr) {
            console.warn("files_meta table query note:", dbErr);
          }
        }
        if (fileRecords.length === 0 && env.R2_BUCKET) {
          const listRes = await env.R2_BUCKET.list({ prefix: prefix || void 0, limit: 150 });
          fileRecords = (listRes.objects || []).map((obj) => {
            const parts = obj.key.split("/");
            const filename = parts.pop() || obj.key;
            const folder = parts.join("/") || "receipts";
            return {
              key: obj.key,
              filename,
              mimeType: obj.httpMetadata?.contentType || "application/octet-stream",
              size: obj.size,
              folder,
              url: `${url.origin}/api/files/${encodeURIComponent(obj.key)}`,
              uploadedAt: obj.uploaded.toISOString()
            };
          });
        }
        return jsonResponse({
          success: true,
          files: fileRecords
        });
      } catch (err) {
        return errorResponse(`Failed to list files: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (method === "DELETE" && url.pathname.startsWith("/api/files/") && url.pathname.length > "/api/files/".length) {
      const key = decodeURIComponent(url.pathname.slice("/api/files/".length));
      try {
        if (env.R2_BUCKET) {
          await env.R2_BUCKET.delete(key);
        }
        if (env.DB) {
          try {
            await env.DB.prepare("DELETE FROM files_meta WHERE key = ? OR r2_key = ?").bind(key, key).run();
          } catch {
          }
        }
        return jsonResponse({
          success: true,
          message: `File "${key}" deleted successfully`
        });
      } catch (err) {
        return errorResponse(`Failed to delete file: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (method === "POST" && url.pathname === "/api/qr") {
      if (!env.DB) {
        return errorResponse("D1 Database is not bound", 503);
      }
      try {
        const page = await request.json();
        if (!page || !page.id) {
          return errorResponse("Invalid QR page data. Must include id.", 400);
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        await env.DB.prepare(
          `INSERT OR REPLACE INTO qr_pages (id, business_name, category, data_json, updated_at)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(page.id, page.title || "", page.pageType || "menu", JSON.stringify(page), now).run();
        return jsonResponse({
          success: true,
          message: `QR page "${page.title || page.id}" saved to Cloudflare D1`,
          id: page.id
        });
      } catch (err) {
        return errorResponse(`Failed to save QR page to D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (method === "POST" && (url.pathname === "/api/files/upload" || url.pathname === "/api/files")) {
      if (!env.R2_BUCKET) {
        return errorResponse("R2 Storage bucket is not bound to this worker.", 503);
      }
      try {
        const contentType = request.headers.get("content-type") || "";
        let fileData;
        let filename = request.headers.get("X-Filename") || `file_${Date.now()}`;
        let mimeType = request.headers.get("X-Mime-Type") || "application/octet-stream";
        let folder = request.headers.get("X-Folder") || "general";
        if (contentType.includes("multipart/form-data")) {
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file) {
            return errorResponse('No file provided in form data under field "file"', 400);
          }
          if (typeof file.name === "string" && file.name) {
            filename = formData.get("filename")?.toString() || file.name;
          }
          if (typeof file.type === "string" && file.type) {
            mimeType = formData.get("mimeType")?.toString() || file.type || mimeType;
          }
          folder = formData.get("folder")?.toString() || folder;
          if (typeof file.arrayBuffer === "function") {
            fileData = await file.arrayBuffer();
          } else {
            return errorResponse("Invalid file data format", 400);
          }
        } else if (contentType.includes("application/json")) {
          const jsonBody = await request.json();
          if (!jsonBody || !jsonBody.data) {
            return errorResponse('Missing "data" field in JSON body', 400);
          }
          filename = jsonBody.filename || filename;
          mimeType = jsonBody.mimeType || mimeType;
          folder = jsonBody.folder || folder;
          let rawBase64 = jsonBody.data;
          if (rawBase64.startsWith("data:")) {
            const commaIndex = rawBase64.indexOf(",");
            if (commaIndex !== -1) {
              const mimeMatch = rawBase64.slice(0, commaIndex).match(/:(.*?);/);
              if (mimeMatch && mimeMatch[1]) {
                mimeType = mimeMatch[1];
              }
              rawBase64 = rawBase64.slice(commaIndex + 1);
            }
          }
          rawBase64 = rawBase64.replace(/\s/g, "");
          if (typeof Buffer !== "undefined") {
            fileData = Buffer.from(rawBase64, "base64");
          } else {
            const binaryString = atob(rawBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            fileData = bytes;
          }
        } else {
          fileData = await request.arrayBuffer();
        }
        const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
        const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "_");
        const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
        const r2Key = `${cleanFolder}/${timestamp}_${cleanFilename}`;
        await env.R2_BUCKET.put(r2Key, fileData, {
          httpMetadata: {
            contentType: mimeType,
            contentDisposition: `inline; filename="${cleanFilename}"`
          },
          customMetadata: {
            originalFilename: filename,
            folder: cleanFolder,
            uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
          }
        });
        const fileUrl = `${url.origin}/api/files/${encodeURIComponent(r2Key)}`;
        const fileSize = fileData instanceof Uint8Array ? fileData.byteLength : fileData instanceof ArrayBuffer ? fileData.byteLength : 0;
        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT OR REPLACE INTO files_meta (key, filename, mime_type, size, folder, r2_key, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(r2Key, cleanFilename, mimeType, fileSize, cleanFolder, r2Key, (/* @__PURE__ */ new Date()).toISOString()).run();
          } catch (dbErr) {
            console.warn("Could not record file meta in D1:", dbErr);
          }
        }
        return jsonResponse({
          success: true,
          message: `File "${cleanFilename}" saved successfully to Cloudflare R2`,
          key: r2Key,
          filename: cleanFilename,
          folder: cleanFolder,
          mimeType,
          size: fileSize,
          url: fileUrl,
          uploadedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      } catch (err) {
        return errorResponse(`Failed to upload file to R2: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (method === "POST" && url.pathname === "/api/sync/push") {
      if (!env.DB) {
        return errorResponse("D1 Database is not bound to this worker.", 503);
      }
      try {
        const payload = await request.json();
        if (!payload || typeof payload !== "object") {
          return errorResponse("Invalid sync payload", 400);
        }
        const now = (/* @__PURE__ */ new Date()).toISOString();
        const backupData = payload.backupData || payload;
        await env.DB.prepare(
          `INSERT OR REPLACE INTO sync_snapshots (id, exported_at, version, data_json, updated_at)
           VALUES ('latest', ?, ?, ?, ?)`
        ).bind(backupData.exportedAt || now, backupData.version || 1, JSON.stringify(backupData), now).run();
        if (Array.isArray(backupData.receipts) && backupData.receipts.length > 0) {
          const statements = backupData.receipts.slice(0, 100).map(
            (r) => env.DB.prepare(
              `INSERT OR REPLACE INTO receipts 
               (id, receipt_number, document_type, customer_name, customer_phone, total, amount_paid, balance, payment_status, payment_method, created_at, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              r.id || `rec_${Date.now()}`,
              r.receiptNumber || "",
              r.documentType || "receipt",
              r.customerName || null,
              r.customerPhone || null,
              typeof r.total === "number" ? r.total : 0,
              typeof r.amountPaid === "number" ? r.amountPaid : 0,
              typeof r.balance === "number" ? r.balance : 0,
              r.paymentStatus || "paid",
              r.paymentMethod || "Cash",
              r.createdAt || now,
              JSON.stringify(r),
              now
            )
          );
          if (statements.length > 0) await env.DB.batch(statements);
        }
        if (Array.isArray(backupData.inventoryProducts) && backupData.inventoryProducts.length > 0) {
          const prodStatements = backupData.inventoryProducts.map(
            (p) => env.DB.prepare(
              `INSERT OR REPLACE INTO inventory_products (id, name, quantity, cost_price, selling_price, category_id, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              p.id,
              p.name || "",
              p.quantity || 0,
              p.costPrice || 0,
              p.sellingPrice || 0,
              p.categoryId || null,
              JSON.stringify(p),
              now
            )
          );
          if (prodStatements.length > 0) await env.DB.batch(prodStatements);
        }
        if (Array.isArray(backupData.inventorySales) && backupData.inventorySales.length > 0) {
          const saleStatements = backupData.inventorySales.map(
            (s) => env.DB.prepare(
              `INSERT OR REPLACE INTO inventory_sales (id, product_id, product_name, quantity, total_price, profit, date, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              s.id,
              s.productId || null,
              s.productName || "",
              s.quantity || 1,
              s.totalPrice || 0,
              s.profit || 0,
              s.date || now.slice(0, 10),
              JSON.stringify(s),
              s.createdAt || now
            )
          );
          if (saleStatements.length > 0) await env.DB.batch(saleStatements);
        }
        if (Array.isArray(backupData.inventoryExpenses) && backupData.inventoryExpenses.length > 0) {
          const expStatements = backupData.inventoryExpenses.map(
            (e) => env.DB.prepare(
              `INSERT OR REPLACE INTO inventory_expenses (id, category, amount, description, date, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              e.id,
              e.category || "",
              e.amount || 0,
              e.description || "",
              e.date || now.slice(0, 10),
              JSON.stringify(e),
              e.createdAt || now
            )
          );
          if (expStatements.length > 0) await env.DB.batch(expStatements);
        }
        if (Array.isArray(backupData.inventoryDebts) && backupData.inventoryDebts.length > 0) {
          const debtStatements = backupData.inventoryDebts.map(
            (d) => env.DB.prepare(
              `INSERT OR REPLACE INTO inventory_debts (id, customer_name, amount, status, due_date, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              d.id,
              d.customerName || "",
              d.amount || 0,
              d.status || "unpaid",
              d.dueDate || null,
              JSON.stringify(d),
              d.createdAt || now
            )
          );
          if (debtStatements.length > 0) await env.DB.batch(debtStatements);
        }
        if (Array.isArray(backupData.customers) && backupData.customers.length > 0) {
          const custStatements = backupData.customers.map(
            (c) => env.DB.prepare(
              `INSERT OR REPLACE INTO customers (id, name, contact, email, location, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              c.id,
              c.name || "",
              c.contact || "",
              c.email || null,
              c.location || null,
              JSON.stringify(c),
              now
            )
          );
          if (custStatements.length > 0) await env.DB.batch(custStatements);
        }
        if (Array.isArray(backupData.agents) && backupData.agents.length > 0) {
          const agentStatements = backupData.agents.map(
            (a) => env.DB.prepare(
              `INSERT OR REPLACE INTO agents (id, agent_name, shop_name, contact, address, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              a.id,
              a.agentName || "",
              a.shopName || null,
              a.contact || "",
              a.address || null,
              JSON.stringify(a),
              now
            )
          );
          if (agentStatements.length > 0) await env.DB.batch(agentStatements);
        }
        if (Array.isArray(backupData.agentLedger) && backupData.agentLedger.length > 0) {
          const ledgerStatements = backupData.agentLedger.map(
            (al) => env.DB.prepare(
              `INSERT OR REPLACE INTO agent_ledger (id, agent_id, record_type, amount, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              al.id,
              al.agentId || "",
              al.type || "stock_issue",
              al.amount || 0,
              JSON.stringify(al),
              al.createdAt || now
            )
          );
          if (ledgerStatements.length > 0) await env.DB.batch(ledgerStatements);
        }
        if (Array.isArray(backupData.workers) && backupData.workers.length > 0) {
          const workerStatements = backupData.workers.map(
            (w) => env.DB.prepare(
              `INSERT OR REPLACE INTO workers (id, name, phone, role, salary, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              w.id,
              w.name || "",
              w.phone || "",
              w.role || null,
              w.salary || 0,
              JSON.stringify(w),
              now
            )
          );
          if (workerStatements.length > 0) await env.DB.batch(workerStatements);
        }
        if (Array.isArray(backupData.staffSales) && backupData.staffSales.length > 0) {
          const staffSaleStatements = backupData.staffSales.map(
            (ss) => env.DB.prepare(
              `INSERT OR REPLACE INTO staff_sales (id, worker_id, worker_name, amount, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              ss.id,
              ss.workerId || "",
              ss.workerName || "",
              ss.amount || 0,
              JSON.stringify(ss),
              ss.createdAt || now
            )
          );
          if (staffSaleStatements.length > 0) await env.DB.batch(staffSaleStatements);
        }
        if (Array.isArray(backupData.shoppingListItems) && backupData.shoppingListItems.length > 0) {
          const shopStatements = backupData.shoppingListItems.map(
            (item) => env.DB.prepare(
              `INSERT OR REPLACE INTO shopping_list (id, item_name, quantity, checked, data_json, created_at)
               VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(
              item.id,
              item.name || "",
              item.quantity || 1,
              item.checked ? 1 : 0,
              JSON.stringify(item),
              item.createdAt || now
            )
          );
          if (shopStatements.length > 0) await env.DB.batch(shopStatements);
        }
        if (Array.isArray(backupData.qrHostedPages) && backupData.qrHostedPages.length > 0) {
          const qrStatements = backupData.qrHostedPages.map(
            (qp) => env.DB.prepare(
              `INSERT OR REPLACE INTO qr_pages (id, business_name, category, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?)`
            ).bind(
              qp.id,
              qp.title || "",
              qp.pageType || "menu",
              JSON.stringify(qp),
              now
            )
          );
          if (qrStatements.length > 0) await env.DB.batch(qrStatements);
        }
        if (backupData.profile) {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO business_profile (id, name, currency, data_json, updated_at)
             VALUES ('current', ?, ?, ?, ?)`
          ).bind(backupData.profile.name || "", backupData.profile.currency || "UGX", JSON.stringify(backupData.profile), now).run();
        }
        if (backupData.settings) {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO app_settings (id, data_json, updated_at)
             VALUES ('current', ?, ?)`
          ).bind(JSON.stringify(backupData.settings), now).run();
        }
        return jsonResponse({
          success: true,
          message: "All inventory, QR code hosting, receipts, and settings successfully saved to Cloudflare D1",
          timestamp: now
        });
      } catch (err) {
        return errorResponse(`Failed to sync data to D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (method === "GET" && url.pathname === "/api/sync/pull") {
      if (!env.DB) {
        return errorResponse("D1 Database is not bound to this worker", 503);
      }
      try {
        const snapshot = await env.DB.prepare("SELECT * FROM sync_snapshots WHERE id = ?").bind("latest").first();
        let backupData = {};
        if (snapshot && snapshot.data_json) {
          try {
            backupData = JSON.parse(snapshot.data_json);
          } catch {
          }
        }
        const queryTable = async (tableName, jsonCol = "data_json") => {
          try {
            const query = await env.DB.prepare(`SELECT ${jsonCol} FROM ${tableName}`).all();
            return (query.results || []).map((row) => {
              try {
                return JSON.parse(row[jsonCol]);
              } catch {
                return null;
              }
            }).filter(Boolean);
          } catch {
            return [];
          }
        };
        const dbReceipts = await queryTable("receipts");
        if (dbReceipts.length > 0) backupData.receipts = dbReceipts;
        const dbProducts = await queryTable("inventory_products");
        if (dbProducts.length > 0) backupData.inventoryProducts = dbProducts;
        const dbSales = await queryTable("inventory_sales");
        if (dbSales.length > 0) backupData.inventorySales = dbSales;
        const dbExpenses = await queryTable("inventory_expenses");
        if (dbExpenses.length > 0) backupData.inventoryExpenses = dbExpenses;
        const dbDebts = await queryTable("inventory_debts");
        if (dbDebts.length > 0) backupData.inventoryDebts = dbDebts;
        const dbCustomers = await queryTable("customers");
        if (dbCustomers.length > 0) backupData.customers = dbCustomers;
        const dbAgents = await queryTable("agents");
        if (dbAgents.length > 0) backupData.agents = dbAgents;
        const dbLedger = await queryTable("agent_ledger");
        if (dbLedger.length > 0) backupData.agentLedger = dbLedger;
        const dbWorkers = await queryTable("workers");
        if (dbWorkers.length > 0) backupData.workers = dbWorkers;
        const dbStaffSales = await queryTable("staff_sales");
        if (dbStaffSales.length > 0) backupData.staffSales = dbStaffSales;
        const dbShopping = await queryTable("shopping_list");
        if (dbShopping.length > 0) backupData.shoppingListItems = dbShopping;
        const dbQrPages = await queryTable("qr_pages");
        if (dbQrPages.length > 0) backupData.qrHostedPages = dbQrPages;
        return jsonResponse({
          success: true,
          backupData,
          updatedAt: snapshot?.updated_at || (/* @__PURE__ */ new Date()).toISOString(),
          source: "merged_d1"
        });
      } catch (err) {
        return errorResponse(`Failed to pull data from D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }
    if (url.pathname === "/") {
      return htmlResponse(`
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:60px auto;padding:32px;background:#ffffff;border-radius:24px;border:1px solid #e2e8f0;box-shadow:0 10px 25px -5px rgba(0,0,0,0.05);text-align:center;">
          <div style="display:inline-block;padding:8px 16px;background:#ecfdf5;color:#047857;border-radius:9999px;font-size:12px;font-weight:bold;margin-bottom:16px;">
            Brivu Cloudflare Worker is Active
          </div>
          <h1 style="font-size:24px;font-weight:800;color:#0f172a;margin:0 0 8px 0;">Brivu Cloud Backend & QR Hosting</h1>
          <p style="color:#64748b;font-size:14px;line-height:1.6;margin:0 0 24px 0;">
            This Cloudflare Worker powers D1 SQL Database Sync for all Inventory sections and QR Code Hosted web pages.
          </p>
        </div>
      `);
    }
    return errorResponse(`Endpoint not found: ${method} ${url.pathname}`, 404);
  }
};
export {
  worker_default as default
};
