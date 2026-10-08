export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
  DB?: any;
  brivu_db?: any;
  BUCKET?: any;
  brivu_bucket?: any;
  MY_BUCKET?: any;
  WORKOS_API_KEY?: string;
  WORKOS_CLIENT_ID?: string;
  WORKOS_REDIRECT_URI?: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Sync-Key, X-Requested-With, X-WorkOS-Client-Id, X-WorkOS-Api-Key',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Read WorkOS overrides from custom headers or search params
    const headerClientId = request.headers.get('X-WorkOS-Client-Id') || url.searchParams.get('workos_client_id');
    const headerApiKey = request.headers.get('X-WorkOS-Api-Key') || url.searchParams.get('workos_api_key');

    const workosClientId = (headerClientId || env.WORKOS_CLIENT_ID || 'client_01M4BGNT60CPMEA9P83WD6NRSB').trim().replace(/^['"]|['"]$/g, '');
    const workosApiKey = (headerApiKey || env.WORKOS_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

    // 1. Handle CORS Preflight OPTIONS requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: CORS_HEADERS,
      });
    }

    // 2. Health check endpoint (/api/health)
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'connected',
          d1Bound: Boolean(env.DB || env.brivu_db),
          r2Bound: Boolean(env.BUCKET || env.brivu_bucket || env.MY_BUCKET),
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

    // 2b. WorkOS Auth Authorize / Config endpoint (/api/auth/workos/authorize)
    if (url.pathname === '/api/auth/workos/authorize') {
      const redirectUri = url.searchParams.get('redirect_uri') || env.WORKOS_REDIRECT_URI || `${url.origin}`;
      const clientId = workosClientId || '';
      const isConfigured = Boolean(clientId && (workosApiKey || env.WORKOS_API_KEY));
      
      const authUrl = clientId
        ? `https://api.workos.com/user_management/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&provider=GoogleOAuth`
        : '';

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
          message: isConfigured
            ? 'WorkOS AuthKit Google Sign-In ready'
            : 'WorkOS variables pending in Cloudflare. You can add WORKOS_CLIENT_ID and WORKOS_API_KEY in Cloudflare Worker environment variables.',
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
        const { code, redirectUri } = body;
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;

        // Resolve clean API key and Client ID from request body, headers, or Cloudflare Worker env
        const cleanApiKey = (body?.workosApiKey || headerApiKey || env.WORKOS_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');
        const cleanClientId = (body?.workosClientId || headerClientId || env.WORKOS_CLIENT_ID || 'client_01M4BGNT60CPMEA9P83WD6NRSB').trim().replace(/^['"]|['"]$/g, '');

        if (!code) {
          return new Response(
            JSON.stringify({ ok: false, success: false, error: 'No authorization code received from Google Sign-In.' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        if (!cleanApiKey) {
          return new Response(
            JSON.stringify({
              ok: false,
              success: false,
              error: 'WORKOS_API_KEY is not configured in your Cloudflare Worker. Please ensure you saved and deployed WORKOS_API_KEY in your Cloudflare Worker environment variables, or enter it in App Settings -> WorkOS Diagnostics.'
            }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        let user: any = null;

        // Exchange authorization code with WorkOS API
        let workosRes = await fetch('https://api.workos.com/user_management/authenticate', {
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

        // If first attempt returned error, retry with just client_id and code using Bearer header
        if (!workosRes.ok) {
          try {
            const retryRes = await fetch('https://api.workos.com/user_management/authenticate', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanApiKey}`,
              },
              body: JSON.stringify({
                client_id: cleanClientId,
                code,
                grant_type: 'authorization_code',
              }),
            });
            if (retryRes.ok) {
              workosRes = retryRes;
            }
          } catch (_) {}
        }

        if (workosRes.ok) {
          const wData: any = await workosRes.json();
          const u = wData.user || wData;
          const firstName = u.first_name || u.firstName || '';
          const lastName = u.last_name || u.lastName || '';
          const email = u.email || '';
          const name = (u.name || `${firstName} ${lastName}`.trim() || email || 'Google User').trim();
          const profilePictureUrl = u.profile_picture_url || u.profilePictureUrl || u.avatar_url || '';
          const emailVerified = u.email_verified ?? u.emailVerified ?? true;

          user = {
            id: u.id || `workos_usr_${Date.now()}`,
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
          const errData: any = await workosRes.json().catch(() => null);
          const rawMsg = errData?.error_description || errData?.message || errData?.error || `WorkOS exchange failed (HTTP ${workosRes.status})`;
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

        if (user && user.email && bucket) {
          const userKey = `users/profile_${user.id || encodeURIComponent(user.email)}.json`;
          const emailKey = `users/email_${encodeURIComponent(user.email.toLowerCase())}.json`;
          
          user.syncedToCloudflare = true;
          user.cloudflareStoredAt = new Date().toISOString();

          await bucket.put(userKey, JSON.stringify(user), {
            httpMetadata: { contentType: 'application/json' },
          });
          await bucket.put(emailKey, JSON.stringify({ email: user.email, userId: user.id, user }), {
            httpMetadata: { contentType: 'application/json' },
          });

          // Update aggregated users list
          let usersList: any[] = [];
          try {
            const listObj = await bucket.get('users/all_users.json');
            if (listObj) {
              const text = await listObj.text();
              usersList = JSON.parse(text);
            }
          } catch {}

          const existingIdx = usersList.findIndex((u) => u.email === user.email || u.id === user.id);
          if (existingIdx >= 0) {
            usersList[existingIdx] = user;
          } else {
            usersList.push(user);
          }

          await bucket.put('users/all_users.json', JSON.stringify(usersList), {
            httpMetadata: { contentType: 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            user,
            storedInCloudflare: true,
            message: 'Authenticated and saved user profile & email in Cloudflare',
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
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
        const body: any = await request.json().catch(() => ({}));
        const { user, businessProfile, appData } = body;

        if (!user || !user.email) {
          return new Response(
            JSON.stringify({ ok: false, success: false, error: 'User email and details are required' }),
            { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
          );
        }

        const userPayload = {
          ...user,
          syncedToCloudflare: true,
          cloudflareStoredAt: new Date().toISOString(),
          businessProfile,
          appData,
        };

        if (bucket) {
          const userKey = `users/profile_${user.id || encodeURIComponent(user.email)}.json`;
          const emailKey = `users/email_${encodeURIComponent(user.email.toLowerCase())}.json`;
          const dataKey = `users/data_${user.id || encodeURIComponent(user.email)}.json`;

          await bucket.put(userKey, JSON.stringify(userPayload), {
            httpMetadata: { contentType: 'application/json' },
          });
          await bucket.put(emailKey, JSON.stringify({ email: user.email, userId: user.id, userPayload }), {
            httpMetadata: { contentType: 'application/json' },
          });
          if (appData || businessProfile) {
            await bucket.put(dataKey, JSON.stringify({ businessProfile, appData, updatedAt: new Date().toISOString() }), {
              httpMetadata: { contentType: 'application/json' },
            });
          }

          // Maintain list of all user profiles & emails stored in Cloudflare
          let allUsers: any[] = [];
          try {
            const listObj = await bucket.get('users/all_users.json');
            if (listObj) {
              allUsers = JSON.parse(await listObj.text());
            }
          } catch {}

          const idx = allUsers.findIndex((u) => u.email === user.email || u.id === user.id);
          const summaryRecord = {
            id: user.id,
            email: user.email,
            name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            provider: user.provider || 'google',
            syncedToCloudflare: true,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) {
            allUsers[idx] = summaryRecord;
          } else {
            allUsers.push(summaryRecord);
          }

          await bucket.put('users/all_users.json', JSON.stringify(allUsers), {
            httpMetadata: { contentType: 'application/json' },
          });
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'User profile, email, and data stored successfully in Cloudflare',
            user: userPayload,
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({ ok: false, success: false, error: String(err?.message || err) }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
        );
      }
    }

    // 2e. Get stored user profile from Cloudflare (/api/user/profile?email=... or ?id=...)
    if (url.pathname === '/api/user/profile' && request.method === 'GET') {
      const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
      const email = url.searchParams.get('email');
      const id = url.searchParams.get('id');

      if (bucket && (email || id)) {
        try {
          const key = id ? `users/profile_${id}.json` : `users/email_${encodeURIComponent(email!.toLowerCase())}.json`;
          const obj = await bucket.get(key);
          if (obj) {
            const data = JSON.parse(await obj.text());
            return new Response(JSON.stringify({ ok: true, success: true, user: data }), {
              status: 200,
              headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
            });
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({ ok: false, success: false, message: 'User profile not found in Cloudflare' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 2f. List all stored users & emails from Cloudflare (/api/users/all)
    if (url.pathname === '/api/users/all') {
      const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
      let users: any[] = [];
      if (bucket) {
        try {
          const obj = await bucket.get('users/all_users.json');
          if (obj) {
            users = JSON.parse(await obj.text());
          }
        } catch {}
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

    // 3. R2 File Upload endpoint (/api/files/upload)
    if (url.pathname === '/api/files/upload' && request.method === 'POST') {
      try {
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
        const body: any = await request.json().catch(() => ({}));
        const { filename, data, mimeType = 'application/octet-stream', folder = 'receipts' } = body;

        const cleanFilename = (filename || `file_${Date.now()}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const key = `${folder}/${Date.now()}_${cleanFilename}`;
        const publicUrl = `${url.origin}/api/files/${encodeURIComponent(key)}`;

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

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            url: publicUrl,
            key,
            filename: cleanFilename,
            size: data ? data.length : 0,
            message: `File ${cleanFilename} saved to Cloudflare R2`,
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

    // 4. File Download endpoint (/api/files/:key)
    if (url.pathname.startsWith('/api/files/')) {
      const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
      const key = decodeURIComponent(url.pathname.replace('/api/files/', ''));

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
    }

    // 5. QR Page Save endpoint (/api/qr)
    if (url.pathname === '/api/qr' && request.method === 'POST') {
      try {
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
        const page: any = await request.json().catch(() => ({}));
        if (page?.id && bucket) {
          const key = `qr_pages/${encodeURIComponent(page.id)}.json`;
          const text = JSON.stringify(page);
          await bucket.put(key, text, {
            httpMetadata: { contentType: 'application/json' },
          });
        }
        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: `QR page ${page?.id || ''} saved to Cloudflare`,
            data: { page },
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
      const pageId = decodeURIComponent(url.pathname.replace('/api/qr/', ''));
      const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;

      if (bucket && pageId) {
        try {
          const key = `qr_pages/${encodeURIComponent(pageId)}.json`;
          const object = await bucket.get(key);
          if (object) {
            const text = await object.text();
            const page = JSON.parse(text);
            return new Response(
              JSON.stringify({ ok: true, success: true, data: { page } }),
              {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              }
            );
          }

          // Fallback: Check if we have backup data with websitesQrItems for websites hub
          if (pageId.includes('websites-hub') || pageId.startsWith('websites') || pageId === 'websites-hub-all') {
            const backupObj = await bucket.get('sync/latest_backup.json');
            if (backupObj) {
              const bText = await backupObj.text();
              const bData = JSON.parse(bText);
              const websites = bData.websitesQrItems || [];
              const profile = bData.profile || {};
              const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

              const page = {
                id: pageId,
                title: 'Our Sites',
                tagline: undefined,
                description: `Official web links directory for ${profile.name || 'our company'}.`,
                pageType: 'websites_hub',
                accentColor: '#2563eb',
                theme: 'indigo',
                logo: profile.logo,
                phone: profile.phone || '',
                whatsapp: cleanWa,
                email: profile.email || '',
                address: profile.address || '',
                googleMapsUrl: profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : undefined,
                currency: profile.currency || 'USD',
                announcement: `🌐 ${websites.length} Official Link${websites.length === 1 ? '' : 's'} Available`,
                photos: [],
                menuCategories: ['Our Sites'],
                menuItems: websites.map((w: any) => ({
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
                  tags: [w.type, w.ctaText || 'Visit Website'],
                  isSpecial: true,
                  isAvailable: true,
                })),
                websitesQrItems: websites,
                qrDarkColor: '#2563eb',
                qrLightColor: '#ffffff',
                qrEyeColor: '#1d4ed8',
                qrBoxBgColor: '#ffffff',
                qrBoxBorderColor: '#cbd5e1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              return new Response(
                JSON.stringify({ ok: true, success: true, data: { page } }),
                {
                  status: 200,
                  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                }
              );
            }
          }

          // Fallback: Check if we have backup data with socialsQrItems for socials hub
          if (pageId.includes('socials-hub') || pageId.startsWith('socials') || pageId === 'socials-hub-all') {
            const backupObj = await bucket.get('sync/latest_backup.json');
            if (backupObj) {
              const bText = await backupObj.text();
              const bData = JSON.parse(bText);
              const socials = bData.socialsQrItems || [];
              const profile = bData.profile || {};
              const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

              const page = {
                id: pageId,
                title: 'our social media platforms',
                tagline: 'Connect Across All Official Social Channels & Messaging Apps',
                description: `Official social media profiles, chat channels, and community links for ${profile.name || 'our brand'}.`,
                pageType: 'socials_hub',
                accentColor: '#059669',
                theme: 'emerald',
                logo: profile.logo,
                phone: profile.phone || '',
                whatsapp: cleanWa,
                email: profile.email || '',
                address: profile.address || '',
                googleMapsUrl: profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : undefined,
                currency: profile.currency || 'USD',
                announcement: `💬 ${socials.length} Official Channel${socials.length === 1 ? '' : 's'} Connected`,
                photos: [],
                menuCategories: ['Official Social Media & Messaging'],
                menuItems: socials.map((s: any) => ({
                  id: `social-${s.id}`,
                  name: s.title || s.customPlatformName || s.platform,
                  category: 'Official Social Media & Messaging',
                  price: 0,
                  description: s.prefilledMessage || s.fullUrl,
                  url: s.fullUrl,
                  ctaText: s.ctaText || 'Connect',
                  itemType: s.platform,
                  tags: [s.platform, s.ctaText || 'Connect'],
                  isSpecial: true,
                  isAvailable: true,
                })),
                socialsQrItems: socials,
                qrDarkColor: '#059669',
                qrLightColor: '#ffffff',
                qrEyeColor: '#047857',
                qrBoxBgColor: '#ffffff',
                qrBoxBorderColor: '#cbd5e1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              return new Response(
                JSON.stringify({ ok: true, success: true, data: { page } }),
                {
                  status: 200,
                  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                }
              );
            }
          }

          // Fallback: Check if we have backup data with eventsQrItems for events hub
          if (pageId.includes('events-hub') || pageId.startsWith('events') || pageId === 'events-hub-all') {
            const backupObj = await bucket.get('sync/latest_backup.json');
            if (backupObj) {
              const bText = await backupObj.text();
              const bData = JSON.parse(bText);
              const events = bData.eventsQrItems || [];
              const profile = bData.profile || {};
              const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

              const page = {
                id: pageId,
                title: 'Our Events',
                tagline: undefined,
                description: `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
                pageType: 'events_hub',
                accentColor: '#7c3aed',
                theme: 'indigo',
                logo: profile.logo,
                phone: profile.phone || '',
                whatsapp: cleanWa,
                email: profile.email || '',
                address: profile.address || '',
                googleMapsUrl: profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : undefined,
                currency: profile.currency || 'USD',
                announcement: `🎉 ${events.length} Upcoming Event${events.length === 1 ? '' : 's'} Available`,
                photos: events.flatMap((e: any) => (e.photos || []).map((url: string, idx: number) => ({
                  id: `${e.id}-photo-${idx}`,
                  url,
                  title: e.title,
                  description: e.location,
                  badge: 'Event Photo',
                }))),
                menuCategories: ['Our Events'],
                menuItems: events.map((e: any) => ({
                  id: `event-pass-${e.id}`,
                  name: e.title,
                  category: 'Our Events',
                  price: 0,
                  description: `${e.startDate ? e.startDate + ' • ' : ''}${e.location || ''}${e.description ? ' • ' + e.description : ''}`,
                  url: e.rsvpUrl || undefined,
                  ctaText: e.ctaText || 'RSVP & Join',
                  tags: [e.startDate || 'Upcoming', e.location || 'Event'],
                  isSpecial: true,
                  isAvailable: true,
                  photoUrl: e.photos?.[0] || undefined,
                })),
                eventsQrItems: events,
                qrDarkColor: '#7c3aed',
                qrLightColor: '#ffffff',
                qrEyeColor: '#6d28d9',
                qrBoxBgColor: '#ffffff',
                qrBoxBorderColor: '#cbd5e1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              return new Response(
                JSON.stringify({ ok: true, success: true, data: { page } }),
                {
                  status: 200,
                  headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                }
              );
            }
          }

          // Fallback: Check if we have a single event in backup data
          if (pageId.startsWith('event-')) {
            const backupObj = await bucket.get('sync/latest_backup.json');
            if (backupObj) {
              const bText = await backupObj.text();
              const bData = JSON.parse(bText);
              const events = bData.eventsQrItems || [];
              const evt = events.find((e: any) => e.id === pageId);
              const profile = bData.profile || {};
              const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

              if (evt) {
                const page = {
                  id: evt.id,
                  title: evt.title,
                  tagline: evt.ctaText || 'Official Event Invitation & RSVP Pass',
                  description: evt.description || `Event Venue: ${evt.location}`,
                  pageType: 'event',
                  accentColor: evt.darkColor || '#7c3aed',
                  theme: 'indigo',
                  coverImage: evt.photos?.[0] || undefined,
                  logo: evt.photos?.[0] || profile.logo || undefined,
                  phone: evt.contactPhone || profile.phone || '',
                  whatsapp: cleanWa,
                  email: evt.contactEmail || profile.email || '',
                  address: evt.location,
                  googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`,
                  currency: profile.currency || 'UGX',
                  announcement: `📅 ${evt.startDate || evt.eventDate || 'Upcoming Event'} • 📍 ${evt.location}`,
                  allowWhatsAppOrdering: true,
                  photos: (evt.photos || []).map((url: string, idx: number) => ({
                    id: `${evt.id}-photo-${idx}`,
                    url,
                    title: evt.title,
                    description: evt.location,
                    badge: 'Event Photo',
                  })),
                  menuCategories: ['Event Pass & RSVP'],
                  menuItems: [
                    {
                      id: `rsvp-${evt.id}`,
                      name: `${evt.title} - Entry & RSVP Pass`,
                      category: 'Event Pass & RSVP',
                      price: 0,
                      description: `${evt.description ? evt.description + ' • ' : ''}Venue: ${evt.location}. Click to RSVP!`,
                      tags: ['RSVP', 'Invitation', 'Entry Pass'],
                      isSpecial: true,
                      isAvailable: true,
                      photoUrl: evt.photos?.[0] || undefined,
                    },
                  ],
                  qrDarkColor: evt.darkColor || '#7c3aed',
                  qrLightColor: '#ffffff',
                  qrEyeColor: evt.eyeColor || '#6d28d9',
                  qrBoxBgColor: '#ffffff',
                  qrBoxBorderColor: '#cbd5e1',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                };

                return new Response(
                  JSON.stringify({ ok: true, success: true, data: { page } }),
                  {
                    status: 200,
                    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
                  }
                );
              }
            }
          }
        } catch {}
      }

      return new Response(
        JSON.stringify({ ok: false, error: 'QR Page not found' }),
        { status: 404, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    // 7. Data Sync Push endpoint (/api/sync/push)
    if (url.pathname === '/api/sync/push' && request.method === 'POST') {
      try {
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
        const body: any = await request.json().catch(() => ({}));
        const backupData = body?.backupData || body;

        if (bucket && backupData) {
          await bucket.put('sync/latest_backup.json', JSON.stringify(backupData), {
            httpMetadata: { contentType: 'application/json' },
          });

          // Also save websites hub page directly if websitesQrItems exist
          if (Array.isArray(backupData.websitesQrItems) && backupData.websitesQrItems.length > 0) {
            const profile = backupData.profile || {};
            const cleanName = (profile.name || 'brivu').toLowerCase().replace(/[^a-z0-9]/g, '') || 'all';
            const hubId = `websites-hub-${cleanName}`;
            const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

            const webHubPage = {
              id: hubId,
              title: 'Our Sites',
              tagline: undefined,
              description: `Official web links directory for ${profile.name || 'our company'}.`,
              pageType: 'websites_hub',
              accentColor: '#2563eb',
              theme: 'indigo',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || '',
              address: profile.address || '',
              currency: profile.currency || 'USD',
              announcement: `🌐 ${backupData.websitesQrItems.length} Official Link${backupData.websitesQrItems.length === 1 ? '' : 's'} Available`,
              photos: [],
              menuCategories: ['Our Sites'],
              menuItems: backupData.websitesQrItems.map((w: any) => ({
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
                tags: [w.type, w.ctaText || 'Visit Website'],
                isSpecial: true,
                isAvailable: true,
              })),
              websitesQrItems: backupData.websitesQrItems,
              qrDarkColor: '#2563eb',
              qrLightColor: '#ffffff',
              qrEyeColor: '#1d4ed8',
              qrBoxBgColor: '#ffffff',
              qrBoxBorderColor: '#cbd5e1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await bucket.put(`qr_pages/${encodeURIComponent(hubId)}.json`, JSON.stringify(webHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });
            await bucket.put(`qr_pages/websites-hub-all.json`, JSON.stringify(webHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });
          }

          // Also save socials hub page directly if socialsQrItems exist
          if (Array.isArray(backupData.socialsQrItems) && backupData.socialsQrItems.length > 0) {
            const profile = backupData.profile || {};
            const cleanName = (profile.name || 'brivu').toLowerCase().replace(/[^a-z0-9]/g, '') || 'all';
            const hubId = `socials-hub-${cleanName}`;
            const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

            const socialHubPage = {
              id: hubId,
              title: 'our social media platforms',
              tagline: 'Connect Across All Official Social Channels & Messaging Apps',
              description: `Official social media profiles, chat channels, and community links for ${profile.name || 'our brand'}.`,
              pageType: 'socials_hub',
              accentColor: '#059669',
              theme: 'emerald',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || '',
              address: profile.address || '',
              currency: profile.currency || 'USD',
              announcement: `💬 ${backupData.socialsQrItems.length} Official Channel${backupData.socialsQrItems.length === 1 ? '' : 's'} Connected`,
              photos: [],
              menuCategories: ['Official Social Media & Messaging'],
              menuItems: backupData.socialsQrItems.map((s: any) => ({
                id: `social-${s.id}`,
                name: s.title || s.customPlatformName || s.platform,
                category: 'Official Social Media & Messaging',
                price: 0,
                description: s.prefilledMessage || s.fullUrl,
                url: s.fullUrl,
                ctaText: s.ctaText || 'Connect',
                itemType: s.platform,
                tags: [s.platform, s.ctaText || 'Connect'],
                isSpecial: true,
                isAvailable: true,
              })),
              socialsQrItems: backupData.socialsQrItems,
              qrDarkColor: '#059669',
              qrLightColor: '#ffffff',
              qrEyeColor: '#047857',
              qrBoxBgColor: '#ffffff',
              qrBoxBorderColor: '#cbd5e1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await bucket.put(`qr_pages/${encodeURIComponent(hubId)}.json`, JSON.stringify(socialHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });
            await bucket.put(`qr_pages/socials-hub-all.json`, JSON.stringify(socialHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });
          }

          // Also save events hub and individual event pages directly if eventsQrItems exist
          if (Array.isArray(backupData.eventsQrItems) && backupData.eventsQrItems.length > 0) {
            const profile = backupData.profile || {};
            const cleanName = (profile.name || 'brivu').toLowerCase().replace(/[^a-z0-9]/g, '') || 'all';
            const hubId = `events-hub-${cleanName}`;
            const cleanWa = (profile.whatsapp || profile.phone || '').replace(/[^0-9]/g, '');

            const eventsHubPage = {
              id: hubId,
              title: 'Our Events',
              tagline: undefined,
              description: `Browse our events and get access passes for ${profile.name || 'our organization'}.`,
              pageType: 'events_hub',
              accentColor: '#7c3aed',
              theme: 'indigo',
              logo: profile.logo,
              phone: profile.phone || '',
              whatsapp: cleanWa,
              email: profile.email || '',
              address: profile.address || '',
              googleMapsUrl: profile.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}` : undefined,
              currency: profile.currency || 'USD',
              announcement: `🎉 ${backupData.eventsQrItems.length} Upcoming Event${backupData.eventsQrItems.length === 1 ? '' : 's'} Available`,
              photos: backupData.eventsQrItems.flatMap((e: any) => (e.photos || []).map((url: string, idx: number) => ({
                id: `${e.id}-photo-${idx}`,
                url,
                title: e.title,
                description: e.location,
                badge: 'Event Photo',
              }))),
              menuCategories: ['Our Events'],
              menuItems: backupData.eventsQrItems.map((e: any) => ({
                id: `event-pass-${e.id}`,
                name: e.title,
                category: 'Our Events',
                price: 0,
                description: `${e.startDate ? e.startDate + ' • ' : ''}${e.location || ''}${e.description ? ' • ' + e.description : ''}`,
                url: e.rsvpUrl || undefined,
                ctaText: e.ctaText || 'RSVP & Join',
                tags: [e.startDate || 'Upcoming', e.location || 'Event'],
                isSpecial: true,
                isAvailable: true,
                photoUrl: e.photos?.[0] || undefined,
              })),
              eventsQrItems: backupData.eventsQrItems,
              qrDarkColor: '#7c3aed',
              qrLightColor: '#ffffff',
              qrEyeColor: '#6d28d9',
              qrBoxBgColor: '#ffffff',
              qrBoxBorderColor: '#cbd5e1',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            await bucket.put(`qr_pages/${encodeURIComponent(hubId)}.json`, JSON.stringify(eventsHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });
            await bucket.put(`qr_pages/events-hub-all.json`, JSON.stringify(eventsHubPage), {
              httpMetadata: { contentType: 'application/json' },
            });

            // Save each individual event
            for (const evt of backupData.eventsQrItems) {
              const singleEventPage = {
                id: evt.id,
                title: evt.title,
                tagline: evt.ctaText || 'Official Event Invitation & RSVP Pass',
                description: evt.description || `Event Venue: ${evt.location}`,
                pageType: 'event',
                accentColor: evt.darkColor || '#7c3aed',
                theme: 'indigo',
                coverImage: evt.photos?.[0] || undefined,
                logo: evt.photos?.[0] || profile.logo || undefined,
                phone: evt.contactPhone || profile.phone || '',
                whatsapp: cleanWa,
                email: evt.contactEmail || profile.email || '',
                address: evt.location,
                googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(evt.location)}`,
                currency: profile.currency || 'UGX',
                announcement: `📅 ${evt.startDate || evt.eventDate || 'Upcoming Event'} • 📍 ${evt.location}`,
                allowWhatsAppOrdering: true,
                photos: (evt.photos || []).map((url: string, idx: number) => ({
                  id: `${evt.id}-photo-${idx}`,
                  url,
                  title: evt.title,
                  description: evt.location,
                  badge: 'Event Photo',
                })),
                menuCategories: ['Event Pass & RSVP'],
                menuItems: [
                  {
                    id: `rsvp-${evt.id}`,
                    name: `${evt.title} - Entry & RSVP Pass`,
                    category: 'Event Pass & RSVP',
                    price: 0,
                    description: `${evt.description ? evt.description + ' • ' : ''}Venue: ${evt.location}. Click to RSVP!`,
                    tags: ['RSVP', 'Invitation', 'Entry Pass'],
                    isSpecial: true,
                    isAvailable: true,
                    photoUrl: evt.photos?.[0] || undefined,
                  },
                ],
                qrDarkColor: evt.darkColor || '#7c3aed',
                qrLightColor: '#ffffff',
                qrEyeColor: evt.eyeColor || '#6d28d9',
                qrBoxBgColor: '#ffffff',
                qrBoxBorderColor: '#cbd5e1',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              await bucket.put(`qr_pages/${encodeURIComponent(evt.id)}.json`, JSON.stringify(singleEventPage), {
                httpMetadata: { contentType: 'application/json' },
              });
            }
          }
        }

        return new Response(
          JSON.stringify({
            ok: true,
            success: true,
            message: 'All records successfully saved to Cloudflare',
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
        const bucket = env.BUCKET || env.brivu_bucket || env.MY_BUCKET;
        if (bucket) {
          const obj = await bucket.get('sync/latest_backup.json');
          if (obj) {
            const text = await obj.text();
            const backupData = JSON.parse(text);
            return new Response(
              JSON.stringify({ ok: true, success: true, data: { backupData } }),
              {
                status: 200,
                headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
              }
            );
          }
        }
        return new Response(
          JSON.stringify({ ok: true, success: true, data: { backupData: null } }),
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

    // 6. SPA Fallback: Serve /index.html for client-side React routes
    try {
      const indexUrl = new URL('/index.html', url.origin);
      const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
      const newHeaders = new Headers(indexResponse.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => newHeaders.set(k, v));
      return new Response(indexResponse.body, {
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
