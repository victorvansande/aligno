'use strict';

const DB_NAME = 'aligno';
const STORE = 'projects';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) {
        d.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}
function tx(mode) { return db.transaction(STORE, mode).objectStore(STORE); }
function dbAll() {
  return new Promise((res, rej) => { const r = tx('readonly').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); });
}
function dbGet(id) {
  return new Promise((res, rej) => { const r = tx('readonly').get(id); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
function dbPut(p) {
  return new Promise((res, rej) => { const r = tx('readwrite').put(p); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}
function dbDel(id) {
  return new Promise((res, rej) => { const r = tx('readwrite').delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); });
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const $ = (id) => document.getElementById(id);

function fmtAgo(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d <= 0) return 'vandaag';
  if (d === 1) return 'gisteren';
  if (d < 7) return d + ' dagen geleden';
  if (d < 14) return '1 week geleden';
  if (d < 60) return Math.floor(d / 7) + ' weken geleden';
  return Math.floor(d / 30) + ' maanden geleden';
}
function fmtDate(ts) {
  const dt = new Date(ts);
  return dt.getDate() + '/' + (dt.getMonth() + 1);
}

const state = { screen: 'home', projectId: null, overlayMode: 'photo' };

const screens = ['home', 'project', 'camera', 'export', 'reminders'];
function show(name) {
  if (state.screen === 'camera' && name !== 'camera') stopCamera();
  screens.forEach(s => {
    const el = $('screen-' + s);
    if (el) el.classList.toggle('active', s === name);
  });
  state.screen = name;
}

async function renderHome() {
  const list = $('projectList');
  const projects = (await dbAll()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (!projects.length) {
    list.innerHTML = '<div class="empty">' +
      '<div class="ic"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="13" height="13" rx="3"/><rect x="8" y="8" width="13" height="13" rx="3"/></svg></div>' +
      '<h3>Start je eerste project</h3>' +
      '<p>Een project is één reeks foto’s van hetzelfde onderwerp doorheen de tijd.</p></div>';
    return;
  }
  list.innerHTML = projects.map((p, idx) => {
    const last = p.photos && p.photos.length ? p.photos[p.photos.length - 1] : null;
    const thumb = last
      ? '<img class="pthumb" src="' + last.dataUrl + '" alt="">'
      : '<div class="pthumb"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-6 9 6v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>';
    const n = p.photos ? p.photos.length : 0;
    return '<div class="pcard" data-open="' + p.id + '" style="animation-delay:' + Math.min(idx * 40, 320) + 'ms">' + thumb +
      '<div style="flex:1; min-width:0"><div class="nm">' + escapeHtml(p.name) + '</div>' +
      '<div class="mt">' + n + ' foto’s' + (last ? ' · ' + fmtAgo(last.ts) : '') + '</div></div>' +
      '<span class="chev"><svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span></div>';
  }).join('');
  list.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openProject(el.getAttribute('data-open')));
  });
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

async function openProject(id) {
  state.projectId = id;
  const p = await dbGet(id);
  if (!p) { show('home'); renderHome(); return; }
  $('projTitle').textContent = p.name;
  const photos = p.photos || [];
  $('projMeta').textContent = photos.length + ' foto’s · chronologisch';
  const grid = $('photoGrid');
  const empty = $('projEmpty');
  if (!photos.length) {
    grid.innerHTML = '';
    empty.innerHTML = '<div class="empty"><div class="ic"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19V8a2 2 0 0 0-2-2h-3l-2-3H8L6 6H3a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2z"/><circle cx="12" cy="13" r="4"/></svg></div><h3>Nog geen foto’s</h3><p>Neem je eerste foto om de reeks te starten.</p></div>';
  } else {
    empty.innerHTML = '';
    projPhotos = photos;
    grid.innerHTML = photos.map((ph, i) =>
      '<div class="ptile" data-i="' + i + '" style="animation-delay:' + Math.min(i * 30, 300) + 'ms"><img src="' + ph.dataUrl + '" alt=""><span class="day">' + fmtDate(ph.ts) + '</span></div>'
    ).join('');
  }
  show('project');
}

let newProjectAfterCreate = false;
function openNewProjectModal(thenCamera) {
  newProjectAfterCreate = !!thenCamera;
  $('projName').value = '';
  $('newModal').classList.add('on');
  setTimeout(() => $('projName').focus(), 50);
}
function closeNewProjectModal() { $('newModal').classList.remove('on'); }
async function createProject() {
  const name = $('projName').value.trim() || 'Naamloos project';
  const p = { id: uid(), name, createdAt: Date.now(), updatedAt: Date.now(), photos: [], reminder: 'uit' };
  await dbPut(p);
  closeNewProjectModal();
  state.projectId = p.id;
  if (newProjectAfterCreate) { openCamera(); } else { openProject(p.id); }
  renderHome();
}

async function deleteCurrentProject() {
  if (!state.projectId) return;
  if (!confirm('Dit project en alle foto’s verwijderen?')) return;
  await dbDel(state.projectId);
  state.projectId = null;
  show('home');
  renderHome();
}

let stream = null, facing = 'environment', gridMode = 0, camHasOverlay = false;
let overlayRaw = null, overlayEdge = null;

function computeEdges(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, w, h);
        const s = ctx.getImageData(0, 0, w, h).data;
        const gray = new Float32Array(w * h);
        for (let i = 0, p = 0; i < s.length; i += 4, p++) gray[p] = 0.299 * s[i] + 0.587 * s[i + 1] + 0.114 * s[i + 2];
        const out = ctx.createImageData(w, h);
        const o = out.data;
        const lo = 45, hi = 165, ER = 34, EG = 224, EB = 168;
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const gx = -gray[i - 1 - w] + gray[i + 1 - w] - 2 * gray[i - 1] + 2 * gray[i + 1] - gray[i - 1 + w] + gray[i + 1 + w];
            const gy = -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] + gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
            const mag = Math.sqrt(gx * gx + gy * gy);
            let a = mag <= lo ? 0 : mag >= hi ? 255 : Math.round((mag - lo) / (hi - lo) * 255);
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
}
function hideOverlay() {
  overlayRaw = null; overlayEdge = null; camHasOverlay = false;
  const ov = $('overlay'); ov.removeAttribute('src'); ov.style.opacity = 0; ov.classList.remove('edges');
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
  if (state.overlayMode === 'edges') {
    if (!overlayEdge) {
      $('omEdges').textContent = 'Bezig…';
      try { overlayEdge = await computeEdges(overlayRaw); }
      catch (e) { overlayEdge = overlayRaw; }
      $('omEdges').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/></svg>Randen';
      if (state.overlayMode !== 'edges') return;
    }
    ov.src = overlayEdge; ov.classList.add('edges');
  } else {
    ov.src = overlayRaw; ov.classList.remove('edges');
  }
}

async function openCamera() {
  const p = await dbGet(state.projectId);
  $('camProjName').textContent = p ? p.name : 'Uitlijnen';
  const last = p && p.photos && p.photos.length ? p.photos[p.photos.length - 1] : null;
  syncModeSeg();
  if (last) setOverlay(last.dataUrl); else hideOverlay();
  show('camera');
  startCamera();
}

function setGrid() {
  const g = $('gridlines'), btn = $('gridBtn'), lbl = $('gridLbl');
  g.innerHTML = '';
  if (gridMode === 0) { g.classList.remove('on'); btn.classList.remove('act'); lbl.textContent = 'Raster'; return; }
  g.classList.add('on'); btn.classList.add('act');
  const fracs = gridMode === 1 ? [33.333, 66.667] : [25, 50, 75];
  fracs.forEach(p => {
    const v = document.createElement('div'); v.className = 'gline v'; v.style.left = p + '%'; g.appendChild(v);
    const h = document.createElement('div'); h.className = 'gline h'; h.style.top = p + '%'; g.appendChild(h);
  });
  g.appendChild(Object.assign(document.createElement('div'), { className: 'gcross' }));
  lbl.textContent = gridMode === 1 ? 'Derden' : 'Fijn';
}

async function startCamera() {
  const err = $('camerr');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    $('camerrMsg').textContent = 'De camera werkt alleen via een beveiligde https-link. Open de app via de gedeelde link.';
    err.classList.add('on'); return;
  }
  try {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
    $('video').srcObject = stream;
    await $('video').play();
    err.classList.remove('on');
  } catch (e) {
    const n = e && e.name;
    $('camerrMsg').textContent = (n === 'NotAllowedError' || n === 'SecurityError')
      ? 'Geef de browser toestemming voor de camera en probeer opnieuw.'
      : (n === 'NotFoundError') ? 'Geen bruikbare camera gevonden, of die is in gebruik door een andere app.'
      : (e && e.message) || 'Onbekende fout.';
    err.classList.add('on');
  }
}
function stopCamera() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }

