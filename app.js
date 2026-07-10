'use strict';

const APP_VERSION = 'v11';
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
  return Math.floor(d / 30) + ' months ago';
}
function fmtDate(ts) {
  const dt = new Date(ts);
  return dt.getDate() + '/' + (dt.getMonth() + 1);
}
function fmtFullDate(ts) {
  try { return new Date(ts).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return fmtDate(ts); }
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function plantIll(g) {
  const sh = 6 + g * 22, top = 30 - sh, n = Math.max(1, Math.round(1 + g * 3));
  let lv = '';
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / (n + 1), ly = 29 - t * sh, s = i % 2 ? -1 : 1;
    lv += '<ellipse cx="' + (20 + s * 4) + '" cy="' + ly + '" rx="' + (2.6 + g * 2) + '" ry="1.9" fill="#3FA873" transform="rotate(' + (s * 30) + ' ' + (20 + s * 4) + ' ' + ly + ')"/>';
  }
  return '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#E7F2EA"/><line x1="20" y1="30" x2="20" y2="' + top + '" stroke="#2E7D55" stroke-width="1.6" stroke-linecap="round"/>' + lv + '<path d="M15.5 30h9l-1 5.5h-7z" fill="#C5824F"/></svg>';
}
function personIll(g) {
  const hd = 3 + g * 1.4, bh = 9 + g * 13, top = 31 - bh - hd;
  return '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#FBEDF1"/><circle cx="20" cy="' + (top + hd) + '" r="' + hd + '" fill="#E58AA6"/><rect x="' + (20 - hd) + '" y="' + (top + hd * 2) + '" width="' + (hd * 2) + '" height="' + (31 - (top + hd * 2)) + '" rx="' + hd + '" fill="#E58AA6"/></svg>';
}
const B_LOT = '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#EDEFF2"/><rect y="29" width="40" height="11" fill="#D9CBA9"/><path d="M7 29q5-3 9 0M24 29q4-2 8 0" stroke="#B6A886" fill="none" stroke-width="1.1" stroke-linecap="round"/></svg>';
const B_FND = '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#EDEFF2"/><rect y="29" width="40" height="11" fill="#D9CBA9"/><rect x="10" y="22" width="20" height="7.5" fill="none" stroke="#9AA0A6" stroke-width="1.7"/></svg>';
const B_HSE = '<svg viewBox="0 0 40 40"><rect width="40" height="40" fill="#E7F0FB"/><rect y="29" width="40" height="11" fill="#D9CBA9"/><rect x="10" y="19" width="20" height="11" fill="#F2EAD9" stroke="#B7996F" stroke-width="1"/><path d="M8 19l12-8 12 8z" fill="#C0573A"/><rect x="17.5" y="23.5" width="5" height="6.5" fill="#8A6A45"/></svg>';

