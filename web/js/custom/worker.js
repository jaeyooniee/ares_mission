// ARES MISSION · custom landing site builder (runs in a Web Worker, nothing leaves the browser).
// Turns user files (DEM GeoTIFF + optional image, CRISM MTRDR, THEMIS, rover traverse) into the same 10 files the
// Gale and Jezero sites use (web/data/*): terrain.json, dem.bin, texture_color.jpg, route_walk.json, route_rover.json,
// minerals.json, minerals.png, science.json, science.bin, reach.bin.
// The numbers follow the team's Python code: pipeline_min.py (16 m grid, walking model) and science.py
// (robust z per CRISM observation, relief, diversity, novelty, reach = round-trip O2 from the habitat).
import * as GeoTIFF from 'https://cdn.jsdelivr.net/npm/geotiff@2.1.3/+esm';

const R_MARS = 3396190, D2R = Math.PI / 180, G_MARS = 3.71;
const CELL = 16, N_MAX = 624;                      // same grid as Gale / Jezero: 624 x 624 cells of 16 m (9984 m)
const TEX = 4096;                                  // map image size (px)
const WALK = { max_slope: 18.0 }, ROVER = { max_slope: 28.0 };
const SC = { z_full: 8.0, high: 0.6, o2_capacity_kg: 1.2, reserve: 0.6, max_eva_h: 8.0, stop_min: 20, relief_m: 100, novelty_full_m: 1000 };
const OBJECTIVES = { life: ['LPS-4M'], water: ['LPS-3LM', 'SE-3LM'], geology: ['LPS-1LM', 'LPS-2LM'], resource: ['AS-3LM', 'MI-4M', 'OP-3LM'], novelty: ['SE-4LM'], diversity: ['SE-4LM', 'SE-5LM'] };
const ORDER = ['life', 'water', 'geology', 'resource', 'novelty', 'diversity'];
// category -> CRISM indices and the mineral overlay, from the team table (Min_trial/category_minerals_by_site.txt).
// 'gale' and 'jezero' are those sites' rows exactly; 'general' = both together (for a site of unknown type).
const MIN_DEF = {   // key: [label, CRISM index, colour]
  hcp: ['High-Ca pyroxene', 'HCPINDEX2', [255, 105, 180]], lcp: ['Low-Ca pyroxene', 'LCPINDEX2', [200, 255, 200]],
  hematite: ['Crystalline hematite', 'BD860_2', [255, 150, 30]], fine_hematite: ['Fine-grained hematite', 'BD530_2', [240, 225, 74]],
  olivine: ['Olivine', 'OLINDEX3', [20, 170, 150]], fe_olivine: ['Fe-olivine / plagioclase', 'BD1300', [255, 255, 255]],
  hydrated: ['Hydrated minerals (H2O)', 'BD1900R2', [140, 230, 255]], poly_sulf: ['Polyhydrated sulfate', 'SINDEX2', [60, 200, 90]],
  mono_sulf: ['Monohydrated sulfate', 'BD2100_2', [70, 120, 240]], ferric_sulfate: ['Hydroxylated ferric sulfate', 'BD2230', [170, 110, 255]],
  clay_oh: ['Fe/Mg-OH clay', 'BD2290', [255, 140, 120]], clay: ['Fe/Mg clay (smectite)', 'D2300', [220, 60, 60]],
  carbonate: ['Mg carbonate', 'BD2500_2', [200, 230, 40]],
};
const MAPPINGS = {
  gale: { label: 'Gale-type (clay, sulfate, hematite)', geology: 'Geology: hematite, high-Ca pyroxene, olivine + exposed strata',
    params: { life: ['D2300', 'BD2290'], water: ['BD1900R2', 'SINDEX2', 'BD2100_2'], resource: ['SINDEX2', 'BD2100_2', 'BD1900R2'], geology: ['BD860_2', 'BD530_2', 'HCPINDEX2', 'OLINDEX3'],
      _clay: ['D2300', 'BD2290'], _sulfate: ['SINDEX2', 'BD2100_2'], _hematite: ['BD860_2', 'BD530_2'] },
    minerals: { hcp: 2.0, hematite: 2.5, fine_hematite: 2.5, olivine: 2.5, fe_olivine: 3.0, hydrated: 2.5, poly_sulf: 2.5, mono_sulf: 2.5, ferric_sulfate: 3.0, clay_oh: 3.0, clay: 2.5 } },
  jezero: { label: 'Jezero-type (carbonate, clay, olivine)', geology: 'Geology: olivine, high/low-Ca pyroxene + exposed strata',
    params: { life: ['BD2500_2', 'D2300'], water: ['BD1900R2'], resource: ['BD1900R2', 'D2300'], geology: ['OLINDEX3', 'HCPINDEX2', 'LCPINDEX2'],
      _carbonate: ['BD2500_2'], _clay: ['D2300'], _olivine: ['OLINDEX3'] },
    minerals: { hcp: 1.5, lcp: 1.5, olivine: 4.0, hydrated: 3.0, clay: 4.0, carbonate: 4.0 } },
  general: { label: 'General (Gale + Jezero indices)', geology: 'Geology: hematite, pyroxene, olivine + exposed strata',
    params: { life: ['D2300', 'BD2290', 'BD2500_2'], water: ['BD1900R2', 'SINDEX2', 'BD2100_2'], resource: ['SINDEX2', 'BD2100_2', 'BD1900R2', 'D2300'],
      geology: ['BD860_2', 'BD530_2', 'HCPINDEX2', 'LCPINDEX2', 'OLINDEX3'],
      _clay: ['D2300', 'BD2290'], _sulfate: ['SINDEX2', 'BD2100_2'], _hematite: ['BD860_2', 'BD530_2'], _carbonate: ['BD2500_2'], _olivine: ['OLINDEX3'] },
    minerals: { hcp: 2.0, lcp: 2.0, hematite: 3.0, fine_hematite: 3.0, olivine: 3.0, fe_olivine: 3.0, hydrated: 3.0, poly_sulf: 3.0, mono_sulf: 3.0, ferric_sulfate: 3.0, clay_oh: 3.0, clay: 3.0, carbonate: 4.0 } },
};
const FAMILY_NAME = { _clay: 'clay', _sulfate: 'sulfate', _hematite: 'hematite', _carbonate: 'carbonate', _olivine: 'olivine' };
const LOW_CONF = ['ferric_sulfate', 'fine_hematite'];
const WATERISH = ['clay', 'carbonate', 'poly_sulf', 'mono_sulf', 'clay_oh', 'hydrated'];
const MARS_STOPS = [[0.00, [38, 22, 16]], [0.30, [105, 52, 30]], [0.55, [168, 95, 55]], [0.80, [212, 150, 100]], [1.00, [242, 210, 170]]];
const TRAVERSES = [['Curiosity', 'https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_traverse.json'],
                   ['Perseverance', 'https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json']];

let lastPct = 0;
const progress = (pct, msg) => { lastPct = pct; postMessage({ type: 'progress', pct, msg }); };
const log = msg => postMessage({ type: 'log', msg });
const fail = msg => { throw new Error(msg); };

// ---------------------------------------------------------------- map projections (Mars sphere)
const wrap = d => ((d + 540) % 360) - 180;                                     // longitude difference in (-180, 180]
function eqc({ R = R_MARS, latts = 0, lon0 = 0, lat0 = 0, fe = 0, fn = 0 } = {}) {   // equirectangular / equidistant cylindrical
  const k = R * Math.cos(latts * D2R);
  return { kind: 'eqc', R, latts, lon0, lat0, fe, fn,
    fwd: (lon, lat) => [fe + k * wrap(lon - lon0) * D2R, fn + R * (lat - lat0) * D2R],
    inv: (x, y) => [lon0 + (x - fe) / k / D2R, lat0 + (y - fn) / R / D2R] };
}
function geo(R = R_MARS) { return { kind: 'geo', R, fwd: (lon, lat) => [lon, lat], inv: (x, y) => [x, y] }; }
function crsFromGeoKeys(k) {
  const R = k.GeogSemiMajorAxisGeoKey || R_MARS;
  if (k.GTModelTypeGeoKey === 2) return geo(R);
  if (k.GTModelTypeGeoKey !== 1 && !k.ProjCoordTransGeoKey) return geo(R);
  const ct = k.ProjCoordTransGeoKey;
  if (ct && ct !== 17 && ct !== 18) fail(`This GeoTIFF uses map projection code ${ct}. Only equirectangular (simple cylindrical) and plain longitude/latitude grids are supported; re-project it to equirectangular first.`);
  return eqc({ R, latts: k.ProjStdParallel1GeoKey ?? 0, lon0: k.ProjNatOriginLongGeoKey ?? k.ProjCenterLongGeoKey ?? k.ProjFalseOriginLongGeoKey ?? 0,
    lat0: k.ProjNatOriginLatGeoKey ?? k.ProjCenterLatGeoKey ?? 0, fe: k.ProjFalseEastingGeoKey ?? 0, fn: k.ProjFalseNorthingGeoKey ?? 0 });
}

