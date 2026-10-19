/* Aligno: measures how one picture is shifted, turned and scaled compared
   with another (a similarity transform). Used by Stabilize in Export and by
   the live guide in the camera. Runs in a worker so the camera stays smooth.

   Pictures arrive as gray pyramids: Float32Arrays at widths 32, 64 and 128,
   always 3:4 (height = round(w * 4 / 3)). The work is done on edge strength
   (gradient magnitude), so a brighter or darker day matters little.

   Coordinates: "normalized" means the picture is 1 wide, (0, 0) is its
   centre, y points down. The result maps a point u of the reference to the
   point v = a·u + b of the other picture, with a = s·e^(iθ) and b a shift, all
   as complex numbers. */

const LEVELS = [32, 64, 128];
const hOf = (w) => Math.round(w * 4 / 3);
const refs = new Map();

function edges(g, w, h) {
  const m = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = g[i + 1] - g[i - 1], gy = g[i + w] - g[i - w];
      m[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  // A 3×3 blur widens every edge a little, so the search finds it from further away.
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      out[i] = (m[i - w - 1] + m[i - w] + m[i - w + 1] + m[i - 1] + m[i] + m[i + 1] + m[i + w - 1] + m[i + w] + m[i + w + 1]) / 9;
    }
  }
  return out;
}
function prep(pyr) {
  return pyr.map((g, k) => { const w = LEVELS[k], h = hOf(w); return { w, h, d: edges(g, w, h), tex: texture(g) }; });
}
// How much detail a picture has: a blank wall gives nothing to measure.
function texture(g) {
  let m = 0, v = 0;
  for (let i = 0; i < g.length; i++) m += g[i];
  m /= g.length;
  for (let i = 0; i < g.length; i++) v += (g[i] - m) * (g[i] - m);
  return Math.sqrt(v / g.length);
}

function sample(img, x, y) {
  const { w, h, d } = img;
  if (x < 1 || y < 1 || x > w - 2 || y > h - 2) return NaN;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (d[i] * (1 - fx) + d[i + 1] * fx) * (1 - fy) + (d[i + w] * (1 - fx) + d[i + w + 1] * fx) * fy;
}

