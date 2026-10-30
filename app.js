let activeDemoUser = null;
let identityGeneration = 0;
const state = { sites: [], gateways: [], devices: [], events: [], channels: [], storage: [] };
const $ = selector => document.querySelector(selector);
const statusLabels = { online: 'Online', degraded: 'Degraded', offline: 'Offline', unknown: 'Unknown' };
const pageCopy = {
  overview: ['Overview', 'Monitor sites, gateways and alarm activity.'],
  sites: ['Sites', 'View customer locations and their registered equipment.'],
  gateways: ['Gateways', 'Monitor gateway connectivity and heartbeat status.'],
  devices: ['Devices', 'View registered NVRs and their reported health.'],
  alarms: ['Alarm Center', 'Review alarm events received by the platform.']
};

async function getJson(path) {
  const response = await fetch(path, { cache: 'no-store', headers: activeDemoUser ? { 'X-Demo-User': activeDemoUser } : {} });
  if (!response.ok) throw new Error(`${path} returned ${response.status}`);
  return response.json();
}
function escapeText(value) { return String(value ?? '—'); }
function statusBadge(status) {
  const span = document.createElement('span');
  span.className = `status status-${status || 'unknown'}`;
  span.textContent = statusLabels[status] || 'Unknown';
  return span;
}
function statusCell(status) { const td = document.createElement('td'); td.append(statusBadge(status)); return td; }
function createCell(text, className = '') {
  const td = document.createElement('td'); td.textContent = escapeText(text); if (className) td.className = className; return td;
}
function formatTime(value) {
  const time = new Date(value);
  return Number.isNaN(time.valueOf()) ? 'Time unavailable' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time);
}
function eventCard(event, deviceName) {
  const article = document.createElement('article'); article.className = 'event-item';
  const icon = document.createElement('span'); icon.className = `event-icon ${event.state === 'active' ? 'event-active' : 'event-clear'}`; icon.textContent = event.state === 'active' ? '!' : '✓';
  const body = document.createElement('div'); body.className = 'event-body';
  const title = document.createElement('strong'); title.textContent = `${event.eventType === 'motion' ? 'Motion detected' : event.eventType} · ${Number.isInteger(event.channelIndex) ? `Channel ${event.channelIndex + 1}` : 'Channel unspecified'}`;
  const detail = document.createElement('span'); detail.textContent = `${deviceName} · ${formatTime(event.occurredAt)}`;
  body.append(title, detail);
  const badge = document.createElement('span'); badge.className = `event-state ${event.state === 'active' ? 'state-active' : 'state-clear'}`; badge.textContent = event.state === 'active' ? 'Active' : 'Cleared';
  const open = document.createElement('button'); open.type = 'button'; open.className = 'row-action alarm-open'; open.textContent = 'View alarm'; open.setAttribute('aria-label', 'View alarm details'); open.addEventListener('click', () => showAlarm(event));
  article.append(icon, body, badge, open); return article;
}

