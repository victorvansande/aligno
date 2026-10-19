'use strict';

const APP_VERSION = 'v37';
/* --- Storage: IndexedDB with a projects store and a photos store (Blobs). --- */
const DB_NAME = 'aligno';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('photos')) {
        const s = d.createObjectStore('photos', { keyPath: 'id' });
        s.createIndex('byProject', 'projectId');
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function store(name, mode) { return db.transaction(name, mode).objectStore(name); }
function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

const dbProjects = () => reqP(store('projects', 'readonly').getAll());
const dbGetProject = (id) => reqP(store('projects', 'readonly').get(id));
const dbPutProject = (p) => reqP(store('projects', 'readwrite').put(p));
const dbDelProject = (id) => reqP(store('projects', 'readwrite').delete(id));
const dbAddPhoto = (ph) => reqP(store('photos', 'readwrite').put(ph));
const dbDelPhoto = (id) => reqP(store('photos', 'readwrite').delete(id));
const dbPhotoCount = (pid) => reqP(store('photos', 'readonly').index('byProject').count(IDBKeyRange.only(pid)));

async function photosOf(p) {
  const rows = await reqP(store('photos', 'readonly').index('byProject').getAll(IDBKeyRange.only(p.id)));
  const leftovers = (p.photos || []).map(ph => ({ id: ph.id, projectId: p.id, ts: ph.ts, dataUrl: ph.dataUrl }));
  return rows.concat(leftovers).sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

function dataUrlToBlob(u) {
  const i = u.indexOf(',');
  const mime = ((u.slice(0, i).match(/data:([^;]+)/) || [])[1]) || 'image/jpeg';
  const bin = atob(u.slice(i + 1));
  const arr = new Uint8Array(bin.length);
  for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
  return new Blob([arr], { type: mime });
}

async function migrate() {
  const projects = await dbProjects();
  for (const p of projects) {
    if (!p.photos || !p.photos.length) continue;
    const remaining = [];
    for (const ph of p.photos) {
      try {
        const blob = dataUrlToBlob(ph.dataUrl);
        await dbAddPhoto({ id: ph.id || uid(), projectId: p.id, ts: ph.ts || Date.now(), blob });
      } catch (e) { remaining.push(ph); }
    }
    if (remaining.length) p.photos = remaining; else delete p.photos;
    try { await dbPutProject(p); } catch (e) {}
  }
}

const urlCache = new Map();
function urlFor(ph, kind) {
  if (ph.dataUrl) return ph.dataUrl;
  const useThumb = kind === 'thumb' && ph.thumb;
  const key = ph.id + (useThumb ? ':t' : ':f');
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(useThumb ? ph.thumb : ph.blob));
  return urlCache.get(key);
}
function dropUrls(id) {
  [':t', ':f'].forEach(s => {
    const k = id + s;
    if (urlCache.has(k)) { try { URL.revokeObjectURL(urlCache.get(k)); } catch (e) {} urlCache.delete(k); }
  });
}

/* --- Small helpers: ids, DOM lookup, dates, escaping. --- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (id) => document.getElementById(id);

function fmtAgo(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return d + ' days ago';
  if (d < 14) return '1 week ago';
  if (d < 60) return Math.floor(d / 7) + ' weeks ago';
  if (d < 365) return Math.floor(d / 30) + ' months ago';
  const y = Math.floor(d / 365);
  return y === 1 ? '1 year ago' : y + ' years ago';
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(ts) {
  const dt = new Date(ts);
  const s = MONTHS[dt.getMonth()] + ' ' + dt.getDate();
  return dt.getFullYear() === new Date().getFullYear() ? s : s + " '" + String(dt.getFullYear()).slice(2);
}
function fmtFullDate(ts) {
  try { return new Date(ts).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return fmtDate(ts); }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

/* --- Photo origin badges (taken in app vs imported). --- */
function isImported(ph) { return ph && ph.src === 'import'; }
function srcIcon(ph) {
  return isImported(ph)
    ? '<svg class="srcic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3.5"/><circle cx="8.5" cy="9" r="1.7"/><path d="M21 15.5l-5.5-5.5L5 21"/></svg>'
    : '<svg class="srcic" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3H8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"/><circle cx="12" cy="13" r="4"/></svg>';
}
function srcLabel(ph) { return isImported(ph) ? 'Imported' : 'Taken in app'; }

/* --- Illustrations for examples, the landing demo and empty states. ---
   One set, one style (DESIGN.md §15): 40×40, flat shapes, a pastel scene
   per subject, light from the top left, and the subject anchored at the same
   spot in every frame, because that is what Aligno is about. */
const svg40 = (body) => '<svg viewBox="0 0 40 40" aria-hidden="true">' + body + '</svg>';
const f1 = (n) => n.toFixed(1);

function plantIll(g) {
  const h = 5 + g * 19, top = 29 - h;
  const n = 1 + Math.round(g * 4);
  let leaves = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1), y = 29 - t * h, side = i % 2 ? -1 : 1, s = 0.55 + g * 0.6 * (1 - t * 0.35);
    leaves += '<path transform="translate(20 ' + f1(y) + ') scale(' + (side * s).toFixed(2) + ' ' + s.toFixed(2) + ') rotate(-24)" d="M0 0c2.6-3.2 7.4-3.8 10-1.2C7.4 1.8 2.8 2.6 0 0z" fill="' + (side > 0 ? '#58B07E' : '#469C6B') + '"/>';
  }
  const bloom = g > 0.8
    ? '<g transform="translate(20 ' + f1(top) + ')"><circle cx="-1.6" r="1.7" fill="#F49AB4"/><circle cx="1.6" r="1.7" fill="#F49AB4"/><circle cy="-1.6" r="1.7" fill="#F7AEC3"/><circle cy="1.5" r="1.7" fill="#EE86A4"/><circle r="1" fill="#FFD66B"/></g>'
    : '<circle cx="20" cy="' + f1(top) + '" r="1.1" fill="#6CC08F"/>';
  return svg40(
    '<rect width="40" height="40" fill="#EAF3EC"/><rect x="3" y="3" width="13" height="16" rx="2" fill="#F6FBF7"/>' +
    '<rect y="35.5" width="40" height="4.5" fill="#DCCDB2"/><ellipse cx="20" cy="35.8" rx="7.5" ry="1" fill="#000" opacity=".1"/>' +
    '<path d="M20 29C19 ' + f1(29 - h * 0.45) + ' 21 ' + f1(29 - h * 0.7) + ' 20 ' + f1(top) + '" stroke="#3E8A5A" stroke-width="1.3" fill="none" stroke-linecap="round"/>' +
    leaves + bloom +
    '<path d="M14.6 30h10.8l-1.3 5.7h-8.2z" fill="#C8784C"/><rect x="13.6" y="28" width="12.8" height="2.6" rx="1" fill="#B5653C"/>' +
    '<path d="M16.3 31l.7 4" stroke="#E2A27A" stroke-width=".9" stroke-linecap="round" opacity=".7"/>'
  );
}

function personIll(g) {
  const H = 13 + g * 14, feet = 35, head = 3 + g * 0.6, x = 23;
  const headY = feet - H + head, shoulder = headY + head + 0.6, hip = shoulder + (H - head * 2) * 0.48;
  const marks = [0.25, 0.6].filter(m => m < g - 0.01)
    .map(m => '<path d="M8 ' + f1(feet - (13 + m * 14)) + 'h6" stroke="#C9688A" stroke-width=".9" stroke-linecap="round"/>').join('');
  let ticks = '';
  for (let y = 9; y < 35; y += 3) ticks += '<path d="M8 ' + y + 'h' + (y % 6 === 0 ? 3 : 1.8) + '" stroke="#E4BFCB" stroke-width=".6"/>';
  return svg40(
    '<rect width="40" height="40" fill="#FBF0F3"/><rect x="6" y="4" width="8" height="31" rx="1" fill="#F6E1E7"/>' + ticks + marks +
    '<path d="M7 ' + f1(feet - H) + 'h22" stroke="#C9688A" stroke-width=".8" stroke-dasharray="1.2 1.2" opacity=".55"/>' +
    '<rect y="35" width="40" height="5" fill="#EAD8C8"/><ellipse cx="' + x + '" cy="35.2" rx="5" ry=".8" fill="#000" opacity=".1"/>' +
    '<rect x="' + (x - 2.4) + '" y="' + f1(hip) + '" width="2.1" height="' + f1(feet - hip) + '" rx="1" fill="#55679E"/>' +
    '<rect x="' + (x + 0.3) + '" y="' + f1(hip) + '" width="2.1" height="' + f1(feet - hip) + '" rx="1" fill="#4A5B8F"/>' +
    '<rect x="' + (x - 3.4) + '" y="' + f1(shoulder) + '" width="6.8" height="' + f1(hip - shoulder + 1) + '" rx="2.2" fill="#E77FA0"/>' +
    '<circle cx="' + x + '" cy="' + f1(headY) + '" r="' + f1(head) + '" fill="#F2C6A6"/>' +
    '<path d="M' + f1(x - head) + ' ' + f1(headY) + 'a' + f1(head) + ' ' + f1(head) + ' 0 0 1 ' + f1(head * 2) + ' 0c-1.6-1-3.2-1.2-' + f1(head * 2) + ' 0z" fill="#5C3F31"/>'
  );
}

function buildIll(stage) {
  const sky = '<rect width="40" height="40" fill="#E4EEF9"/><circle cx="32" cy="8.5" r="5" fill="#FFD27A" opacity=".25"/><circle cx="32" cy="8.5" r="3.2" fill="#FFD27A"/>' +
    '<rect y="30" width="40" height="10" fill="#CFBD95"/><rect y="29.4" width="40" height="1.4" fill="#9EC07E"/>';
  if (stage === 0) {
    return svg40(sky + '<path d="M10 30.2h20" stroke="#A9895C" stroke-width=".5" stroke-dasharray="1 1"/>' +
      '<rect x="9.4" y="26.5" width="1.2" height="4" fill="#9C7A4E"/><rect x="29.4" y="26.5" width="1.2" height="4" fill="#9C7A4E"/>' +
      '<path d="M10 27h20" stroke="#E8735A" stroke-width=".5"/>' +
      '<rect x="31.5" y="24" width="5" height="3.5" rx=".5" fill="#F4F0E6"/><rect x="33.6" y="27.5" width=".8" height="3" fill="#9C7A4E"/>');
  }
  if (stage === 1) {
    let posts = '';
    [10.5, 15.2, 19.9, 24.6, 29.3].forEach(px => { posts += '<rect x="' + px + '" y="19.5" width="1.2" height="9.5" fill="#C99A63"/>'; });
    return svg40(sky + '<rect x="9" y="28.6" width="22" height="2.2" fill="#B9B6AF"/>' + posts +
      '<rect x="10" y="19" width="20.6" height="1.3" fill="#B98852"/>' +
      '<path d="M9.5 19.4L20.3 11.8 31.1 19.4" stroke="#B98852" stroke-width="1.2" fill="none" stroke-linejoin="round"/>' +
      '<path d="M3 30V9h1.4v21M4.4 9.6h11" stroke="#E2A23B" stroke-width="1.1" fill="none"/><path d="M14 9.6v3.4" stroke="#7A7A80" stroke-width=".5"/>');
  }
  return svg40(sky + '<rect x="10" y="19" width="20" height="11" fill="#F4E8D6"/><rect x="10" y="19" width="5" height="11" fill="#EBDDC8"/>' +
    '<rect x="25.6" y="11.5" width="2.6" height="5" fill="#A9483A"/><path d="M8 19.8L20 11l12 8.8z" fill="#C8573C"/><path d="M20 11l12 8.8h-3.4z" fill="#B24A33"/>' +
    '<rect x="18" y="23.6" width="4" height="6.4" rx=".6" fill="#8A6643"/>' +
    '<rect x="12.2" y="21.6" width="3.8" height="3.4" rx=".4" fill="#A9D0EE"/><rect x="24" y="21.6" width="3.8" height="3.4" rx=".4" fill="#A9D0EE"/>' +
    '<rect x="34.4" y="25" width="1" height="5" fill="#8A6643"/><circle cx="34.9" cy="23.6" r="3" fill="#5FAE6E"/><circle cx="34" cy="22.7" r="1.2" fill="#77C185"/>');
}

function moonIll(p) {
  const bg = '#1D2447', off = f1(p * 15.5);
  return svg40(
    '<rect width="40" height="40" fill="' + bg + '"/><circle cx="20" cy="17" r="10.5" fill="#F3EBD2" opacity=".07"/>' +
    '<circle cx="20" cy="17" r="7.5" fill="#F3EBD2"/><circle cx="17.5" cy="15" r="1.4" fill="#E4D9B9"/><circle cx="22.5" cy="19.5" r="1.9" fill="#E4D9B9"/><circle cx="21.6" cy="13.4" r=".9" fill="#E4D9B9"/>' +
    '<circle cx="' + f1(20 - +off) + '" cy="17" r="7.7" fill="' + bg + '"/>' +
    '<circle cx="5" cy="6" r=".5" fill="#fff" opacity=".8"/><circle cx="34" cy="5" r=".6" fill="#fff" opacity=".9"/><circle cx="35" cy="20" r=".4" fill="#fff" opacity=".6"/><circle cx="7" cy="24" r=".4" fill="#fff" opacity=".6"/>' +
    '<path d="M0 34c7-3.5 13-3.5 20-1.5S33 34 40 31v9H0z" fill="#141934"/>'
  );
}

const EXAMPLES = [
  { name: 'Living room plant', label: 'Plant', desc: 'Seedling to bloom', frames: [plantIll(0.18), plantIll(0.55), plantIll(1)] },
  { name: 'House build', label: 'Building', desc: 'Plot to home', frames: [buildIll(0), buildIll(1), buildIll(2)] },
  { name: 'Growing up', label: 'A child', desc: 'Year after year', frames: [personIll(0.25), personIll(0.6), personIll(1)] },
  { name: 'The moon', label: 'The moon', desc: 'Night after night', frames: [moonIll(0.35), moonIll(0.68), moonIll(1)] }
];

function strip(frames) {
  return frames.map((f, j) => (j ? '<span class="ex-ar">›</span>' : '') + '<span class="ex-fr">' + f + '</span>').join('');
}
function renderExamples() {
  const el = $('exampleList');
  if (el) el.innerHTML = EXAMPLES.map(e =>
    '<button class="ex" data-name="' + escapeHtml(e.name) + '"><span class="ex-strip">' + strip(e.frames) + '</span>' +
    '<span class="ex-txt"><b>' + e.label + '</b><span>' + e.desc + '</span></span></button>'
  ).join('');
}
function renderLandingDemo() {
  const el = $('ldDemoStrip');
  if (el) el.innerHTML = strip([plantIll(0.16), plantIll(0.55), plantIll(1)]);
}

/* --- App state, theme and screen navigation. --- */
const state = { screen: 'landing', projectId: null, overlayMode: 'photo' };