async function capturePhoto() {
  const v = $('video');
  if (!v.videoWidth) return;
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
  let url; try { url = c.toDataURL('image/jpeg', 0.85); } catch (e) { return; }

  const f = $('flash'); f.style.transition = 'none'; f.style.opacity = '0.9';
  requestAnimationFrame(() => { f.style.transition = 'opacity .45s'; f.style.opacity = '0'; });

  const p = await dbGet(state.projectId);
  p.photos = p.photos || [];
  p.photos.push({ id: uid(), dataUrl: url, ts: Date.now() });
  p.updatedAt = Date.now();
  await dbPut(p);

  setOverlay(url);

  const b = $('cbadge');
  b.textContent = 'Foto ' + p.photos.length + ' bewaard — nu uitgelijnd op deze';
  b.style.display = 'block';
  b.style.animation = 'badgePop .3s ease';
  clearTimeout(window._bt); window._bt = setTimeout(() => { b.style.display = 'none'; }, 2200);
}

let expFps = 3, expTimer = null, expPhotos = [], projPhotos = [];

function fmtFullDate(ts) {
  try { return new Date(ts).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return fmtDate(ts); }
}
function openPhotoView(src, cap) {
  $('photoViewImg').src = src;
  $('photoViewCap').textContent = cap || '';
  $('photoView').classList.add('on');
}
function closePhotoView() { $('photoView').classList.remove('on'); }
async function openExport() {
  const p = await dbGet(state.projectId);
  expPhotos = (p.photos || []);
  $('expCount').textContent = expPhotos.length + ' foto’s · voorbeeld';
  $('gifResult').innerHTML = '';
  show('export');
  startExportPreview();
}
function startExportPreview() {
  clearInterval(expTimer);
  if (!expPhotos.length) { $('expFrame').removeAttribute('src'); return; }
  let i = 0; $('expFrame').src = expPhotos[0].dataUrl;
  expTimer = setInterval(() => { i = (i + 1) % expPhotos.length; $('expFrame').src = expPhotos[i].dataUrl; }, 1000 / expFps);
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
  if (!expPhotos.length) return;
  const btn = $('makeGifBtn');
  const res = $('gifResult');
  btn.disabled = true; btn.textContent = 'Bezig…';
  res.innerHTML = '<div class="spinner"></div><p class="sub" style="text-align:center; margin-top:14px">GIF wordt gemaakt…</p>';
  try {
    const { GIFEncoder, quantize, applyPalette } = await loadGifenc();
    const first = await loadImage(expPhotos[0].dataUrl);
    const W = 480, H = Math.round(W * first.height / first.width) || 640;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const enc = GIFEncoder();
    const delay = Math.round(1000 / expFps);
    for (const ph of expPhotos) {
      const im = await loadImage(ph.dataUrl);
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
    a.className = 'btn ghost flex'; a.textContent = 'Bewaren'; a.style.textDecoration = 'none';
    row.appendChild(a);
    try {
      const file = new File([blob], 'aligno.gif', { type: 'image/gif' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        const sh = document.createElement('button'); sh.className = 'btn primary flex'; sh.textContent = 'Delen';
        sh.onclick = () => navigator.share({ files: [file], title: 'Aligno' }).catch(() => {});
        row.appendChild(sh);
      }
    } catch (e) {}
    res.appendChild(row);
    btn.disabled = false; btn.textContent = 'Opnieuw maken';
  } catch (e) {
    res.innerHTML = '<p class="note">GIF maken lukte niet (' + ((e && e.message) || 'onbekend') + '). Controleer je internetverbinding en probeer opnieuw.</p>';
    btn.disabled = false; btn.textContent = 'GIF maken';
  }
}

const remOptions = ['Uit', 'Dagelijks', 'Wekelijks', 'Maandelijks'];
function renderRemOpts() {
  $('remOpts').innerHTML = remOptions.map(o => {
    const on = o === state._rem;
    return '<div class="optrow' + (on ? ' on' : '') + '" data-rem="' + o + '"><span class="nm">' + o + '</span>' +
      (on ? '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#0C6B50" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' : '') + '</div>';
  }).join('');
}
async function openReminders() {
  const p = await dbGet(state.projectId);
  const cur = (p && p.reminder) ? p.reminder : 'Uit';
  state._rem = remOptions.find(o => o.toLowerCase() === cur.toLowerCase()) || 'Uit';
  renderRemOpts();
  $('remNote').textContent = 'In deze webversie krijg je een melding zolang de app op de achtergrond actief is. Volledig betrouwbare herinneringen op een vast tijdstip komen in de native app-versie.';
  show('reminders');
}
async function saveReminder() {
  const p = await dbGet(state.projectId);
  p.reminder = state._rem || 'Uit';
  await dbPut(p);
  if (p.reminder !== 'Uit' && 'Notification' in window && Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch (e) {}
  }
  openProject(state.projectId);
}

function wire() {
  $('newProjectBtn').addEventListener('click', () => openNewProjectModal(false));
  $('newCancel').addEventListener('click', closeNewProjectModal);
  $('newCreate').addEventListener('click', createProject);
  $('projName').addEventListener('keydown', e => { if (e.key === 'Enter') createProject(); });
  $('newModal').addEventListener('click', e => { if (e.target === $('newModal')) closeNewProjectModal(); });

  document.querySelectorAll('[data-nav="home"]').forEach(el => el.addEventListener('click', () => { show('home'); renderHome(); }));
  $('delProjectBtn').addEventListener('click', deleteCurrentProject);
  $('newPhotoBtn').addEventListener('click', openCamera);
  $('exportBtn').addEventListener('click', openExport);
  $('reminderBtn').addEventListener('click', openReminders);

  $('exportBack').addEventListener('click', () => { clearInterval(expTimer); openProject(state.projectId); });
  $('remBack').addEventListener('click', () => openProject(state.projectId));
  $('remSave').addEventListener('click', saveReminder);
  $('remOpts').addEventListener('click', (e) => {
    const row = e.target.closest('[data-rem]'); if (!row) return;
    state._rem = row.getAttribute('data-rem'); renderRemOpts();
  });

  $('camClose').addEventListener('click', () => { openProject(state.projectId); });
  $('camLastThumb').addEventListener('click', () => { if (overlayRaw) openPhotoView(overlayRaw, 'Vorige foto'); });
  $('photoViewClose').addEventListener('click', closePhotoView);
  $('photoView').addEventListener('click', (e) => { if (e.target === $('photoView') || e.target.id === 'photoViewImg') closePhotoView(); });
  $('photoGrid').addEventListener('click', (e) => {
    const t = e.target.closest('[data-i]'); if (!t) return;
    const ph = projPhotos[+t.getAttribute('data-i')];
    if (ph) openPhotoView(ph.dataUrl, fmtFullDate(ph.ts));
  });
  $('flipBtn').addEventListener('click', () => { facing = (facing === 'environment') ? 'user' : 'environment'; startCamera(); });
  $('camRetry').addEventListener('click', startCamera);
  $('gridBtn').addEventListener('click', () => { gridMode = (gridMode + 1) % 3; setGrid(); });
  $('modeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-om]'); if (!b) return;
    state.overlayMode = b.getAttribute('data-om');
    syncModeSeg(); applyOverlay();
  });
  $('shot').addEventListener('click', capturePhoto);
  $('op').addEventListener('input', function () {
    $('opv').textContent = Math.round(this.value) + '%';
    if (camHasOverlay) $('overlay').style.opacity = this.value / 100;
  });

  $('fps').addEventListener('input', function () {
    expFps = Math.round(this.value); $('fpsv').textContent = expFps + ' fps'; startExportPreview();
  });
  $('makeGifBtn').addEventListener('click', makeGif);

  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('installBtn').style.display = 'flex'; });
  $('installBtn').addEventListener('click', async () => {
    if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; $('installBtn').style.display = 'none';
  });
}

(async function init() {
  try {
    await openDB();
    wire();
    await renderHome();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) {
    document.body.innerHTML = '<div style="padding:40px; font-family:sans-serif">Kon de app niet starten: ' + (e && e.message) + '</div>';
  }
})();