const EXAMPLES = [
  { name: 'Living room plant', label: 'Plant', desc: 'seedling to full bloom', frames: [plantIll(0.18), plantIll(0.55), plantIll(1)] },
  { name: 'House build', label: 'Building', desc: 'ground to finished home', frames: [B_LOT, B_FND, B_HSE] },
  { name: 'Growing up', label: 'A child', desc: 'watch them grow', frames: [personIll(0.25), personIll(0.6), personIll(1)] }
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

const state = { screen: 'landing', projectId: null, overlayMode: 'photo' };

function setTheme(dark) {
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', dark ? '#0d0f12' : '#ffffff');
}

const screens = ['landing', 'home', 'project', 'camera', 'export', 'reminders', 'settings'];
function show(name) {
  if (state.screen === 'camera' && name !== 'camera') stopCamera();
  screens.forEach(s => {
    const el = $('screen-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
  state.screen = name;
  setTheme(name === 'camera');
}

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
      : '<div class="pthumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>';
    const n = photos.length;
    const due = isDue(p, last) ? '<span class="duechip">Due</span>' : '';
    return '<div class="pcard" data-open="' + p.id + '" style="animation-delay:' + Math.min(idx * 40, 320) + 'ms">' + thumb +
      '<div style="flex:1; min-width:0"><div class="nm">' + escapeHtml(p.name) + '</div>' +
      '<div class="mt">' + n + (n === 1 ? ' photo' : ' photos') + (last ? ' · ' + fmtAgo(last.ts) : '') + due + '</div></div>' +
      '<span class="chev"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span></div>';
  }));
  list.innerHTML = cards.join('');
  list.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openProject(el.getAttribute('data-open')));
  });
}

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
      '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>' +
      '<span><b>Photo due.</b> Keep the series going — take the next shot.</span>' +
      '<span class="go"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span></div>'
    : '';
  const dueGo = $('dueGo');
  if (dueGo) dueGo.addEventListener('click', openCamera);

  $('projMeta').textContent = photos.length >= 2 ? 'All photos' : (photos.length + (photos.length === 1 ? ' photo' : ' photos') + ' · chronological');
  renderProjectHero(photos);
  const grid = $('photoGrid');
  const empty = $('projEmpty');
  if (!photos.length) {
    grid.innerHTML = '';
    empty.innerHTML = '<div class="empty"><div class="ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3H8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"/><circle cx="12" cy="13" r="4"/></svg></div><h3>No photos yet</h3><p>Take your first photo to start the series.</p></div>';
  } else {
    empty.innerHTML = '';
    grid.innerHTML = photos.map((ph, i) =>
      '<div class="ptile" data-i="' + i + '" style="animation-delay:' + Math.min(i * 30, 300) + 'ms"><img src="' + urlFor(ph, 'thumb') + '" alt=""><span class="day">' + fmtDate(ph.ts) + '</span></div>'
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
    '<figure class="hero-fig"><img src="' + urlFor(first, 'thumb') + '" alt=""><figcaption>First</figcaption></figure>' +
    '<div class="hero-ar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>' +
    '<figure class="hero-fig"><img src="' + urlFor(last, 'thumb') + '" alt=""><figcaption>Latest</figcaption></figure>' +
    '</div><div class="hero-stats">' +
    '<div class="stat"><b>' + photos.length + '</b><span>photos</span></div>' +
    '<div class="stat"><b>' + days + '</b><span>' + (days === 1 ? 'day' : 'days') + '</span></div>' +
    '<div class="stat"><b>' + fmtDate(last.ts) + '</b><span>latest</span></div>' +
    '</div></div>';
}

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

let stream = null, facing = 'environment', gridMode = 0, camHasOverlay = false;
let overlayRaw = null, overlayEdge = null, zoomTrack = null;

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
function hideOverlay() {
  overlayRaw = null; overlayEdge = null; camHasOverlay = false;
  const ov = $('overlay'); ov.removeAttribute('src'); ov.style.opacity = 0; ov.classList.remove('edges'); ov.classList.remove('diff');
  $('opRow').style.display = 'none'; $('modeSeg').style.display = 'none';
  $('camLastThumb').style.display = 'none'; $('camhint').style.display = 'block';
}
function setOverlay(raw) {
  overlayRaw = raw; overlayEdge = null; camHasOverlay = true;
  $('op').value = 50; $('opv').textContent = '50%';
  $('opRow').style.display = 'flex'; $('modeSeg').style.display = 'flex';
  $('camLastThumb').src = raw; $('camLastThumb').style.display = 'block';
  $('camhint').style.display = 'none';
  applyOverlay();
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
      $('omEdges').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg>Edges';
      if (state.overlayMode !== 'edges') return;
    }
    ov.src = overlayEdge; ov.classList.add('edges');
  } else {
    ov.src = overlayRaw; ov.classList.remove('edges');
  }
}

