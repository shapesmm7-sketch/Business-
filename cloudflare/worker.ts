/**
 * Cloudflare Worker for Brivu App
 * Provides D1 SQL Database Sync & R2 File Object Storage
 */

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = any>(colName?: string): Promise<T | null>;
  run<T = any>(): Promise<{ success: boolean; results?: T[] }>;
  all<T = any>(): Promise<{ success: boolean; results?: T[] }>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = any>(statements: D1PreparedStatement[]): Promise<{ success: boolean; results?: T[] }[]>;
  exec(query: string): Promise<any>;
}

export interface R2HttpMetadata {
  contentType?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentEncoding?: string;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  httpMetadata?: R2HttpMetadata;
  customMetadata?: Record<string, string>;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T>(): Promise<T>;
  blob(): Promise<Blob>;
}

export interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob | null,
    options?: {
      httpMetadata?: R2HttpMetadata;
      customMetadata?: Record<string, string>;
    }
  ): Promise<R2Object>;
  delete(key: string | string[]): Promise<void>;
  list(options?: {
    prefix?: string;
    cursor?: string;
    delimiter?: string;
    limit?: number;
  }): Promise<R2Objects>;
}

export interface Env {
  DB?: D1Database;
  R2_BUCKET?: R2Bucket;
  SYNC_SECRET_KEY?: string;
  ENVIRONMENT?: string;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Filename, X-Mime-Type, X-Folder',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

function errorResponse(message: string, status = 400, details?: unknown): Response {
  return jsonResponse({ success: false, error: message, details }, status);
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.SYNC_SECRET_KEY || env.SYNC_SECRET_KEY.trim() === '') {
    return true; // No secret configured, allow public access
  }
  const syncKey = request.headers.get('X-Sync-Key');
  if (syncKey && syncKey === env.SYNC_SECRET_KEY) {
    return true;
  }
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token === env.SYNC_SECRET_KEY) {
      return true;
    }
  }
  return false;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // 1. Handle CORS Preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Health & Status Check
    if (url.pathname === '/' || url.pathname === '/api/health' || url.pathname === '/api/status') {
      const hasD1 = !!env.DB;
      const hasR2 = !!env.R2_BUCKET;

      let d1Status = 'not_bound';
      if (hasD1) {
        try {
          await env.DB!.prepare('SELECT 1').first();
          d1Status = 'connected';
        } catch (err: unknown) {
          d1Status = `error: ${err instanceof Error ? err.message : String(err)}`;
        }
      }

      let r2Status = 'not_bound';
      if (hasR2) {
        r2Status = 'connected';
      }

      return jsonResponse({
        status: 'ok',
        service: 'Brivu Cloudflare Worker',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        d1Bound: hasD1,
        r2Bound: hasR2,
        storage: {
          d1: d1Status,
          r2: r2Status,
        },
        requiresAuth: !!(env.SYNC_SECRET_KEY && env.SYNC_SECRET_KEY.trim() !== ''),
      });
    }

    // 3. Check Authentication for protected routes
    if (!checkAuth(request, env)) {
      return errorResponse('Unauthorized: Invalid or missing X-Sync-Key or Authorization header', 401);
    }

    // 4. File Download / Stream route (GET /api/files/:key*)
    // Matches /api/files/...
    if (method === 'GET' && url.pathname.startsWith('/api/files/') && url.pathname.length > '/api/files/'.length) {
      if (!env.R2_BUCKET) {
        return errorResponse('R2 Storage bucket is not bound to this worker. Check wrangler.toml', 503);
      }

      const key = decodeURIComponent(url.pathname.slice('/api/files/'.length));
      try {
        const object = await env.R2_BUCKET.get(key);
        if (!object) {
          return errorResponse(`File not found: ${key}`, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        // Extract filename from key
        const filename = key.split('/').pop() || 'file';
        if (!headers.has('content-disposition')) {
          headers.set('content-disposition', `inline; filename="${filename}"`);
        }
        if (!headers.has('content-type')) {
          headers.set('content-type', 'application/octet-stream');
        }

        return new Response(object.body, { headers });
      } catch (err: unknown) {
        return errorResponse(`Failed to retrieve file from R2: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 5. File Upload route (POST /api/files/upload)
    if (method === 'POST' && (url.pathname === '/api/files/upload' || url.pathname === '/api/files')) {
      if (!env.R2_BUCKET) {
        return errorResponse('R2 Storage bucket is not bound to this worker. Please bind R2_BUCKET in wrangler.toml', 503);
      }

      try {
        const contentType = request.headers.get('content-type') || '';
        let fileData: Uint8Array | ArrayBuffer | ReadableStream;
        let filename = request.headers.get('X-Filename') || `file_${Date.now()}`;
        let mimeType = request.headers.get('X-Mime-Type') || 'application/octet-stream';
        let folder = request.headers.get('X-Folder') || 'general';

        if (contentType.includes('multipart/form-data')) {
          // Handle standard HTML FormData upload
          const formData = await request.formData();
          const file = formData.get('file');
          if (!file || !(file instanceof File)) {
            return errorResponse('No file provided in form data under field "file"', 400);
          }
          filename = formData.get('filename')?.toString() || file.name || filename;
          mimeType = formData.get('mimeType')?.toString() || file.type || mimeType;
          folder = formData.get('folder')?.toString() || folder;
          fileData = await file.arrayBuffer();
        } else if (contentType.includes('application/json')) {
          // Handle JSON upload with Base64 payload
          const jsonBody = (await request.json()) as {
            filename?: string;
            data: string; // base64 or raw string
            mimeType?: string;
            folder?: string;
          };

          if (!jsonBody || !jsonBody.data) {
            return errorResponse('Missing "data" field in JSON body', 400);
          }

          filename = jsonBody.filename || filename;
          mimeType = jsonBody.mimeType || mimeType;
          folder = jsonBody.folder || folder;

          let rawBase64 = jsonBody.data;
          if (rawBase64.startsWith('data:')) {
            const commaIndex = rawBase64.indexOf(',');
            if (commaIndex !== -1) {
              const mimeMatch = rawBase64.slice(0, commaIndex).match(/:(.*?);/);
              if (mimeMatch && mimeMatch[1]) {
                mimeType = mimeMatch[1];
              }
              rawBase64 = rawBase64.slice(commaIndex + 1);
            }
          }

          // Decode base64 to binary Uint8Array
          const binaryString = atob(rawBase64);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          fileData = bytes;
        } else {
          // Raw stream body
          fileData = await request.arrayBuffer();
        }

        // Clean filename and generate unique R2 key
        const cleanFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
        const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const r2Key = `${cleanFolder}/${timestamp}_${cleanFilename}`;

        // Save object into R2 bucket
        await env.R2_BUCKET.put(r2Key, fileData, {
          httpMetadata: {
            contentType: mimeType,
            contentDisposition: `inline; filename="${cleanFilename}"`,
          },
          customMetadata: {
            originalFilename: filename,
            folder: cleanFolder,
            uploadedAt: new Date().toISOString(),
          },
        });

        // Determine public file URL via this worker
        const fileUrl = `${url.origin}/api/files/${encodeURIComponent(r2Key)}`;
        const fileSize = fileData instanceof Uint8Array ? fileData.byteLength : fileData instanceof ArrayBuffer ? fileData.byteLength : 0;

        // If D1 is bound, save file metadata
        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT OR REPLACE INTO files_meta (key, filename, mime_type, size, folder, r2_key, uploaded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            )
              .bind(r2Key, cleanFilename, mimeType, fileSize, cleanFolder, r2Key, new Date().toISOString())
              .run();
          } catch (dbErr) {
            console.warn('Could not record file meta in D1:', dbErr);
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
          uploadedAt: new Date().toISOString(),
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to upload file to R2: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 6. List Files route (GET /api/files)
    if (method === 'GET' && url.pathname === '/api/files') {
      if (!env.R2_BUCKET) {
        return errorResponse('R2 Storage bucket is not bound to this worker', 503);
      }

      try {
        const prefix = url.searchParams.get('prefix') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);

        // If D1 is bound, query files_meta for richer history
        if (env.DB) {
          try {
            const query = prefix
              ? env.DB.prepare('SELECT * FROM files_meta WHERE folder LIKE ? OR filename LIKE ? ORDER BY uploaded_at DESC LIMIT ?').bind(
                  `%${prefix}%`,
                  `%${prefix}%`,
                  limit
                )
              : env.DB.prepare('SELECT * FROM files_meta ORDER BY uploaded_at DESC LIMIT ?').bind(limit);

            const { results } = await query.all();
            const formatted = (results || []).map((row: any) => ({
              key: row.key,
              filename: row.filename,
              size: row.size,
              mimeType: row.mime_type,
              folder: row.folder,
              uploadedAt: row.uploaded_at,
              url: `${url.origin}/api/files/${encodeURIComponent(row.key)}`,
            }));

            return jsonResponse({
              success: true,
              files: formatted,
              source: 'd1_meta',
            });
          } catch (d1Err) {
            console.warn('D1 files_meta query failed, falling back to direct R2 list:', d1Err);
          }
        }

        // Direct R2 bucket list fallback
        const listed = await env.R2_BUCKET.list({
          prefix: prefix || undefined,
          limit,
        });

        const files = listed.objects.map((obj) => ({
          key: obj.key,
          filename: obj.key.split('/').pop() || obj.key,
          size: obj.size,
          uploadedAt: obj.uploaded.toISOString(),
          mimeType: obj.httpMetadata?.contentType || 'application/octet-stream',
          url: `${url.origin}/api/files/${encodeURIComponent(obj.key)}`,
        }));

        return jsonResponse({
          success: true,
          files,
          truncated: listed.truncated,
          source: 'r2_direct',
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to list files: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 7. Delete File route (DELETE /api/files/:key*)
    if (method === 'DELETE' && url.pathname.startsWith('/api/files/')) {
      if (!env.R2_BUCKET) {
        return errorResponse('R2 Storage bucket is not bound', 503);
      }

      const key = decodeURIComponent(url.pathname.slice('/api/files/'.length));
      try {
        await env.R2_BUCKET.delete(key);

        if (env.DB) {
          try {
            await env.DB.prepare('DELETE FROM files_meta WHERE key = ?').bind(key).run();
          } catch (d1Err) {
            console.warn('Could not remove file from D1 meta:', d1Err);
          }
        }

        return jsonResponse({
          success: true,
          message: `File ${key} deleted from Cloudflare R2`,
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to delete file from R2: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 8. D1 Sync Push: Save full application state & individual records to D1 (POST /api/sync/push)
    if (method === 'POST' && url.pathname === '/api/sync/push') {
      if (!env.DB) {
        return errorResponse('D1 Database is not bound to this worker. Please bind DB in wrangler.toml', 503);
      }

      try {
        const payload = (await request.json()) as any;
        if (!payload || typeof payload !== 'object') {
          return errorResponse('Invalid sync payload', 400);
        }

        const now = new Date().toISOString();
        const backupData = payload.backupData || payload;

        // 8a. Upsert latest full snapshot into sync_snapshots table
        await env.DB.prepare(
          `INSERT OR REPLACE INTO sync_snapshots (id, exported_at, version, data_json, updated_at)
           VALUES ('latest', ?, ?, ?, ?)`
        )
          .bind(backupData.exportedAt || now, backupData.version || 1, JSON.stringify(backupData), now)
          .run();

        // 8b. Upsert individual receipts into receipts table if present
        let receiptsCount = 0;
        if (Array.isArray(backupData.receipts) && backupData.receipts.length > 0) {
          receiptsCount = backupData.receipts.length;
          // Batch insert receipts up to D1 statement limits
          const statements = backupData.receipts.slice(0, 100).map((r: any) =>
            env.DB!.prepare(
              `INSERT OR REPLACE INTO receipts 
               (id, receipt_number, document_type, customer_name, customer_phone, total, amount_paid, balance, payment_status, payment_method, created_at, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              r.id || `rec_${Date.now()}`,
              r.receiptNumber || '',
              r.documentType || 'receipt',
              r.customerName || null,
              r.customerPhone || null,
              typeof r.total === 'number' ? r.total : 0,
              typeof r.amountPaid === 'number' ? r.amountPaid : 0,
              typeof r.balance === 'number' ? r.balance : 0,
              r.paymentStatus || 'paid',
              r.paymentMethod || 'Cash',
              r.createdAt || now,
              JSON.stringify(r),
              now
            )
          );

          if (statements.length > 0) {
            await env.DB.batch(statements);
          }
        }

        // 8c. Upsert business profile if present
        if (backupData.profile) {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO business_profile (id, name, currency, data_json, updated_at)
             VALUES ('current', ?, ?, ?, ?)`
          )
            .bind(backupData.profile.name || '', backupData.profile.currency || 'UGX', JSON.stringify(backupData.profile), now)
            .run();
        }

        // 8d. Upsert app settings if present
        if (backupData.settings) {
          await env.DB.prepare(
            `INSERT OR REPLACE INTO app_settings (id, data_json, updated_at)
             VALUES ('current', ?, ?)`
          )
            .bind(JSON.stringify(backupData.settings), now)
            .run();
        }

        // 8e. Upsert inventory products if present
        if (Array.isArray(backupData.inventoryProducts) && backupData.inventoryProducts.length > 0) {
          const prodStatements = backupData.inventoryProducts.slice(0, 50).map((p: any) =>
            env.DB!.prepare(
              `INSERT OR REPLACE INTO inventory_products (id, name, quantity, cost_price, selling_price, category_id, data_json, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              p.id,
              p.name,
              p.quantity || 0,
              p.costPrice || 0,
              p.sellingPrice || 0,
              p.categoryId || null,
              JSON.stringify(p),
              now
            )
          );
          if (prodStatements.length > 0) {
            await env.DB.batch(prodStatements);
          }
        }

        return jsonResponse({
          success: true,
          message: 'All information successfully synced and saved to Cloudflare D1',
          timestamp: now,
          receiptsSaved: receiptsCount,
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to sync data to D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 9. D1 Sync Pull: Retrieve latest application state from D1 (GET /api/sync/pull)
    if (method === 'GET' && url.pathname === '/api/sync/pull') {
      if (!env.DB) {
        return errorResponse('D1 Database is not bound to this worker', 503);
      }

      try {
        const snapshot = await env.DB.prepare('SELECT * FROM sync_snapshots WHERE id = ?').bind('latest').first();

        if (!snapshot || !snapshot.data_json) {
          // If no full snapshot exists, try constructing from individual tables
          const receiptsQuery = await env.DB.prepare('SELECT data_json FROM receipts ORDER BY created_at DESC').all();
          const receipts = (receiptsQuery.results || []).map((r: any) => JSON.parse(r.data_json));

          const profileQuery = await env.DB.prepare('SELECT data_json FROM business_profile WHERE id = ?').bind('current').first();
          const profile = profileQuery?.data_json ? JSON.parse(profileQuery.data_json as string) : undefined;

          const settingsQuery = await env.DB.prepare('SELECT data_json FROM app_settings WHERE id = ?').bind('current').first();
          const settings = settingsQuery?.data_json ? JSON.parse(settingsQuery.data_json as string) : undefined;

          return jsonResponse({
            success: true,
            backupData: {
              version: 1,
              exportedAt: new Date().toISOString(),
              receipts,
              profile,
              settings,
            },
            source: 'individual_tables',
          });
        }

        const parsedData = JSON.parse(snapshot.data_json as string);
        return jsonResponse({
          success: true,
          backupData: parsedData,
          updatedAt: snapshot.updated_at,
          source: 'snapshot',
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to pull data from D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 10. Single Receipt upsert (POST /api/receipts)
    if (method === 'POST' && url.pathname === '/api/receipts') {
      if (!env.DB) {
        return errorResponse('D1 Database is not bound', 503);
      }

      try {
        const receipt = (await request.json()) as any;
        if (!receipt || !receipt.id || !receipt.receiptNumber) {
          return errorResponse('Invalid receipt data. Must include id and receiptNumber', 400);
        }

        const now = new Date().toISOString();
        await env.DB.prepare(
          `INSERT OR REPLACE INTO receipts 
           (id, receipt_number, document_type, customer_name, customer_phone, total, amount_paid, balance, payment_status, payment_method, created_at, data_json, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            receipt.id,
            receipt.receiptNumber,
            receipt.documentType || 'receipt',
            receipt.customerName || null,
            receipt.customerPhone || null,
            receipt.total || 0,
            receipt.amountPaid || 0,
            receipt.balance || 0,
            receipt.paymentStatus || 'paid',
            receipt.paymentMethod || 'Cash',
            receipt.createdAt || now,
            JSON.stringify(receipt),
            now
          )
          .run();

        return jsonResponse({
          success: true,
          message: `Receipt ${receipt.receiptNumber} saved to Cloudflare D1`,
          id: receipt.id,
          receiptNumber: receipt.receiptNumber,
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to save receipt to D1: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    // 11. List receipts (GET /api/receipts)
    if (method === 'GET' && url.pathname === '/api/receipts') {
      if (!env.DB) {
        return errorResponse('D1 Database is not bound', 503);
      }

      try {
        const limit = parseInt(url.searchParams.get('limit') || '100', 10);
        const docType = url.searchParams.get('type');

        const query = docType
          ? env.DB.prepare('SELECT * FROM receipts WHERE document_type = ? ORDER BY created_at DESC LIMIT ?').bind(docType, limit)
          : env.DB.prepare('SELECT * FROM receipts ORDER BY created_at DESC LIMIT ?').bind(limit);

        const { results } = await query.all();
        const receipts = (results || []).map((row: any) => {
          try {
            return JSON.parse(row.data_json);
          } catch {
            return {
              id: row.id,
              receiptNumber: row.receipt_number,
              documentType: row.document_type,
              customerName: row.customer_name,
              total: row.total,
              createdAt: row.created_at,
            };
          }
        });

        return jsonResponse({
          success: true,
          count: receipts.length,
          receipts,
        });
      } catch (err: unknown) {
        return errorResponse(`Failed to query receipts: ${err instanceof Error ? err.message : String(err)}`, 500);
      }
    }

    return errorResponse(`Endpoint not found: ${method} ${url.pathname}`, 404);
  },
};