// a GeoTIFF opened for point sampling: pixel coordinates of a lon/lat, and row-band reading
async function openTiff(file, what) {
  // a File / Blob from the user (only the needed parts are read from disk), or a URL read with range requests
  let tiff; try { tiff = typeof file === 'string' || file instanceof String ? await GeoTIFF.fromUrl(String(file)) : await GeoTIFF.fromBlob(file); } catch (e) { fail(`${what}: not a readable GeoTIFF (${e.message})`); }
  const img = await tiff.getImage();
  const keys = img.getGeoKeys() || {};
  let o, r; try { o = img.getOrigin(); r = img.getResolution(); } catch (e) { fail(`${what}: the GeoTIFF has no georeferencing (tie point / pixel size)`); }
  const crs = crsFromGeoKeys(keys), nd = img.getGDALNoData();
  const W = img.getWidth(), H = img.getHeight(), spp = img.getSamplesPerPixel();
  return { img, crs, W, H, spp, nodata: nd, ox: o[0], oy: o[1], rx: r[0], ry: r[1],
    pix(lon, lat) { const [x, y] = crs.fwd(lon, lat); return [(x - o[0]) / r[0] - 0.5, (y - o[1]) / r[1] - 0.5]; },   // fractional (col, row) of pixel centres
    centre() { return crs.inv(o[0] + r[0] * W / 2, o[1] + r[1] * H / 2); },
    metresPerPixel() { return crs.kind === 'geo' ? Math.abs(r[0]) * D2R * crs.R * Math.cos(crs.inv(o[0] + r[0] * W / 2, o[1] + r[1] * H / 2)[1] * D2R) : Math.abs(r[0]); } };
}
// bilinear sampling of a separable grid of points (rows depend on latitude only, columns on longitude only).
// srcRow[i], srcCol[j] = fractional source pixel; reads the source a few rows at a time. Returns Float32Array per band.
async function sampleGrid(t, srcRow, srcCol, bands, onRow, bad) {
  const nR = srcRow.length, nC = srcCol.length, out = bands.map(() => new Float32Array(nR * nC).fill(NaN));
  let c0 = Infinity, c1 = -Infinity; for (const c of srcCol) { c0 = Math.min(c0, Math.floor(c)); c1 = Math.max(c1, Math.floor(c) + 1); }
  c0 = Math.max(0, c0); c1 = Math.min(t.W - 1, c1); if (c1 < c0) return out;
  const cw = c1 - c0 + 1;
  // group output rows into bands of source rows (about 16 MB per read)
  const order = [...srcRow.keys()].filter(i => srcRow[i] > -1 && srcRow[i] < t.H).sort((a, b) => srcRow[a] - srcRow[b]);
  const rowsPerRead = Math.max(2, Math.floor(4e6 / (cw * bands.length)));
  let k = 0;
  while (k < order.length) {
    const rA = Math.max(0, Math.floor(srcRow[order[k]]));
    let k2 = k; while (k2 < order.length && Math.floor(srcRow[order[k2]]) + 1 < rA + rowsPerRead) k2++;
    const rB = Math.min(t.H - 1, Math.max(rA + 1, Math.floor(srcRow[order[k2 - 1]]) + 1));
    const ras = await t.img.readRasters({ window: [c0, rA, c1 + 1, rB + 1], samples: bands, interleave: false });
    const w = cw;
    for (let q = k; q < k2; q++) {
      const i = order[q], fr = srcRow[i], r0 = Math.max(rA, Math.floor(fr)), r1 = Math.min(rB, r0 + 1), wy = Math.min(1, Math.max(0, fr - r0));
      for (let j = 0; j < nC; j++) {
        const fc = srcCol[j]; if (fc < -1 || fc > t.W) continue;
        const q0 = Math.max(c0, Math.floor(fc)), q1 = Math.min(c1, q0 + 1), wx = Math.min(1, Math.max(0, fc - q0));
        for (let b = 0; b < bands.length; b++) {
          const a = ras[b], v00 = a[(r0 - rA) * w + q0 - c0], v01 = a[(r0 - rA) * w + q1 - c0], v10 = a[(r1 - rA) * w + q0 - c0], v11 = a[(r1 - rA) * w + q1 - c0];
          let s = 0, ws = 0;
          const add = (v, ww) => { if (ww > 0 && !bad(v)) { s += v * ww; ws += ww; } };
          add(v00, (1 - wx) * (1 - wy)); add(v01, wx * (1 - wy)); add(v10, (1 - wx) * wy); add(v11, wx * wy);
          if (ws > 0.25) out[b][i * nC + j] = s / ws;
        }
      }
      if (onRow) onRow(q - 0 + 1, order.length);
    }
    k = k2;
  }
  return out;
}

// ---------------------------------------------------------------- the area: a square of N x 16 m around a centre
function makeArea(lonc, latc, N) {
  const S = N * CELL, k = R_MARS * Math.cos(latc * D2R);
  const lonAt = x => lonc + (x - S / 2) / k / D2R, latAt = y => latc - (y - S / 2) / R_MARS / D2R;
  const xy = (lon, lat) => [S / 2 + wrap(lon - lonc) * D2R * k, S / 2 - (lat - latc) * D2R * R_MARS];
  return { N, S, lonc, latc, lonAt, latAt, xy, lonlat: [lonAt(0), latAt(S), lonAt(S), latAt(0)].map(v => +v.toFixed(5)) };
}

