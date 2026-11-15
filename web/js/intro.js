// ARES MISSION intro screen: logo -> route draws -> logo lifts -> "ARES MISSION" is typed in the centre -> fade into the app.
// Plain script (not a module) so it runs immediately, before the 3D app has finished loading.
// Skip: click / tap / any key.  Disable: add ?intro=0 to the URL.  Reduced-motion users get a short, calm version.
(() => {
  'use strict';
  const intro = document.getElementById('intro');
  if (!intro) { window.__introDone = true; return; }
  if (new URLSearchParams(location.search).get('intro') === '0') { intro.remove(); document.body.classList.remove('brand-hidden'); window.__introDone = true; return; }

  const TEXT = 'ARES MISSION';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const body = document.body, textEl = document.getElementById('introText'), route = document.getElementById('introRoute');
  body.classList.add('intro-pending');
  try { const len = route.getTotalLength(); route.style.strokeDasharray = len; route.style.strokeDashoffset = len; } catch (e) { /* the line just shows fully */ }

  // ---- layout: the finished group "logo + title" is centred; the title is typed to the right of the logo ----
  const title = document.getElementById('introTitle'), ghost = document.getElementById('introGhost');
  ghost.textContent = TEXT;
  function layoutIntro() {
    const vmin = Math.min(innerWidth, innerHeight) / 100, L0 = Math.min(28 * vmin, 210);   // L0 = starting logo size (same as the CSS)
    let fs = Math.max(22, Math.min(5.2 * vmin, 54)), total = 0, Lf = 0, gap = 0, tw = 0;
    for (let pass = 0; pass < 2; pass++) {                                               // shrink the font once if the group would not fit
      title.style.setProperty('--fs', fs + 'px');
      tw = ghost.getBoundingClientRect().width - 0.42 * fs;                              // drop the trailing letter-spacing
      Lf = Math.min(Math.max(fs * 1.9, 40), L0); gap = fs * 0.85; total = Lf + gap + tw;
      if (total <= innerWidth * 0.9) break;
      fs = Math.max(14, fs * innerWidth * 0.9 / total);
    }
    const left = -total / 2;                                                             // left edge of the group, relative to the screen centre
    intro.style.setProperty('--lx', (left + Lf / 2) + 'px');                             // where the logo ends up
    intro.style.setProperty('--ls', (Lf / L0).toFixed(4));                               // how small it gets
    title.style.setProperty('--tx', `calc(50% + ${left + Lf + gap}px)`);                 // where the first letter appears
  }

  // ---- small star field (stops when the intro ends) ----
  const cv = document.getElementById('introStars'), cx = cv.getContext('2d');
  let stars = [], W = 0, H = 0, raf = 0;
  function sizeStars() {
    W = cv.width = innerWidth; H = cv.height = innerHeight;
    stars = Array.from({ length: Math.min(170, Math.round(W * H / 9000)) }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2, p: Math.random() * 6.28 }));
  }
  function tick(t) {
    cx.clearRect(0, 0, W, H); cx.fillStyle = '#cfefff';
    for (const s of stars) { s.x += s.z * 0.1; if (s.x > W) s.x = 0; cx.globalAlpha = (0.22 + 0.55 * Math.abs(Math.sin(t / 1500 + s.p))) * s.z; cx.fillRect(s.x, s.y, s.z * 1.7, s.z * 1.7); }
    raf = requestAnimationFrame(tick);
  }
  const onResize = () => { sizeStars(); layoutIntro(); };
  sizeStars(); layoutIntro(); addEventListener('resize', onResize); if (!reduce) raf = requestAnimationFrame(tick);

  // ---- timeline with skip support ----
  let skipped = false, finished = false, waiters = [];
  const skipNow = () => { skipped = true; const w = waiters; waiters = []; w.forEach(f => f()); };
  const sleep = ms => new Promise(res => {
    if (skipped) return res();
    const t = setTimeout(res, ms); waiters.push(() => { clearTimeout(t); res(); });
  });
  const whenSiteReady = () => new Promise(res => {   // wait for the 3D app, but never longer than 20 s
    if (window.__siteReady || skipped) return res();
    const done = () => { removeEventListener('site-ready', done); res(); };
    addEventListener('site-ready', done); setTimeout(done, 20000); waiters.push(done);
  });

  // hand-over (ported from index2.html): freeze the logo and title where they are, then fly them onto the top-bar brand.
  // The 3D camera starts its fly-in as soon as the logo starts to move.
  function dock() {
    if (finished) return; finished = true;
    removeEventListener('keydown', skipNow); intro.removeEventListener('pointerdown', skipNow);
    const logo = document.getElementById('introLogo'), brandLogo = document.getElementById('brandLogo'), brandName = document.getElementById('brandName');
    if (!brandLogo || !brandName) {                                   // no top bar: plain fade
      intro.classList.add('done'); body.classList.remove('intro-pending', 'brand-hidden');
      window.__introDone = true; window.dispatchEvent(new Event('intro-done'));
      setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); intro.remove(); }, 1400);
      return;
    }
    textEl.textContent = TEXT; route.style.strokeDashoffset = 0;
    const rL = logo.getBoundingClientRect(), rT = textEl.getBoundingClientRect(), fsT = parseFloat(getComputedStyle(title).fontSize);
    const tL = brandLogo.getBoundingClientRect(), tN = brandName.getBoundingClientRect(), cs = getComputedStyle(brandName);
    Object.assign(logo.style, { transition: 'none', transform: 'none', left: rL.left + 'px', top: rL.top + 'px', width: rL.width + 'px', height: rL.height + 'px', opacity: 1 });
    Object.assign(title.style, { transition: 'none', left: rT.left + 'px', top: (rT.top + rT.height / 2) + 'px', fontSize: fsT + 'px' });
    intro.classList.add('dock');
    body.classList.remove('intro-pending');                           // top bar and panels fade in while the logo flies
    window.__introDone = true; window.dispatchEvent(new Event('intro-done'));
    void logo.offsetWidth;                                            // commit the frozen position
    intro.classList.add('fly'); logo.style.transition = title.style.transition = '';
    Object.assign(logo.style, { left: tL.left + 'px', top: tL.top + 'px', width: tL.width + 'px', height: tL.height + 'px', filter: 'drop-shadow(0 0 0 rgba(55,224,255,0))' });
    Object.assign(title.style, { left: tN.left + 'px', top: (tN.top + tN.height / 2) + 'px', fontSize: cs.fontSize, letterSpacing: cs.letterSpacing, textShadow: cs.textShadow });
    setTimeout(() => {                                                // land: show the real brand, remove the intro
      body.classList.remove('brand-hidden'); cancelAnimationFrame(raf); removeEventListener('resize', onResize); intro.remove();
    }, reduce ? 50 : 1250);
  }

  async function run() {
    intro.classList.add('on');
    if (reduce) { textEl.textContent = TEXT; intro.classList.add('logo', 'lift'); await sleep(900); await whenSiteReady(); return dock(); }
    await sleep(350);  intro.classList.add('logo');                    // 1. logo appears in the centre, route line draws itself
    await sleep(2100); intro.classList.add('lift');                    // 2. logo slides left and shrinks, cursor starts blinking to its right
    await sleep(950);
    for (let i = 1; i <= TEXT.length && !skipped; i++) {               // 3. type the title to the right of the logo (grows to the right)
      textEl.textContent = TEXT.slice(0, i);
      await sleep(i === 1 ? 180 : 80 + Math.random() * 60);
    }
    textEl.textContent = TEXT;
    await sleep(1100);                                                 // 4. hold, then fade into the app
    await whenSiteReady();
    dock();
  }

  intro.addEventListener('pointerdown', skipNow); addEventListener('keydown', skipNow);
  run();
})();