async function openCamera() {
  const p = await dbGetProject(state.projectId);
  if (!p) return;
  $('camProjName').textContent = p.name;
  const photos = await photosOf(p);
  const last = photos.length ? photos[photos.length - 1] : null;
  syncModeSeg();
  if (last) setOverlay(urlFor(last, 'full')); else hideOverlay();
  show('camera');
  await startCamera();
  if (last && typeof last.zoom === 'number' && zoomTrack) {
    $('zoom').value = last.zoom;
    applyZoom(last.zoom);
    camBadge('Zoom restored from last photo');
  }
}

function setGrid() {
  const g = $('gridlines'), btn = $('gridBtn'), lbl = $('gridLbl');
  g.innerHTML = '';
  if (gridMode === 0) { g.classList.remove('on'); btn.classList.remove('act'); lbl.textContent = 'Grid'; return; }
  g.classList.add('on'); btn.classList.add('act');
  const fracs = gridMode === 1 ? [33.333, 66.667] : [25, 50, 75];
  fracs.forEach(p => {
    const v = document.createElement('div'); v.className = 'gline v'; v.style.left = p + '%'; g.appendChild(v);
    const h = document.createElement('div'); h.className = 'gline h'; h.style.top = p + '%'; g.appendChild(h);
  });
  g.appendChild(Object.assign(document.createElement('div'), { className: 'gcross' }));
  lbl.textContent = gridMode === 1 ? 'Thirds' : 'Fine';
}

function setupZoom() {
  const row = $('zoomRow');
  zoomTrack = null;
  const track = stream && stream.getVideoTracks ? stream.getVideoTracks()[0] : null;
  let caps = null;
  try { caps = track && track.getCapabilities ? track.getCapabilities() : null; } catch (e) {}
  if (track && caps && caps.zoom && typeof caps.zoom.max === 'number' && caps.zoom.max > caps.zoom.min) {
    zoomTrack = track;
    const z = $('zoom');
    z.min = caps.zoom.min; z.max = caps.zoom.max; z.step = caps.zoom.step || 0.1;
    let cur = caps.zoom.min;
    try { const s = track.getSettings(); if (typeof s.zoom === 'number') cur = s.zoom; } catch (e) {}
    z.value = cur;
    $('zoomv').textContent = Number(cur).toFixed(1) + '×';
    row.style.display = 'flex';
  } else {
    row.style.display = 'none';
  }
}
async function applyZoom(v) {
  if (!zoomTrack) return;
  try { await zoomTrack.applyConstraints({ advanced: [{ zoom: Number(v) }] }); } catch (e) {}
  $('zoomv').textContent = Number(v).toFixed(1) + '×';
}

async function startCamera() {
  const err = $('camerr');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('camerrMsg').textContent = 'The camera only works over a secure https link. Open the app via the shared link.';
    err.classList.add('on'); return;
  }
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 2560 }, height: { ideal: 1440 } },
      audio: false
    });
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = newStream;
    $('video').srcObject = stream;
    await $('video').play();
    setupZoom();
    err.classList.remove('on');
  } catch (e) {
    const n = e && e.name;
    $('camerrMsg').textContent = (n === 'NotAllowedError' || n === 'SecurityError')
      ? 'Allow camera access in your browser and try again.'
      : (n === 'NotFoundError') ? 'No usable camera found, or it is in use by another app.'
      : (e && e.message) || 'Unknown error.';
    err.classList.add('on');
  }
}
function stopCamera() {
  if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  zoomTrack = null;
}

function toBlobP(canvas, type, q) { return new Promise(r => canvas.toBlob(r, type, q)); }