// ---------------------------------------------------------------- small numeric helpers (numpy / scipy equivalents)
function percentile(a, ps) {
  const v = []; for (const x of a) if (Number.isFinite(x)) v.push(x);
  if (!v.length) return ps.map(() => NaN);
  v.sort((x, y) => x - y);
  return ps.map(p => { const pos = (v.length - 1) * p / 100, lo = Math.floor(pos), hi = Math.ceil(pos); return v[lo] + (v[hi] - v[lo]) * (pos - lo); });
}
function norm(a) {                                   // science.py norm(): 2nd-98th percentile -> 0..1 (NaN stays NaN)
  const [lo, hi] = percentile(a, [2, 98]), out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Number.isFinite(a[i]) ? Math.min(1, Math.max(0, (a[i] - lo) / (hi - lo + 1e-12))) : NaN;
  return out;
}
function gaussian(a, N, sigma) {                     // scipy gaussian_filter, truncate 4, mode 'reflect'
  const r = Math.max(1, Math.floor(4 * sigma + 0.5)), w = [];
  let s = 0; for (let i = -r; i <= r; i++) { const v = Math.exp(-0.5 * i * i / (sigma * sigma)); w.push(v); s += v; }
  for (let i = 0; i < w.length; i++) w[i] /= s;
  const refl = i => (i < 0 ? -i - 1 : i >= N ? 2 * N - i - 1 : i);
  const tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let k = -r; k <= r; k++) v += w[k + r] * a[y * N + refl(x + k)]; tmp[y * N + x] = v; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = 0; for (let k = -r; k <= r; k++) v += w[k + r] * tmp[refl(y + k) * N + x]; out[y * N + x] = v; }
  return out;
}
function nanGaussian(a, N, sigma) {
  const m = new Float32Array(N * N), z = new Float32Array(N * N);
  for (let i = 0; i < a.length; i++) { const ok = Number.isFinite(a[i]); m[i] = ok ? 1 : 0; z[i] = ok ? a[i] : 0; }
  const num = gaussian(z, N, sigma), den = gaussian(m, N, sigma), out = new Float32Array(N * N);
  for (let i = 0; i < a.length; i++) out[i] = m[i] ? num[i] / Math.max(den[i], 1e-6) : NaN;
  return out;
}
function rankFilter(a, N, k, useMax) {               // scipy maximum_filter / minimum_filter, square window k (odd), mode 'reflect'
  const h = k >> 1, refl = i => (i < 0 ? -i - 1 : i >= N ? 2 * N - i - 1 : i), tmp = new Float32Array(N * N), out = new Float32Array(N * N);
  const pick = useMax ? Math.max : Math.min;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = a[y * N + x]; for (let d = -h; d <= h; d++) v = pick(v, a[y * N + refl(x + d)]); tmp[y * N + x] = v; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let v = tmp[y * N + x]; for (let d = -h; d <= h; d++) v = pick(v, tmp[refl(y + d) * N + x]); out[y * N + x] = v; }
  return out;
}
function gradientSlope(z, N, cell) {                 // np.gradient + arctan(hypot) in degrees
  const s = new Float32Array(N * N);
  const g = (i, j, di, dj) => { const a = Math.max(0, Math.min(N - 1, i - di)), b = Math.max(0, Math.min(N - 1, i + di)), c = Math.max(0, Math.min(N - 1, j - dj)), d = Math.max(0, Math.min(N - 1, j + dj));
    return (z[b * N + d] - z[a * N + c]) / (((b - a) + (d - c)) * cell); };
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) s[i * N + j] = Math.atan(Math.hypot(g(i, j, 1, 0), g(i, j, 0, 1))) / D2R;
  return s;
}
function edt(seed, N) {                              // Euclidean distance (cells) to the nearest seed cell (Felzenszwalb & Huttenlocher)
  const INF = 1e20, f = new Float64Array(N * N);
  for (let i = 0; i < N * N; i++) f[i] = seed[i] ? 0 : INF;
  const d1 = (g, n) => { const d = new Float64Array(n), v = new Int32Array(n), zz = new Float64Array(n + 1); let k = 0; v[0] = 0; zz[0] = -INF; zz[1] = INF;
    for (let q = 1; q < n; q++) { let s; do { const p = v[k]; s = ((g[q] + q * q) - (g[p] + p * p)) / (2 * q - 2 * p); if (s <= zz[k]) k--; else break; } while (k >= 0); k++; v[k] = q; zz[k] = s; zz[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + g[v[k]]; } return d; };
  const col = new Float64Array(N);
  for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) col[y] = f[y * N + x]; const d = d1(col, N); for (let y = 0; y < N; y++) f[y * N + x] = d[y]; }
  const row = new Float64Array(N), out = new Float32Array(N * N);
  for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) row[x] = f[y * N + x]; const d = d1(row, N); for (let x = 0; x < N; x++) out[y * N + x] = Math.sqrt(d[x]); }
  return out;
}
// skimage MCP_Geometric: cost of a step = distance x (cost of both cells) / 2, 8 neighbours. Returns accumulated cost from one cell.
function mcpGeometric(cost, N, cell, start) {
  const acc = new Float64Array(N * N).fill(Infinity), heapI = new Int32Array(N * N * 8 + 16), heapV = new Float64Array(N * N * 8 + 16); let n = 0;
  const push = (i, v) => { let k = n++; while (k > 0) { const p = (k - 1) >> 1; if (heapV[p] <= v) break; heapI[k] = heapI[p]; heapV[k] = heapV[p]; k = p; } heapI[k] = i; heapV[k] = v; };
  const pop = () => { const i = heapI[0], v = heapV[0], li = heapI[--n], lv = heapV[n]; let k = 0;
    while (true) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && heapV[c + 1] < heapV[c]) c++; if (heapV[c] >= lv) break; heapI[k] = heapI[c]; heapV[k] = heapV[c]; k = c; }
    heapI[k] = li; heapV[k] = lv; return [i, v]; };
  const NB = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  acc[start] = 0; push(start, 0);
  while (n) {
    const [i, v] = pop(); if (v > acc[i]) continue;
    const y = (i / N) | 0, x = i - y * N, ci = cost[i];
    for (const [dy, dx] of NB) {
      const yy = y + dy, xx = x + dx; if (yy < 0 || yy >= N || xx < 0 || xx >= N) continue;
      const j = yy * N + xx, cj = cost[j]; if (!Number.isFinite(cj)) continue;
      const nv = v + (dy && dx ? Math.SQRT2 : 1) * cell * (ci + cj) / 2;
      if (nv < acc[j]) { acc[j] = nv; push(j, nv); }
    }
  }
  return acc;
}
// science.py walk_model: walking speed + O2 per horizontal metre (Tobler x suit factor, Pandolf at Mars gravity, 20.1 kJ/L O2)
function walkModel(slopeDeg, body = 75, suit = 60, speedFactor = 0.6, eta = 1.2) {
  const g = Math.tan(slopeDeg * D2R), v = Math.max(0.05, 6.0 * Math.exp(-3.5 * Math.abs(g + 0.05)) / 3.6 * speedFactor), W = body, L = suit;
  const m = 1.5 * W + 2.0 * (W + L) * (L / W) ** 2 + eta * (W + L) * (1.5 * v * v + 0.35 * v * Math.max(100 * g, 0));
  const watts = 1.5 * W + (m - 1.5 * W) * (G_MARS / 9.81), t = (1 / Math.cos(slopeDeg * D2R)) / v;
  return [t, watts * t / 20100.0 * 1.429e-3];
}
function components(mask, N) {                       // 8-connected components -> arrays of cell indices
  const lab = new Int32Array(N * N), out = []; let id = 0; const st = [];
  for (let s = 0; s < N * N; s++) {
    if (!mask[s] || lab[s]) continue;
    id++; const cells = []; st.push(s); lab[s] = id;
    while (st.length) { const i = st.pop(); cells.push(i); const y = (i / N) | 0, x = i - y * N;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy < 0 || yy >= N || xx < 0 || xx >= N) continue; const j = yy * N + xx; if (mask[j] && !lab[j]) { lab[j] = id; st.push(j); } } }
    out.push(cells);
  }
  return out;
}
const marsLUT = (() => { const lut = new Uint8ClampedArray(256 * 3); for (let i = 0; i < 256; i++) { const x = i / 255; let s = 1; while (s < MARS_STOPS.length - 1 && MARS_STOPS[s][0] < x) s++;
  const [t0, c0] = MARS_STOPS[s - 1], [t1, c1] = MARS_STOPS[s], f = (x - t0) / (t1 - t0); for (let c = 0; c < 3; c++) lut[i * 3 + c] = Math.round(c0[c] + (c1[c] - c0[c]) * f); } return lut; })();