function showAlarm(event) {
  // Deliberately user-initiated only: no automatic popups, timers, or browser notifications.
  if (!activeDemoUser || !state.events.some(item => item.id === event.id)) return;
  const device = state.devices.find(item => item.id === event.deviceId);
  if (!device) return;
  const site = state.sites.find(item => item.id === device.siteId);
  if (!site) return;
  const dialog = $('#alarm-dialog');
  const content = $('#alarm-dialog-content');
  content.replaceChildren();
  const info = document.createElement('div'); info.className = 'alarm-detail-grid';
  for (const [label, value] of [
    ['Customer', $('#demo-identity').textContent.split(' · ')[0]],
    ['Site', site.name], ['NVR', device.name],
    ['Camera', 'CH' + String((event.channelIndex ?? 0) + 1).padStart(2, '0')],
    ['Alarm', event.eventType === 'motion' ? 'Motion detected' : event.eventType],
    ['State', event.state === 'active' ? 'Active' : 'Cleared'],
    ['Occurred', formatTime(event.occurredAt)]
  ]) {
    const field = document.createElement('div');
    const key = document.createElement('small'); key.textContent = label;
    const val = document.createElement('strong'); val.textContent = value;
    field.append(key, val); info.append(field);
  }
  const videoTitle = document.createElement('h3'); videoTitle.textContent = 'Camera Live View';
  const video = document.createElement('div'); video.className = 'alarm-video-placeholder';
  const cameraIcon = document.createElement('span'); cameraIcon.textContent = '▣'; cameraIcon.setAttribute('aria-hidden', 'true');
  const videoText = document.createElement('strong'); videoText.textContent = 'LIVE VIEW NOT CONNECTED';
  const videoHint = document.createElement('p'); videoHint.textContent = 'Synthetic demo only. No camera stream, recording, or NVR connection.';
  video.append(cameraIcon, videoText, videoHint);
  const contactsTitle = document.createElement('h3'); contactsTitle.textContent = 'Customer Contact List';
  const contacts = document.createElement('div'); contacts.className = 'alarm-contacts';
  for (const [role, name] of [['Primary Contact', 'Demo Contact 1'], ['Backup Contact', 'Demo Contact 2']]) {
    const row = document.createElement('div'); row.className = 'alarm-contact';
    const text = document.createElement('div'); const label = document.createElement('small'); label.textContent = role;
    const person = document.createElement('strong'); person.textContent = name; text.append(label, person);
    const note = document.createElement('span'); note.textContent = 'Sample only · No phone number';
    row.append(text, note); contacts.append(row);
  }
  const actions = document.createElement('div'); actions.className = 'alarm-actions';
  const note = document.createElement('p'); note.textContent = 'Demo view only — no calls, acknowledgement, or escalation are sent.';
  const close = document.createElement('button'); close.className = 'button-primary'; close.type = 'button'; close.textContent = 'Close details'; close.addEventListener('click', () => dialog.close());
  actions.append(note, close);
  content.append(info, videoTitle, video, contactsTitle, contacts, actions);
  dialog.showModal();
}
$('#alarm-dialog-close').addEventListener('click', () => $('#alarm-dialog').close());