function themePref() { try { return localStorage.getItem('aligno_theme') || 'system'; } catch (e) { return 'system'; } }
function uiIsDark() {
  const t = themePref();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
let darkSurface = false;
function setTheme(dark) {
  darkSurface = !!dark;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#08080b' : (uiIsDark() ? '#0D0D12' : '#ffffff'));
}
function applyThemePref(t) {
  try { if (t === 'system') localStorage.removeItem('aligno_theme'); else localStorage.setItem('aligno_theme', t); } catch (e) {}
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  syncThemeSeg();
  setTheme(darkSurface);
}
function syncThemeSeg() {
  const t = themePref();
  document.querySelectorAll('[data-theme-opt]').forEach(b => b.classList.toggle('on', b.getAttribute('data-theme-opt') === t));
}

const screens = ['landing', 'home', 'project', 'camera', 'export', 'reminders', 'settings', 'aligner'];
// Going deeper slides in from the right, going back from the left, like
// native navigation; screens on the same level just fade.
const DEPTH = { landing: 0, home: 0, project: 1, settings: 1, export: 2, reminders: 2, camera: 2, aligner: 2 };
function show(name) {
  if (state.screen === 'camera' && name !== 'camera') stopCamera();
  if (state.screen === 'export' && name !== 'export') stopExportPreview();
  const from = DEPTH[state.screen], to = DEPTH[name];
  const dir = name === state.screen ? '' : to > from ? 'push' : to < from ? 'pop' : '';
  screens.forEach(s => {
    const el = $('screen-' + s);
    if (!el) return;
    const on = s === name;
    if (on && !el.classList.contains('active')) { el.classList.remove('push', 'pop'); if (dir) el.classList.add(dir); }
    el.classList.toggle('active', on);
  });
  state.screen = name;
  setTheme(name === 'camera' || name === 'aligner');
  if (typeof syncHistory === 'function' && $('photoView')) syncHistory();
}

/* --- Home: project list, due badges, swipe to delete. --- */
function reminderInterval(p) {
  return { daily: 1, weekly: 7, monthly: 30 }[String((p && p.reminder) || '').toLowerCase()] || 0;
}
function isDue(p, last) {
  const iv = reminderInterval(p);
  if (!iv) return false;
  if (!last) return true;
  return (Date.now() - last.ts) / 86400000 >= iv;
}

async function renderHome() {
  const list = $('projectList');
  const projects = (await dbProjects()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!projects.length) {
    list.innerHTML = '<div class="empty">' +
      '<div class="empty-strip">' + strip([plantIll(0.18), plantIll(0.55), plantIll(1)]) + '</div>' +
      '<h3>Start your first project</h3>' +
      '<p>One series of photos of the same subject, taken over time.</p></div>';
    return;
  }
  const cards = await Promise.all(projects.map(async (p, idx) => {
    const photos = await photosOf(p);
    const last = photos.length ? photos[photos.length - 1] : null;
    const thumb = last
      ? '<img class="pthumb" src="' + urlFor(last, 'thumb') + '" alt="">'
      : '<div class="pthumb"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3H8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"/><circle cx="12" cy="13" r="4"/></svg></div>';
    const n = photos.length;
    const due = isDue(p, last) ? '<span class="duechip">Due</span>' : '';
    return '<div class="pswipe" style="animation-delay:' + Math.min(idx * 40, 320) + 'ms">' +
      '<button class="pdel" data-del="' + p.id + '" aria-label="Delete ' + escapeHtml(p.name) + '"><span class="pdel-in"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg><span>Delete</span></span></button>' +
      '<div class="pcard" data-open="' + p.id + '" role="button" tabindex="0">' + thumb +
      '<div class="grow"><div class="nm">' + escapeHtml(p.name) + '</div>' +
      '<div class="mt">' + (n ? n + (n === 1 ? ' photo' : ' photos') + ' · ' + fmtAgo(last.ts) : 'No photos yet') + due + '</div></div>' +
      '<span class="chev"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span></div></div>';
  }));
  list.innerHTML = cards.join('');
  setDueBadge(cards.filter(c => c.indexOf('class="duechip"') >= 0).length);
  list.querySelectorAll('.pswipe').forEach(wireSwipeCard);
  list.querySelectorAll('[data-del]').forEach(el => {
    el.addEventListener('click', () => deleteProjectFromHome(el.getAttribute('data-del')));
  });
}

/* Swipe to delete, like iOS Mail: the red layer lies behind the whole card,
   the card slides off it, and the trash icon grows with the drag (--p).
   A quick flick opens or closes; dragging past the button meets resistance. */
const SWIPE_W = 88;
const SWIPE_EASE = 'transform .34s cubic-bezier(.2,.9,.25,1)';
function setSwipe(wrap, x, animate) {
  const card = wrap.querySelector('.pcard');
  card.style.transition = animate ? SWIPE_EASE : 'none';
  wrap.classList.toggle('animating', !!animate);
  wrap.style.setProperty('--p', Math.min(1, Math.max(0, -x / SWIPE_W)).toFixed(3));
  clearTimeout(wrap._clrT);
  if (x === 0) {
    card.style.transform = '';
    const done = () => { card.style.transition = ''; wrap.classList.remove('sw', 'animating'); };
    if (animate) wrap._clrT = setTimeout(done, 340); else done();
  } else {
    wrap.classList.add('sw');
    card.style.transform = 'translateX(' + x + 'px)';
  }
}
function closeOtherSwipes(except) {
  document.querySelectorAll('.pswipe').forEach(w => {
    if (w !== except && w._swOpen) { w._swOpen = false; setSwipe(w, 0, true); }
  });
}
function wireSwipeCard(wrap) {
  const link = wrap.querySelector('[data-open]');
  let startX = 0, startY = 0, baseX = 0, x = 0, dragging = false, moved = false, armed = false, lastX = 0, lastT = 0, vel = 0;
  wrap._swOpen = false;
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.pdel')) return;
    dragging = true; moved = false;
    startX = e.clientX; startY = e.clientY; baseX = wrap._swOpen ? -SWIPE_W : 0; x = baseX;
    armed = wrap._swOpen; lastX = e.clientX; lastT = e.timeStamp; vel = 0;
    closeOtherSwipes(wrap);
  });
  wrap.addEventListener('pointermove', e => {
    if (!dragging) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 8) return;
    if (!moved && Math.abs(dy) > Math.abs(dx)) { dragging = false; return; }
    moved = true;
    let nx = baseX + dx;
    if (nx < -SWIPE_W) nx = -SWIPE_W - Math.pow(-SWIPE_W - nx, 0.8) * 0.35;
    if (nx > 0) nx = Math.pow(nx, 0.7) * 0.3;
    x = nx;
    const dt = e.timeStamp - lastT;
    if (dt > 0) vel = 0.8 * ((e.clientX - lastX) / dt) + 0.2 * vel;
    lastX = e.clientX; lastT = e.timeStamp;
    const nowArmed = x < -SWIPE_W / 2;
    if (nowArmed !== armed) { armed = nowArmed; if (navigator.vibrate) { try { navigator.vibrate(6); } catch (er) {} } }
    setSwipe(wrap, x, false);
  });
  function endDrag() {
    if (!dragging) return;
    dragging = false;
    if (!moved) return;
    let open = x < -SWIPE_W / 2;
    if (vel < -0.35) open = true;
    if (vel > 0.35) open = false;
    wrap._swOpen = open;
    setSwipe(wrap, open ? -SWIPE_W : 0, true);
    // Swallow only the click that the drag itself may produce.
    link._justSwiped = true;
    setTimeout(() => { link._justSwiped = false; }, 250);
  }
  wrap.addEventListener('pointerup', endDrag);
  wrap.addEventListener('pointercancel', () => { if (dragging) { dragging = false; wrap._swOpen = false; setSwipe(wrap, 0, true); } });
  link.addEventListener('click', (e) => {
    if (link._justSwiped) { link._justSwiped = false; e.preventDefault(); e.stopPropagation(); return; }
    if (wrap._swOpen) { wrap._swOpen = false; setSwipe(wrap, 0, true); return; }
    openProject(link.getAttribute('data-open'));
  });
}
// After a confirmed delete the card slides out and the list closes the gap.
function collapseCard(wrap) {
  return new Promise(resolve => {
    if (!wrap || !wrap.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) { resolve(); return; }
    const card = wrap.querySelector('.pcard');
    const h = wrap.offsetHeight, mb = parseFloat(getComputedStyle(wrap).marginBottom) || 0;
    card.style.transition = 'transform .24s cubic-bezier(.4,0,1,1)';
    card.style.transform = 'translateX(-110%)';
    wrap.style.setProperty('--p', 1);
    const a = wrap.animate([{ height: h + 'px', marginBottom: mb + 'px', opacity: 1 }, { height: '0px', marginBottom: '0px', opacity: 0 }],
      { duration: 260, delay: 160, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    // Never let the delete wait on an animation (a hidden page may not run it).
    const t = setTimeout(resolve, 600);
    a.onfinish = () => { clearTimeout(t); resolve(); };
  });
}
async function deleteProjectFromHome(id) {
  const p = await dbGetProject(id);
  const ok = await confirmSheet('Delete “' + ((p && p.name) || 'this project') + '”?', 'All its photos will be permanently removed from this device.', 'Delete project');
  if (!ok) { closeOtherSwipes(null); return; }
  const btn = document.querySelector('[data-del="' + id + '"]');
  await collapseCard(btn && btn.closest('.pswipe'));
  const photos = p ? await photosOf(p) : [];
  for (const ph of photos) {
    if (!ph.dataUrl) { try { await dbDelPhoto(ph.id); } catch (e) {} }
    dropUrls(ph.id);
  }
  await dbDelProject(id);
  if (state.projectId === id) state.projectId = null;
  renderHome();
}

/* --- Project screen: hero, photo grid, due banner. --- */
let projPhotos = [];

async function openProject(id) {
  state.projectId = id;
  const p = await dbGetProject(id);
  if (!p) { show('home'); renderHome(); return; }
  $('projTitle').textContent = p.name;
  const photos = await photosOf(p);
  projPhotos = photos;
  const last = photos.length ? photos[photos.length - 1] : null;

  $('dueBanner').innerHTML = isDue(p, last)
    ? '<div class="due-banner" id="dueGo">' +
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      '<span><b>Photo due.</b> Keep the series going with the next shot.</span>' +
      '<span class="go"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>'
    : '';
  const dueGo = $('dueGo');
  if (dueGo) dueGo.addEventListener('click', openCamera);
  const iv = reminderInterval(p);
  if (iv && last && !isDue(p, last)) {
    const left = Math.ceil(iv - (Date.now() - last.ts) / 86400000);
    $('dueBanner').innerHTML = '<button class="nextchip" id="nextChip"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      'Next photo ' + (left <= 1 ? 'within a day' : 'in ' + left + ' days') + ' · ' + String(p.reminder).toLowerCase() + ' reminder</button>';
    $('nextChip').addEventListener('click', openReminders);
  }

  $('projMeta').textContent = photos.length >= 2 ? 'All photos' : (photos.length + (photos.length === 1 ? ' photo' : ' photos') + ' · chronological');
  renderProjectHero(photos);
  const grid = $('photoGrid');
  const empty = $('projEmpty');
  if (!photos.length) {
    grid.innerHTML = '';
    empty.innerHTML = '<div class="empty"><div class="ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3H8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"/><circle cx="12" cy="13" r="4"/></svg></div><h3>No photos yet</h3><p>Take your first photo below, or start from photos you already have.</p>' +
      '<div class="acts"><button class="btn ghost block" id="emptyImport"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.8"/><path d="M21 15.5l-5.5-5.5L5 21"/></svg>Import existing photos</button></div></div>';
    $('emptyImport').addEventListener('click', () => beginImportForProject(id));
  } else {
    empty.innerHTML = '';
    grid.innerHTML = photos.map((ph, i) =>
      '<div class="ptile" data-i="' + i + '" role="button" tabindex="0" aria-label="Photo from ' + fmtFullDate(ph.ts) + '" style="animation-delay:' + Math.min(i * 30, 300) + 'ms"><img src="' + urlFor(ph, 'thumb') + '" alt=""><span class="day">' + srcIcon(ph) + fmtDate(ph.ts) + '</span></div>'
    ).join('');
  }
  show('project');
}

function renderProjectHero(photos) {
  const hero = $('projHero');
  if (!photos || photos.length < 2) { hero.innerHTML = ''; return; }
  const first = photos[0], last = photos[photos.length - 1];
  const days = Math.max(1, Math.round((last.ts - first.ts) / 86400000));
  hero.innerHTML =
    '<div class="hero"><div class="hero-row">' +
    '<figure class="hero-fig"><img src="' + urlFor(first, 'thumb') + '" alt=""><figcaption>' + srcIcon(first) + 'First</figcaption></figure>' +
    '<div class="hero-ar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>' +
    '<figure class="hero-fig"><img src="' + urlFor(last, 'thumb') + '" alt=""><figcaption>' + srcIcon(last) + 'Latest</figcaption></figure>' +
    '</div><div class="hero-stats">' +
    '<div class="stat"><b>' + photos.length + '</b><span>photos</span></div>' +
    '<div class="stat"><b>' + days + '</b><span>' + (days === 1 ? 'day' : 'days') + '</span></div>' +
    '<div class="stat"><b>' + fmtDate(last.ts) + '</b><span>latest</span></div>' +
    '</div>' +
    '<button class="hero-cmp" id="heroCmp"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/><path d="M8 10l-2 2 2 2M16 10l2 2-2 2"/></svg>Compare before &amp; after</button>' +
    '</div>';
  $('heroCmp').addEventListener('click', () => openCompare(0, photos.length - 1));
  hero.querySelector('.hero-row').addEventListener('click', () => openCompare(0, photos.length - 1));
}

/* --- Before/after compare: drag a divider across two photos of the series. --- */
const cmp = { a: 0, b: 0, slot: 'a', pos: 0.5, list: [], dragging: false };
function openCompare(a, b) {
  cmp.list = projPhotos.slice();
  if (cmp.list.length < 2) return;
  cmp.a = a; cmp.b = b; cmp.slot = 'b'; cmp.pos = 0.5;
  $('cmpStrip').innerHTML = cmp.list.map((ph, i) =>
    '<button class="cmp-th" data-ci="' + i + '"><img src="' + urlFor(ph, 'thumb') + '" alt=""><i class="ia">A</i><i class="ib">B</i></button>'
  ).join('');
  $('cmpView').classList.add('on');
  setTheme(true);
  cmpRender();
  const sel = $('cmpStrip').querySelector('.cmp-th.b');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'center' });
}
function closeCompare() {
  $('cmpView').classList.remove('on');
  setTheme(state.screen === 'camera' || state.screen === 'aligner');
}
function cmpFit() {
  const A = $('cmpA'), area = $('cmpArea'), st = $('cmpStage');
  const ar = (A.naturalWidth && A.naturalHeight) ? A.naturalWidth / A.naturalHeight : 3 / 4;
  const aw = area.clientWidth - 24, ah = area.clientHeight - 8;
  let w = aw, h = w / ar;
  if (h > ah) { h = ah; w = h * ar; }
  st.style.width = Math.max(50, Math.round(w)) + 'px';
  st.style.height = Math.max(50, Math.round(h)) + 'px';
}
function cmpSetPos(p) {
  cmp.pos = Math.max(0, Math.min(1, p));
  $('cmpB').style.clipPath = 'inset(0 0 0 ' + (cmp.pos * 100) + '%)';
  $('cmpLine').style.left = (cmp.pos * 100) + '%';
}
function cmpRender() {
  const A = cmp.list[cmp.a], B = cmp.list[cmp.b];
  const imA = $('cmpA');
  imA.onload = cmpFit;
  imA.src = urlFor(A, 'full');
  $('cmpB').src = urlFor(B, 'full');
  if (imA.complete) cmpFit();
  $('cmpSegA').textContent = fmtDate(A.ts);
  $('cmpSegB').textContent = fmtDate(B.ts);
  $('cmpSeg').querySelectorAll('[data-slot]').forEach(x => x.classList.toggle('on', x.getAttribute('data-slot') === cmp.slot));
  $('cmpStrip').querySelectorAll('.cmp-th').forEach(t => {
    const i = +t.getAttribute('data-ci');
    t.classList.toggle('a', i === cmp.a);
    t.classList.toggle('b', i === cmp.b);
  });
  cmpSetPos(cmp.pos);
}
function cmpPointer(e) {
  const r = $('cmpStage').getBoundingClientRect();
  cmpSetPos((e.clientX - r.left) / r.width);
}
async function shareCompare() {
  const A = cmp.list[cmp.a], B = cmp.list[cmp.b];
  if (!A || !B) return;
  try {
    const [ia, ib] = await Promise.all([loadImage(urlFor(A, 'full')), loadImage(urlFor(B, 'full'))]);
    const half = 720, ar = ia.naturalWidth / ia.naturalHeight || 0.75;
    const H = Math.round(Math.min(1280, half / ar)), gap = 8;
    const c = document.createElement('canvas'); c.width = half * 2 + gap; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, H);
    const drawHalf = (im, x) => {
      ctx.save(); ctx.beginPath(); ctx.rect(x, 0, half, H); ctx.clip();
      ctx.translate(x, 0); drawCover(ctx, im, half, H); ctx.restore();
    };
    drawHalf(ia, 0); drawHalf(ib, half + gap);
    const tag = (txt, x) => {
      ctx.font = '600 26px -apple-system, "Segoe UI", Roboto, sans-serif';
      const w = ctx.measureText(txt).width + 32;
      ctx.fillStyle = 'rgba(10,10,14,.6)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x + 20, H - 70, w, 46, 23); ctx.fill(); } else ctx.fillRect(x + 20, H - 70, w, 46);
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x + 36, H - 47);
    };
    tag(fmtDate(A.ts), 0); tag(fmtDate(B.ts), half + gap);
    const blob = await toBlobP(c, 'image/jpeg', 0.9);
    const name = fileSafe($('projTitle').textContent) + '-before-after.jpg';
    const file = new File([blob], name, { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Before & after' }).catch(() => {});
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
  } catch (e) {}
}
function wireCompare() {
  const st = $('cmpStage');
  st.addEventListener('pointerdown', e => { cmp.dragging = true; st.setPointerCapture && st.setPointerCapture(e.pointerId); cmpPointer(e); });
  st.addEventListener('pointermove', e => { if (cmp.dragging) cmpPointer(e); });
  ['pointerup', 'pointercancel'].forEach(t => st.addEventListener(t, () => { cmp.dragging = false; }));
  $('cmpClose').addEventListener('click', closeCompare);
  $('cmpShare').addEventListener('click', shareCompare);
  $('cmpSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-slot]'); if (!b) return;
    cmp.slot = b.getAttribute('data-slot'); cmpRender();
  });
  $('cmpStrip').addEventListener('click', e => {
    const t = e.target.closest('[data-ci]'); if (!t) return;
    cmp[cmp.slot] = +t.getAttribute('data-ci'); cmpRender();
  });
  window.addEventListener('resize', () => { if ($('cmpView').classList.contains('on')) cmpFit(); });
}

/* --- Sheets: new project, confirm, project menu, rename. --- */
let newProjectAfterCreate = false;
function openNewProjectModal(thenCamera) {
  newProjectAfterCreate = !!thenCamera;
  $('projName').value = '';
  $('exampleList').querySelectorAll('.ex').forEach(x => x.classList.remove('sel'));
  $('newModal').classList.add('on');
}
function closeNewProjectModal() { $('newModal').classList.remove('on'); }
async function createProject() {
  const name = $('projName').value.trim() || 'Untitled project';
  const p = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), reminder: 'off' };
  await dbPutProject(p);
  closeNewProjectModal();
  state.projectId = p.id;
  if (newProjectAfterCreate) { openCamera(); } else { openProject(p.id); }
  renderHome();
}

let cfResolve = null;
function confirmSheet(title, msg, okLabel) {
  return new Promise(res => {
    cfResolve = res;
    $('cfTitle').textContent = title;
    $('cfMsg').textContent = msg;
    $('cfOk').textContent = okLabel || 'Confirm';
    $('cfModal').classList.add('on');
  });
}
function cfDone(v) {
  $('cfModal').classList.remove('on');
  if (cfResolve) { cfResolve(v); cfResolve = null; }
}

