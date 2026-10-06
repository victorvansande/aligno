const CACHE = 'aligno-v24';
const SHARE_CACHE = 'aligno-share';
const META_CACHE = 'aligno-meta';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './gifenc.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => /^aligno-v\d+$/.test(k) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Photos shared to Aligno from the gallery (Android share sheet) arrive as a
// POST; park them in a cache and hand over to the app, which picks them up.
async function receiveShare(req) {
  try {
    const form = await req.formData();
    const files = form.getAll('photos').filter((f) => f && f.type && f.type.indexOf('image/') === 0);
    const c = await caches.open(SHARE_CACHE);
    for (const k of await c.keys()) await c.delete(k);
    await Promise.all(files.map((f, i) => c.put('./shared/' + i, new Response(f, {
      headers: { 'Content-Type': f.type, 'X-Name': encodeURIComponent(f.name || ('photo-' + i)), 'X-Modified': String(f.lastModified || Date.now()) }
    }))));
    await c.put('./shared/count', new Response(String(files.length)));
  } catch (err) {}
  return Response.redirect('./?share=1', 303);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.method === 'POST' && url.pathname.endsWith('/share-target')) { e.respondWith(receiveShare(req)); return; }
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});

// Reminders: on Android, an installed Aligno gets periodic background syncs.
// Each one checks which projects are due and shows one notification per
// due period (never twice for the same missed photo).
const INTERVALS = { daily: 1, weekly: 7, monthly: 30 };
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('aligno', 2); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onupgradeneeded = () => { r.transaction.abort(); }; });
}
function all(db, store, index, key) {
  return new Promise((res, rej) => {
    const s = db.transaction(store, 'readonly').objectStore(store);
    const r = index ? s.index(index).getAll(IDBKeyRange.only(key)) : s.getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function checkDue() {
  const db = await idb();
  const projects = await all(db, 'projects');
  const meta = await caches.open(META_CACHE);
  const hit = await meta.match('./notified');
  const notified = hit ? await hit.json() : {};
  const due = [];
  for (const p of projects) {
    const iv = INTERVALS[String(p.reminder || '').toLowerCase()];
    if (!iv) continue;
    const photos = await all(db, 'photos', 'byProject', p.id);
    const last = photos.reduce((m, ph) => Math.max(m, ph.ts || 0), 0);
    if (last && (Date.now() - last) / 86400000 < iv) continue;
    due.push({ p, last });
  }
  db.close();
  if (self.navigator.setAppBadge) { try { due.length ? await self.navigator.setAppBadge(due.length) : await self.navigator.clearAppBadge(); } catch (e) {} }
  const fresh = due.filter((d) => notified[d.p.id] !== d.last);
  if (!fresh.length) return;
  fresh.forEach((d) => { notified[d.p.id] = d.last; });
  await meta.put('./notified', new Response(JSON.stringify(notified)));
  const names = fresh.map((d) => d.p.name);
  await self.registration.showNotification(fresh.length === 1 ? 'Time for a new photo' : fresh.length + ' projects are due', {
    body: fresh.length === 1 ? 'Keep “' + names[0] + '” going — take today’s shot.' : names.join(', '),
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: 'aligno-due',
    data: { project: fresh.length === 1 ? fresh[0].p.id : null }
  });
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'aligno-due') e.waitUntil(checkDue()); });
self.addEventListener('message', (e) => { if (e.data === 'check-due') e.waitUntil(checkDue()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const pid = e.notification.data && e.notification.data.project;
  const target = pid ? './?project=' + encodeURIComponent(pid) : './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    if (cs.length) { cs[0].postMessage({ open: pid || null }); return cs[0].focus(); }
    return self.clients.openWindow(target);
  }));
});