function deviceRows(target, devices) {
  const rows = $(target); rows.replaceChildren();
  if (!devices.length) { const tr = document.createElement('tr'); const td = createCell('No matching devices.', 'empty-row'); td.colSpan = 7; tr.append(td); rows.append(tr); return; }
  const sites = new Map(state.sites.map(site => [site.id, site.name]));
  for (const device of devices) {
    const tr = document.createElement('tr');
    tr.append(createCell(device.name, 'device-name'), createCell(sites.get(device.siteId)), createCell(device.brand), createCell(device.channelCount), createCell(device.hddStatus), statusCell(device.status));
    const action = document.createElement('td'); const button = document.createElement('button'); button.className = 'row-action'; button.textContent = 'Details'; button.addEventListener('click', () => showDevice(device)); action.append(button); tr.append(action); rows.append(tr);
  }
}
function renderEvents(target, events) {
  const list = $(target); list.replaceChildren();
  if (!events.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.textContent = 'No events match this filter.'; list.append(empty); return; }
  const byId = new Map(state.devices.map(device => [device.id, device.name]));
  for (const event of events) list.append(eventCard(event, byId.get(event.deviceId) || 'Unknown device'));
}
function showDevice(device) {
  const detail = $('#device-detail'); detail.replaceChildren();
  const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'DEVICE DETAILS';
  const title = document.createElement('h2'); title.textContent = device.name;
  const sub = document.createElement('p'); sub.className = 'sub'; sub.textContent = `${device.brand} · ${state.sites.find(s => s.id === device.siteId)?.name || 'Unknown site'}`;
  const statusRow = document.createElement('div'); statusRow.className = 'detail-status'; statusRow.append(document.createTextNode('Connection status '), statusBadge(device.status));
  const channelsTitle = document.createElement('h3'); channelsTitle.textContent = 'Channels';
  const channelList = document.createElement('div'); channelList.className = 'channel-list';
  for (const channel of state.channels.filter(item => item.deviceId === device.id)) {
    const item = document.createElement('div'); item.className = 'channel-row'; const channelName = document.createElement('span'); channelName.textContent = escapeText(channel.name); item.append(channelName); const label = document.createElement('span'); label.className = 'small-status'; label.textContent = statusLabels[channel.status] || 'Unknown'; item.append(label); channelList.append(item);
  }
  if (!channelList.childElementCount) channelList.textContent = 'No channel details available.';
  const storage = state.storage.find(item => item.deviceId === device.id);
  const storageBox = document.createElement('div'); storageBox.className = 'storage-detail'; storageBox.innerHTML = '';
  const storageTitle = document.createElement('h3'); storageTitle.textContent = 'Storage health';
  const storageText = document.createElement('p'); storageText.textContent = storage ? `Disk ${Number(storage.diskIndex) + 1}: ${storage.state || 'unknown'}` : 'No storage information reported.';
  detail.append(eyebrow, title, sub, statusRow, channelsTitle, channelList, storageTitle, storageText);
  $('#device-dialog').showModal();
}
function currentAlarms() {
  const filter = $('#alarm-filter')?.value || 'all';
  return filter === 'all' ? state.events : state.events.filter(event => event.state === filter);
}
function renderGateways() {
  const target = $('#gateway-rows');
  target.replaceChildren();
  const query = ($('#gateway-search')?.value || '').trim().toLowerCase();
  const siteNames = new Map(state.sites.map(site => [site.id, site.name]));
  const gateways = state.gateways.filter(gateway =>
    `${gateway.name || ''} ${gateway.id || ''} ${siteNames.get(gateway.siteId) || ''}`.toLowerCase().includes(query));
  if (!gateways.length) {
    const row = document.createElement('tr');
    const cell = createCell('No matching gateways.', 'empty-row');
    cell.colSpan = 4; row.append(cell); target.append(row); return;
  }
  for (const gateway of gateways) {
    const row = document.createElement('tr');
    row.append(
      createCell(gateway.name || gateway.id, 'device-name'),
      createCell(siteNames.get(gateway.siteId) || 'Unknown site'),
      statusCell(gateway.status),
      createCell(gateway.lastSeenAt ? formatTime(gateway.lastSeenAt) : 'Not reported')
    );
    target.append(row);
  }
}
function renderSites() {
  const target = $('#site-rows');
  target.replaceChildren();
  const query = ($('#site-search')?.value || '').trim().toLowerCase();
  const sites = state.sites.filter(site => String(site.name || '').toLowerCase().includes(query));
  if (!sites.length) {
    const row = document.createElement('tr');
    const cell = createCell('No matching sites.', 'empty-row');
    cell.colSpan = 4; row.append(cell); target.append(row); return;
  }
  for (const site of sites) {
    const row = document.createElement('tr');
    row.append(
      createCell(site.name, 'device-name'),
      createCell(site.timezone || 'Asia/Kuala_Lumpur'),
      createCell(site.gatewayCount ?? state.gateways.filter(g => g.siteId === site.id).length),
      createCell(state.devices.filter(d => d.siteId === site.id).length)
    );
    target.append(row);
  }
}
function applyFilters() {
  const query = ($('#device-search')?.value || '').trim().toLowerCase();
  const status = $('#status-filter')?.value || 'all';
  const filtered = state.devices.filter(device => `${device.name} ${device.brand} ${state.sites.find(s => s.id === device.siteId)?.name || ''}`.toLowerCase().includes(query) && (status === 'all' || device.status === status));
  renderSites(); renderGateways();
  deviceRows('#all-device-rows', filtered);
  renderEvents('#alarm-events', currentAlarms());
}
function setView(name) {
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  document.querySelectorAll('.view-section').forEach(section => { section.hidden = section.id !== `${name}-view`; });
  $('#page-title').textContent = pageCopy[name][0]; $('#page-subtitle').textContent = pageCopy[name][1];
}
async function loadDashboard() {
  if (!activeDemoUser) return;
  const generation = identityGeneration;
  $('#refresh').disabled = true;
  try {
    const [health, sites, gateways, devices, eventPage] = await Promise.all([
      getJson('/api/health'), getJson('/api/v1/sites'), getJson('/api/gateways'), getJson('/api/v1/devices'), getJson('/api/v1/events?limit=100')
    ]);
    if (generation !== identityGeneration) return; // Never write another customer's response into shared state.
    Object.assign(state, { sites, gateways, devices: devices.map(device => ({ ...device, hddStatus: device.storageStatus ?? 'unknown' })), events: (eventPage.items || []).map(event => ({ ...event, channelIndex: event.channelIndex ?? null })) });
    const resources = await Promise.all(devices.map(async device => {
      const [channels, storage] = await Promise.all([getJson(`/api/v1/devices/${encodeURIComponent(device.id)}/channels`), getJson(`/api/v1/devices/${encodeURIComponent(device.id)}/storage`)]);
      return { channels: channels.map(channel => ({ ...channel, deviceId: device.id })), storage: storage.map(disk => ({ ...disk, deviceId: device.id })) };
    }));
    if (generation !== identityGeneration) return; // Discard responses from a signed-out or switched user.
    state.channels = resources.flatMap(item => item.channels); state.storage = resources.flatMap(item => item.storage);
    $('#site-count').textContent = sites.length; $('#nav-site-count').textContent = sites.length; renderSites(); $('#gateway-count').textContent = gateways.length; $('#nav-gateway-count').textContent = gateways.length; renderGateways(); $('#device-count').textContent = devices.length;
    $('#alarm-count').textContent = state.events.filter(event => event.state === 'active').length;
    $('#nav-device-count').textContent = devices.length; $('#nav-alarm-count').textContent = state.events.length;
    $('#gateway-caption').textContent = gateways.some(item => item.status === 'online') ? `${gateways.filter(item => item.status === 'online').length} online` : 'Awaiting heartbeat data';
    $('#device-caption').textContent = devices.some(item => item.status === 'online') ? `${devices.filter(item => item.status === 'online').length} online` : 'No live heartbeat received';
    $('#api-status')?.replaceChildren();
    if (health.status !== 'ok') throw new Error('API health check failed');
    deviceRows('#device-rows', devices); deviceRows('#all-device-rows', devices);
    const latest = [...state.events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
    renderEvents('#recent-events', latest.slice(0, 3)); renderEvents('#alarm-events', currentAlarms());
    $('#toast').textContent = `Updated ${new Date().toLocaleTimeString()}`; $('#toast').classList.add('visible');
    window.setTimeout(() => $('#toast').classList.remove('visible'), 2200);
  } catch (error) {
    if (generation !== identityGeneration) return;
    $('#toast').textContent = 'Could not load synthetic demo data. Refresh the page and try again.'; $('#toast').classList.add('visible');
    $('#device-rows').innerHTML = '<tr><td colspan="7" class="error-row">Demo API unavailable</td></tr>';
  } finally { if (generation === identityGeneration) $('#refresh').disabled = false; }
}
document.querySelectorAll('.nav-item').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => setView(button.dataset.goto)));
$('#refresh').addEventListener('click', loadDashboard);
$('#device-search').addEventListener('input', applyFilters); $('#status-filter').addEventListener('change', applyFilters); $('#alarm-filter').addEventListener('change', applyFilters);
loadDashboard();