async function deleteCurrentProject() {
  if (!state.projectId) return;
  const ok = await confirmSheet('Delete this project?', 'All its photos will be permanently removed from this device.', 'Delete project');
  if (!ok) return;
  const p = await dbGetProject(state.projectId);
  if (p) {
    const photos = await photosOf(p);
    for (const ph of photos) {
      if (!ph.dataUrl) { try { await dbDelPhoto(ph.id); } catch (e) {} }
      dropUrls(ph.id);
    }
  }
  await dbDelProject(state.projectId);
  state.projectId = null;
  show('home');
  renderHome();
}

function openProjectMore() {
  $('moreTitle').textContent = $('projTitle').textContent || 'Project';
  dbGetProject(state.projectId).then(p => {
    const r = String((p && p.reminder) || 'off');
    $('moreRemSub').textContent = r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  });
  $('moreModal').classList.add('on');
}
function closeProjectMore() { $('moreModal').classList.remove('on'); }
function openRename() {
  $('renName').value = $('projTitle').textContent;
  $('renModal').classList.add('on');
  setTimeout(() => $('renName').focus(), 60);
}
async function saveRename() {
  const p = state.projectId ? await dbGetProject(state.projectId) : null;
  const nv = $('renName').value.trim();
  if (p && nv) {
    p.name = nv;
    p.updatedAt = Date.now();
    await dbPutProject(p);
    $('projTitle').textContent = nv;
    renderHome();
  }
  $('renModal').classList.remove('on');
}

/* --- Camera: live view, overlay modes (Fade, Edges, Blend), zoom, timer, level, capture. --- */
let stream = null, facing = 'environment', gridMode = 0, camHasOverlay = false;
let overlayRaw = null, overlayEdge = null;

function computeEdges(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 900;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const s = ctx.getImageData(0, 0, w, h).data;
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < s.length; i += 4, p++) gray[p] = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
        const mag = new Float32Array(w * h);
        const ang = new Uint8Array(w * h);
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const gx = -gray[i - 1 - w] + gray[i + 1 - w] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i - 1 + w] + gray[i + 1 + w];
            const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
            mag[i] = Math.sqrt(gx * gx + gy * gy);
            let a = Math.atan2(gy, gx) * 180 / Math.PI; if (a < 0) a += 180;
            ang[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
          }
        }
        const ea = new Uint8ClampedArray(w * h);
        const lo = 50, hi = 175, ER = 255, EG = 46, EB = 154;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const m = mag[i];
            if (m < lo) continue;
            const d = ang[i];
            let n1, n2;
            if (d === 0) { n1 = mag[i - 1]; n2 = mag[i + 1]; }
            else if (d === 1) { n1 = mag[i - w + 1]; n2 = mag[i + w - 1]; }
            else if (d === 2) { n1 = mag[i - w]; n2 = mag[i + w]; }
            else { n1 = mag[i - w - 1]; n2 = mag[i + w + 1]; }
            if (m < n1 || m < n2) continue;
            ea[i] = m >= hi ? 255 : Math.round((m - lo) / (hi - lo) * 255);
          }
        }
        const out = ctx.createImageData(w, h);
        const o = out.data;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            let a = ea[i];
            const nb = Math.max(ea[i - 1], ea[i + 1], ea[i - w], ea[i + w]);
            if (nb * 0.85 > a) a = nb * 0.85;
            if (!a) continue;
            const p = i * 4;
            o[p] = ER; o[p + 1] = EG; o[p + 2] = EB; o[p + 3] = a;
          }
        }
        ctx.putImageData(out, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function syncModeSeg() {
  $('omPhoto').classList.toggle('on', state.overlayMode === 'photo');
  $('omEdges').classList.toggle('on', state.overlayMode === 'edges');
  $('omDiff').classList.toggle('on', state.overlayMode === 'diff');
}
let overlaySource = 'project';
function hideOverlay() {
  overlayRaw = null; overlayEdge = null; camHasOverlay = false; overlaySource = 'project';
  const ov = $('overlay'); ov.removeAttribute('src'); ov.style.opacity = 0; ov.classList.remove('edges'); ov.classList.remove('diff');
  $('opRow').hidden = true; $('modeSeg').hidden = true;
  $('camLastThumb').hidden = true; $('camhint').hidden = hintDismissed('aligno_hint_first');
  $('libChip').hidden = true;
  layoutCamera();
}
function setOverlay(raw, source) {
  overlayRaw = raw; overlayEdge = null; camHasOverlay = true;
  overlaySource = source || 'project';
  $('op').value = camPrefs.op; $('opv').textContent = camPrefs.op + '%';
  $('opRow').hidden = false; $('modeSeg').hidden = false;
  $('camLastThumb').src = raw; $('camLastThumb').hidden = false;
  $('camhint').hidden = true;
  $('libChip').hidden = overlaySource !== 'library';
  applyOverlay();
  layoutCamera();
}

/* Hints never block the camera: one quiet line under the mode tabs that
   fades after a few seconds (shown on the first visits and when you switch
   mode), and a first-photo tip that a single tap dismisses for good. */
const MODE_HINTS = {
  photo: 'Your last photo, see-through. Slide to make it stronger.',
  edges: 'Only the outlines of your last photo, in pink.',
  diff: 'The darker the picture, the better it lines up.'
};
function showModeHint(force) {
  let n = 0; try { n = +localStorage.getItem('aligno_modehint') || 0; } catch (e) {}
  if (!force && n >= 3) return;
  if (!force) { try { localStorage.setItem('aligno_modehint', String(n + 1)); } catch (e) {} }
  camBadge(MODE_HINTS[state.overlayMode] || '', 4000);
}
function hintDismissed(key) { try { return !!localStorage.getItem(key); } catch (e) { return false; } }
function dismissHint(el, key) {
  el.hidden = true;
  try { localStorage.setItem(key, '1'); } catch (e) {}
}
async function loadLibraryOverlay(file) {
  if (!file) return;
  const url = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  setOverlay(url, 'library');
  camBadge('Aligning to your library photo');
}
async function resetOverlayToLast() {
  const p = state.projectId ? await dbGetProject(state.projectId) : null;
  if (!p) { hideOverlay(); return; }
  const photos = await photosOf(p);
  const last = photos.length ? photos[photos.length - 1] : null;
  if (last) setOverlay(urlFor(last, 'full'), 'project'); else hideOverlay();
}
async function applyOverlay() {
  const ov = $('overlay');
  if (!overlayRaw) return;
  ov.style.opacity = $('op').value / 100;
  ov.classList.toggle('diff', state.overlayMode === 'diff');
  if (state.overlayMode === 'edges') {
    if (!overlayEdge) {
      $('omEdges').textContent = 'Working…';
      try { overlayEdge = await computeEdges(overlayRaw); }
      catch (e) { overlayEdge = overlayRaw; }
      $('omEdges').textContent = 'Edges';
      if (state.overlayMode !== 'edges') return;
    }
    ov.src = overlayEdge; ov.classList.add('edges');
  } else {
    ov.src = overlayRaw; ov.classList.remove('edges');
  }
}

/* Overlay mode + opacity are remembered per project, so every session
   starts the way you left it. */
const camPrefs = { op: 50 };
function saveCamPrefs() {
  clearTimeout(saveCamPrefs._t);
  const pid = state.projectId, mode = state.overlayMode, op = Math.round(+$('op').value);
  camPrefs.op = op;
  saveCamPrefs._t = setTimeout(async () => {
    const p = pid ? await dbGetProject(pid) : null;
    if (!p) return;
    p.camMode = mode; p.camOp = op;
    await dbPutProject(p);
  }, 500);
}

/* Self-timer: 0 / 3 / 10 seconds, remembered across sessions. */
let timerSec = 0, countdownT = null;
try { timerSec = +localStorage.getItem('aligno_timer') || 0; } catch (e) {}
function syncTimerBtn() {
  const l = $('timerLbl');
  l.textContent = timerSec ? String(timerSec) : '';
  l.classList.toggle('on', !!timerSec);
  $('timerBtn').setAttribute('aria-label', timerSec ? 'Self-timer: ' + timerSec + ' seconds' : 'Self-timer: off');
}
function cycleTimer() {
  timerSec = timerSec === 0 ? 3 : timerSec === 3 ? 10 : 0;
  try { localStorage.setItem('aligno_timer', String(timerSec)); } catch (e) {}
  syncTimerBtn();
  camBadge(timerSec ? 'Self-timer: ' + timerSec + ' seconds' : 'Self-timer off');
}
function cancelCountdown() {
  clearTimeout(countdownT); countdownT = null;
  $('countdown').classList.remove('on'); $('countdown').innerHTML = '';
}
function shutterPressed() {
  if (countdownT) { cancelCountdown(); camBadge('Timer cancelled'); return; }
  if (!timerSec) { capturePhoto(); return; }
  let n = timerSec;
  const cd = $('countdown');
  cd.classList.add('on');
  const tick = () => {
    if (n <= 0) { cancelCountdown(); capturePhoto(); return; }
    cd.innerHTML = '<span>' + n + '</span>';
    if (navigator.vibrate && n <= 3) { try { navigator.vibrate(8); } catch (e) {} }
    n--;
    countdownT = setTimeout(tick, 1000);
  };
  tick();
}

/* Level: uses gravity from the motion sensor to show how far the phone is
   tilted, so every shot is taken at the same angle. Shown with the grid. */
let levelOn = false, levelRaf = 0, levelG = null;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x === null || g.y === null) return;
  levelG = IS_IOS ? { x: -g.x, y: -g.y, z: -(g.z || 0) } : { x: g.x, y: g.y, z: g.z || 0 };
  if (!levelRaf) levelRaf = requestAnimationFrame(drawLevel);
}
function drawLevel() {
  levelRaf = 0;
  const lv = $('level');
  if (!levelOn || !levelG) { lv.classList.remove('on'); return; }
  const { x, y, z } = levelG;
  const mag = Math.hypot(x, y, z) || 9.8;
  let deg, flat = Math.abs(z) / mag > 0.9;
  if (flat) {
    deg = Math.acos(Math.min(1, Math.abs(z) / mag)) * 180 / Math.PI;
    $('lvLine').style.transform = 'none';
    $('lvDeg').textContent = deg < 1 ? 'Flat ✓' : 'Flat · ' + deg.toFixed(1) + '°';
  } else {
    deg = Math.atan2(x, y) * 180 / Math.PI;
    deg = deg - Math.round(deg / 90) * 90;
    $('lvLine').style.transform = 'rotate(' + deg.toFixed(1) + 'deg)';
    $('lvDeg').textContent = Math.abs(deg) < 1 ? 'Level ✓' : Math.abs(deg).toFixed(1) + '°';
  }
  lv.classList.toggle('ok', Math.abs(deg) < 1);
  lv.classList.add('on');
}
function setLevel(on) {
  levelOn = on;
  if (on) {
    window.addEventListener('devicemotion', onMotion);
  } else {
    window.removeEventListener('devicemotion', onMotion);
    levelG = null;
    $('level').classList.remove('on');
  }
}
function requestMotionPermission() {
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
      DeviceMotionEvent.requestPermission().catch(() => {});
    }
  } catch (e) {}
}

async function openCamera() {
  enterCameraFullscreen();
  const p = await dbGetProject(state.projectId);
  if (!p) return;
  $('camProjName').textContent = p.name;
  state.overlayMode = ['photo', 'edges', 'diff'].indexOf(p.camMode) >= 0 ? p.camMode : 'photo';
  camPrefs.op = typeof p.camOp === 'number' ? p.camOp : 50;
  cancelCountdown();
  syncTimerBtn();
  const photos = await photosOf(p);
  const last = photos.length ? photos[photos.length - 1] : null;
  syncModeSeg();
  if (last) setOverlay(urlFor(last, 'full')); else hideOverlay();
  zoom.last = last && typeof last.zoom === 'number' ? last.zoom : null;
  zoom.lens = 'main';
  show('camera');
  layoutCamera();
  await startCamera();
  if (zoom.last) {
    await setZoom(zoom.last, true);
    if (zoom.last !== 1) camBadge('Zoom set to ' + zoomLabel(zoom.cur) + ', like your last photo');
  }
  // One message at a time: the zoom note wins over the mode explanation.
  if (last && !(zoom.last && zoom.last !== 1)) showModeHint(false);
}

function setGrid() {
  const g = $('gridlines'), btn = $('gridBtn');
  const names = ['off', 'thirds', 'fine'];
  btn.setAttribute('aria-label', 'Grid and level: ' + names[gridMode]);
  g.innerHTML = '';
  if (gridMode === 0) { g.classList.remove('on'); btn.classList.remove('act'); return; }
  g.classList.add('on'); btn.classList.add('act');
  const fracs = gridMode === 1 ? [33.333, 66.667] : [25, 50, 75];
  fracs.forEach(p => {
    const v = document.createElement('div'); v.className = 'gline v'; v.style.left = p + '%'; g.appendChild(v);
    const h = document.createElement('div'); h.className = 'gline h'; h.style.top = p + '%'; g.appendChild(h);
  });
  g.appendChild(Object.assign(document.createElement('div'), { className: 'gcross' }));
}
function syncGridLevel() { setLevel(gridMode !== 0 && state.screen === 'camera'); }

/* Zoom: fixed steps (1×, 2×, 3×, ...) instead of a slider, so the same zoom
   is one tap away months later. Pinching the viewfinder still allows any
   value in between; every photo stores its zoom, the camera opens at the zoom
   of the last photo, and a "match" button appears whenever you drift from it.
   Phones that don't expose optical zoom to the browser get the same steps as
   a digital crop, applied to the preview and the saved photo alike. */
const zoom = { hw: false, track: null, min: 1, max: 1, cur: 1, last: null, lens: 'main', ultraId: null, ultraChecked: false, switching: false };
const ZOOM_STEPS = [0.5, 1, 2, 3, 5, 10];
function zoomLabel(v) { const r = Math.round(v * 10) / 10; return (r % 1 ? r.toFixed(1) : String(r)) + '×'; }
function setupZoom() {
  if (zoom.lens === 'ultra') { zoom.cur = 0.5; renderZoomStops(); return; }
  zoom.track = null; zoom.hw = false; zoom.min = 1; zoom.max = 3; zoom.cur = 1;
  const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
  let caps = null;
  try { caps = track && track.getCapabilities ? track.getCapabilities() : null; } catch (e) {}
  if (track && caps && caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > caps.zoom.min) {
    zoom.track = track; zoom.hw = true; zoom.min = caps.zoom.min; zoom.max = caps.zoom.max;
    try { const s = track.getSettings(); if (typeof s.zoom === 'number') zoom.cur = s.zoom; } catch (e) {}
  }
  renderZoomStops();
}
function zoomStops() {
  const s = ZOOM_STEPS.filter(v => v >= zoom.min - 0.01 && v <= zoom.max + 0.01);
  if (s[0] !== 0.5 && hasUltraLens()) s.unshift(0.5);
  return s.length ? s : [zoom.min];
}
function renderZoomStops() {
  const box = $('zoomStops');
  const stops = zoomStops();
  if (stops.length < 2) { box.hidden = true; return; }
  let near = stops[0];
  stops.forEach(s => { if (Math.abs(Math.log(zoom.cur / s)) < Math.abs(Math.log(zoom.cur / near))) near = s; });
  let html = stops.map(s => '<button data-z="' + s + '"' + (s === near ? ' class="on"' : '') + ' aria-label="Zoom ' + zoomLabel(s) + '">' +
    zoomLabel(s === near ? zoom.cur : s) + '</button>').join('');
  const reachable = zoom.last && (zoom.last >= zoom.min - 0.01 || (zoom.last < 0.75 && hasUltraLens())) && zoom.last <= zoom.max + 0.01;
  if (reachable && Math.abs(zoom.last - zoom.cur) > 0.04) {
    html += '<button class="match" data-z="' + zoom.last + '" aria-label="Match the zoom of your last photo">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>' + zoomLabel(zoom.last) + '</button>';
  }
  box.innerHTML = html;
  box.hidden = false;
}
function hasUltraLens() { return facing === 'environment' && !!zoom.ultraId && zoom.min > 0.5; }
/* Finds a separate ultra-wide back camera by its name (iPhones call it
   "Back Ultra Wide Camera"). Names are only readable once the camera is
   allowed, so this runs after the first stream started. */
async function detectUltraWide() {
  if (zoom.ultraChecked || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
  zoom.ultraChecked = true;
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const ultra = cams.find(d => /ultra ?wide|ultrawide|0[.,]5/i.test(d.label || '') && !/front|user/i.test(d.label));
    if (ultra) zoom.ultraId = ultra.deviceId;
  } catch (e) {}
}
function digitalZoom() { return zoom.lens === 'ultra' || zoom.hw ? 1 : zoom.cur; }
async function setZoom(v, quiet) {
  if (zoom.switching) return;
  v = Number(v) || 1;
  // The 0.5× ultra-wide is a separate lens on many phones: switch to it
  // below 0.75×, and back to the main lens above that.
  if (hasUltraLens() && (v < 0.75) !== (zoom.lens === 'ultra')) {
    zoom.switching = true;
    zoom.lens = v < 0.75 ? 'ultra' : 'main';
    await startCamera();
    zoom.switching = false;
    if (zoom.lens === 'ultra') { applyLiveTransform(); renderZoomStops(); return; }
  }
  if (zoom.lens === 'ultra') return;
  v = Math.max(zoom.min, Math.min(zoom.max, v));
  const near = zoomStops().find(s => Math.abs(s - v) / s < 0.04);
  if (near) v = near;
  zoom.cur = v;
  if (zoom.hw && zoom.track) { try { await zoom.track.applyConstraints({ advanced: [{ zoom: v }] }); } catch (e) {} }
  applyLiveTransform();
  renderZoomStops();
  if (!quiet && zoom.last && Math.abs(zoom.last - v) <= 0.04) camBadge('Same zoom as your last photo');
}
let vfPinch = null;
/* Tap to focus, where the browser lets a web app steer focus (Chrome on
   Android). The tap is mapped through the same crop and mirroring as the live
   view. No focus square is shown where focusing is not possible. */
