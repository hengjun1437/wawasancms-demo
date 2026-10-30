// Synthetic fixtures only. No customer, site, device address, credential, or live event data.
export const demoSites = [
  { id: 'site-demo-2', tenantId: 'tenant-demo-b', name: 'Other Customer Site', status: 'unknown', demo: true },
  { id: 'site-demo-1', tenantId: 'tenant-demo-a', name: 'Sample Site', status: 'unknown', demo: true }
];

export const demoTenants = [{ id: 'tenant-demo-a', name: 'Sample Customer A' }, { id: 'tenant-demo-b', name: 'Sample Customer B' }];
export const demoUsers = [{ id: 'user-demo-a', name: 'Customer A Viewer', tenantId: 'tenant-demo-a', role: 'customer_viewer' }, { id: 'user-demo-b', name: 'Customer B Viewer', tenantId: 'tenant-demo-b', role: 'customer_viewer' }];

export const demoGateways = [
  { id: 'gateway-demo-2', siteId: 'site-demo-2', name: 'Other Customer Gateway', status: 'unknown', lastSeenAt: null, demo: true },
  { id: 'gateway-demo-1', siteId: 'site-demo-1', name: 'Sample Gateway', status: 'unknown', lastSeenAt: null, demo: true }
];

export const demoDevices = [
  { id: 'device-demo-2', siteId: 'site-demo-2', gatewayId: 'gateway-demo-2', name: 'Other Customer NVR', brand: 'Tiandy', status: 'unknown', channelCount: 1, hddStatus: 'unknown', demo: true },
  {
    id: 'device-demo-1', siteId: 'site-demo-1', gatewayId: 'gateway-demo-1', name: 'Sample Tiandy NVR',
    brand: 'Tiandy', model: null, protocol: 'netsdk', connectionMode: 'outbound_gateway',
    status: 'unknown', lastSeenAt: null, channelCount: 4, hddStatus: 'unknown', demo: true
  }
];

export const demoChannels = [{ id: 'channel-demo-other', deviceId: 'device-demo-2', channelIndex: 0, name: 'Other Customer Channel', status: 'unknown', streamProfiles: [], demo: true }, ...[0, 1, 2, 3].map(channelIndex => ({
  id: `channel-demo-${channelIndex}`, deviceId: 'device-demo-1', channelIndex,
  name: `Channel ${channelIndex + 1}`, status: 'unknown', streamProfiles: [], demo: true
}))];

export const demoStorage = [
  { id: 'storage-demo-other', deviceId: 'device-demo-2', diskIndex: 0, state: 'unknown', demo: true },
  { id: 'storage-demo-1', deviceId: 'device-demo-1', diskIndex: 0, state: 'unknown', capacityBytes: null, freeBytes: null, observedAt: null, demo: true }
];

export const demoEvents = [
  { id: 'event-demo-other', deviceId: 'device-demo-2', channelId: 'channel-demo-other', channelIndex: 0, eventType: 'motion', state: 'active', occurredAt: '2026-10-11T07:00:00.000Z', receivedAt: '2026-10-11T07:00:01.000Z', demo: true },
  {
    id: 'event-demo-1', deviceId: 'device-demo-1', channelId: 'channel-demo-0', channelIndex: 0,
    eventType: 'motion', state: 'active', occurredAt: '2026-10-11T06:00:00.000Z',
    receivedAt: '2026-10-11T06:00:01.000Z', source: 'synthetic-demo', demo: true
  },
  {
    id: 'event-demo-2', deviceId: 'device-demo-1', channelId: 'channel-demo-0', channelIndex: 0,
    eventType: 'motion', state: 'clear', occurredAt: '2026-10-11T06:02:00.000Z',
    receivedAt: '2026-10-11T06:02:01.000Z', source: 'synthetic-demo', demo: true
  }
];

export function deriveDeviceStatus(lastSeenAt, sdkState, nowMs = Date.now()) {
  if (!lastSeenAt) return 'unknown';
  const lastSeenMs = Date.parse(lastSeenAt);
  if (!Number.isFinite(lastSeenMs) || lastSeenMs > nowMs) return 'unknown';
  if (sdkState === 'error') return 'degraded';
  const ageMs = nowMs - lastSeenMs;
  if (ageMs <= 60_000 && sdkState === 'connected') return 'online';
  if (ageMs <= 180_000) return 'degraded';
  return 'offline';
}

function parseInstant(value, field) {
  if (value === null) return null;
  const parsed = Date.parse(value);
  const hasIsoTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  if (!Number.isFinite(parsed) || !hasIsoTimestamp) throw new Error(`Invalid ${field}; use an ISO 8601 timestamp with a timezone.`);
  return parsed;
}

export function parseEventQuery(searchParams) {
  const allowed = new Set(['from', 'to', 'limit', 'cursor']);
  for (const key of searchParams.keys()) if (!allowed.has(key)) throw new Error(`Unsupported query parameter: ${key}`);

  const from = parseInstant(searchParams.get('from'), 'from');
  const to = parseInstant(searchParams.get('to'), 'to');
  if (from !== null && to !== null && from > to) throw new Error('from must be earlier than or equal to to.');

  const rawLimit = searchParams.get('limit') ?? '50';
  if (!/^\d+$/.test(rawLimit)) throw new Error('limit must be a whole number from 1 to 100.');
  const limit = Number(rawLimit);
  if (limit < 1 || limit > 100) throw new Error('limit must be a whole number from 1 to 100.');

  const rawCursor = searchParams.get('cursor') ?? '0';
  if (!/^\d+$/.test(rawCursor) || !Number.isSafeInteger(Number(rawCursor))) throw new Error('cursor must be a non-negative integer.');
  return { from, to, limit, cursor: Number(rawCursor) };
}

export function pageEvents(events, { from, to, limit, cursor }) {
  const filtered = events.filter(event => {
    const time = Date.parse(event.occurredAt);
    return (from === null || time >= from) && (to === null || time <= to);
  }).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  const items = filtered.slice(cursor, cursor + limit);
  const next = cursor + items.length;
  return { items, nextCursor: next < filtered.length ? String(next) : null, total: filtered.length };
}