async function capturePhoto() {
  const v = $('video');
  if (!v.videoWidth || !state.projectId) return;
  if (navigator.vibrate) { try { navigator.vibrate(15); } catch (e) {} }

  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);

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
  const ph = { id: uid(), projectId: p.id, ts: Date.now(), blob };
  if (thumb) ph.thumb = thumb;
  if (zoomTrack) {
    try { const s = zoomTrack.getSettings(); if (typeof s.zoom === 'number') ph.zoom = s.zoom; } catch (e) {}
  }
  await dbAddPhoto(ph);
  p.updatedAt = Date.now();
  await dbPutProject(p);

  const count = (await dbPhotoCount(p.id)) + ((p.photos && p.photos.length) || 0);
  setOverlay(urlFor(ph, 'full'));
  camBadge('Photo ' + count + ' saved — now aligned to this');
}

function camBadge(text) {
  const b = $('cbadge');
  b.textContent = text;
  b.style.display = 'block';
  b.style.animation = 'none';
  requestAnimationFrame(() => { b.style.animation = 'badgePop .3s ease'; });
  clearTimeout(window._bt); window._bt = setTimeout(() => { b.style.display = 'none'; }, 2400);
}

let viewList = [], viewIndex = 0;
function openPhotoViewAt(i) {
  if (!viewList.length) return;
  viewIndex = Math.max(0, Math.min(i, viewList.length - 1));
  const ph = viewList[viewIndex];
  $('photoViewImg').src = urlFor(ph, 'full');
  $('photoViewCap').textContent = (viewIndex + 1) + ' of ' + viewList.length + ' · ' + fmtFullDate(ph.ts);
  $('pvPrev').style.visibility = viewIndex > 0 ? 'visible' : 'hidden';
  $('pvNext').style.visibility = viewIndex < viewList.length - 1 ? 'visible' : 'hidden';
  $('photoView').classList.add('on');
  setTheme(true);
}
function closePhotoView() {
  $('photoView').classList.remove('on');
  setTheme(state.screen === 'camera');
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

let expFps = 3, expTimer = null, expPhotos = [];

async function openExport() {
  const p = await dbGetProject(state.projectId);
  if (!p) return;
  expPhotos = await photosOf(p);
  const n = expPhotos.length;
  $('expCount').textContent = n === 0 ? 'No photos yet'
    : n === 1 ? '1 photo — add at least one more to make a GIF'
    : n + ' photos · preview';
  $('gifResult').innerHTML = '';
  const btn = $('makeGifBtn');
  btn.disabled = n < 2;
  btn.textContent = 'Make GIF';
  show('export');
  startExportPreview();
}
function startExportPreview() {
  clearInterval(expTimer);
  if (!expPhotos.length) { $('expFrame').removeAttribute('src'); return; }
  let i = 0; $('expFrame').src = urlFor(expPhotos[0], 'full');
  if (expPhotos.length < 2) return;
  expTimer = setInterval(() => { i = (i + 1) % expPhotos.length; $('expFrame').src = urlFor(expPhotos[i], 'full'); }, 1000 / expFps);
}

async function loadImage(src) {
  return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src; });
}
let gifencMod = null;
async function loadGifenc() {
  if (gifencMod) return gifencMod;
  gifencMod = await import('https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm');
  return gifencMod;
}