function canTapFocus() {
  try {
    const t = stream && stream.getVideoTracks()[0];
    const caps = t && t.getCapabilities ? t.getCapabilities() : null;
    const sup = navigator.mediaDevices.getSupportedConstraints ? navigator.mediaDevices.getSupportedConstraints() : {};
    return !!(caps && sup.pointsOfInterest && caps.focusMode && caps.focusMode.indexOf('single-shot') >= 0);
  } catch (e) { return false; }
}
async function focusAt(clientX, clientY) {
  if (!canTapFocus()) return;
  const r = $('vf').getBoundingClientRect(), v = $('video');
  let nx = (clientX - r.left) / r.width, ny = (clientY - r.top) / r.height;
  if (facing === 'user') nx = 1 - nx;
  const k = viewCrop(v.videoWidth, v.videoHeight);
  const fx = (k.sx + nx * k.sw) / v.videoWidth, fy = (k.sy + ny * k.sh) / v.videoHeight;
  const ring = $('focusRing');
  ring.style.left = (clientX - r.left) + 'px'; ring.style.top = (clientY - r.top) + 'px';
  ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on');
  try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ pointsOfInterest: [{ x: fx, y: fy }], focusMode: 'single-shot' }] }); } catch (e) {}
}
function wireViewfinderPinch() {
  const vf = $('vf'), pts = new Map();
  vf.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    pts.set(e.pointerId, e);
    if (pts.size === 1) vf._tap = { x: e.clientX, y: e.clientY, t: Date.now() };
    else vf._tap = null;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; vfPinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z: zoom.cur }; }
  });
  vf.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, e);
    if (pts.size === 2 && vfPinch) { const [a, b] = [...pts.values()]; setZoom(vfPinch.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / vfPinch.d, true); }
  });
  const end = e => {
    const tap = vf._tap;
    if (e.type === 'pointerup' && tap && pts.size === 1 && Date.now() - tap.t < 350 && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) < 10) focusAt(e.clientX, e.clientY);
    vf._tap = null;
    pts.delete(e.pointerId); if (pts.size < 2) vfPinch = null;
  };
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => vf.addEventListener(t, end));
  $('zoomStops').addEventListener('click', e => { const b = e.target.closest('[data-z]'); if (b) setZoom(+b.getAttribute('data-z')); });
}

/* --- Live view. The camera is asked for 4:3, the same shape as the
   viewfinder (3:4 when held upright). When the stream has that shape, the
   <video> element is shown directly: full frame rate, and it fits exactly
   whatever fit mode the browser applies (iOS ignores object-fit on camera
   streams). Only when a camera delivers another shape does a canvas take
   over, drawing each frame with the exact photo crop (viewCrop), so nothing
   is ever stretched or letterboxed. The canvas also holds the last frame,
   blurred, while switching camera or lens. --- */
function viewCrop(vw, vh) {
  const ar = 3 / 4, dz = digitalZoom();
  let sw = vw, sh = vh;
  if (vw / vh > ar) sw = vh * ar; else sh = vw / ar;
  sw /= dz; sh /= dz;
  return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
}
const live = { mode: 'native', raf: 0, vfc: 0, frames: 0 };
function streamFitsViewfinder() {
  const v = $('video');
  return v.videoWidth > 0 && Math.abs(v.videoWidth / v.videoHeight - 3 / 4) < 0.02;
}
function paintCanvasFrame() {
  const v = $('video'), c = $('vfCanvas');
  const vw = v.videoWidth, vh = v.videoHeight;
  if (!vw || !vh || v.readyState < 2) return false;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = Math.round(c.clientWidth * dpr), H = Math.round(c.clientHeight * dpr);
  if (!W || !H) return false;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  const ctx = c.getContext('2d');
  const k = viewCrop(vw, vh);
  ctx.save();
  if (facing === 'user') { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(v, k.sx, k.sy, k.sw, k.sh, 0, 0, W, H);
  ctx.restore();
  return true;
}
// Canvas mode only: draw each new camera frame (requestVideoFrameCallback
// where available, so nothing is drawn twice).
function canvasLoop() {
  const v = $('video');
  if (live.mode !== 'canvas') return;
  if (paintCanvasFrame()) live.frames++;
  if (v.requestVideoFrameCallback) live.vfc = v.requestVideoFrameCallback(canvasLoop);
  else live.raf = requestAnimationFrame(canvasLoop);
}
function stopCanvasLoop() {
  const v = $('video');
  if (live.vfc && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(live.vfc);
  cancelAnimationFrame(live.raf);
  live.vfc = 0; live.raf = 0;
}
// Native mode: mirroring and digital zoom are a GPU transform on the video.
function applyLiveTransform() {
  const z = digitalZoom(), m = facing === 'user' ? -1 : 1;
  $('video').style.transform = (z !== 1 || m !== 1) ? 'scale(' + (z * m) + ',' + z + ')' : '';
}
function chooseLiveMode() {
  const vf = $('vf');
  const mode = streamFitsViewfinder() ? 'native' : 'canvas';
  if (mode === live.mode && (mode === 'native' || live.vfc || live.raf)) return;
  stopCanvasLoop();
  live.mode = mode;
  vf.classList.toggle('canvas-mode', mode === 'canvas');
  if (mode === 'canvas') canvasLoop();
  applyLiveTransform();
}
function videoReady(v) {
  return new Promise(resolve => {
    const t = setTimeout(resolve, 2500);
    const done = () => { clearTimeout(t); resolve(); };
    if (v.readyState >= 2 && v.videoWidth) { setTimeout(done, 60); return; }
    v.addEventListener('loadeddata', () => setTimeout(done, 60), { once: true });
  });
}
// 4:3 at a size phones stream smoothly (about 1920×1440); much larger
// formats drop to a low frame rate on some phones.
function videoConstraints() {
  const base = { width: { ideal: 2560 }, height: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 }, frameRate: { ideal: 30 }, resizeMode: { ideal: 'none' } };
  return zoom.lens === 'ultra' && zoom.ultraId
    ? Object.assign({ deviceId: { exact: zoom.ultraId } }, base)
    : Object.assign({ facingMode: { ideal: facing } }, base);
}

async function startCamera() {
  const err = $('camerr');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('camerrMsg').textContent = 'The camera only works over a secure https link. Open the app via the shared link.';
    err.classList.add('on'); return;
  }
  // Like a native camera: a fresh start stays black until the image is
  // ready; a switch freezes the last frame, blurred, until the new one is.
  const vf = $('vf');
  const switching = !!stream && $('video').videoWidth > 0;
  stopCanvasLoop();
  if (switching) { paintCanvasFrame(); vf.classList.add('switching'); } else vf.classList.remove('live');
  try {
    let newStream;
    try { newStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false }); }
    catch (e) {
      if (e && (e.name === 'OverconstrainedError' || e.name === 'NotReadableError')) {
        newStream = await navigator.mediaDevices.getUserMedia({ video: zoom.lens === 'ultra' && zoom.ultraId ? { deviceId: { exact: zoom.ultraId } } : { facingMode: facing }, audio: false });
      } else throw e;
    }
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = newStream;
    const v = $('video');
    v.srcObject = stream;
    $('screen-camera').classList.toggle('mirror', facing === 'user');
    await v.play();
    if (zoom.lens === 'main') await detectUltraWide();
    setupZoom();
    await videoReady(v);
    live.mode = '';
    chooseLiveMode();
    // Final layout first, then a redraw at that size, then show the picture.
    layoutCamera();
    sizeLiveVideo($('screen-camera')._vfW || vf.offsetWidth);
    vf.classList.remove('switching');
    vf.classList.add('live');
    keepAwake(true);
    syncGridLevel();
    err.classList.remove('on');
  } catch (e) {
    const n = e && e.name;
    $('camerrMsg').textContent = (n === 'NotAllowedError' || n === 'SecurityError')
      ? 'Allow camera access in your browser and try again.'
      : (n === 'NotFoundError') ? 'No usable camera found, or it is in use by another app.'
      : (e && e.message) || 'Unknown error.';
    vf.classList.remove('switching');
    err.classList.add('on');
  }
}
function stopCamera() {
  exitCameraFullscreen();
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  stopCanvasLoop();
  const c = $('vfCanvas'); c.getContext('2d').clearRect(0, 0, c.width, c.height);
  $('vf').classList.remove('live', 'switching', 'canvas-mode');
  keepAwake(false);
  zoom.track = null;
  cancelCountdown();
  setLevel(false);
}

/* Layout (DESIGN.md §14), the standard of every camera app: tools bar at the
   top, the 3:4 picture right below it, modes and the shutter row on black at
   the bottom. The picture is full width whenever the screen is tall enough;
   if not (a browser with toolbars), it gets narrower so that the shutter row
   never covers it. Only the zoom steps and the overlay slider lie on it. */
function layoutCamera() {
  const cam = $('screen-camera');
  if (!cam.classList.contains('active')) return;
  const H = cam.clientHeight, Wd = cam.clientWidth;
  const full = Math.min(Wd, 600);
  const fit = () => {
    const T = cam.querySelector('.cam-top').offsetHeight, B = cam.querySelector('.cam-bottom').offsetHeight;
    return Math.max(160, Math.floor(Math.min(full, (H - T - B) * 3 / 4)));
  };
  cam.classList.remove('vf-narrow');
  let w = fit();
  if (w < full - 1) { cam.classList.add('vf-narrow'); w = fit(); }
  if (w === cam._vfW) return;
  cam._vfW = w;
  cam.style.setProperty('--vf-w', w + 'px');
  sizeLiveVideo(w);
}
/* iOS bug: a live camera <video> does not always follow a size change of its
   frame and keeps showing the picture at its first, smaller size. So the
   video gets explicit pixels and is made to redraw whenever the size changes. */
function sizeLiveVideo(w) {
  const v = $('video'), h = Math.round(w * 4 / 3);
  v.style.width = w + 'px'; v.style.height = h + 'px';
  if (!v.srcObject) return;
  v.style.display = 'none'; void v.offsetWidth; v.style.display = '';
  v.play().catch(() => {});
}
/* In a browser on Android the camera goes full screen, so the toolbars
   don't take the picture's room. (iPhone browsers don't allow this; there,
   adding Aligno to the Home Screen gives the full-screen camera.) */
function enterCameraFullscreen() {
  try {
    const el = document.documentElement;
    if (isStandalone() || IS_IOS || !el.requestFullscreen || document.fullscreenElement) return;
    if (!matchMedia('(pointer: coarse)').matches) return;
    el.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
  } catch (e) {}
}
function exitCameraFullscreen() {
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) {}
}

function toBlobP(canvas, type, q) { return new Promise(r => canvas.toBlob(r, type, q)); }

async function capturePhoto() {
  const v = $('video');
  if (!v.videoWidth || !state.projectId) return;
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }

  // Save exactly what the viewfinder shows: the same crop the live view draws.
  const k = viewCrop(v.videoWidth, v.videoHeight);
  const c = document.createElement('canvas');
  c.width = Math.round(k.sw); c.height = Math.round(k.sh);
  c.getContext('2d').drawImage(v, k.sx, k.sy, k.sw, k.sh, 0, 0, c.width, c.height);

  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.9';
  requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = '0'; });

  const blob = await toBlobP(c, 'image/jpeg', 0.92);
  if (!blob) return;
  const tw = 320, th = Math.max(1, Math.round(tw * c.height / c.width));
  const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(c, 0, 0, tw, th);
  const thumb = await toBlobP(tc, 'image/jpeg', 0.7);

  const p = await dbGetProject(state.projectId);
  if (!p) return;
  const ph = { id: uid(), projectId: p.id, ts: Date.now(), blob, src: 'camera' };
  if (thumb) ph.thumb = thumb;
  if (zoom.cur) ph.zoom = Math.round(zoom.cur * 100) / 100;
  await dbAddPhoto(ph);
  p.updatedAt = Date.now();
  await dbPutProject(p);
  askPersistentStorage();

  const count = (await dbPhotoCount(p.id)) + ((p.photos && p.photos.length) || 0);
  zoom.last = ph.zoom || null;
  renderZoomStops();
  setOverlay(urlFor(ph, 'full'));
  camBadge('Photo ' + count + ' saved');
}

function camBadge(text, ms) {
  const b = $('cbadge');
  b.textContent = text;
  b.hidden = false;
  b.style.animation = 'none';
  requestAnimationFrame(() => { b.style.animation = 'badgePop .3s ease'; });
  clearTimeout(window._bt); window._bt = setTimeout(() => { b.hidden = true; }, ms || 2400);
}
function alBadge(text) {
  const b = $('alBadge');
  b.textContent = text;
  b.hidden = false;
  b.style.animation = 'none';
  requestAnimationFrame(() => { b.style.animation = 'badgePop .3s ease'; });
  clearTimeout(window._abt); window._abt = setTimeout(() => { b.hidden = true; }, 2400);
}

/* --- Align from library: import several existing photos and manually
   center the same subject in each one, so the set plays back stabilized. --- */
const AL_OUT = 1080;
const AL_SHAPES = [
  { id: '1:1', ar: 1 },
  { id: '4:5', ar: 4 / 5 },
  { id: '9:16', ar: 9 / 16 }
];
const alState = {
  projectId: null, files: [], index: 0, added: 0,
  scale: 1, rot: 0, tx: 0, ty: 0, base: { w: 1, h: 1 }, nat: { w: 1, h: 1 }, frame: { w: 100, h: 100 },
  shape: '1:1', subjectFrac: 0,
  ghostOn: true, ghostUrl: null, objUrl: null, pointers: new Map(), pinchStart: null
};
try { const s = localStorage.getItem('aligno_al_shape'); if (AL_SHAPES.some(x => x.id === s)) alState.shape = s; } catch (e) {}
function alShape() { return AL_SHAPES.find(x => x.id === alState.shape) || AL_SHAPES[0]; }

/* Sizes the crop frame (and the ghost guide on top of it) for the chosen
   output shape, as large as fits between the top bar and the controls. */
function alLayoutFrame() {
  const ar = alShape().ar;
  const maxW = Math.min(window.innerWidth * 0.84, 520), maxH = window.innerHeight * 0.5;
  let w = maxW, h = w / ar;
  if (h > maxH) { h = maxH; w = h * ar; }
  w = Math.round(w); h = Math.round(h);
  ['alFrame', 'alGhost'].forEach(id => { $(id).style.width = w + 'px'; $(id).style.height = h + 'px'; });
  alState.frame = { w, h };
  $('alShapeLbl').textContent = alState.shape;
}

/* The photo may be dragged until its edge reaches the crosshair, so even a
   subject near the border can be centered (uncovered area turns black). */
function alClampPan() {
  const rw = alState.base.w * alState.scale, rh = alState.base.h * alState.scale;
  const maxX = rw / 2, maxY = rh / 2;
  alState.tx = Math.max(-maxX, Math.min(maxX, alState.tx));
  alState.ty = Math.max(-maxY, Math.min(maxY, alState.ty));
}
function alRender() {
  alClampPan();
  $('alImg').style.transform = 'translate(calc(-50% + ' + alState.tx + 'px), calc(-50% + ' + alState.ty + 'px)) rotate(' + alState.rot + 'rad) scale(' + alState.scale + ')';
  const deg = Math.round(alState.rot * 180 / Math.PI);
  $('alRotLbl').textContent = deg ? (deg > 0 ? '+' : '') + deg + '°' : '';
  $('alRotLbl').hidden = !deg;
}
/* Zoom goes up to 24× (a small moon in a wide shot); the slider is
   logarithmic so the useful 1–3× range keeps fine control. */
const AL_MAXZ = 24;
function alSetZoom(v) {
  alState.scale = Math.max(1, Math.min(AL_MAXZ, Number(v)));
  alRender();
  $('alZoom').value = Math.log(alState.scale) / Math.log(AL_MAXZ) * 100;
  $('alZoomv').textContent = alState.scale.toFixed(alState.scale < 10 ? 1 : 0) + '×';
}
function alFit() {
  const r = Math.max(alState.frame.w / alState.nat.w, alState.frame.h / alState.nat.h);
  alState.base = { w: alState.nat.w * r, h: alState.nat.h * r };
  const el = $('alImg');
  el.style.width = alState.base.w + 'px';
  el.style.height = alState.base.h + 'px';
}
function alReset() {
  alState.scale = 1; alState.rot = 0; alState.tx = 0; alState.ty = 0;
  alSetZoom(1);
}
function alCycleShape() {
  const i = AL_SHAPES.findIndex(x => x.id === alState.shape);
  alState.shape = AL_SHAPES[(i + 1) % AL_SHAPES.length].id;
  try { localStorage.setItem('aligno_al_shape', alState.shape); } catch (e) {}
  alLayoutFrame();
  alFit();
  alRender();
  alBadge('Shape ' + alState.shape);
}

/* Auto-center: finds the largest bright region (the moon, a lamp, the sun…)
   and moves it under the crosshair, sized like the subject in the previous
   aligned photo. Plain thresholding (no AI), works best on dark backgrounds. */