const demoSelect = $('#demo-user');
const productionLink = $('#production-auth-info');
const signOut = $('#demo-signout');
function resetDemo() {
  identityGeneration++;
  activeDemoUser = null;
  Object.assign(state, { sites: [], gateways: [], devices: [], events: [], channels: [], storage: [] });
  $('#demo-login').hidden = false;
  $('#demo-dashboard').hidden = true;
  $('#demo-identity').textContent = 'Not signed in';
  demoSelect.value = '';
  $('#refresh').disabled = false;
  if ($('#device-dialog').open) $('#device-dialog').close();
  if ($('#alarm-dialog').open) $('#alarm-dialog').close();
  for (const id of ['site-count', 'gateway-count', 'device-count', 'alarm-count', 'nav-site-count', 'nav-gateway-count', 'nav-device-count', 'nav-alarm-count']) $(`#${id}`).textContent = '—';
  for (const id of ['site-rows', 'gateway-rows', 'device-rows', 'all-device-rows', 'recent-events', 'alarm-events']) $(`#${id}`).replaceChildren();
  $('#toast').classList.remove('visible');
}
demoSelect.addEventListener('change', async () => {
  const selected = demoSelect.value;
  resetDemo();
  if (!selected) return;
  activeDemoUser = selected;
  try {
    const generation = identityGeneration;
    const session = await getJson('/api/demo/session');
    if (generation !== identityGeneration) return;
    $('#demo-identity').textContent = session.tenant.name + ' · ' + session.user.name;
    $('#demo-login').hidden = true;
    $('#demo-dashboard').hidden = false;
    await loadDashboard();
  } catch { resetDemo(); }
});
signOut.addEventListener('click', resetDemo);
productionLink?.addEventListener('click', event => {
  event.preventDefault();
  $('#demo-auth-message').textContent = 'Production Firebase sign-in is not enabled in this loopback demo. Signed tokens must be verified by the .NET backend before accessing customer data.';
});
resetDemo();
// Browser-first synthetic demo: open directly into Customer A. Query ?demo=b
// switches to the other isolated fixture. No authentication or live API.
const demoChoice = new URLSearchParams(location.search).get('demo');
demoSelect.value = demoChoice === 'b' ? 'user-demo-b' : 'user-demo-a';
demoSelect.dispatchEvent(new Event('change'));

$('#site-search')?.addEventListener('input', renderSites);

$('#gateway-search')?.addEventListener('input', renderGateways);