async function makeGif() {
  if (expPhotos.length < 2) return;
  const btn = $('makeGifBtn');
  const res = $('gifResult');
  btn.disabled = true; btn.textContent = 'Working…';
  res.innerHTML = '<div class="spinner"></div><p class="sub" style="text-align:center; margin-top:14px">Creating GIF…</p>';
  try {
    const { GIFEncoder, quantize, applyPalette } = await loadGifenc();
    const first = await loadImage(urlFor(expPhotos[0], 'full'));
    const W = 480, H = Math.round(W * first.height / first.width) || 640;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const enc = GIFEncoder();
    const delay = Math.round(1000 / expFps);
    for (const ph of expPhotos) {
      const im = await loadImage(urlFor(ph, 'full'));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(im, 0, 0, W, H);
      const data = ctx.getImageData(0, 0, W, H).data;
      const palette = quantize(data, 256);
      const index = applyPalette(data, palette);
      enc.writeFrame(index, W, H, { palette, delay });
    }
    enc.finish();
    const blob = new Blob([enc.bytes()], { type: 'image/gif' });
    const url = URL.createObjectURL(blob);
    res.innerHTML = '';
    const img = new Image(); img.src = url; img.alt = 'GIF';
    img.style.cssText = 'width:100%; max-width:280px; display:block; margin:0 auto 16px; border-radius:16px; box-shadow:var(--sh)';
    res.appendChild(img);
    const row = document.createElement('div'); row.style.cssText = 'display:flex; gap:10px';
    const a = document.createElement('a'); a.href = url; a.download = 'aligno.gif';
    a.className = 'btn ghost flex'; a.textContent = 'Save'; a.style.textDecoration = 'none';
    row.appendChild(a);
    try {
      const file = new File([blob], 'aligno.gif', { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        const sh = document.createElement('button'); sh.className = 'btn primary flex'; sh.textContent = 'Share';
        sh.onclick = () => navigator.share({ files: [file], title: 'Aligno' }).catch(() => {});
        row.appendChild(sh);
      }
    } catch (e) {}
    res.appendChild(row);
    btn.disabled = false; btn.textContent = 'Make again';
  } catch (e) {
    res.innerHTML = '<p class="note">Couldn’t create the GIF (' + ((e && e.message) || 'unknown') + '). Check your internet connection and try again.</p>';
    btn.disabled = false; btn.textContent = 'Make GIF';
  }
}

const remOptions = ['Off', 'Daily', 'Weekly', 'Monthly'];
function renderRemOpts() {
  $('remOpts').innerHTML = remOptions.map(o => {
    const on = o === state._rem;
    return '<div class="optrow' + (on ? ' on' : '') + '" data-rem="' + o + '"><span class="nm">' + o + '</span>' +
      (on ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#0C6B50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</div>';
  }).join('');
}
async function openReminders() {
  const p = await dbGetProject(state.projectId);
  const cur = (p && p.reminder) ? p.reminder : 'Off';
  state._rem = remOptions.find(o => o.toLowerCase() === cur.toLowerCase()) || 'Off';
  renderRemOpts();
  $('remNote').textContent = 'You’ll see a “Due” badge on the project when it’s time for the next photo. Push notifications at a fixed time will come with the native app version.';
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
  $('verLbl').textContent = 'Aligno ' + APP_VERSION + ' · web preview';
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

function watchUpdates(reg) {
  if (!reg) return;
  reg.addEventListener('updatefound', () => {
    const nw = reg.installing;
    if (!nw) return;
    nw.addEventListener('statechange', () => {
      if (nw.state === 'installed' && navigator.serviceWorker.controller) $('updatePill').classList.add('on');
    });
  });
}

function wire() {
  $('startBtn').addEventListener('click', () => { try { localStorage.setItem('aligno_seen', '1'); } catch (e) {} show('home'); });
  $('newProjectBtn').addEventListener('click', () => openNewProjectModal(false));
  $('newCancel').addEventListener('click', closeNewProjectModal);
  $('newCreate').addEventListener('click', createProject);
  $('projName').addEventListener('keydown', e => { if (e.key === 'Enter') createProject(); });
  $('newModal').addEventListener('click', e => { if (e.target === $('newModal')) closeNewProjectModal(); });
  renderExamples();
  $('exampleList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-name]'); if (!b) return;
    $('projName').value = b.getAttribute('data-name');
    $('exampleList').querySelectorAll('.ex').forEach(x => x.classList.remove('sel'));
    b.classList.add('sel');
  });

  document.querySelectorAll('[data-nav="home"]').forEach(el => el.addEventListener('click', () => { show('home'); renderHome(); }));
  $('delProjectBtn').addEventListener('click', deleteCurrentProject);
  $('renameBtn').addEventListener('click', openRename);
  $('renCancel').addEventListener('click', () => $('renModal').classList.remove('on'));
  $('renSave').addEventListener('click', saveRename);
  $('renName').addEventListener('keydown', e => { if (e.key === 'Enter') saveRename(); });
  $('renModal').addEventListener('click', e => { if (e.target === $('renModal')) $('renModal').classList.remove('on'); });

  $('cfOk').addEventListener('click', () => cfDone(true));
  $('cfCancel').addEventListener('click', () => cfDone(false));
  $('cfModal').addEventListener('click', e => { if (e.target === $('cfModal')) cfDone(false); });

  $('newPhotoBtn').addEventListener('click', openCamera);
  $('exportBtn').addEventListener('click', openExport);
  $('reminderBtn').addEventListener('click', openReminders);
  $('settingsBtn').addEventListener('click', openSettings);
  $('introRow').addEventListener('click', () => { show('landing'); });
  $('wipeRow').addEventListener('click', wipeAllData);

  $('exportBack').addEventListener('click', () => { clearInterval(expTimer); openProject(state.projectId); });
  $('remBack').addEventListener('click', () => openProject(state.projectId));
  $('remSave').addEventListener('click', saveReminder);
  $('remOpts').addEventListener('click', (e) => {
    const row = e.target.closest('[data-rem]'); if (!row) return;
    state._rem = row.getAttribute('data-rem'); renderRemOpts();
  });

  $('camClose').addEventListener('click', () => { openProject(state.projectId); });
  $('camLastThumb').addEventListener('click', () => { if (state.projectId) openProject(state.projectId); });

  $('photoViewClose').addEventListener('click', closePhotoView);
  $('photoView').addEventListener('click', (e) => { if (e.target === $('photoView') || e.target.id === 'photoViewImg') closePhotoView(); });
  $('pvPrev').addEventListener('click', () => openPhotoViewAt(viewIndex - 1));
  $('pvNext').addEventListener('click', () => openPhotoViewAt(viewIndex + 1));
  $('pvDelete').addEventListener('click', deleteViewedPhoto);
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

  $('flipBtn').addEventListener('click', () => { facing = (facing === 'environment') ? 'user' : 'environment'; startCamera(); });
  $('camRetry').addEventListener('click', startCamera);
  $('gridBtn').addEventListener('click', () => { gridMode = (gridMode + 1) % 3; setGrid(); });
  $('modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-om]'); if (!b) return;
    state.overlayMode = b.getAttribute('data-om');
    if (state.overlayMode === 'diff') { $('op').value = 100; $('opv').textContent = '100%'; camBadge('Line it up until the screen goes dark'); }
    syncModeSeg(); applyOverlay();
  });
  $('shot').addEventListener('click', capturePhoto);
  $('op').addEventListener('input', function () {
    $('opv').textContent = Math.round(this.value) + '%';
    if (camHasOverlay) $('overlay').style.opacity = this.value / 100;
  });
  $('zoom').addEventListener('input', function () { applyZoom(this.value); });

  $('fps').addEventListener('input', function () {
    expFps = Math.round(this.value); $('fpsv').textContent = expFps + ' fps'; startExportPreview();
  });
  $('makeGifBtn').addEventListener('click', makeGif);

  $('updatePill').addEventListener('click', () => location.reload());

  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('installBtn').style.display = 'flex'; });
  $('installBtn').addEventListener('click', async () => {
    if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('installBtn').style.display = 'none';
  });
}

(async function init() {
  try {
    await openDB();
    try { await migrate(); } catch (e) {}
    wire();
    await renderHome();
    let seen = false; try { seen = !!localStorage.getItem('aligno_seen'); } catch (e) {}
    if (seen) show('home'); else setTheme(false);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(watchUpdates).catch(() => {});
    }
  } catch (e) {
    document.body.innerHTML = '<div style="padding:40px; font-family:sans-serif">Couldn’t start the app: ' + (e && e.message) + '</div>';
  }
})();