// ---------------------------------------------------------------- ENVI (CRISM MTRDR .img + .hdr)
function parseEnviHeader(text) {
  const h = {}; const re = /^\s*([^=\n]+?)\s*=\s*(\{[\s\S]*?\}|[^\n]*)/gm; let m;
  while ((m = re.exec(text))) h[m[1].trim().toLowerCase()] = m[2].trim();
  const list = s => (s || '').replace(/^\{|\}$/g, '').split(',').map(x => x.trim()).filter(Boolean);
  const num = k => Number(h[k]);
  const out = { samples: num('samples'), lines: num('lines'), bands: num('bands'), offset: num('header offset') || 0, dtype: num('data type'),
    interleave: (h.interleave || 'bsq').toLowerCase(), bigEndian: num('byte order') === 1, ignore: h['data ignore value'] != null ? Number(h['data ignore value']) : 65535,
    bandNames: list(h['band names']).map(s => s.toUpperCase()) };
  const mi = list(h['map info']);
  if (mi.length < 7) fail('CRISM header has no "map info" (the file must be map-projected, e.g. an MTRDR product)');
  out.refx = Number(mi[1]); out.refy = Number(mi[2]); out.e0 = Number(mi[3]); out.n0 = Number(mi[4]); out.dx = Number(mi[5]); out.dy = Number(mi[6]);
  const wkt = h['coordinate system string'] || '', P = name => { const r = new RegExp(`PARAMETER\\["${name}",\\s*([-\\d.eE+]+)`, 'i').exec(wkt); return r ? Number(r[1]) : undefined; };
  const sph = /SPHEROID\["[^"]*",\s*([-\d.eE+]+)/i.exec(wkt), pi = list(h['projection info']);
  const R = sph ? Number(sph[1]) : (pi[0] === '17' ? Number(pi[1]) : R_MARS);
  if (!/PROJCS/i.test(wkt) && pi[0] !== '17' && /geographic|lat\/lon/i.test(mi[0])) out.crs = geo(R);
  else out.crs = eqc({ R, latts: P('Standard_Parallel_1') ?? (pi[0] === '17' ? Number(pi[2]) : 0), lon0: P('Central_Meridian') ?? (pi[0] === '17' ? Number(pi[3]) : 0),
    fe: P('False_Easting') ?? 0, fn: P('False_Northing') ?? 0 });
  if (out.dtype !== 4) fail(`CRISM data type ${out.dtype} is not supported (expected 4 = float32)`);
  return out;
}
async function readEnviBand(file, h, b) {             // one band as Float32Array [lines x samples]
  const n = h.samples * h.lines, out = new Float32Array(n);
  const conv = buf => { const dv = new DataView(buf), a = new Float32Array(buf.byteLength / 4); for (let i = 0; i < a.length; i++) a[i] = dv.getFloat32(i * 4, !h.bigEndian); return a; };
  if (h.interleave === 'bsq') { const off = h.offset + b * n * 4; return conv(await file.slice(off, off + n * 4).arrayBuffer()); }
  const rowBytes = h.samples * 4;
  for (let r = 0; r < h.lines; r++) {
    if (h.interleave === 'bil') { const off = h.offset + (r * h.bands + b) * rowBytes; out.set(conv(await file.slice(off, off + rowBytes).arrayBuffer()), r * h.samples); }
    else { const off = h.offset + r * h.bands * rowBytes, row = conv(await file.slice(off, off + h.bands * rowBytes).arrayBuffer()); for (let c = 0; c < h.samples; c++) out[r * h.samples + c] = row[c * h.bands + b]; }
  }
  return out;
}
function sampleEnvi(band, h, area, N) {               // bilinear at the area's cell centres (NaN = no data)
  const out = new Float32Array(N * N).fill(NaN), bad = v => !Number.isFinite(v) || v === h.ignore || v > 1e3 || v < -1e3;
  for (let i = 0; i < N; i++) {
    const lat = area.latAt((i + 0.5) * CELL);
    for (let j = 0; j < N; j++) {
      const [x, y] = h.crs.fwd(area.lonAt((j + 0.5) * CELL), lat);
      const fc = (x - h.e0) / h.dx + (h.refx - 1) - 0.5, fr = (h.n0 - y) / h.dy + (h.refy - 1) - 0.5;
      if (fc < -0.5 || fr < -0.5 || fc > h.samples - 0.5 || fr > h.lines - 0.5) continue;
      const c0 = Math.max(0, Math.floor(fc)), r0 = Math.max(0, Math.floor(fr)), c1 = Math.min(h.samples - 1, c0 + 1), r1 = Math.min(h.lines - 1, r0 + 1), wx = Math.max(0, fc - c0), wy = Math.max(0, fr - r0);
      let s = 0, ws = 0; const add = (v, w) => { if (w > 0 && !bad(v)) { s += v * w; ws += w; } };
      add(band[r0 * h.samples + c0], (1 - wx) * (1 - wy)); add(band[r0 * h.samples + c1], wx * (1 - wy)); add(band[r1 * h.samples + c0], (1 - wx) * wy); add(band[r1 * h.samples + c1], wx * wy);
      if (ws > 0.25) out[i * N + j] = s / ws;
    }
  }
  return out;
}
function robustZ(a) {                                 // (value - median) / (1.4826 x MAD), over this observation's cells in the area
  const [med] = percentile(a, [50]); const dev = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) dev[i] = Number.isFinite(a[i]) ? Math.abs(a[i] - med) : NaN;
  const [mad] = percentile(dev, [50]), s = 1.4826 * mad + 1e-9, out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = Number.isFinite(a[i]) ? (a[i] - med) / s : NaN;
  return out;
}

// ---------------------------------------------------------------- traverse (GeoJSON / CSV) -> lon, lat lists
function parseTraverse(text) {
  const lon = [], lat = [];
  try {
    const gj = JSON.parse(text), feats = gj.features || [gj];
    for (const f of feats) { const g = f.geometry || f; let cs = g.coordinates; if (!cs) continue;
      if (g.type === 'Point') cs = [cs]; else if (g.type === 'MultiLineString' || g.type === 'Polygon') cs = cs.flat(); else if (g.type === 'MultiPolygon') cs = cs.flat(2);
      for (const c of cs) { lon.push(c[0] > 180 ? c[0] - 360 : c[0]); lat.push(c[1]); } }
    return { lon, lat };
  } catch (e) { /* CSV */ }
  const rows = text.split(/\r?\n/).filter(Boolean), head = rows[0].toLowerCase().split(',').map(s => s.trim());
  const ci = names => head.findIndex(h => names.some(n => h === n || h.endsWith(n)));
  const kl = ci(['planetocentric_longitude', 'longitude', 'lon']), kb = ci(['planetocentric_latitude', 'latitude', 'lat']);
  if (kl < 0 || kb < 0) fail('Traverse CSV needs longitude and latitude columns');
  for (const r of rows.slice(1)) { const c = r.split(','); const a = Number(c[kl]), b = Number(c[kb]); if (Number.isFinite(a) && Number.isFinite(b)) { lon.push(a > 180 ? a - 360 : a); lat.push(b); } }
  return { lon, lat };
}

