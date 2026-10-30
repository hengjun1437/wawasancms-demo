import {
  demoChannels, demoDevices, demoEvents, demoGateways, demoSites, demoStorage, demoUsers, demoTenants,
  pageEvents, parseEventQuery
} from './data.mjs';

const notFound = () => ({ status: 404, body: { error: 'Not found' } });

export function handleApiRequest(method, rawUrl, headers = {}) {
  let url;
  try { url = new URL(rawUrl, 'http://127.0.0.1'); }
  catch { return { status: 400, body: { error: 'Invalid request URL.' } }; }
  if (!url.pathname.startsWith('/api/')) return null;
  if (method !== 'GET') return { status: 405, body: { error: 'This local demo is read-only; no NVR commands are exposed.' } };


  if (url.pathname === '/api/health') return { status: 200, body: { status: 'ok', mode: 'local-demo', nvrConnected: false } };
  // These fixed demo identities are not authentication credentials. Loopback-only preview.
  const userId = headers['x-demo-user'] ?? headers['X-Demo-User'];
  const user = demoUsers.find(item => item.id === userId);
  if (!user) return { status: 401, body: { error: 'Select a synthetic demo user to continue.' } };
  const sites = demoSites.filter(site => site.tenantId === user.tenantId);
  const siteIds = new Set(sites.map(site => site.id));
  const gateways = demoGateways.filter(g => siteIds.has(g.siteId));
  const devices = demoDevices.filter(d => siteIds.has(d.siteId));
  const deviceIds = new Set(devices.map(d => d.id));
  const events = demoEvents.filter(e => deviceIds.has(e.deviceId));
  if (url.pathname === '/api/demo/session') return { status: 200, body: { user, tenant: demoTenants.find(t => t.id === user.tenantId), simulated: true } };
  if (url.pathname === '/api/gateways') return { status: 200, body: gateways };
  if (url.pathname === '/api/sites') return { status: 200, body: sites };
  if (url.pathname === '/api/devices') return { status: 200, body: devices };
  if (url.pathname === '/api/v1/sites') return { status: 200, body: sites.map(site => ({
    id: site.id, name: site.name, timezone: 'Asia/Kuala_Lumpur',
    gatewayCount: gateways.filter(g => g.siteId === site.id).length,
    deviceCount: devices.filter(d => d.siteId === site.id).length, demo: true
  })) };
  if (url.pathname === '/api/v1/devices') {
    if ([...url.searchParams.keys()].some(key => key !== 'siteId')) return { status: 400, body: { error: 'Unsupported query parameter.' } };
    const siteId = url.searchParams.get('siteId');
    return { status: 200, body: devices.filter(device => !siteId || device.siteId === siteId).map(device => ({
      ...device, siteName: sites.find(site => site.id === device.siteId)?.name ?? null,
      storageStatus: device.hddStatus
    })) };
  }
  if (url.pathname === '/api/events' || url.pathname === '/api/v1/events') {
    try {
      const page = pageEvents(events, parseEventQuery(url.searchParams));
      return { status: 200, body: url.pathname === '/api/events' ? page : { ...page, items: page.items.map(event => ({
        id: event.id, deviceId: event.deviceId, channelId: event.channelId,
        eventType: event.eventType, state: event.state, occurredAt: event.occurredAt,
        receivedAt: event.receivedAt, demo: true
      })) } };
    } catch (error) { return { status: 400, body: { error: error.message } }; }
  }
  const resource = new RegExp('^/api/(?:v1/)?devices/([^/]+)/(channels|storage)$').exec(url.pathname);
  if (resource) {
    let deviceId;
    try { deviceId = decodeURIComponent(resource[1]); }
    catch { return { status: 400, body: { error: 'Invalid device identifier.' } }; }
    if (!deviceIds.has(deviceId)) return notFound();
    const items = (resource[2] === 'channels' ? demoChannels : demoStorage).filter(item => item.deviceId === deviceId);
    return { status: 200, body: url.pathname.startsWith('/api/v1/')
      ? items.map(({ deviceId: _deviceId, demo: _demo, ...item }) => item) : items };
  }
  return notFound();
}