function alFindBrightSubject(img) {
  const coarse = brightBlob(img, 0, 0, img.naturalWidth, img.naturalHeight, true);
  if (!coarse) return null;
  const half = coarse.r * 2.5;
  const sx = Math.max(0, coarse.cx - half), sy = Math.max(0, coarse.cy - half);
  const sw = Math.min(img.naturalWidth - sx, half * 2), sh = Math.min(img.naturalHeight - sy, half * 2);
  if (sw * sh > img.naturalWidth * img.naturalHeight * 0.5) return coarse;
  return brightBlob(img, sx, sy, sw, sh, false) || coarse;
}
/* Largest connected bright region inside a source rectangle, in image px. */
function brightBlob(img, sx, sy, sw, sh, strict) {
  const M = 256, k = Math.min(4, M / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  let max = 0, sum = 0;
  for (let i = 0, p = 0; p < L.length; i += 4, p++) { const v = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; L[p] = v; sum += v; if (v > max) max = v; }
  const mean = sum / L.length;
  if (max - mean < 40) return null;
  // Coarse pass: only the brightest quarter of the range, and regions are
  // scored so a bright, compact, round blob beats a long lit horizon or a
  // big region running off the edge of the photo.
  const T = strict ? max - (max - mean) * 0.25 : mean + (max - mean) * 0.5;
  const label = new Int32Array(w * h);
  let best = null, cur = 0;
  const stack = [];
  for (let s = 0; s < L.length; s++) {
    if (L[s] < T || label[s]) continue;
    cur++;
    let area = 0, ax = 0, ay = 0, lum = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    stack.push(s); label[s] = cur;
    while (stack.length) {
      const q = stack.pop(), x = q % w, y = (q - x) / w;
      area++; ax += x; ay += y; lum += L[q];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !label[q - 1] && L[q - 1] >= T) { label[q - 1] = cur; stack.push(q - 1); }
      if (x < w - 1 && !label[q + 1] && L[q + 1] >= T) { label[q + 1] = cur; stack.push(q + 1); }
      if (y > 0 && !label[q - w] && L[q - w] >= T) { label[q - w] = cur; stack.push(q - w); }
      if (y < h - 1 && !label[q + w] && L[q + w] >= T) { label[q + w] = cur; stack.push(q + w); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const elong = Math.max(bw, bh) / Math.min(bw, bh);
    const edge = strict && (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) ? 0.15 : 1;
    const score = area * Math.pow(lum / area / max, 6) * edge / (elong * elong);
    if (!best || score > best.score) best = { score, area, cx: ax / area, cy: ay / area };
  }
  if (!best || best.area < 4 || (strict && best.area > L.length * 0.45)) return null;
  return { cx: sx + (best.cx + 0.5) / k, cy: sy + (best.cy + 0.5) / k, r: Math.sqrt(best.area / Math.PI) / k };
}
function alAutoCenter() {
  const img = $('alImg');
  if (!img.naturalWidth) return;
  const s = alFindBrightSubject(img);
  if (!s) { alBadge('No clear bright subject found'); return; }
  alState.autoSubject = s;
  const fw = alState.frame.w;
  const target = alState.subjectFrac || 0.4;
  const perNat = alState.base.w / alState.nat.w;
  alState.scale = Math.max(1, Math.min(AL_MAXZ, (target * fw) / (2 * s.r * perNat)));
  const k = perNat * alState.scale;
  const dx = (s.cx - alState.nat.w / 2) * k, dy = (s.cy - alState.nat.h / 2) * k;
  const cos = Math.cos(alState.rot), sin = Math.sin(alState.rot);
  alState.tx = -(dx * cos - dy * sin);
  alState.ty = -(dx * sin + dy * cos);
  alSetZoom(alState.scale);
  alBadge('Centered the brightest subject');
}

/* Reads when a JPEG was actually taken (EXIF DateTimeOriginal), so imported
   and shared photos land at the right spot in the timeline even when the
   file's own date is the day it was copied or shared. */
async function exifTime(file) {
  try {
    const buf = new DataView(await file.slice(0, 196608).arrayBuffer());
    if (buf.getUint16(0) !== 0xFFD8) return 0;
    let p = 2;
    while (p + 4 < buf.byteLength) {
      const marker = buf.getUint16(p), len = buf.getUint16(p + 2);
      if (marker === 0xFFE1 && buf.getUint32(p + 4) === 0x45786966) {
        const t = p + 10, le = buf.getUint16(t) === 0x4949;
        const u16 = (o) => buf.getUint16(t + o, le), u32 = (o) => buf.getUint32(t + o, le);
        const readIfd = (off) => {
          const out = {}, n = u16(off);
          for (let i = 0; i < n; i++) {
            const e = off + 2 + i * 12, tag = u16(e), cnt = u32(e + 4);
            if (tag === 0x8769) out.exif = u32(e + 8);
            else if ((tag === 0x9003 || tag === 0x0132) && cnt >= 19) {
              let s = ''; const vo = u32(e + 8);
              for (let k = 0; k < 19; k++) s += String.fromCharCode(buf.getUint8(t + vo + k));
              out[tag] = s;
            }
          }
          return out;
        };
        const ifd0 = readIfd(u32(4));
        const sub = ifd0.exif ? readIfd(ifd0.exif) : {};
        const s = sub[0x9003] || ifd0[0x0132];
        const m = s && s.match(/^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/);
        if (!m || m[1] === '0000') return 0;
        return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() || 0;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
      p += 2 + len;
    }
  } catch (e) {}
  return 0;
}

async function startAligner(projectId, fileList) {
  const files = Array.from(fileList || []).filter(f => f && f.type && f.type.indexOf('image/') === 0);
  if (!files.length || !projectId) return;
  await Promise.all(files.map(async f => { f._ts = (await exifTime(f)) || f.lastModified || Date.now(); }));
  files.sort((a, b) => a._ts - b._ts);
  alState.projectId = projectId;
  alState.files = files;
  alState.index = 0;
  alState.added = 0;
  alState.ghostUrl = null;
  alState.ghostOn = true;
  alState.subjectFrac = 0;
  $('alGhostToggle').classList.add('act');
  show('aligner');
  alLayoutFrame();
  alLoadCurrent();
}

async function alLoadCurrent() {
  const f = alState.files[alState.index];
  if (!f) { alFinish(); return; }
  $('alCount').textContent = (alState.index + 1) + ' of ' + alState.files.length;
  $('alHint').hidden = alState.index !== 0 || hintDismissed('aligno_hint_align');

  if (alState.objUrl) { try { URL.revokeObjectURL(alState.objUrl); } catch (e) {} }
  const url = URL.createObjectURL(f);
  alState.objUrl = url;

  const el = $('alImg');
  const img = await new Promise((res, rej) => {
    el.onload = () => res(el);
    el.onerror = rej;
    el.src = url;
  }).catch(() => null);

  if (!img) { alSkipPhoto(); return; }

  alState.nat = { w: el.naturalWidth, h: el.naturalHeight };
  alState.autoSubject = null;
  alFit();
  alReset();

  const ghost = $('alGhost');
  if (alState.ghostUrl && alState.ghostOn) { ghost.src = alState.ghostUrl; ghost.classList.add('on'); }
  else { ghost.classList.remove('on'); }

  $('alPrevThumb').hidden = !alState.ghostUrl;
  if (alState.ghostUrl) $('alPrevThumb').src = alState.ghostUrl;
}

function alPointerPos(e) { return { x: e.clientX, y: e.clientY }; }
function alPinchInfo() {
  const pts = Array.from(alState.pointers.values());
  return { dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), ang: Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x) };
}
function alOnPointerDown(e) {
  $('alViewport').setPointerCapture && $('alViewport').setPointerCapture(e.pointerId);
  alState.pointers.set(e.pointerId, alPointerPos(e));
  if (alState.pointers.size === 2) {
    const pi = alPinchInfo();
    alState.pinchStart = { dist: pi.dist, ang: pi.ang, scale: alState.scale, rot: alState.rot };
  }
}
function alOnPointerMove(e) {
  if (!alState.pointers.has(e.pointerId)) return;
  const prev = alState.pointers.get(e.pointerId);
  const cur = alPointerPos(e);
  alState.pointers.set(e.pointerId, cur);
  if (alState.pointers.size >= 2 && alState.pinchStart) {
    const pi = alPinchInfo();
    let rot = alState.pinchStart.rot + (pi.ang - alState.pinchStart.ang);
    const deg = rot * 180 / Math.PI;
    if (Math.abs(deg - Math.round(deg / 90) * 90) < 2) rot = Math.round(deg / 90) * 90 * Math.PI / 180;
    alState.rot = rot;
    alSetZoom(alState.pinchStart.scale * (pi.dist / alState.pinchStart.dist));
  } else if (alState.pointers.size === 1) {
    alState.tx += cur.x - prev.x;
    alState.ty += cur.y - prev.y;
    alRender();
  }
}
function alOnPointerUp(e) {
  alState.pointers.delete(e.pointerId);
  if (alState.pointers.size < 2) alState.pinchStart = null;
}
function alOnWheel(e) {
  e.preventDefault();
  if (e.shiftKey) { alState.rot += (e.deltaY < 0 ? 1 : -1) * Math.PI / 180; alRender(); return; }
  alSetZoom(alState.scale + (e.deltaY < 0 ? 0.08 : -0.08) * alState.scale);
}

/* Bakes the current pan/zoom/rotation into a fixed-size image: the frame
   maps to the output canvas, and the photo is drawn with the same transform
   it has on screen. */
async function alBakeCurrent() {
  const img = $('alImg');
  const ar = alShape().ar;
  const OW = ar >= 1 ? AL_OUT : Math.round(AL_OUT * ar), OH = ar >= 1 ? Math.round(AL_OUT / ar) : AL_OUT;
  const k = OW / alState.frame.w;
  const c = document.createElement('canvas'); c.width = OW; c.height = OH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, OW, OH);
  ctx.translate(OW / 2 + alState.tx * k, OH / 2 + alState.ty * k);
  ctx.rotate(alState.rot);
  const dw = alState.base.w * alState.scale * k, dh = alState.base.h * alState.scale * k;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  const blob = await toBlobP(c, 'image/jpeg', 0.92);
  const tw = 320, th = Math.round(tw * OH / OW);
  const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
  tc.getContext('2d').drawImage(c, 0, 0, tw, th);
  const thumb = await toBlobP(tc, 'image/jpeg', 0.7);
  const s = alState.autoSubject;
  if (s) alState.subjectFrac = (2 * s.r * (alState.base.w / alState.nat.w) * alState.scale) / alState.frame.w;
  return { blob, thumb, dataUrl: c.toDataURL('image/jpeg', 0.8) };
}

async function alUsePhoto() {
  const f = alState.files[alState.index];
  if (!f) return;
  $('alUse').disabled = true;
  try {
    const baked = await alBakeCurrent();
    const ts = f._ts || f.lastModified || Date.now();
    const ph = { id: uid(), projectId: alState.projectId, ts, blob: baked.blob, thumb: baked.thumb, src: 'import' };
    await dbAddPhoto(ph);
    const p = await dbGetProject(alState.projectId);
    if (p) { p.updatedAt = Date.now(); await dbPutProject(p); }
    alState.added++;
    alState.ghostUrl = baked.dataUrl;
    if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }
    alBadge('Aligned ' + alState.added + (alState.added === 1 ? ' photo' : ' photos'));
  } catch (e) {}
  $('alUse').disabled = false;
  alState.index++;
  alLoadCurrent();
}
function alSkipPhoto() {
  alState.index++;
  alLoadCurrent();
}
async function alCloseAligner() {
  if (alState.added > 0) {
    const ok = await confirmSheet('Stop importing?', alState.added + (alState.added === 1 ? ' photo has' : ' photos have') + ' already been added and will be kept.', 'Stop');
    if (!ok) return;
  }
  alFinish();
}
async function alFinish() {
  if (alState.objUrl) { try { URL.revokeObjectURL(alState.objUrl); } catch (e) {} alState.objUrl = null; }
  const pid = alState.projectId;
  alState.projectId = null; alState.files = []; alState.pointers.clear(); alState.pinchStart = null;
  if (pid) await openProject(pid);
  renderHome();
}

let alPendingProjectId = null;
let alPendingCreateName = null;
function beginImportForProject(projectId) {
  alPendingProjectId = projectId;
  alPendingCreateName = null;
  $('alignFilesInput').click();
}
function createProjectAndImport() {
  const name = $('projName').value.trim() || 'Untitled project';
  closeNewProjectModal();
  alPendingProjectId = null;
  alPendingCreateName = name;
  $('alignFilesInput').click();
}

/* --- Photo viewer: swipe through the series, fix dates, share, delete. --- */
let viewList = [], viewIndex = 0;
function openPhotoViewAt(i) {
  if (!viewList.length) return;
  const wasOpen = $('photoView').classList.contains('on'), prev = viewIndex;
  viewIndex = Math.max(0, Math.min(i, viewList.length - 1));
  // Moving to the next or previous photo slides it in from that side.
  if (wasOpen && viewIndex !== prev && $('photoViewImg').animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const d = viewIndex > prev ? 1 : -1;
    $('photoViewImg').animate([{ opacity: 0, transform: 'translateX(' + (d * 48) + 'px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.2,.9,.25,1)' });
  }
  const ph = viewList[viewIndex];
  $('photoViewImg').src = urlFor(ph, 'full');
  $('photoViewCap').innerHTML = (viewIndex + 1) + ' of ' + viewList.length + ' · ' + fmtFullDate(ph.ts) +
    ' <span class="pv-src">' + srcIcon(ph) + srcLabel(ph) + '</span>';
  $('pvPrev').hidden = viewIndex === 0;
  $('pvNext').hidden = viewIndex >= viewList.length - 1;
  $('photoView').classList.add('on');
  setTheme(true);
}
function closePhotoView() {
  $('photoView').classList.remove('on');
  setTheme(state.screen === 'camera');
}
function localInputValue(ts) {
  const d = new Date(ts), z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
}
function openDateEdit() {
  const ph = viewList[viewIndex];
  if (!ph) return;
  $('dateInput').value = localInputValue(ph.ts);
  $('dateInput').max = localInputValue(Date.now());
  $('dateModal').classList.add('on');
}
async function saveDateEdit() {
  const ph = viewList[viewIndex];
  const v = $('dateInput').value;
  $('dateModal').classList.remove('on');
  if (!ph || !v) return;
  const ts = new Date(v).getTime();
  if (!ts) return;
  if (ph.dataUrl) {
    const p = await dbGetProject(state.projectId);
    const rec = p && p.photos && p.photos.find(x => x.id === ph.id);
    if (rec) { rec.ts = ts; await dbPutProject(p); }
  } else {
    const rec = await reqP(store('photos', 'readonly').get(ph.id));
    if (rec) { rec.ts = ts; await dbAddPhoto(rec); }
  }
  await openProject(state.projectId);
  renderHome();
  viewList = projPhotos;
  const i = viewList.findIndex(x => x.id === ph.id);
  openPhotoViewAt(i < 0 ? 0 : i);
  toast('Date updated');
}
async function shareViewedPhoto() {
  const ph = viewList[viewIndex];
  if (!ph) return;
  const blob = ph.blob || (ph.dataUrl ? dataUrlToBlob(ph.dataUrl) : null);
  if (!blob) return;
  const name = fileSafe($('projTitle').textContent) + '-' + isoDay(ph.ts) + '.jpg';
  const file = new File([blob], name, { type: blob.type || 'image/jpeg' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
  } catch (e) { return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function compareFromViewer() {
  if (viewList.length < 2) { toast('Add another photo to compare'); return; }
  const i = viewIndex;
  closePhotoView();
  openCompare(0, i === 0 ? viewList.length - 1 : i);
}

async function deleteViewedPhoto() {
  const ph = viewList[viewIndex];
  if (!ph || !state.projectId) return;
  const ok = await confirmSheet('Delete this photo?', 'It will be permanently removed from the series.', 'Delete photo');
  if (!ok) return;
  if (ph.dataUrl) {
    const p = await dbGetProject(state.projectId);
    if (p && p.photos) { p.photos = p.photos.filter(x => x.id !== ph.id); await dbPutProject(p); }
  } else {
    try { await dbDelPhoto(ph.id); } catch (e) {}
  }
  dropUrls(ph.id);
  const oldIndex = viewIndex;
  await openProject(state.projectId);
  renderHome();
  viewList = projPhotos;
  if (!viewList.length) { closePhotoView(); return; }
  openPhotoViewAt(Math.min(oldIndex, viewList.length - 1));
}

/* --- Export: GIF or video, with shape, date stamp, crossfade and a hold on
   the last photo. The preview runs the exact same timeline and drawing code
   as the export, just on thumbnails. --- */
const exp = { photos: [], thumbs: [], name: 'aligno', fps: 3, format: 'gif', shape: 'original', dates: false, fade: false, hold: true, raf: 0, t0: 0, busy: false };
try { Object.assign(exp, JSON.parse(localStorage.getItem('aligno_export') || '{}')); } catch (e) {}
exp.busy = false;
function saveExportPrefs() {
  try { localStorage.setItem('aligno_export', JSON.stringify({ fps: exp.fps, format: exp.format, shape: exp.shape, dates: exp.dates, fade: exp.fade, hold: exp.hold })); } catch (e) {}
}
const VIDEO_TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
function videoType() {
  try {
    if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
    return VIDEO_TYPES.find(t => MediaRecorder.isTypeSupported(t)) || null;
  } catch (e) { return null; }
}
function expSize(maxLong) {
  let ar = 3 / 4;
  if (exp.shape === 'square') ar = 1;
  else if (exp.shape === 'story') ar = 9 / 16;
  else { const t = exp.thumbs[0]; if (t && t.naturalWidth) ar = t.naturalWidth / t.naturalHeight; }
  let W, H;
  if (ar >= 1) { W = maxLong; H = maxLong / ar; } else { H = maxLong; W = maxLong * ar; }
  return { W: Math.round(W / 2) * 2, H: Math.round(H / 2) * 2 };
}
function expTimeline() {
  const n = exp.photos.length, slot = 1 / exp.fps;
  const hold = exp.hold ? Math.max(1.2, slot * 2) : 0;
  return { n, slot, hold, total: n * slot + hold };
}
function frameAt(sec) {
  const { n, slot } = expTimeline();
  const k = Math.floor(sec / slot);
  if (k >= n - 1) return { i: n - 1, t: 0 };
  const local = sec / slot - k;
  let t = exp.fade ? Math.max(0, (local - 0.5) / 0.5) : 0;
  t = t * t * (3 - 2 * t);
  return { i: k, t };
}
function stampText(ts) { const d = new Date(ts); return MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear(); }
function drawFrame(ctx, W, H, imA, imB, t, tsA, tsB) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  if (imA) drawCover(ctx, imA, W, H);
  if (imB && t > 0) { ctx.globalAlpha = t; drawCover(ctx, imB, W, H); ctx.globalAlpha = 1; }
  if (exp.dates) {
    const txt = stampText(t > 0.5 && tsB ? tsB : tsA);
    const s = Math.max(10, Math.round(Math.min(W, H) * 0.042));
    ctx.font = '600 ' + s + 'px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    const pad = s * 0.75, w = ctx.measureText(txt).width + pad * 2, h = s * 1.9;
    const x = s * 0.9, y = H - h - s * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(txt, x + pad, y + h / 2 + 1);
  }
}

async function openExport() {
  const p = await dbGetProject(state.projectId);
  if (!p) return;
  exp.photos = await photosOf(p);
  exp.name = p.name;
  const n = exp.photos.length;
  $('expCount').textContent = n === 0 ? 'No photos yet'
    : n === 1 ? '1 photo'
    : n + ' photos · live preview';
  $('gifResult').innerHTML = '';
  // Fewer than 2 photos: say so up front and gray out every setting.
  const few = n < 2;
  $('expNeed').hidden = !few;
  ['expFormat', 'expShape'].forEach(id => $(id).classList.toggle('is-disabled', few));
  document.querySelectorAll('#screen-export .optcard, #screen-export .content > .sectlbl').forEach(el => el.classList.toggle('is-disabled', few));
  if (!videoType()) {
    exp.format = 'gif';
    $('expFormat').querySelector('[data-v="video"]').disabled = true;
  }
  $('fps').value = exp.fps; $('fpsv').textContent = exp.fps + ' fps';
  $('expDates').checked = exp.dates; $('expFade').checked = exp.fade; $('expHold').checked = exp.hold;
  syncExportUi();
  show('export');
  exp.thumbs = await Promise.all(exp.photos.map(ph => loadImage(urlFor(ph, 'thumb')).catch(() => null)));
  startExportPreview();
}
function syncExportUi() {
  $('expFormat').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === exp.format));
  $('expShape').querySelectorAll('[data-v]').forEach(b => b.classList.toggle('on', b.getAttribute('data-v') === exp.shape));
  const btn = $('makeGifBtn');
  btn.disabled = exp.photos.length < 2 || exp.busy;
  if (!exp.busy) btn.textContent = exp.format === 'video' ? 'Make video' : 'Make GIF';
}
function stopExportPreview() { cancelAnimationFrame(exp.raf); exp.raf = 0; }
function startExportPreview() {
  stopExportPreview();
  const cv = $('expCanvas');
  if (!exp.photos.length || !exp.thumbs.length) { cv.width = 1; cv.height = 1; return; }
  const { W, H } = expSize(560);
  cv.width = W; cv.height = H;
  const ctx = smooth(cv.getContext('2d'));
  exp.t0 = performance.now();
  const step = () => {
    const { total } = expTimeline();
    const sec = ((performance.now() - exp.t0) / 1000) % total;
    const f = frameAt(sec);
    const A = exp.photos[f.i], B = exp.photos[f.i + 1];
    drawFrame(ctx, W, H, exp.thumbs[f.i], exp.thumbs[f.i + 1], f.t, A && A.ts, B && B.ts);
    exp.raf = requestAnimationFrame(step);
  };
  step();
}

/* Renders every photo once, cover-cropped to the export size, as a small JPEG
   so memory stays flat no matter how long the series is. */
function smooth(ctx) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; return ctx; }
/* Big photos are halved step by step before the final resize: one huge
   downscale in a single drawImage skips pixels and looks jagged. */
