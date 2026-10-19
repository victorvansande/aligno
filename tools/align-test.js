/* Dev only: test scenes for the alignment engine (align-worker.js), used by
   Stabilize and the live guide. Load it in the running app on localhost:
     await import('/tools/align-test.js'); await alignTest.run();
   It builds a textured "room" with a growing plant and renders views of it
   with a known shift, turn and scale, plus noise and other light. Each case
   checks that the engine finds the right numbers, and that blank walls,
   repeating tiles and a different scene are reported as uncertain. */

function makeScene(kind, seed) {
  const W = 1400, H = 1800, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let s = seed || 3; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  if (kind === 'blank') { x.fillStyle = '#d8d4cc'; x.fillRect(0, 0, W, H); return c; }
  if (kind === 'tiles') {
    x.fillStyle = '#ddd'; x.fillRect(0, 0, W, H); x.fillStyle = '#555';
    for (let i = 0; i < W; i += 70) x.fillRect(i, 0, 4, H);
    for (let j = 0; j < H; j += 70) x.fillRect(0, j, W, 4);
    return c;
  }
  x.fillStyle = '#887766'; x.fillRect(0, 0, W, H);
  for (const [n, a] of [[6, 0.5], [14, 0.35], [40, 0.25], [120, 0.15]]) {
    const t = document.createElement('canvas'); t.width = n; t.height = Math.round(n * H / W);
    const tx = t.getContext('2d'), id = tx.createImageData(t.width, t.height);
    for (let i = 0; i < id.data.length; i += 4) { const v = rnd() * 255; id.data[i] = v; id.data[i + 1] = v * 0.95; id.data[i + 2] = v * 0.85; id.data[i + 3] = 255; }
    tx.putImageData(id, 0, 0); x.globalAlpha = a; x.imageSmoothingQuality = 'high'; x.drawImage(t, 0, 0, W, H); x.globalAlpha = 1;
  }
  for (let i = 0; i < 14; i++) { x.fillStyle = `hsl(${rnd() * 60 + 10},${20 + rnd() * 30}%,${20 + rnd() * 50}%)`; x.fillRect(rnd() * W, rnd() * H, 80 + rnd() * 400, 40 + rnd() * 300); }
  x.fillStyle = '#e8eef5'; x.fillRect(250, 150, 300, 380); x.strokeStyle = '#432'; x.lineWidth = 14; x.strokeRect(250, 150, 300, 380);
  return c;
}

// A 900×1200 view in which a point u of the straight view shows up at a·u + b.
function view(scene, p, opts) {
  opts = opts || {};
  const sc = { x: 700, y: 900 };
  const c = document.createElement('canvas'); c.width = 900; c.height = 1200; const x = c.getContext('2d');
  const ar = (p.s || 1) * Math.cos(p.th || 0), ai = (p.s || 1) * Math.sin(p.th || 0);
  const e = 450 + 900 * (p.tx || 0) - (ar * sc.x - ai * sc.y), f = 600 + 900 * (p.ty || 0) - (ai * sc.x + ar * sc.y);
  x.fillStyle = '#000'; x.fillRect(0, 0, 900, 1200);
  x.setTransform(ar, ai, -ai, ar, e, f);
  x.filter = 'brightness(' + (opts.bright || 1) + ')';
  x.drawImage(scene, 0, 0);
  if (opts.plant) {
    const g = opts.plant;
    x.fillStyle = '#2f7d32';
    for (let k = 0; k < 8; k++) { x.beginPath(); x.ellipse(700 + Math.cos(k) * 90 * g, 1000 - k * 25 * g, 40 + 60 * g, 18 + 25 * g, k, 0, 7); x.fill(); }
    x.fillStyle = '#7a4a2a'; x.fillRect(640, 1050, 120, 110);
  }
  x.filter = 'none'; x.setTransform(1, 0, 0, 1, 0, 0);
  if (opts.noise) {
    const id = x.getImageData(0, 0, 900, 1200);
    for (let i = 0; i < id.data.length; i += 4) { const n = (Math.random() - 0.5) * opts.noise; id.data[i] += n; id.data[i + 1] += n; id.data[i + 2] += n; }
    x.putImageData(id, 0, 0);
  }
  return c;
}

let scenes = null;
function getScenes() {
  if (!scenes) scenes = { room: makeScene('room', 5), blank: makeScene('blank'), tiles: makeScene('tiles'), other: makeScene('room', 99) };
  return scenes;
}
async function est(refC, movC, o) {
  const k = window.crop34(refC.width, refC.height);
  await window.awCall({ refKey: 'test', ref: window.grayPyramid(refC, k) });
  return window.awCall({ refKey: 'test', mov: window.grayPyramid(movC, k), opts: o || { sMin: 0.85, sMax: 1.18, thMax: 8, shift: 8 } });
}
const deg = Math.PI / 180;
const CASES = [
  ['shift 3% right', { tx: 0.03 }],
  ['shift 5% up', { ty: -0.05 }],
  ['8% closer', { s: 1.08 }],
  ['turned 4°', { th: 4 * deg }],
  ['all at once', { s: 0.94, th: -3 * deg, tx: -0.04, ty: 0.02 }],
  ['big: 15% closer, 6°', { s: 1.15, th: 6 * deg, tx: 0.05 }]
];
async function run(opts) {
  const S = getScenes(), out = [];
  const ref = view(S.room, {}, { plant: 0.3 });
  for (const [name, p] of CASES) {
    const t0 = performance.now();
    const r = await est(ref, view(S.room, p, { plant: 0.45, bright: 0.8, noise: 18 }), opts);
    const err = r.ok ? Math.max(Math.abs(r.s - (p.s || 1)) * 0.5, Math.abs(r.th - (p.th || 0)) * 0.5, Math.abs(r.tx - (p.tx || 0)), Math.abs(r.ty - (p.ty || 0))) : 1;
    out.push({ name, ms: Math.round(performance.now() - t0), worker: r.ms, coarse: r.coarseMs, certain: window.certain(r, 0.6), errPct: +(err * 100).toFixed(2), v: r.v && +r.v.toFixed(2), distinct: r.distinct && +r.distinct.toFixed(3), expect: 'certain' });
  }
  const negatives = [
    ['blank wall', view(S.blank, {}), view(S.blank, { tx: 0.03 }, { noise: 10 })],
    ['tiles', view(S.tiles, {}), view(S.tiles, { tx: 0.02 }, { noise: 10 })],
    ['other scene', ref, view(S.other, {})]
  ];
  for (const [name, a, b] of negatives) {
    const t0 = performance.now();
    const r = await est(a, b, opts);
    out.push({ name, ms: Math.round(performance.now() - t0), certain: window.certain(r, 0.6), v: r.v && +r.v.toFixed(2), distinct: r.distinct && +r.distinct.toFixed(3), expect: 'uncertain' });
  }
  return out;
}
window.alignTest = { run, view, getScenes, est };
