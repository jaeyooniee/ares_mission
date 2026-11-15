// ARES MISSION intro: a small Mars globe above the site carousel. It turns to the site of the card in the centre and a pin
// drops on that spot. Plain script, canvas 2D (no WebGL: the 3D app behind the intro already owns one context).
// Texture: NASA/JPL/USGS Viking MDIM 2.1 colour mosaic (public domain), equirectangular, -180..180 E left to right.
// Use: MarsGlobe.mount(el); MarsGlobe.focus(lat, lonEast, 'NAME', 'sub line'); MarsGlobe.focus(null) = no pin (slow spin).
(() => {
  'use strict';
  const D2R = Math.PI / 180;
  let cv, cx, lbl, sub, tex = null, TW = 0, TH = 0, N = 0, geo = null, out = null, raf = 0;
  let lat0 = 8, lon0 = 60;                               // view centre now (deg)
  let latT = 8, lonT = 60;                               // view centre wanted
  let pin = null, pinT0 = 0, spin = true, lastT = 0;

  function mount(el) {
    cv = el.querySelector('canvas'); lbl = el.querySelector('.gName'); sub = el.querySelector('.gSub');
    cx = cv.getContext('2d', { willReadFrequently: false });
    size();
    addEventListener('resize', () => { size(); kick(); });
    const im = new Image(); im.decoding = 'async';
    im.onload = () => {
      const c = document.createElement('canvas'); TW = c.width = im.naturalWidth; TH = c.height = im.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0); tex = g.getImageData(0, 0, TW, TH).data; kick();
    };
    im.src = el.dataset.tex;
    kick();
  }
  // per-pixel unit-sphere geometry for the current canvas size (view space: x right, y up, z towards the viewer)
  function size() {
    const css = cv.clientWidth || 260, dpr = Math.min(1.5, devicePixelRatio || 1);
    N = Math.max(80, Math.round(css * dpr)); cv.width = cv.height = N;
    const r = N / 2, xs = [], ys = [], zs = [], idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i + 0.5 - r) / r, y = (r - j - 0.5) / r, q = x * x + y * y;
      if (q < 1) { xs.push(x); ys.push(y); zs.push(Math.sqrt(1 - q)); idx.push(j * N + i); }
    }
    geo = { x: Float32Array.from(xs), y: Float32Array.from(ys), z: Float32Array.from(zs), i: Uint32Array.from(idx) };
    out = cx.createImageData(N, N);
  }
  const wrap = d => ((d + 540) % 360) - 180;

  function draw(now) {
    const o = out.data; o.fill(0);
    if (tex) {
      const sl = Math.sin(lat0 * D2R), clat = Math.cos(lat0 * D2R), L = [-0.45, 0.5, 0.74];        // light from the upper left, in front
      const { x: X, y: Y, z: Z, i: I } = geo, n = I.length;
      for (let k = 0; k < n; k++) {
        const x = X[k], y = Y[k], z = Z[k];
        const yy = y * clat + z * sl, zz = -y * sl + z * clat;                              // tilt so lat0 faces the viewer
        const lat = Math.asin(yy > 1 ? 1 : yy < -1 ? -1 : yy), lon = lon0 * D2R + Math.atan2(x, zz);
        let u = ((lon / (2 * Math.PI) + 0.5) % 1 + 1) % 1, v = 0.5 - lat / Math.PI;
        const ti = ((v * TH | 0) * TW + (u * TW | 0)) * 4;
        const lam = x * L[0] + y * L[1] + z * L[2], s = 0.28 + 0.9 * (lam > 0 ? lam : 0) * (0.55 + 0.45 * z);   // soft day side, dark limb
        const p = I[k] * 4;
        o[p] = tex[ti] * s; o[p + 1] = tex[ti + 1] * s; o[p + 2] = tex[ti + 2] * s; o[p + 3] = 255;
      }
    }
    cx.putImageData(out, 0, 0);
    // rim light: thin cyan atmosphere edge (our UI colour)
    const r = N / 2, g = cx.createRadialGradient(r, r, r * 0.86, r, r, r);
    g.addColorStop(0, 'rgba(55,224,255,0)'); g.addColorStop(1, 'rgba(120,235,255,.35)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(r, r, r - 0.5, 0, 7); cx.fill();
    if (pin) drawPin(now);
  }
  function drawPin(now) {
    const sl = Math.sin(lat0 * D2R), clat = Math.cos(lat0 * D2R);
    const la = pin.lat * D2R, lo = (pin.lon - lon0) * D2R;
    const bx = Math.cos(la) * Math.sin(lo), by = Math.sin(la), bz = Math.cos(la) * Math.cos(lo);   // body -> view (inverse tilt)
    const x = bx, y = by * clat - bz * sl, z = by * sl + bz * clat;
    if (z < 0.05) return;                                                    // on the far side (only while turning)
    const r = N / 2, px = r + x * r, py = r - y * r, k = N / 300;
    const t = Math.min(1, (now - pinT0) / 520), drop = 1 - Math.pow(1 - t, 3);   // the pin drops in with a little ease
    const h = 30 * k, top = py - h * drop - (1 - drop) * 26 * k;
    const a = Math.min(1, t * 2) * Math.min(1, z * 3);
    cx.save(); cx.globalAlpha = a;
    // ground ring, pulsing
    const pr = (6 + 5 * (0.5 + 0.5 * Math.sin(now / 260))) * k;
    cx.strokeStyle = 'rgba(55,224,255,.75)'; cx.lineWidth = 1.6 * k;
    cx.beginPath(); cx.ellipse(px, py, pr, pr * (0.35 + 0.65 * z), 0, 0, 7); cx.stroke();
    // needle + head
    cx.strokeStyle = '#eafaff'; cx.lineWidth = 2 * k; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(px, top); cx.stroke();
    cx.shadowColor = 'rgba(55,224,255,.9)'; cx.shadowBlur = 12 * k;
    cx.fillStyle = '#37e0ff'; cx.beginPath(); cx.arc(px, top, 6.5 * k, 0, 7); cx.fill();
    cx.shadowBlur = 0; cx.fillStyle = '#eafaff'; cx.beginPath(); cx.arc(px - 1.8 * k, top - 1.8 * k, 2 * k, 0, 7); cx.fill();
    cx.restore();
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000); lastT = now;
    if (spin) lonT = wrap(lonT + dt * 6);                                   // no site: a slow turn
    const dl = wrap(lonT - lon0), da = latT - lat0, kk = 1 - Math.pow(0.0015, dt);   // ease (frame-rate independent)
    lon0 = wrap(lon0 + dl * kk); lat0 += da * kk;
    draw(now);
    const moving = spin || Math.abs(dl) > 0.05 || Math.abs(da) > 0.05 || (pin && now - pinT0 < 900) || !tex;
    if (pin && !moving) { kick.pulse(); return; }
    if (moving) { rafAt = now; raf = requestAnimationFrame(frame); }
  }
  // (a frame request that has not run for 0.5 s, e.g. made while the tab was hidden, is replaced instead of waited for)
  let rafAt = 0;
  function kick() {
    if (!cv || (raf && performance.now() - rafAt < 500)) return;
    if (raf) cancelAnimationFrame(raf);
    lastT = 0; rafAt = performance.now(); raf = requestAnimationFrame(frame);
  }
  kick.pulse = () => { clearTimeout(kick.t); kick.t = setTimeout(kick, 60); };   // the pin ring keeps pulsing at ~15 fps when still

  const fmt = (lat, lon) => `${Math.abs(lat).toFixed(2)}°${lat < 0 ? 'S' : 'N'} · ${Math.abs(lon).toFixed(2)}°${lon < 0 ? 'W' : 'E'}`;
  function focus(lat, lon, name, line) {
    if (lbl) lbl.textContent = name || '';
    if (lat == null || lon == null) { pin = null; spin = true; latT = 8; if (sub) sub.textContent = line || ''; kick(); return; }
    spin = false; lonT = lon; latT = Math.max(-40, Math.min(40, lat * 0.85));
    pin = { lat, lon }; pinT0 = performance.now() + 250;                    // drop the pin while the globe is still turning in
    if (sub) sub.textContent = line || fmt(lat, lon);
    kick();
  }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; clearTimeout(kick.t); cv = null; }
  const state = () => ({ lat0: +lat0.toFixed(2), lon0: +lon0.toFixed(2), pin, spin, ready: !!tex, size: N });   // for checks in the console
  window.MarsGlobe = { mount, focus, stop, state };
})();