// ---------------------------------------------------------------- the build
async function build(inp) {
  const notes = [], sources = {};
  const MAP = MAPPINGS[inp.mapping] || MAPPINGS.general, CRISM_PARAMS = MAP.params;
  const MINERALS = Object.entries(MAP.minerals).map(([k, thr]) => [k, MIN_DEF[k][0], MIN_DEF[k][1], thr, MIN_DEF[k][2]]);
  // ---- 1. DEM
  progress(1, 'Reading the DEM header');
  const dem = await openTiff(inp.dem, 'DEM');
  const mpp = dem.metresPerPixel(), extentM = Math.min(dem.W, dem.H) * mpp;
  let [lonc, latc] = inp.centre ? [inp.centre.lon, inp.centre.lat] : dem.centre();
  const sizeM = Math.min(N_MAX * CELL, (inp.sizeKm || 10) * 1000, extentM * 0.98);
  const N = Math.floor(sizeM / CELL);
  if (N < 64) fail(`The DEM covers only ${Math.round(extentM)} m: at least about 1 km is needed`);
  const area = makeArea(lonc, latc, N);
  log(`DEM ${dem.W} x ${dem.H} px, ${mpp.toFixed(2)} m/px, ${dem.crs.kind === 'geo' ? 'longitude/latitude' : 'equirectangular'} | area ${(area.S / 1000).toFixed(2)} km square around ${latc.toFixed(4)}, ${lonc.toFixed(4)} -> ${N} x ${N} cells of ${CELL} m`);
  const srcRow = new Float32Array(N), srcCol = new Float32Array(N);
  for (let i = 0; i < N; i++) srcRow[i] = dem.pix(lonc, area.latAt((i + 0.5) * CELL))[1];
  for (let j = 0; j < N; j++) srcCol[j] = dem.pix(area.lonAt((j + 0.5) * CELL), latc)[0];
  const nd = dem.nodata, badZ = v => !Number.isFinite(v) || v < -1e5 || v > 1e5 || (nd != null && v === nd);
  progress(3, 'Reading heights');
  const [z] = await sampleGrid(dem, srcRow, srcCol, [0], (k, n) => { if (k % 16 === 0) progress(3 + 22 * k / n, `Reading heights (${Math.round(100 * k / n)}%)`); }, badZ);
  let miss = 0; for (const v of z) if (!Number.isFinite(v)) miss++;
  const cov = 1 - miss / z.length;
  if (cov < 0.8) fail(`The DEM covers only ${Math.round(cov * 100)}% of the chosen area. Pick a centre inside the DEM or a smaller area.`);
  if (miss) { fillNearest(z, N); notes.push(`DEM gaps (${(100 - cov * 100).toFixed(1)}% of the area) filled from the nearest heights.`); }
  let zmin = Infinity, zmax = -Infinity; for (const v of z) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); }
  sources.dem = { file: inp.dem.name, coverage: +cov.toFixed(3), pixel_m: +mpp.toFixed(3) };

  // ---- 2. slopes, habitat
  const slope = gradientSlope(z, N, CELL);
  let hab;
  if (inp.habitat) {
    const [x, y] = area.xy(inp.habitat.lon, inp.habitat.lat);
    hab = [Math.min(N - 1, Math.max(0, Math.round(y / CELL - 0.5))), Math.min(N - 1, Math.max(0, Math.round(x / CELL - 0.5)))];
    if (x < 0 || y < 0 || x > area.S || y > area.S) fail('The habitat position is outside the chosen area');
  } else {                                            // the flattest spot (7 x 7 mean slope) in the middle 60% of the area, a little towards the centre
    const m = gaussian(slope, N, 2), lo = Math.floor(N * 0.2), hi = Math.ceil(N * 0.8); let best = Infinity;
    for (let i = lo; i < hi; i++) for (let j = lo; j < hi; j++) { const s = m[i * N + j] + 0.0015 * Math.hypot(i - N / 2, j - N / 2); if (slope[i * N + j] < 8 && s < best) { best = s; hab = [i, j]; } }
    if (!hab) hab = [N >> 1, N >> 1];
    notes.push('Habitat placed automatically on the flattest ground in the middle of the area.');
  }
  const habLon = area.lonAt((hab[1] + 0.5) * CELL), habLat = area.latAt((hab[0] + 0.5) * CELL);
  log(`Habitat at ${habLat.toFixed(5)}, ${habLon.toFixed(5)} (slope ${slope[hab[0] * N + hab[1]].toFixed(1)} deg)`);

  // ---- 3. map image
  progress(26, 'Making the map image');
  const tex = await makeTexture(inp, area, z, N, notes);
  sources.image = tex.source;

  // ---- 4. CRISM
  const layers = {}, minLayers = {}, crismUsed = [];
  let crismCover = 0;
  const pairs = pairCrism(inp.crism || []);
  if (pairs.length) {
    progress(52, 'Reading CRISM observations');
    const obs = [];
    for (const p of pairs) { try { const h = parseEnviHeader(await p.hdr.text()); obs.push({ ...p, h }); } catch (e) { notes.push(`CRISM ${p.img.name} skipped: ${e.message}`); } }
    const wanted = new Set([...Object.values(CRISM_PARAMS).flat(), ...MINERALS.map(m => m[2])]);
    const zMos = {}, rawMos = {}, covMask = new Uint8Array(N * N);
    let done = 0; const total = obs.length * wanted.size;
    for (const o of obs) {
      let used = false;
      for (const name of wanted) {
        const b = o.h.bandNames.indexOf(name); done++;
        if (b < 0) continue;
        progress(52 + 18 * done / total, `CRISM ${o.img.name.slice(0, 11)} · ${name}`);
        const raw = sampleEnvi(await readEnviBand(o.img, o.h, b), o.h, area, N);
        let cnt = 0; for (const v of raw) if (Number.isFinite(v)) cnt++;
        if (cnt < 100) continue;
        used = true;
        const zz = robustZ(raw);
        zMos[name] = zMos[name] || new Float32Array(N * N).fill(NaN); rawMos[name] = rawMos[name] || new Float32Array(N * N).fill(NaN);
        for (let i = 0; i < zz.length; i++) if (!Number.isFinite(zMos[name][i]) && Number.isFinite(zz[i])) { zMos[name][i] = zz[i]; rawMos[name][i] = raw[i]; covMask[i] = 1; }
      }
      if (used) crismUsed.push(o.img.name);
    }
    for (const v of covMask) crismCover += v; crismCover /= N * N;
    if (crismUsed.length) {
      const sm = {}; for (const [k, a] of Object.entries(zMos)) sm[k] = nanGaussian(a, N, 9.0 / CELL);   // CRISM 18 m pixel noise
      for (const [crit, params] of Object.entries(CRISM_PARAMS)) {
        const have = params.filter(p => sm[p]); if (!have.length) continue;
        const out = new Float32Array(N * N).fill(NaN);
        for (let i = 0; i < N * N; i++) { let best = NaN; for (const p of have) { const v = sm[p][i]; if (Number.isFinite(v)) { const s = Math.min(1, Math.max(0, v / SC.z_full)); best = Number.isFinite(best) ? Math.max(best, s) : s; } } out[i] = best; }
        layers[crit] = out;
      }
      for (const [key, label, idx, thr, color] of MINERALS) if (sm[idx]) minLayers[key] = { label, idx, thr, color, z: sm[idx], raw: rawMos[idx] };
      sources.crism = { files: crismUsed, params: CRISM_PARAMS, mapping: MAP.label, normalize: 'robust z per observation', z_full: SC.z_full, coverage: +crismCover.toFixed(3) };
      log(`CRISM: ${crismUsed.length} observation(s), ${(crismCover * 100).toFixed(1)}% of the area covered`);
    } else notes.push('No CRISM observation overlaps the chosen area: no mineral layer and no Habitability / Water criteria.');
  }

  // ---- 5. THEMIS thermal inertia (firm ground for Resources)
  let ti = null;
  if (inp.themis) {
    progress(71, 'Reading THEMIS thermal inertia');
    try {
      const t = await openTiff(inp.themis, 'THEMIS');
      const r = new Float32Array(N), c = new Float32Array(N);
      for (let i = 0; i < N; i++) r[i] = t.pix(lonc, area.latAt((i + 0.5) * CELL))[1];
      for (let j = 0; j < N; j++) c[j] = t.pix(area.lonAt((j + 0.5) * CELL), latc)[0];
      [ti] = await sampleGrid(t, r, c, [0], null, v => !Number.isFinite(v) || v <= 0 || v > 5000);
      sources.themis = { file: inp.themis.name, note: '100 m/px, broad trend only' };
    } catch (e) { notes.push(`THEMIS skipped: ${e.message}`); ti = null; }
  }

  // ---- 6. rover traverse (novelty)
  progress(73, 'Rover traverse');
  let trav = null, rover = null;
  if (inp.traverse) { try { trav = parseTraverse(await inp.traverse.text()); rover = inp.roverName || 'rover'; sources.traverse = { file: inp.traverse.name }; } catch (e) { notes.push(`Traverse skipped: ${e.message}`); } }
  else if (inp.autoTraverse) {
    for (const [name, url] of TRAVERSES) {
      try {
        const t = parseTraverse(await (await fetch(url)).text());
        const inside = t.lon.some((lo, k) => { const [x, y] = area.xy(lo, t.lat[k]); return x > -2000 && y > -2000 && x < area.S + 2000 && y < area.S + 2000; });
        if (inside) { trav = t; rover = name; sources.traverse = { file: url, source: 'NASA MMGIS' }; break; }
      } catch (e) { notes.push(`${name} traverse could not be downloaded (${e.message})`); }
    }
    if (!trav) notes.push('No Curiosity or Perseverance traverse passes near this area: no Novelty criterion.');
  }
  if (trav) {
    const seed = new Uint8Array(N * N); let inside = 0;
    for (let k = 0; k < trav.lon.length; k++) {
      const [x0, y0] = area.xy(trav.lon[k], trav.lat[k]), nxt = k + 1 < trav.lon.length ? area.xy(trav.lon[k + 1], trav.lat[k + 1]) : [x0, y0];
      const steps = Math.max(1, Math.ceil(Math.hypot(nxt[0] - x0, nxt[1] - y0) / (CELL / 2)));
      if (Math.hypot(nxt[0] - x0, nxt[1] - y0) > 2000) continue;          // gap between separate drives
      for (let s = 0; s <= steps; s++) { const x = x0 + (nxt[0] - x0) * s / steps, y = y0 + (nxt[1] - y0) * s / steps, c = Math.floor(x / CELL), r = Math.floor(y / CELL);
        if (r >= 0 && r < N && c >= 0 && c < N) { seed[r * N + c] = 1; inside = 1; } }
    }
    if (inside) { const d = edt(seed, N); layers.novelty = d.map(v => Math.min(1, v * CELL / SC.novelty_full_m)); sources.traverse.inside_area = true; }
    else notes.push(`The ${rover} traverse does not enter the chosen area: no Novelty criterion.`);
  }

  // ---- 7. criteria (science.py)
  progress(76, 'Science value');
  const k = Math.max(3, Math.floor(2 * SC.relief_m / CELL) | 1);
  const relief = new Float32Array(N * N), mx = rankFilter(z, N, k, true), mn = rankFilter(z, N, k, false);
  for (let i = 0; i < N * N; i++) relief[i] = mx[i] - mn[i];
  const rel = norm(relief);
  if (layers.geology) { const m = layers.geology; layers.geology = rel.map((r, i) => (Number.isFinite(m[i]) ? m[i] : 0) / 2 + r / 2); }
  else layers.geology = rel;
  const resSrc = layers.resource || layers.water;
  if (resSrc) {
    let firm;
    if (ti) firm = norm(ti);
    else { const ns = norm(slope); firm = ns.map(v => 1 - v); notes.push('No THEMIS thermal inertia: Resources uses flat ground (low slope) as the firm-ground term instead.'); }
    layers.resource = resSrc.map((v, i) => (Number.isFinite(v) && Number.isFinite(firm[i]) ? v * firm[i] : NaN));
  }
  const fam = Object.keys(layers).filter(c => c.startsWith('_'));
  // the site tables (Gale / Jezero) use their families as science.py does; General keeps only families strong on >= 0.01% of the area
  const famAvail = MAP === MAPPINGS.general ? fam.filter(c => { let k = 0; for (const v of layers[c]) if (v >= SC.high) k++; return k >= 0.0001 * N * N; }) : fam;
  const base = famAvail.length >= 2 ? famAvail : ['life', 'water', 'geology', 'resource'].filter(c => layers[c]);
  if (base.length >= 2) {
    const kk = Math.max(3, Math.floor(2 * 100 / CELL) | 1), cnt = new Float32Array(N * N);
    for (const c of base) { const strong = layers[c].map(v => (v >= SC.high ? 1 : 0)), d = rankFilter(strong, N, kk, true); for (let i = 0; i < N * N; i++) cnt[i] += d[i]; }
    layers.diversity = cnt.map(v => v / base.length);
  }
  for (const c of fam) delete layers[c];
  const crits = ORDER.filter(c => layers[c]);

  // ---- 8. reach (round-trip O2 from the habitat, walking)
  progress(84, 'Reach from the habitat');
  const o2pm = new Float32Array(N * N), tpm = new Float32Array(N * N);
  let blocked = 0;
  for (let i = 0; i < N * N; i++) {
    const s = slope[i];
    if (!Number.isFinite(s) || s > WALK.max_slope) { o2pm[i] = tpm[i] = Infinity; blocked++; continue; }
    const [tu, ou] = walkModel(s), [td, od] = walkModel(-s); o2pm[i] = ou + od; tpm[i] = tu + td;
  }
  const h0 = hab[0] * N + hab[1];
  if (!Number.isFinite(o2pm[h0])) { const [t, o] = walkModel(2); o2pm[h0] = 2 * o; tpm[h0] = 2 * t; notes.push('The habitat cell was steeper than the walking limit and was opened for the reach map.'); }
  const o2rt = mcpGeometric(o2pm, N, CELL, h0), trt = mcpGeometric(tpm, N, CELL, h0);
  const limit = SC.o2_capacity_kg * SC.reserve, R = new Float32Array(N * N); let reachable = 0;
  for (let i = 0; i < N * N; i++) {
    const th = trt[i] / 3600 + SC.stop_min / 60;
    R[i] = !Number.isFinite(o2rt[i]) || o2rt[i] > limit || th > SC.max_eva_h ? 0 : Math.min(1, Math.max(0, 1 - 0.5 * o2rt[i] / limit));
    if (R[i] > 0) reachable++;
  }
  log(`Reach: ${(100 * reachable / (N * N)).toFixed(0)}% of the area within ${limit.toFixed(2)} kg O2 round trip and ${SC.max_eva_h} h`);

  // ---- 9. minerals.png + minerals.json
  progress(88, 'Mineral layer');
  let minJson = null, minPng = null, dest = [];
  if (Object.keys(minLayers).length) {
    const rgba = new Uint8ClampedArray(N * N * 4), minArea = Math.ceil(2000 / (CELL * CELL)), covered = Math.max(1, Math.round(crismCover * N * N));
    const mins = {};
    for (const [key, m] of Object.entries(minLayers)) {
      const mask = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) mask[i] = m.z[i] >= m.thr ? 1 : 0;
      const comps = components(mask, N).filter(c => c.length >= minArea);
      let det = 0; const cands = [];
      for (const c of comps) {
        det += c.length; let pk = -Infinity, pi = c[0];
        for (const i of c) { if (m.raw[i] > pk) { pk = m.raw[i]; pi = i; } rgba.set([...m.color, 255], i * 4); }
        const r = (pi / N) | 0, cc = pi - r * N;
        cands.push({ x: +((cc + 0.5) * CELL).toFixed(1), y: +((r + 0.5) * CELL).toFixed(1), lon: +area.lonAt((cc + 0.5) * CELL).toFixed(5), lat: +area.latAt((r + 0.5) * CELL).toFixed(5), area_m2: c.length * CELL * CELL, peak_index: +pk.toFixed(4) });
      }
      cands.sort((a, b) => b.area_m2 * b.peak_index - a.area_m2 * a.peak_index);
      mins[key] = { label: m.label, index: m.idx, threshold: m.thr, threshold_type: 'robust_z', color: m.color, area_pct_of_covered: +(100 * det / covered).toFixed(2), candidates: cands.slice(0, 3) };
    }
    minJson = { source: crismUsed, coverage_pct: +(crismCover * 100).toFixed(1), minerals: mins, low_confidence: LOW_CONF.filter(k => mins[k]),
      grid: { cell_m: CELL, width: N, height: N, area_lonlat: area.lonlat, units: "x east, y south (m) from the area's north-west corner" } };
    const cv = new OffscreenCanvas(N, N); cv.getContext('2d').putImageData(new ImageData(rgba, N, N), 0, 0);
    minPng = await cv.convertToBlob({ type: 'image/png' });
    // destinations for the fallback route: the best patch of the two strongest water-related minerals (as for Gale / Jezero)
    const pickK = WATERISH.filter(k => mins[k] && mins[k].candidates.length).sort((a, b) => (mins[b].candidates[0].area_m2 * mins[b].candidates[0].peak_index) - (mins[a].candidates[0].area_m2 * mins[a].candidates[0].peak_index)).slice(0, 2);
    dest = pickK.map(k => { const c = mins[k].candidates[0], short = { clay: 'Clay', carbonate: 'Carbonate', poly_sulf: 'PolySulf', mono_sulf: 'MonoSulf', clay_oh: 'ClayOH', hydrated: 'Hydrated' }[k];
      return { name: `${short}-1`, kind: k, label: mins[k].label, index: mins[k].index, peak_index: c.peak_index, area_m2: c.area_m2, x: c.x, y: c.y, lon: c.lon, lat: c.lat }; });
  }

  // ---- 10. science.json + bins
  progress(92, 'Writing the site files');
  const toU8 = a => { const u = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) u[i] = Number.isFinite(a[i]) ? Math.min(254, Math.max(0, Math.round(a[i] * 254))) : 255; return u; };
  const sciBin = new Uint8Array(crits.length * N * N); crits.forEach((c, q) => sciBin.set(toU8(layers[c]), q * N * N));
  const reachBin = toU8(R);
  const famList = base.map(c => FAMILY_NAME[c] || c).join(', ');
  const LABELS = {
    life: 'Habitability / biosignature potential', water: 'Water & volatile record',
    geology: layers.life || layers.water ? MAP.geology : 'Geology: exposed strata (relief)',
    resource: 'ISRU resource potential', novelty: `Novelty (distance from the ${rover} traverse, full at 1 km)`,
    diversity: `Sample diversity: ${famList} within 100 m`,
  };
  const science = {
    version: 1, meshW: N, meshH: N, nodata: 255,
    criteria: crits.map(c => ({ key: c, label: LABELS[c], objectives: OBJECTIVES[c] })),
    presets: { balanced: Object.fromEntries(crits.map(c => [c, 1])) }, defaultPreset: 'balanced',
    overlay: { covers_m: [area.S, area.S], note: "covers_m from the area's north-west corner" },
    reach: { mode: 'walk', limit: +limit.toFixed(3), unit: 'kg O2', o2_capacity_kg: SC.o2_capacity_kg, reserve_frac: SC.reserve, max_eva_h: SC.max_eva_h, stop_min: SC.stop_min, calibration: 'none (custom site)' },
    formula: 'V = S x R; S = weighted mean of criterion scores (0-1); R = 1 - 0.5 * roundtrip_O2 / limit, 0 if over limit, blocked or over max EVA time',
    sources,
    notes: ['Criterion scores are normalised within this area (2nd-98th percentile), so they rank sites relative to each other, not on an absolute scale.',
      'Built in the browser from user data with the ARES MISSION custom builder (same rules as the team science.py, on a 16 m grid).', ...notes],
    web: { bins: { 'science.bin': 'Uint8 [criteria x meshH x meshW], 0-254 = score 0-1, 255 = no data', 'reach.bin': 'Uint8 [meshH x meshW], R x 254 (0 = cannot reach)' },
      site_rule: 'a site must score >= 0.6 in every picked objective; ranked by mean(picked scores) x R; sites >= 150 m apart',
      custom_mapping: { name: MAP.label, ...Object.fromEntries(Object.entries(CRISM_PARAMS).map(([k, v]) => [k, v.join(', ')])) } },
  };

  // ---- 11. routes (habitat + two stops; the page plans the real routes from the science objectives)
  const habXY = [(hab[1] + 0.5) * CELL, (hab[0] + 0.5) * CELL];
  let stops = dest.length === 2 ? dest : null;
  if (!stops) {                                      // two reachable places of high value, at least 500 m apart
    const V = new Float32Array(N * N); for (let i = 0; i < N * N; i++) { let s = 0; for (const c of crits) s += Number.isFinite(layers[c][i]) ? layers[c][i] : 0; V[i] = R[i] > 0 ? s / crits.length * R[i] : -1; }
    const pick = []; for (let t = 0; t < 2; t++) { let bi = -1, bv = -Infinity; for (let i = 0; i < N * N; i++) { if (V[i] <= bv) continue; const r = (i / N) | 0, c = i - r * N;
      if (Math.hypot(r - hab[0], c - hab[1]) * CELL < 300 || pick.some(p => Math.hypot(r - p[0], c - p[1]) * CELL < 500)) continue; bv = V[i]; bi = i; }
      if (bi < 0) bi = h0; pick.push([(bi / N) | 0, bi % N]); }
    stops = pick.map((p, q) => ({ name: `Site ${q + 1}`, x: (p[1] + 0.5) * CELL, y: (p[0] + 0.5) * CELL, lon: +area.lonAt((p[1] + 0.5) * CELL).toFixed(5), lat: +area.latAt((p[0] + 0.5) * CELL).toFixed(5) }));
  }
  const zAt = (x, y) => { const c = Math.min(N - 1, Math.max(0, Math.round(x / CELL - 0.5))), r = Math.min(N - 1, Math.max(0, Math.round(y / CELL - 0.5))); return z[r * N + c]; };
  const pts = [[habXY[0], habXY[1]], [stops[0].x, stops[0].y], [stops[1].x, stops[1].y], [habXY[0], habXY[1]]];
  const rows = []; let dist = 0, maxS = 0;
  for (let s = 0; s < 3; s++) { const [ax, ay] = pts[s], [bx, by] = pts[s + 1], L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(L / CELL));
    for (let q = s ? 1 : 0; q <= n; q++) { const x = ax + (bx - ax) * q / n, y = ay + (by - ay) * q / n, zz = zAt(x, y), prev = rows.at(-1);
      const d = prev ? Math.hypot(x - prev[0], y - prev[1]) : 0, sl = prev && d > 0 ? Math.atan2(zz - prev[2], d) / D2R : 0; dist += d; maxS = Math.max(maxS, Math.abs(sl));
      rows.push([+x.toFixed(1), +y.toFixed(1), +zz.toFixed(2), +dist.toFixed(1), +sl.toFixed(1), 0, 0, 0]); } }
  const wps = [{ name: 'Habitat', x: +habXY[0].toFixed(1), y: +habXY[1].toFixed(1), z: +zAt(...habXY).toFixed(2), lon: +habLon.toFixed(5), lat: +habLat.toFixed(5) },
    ...stops.map(s => ({ name: s.name, x: +s.x.toFixed(1), y: +s.y.toFixed(1), z: +zAt(s.x, s.y).toFixed(2), lon: s.lon, lat: s.lat }))];
  const routeFile = mode => ({ columns: ['x', 'y', 'z', 'dist_m', 'slope_deg', 't_min', 'o2_kg', 'rover_wh'], route: rows, straight: rows, waypoints: wps,
    summary: { mode, distance_m: +dist.toFixed(1), time_h: 0, max_slope_deg: +maxS.toFixed(1), blocked_cells: 0, o2_kg: 0, o2_pct_of_capacity: mode === 'walk' ? 0 : null, rover_wh: mode === 'rover' ? 0 : null,
      straight: { distance_m: +dist.toFixed(1), max_slope_deg: +maxS.toFixed(1), blocked_cells: 0 },
      note: 'custom site: straight-line placeholder through the habitat and two stops; the page plans the real route from the science objectives' } });

  // ---- 12. terrain.json (same fields as Gale / Jezero)
  const terrain = {
    source: `User DEM ${inp.dem.name} (${mpp.toFixed(2)} m/px) sampled to a ${N} x ${N} grid of ${CELL} m in the browser`,
    nx: N, ny: N, cell_m: CELL, z_min: +zmin.toFixed(2), z_max: +zmax.toFixed(2), area_lonlat_W_S_E_N: area.lonlat,
    origin: 'x east, y south, metres from the north-west corner of the area; row 0 = north',
    texture: { file: 'texture_color.jpg', source: tex.source, covers_m: [area.S, area.S] },
    walk: { slope_limit_deg: 18.0, o2_capacity_kg: 1.2, body_kg: 75, suit_kg: 60, suit_speed_factor: 0.6 },
    rover: { slope_limit_deg: 28.0, speed_ms: 4.1667, wh_per_km: 250 },
    assumptions_kept_from_demo: { suit_battery_wh: 450, suit_base_w: 60, rover_battery_wh: 40000, rover_cabin_o2_kg: 4, crew: 2, o2_per_person_kg_h: 0.035 },
    destinations: (stops === dest ? dest : []).map(d => ({ name: d.name, kind: d.kind, label: d.label, index: d.index, peak_index: d.peak_index, area_m2: d.area_m2 })),
  };
  if (minJson) terrain.minerals = { file: 'minerals.png', covers_m: [area.S, area.S], source: `MRO CRISM MTRDR summary parameters: ${crismUsed.join(', ')}`,
    classes: Object.fromEntries(Object.entries(minJson.minerals).map(([k, v]) => [k, { label: v.label, index: v.index, color: v.color, area_pct: v.area_pct_of_covered }])) };

  // ---- 13. pack
  progress(97, 'Packing');
  const J = o => new Blob([JSON.stringify(o)], { type: 'application/json' });
  const files = {
    'terrain.json': J(terrain), 'dem.bin': new Blob([z.buffer.slice(0)], { type: 'application/octet-stream' }), 'texture_color.jpg': tex.jpg,
    'route_walk.json': J(routeFile('walk')), 'route_rover.json': J(routeFile('rover')),
    'science.json': J(science), 'science.bin': new Blob([sciBin]), 'reach.bin': new Blob([reachBin]), 'card.jpg': tex.thumb,
  };
  if (minJson) { files['minerals.json'] = J(minJson); files['minerals.png'] = minPng; }
  const meta = {
    name: inp.name || 'Custom site', created: new Date().toISOString(), rover,
    centre: [+latc.toFixed(5), +lonc.toFixed(5)], size_m: area.S, area_lonlat: area.lonlat,
    habitat: { lon: +habLon.toFixed(5), lat: +habLat.toFixed(5), auto: !inp.habitat },
    dem: { file: inp.dem.name, pixel_m: +mpp.toFixed(3), crs: dem.crs.kind }, image: tex.source,
    crism: crismUsed, crism_coverage: +(crismCover * 100).toFixed(1), mapping: MAP.label, themis: !!ti, traverse: rover,
    criteria: crits, minerals: minJson ? Object.keys(minJson.minerals).filter(k => minJson.minerals[k].area_pct_of_covered > 0) : [],
    reach_pct: +(100 * reachable / (N * N)).toFixed(1), blocked_pct: +(100 * blocked / (N * N)).toFixed(1), notes,
  };
  progress(100, 'Done');
  return { meta, files };
}

