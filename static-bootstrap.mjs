// Static-only simulation: intercept demo API calls in this browser tab.
// No requests for customer information are sent to a server.
import { handleApiRequest } from './api.mjs';

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const parsed = new URL(url, location.href);
  if (parsed.origin !== location.origin || !parsed.pathname.startsWith('/api/'))
    return nativeFetch(input, init);
  const headers = new Headers(init.headers || (typeof input === 'object' && input.headers) || {});
  const demoUser = headers.get('X-Demo-User');
  const result = handleApiRequest(init.method || 'GET', parsed.pathname + parsed.search,
    demoUser ? { 'x-demo-user': demoUser } : {});
  return Promise.resolve(new Response(JSON.stringify(result?.body ?? { error: 'Not found' }), {
    status: result?.status ?? 404,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  }));
};
await import('./app.js?v=alarm-details-1');
