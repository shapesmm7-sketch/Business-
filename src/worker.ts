export interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      // 1. Try to serve exact static asset from ASSETS binding
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404) {
        return response;
      }
    } catch {
      // Ignore asset lookup errors and proceed to SPA fallback
    }

    // 2. SPA Fallback: Serve /index.html for client-side React routes
    try {
      const url = new URL(request.url);
      const indexUrl = new URL('/index.html', url.origin);
      return await env.ASSETS.fetch(new Request(indexUrl, request));
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  },
};