function fillNearest(z, N) {                         // fill NaN holes from the nearest valid cell (repeated 8-neighbour averaging)
  let left = true, guard = 0;
  while (left && guard++ < 4 * N) {
    left = false; const nz = z.slice();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const k = i * N + j; if (Number.isFinite(z[k])) continue;
      let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const y = i + dy, x = j + dx; if (y < 0 || y >= N || x < 0 || x >= N) continue; const v = z[y * N + x]; if (Number.isFinite(v)) { s += v; n++; } }
      if (n) nz[k] = s / n; else left = true; }
    z.set(nz);
  }
}
function pairCrism(files) {                          // .img + .hdr with the same base name (order kept = mosaic priority)
  const by = {}; for (const f of files) { const m = /^(.*)\.(img|hdr)$/i.exec(f.name); if (m) { by[m[1].toLowerCase()] = by[m[1].toLowerCase()] || {}; by[m[1].toLowerCase()][m[2].toLowerCase()] = f; } }
  return Object.values(by).filter(p => p.img && p.hdr);
}
async function makeTexture(inp, area, z, N, notes) {
  const cv = new OffscreenCanvas(TEX, TEX), ctx = cv.getContext('2d'), px = new Uint8ClampedArray(TEX * TEX * 4);
  let source;
  const f = inp.image;
  if (f && /\.(tif|tiff)$/i.test(f.name)) {
    const t = await openTiff(f, 'Map image'), bands = t.spp >= 3 ? [0, 1, 2] : [0], step = area.S / TEX;
    const r = new Float32Array(TEX), c = new Float32Array(TEX);
    for (let i = 0; i < TEX; i++) r[i] = t.pix(area.lonc, area.latAt((i + 0.5) * step))[1];
    for (let j = 0; j < TEX; j++) c[j] = t.pix(area.lonAt((j + 0.5) * step), area.latc)[0];
    const ndv = t.nodata;
    const out = await sampleGrid(t, r, c, bands, (k, n) => { if (k % 64 === 0) progress(26 + 24 * k / n, `Map image (${Math.round(100 * k / n)}%)`); }, v => !Number.isFinite(v) || (ndv != null && v === ndv) || v < -1e30);
    const lo = [], hi = []; for (const a of out) { const sub = a.filter((_, i) => i % 7 === 0); const [p1, p99] = percentile(sub, [0.5, 99.5]); lo.push(p1); hi.push(p99); }
    let gaps = 0;
    for (let i = 0; i < TEX * TEX; i++) {
      const v = out.map((a, b) => Math.round(255 * Math.min(1, Math.max(0, (a[i] - lo[b]) / (hi[b] - lo[b] + 1e-9)))));
      if (!Number.isFinite(out[0][i])) gaps++;
      if (bands.length === 1) { const g = Number.isFinite(out[0][i]) ? v[0] : 60; px[i * 4] = marsLUT[g * 3]; px[i * 4 + 1] = marsLUT[g * 3 + 1]; px[i * 4 + 2] = marsLUT[g * 3 + 2]; }
      else { px[i * 4] = v[0]; px[i * 4 + 1] = v[1]; px[i * 4 + 2] = v[2]; }
      px[i * 4 + 3] = 255;
    }
    if (gaps / (TEX * TEX) > 0.02) notes.push(`The map image does not cover ${(100 * gaps / (TEX * TEX)).toFixed(0)}% of the area.`);
    ctx.putImageData(new ImageData(px, TEX, TEX), 0, 0);
    source = bands.length === 1 ? `${f.name}, greyscale: tinted to a Mars colour for display, the colour is not measured` : `${f.name} (colour as supplied)`;
  } else if (f) {                                    // a plain picture: assumed to show exactly the chosen square
    const bmp = await createImageBitmap(f);
    ctx.drawImage(bmp, 0, 0, TEX, TEX);
    source = `${f.name}, a plain picture assumed to show exactly the chosen area (not georeferenced)`;
  } else {                                           // no picture: shaded relief of the DEM, tinted to a Mars colour
    progress(30, 'Shaded relief from the DEM');
    const sz = 2048, s = new OffscreenCanvas(sz, sz), sx = s.getContext('2d'), p = new Uint8ClampedArray(sz * sz * 4), k = (N - 1) / (sz - 1);
    const zAt = (y, x) => { const fy = y * k, fx = x * k, y0 = Math.floor(fy), x0 = Math.floor(fx), y1 = Math.min(N - 1, y0 + 1), x1 = Math.min(N - 1, x0 + 1), wy = fy - y0, wx = fx - x0;
      return z[y0 * N + x0] * (1 - wx) * (1 - wy) + z[y0 * N + x1] * wx * (1 - wy) + z[y1 * N + x0] * (1 - wx) * wy + z[y1 * N + x1] * wx * wy; };
    let zl = Infinity, zh = -Infinity; for (const v of z) { zl = Math.min(zl, v); zh = Math.max(zh, v); }
    const cm = CELL * k, az = 315 * D2R, alt = 45 * D2R;
    for (let y = 0; y < sz; y++) for (let x = 0; x < sz; x++) {
      const dzdx = (zAt(y, Math.min(sz - 1, x + 1)) - zAt(y, Math.max(0, x - 1))) / (2 * cm), dzdy = (zAt(Math.min(sz - 1, y + 1), x) - zAt(Math.max(0, y - 1), x)) / (2 * cm);
      const slp = Math.atan(Math.hypot(dzdx, dzdy)), asp = Math.atan2(dzdy, -dzdx);
      const sh = Math.max(0, Math.cos(alt) * Math.cos(slp) + Math.sin(alt) * Math.sin(slp) * Math.cos(az - asp - Math.PI / 2));
      const e = (zAt(y, x) - zl) / (zh - zl + 1e-9), g = Math.round(255 * Math.min(1, 0.15 + 0.65 * sh + 0.2 * e)), q = (y * sz + x) * 4;
      p[q] = marsLUT[g * 3]; p[q + 1] = marsLUT[g * 3 + 1]; p[q + 2] = marsLUT[g * 3 + 2]; p[q + 3] = 255;
    }
    sx.putImageData(new ImageData(p, sz, sz), 0, 0); ctx.drawImage(s, 0, 0, TEX, TEX);
    source = 'no image supplied: shaded relief of the DEM, tinted to a Mars colour (not a photo)';
  }
  const jpg = await cv.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
  const th = new OffscreenCanvas(640, 640); th.getContext('2d').drawImage(cv, 0, 0, 640, 640);
  const thumb = await th.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
  return { jpg, thumb, source };
}

const nameOf = f => (typeof f === 'string' ? decodeURIComponent(f.split('/').pop()) : f.name);
onmessage = async ev => {
  for (const k of ['dem', 'image', 'themis']) if (typeof ev.data[k] === 'string') ev.data[k] = Object.assign(new String(ev.data[k]), { name: nameOf(ev.data[k]) });
  try { const out = await build(ev.data); postMessage({ type: 'done', ...out }); }
  catch (e) { postMessage({ type: 'error', msg: e.message || String(e), pct: lastPct }); }
};