// NCC between the reference and the other picture seen through transform p.
// Returns -1 when less than half of the reference is covered.
function score(R, M, p, st) {
  st = st || 1;
  const { w, h, d } = R, mw = M.w, mh = M.h;
  const ar = p.s * Math.cos(p.th), ai = p.s * Math.sin(p.th);
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0, total = 0;
  // st = 2 looks at every other pixel in a checkerboard: four times faster on
  // the largest level, and still thousands of samples.
  for (let y = 2; y < h - 2; y += 1) {
    const uy = (y + 0.5) / w - h / (2 * w);
    for (let x = 2 + (st > 1 ? y & 1 : 0); x < w - 2; x += st) {
      total++;
      const ux = (x + 0.5) / w - 0.5;
      const vx = ar * ux - ai * uy + p.tx, vy = ai * ux + ar * uy + p.ty;
      const b = sample(M, (vx + 0.5) * mw - 0.5, vy * mw + mh / 2 - 0.5);
      if (b !== b) continue;
      const a = d[y * w + x];
      n++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
  }
  if (n < total * 0.5) return -1;
  const va = saa - sa * sa / n, vb = sbb - sb * sb / n;
  if (va <= 1e-6 || vb <= 1e-6) return -1;
  return (sab - sa * sb / n) / Math.sqrt(va * vb);
}

/* Coarse search at 32 px wide: every scale and turn on a grid; for each, the
   other picture is warped once and then every whole-pixel shift is tried. */
function coarse(R, M, o) {
  const { w, h, d } = R, n = w * h;
  // Steps of 5% and 2.5°: at 32 px that moves the corners about one pixel,
  // so the right answer always lies within reach of a grid point.
  const scales = [];
  const steps = Math.max(1, Math.round(Math.log(o.sMax / o.sMin) / 0.05));
  for (let k = 0; k <= steps; k++) scales.push(o.sMin * Math.pow(o.sMax / o.sMin, k / steps));
  const turns = [];
  const K = Math.max(1, Math.round(o.thMax / 2.5));
  for (let k = -K; k <= K; k++) turns.push(k * 2.5 * Math.PI / 180);
  const S = o.shift, cands = [];
  const W = new Float32Array(n);
  for (const s of scales) {
    for (const th of turns) {
      const rim = s === scales[0] || s === scales[scales.length - 1] || th === turns[0] || th === turns[turns.length - 1];
      const ar = s * Math.cos(th), ai = s * Math.sin(th);
      for (let y = 0; y < h; y++) {
        const uy = (y + 0.5) / w - h / (2 * w);
        for (let x = 0; x < w; x++) {
          const ux = (x + 0.5) / w - 0.5;
          W[y * w + x] = sample(M, (ar * ux - ai * uy + 0.5) * M.w - 0.5, (ai * ux + ar * uy) * M.w + M.h / 2 - 0.5);
        }
      }
      for (let dy = -S; dy <= S; dy++) {
        for (let dx = -S; dx <= S; dx++) {
          let c = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
          const y0 = Math.max(2, 2 - dy), y1 = Math.min(h - 2, h - 2 - dy), x0 = Math.max(2, 2 - dx), x1 = Math.min(w - 2, w - 2 - dx);
          // Checkerboard: every other pixel, alternating per row.
          for (let y = y0; y < y1; y++) {
            const o = (y + x0) & 1;
            let i = y * w + x0 + o, j = (y + dy) * w + x0 + dx + o;
            for (let x = x0 + o; x < x1; x += 2, i += 2, j += 2) {
              const b = W[j];
              if (b !== b) continue;
              const a = d[i];
              c++; sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
            }
          }
          if (c < (w - 4) * (h - 4) * 0.25) continue;
          const va = saa - sa * sa / c, vb = sbb - sb * sb / c;
          if (va <= 1e-6 || vb <= 1e-6) continue;
          // shift d in the reference = a·d in the other picture
          const sx = dx / w, sy = dy / w;
          cands.push({ v: (sab - sa * sb / c) / Math.sqrt(va * vb), s, th, tx: ar * sx - ai * sy, ty: ai * sx + ar * sy,
            dx, dy, edge: rim || Math.abs(dx) === S || Math.abs(dy) === S });
        }
      }
    }
  }
  cands.sort((p, q) => q.v - p.v);
  return cands;
}

// Fine-tuning on a larger level: nudge each value while the match improves.
// `px` is how far off the start may be, in pixels of this level.
function refine(R, M, p, px, sp) {
  p = { s: p.s, th: p.th, tx: p.tx, ty: p.ty };
  let best = score(R, M, p, sp);
  const f = px / R.w * 2; // pixel at the edge ≈ half the width × change in scale or turn
  let st = { s: f, th: f, tx: px / R.w, ty: px / R.w };
  for (let it = 0; it < 40 && st.tx > 0.2 / R.w; it++) {
    let moved = false;
    for (const k of ['tx', 'ty', 's', 'th']) {
      for (const sg of [1, -1]) {
        const q = Object.assign({}, p); q[k] += sg * st[k];
        const v = score(R, M, q, sp);
        if (v > best) { best = v; p = q; moved = true; break; }
      }
    }
    if (!moved) { st = { s: st.s / 2, th: st.th / 2, tx: st.tx / 2, ty: st.ty / 2 }; }
  }
  return { p, v: best };
}

/* Two answers are "the same" when the corners of the picture land in nearly
   the same places: a bit more turn with a bit more shift is the same answer,
   while a repeating pattern (tiles, stripes) gives truly different ones. */
const CORNERS = [[-0.5, -2 / 3], [0.5, -2 / 3], [0.5, 2 / 3], [-0.5, 2 / 3]];
function cornersOf(c) {
  const ar = c.s * Math.cos(c.th), ai = c.s * Math.sin(c.th);
  return CORNERS.map(u => [ar * u[0] - ai * u[1] + c.tx, ai * u[0] + ar * u[1] + c.ty]);
}
function apart(a, b) {
  const p = cornersOf(a), q = cornersOf(b);
  return Math.max(...p.map((x, k) => Math.hypot(x[0] - q[k][0], x[1] - q[k][1])));
}

function estimate(R, M, o) {
  const t0 = Date.now();
  const tex = Math.min(R[0].tex, M[0].tex);
  const id = score(R[2], M[2], { s: 1, th: 0, tx: 0, ty: 0 }, 2);
  // Following a certain answer from a moment ago (live view): only fine-tune.
  if (o.near) {
    let r = refine(R[1], M[1], o.near, 3);
    r = refine(R[2], M[2], r.p, 1, 2);
    return { ok: true, tracked: true, s: r.p.s, th: r.p.th, tx: r.p.tx, ty: r.p.ty, v: r.v, id, distinct: o.near.distinct, edge: false, tex, ms: Date.now() - t0 };
  }
  const cands = coarse(R[0], M[0], o);
  if (!cands.length) return { ok: false, why: 'no-overlap' };
  const t1 = Date.now();
  // The three best answers that are clearly different from each other...
  const picks = [];
  for (const c of cands) {
    if (picks.every(p => apart(p, c) > 0.08)) picks.push(c);
    if (picks.length === 3) break;
  }
  // ...each fine-tuned on the next level. Ones that end up in the same place
  // count once; the margin between the best and the next is "distinct".
  const tuned = picks.map(c => Object.assign(refine(R[1], M[1], c, 1.5), { edge: c.edge }));
  tuned.sort((a, b) => b.v - a.v);
  const best = tuned[0];
  const rival = tuned.slice(1).find(t => apart(t.p, best.p) > 0.04);
  const distinct = best.v - (rival ? Math.max(0, rival.v) : 0);
  const fin = refine(R[2], M[2], best.p, 1, 2);
  // At the limit of what was searched, the real answer may lie beyond it.
  const p = fin.p, K = Math.max(1, Math.round(o.thMax / 2.5)) * 2.5;
  const ar = Math.cos(-p.th) / p.s, ai = Math.sin(-p.th) / p.s;
  const shiftPx = Math.max(Math.abs(ar * p.tx - ai * p.ty), Math.abs(ai * p.tx + ar * p.ty)) * R[0].w;
  const edge = p.s <= o.sMin * 1.01 || p.s >= o.sMax / 1.01 || Math.abs(p.th) * 180 / Math.PI >= K - 0.5 || shiftPx >= o.shift - 0.5;
  return { ok: true, s: p.s, th: p.th, tx: p.tx, ty: p.ty, v: fin.v, id, distinct, edge, tex, ms: Date.now() - t0, coarseMs: t1 - t0 };
}

self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.ref) refs.set(m.refKey, prep(m.ref));
    if (!m.mov) { self.postMessage({ id: m.id, done: true }); return; }
    const R = refs.get(m.refKey);
    if (!R) { self.postMessage({ id: m.id, result: { ok: false, why: 'no-ref' } }); return; }
    self.postMessage({ id: m.id, result: estimate(R, prep(m.mov), m.opts) });
  } catch (err) {
    self.postMessage({ id: m.id, result: { ok: false, why: String(err && err.message || err) } });
  }
};