function downscaled(im, W, H) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const tw = iw * Math.max(W / iw, H / ih);
  let src = im, w = iw, h = ih;
  while (w / 2 >= tw) {
    w = Math.round(w / 2); h = Math.round(h / 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    smooth(c.getContext('2d')).drawImage(src, 0, 0, w, h);
    src = c;
  }
  return src;
}
async function prepFrames(W, H, onStep) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = smooth(c.getContext('2d'));
  const out = [];
  for (let i = 0; i < exp.photos.length; i++) {
    const im = await loadImage(urlFor(exp.photos[i], 'full'));
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    drawCover(ctx, downscaled(im, W, H), W, H);
    out.push(await toBlobP(c, 'image/jpeg', 0.95));
    if (onStep) onStep(i + 1, exp.photos.length);
  }
  return out;
}
function blobBitmap(b) {
  if (window.createImageBitmap) return createImageBitmap(b);
  return loadImage(URL.createObjectURL(b));
}

/* Videos play the series at least 4 times, and short series repeat until the
   video lasts about 8 seconds, so two photos don't make a blink-and-gone clip
   on players that don't loop. */
function videoLoops(once) { return Math.max(4, Math.ceil(8 / Math.max(0.1, once))); }

async function makeVideo(setStatus) {
  const type = videoType();
  if (!type) throw new Error('Video isn’t supported in this browser');
  const { W, H } = expSize(1080);
  const blobs = await prepFrames(W, H, (i, n) => setStatus('Preparing photos… ' + i + '/' + n));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = smooth(cv.getContext('2d'));
  const bmps = new Map();
  const getBmp = async (i) => {
    if (i < 0 || i >= blobs.length) return null;
    if (!bmps.has(i)) bmps.set(i, blobBitmap(blobs[i]));
    return bmps.get(i);
  };
  const first = await getBmp(0), second = await getBmp(1);
  drawFrame(ctx, W, H, first, second, 0, exp.photos[0].ts, exp.photos[1] && exp.photos[1].ts);
  const stream = cv.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8000000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  rec.start(500);
  const { n, total: once } = expTimeline();
  const total = once * videoLoops(once);
  let t0 = performance.now();
  await new Promise((resolve) => {
    const tick = async () => {
      const sec = (performance.now() - t0) / 1000;
      if (sec >= total) { resolve(); return; }
      const f = frameAt(sec % once);
      const wait0 = performance.now();
      const [a, b] = await Promise.all([getBmp(f.i), f.t > 0 ? getBmp(f.i + 1) : null]);
      t0 += performance.now() - wait0 > 40 ? performance.now() - wait0 : 0;
      drawFrame(ctx, W, H, a, b, f.t, exp.photos[f.i].ts, exp.photos[f.i + 1] && exp.photos[f.i + 1].ts);
      getBmp(f.i + 1); getBmp(f.i + 2);
      if (f.i >= n - 2) getBmp(0);
      // Photos 0 and 1 stay decoded: every repeat starts with them again.
      bmps.forEach((p, k) => { if (k > 1 && k < f.i - 1) { p.then(x => x && x.close && x.close()); bmps.delete(k); } });
      setStatus('Recording… ' + Math.min(99, Math.round(sec / total * 100)) + '%');
      setTimeout(tick, 1000 / 30);
    };
    tick();
  });
  rec.stop();
  await stopped;
  stream.getTracks().forEach(t => t.stop());
  bmps.forEach(p => p.then(x => x && x.close && x.close()));
  const base = type.split(';')[0];
  return { blob: new Blob(chunks, { type: base }), ext: base === 'video/mp4' ? 'mp4' : 'webm' };
}

/* GIFs allow only 256 colors. One palette for the whole GIF (sampled from
   every photo) keeps unchanged areas identical from frame to frame, and
   Floyd-Steinberg dithering hides the color steps that otherwise show up as
   bands and blocks in skies, walls and skin. */
function buildGlobalPalette(quantize, frames) {
  const per = Math.max(1, Math.floor(400000 / frames.length));
  const sample = new Uint8Array(per * frames.length * 4);
  let o = 0;
  for (const d of frames) {
    const px = d.length / 4, step = Math.max(1, Math.floor(px / per));
    for (let p = 0; p < px && o < sample.length; p += step) {
      const i = p * 4;
      sample[o++] = d[i]; sample[o++] = d[i + 1]; sample[o++] = d[i + 2]; sample[o++] = 255;
    }
  }
  return quantize(sample.subarray(0, o), 256);
}
function ditherToPalette(data, W, H, palette, cache) {
  const out = new Uint8Array(W * H);
  const err = new Float32Array((W + 2) * 2 * 3);
  const nearest = (r, g, b) => {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let idx = cache[key];
    if (idx < 0) {
      let best = 1e9;
      for (let k = 0; k < palette.length; k++) {
        const c = palette[k], dr = r - c[0], dg = g - c[1], db = b - c[2];
        const dist = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (dist < best) { best = dist; idx = k; }
      }
      cache[key] = idx;
    }
    return idx;
  };
  const S = 0.85; // a little less than full error spread: less visible grain
  for (let y = 0; y < H; y++) {
    const cur = (y & 1) * (W + 2) * 3, nxt = ((y + 1) & 1) * (W + 2) * 3;
    err.fill(0, nxt, nxt + (W + 2) * 3);
    const ltr = !(y & 1);
    for (let n = 0; n < W; n++) {
      const x = ltr ? n : W - 1 - n, dir = ltr ? 1 : -1;
      const i = (y * W + x) * 4, e = cur + (x + 1) * 3;
      const r = Math.max(0, Math.min(255, data[i] + err[e]));
      const g = Math.max(0, Math.min(255, data[i + 1] + err[e + 1]));
      const b = Math.max(0, Math.min(255, data[i + 2] + err[e + 2]));
      const k = nearest(r | 0, g | 0, b | 0), c = palette[k];
      out[y * W + x] = k;
      const er = (r - c[0]) * S, eg = (g - c[1]) * S, eb = (b - c[2]) * S;
      const a = e + dir * 3, bl = nxt + (x + 1 - dir) * 3, bm = nxt + (x + 1) * 3, br = nxt + (x + 1 + dir) * 3;
      err[a] += er * 7 / 16; err[a + 1] += eg * 7 / 16; err[a + 2] += eb * 7 / 16;
      err[bl] += er * 3 / 16; err[bl + 1] += eg * 3 / 16; err[bl + 2] += eb * 3 / 16;
      err[bm] += er * 5 / 16; err[bm + 1] += eg * 5 / 16; err[bm + 2] += eb * 5 / 16;
      err[br] += er / 16; err[br + 1] += eg / 16; err[br + 2] += eb / 16;
    }
  }
  return out;
}

async function makeGifBlob(setStatus) {
  const { GIFEncoder, quantize } = await loadGifenc();
  const { W, H } = expSize(720);
  const blobs = await prepFrames(W, H, (i, n) => setStatus('Preparing photos… ' + i + '/' + n));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  smooth(ctx);
  const { n, slot, hold } = expTimeline();

  // First pass: render every frame once to build the shared palette.
  setStatus('Picking colors…');
  const samples = [];
  for (let i = 0; i < n; i++) {
    const bm = await blobBitmap(blobs[i]);
    drawFrame(ctx, W, H, bm, null, 0, exp.photos[i].ts);
    samples.push(ctx.getImageData(0, 0, W, H).data);
    if (bm.close) bm.close();
  }
  const palette = buildGlobalPalette(quantize, samples);
  samples.length = 0;
  const cache = new Int16Array(32768).fill(-1);

  const enc = GIFEncoder();
  let first = true;
  const put = (delaySec) => {
    const data = ctx.getImageData(0, 0, W, H).data;
    const opts = { delay: Math.max(20, Math.round(delaySec * 1000)) };
    if (first) { opts.palette = palette; opts.repeat = 0; first = false; }
    enc.writeFrame(ditherToPalette(data, W, H, palette, cache), W, H, opts);
  };
  let prev = await blobBitmap(blobs[0]);
  for (let i = 0; i < n; i++) {
    const next = i + 1 < n ? await blobBitmap(blobs[i + 1]) : null;
    const last = i === n - 1;
    drawFrame(ctx, W, H, prev, null, 0, exp.photos[i].ts);
    put(last ? slot + hold : (exp.fade ? slot * 0.5 : slot));
    if (exp.fade && next) {
      for (const t of [0.2, 0.5, 0.8]) {
        drawFrame(ctx, W, H, prev, next, t * t * (3 - 2 * t), exp.photos[i].ts, exp.photos[i + 1].ts);
        put(slot * 0.5 / 3);
      }
    }
    if (prev && prev.close) prev.close();
    prev = next;
    setStatus('Encoding GIF… ' + Math.round((i + 1) / n * 100) + '%');
    await new Promise(r => setTimeout(r, 0));
  }
  enc.finish();
  return { blob: new Blob([enc.bytes()], { type: 'image/gif' }), ext: 'gif' };
}

async function makeExport() {
  if (exp.photos.length < 2 || exp.busy) return;
  exp.busy = true;
  const btn = $('makeGifBtn'), res = $('gifResult');
  btn.disabled = true;
  const setStatus = (s) => { btn.textContent = s; };
  setStatus('Working…');
  res.innerHTML = '';
  try {
    const out = exp.format === 'video' ? await makeVideo(setStatus) : await makeGifBlob(setStatus);
    const url = URL.createObjectURL(out.blob);
    const fname = fileSafe(exp.name) + '.' + out.ext;
    let media;
    if (out.ext === 'gif') { media = new Image(); media.src = url; media.alt = 'Your GIF'; }
    else { media = document.createElement('video'); media.src = url; media.controls = true; media.loop = true; media.muted = true; media.playsInline = true; media.autoplay = true; }
    media.className = 'exp-out';
    res.appendChild(media);
    const mb = out.blob.size / 1048576;
    const info = document.createElement('p'); info.className = 'exp-info';
    info.textContent = (out.ext === 'gif' ? 'GIF' : out.ext.toUpperCase() + ' video') + ' · ' + (mb >= 1 ? mb.toFixed(1) + ' MB' : Math.max(1, Math.round(out.blob.size / 1024)) + ' KB') +
      (out.ext === 'gif' ? ' · loops forever' : ' · series plays ' + videoLoops(expTimeline().total) + '×');
    res.appendChild(info);
    const row = document.createElement('div'); row.className = 'row';
    const a = document.createElement('a'); a.href = url; a.download = fname;
    a.className = 'btn ghost flex'; a.textContent = 'Save'; a.style.textDecoration = 'none';
    row.appendChild(a);
    try {
      const file = new File([out.blob], fname, { type: out.blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        const sh = document.createElement('button'); sh.className = 'btn primary flex'; sh.textContent = 'Share';
        sh.onclick = () => navigator.share({ files: [file], title: exp.name }).catch(() => {});
        row.appendChild(sh);
      }
    } catch (e) {}
    res.appendChild(row);
    setTimeout(() => res.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  } catch (e) {
    res.innerHTML = '<p class="note">Couldn’t create the ' + (exp.format === 'video' ? 'video' : 'GIF') + ' (' + escapeHtml((e && e.message) || 'unknown error') + ').</p>';
  }
  exp.busy = false;
  syncExportUi();
}

async function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
let gifencMod = null;
async function loadGifenc() {
  if (gifencMod) return gifencMod;
  gifencMod = await import('./gifenc.js');
  return gifencMod;
}

function drawCover(ctx, im, W, H) {
  const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height;
  const r = Math.max(W / iw, H / ih);
  const dw = iw * r, dh = ih * r;
  ctx.drawImage(im, (W - dw) / 2, (H - dh) / 2, dw, dh);
}
function fileSafe(name) {
  return String(name || '').trim().replace(/[^\w\- ]+/g, '').replace(/\s+/g, '-').toLowerCase() || 'aligno';
}


/* --- Reminders and Settings. --- */
const remOptions = ['Off', 'Daily', 'Weekly', 'Monthly'];
function renderRemOpts() {
  $('remOpts').innerHTML = remOptions.map(o => {
    const on = o === state._rem;
    return '<div class="optrow' + (on ? ' on' : '') + '" data-rem="' + o + '"><span class="nm">' + o + '</span>' +
      (on ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</div>';
  }).join('');
}
async function openReminders() {
  const p = await dbGetProject(state.projectId);
  const cur = (p && p.reminder) ? p.reminder : 'Off';
  state._rem = remOptions.find(o => o.toLowerCase() === cur.toLowerCase()) || 'Off';
  renderRemOpts();
  $('remNote').textContent = 'When it’s time for the next photo, the project gets a “Due” badge. If you’ve installed Aligno on Android, you’ll also get a notification (your phone decides the exact moment, usually within a few hours).';
  show('reminders');
}
async function saveReminder() {
  const p = await dbGetProject(state.projectId);
  if (p) {
    p.reminder = state._rem || 'Off';
    await dbPutProject(p);
    if (p.reminder !== 'Off' && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
    syncReminderJobs();
  }
  openProject(state.projectId);
  renderHome();
}

function statCard(v, l) { return '<div class="stat-card"><b>' + v + '</b><span>' + l + '</span></div>'; }
async function openSettings() {
  const projects = await dbProjects();
  let count = 0, bytes = 0;
  try {
    const all = await reqP(store('photos', 'readonly').getAll());
    count = all.length;
    all.forEach(ph => { bytes += (ph.blob ? ph.blob.size : 0) + (ph.thumb ? ph.thumb.size : 0); });
  } catch (e) {}
  projects.forEach(p => (p.photos || []).forEach(ph => { count++; bytes += Math.round((ph.dataUrl ? ph.dataUrl.length : 0) * 0.73); }));
  const mb = bytes / 1048576;
  const mbLabel = mb >= 10 ? String(Math.round(mb)) : mb.toFixed(1);
  $('statGrid').innerHTML = statCard(projects.length, 'projects') + statCard(count, 'photos') + statCard(mbLabel, 'MB used');
  $('verLbl').textContent = 'Aligno ' + APP_VERSION;
  renderBackupInfo();
  show('settings');
}

async function wipeAllData() {
  const ok = await confirmSheet('Delete all data?', 'Every project and photo on this device will be permanently removed. This cannot be undone.', 'Delete everything');
  if (!ok) return;
  try { await reqP(store('photos', 'readwrite').clear()); } catch (e) {}
  try { await reqP(store('projects', 'readwrite').clear()); } catch (e) {}
  urlCache.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) {} });
  urlCache.clear();
  try { localStorage.removeItem('aligno_seen'); } catch (e) {}
  state.projectId = null;
  await renderHome();
  show('landing');
}

/* --- Service worker updates: a new version takes over by itself. When you
   are browsing (home, a project, settings) the app simply reloads; in the
   middle of something (camera, export, an open sheet) it waits and shows the
   "Update ready" pill instead. --- */
let reloadedForUpdate = false;
function safeToReload() {
  return ['home', 'landing', 'project', 'settings', 'reminders'].indexOf(state.screen) >= 0 &&
    !openSheet() && !$('photoView').classList.contains('on') && !$('cmpView').classList.contains('on') && !exp.busy && !backupBusy;
}
function watchUpdates(reg) {
  if (!reg) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForUpdate || !hadController) return;
    if (safeToReload()) { reloadedForUpdate = true; location.reload(); }
    else $('updatePill').classList.add('on');
  });
  setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) $('updatePill').classList.add('on');
    });
  });
}

