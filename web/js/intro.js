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
  const whenSiteReady = () => new Promise(res => {   // wait for the 3D app (it starts loading at the pick), but never longer than 60 s
    if (window.__siteReady || skipped) return res();
    const done = () => { removeEventListener('site-ready', done); res(); };
    addEventListener('site-ready', done); setTimeout(done, 60000); waiters.push(done);
  });

  // hand-over: the logo and title keep their look and simply shrink while they move onto the top-bar brand
  // (one transform each, same timing), then cross-fade into the real brand. The 3D camera starts its fly-in at the same moment.
  const DOCK_MS = 1150, EASE = 'cubic-bezier(.65,0,.25,1)';
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
    const rL = logo.getBoundingClientRect(), rT = title.getBoundingClientRect(), csT = getComputedStyle(title);
    const tL = brandLogo.getBoundingClientRect(), tN = brandName.getBoundingClientRect(), csB = getComputedStyle(brandName);
    // freeze both exactly where they are, with no transform (so the move below is a single transform from here)
    Object.assign(logo.style, { transition: 'none', transformOrigin: '0 0', transform: 'none', left: rL.left + 'px', top: rL.top + 'px', width: rL.width + 'px', height: rL.height + 'px', opacity: 1 });
    Object.assign(title.style, { transition: 'none', transformOrigin: '0 50%', transform: 'none', left: rT.left + 'px', top: rT.top + 'px', fontSize: csT.fontSize, letterSpacing: csT.letterSpacing });
    intro.classList.add('dock');
    void logo.offsetWidth;                                            // commit the frozen state
    const k = tL.width / rL.width;                                    // logo: shrink to the brand logo, top-left corner onto its corner
    const s = parseFloat(csB.fontSize) / parseFloat(csT.fontSize);    // title: letters shrink to the brand's size, left edge and middle line onto the brand name
    const dx = tN.left - rT.left, dy = (tN.top + tN.height / 2) - (rT.top + rT.height / 2);
    const lsTo = (parseFloat(csB.letterSpacing) / s) + 'px';          // letter spacing eases to the brand's (in the unscaled title's units)
    const tr = p => `${p} ${DOCK_MS}ms ${EASE}`;
    logo.style.transition = `${tr('transform')}, filter ${DOCK_MS}ms ease, opacity .25s ease`;
    title.style.transition = `${tr('transform')}, ${tr('letter-spacing')}, opacity .25s ease`;
    Object.assign(logo.style, { transform: `translate(${tL.left - rL.left}px, ${tL.top - rL.top}px) scale(${k})`, filter: 'drop-shadow(0 0 0 rgba(55,224,255,0))' });
    Object.assign(title.style, { transform: `translate(${dx}px, ${dy}px) scale(${s})`, letterSpacing: lsTo });
    body.classList.remove('intro-pending');                           // top bar and panels fade in while the logo flies
    window.__introDone = true; window.dispatchEvent(new Event('intro-done'));
    const land = reduce ? 0 : DOCK_MS - 200;
    setTimeout(() => {                                                // nearly there: the real brand appears underneath, the flying copy fades
      body.classList.remove('brand-hidden'); logo.style.opacity = title.style.opacity = 0;
    }, land);
    setTimeout(() => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); intro.remove(); }, land + 300);
  }

  // landing-site choice: logo + title move up, two cards appear; the picked site's data is then loaded by the app.
  // From here on a click or key no longer skips: a site has to be picked (Enter / Space = the focused card, else Gale).
  // Hovering a card starts downloading that site's map image, so it is ready sooner.
  function prefetch(card) {
    if (card.dataset.pre || !card.dataset.tex) return; card.dataset.pre = '1';
    const im = new Image(); im.crossOrigin = 'anonymous'; im.src = card.dataset.tex;
  }
  // resolves when the element's running CSS transitions have really ended (the page may be busy loading a site,
  // which starts them late), but never later than `max` ms (a hidden tab may not run them at all)
  const settled = (el, max = 2500) => Promise.race([
    Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, max)),
  ]);
  function chooseSite() {
    return new Promise(res => {
      removeEventListener('keydown', skipNow); intro.removeEventListener('pointerdown', skipNow);
      intro.removeAttribute('aria-hidden'); intro.classList.add('select');
      document.getElementById('introSkip').textContent = 'Choose a landing site';
      const cards = [...intro.querySelectorAll('.siteCard:not(.soon)')], soon = intro.querySelector('.siteCard.soon');
      const gale = cards.find(c => c.dataset.site === 'gale') || cards[0];
      const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(cards.includes(document.activeElement) ? document.activeElement : gale); } };
      const onClick = e => pick(e.currentTarget);
      cards.forEach(c => { c.addEventListener('click', onClick); c.addEventListener('pointerenter', () => prefetch(c)); });
      function pick(card) {
        removeEventListener('keydown', onKey); cards.forEach(c => c.removeEventListener('click', onClick));
        prefetch(card);
        window.__site = card.dataset.site; window.dispatchEvent(new CustomEvent('site-chosen', { detail: card.dataset.site }));   // the app starts loading this site
        const r = card.getBoundingClientRect();
        card.style.setProperty('--toCentre', (innerWidth / 2 - (r.left + r.width / 2)) + 'px');   // slide to the middle of the screen

        if (!window.__siteReady) {                                     // still loading: say so under the map
          document.getElementById('introSkip').textContent = 'Loading terrain…'; intro.classList.add('wait');
          addEventListener('site-ready', () => intro.classList.remove('wait'), { once: true });
        }
        card.classList.add('picked'); intro.classList.add('picked'); card.blur();
        settled(card).then(() => intro.classList.add('open'));         // arrived in the centre: frame and text go, the map brightens
        res({ card, t: performance.now() });
      }
      addEventListener('keydown', onKey);
      if (soon) soon.addEventListener('click', () => { soon.classList.remove('nudge'); void soon.offsetWidth; soon.classList.add('nudge'); });
      setTimeout(() => { if (!intro.classList.contains('picked')) gale.focus({ preventScroll: true }); }, reduce ? 0 : 900);
    });
  }

  // hand-over: the 3D view puts the real map exactly where the picked card is (seen from straight above, north up);
  // when the intro fades, that map grows and turns into the 3D start view (the camera fly in index.html, on 'intro-done')
  // The 3D view answers with a picture of what it now shows there (detail.snap): it is laid over the card's map and fades in
  // while the map brightens, so at the end the card already looks exactly like the 3D map under it.
  function handOver(card) {
    const m = card.querySelector('.map') || card, r = m.getBoundingClientRect();   // the map itself (inside the 1 px border)
    const detail = { x: r.left, y: r.top, w: r.width, h: r.height };
    window.dispatchEvent(new CustomEvent('site-pick', { detail }));
    if (!detail.snap) return;
    const s = document.createElement('span'); s.className = 'snap'; s.style.backgroundImage = `url(${detail.snap})`;
    s.style.filter = getComputedStyle(m).filter;                       // start exactly as bright as the map is right now
    m.after(s); void s.offsetWidth; s.style.filter = ''; card.classList.add('snapped');
  }

  async function run() {
    intro.classList.add('on');
    if (reduce) { textEl.textContent = TEXT; intro.classList.add('logo', 'lift'); await sleep(900); await chooseSite(); skipped = false; await whenSiteReady(); intro.classList.add('reveal', 'handed'); return dock(); }
    await sleep(350);  intro.classList.add('logo');                    // 1. logo appears in the centre, route line draws itself
    await sleep(2100); intro.classList.add('lift');                    // 2. logo slides left and shrinks, cursor starts blinking to its right
    await sleep(950);
    for (let i = 1; i <= TEXT.length && !skipped; i++) {               // 3. type the title to the right of the logo (grows to the right)
      textEl.textContent = TEXT.slice(0, i);
      await sleep(i === 1 ? 180 : 80 + Math.random() * 60);
    }
    textEl.textContent = TEXT;
    await sleep(700);
    const { card, t } = await chooseSite();                            // 4. title moves up, pick a landing site:
                                                                       //    it slides to the centre, the other fades, only its map stays
    skipped = false; await whenSiteReady();                            // 5. the 3D map must be loaded for the hand-over
    await sleep(Math.max(0, 820 - (performance.now() - t)));           //    (the card first slides to the centre as it is)
    await settled(card);                                               //    measure it only once it has really arrived
    handOver(card);                                                    // 6. the real 3D map is put exactly under the card's map, seen from above;
                                                                       //    while the card brightens it blends into a picture of that 3D map
    await sleep(Math.max(0, 2000 - (performance.now() - t)));
    const m = card.querySelector('.map'), sn = card.querySelector('.snap');   // ...and the brightening / blend has really finished
    await Promise.all([m && settled(m), sn && settled(sn)]);
    // 7. the card now shows exactly what the 3D view shows under it. Open a window in the dark background where the card is,
    //    so the card can go without any change on screen, THEN fade the background: the square card edge and the real
    //    (slightly uneven, relief + perspective) edge of the 3D map are never on screen together
    const r = m.getBoundingClientRect(), hole = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, `
      + `${r.left}px ${r.top}px, ${r.right}px ${r.top}px, ${r.right}px ${r.bottom}px, ${r.left}px ${r.bottom}px, ${r.left}px ${r.top}px)`;
    for (const id of ['introBg', 'introStars']) document.getElementById(id).style.clipPath = hole;
    intro.classList.add('handed'); await sleep(380);                   //    the card (identical to the 3D map under it) goes away
    intro.classList.add('reveal'); await sleep(650);                   //    the dark background and stars fade: the whole 3D map shows
    dock();                                                            // 8. the map grows, tilts and turns into the start view; the logo docks
  }

  intro.addEventListener('pointerdown', skipNow); addEventListener('keydown', skipNow);
  run();
})();