/* --- Back button (Android hardware back, browser back, Escape): keep one
   "guard" history entry while anything is open on top of the home screen,
   and turn a back press into closing whatever is topmost. --- */
let skipPop = false;
function seenIntro() { try { return !!localStorage.getItem('aligno_seen'); } catch (e) { return false; } }
function openSheet() { return document.querySelector('.modal-bg.on'); }
function isRoot() {
  if (openSheet() || $('photoView').classList.contains('on') || $('cmpView').classList.contains('on')) return false;
  return state.screen === 'home' || (state.screen === 'landing' && !seenIntro());
}
function syncHistory() {
  if (skipPop) return;
  const guarded = !!(history.state && history.state.aligno === 'g');
  if (!isRoot() && !guarded) history.pushState({ aligno: 'g' }, '');
  else if (isRoot() && guarded) { skipPop = true; history.back(); }
}
function goBack() {
  if ($('cfModal').classList.contains('on')) { cfDone(false); return; }
  const sheet = openSheet();
  if (sheet) { sheet.classList.remove('on'); closeOtherSwipes(null); return; }
  if ($('photoView').classList.contains('on')) { closePhotoView(); return; }
  if ($('cmpView').classList.contains('on')) { closeCompare(); return; }
  switch (state.screen) {
    case 'camera': case 'reminders': openProject(state.projectId); break;
    case 'export': openProject(state.projectId); break;
    case 'aligner': alCloseAligner(); break;
    case 'project': case 'settings': case 'landing': show('home'); renderHome(); break;
  }
}
function wireHistory() {
  try { history.replaceState({ aligno: 'root' }, ''); } catch (e) {}
  window.addEventListener('popstate', () => {
    if (skipPop) { skipPop = false; syncHistory(); return; }
    goBack();
    setTimeout(syncHistory, 0);
  });
  const mo = new MutationObserver(() => Promise.resolve().then(syncHistory));
  document.querySelectorAll('.modal-bg, .photoview, .cmpview').forEach(el => mo.observe(el, { attributes: true, attributeFilter: ['class'] }));
  document.addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName) && e.key !== 'Escape') return;
    const pv = $('photoView').classList.contains('on');
    if (e.key === 'Escape' && !isRoot()) { e.preventDefault(); goBack(); }
    else if (pv && e.key === 'ArrowLeft') openPhotoViewAt(viewIndex - 1);
    else if (pv && e.key === 'ArrowRight') openPhotoViewAt(viewIndex + 1);
    else if (state.screen === 'camera' && e.key === ' ' && e.target === document.body) { e.preventDefault(); shutterPressed(); }
  });
}

/* --- Backup & restore: everything goes into a plain .zip (stored, not
   compressed, JPEGs don't shrink anyway). Photos sit in one folder per
   project so the backup is also browsable by hand; aligno-backup.json holds
   the metadata needed to restore it. --- */
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_T[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function dosTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  };
}
async function buildZip(entries, onStep) {
  const parts = [], central = [];
  let offset = 0;
  for (let i = 0; i < entries.length; i++) {
    const en = entries[i];
    const data = en.data instanceof Uint8Array ? en.data : new Uint8Array(await en.data.arrayBuffer());
    const name = new TextEncoder().encode(en.name);
    const crc = crc32(data), dt = dosTime(new Date(en.ts || Date.now()));
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt.time, true); lh.setUint16(12, dt.date, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true); ch.setUint16(12, dt.time, true); ch.setUint16(14, dt.date, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    parts.push(lh.buffer, name, data);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
    if (onStep) onStep(i + 1, entries.length);
  }
  const cdSize = central.reduce((s, p) => s + (p.byteLength || p.length), 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
}
async function readZip(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) { if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Not a zip file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const files = new Map();
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nlen));
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    files.set(name, { method, raw: buf.subarray(start, start + csize) });
    p += 46 + nlen + elen + clen;
  }
  return {
    has: (n) => files.has(n),
    async get(n) {
      const f = files.get(n);
      if (!f) return null;
      if (f.method === 0) return f.raw;
      if (f.method === 8 && typeof DecompressionStream !== 'undefined') {
        const s = new Blob([f.raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(s).arrayBuffer());
      }
      throw new Error('Unsupported compression');
    }
  };
}
function isoDay(ts) {
  const d = new Date(ts), z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
}
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(t._t);
  if (ms !== 0) t._t = setTimeout(() => t.classList.remove('on'), ms || 2600);
}
let backupBusy = false;
async function backupAll() {
  if (backupBusy) return;
  backupBusy = true;
  try {
    const projects = await dbProjects();
    const meta = { app: 'aligno', format: 1, exportedAt: Date.now(), projects: [], photos: [] };
    const entries = [];
    const usedFolders = new Set();
    for (const p of projects) {
      let folder = fileSafe(p.name), k = 2;
      while (usedFolders.has(folder)) folder = fileSafe(p.name) + '-' + (k++);
      usedFolders.add(folder);
      const rec = Object.assign({}, p); delete rec.photos;
      meta.projects.push(rec);
      const photos = await photosOf(p);
      photos.forEach((ph, i) => {
        const file = folder + '/' + String(i + 1).padStart(3, '0') + '_' + isoDay(ph.ts) + '.jpg';
        const blob = ph.blob || (ph.dataUrl ? dataUrlToBlob(ph.dataUrl) : null);
        if (!blob) return;
        meta.photos.push({ id: ph.id, projectId: p.id, ts: ph.ts, src: ph.src || 'camera', zoom: ph.zoom, file });
        entries.push({ name: file, data: blob, ts: ph.ts });
      });
    }
    if (!meta.photos.length && !meta.projects.length) { toast('Nothing to back up yet'); return; }
    entries.unshift({ name: 'aligno-backup.json', data: new TextEncoder().encode(JSON.stringify(meta)), ts: Date.now() });
    toast('Preparing backup…', 0);
    const zip = await buildZip(entries, (i, n) => { if (i % 5 === 0) toast('Preparing backup… ' + Math.round(i / n * 100) + '%', 0); });
    const name = 'aligno-backup-' + isoDay(Date.now()) + '.zip';
    const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    try { localStorage.setItem('aligno_last_backup', String(Date.now())); } catch (e) {}
    toast('Backup saved: ' + meta.photos.length + (meta.photos.length === 1 ? ' photo' : ' photos'));
    renderBackupInfo();
  } catch (e) {
    toast('Backup failed: ' + ((e && e.message) || 'unknown error'), 4000);
  } finally { backupBusy = false; }
}
async function restoreBackup(file) {
  if (!file) return;
  try {
    const zip = await readZip(file);
    const raw = await zip.get('aligno-backup.json');
    if (!raw) throw new Error('This zip isn’t an Aligno backup');
    const meta = JSON.parse(new TextDecoder().decode(raw));
    if (meta.app !== 'aligno') throw new Error('This zip isn’t an Aligno backup');
    const np = meta.projects.length, nph = meta.photos.length;
    const ok = await confirmSheet('Restore this backup?',
      np + (np === 1 ? ' project' : ' projects') + ' with ' + nph + (nph === 1 ? ' photo' : ' photos') + ' from ' + fmtFullDate(meta.exportedAt) +
      '. Your current projects stay; anything already on this device is kept as is.', 'Restore');
    if (!ok) return;
    toast('Restoring…', 0);
    const existing = new Set((await dbProjects()).map(p => p.id));
    for (const p of meta.projects) { if (!existing.has(p.id)) await dbPutProject(p); }
    let done = 0;
    for (const m of meta.photos) {
      const bytes = await zip.get(m.file);
      if (bytes) {
        const blob = new Blob([bytes], { type: 'image/jpeg' });
        let thumb = null;
        try {
          const im = await loadImage(URL.createObjectURL(blob));
          const tw = 320, th = Math.max(1, Math.round(tw * im.naturalHeight / im.naturalWidth));
          const tc = document.createElement('canvas'); tc.width = tw; tc.height = th;
          tc.getContext('2d').drawImage(im, 0, 0, tw, th);
          URL.revokeObjectURL(im.src);
          thumb = await toBlobP(tc, 'image/jpeg', 0.7);
        } catch (e) {}
        const ph = { id: m.id, projectId: m.projectId, ts: m.ts, blob, src: m.src || 'camera' };
        if (thumb) ph.thumb = thumb;
        if (typeof m.zoom === 'number') ph.zoom = m.zoom;
        await dbAddPhoto(ph);
        dropUrls(m.id);
      }
      done++;
      if (done % 5 === 0) toast('Restoring… ' + Math.round(done / nph * 100) + '%', 0);
    }
    toast('Restored ' + np + (np === 1 ? ' project' : ' projects'));
    askPersistentStorage();
    await renderHome();
    openSettings();
  } catch (e) {
    toast((e && e.message) || 'Couldn’t read that file', 4000);
  }
}
function renderBackupInfo() {
  let last = 0; try { last = +localStorage.getItem('aligno_last_backup') || 0; } catch (e) {}
  $('backupSub').textContent = last ? 'Last backup ' + fmtAgo(last) : 'Not backed up yet';
}

/* --- Launch handling: app-icon shortcuts, notification taps and photos
   shared into Aligno from the gallery. --- */
let sharedFiles = [];
async function takeSharedFiles() {
  try {
    const c = await caches.open('aligno-share');
    const cnt = await c.match('./shared/count');
    const n = cnt ? +(await cnt.text()) : 0;
    const files = [];
    for (let i = 0; i < n; i++) {
      const r = await c.match('./shared/' + i);
      if (!r) continue;
      const b = await r.blob();
      files.push(new File([b], decodeURIComponent(r.headers.get('X-Name') || 'photo-' + i), { type: b.type || 'image/jpeg', lastModified: +r.headers.get('X-Modified') || Date.now() }));
    }
    await caches.delete('aligno-share');
    return files;
  } catch (e) { return []; }
}
async function openSharePicker(files) {
  sharedFiles = files;
  const n = files.length;
  $('shareTitle').textContent = 'Add ' + n + (n === 1 ? ' photo' : ' photos');
  const projects = (await dbProjects()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const rows = await Promise.all(projects.map(async p => {
    const photos = await photosOf(p);
    const last = photos[photos.length - 1];
    return '<button class="share-pick" data-pid="' + p.id + '">' + (last ? '<img src="' + urlFor(last, 'thumb') + '" alt="">' : '<i class="ph"></i>') +
      '<span class="grow"><b>' + escapeHtml(p.name) + '</b><span>' + photos.length + (photos.length === 1 ? ' photo' : ' photos') + '</span></span></button>';
  }));
  $('shareList').innerHTML = rows.join('');
  $('shareName').value = '';
  $('shareModal').classList.add('on');
}
async function handleLaunch() {
  const q = new URLSearchParams(location.search);
  if (!q.toString()) return;
  try { history.replaceState(history.state, '', location.pathname); } catch (e) {}
  try { localStorage.setItem('aligno_seen', '1'); } catch (e) {}
  if (q.get('share')) {
    const files = await takeSharedFiles();
    show('home');
    if (files.length) openSharePicker(files);
    return;
  }
  const pid = q.get('project');
  if (pid && await dbGetProject(pid)) { show('home'); await openProject(pid); return; }
  const action = q.get('action');
  if (action === 'new') { show('home'); openNewProjectModal(false); return; }
  if (action === 'camera') {
    const projects = (await dbProjects()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    show('home');
    if (projects[0]) { await openProject(projects[0].id); openCamera(); }
    else openNewProjectModal(true);
  }
}

/* Reminder notifications: register a periodic background sync while any
   project has a reminder (Android, installed app); the service worker does
   the actual check. The app icon also gets a badge with the due count. */
async function syncReminderJobs() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg || !reg.periodicSync) return;
    const any = (await dbProjects()).some(p => reminderInterval(p) > 0);
    if (any) {
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' }).catch(() => null);
      if (st && st.state === 'granted') await reg.periodicSync.register('aligno-due', { minInterval: 12 * 3600 * 1000 });
    } else {
      await reg.periodicSync.unregister('aligno-due');
    }
  } catch (e) {}
}
function setDueBadge(n) {
  try {
    if (!navigator.setAppBadge) return;
    if (n) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {});
  } catch (e) {}
}

function askPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist().catch(() => {}); }).catch(() => {});
    }
  } catch (e) {}
}

/* Sheets can be pulled down to close, like on iOS and Android. A drag starts
   anywhere on the sheet while it is scrolled to the top (not on inputs or
   sliders); far or fast enough closes it the same way as tapping outside, so
   every sheet runs its own closing logic. */
function wireSheetDrag() {
  document.querySelectorAll('.modal-bg > .sheet').forEach(sheet => {
    const bg = sheet.parentElement;
    let y0 = 0, x0 = 0, dy = 0, t0 = 0, active = false, dragging = false, id = null;
    sheet.addEventListener('pointerdown', e => {
      if (e.target.closest('input, textarea, select') || sheet.scrollTop > 0) return;
      active = true; dragging = false; dy = 0; y0 = e.clientY; x0 = e.clientX; t0 = e.timeStamp; id = e.pointerId;
    });
    sheet.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== id) return;
      const d = e.clientY - y0;
      if (!dragging) {
        if (Math.abs(e.clientX - x0) > 10) { active = false; return; }
        if (d < 8) return;
        dragging = true;
        sheet.classList.add('dragging');
        try { sheet.setPointerCapture(id); } catch (er) {}
      }
      dy = Math.max(0, d);
      sheet.style.transform = 'translateY(' + dy + 'px)';
    });
    const end = e => {
      if (!active || e.pointerId !== id) return;
      active = false;
      if (!dragging) return;
      sheet.classList.remove('dragging');
      const v = dy / Math.max(1, e.timeStamp - t0);
      sheet._dragged = true;
      setTimeout(() => { sheet._dragged = false; }, 50);
      if (dy > Math.min(140, sheet.offsetHeight * 0.3) || v > 0.6) {
        sheet.style.transform = '';
        bg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      } else {
        sheet.style.transform = '';
      }
    };
    sheet.addEventListener('pointerup', end);
    sheet.addEventListener('pointercancel', end);
    // A drag that started on a button must not also press it.
    sheet.addEventListener('click', e => { if (sheet._dragged) { e.stopPropagation(); e.preventDefault(); } }, true);
  });
}

/* --- Wiring: every event listener of the static markup. --- */
function wire() {
  $('startBtn').addEventListener('click', () => { try { localStorage.setItem('aligno_seen', '1'); } catch (e) {} show('home'); });
  $('newProjectBtn').addEventListener('click', () => openNewProjectModal(false));
  $('newCancel').addEventListener('click', closeNewProjectModal);
  $('newCreate').addEventListener('click', createProject);
  $('newImportBtn').addEventListener('click', createProjectAndImport);
  $('projName').addEventListener('keydown', e => { if (e.key === 'Enter') createProject(); });
  $('newModal').addEventListener('click', e => { if (e.target === $('newModal')) closeNewProjectModal(); });
  renderExamples();
  renderLandingDemo();
  $('exampleList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-name]'); if (!b) return;
    $('projName').value = b.getAttribute('data-name');
    $('exampleList').querySelectorAll('.ex').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
  });

  document.querySelectorAll('[data-nav="home"]').forEach(el => el.addEventListener('click', () => { show('home'); renderHome(); }));
  $('projMoreBtn').addEventListener('click', openProjectMore);
  $('moreCancel').addEventListener('click', closeProjectMore);
  $('moreModal').addEventListener('click', e => { if (e.target === $('moreModal')) closeProjectMore(); });
  $('moreImport').addEventListener('click', () => { closeProjectMore(); if (state.projectId) beginImportForProject(state.projectId); });
  $('moreRename').addEventListener('click', () => { closeProjectMore(); openRename(); });
  $('moreDelete').addEventListener('click', () => { closeProjectMore(); deleteCurrentProject(); });
  $('renCancel').addEventListener('click', () => $('renModal').classList.remove('on'));
  $('renSave').addEventListener('click', saveRename);
  $('renName').addEventListener('keydown', e => { if (e.key === 'Enter') saveRename(); });
  $('renModal').addEventListener('click', e => { if (e.target === $('renModal')) $('renModal').classList.remove('on'); });

  $('cfOk').addEventListener('click', () => cfDone(true));
  $('cfCancel').addEventListener('click', () => cfDone(false));
  $('cfModal').addEventListener('click', e => { if (e.target === $('cfModal')) cfDone(false); });

  $('newPhotoBtn').addEventListener('click', openCamera);
  $('exportBtn').addEventListener('click', openExport);
  $('reminderBtn').addEventListener('click', () => { closeProjectMore(); openReminders(); });
  $('settingsBtn').addEventListener('click', openSettings);
  $('introRow').addEventListener('click', () => { show('landing'); });
  $('wipeRow').addEventListener('click', wipeAllData);
  $('backupRow').addEventListener('click', backupAll);
  $('restoreRow').addEventListener('click', () => $('restoreInput').click());
  $('restoreInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    restoreBackup(f);
  });

  $('exportBack').addEventListener('click', () => { openProject(state.projectId); });
  $('remBack').addEventListener('click', () => openProject(state.projectId));
  $('remSave').addEventListener('click', saveReminder);
  $('remOpts').addEventListener('click', (e) => {
    const row = e.target.closest('[data-rem]'); if (!row) return;
    state._rem = row.getAttribute('data-rem'); renderRemOpts();
  });

  $('camClose').addEventListener('click', () => { openProject(state.projectId); });
  $('camLastThumb').addEventListener('click', () => { if (state.projectId) openProject(state.projectId); });
  $('libBtn').addEventListener('click', () => $('libInput').click());
  $('libInput').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    loadLibraryOverlay(f);
    e.target.value = '';
  });
  $('libReset').addEventListener('click', resetOverlayToLast);

  $('alignFilesInput').addEventListener('change', async (e) => {
    const files = e.target.files;
    const createName = alPendingCreateName;
    let pid = alPendingProjectId || state.projectId;
    alPendingProjectId = null;
    alPendingCreateName = null;
    if (!files || !files.length) { e.target.value = ''; return; }
    if (!pid && createName !== null) {
      const p = { id: uid(), name: createName, createdAt: Date.now(), updatedAt: Date.now(), reminder: 'off' };
      await dbPutProject(p);
      pid = p.id;
      state.projectId = pid;
      renderHome();
    }
    if (pid) startAligner(pid, files);
    e.target.value = '';
  });
  $('alClose').addEventListener('click', alCloseAligner);
  $('alSkip').addEventListener('click', alSkipPhoto);
  $('alUse').addEventListener('click', alUsePhoto);
  $('alGhostToggle').addEventListener('click', () => {
    alState.ghostOn = !alState.ghostOn;
    $('alGhostToggle').classList.toggle('act', alState.ghostOn);
    $('alGhost').classList.toggle('on', alState.ghostOn && !!alState.ghostUrl);
  });
  $('alZoom').addEventListener('input', function () { alSetZoom(Math.pow(AL_MAXZ, this.value / 100)); });
  $('alShapeBtn').addEventListener('click', alCycleShape);
  $('alAuto').addEventListener('click', alAutoCenter);
  $('alResetBtn').addEventListener('click', alReset);
  window.addEventListener('resize', () => {
    if (state.screen !== 'aligner') return;
    alLayoutFrame(); alFit(); alRender();
  });
  const alViewport = $('alViewport');
  alViewport.addEventListener('pointerdown', alOnPointerDown);
  alViewport.addEventListener('pointermove', alOnPointerMove);
  alViewport.addEventListener('pointerup', alOnPointerUp);
  alViewport.addEventListener('pointercancel', alOnPointerUp);
  alViewport.addEventListener('pointerleave', alOnPointerUp);
  alViewport.addEventListener('wheel', alOnWheel, { passive: false });

  $('photoViewClose').addEventListener('click', closePhotoView);
  $('photoView').addEventListener('click', (e) => { if (e.target === $('photoView') || e.target.id === 'pvStage' || e.target.id === 'photoViewImg') closePhotoView(); });
  $('pvPrev').addEventListener('click', () => openPhotoViewAt(viewIndex - 1));
  $('pvNext').addEventListener('click', () => openPhotoViewAt(viewIndex + 1));
  $('pvDelete').addEventListener('click', deleteViewedPhoto);
  $('pvDate').addEventListener('click', openDateEdit);
  $('pvShare').addEventListener('click', shareViewedPhoto);
  $('pvCompare').addEventListener('click', compareFromViewer);
  $('dateCancel').addEventListener('click', () => $('dateModal').classList.remove('on'));
  $('dateSave').addEventListener('click', saveDateEdit);
  $('dateModal').addEventListener('click', e => { if (e.target === $('dateModal')) $('dateModal').classList.remove('on'); });
  let tX = null, tY = null;
  $('photoView').addEventListener('touchstart', e => { tX = e.touches[0].clientX; tY = e.touches[0].clientY; }, { passive: true });
  $('photoView').addEventListener('touchend', e => {
    if (tX === null) return;
    const dx = e.changedTouches[0].clientX - tX;
    const dy = e.changedTouches[0].clientY - tY;
    tX = null; tY = null;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) openPhotoViewAt(viewIndex + 1); else openPhotoViewAt(viewIndex - 1);
    }
  }, { passive: true });
  $('photoGrid').addEventListener('click', (e) => {
    const t = e.target.closest('[data-i]'); if (!t) return;
    viewList = projPhotos;
    openPhotoViewAt(+t.getAttribute('data-i'));
  });

  $('flipBtn').addEventListener('click', () => { facing = (facing === 'environment') ? 'user' : 'environment'; zoom.lens = 'main'; startCamera(); });
  $('camRetry').addEventListener('click', startCamera);
  $('gridBtn').addEventListener('click', () => {
    if (gridMode === 0) requestMotionPermission();
    gridMode = (gridMode + 1) % 3; setGrid(); syncGridLevel();
    camBadge(gridMode === 0 ? 'Grid off' : gridMode === 1 ? 'Grid: thirds, with level' : 'Grid: fine, with level');
  });
  $('modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-om]'); if (!b) return;
    state.overlayMode = b.getAttribute('data-om');
    if (state.overlayMode === 'diff') { $('op').value = 100; $('opv').textContent = '100%'; }
    showModeHint(true);
    syncModeSeg(); applyOverlay(); saveCamPrefs();
  });
  $('shot').addEventListener('click', shutterPressed);
  $('timerBtn').addEventListener('click', cycleTimer);
  $('op').addEventListener('input', function () {
    $('opv').textContent = Math.round(this.value) + '%';
    if (camHasOverlay) $('overlay').style.opacity = this.value / 100;
    saveCamPrefs();
  });
  wireViewfinderPinch();
  // A rotated phone or a resized window can change the stream shape and the
  // room on screen: re-pick the live mode and the layout.
  $('video').addEventListener('resize', () => { if (state.screen === 'camera' && stream) chooseLiveMode(); });
  window.addEventListener('resize', layoutCamera);
  if (window.visualViewport) visualViewport.addEventListener('resize', layoutCamera);
  document.addEventListener('fullscreenchange', () => setTimeout(layoutCamera, 50));

  $('fps').addEventListener('input', function () {
    exp.fps = Math.round(this.value); $('fpsv').textContent = exp.fps + ' fps'; saveExportPrefs(); startExportPreview();
  });
  $('makeGifBtn').addEventListener('click', makeExport);
  $('expNeedBtn').addEventListener('click', openCamera);
  const segPick = (id, key) => $(id).addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b || b.disabled) return;
    exp[key] = b.getAttribute('data-v'); saveExportPrefs(); syncExportUi(); startExportPreview();
    $('gifResult').innerHTML = '';
  });
  segPick('expFormat', 'format');
  segPick('expShape', 'shape');
  [['expDates', 'dates'], ['expFade', 'fade'], ['expHold', 'hold']].forEach(([id, key]) => {
    $(id).addEventListener('change', function () { exp[key] = this.checked; saveExportPrefs(); startExportPreview(); });
  });

  $('updatePill').addEventListener('click', () => location.reload());

  document.addEventListener('visibilitychange', () => {
    if (state.screen !== 'camera') return;
    if (document.hidden) stopCamera();
    else if (!stream) startCamera();
  });
  wireCompare();
  wireHistory();
  wireSheetDrag();

  $('helpRow').addEventListener('click', () => $('camHelpModal').classList.add('on'));
  $('camhint').addEventListener('click', () => dismissHint($('camhint'), 'aligno_hint_first'));
  $('alHint').addEventListener('click', () => dismissHint($('alHint'), 'aligno_hint_align'));
  $('camHelpOk').addEventListener('click', () => $('camHelpModal').classList.remove('on'));
  $('camHelpModal').addEventListener('click', e => { if (e.target === $('camHelpModal')) $('camHelpModal').classList.remove('on'); });

  // Keyboard: anything acting as a button also works with Enter / Space.
  document.querySelectorAll('.set-row').forEach(r => { r.setAttribute('role', 'button'); r.setAttribute('tabindex', '0'); });
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.tagName !== 'BUTTON') {
      e.preventDefault(); e.target.click();
    }
  });

  $('shareCancel').addEventListener('click', () => { $('shareModal').classList.remove('on'); sharedFiles = []; });
  $('shareModal').addEventListener('click', e => { if (e.target === $('shareModal')) { $('shareModal').classList.remove('on'); sharedFiles = []; } });
  $('shareList').addEventListener('click', e => {
    const b = e.target.closest('[data-pid]'); if (!b) return;
    const files = sharedFiles; sharedFiles = [];
    $('shareModal').classList.remove('on');
    state.projectId = b.getAttribute('data-pid');
    startAligner(state.projectId, files);
  });
  const shareCreate = async () => {
    const files = sharedFiles; sharedFiles = [];
    const p = { id: uid(), name: $('shareName').value.trim() || 'Untitled project', createdAt: Date.now(), updatedAt: Date.now(), reminder: 'off' };
    await dbPutProject(p);
    $('shareModal').classList.remove('on');
    state.projectId = p.id;
    startAligner(p.id, files);
  };
  $('shareCreate').addEventListener('click', shareCreate);
  $('shareName').addEventListener('keydown', e => { if (e.key === 'Enter') shareCreate(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async e => {
      const pid = e.data && e.data.open;
      if (pid && await dbGetProject(pid)) openProject(pid); else { show('home'); renderHome(); }
    });
  }

  syncThemeSeg();
  $('themeSeg').addEventListener('click', e => {
    const b = e.target.closest('[data-theme-opt]'); if (b) applyThemePref(b.getAttribute('data-theme-opt'));
  });
  if (window.matchMedia) {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(darkSurface);
    if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
  }

  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('installBtn').hidden = false; });
  window.addEventListener('appinstalled', () => { deferred = null; $('installBtn').hidden = true; });
  $('installBtn').addEventListener('click', async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice; deferred = null; $('installBtn').hidden = true; return; }
    openInstallGuide();
  });
  $('installOk').addEventListener('click', () => $('installModal').classList.remove('on'));
  $('installModal').addEventListener('click', e => { if (e.target === $('installModal')) $('installModal').classList.remove('on'); });
  if (!isStandalone() && installGuide()) $('installBtn').hidden = false;

  wireAppFeel();
}

/* --- Install guide: the steps differ per browser and system, so they are
   picked from the user agent. Where the browser offers its own install
   prompt (Chrome and Edge on Android and computers), that prompt is used
   instead. Browsers that can't install web apps get no install button. --- */
const ICON_SHARE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="Share"><path d="M12 3v13"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';
const ICON_DOTS_V = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="menu"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
const ICON_DOTS_H = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-label="menu"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const ICON_LINES = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-label="menu"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';

function installGuide() {
  const ua = navigator.userAgent;
  const android = /Android/i.test(ua);
  const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) {
    if (/FBAN|FBAV|Instagram|Line\/|Snapchat|TikTok|LinkedInApp|Twitter/i.test(ua)) {
      return { title: 'Open Aligno in your browser first', steps: [
        'Tap ' + ICON_DOTS_H + ' or the browser icon in this app.',
        'Choose <b>Open in Safari</b> (or your browser).',
        'Then come back here and tap the install button again.'] };
    }
    if (/CriOS/i.test(ua)) {
      return { title: 'Add Aligno to your Home Screen', steps: [
        'Tap ' + ICON_SHARE + ' in the address bar.',
        'Tap <b>Add to Home Screen</b>. You may need to scroll down.',
        'Tap <b>Add</b>.'] };
    }
    if (/FxiOS/i.test(ua)) {
      return { title: 'Add Aligno to your Home Screen', steps: [
        'Tap the menu ' + ICON_LINES + ' at the bottom.',
        'Tap <b>Share</b>, then <b>Add to Home Screen</b>.',
        'Tap <b>Add</b>.'] };
    }
    if (/EdgiOS|OPiOS|OPT\//i.test(ua)) {
      return { title: 'Add Aligno to your Home Screen', steps: [
        'Open the menu ' + ICON_DOTS_H + ' and tap <b>Share</b> ' + ICON_SHARE + '.',
        'Tap <b>Add to Home Screen</b>.',
        'Tap <b>Add</b>.'] };
    }
    return { title: 'Add Aligno to your Home Screen', steps: [
      'Tap ' + ICON_SHARE + ' in the Safari toolbar.',
      'Scroll down and tap <b>Add to Home Screen</b>.',
      'Tap <b>Add</b>.'] };
  }
  if (android) {
    if (/SamsungBrowser/i.test(ua)) {
      return { title: 'Add Aligno to your Home screen', steps: [
        'Tap the menu ' + ICON_LINES + ' at the bottom.',
        'Tap <b>Add page to</b>, then <b>Home screen</b>.',
        'Tap <b>Add</b>.'] };
    }
    if (/Firefox/i.test(ua)) {
      return { title: 'Add Aligno to your Home screen', steps: [
        'Tap the menu ' + ICON_DOTS_V + '.',
        'Tap <b>Install</b> or <b>Add to Home screen</b>.',
        'Confirm with <b>Add</b>.'] };
    }
    if (/EdgA/i.test(ua)) {
      return { title: 'Add Aligno to your Home screen', steps: [
        'Tap the menu ' + ICON_DOTS_H + ' at the bottom.',
        'Tap <b>Add to phone</b>.',
        'Tap <b>Install</b>.'] };
    }
    return { title: 'Add Aligno to your Home screen', steps: [
      'Tap the menu ' + ICON_DOTS_V + ' at the top right.',
      'Tap <b>Install app</b> or <b>Add to Home screen</b>.',
      'Tap <b>Install</b>.'] };
  }
  if (/Edg\//i.test(ua)) {
    return { title: 'Install Aligno', steps: [
      'Open the menu ' + ICON_DOTS_H + ' at the top right.',
      'Choose <b>Apps</b>, then <b>Install Aligno</b>.'] };
  }
  if (/Chrome\//i.test(ua) && !/OPR\//i.test(ua)) {
    return { title: 'Install Aligno', steps: [
      'Click the install icon at the right of the address bar.',
      'Or open the menu ' + ICON_DOTS_V + ' and choose <b>Install Aligno</b>.'] };
  }
  if (/Macintosh/i.test(ua) && /Version\/\d+.*Safari/i.test(ua)) {
    return { title: 'Add Aligno to your Dock', steps: [
      'In the menu bar, choose <b>File</b>.',
      'Choose <b>Add to Dock</b>.'] };
  }
  return null;
}
function openInstallGuide() {
  const g = installGuide();
  if (!g) return;
  $('installTitle').textContent = g.title;
  $('installSteps').innerHTML = g.steps.map(s => '<li>' + s + '</li>').join('');
  $('installModal').classList.add('on');
}

/* --- App feel: on the home screen Aligno behaves like a native app. No pinch
   or double-tap zoom, no long-press menus or text selection outside inputs,
   and the screen stays on while the camera is open. --- */
function isStandalone() {
  return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
}
function wireAppFeel() {
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches.length > 1 && !e.target.closest('#alViewport, #cmpStage')) e.preventDefault(); }, { passive: false });
  window.addEventListener('wheel', e => { if (e.ctrlKey && !e.target.closest('#alViewport')) e.preventDefault(); }, { passive: false });
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0'].indexOf(e.key) >= 0) e.preventDefault();
  });
  document.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
  document.documentElement.classList.toggle('standalone', isStandalone());
}
let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && !wakeLock && navigator.wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      const w = wakeLock; wakeLock = null; await w.release();
    }
  } catch (e) { wakeLock = null; }
}
function bootDone() { document.documentElement.classList.remove('booting'); }

(async function init() {
  try {
    await openDB();
    try { await migrate(); } catch (e) {}
    wire();
    await renderHome();
    let seen = false; try { seen = !!localStorage.getItem('aligno_seen'); } catch (e) {}
    if (seen) show('home'); else setTheme(false);
    await handleLaunch();
    bootDone();
    askPersistentStorage();
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('sw.js').then(reg => { watchUpdates(reg); syncReminderJobs(); }).catch(() => {});
    }
  } catch (e) {
    bootDone();
    document.body.innerHTML = '<div class="empty"><h3>Couldn’t start Aligno</h3><p>' + escapeHtml((e && e.message) || 'Unknown error') + '. Close the app and open it again.</p></div>';
  }
})();
