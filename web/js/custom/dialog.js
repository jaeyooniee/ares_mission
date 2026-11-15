// ARES MISSION · "Custom" landing site dialog: build a site from the user's own data (in a Web Worker),
// or load a ready site package (the 10 files of a Gale / Jezero style site, as a folder or a .zip).
// The result is kept in this browser (IndexedDB) and opened like Gale / Jezero. Nothing is uploaded anywhere.
import { saveSite, loadSite, deleteSite, checkFiles, REQUIRED, OPTIONAL } from './store.js?v=1';

const FFLATE = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';
const CSS = `
#cxBack{position:fixed;inset:0;z-index:2500;background:rgba(2,6,10,.72);display:flex;align-items:center;justify-content:center;padding:16px;
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#e6f4f8;animation:cxIn .25s ease}
@keyframes cxIn{from{opacity:0}to{opacity:1}}
#cx{width:min(680px,100%);max-height:calc(100vh - 32px);overflow:auto;background:rgba(8,18,25,.97);border:1px solid rgba(120,230,255,.35);border-radius:16px;
  box-shadow:0 0 50px rgba(55,224,255,.18);padding:22px 24px 20px}
#cx h2{margin:0 0 4px;font-size:18px;letter-spacing:.06em;font-weight:600}
#cx .lead{margin:0 0 14px;color:#9fbac4;font-size:13px;line-height:1.5}
#cx .x{float:right;background:none;border:0;color:#9fbac4;font-size:22px;line-height:1;cursor:pointer;margin:-4px -6px 0 0}
#cx .x:hover{color:#fff}
#cx .tabs{display:flex;gap:6px;margin:6px 0 14px;border-bottom:1px solid rgba(120,230,255,.18)}
#cx .tabs button{background:none;border:0;border-bottom:2px solid transparent;color:#9fbac4;padding:8px 10px;font-size:13px;cursor:pointer}
#cx .tabs button.on{color:#fff;border-bottom-color:#37e0ff}
#cx .row{display:grid;grid-template-columns:150px 1fr;gap:6px 14px;align-items:start;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.05)}
#cx .row:last-of-type{border-bottom:0}
#cx .lab{font-size:13px;font-weight:600;padding-top:6px}
#cx .lab small{display:block;font-weight:400;color:#8aa6b0;font-size:11px;margin-top:2px}
#cx .req{color:#37e0ff;font-size:10.5px;letter-spacing:.08em;margin-left:4px}
#cx .hint{font-size:11.5px;color:#8aa6b0;margin-top:4px;line-height:1.4}
#cx select{background:rgba(0,0,0,.35);border:1px solid rgba(120,230,255,.25);border-radius:8px;color:#fff;padding:7px 9px;font-size:13px;width:100%}
#cx input[type=text],#cx input[type=number]{background:rgba(0,0,0,.35);border:1px solid rgba(120,230,255,.25);border-radius:8px;color:#fff;padding:7px 9px;font-size:13px;width:100%;box-sizing:border-box}
#cx .pair{display:grid;grid-template-columns:1fr 1fr 90px;gap:8px}
#cx .pair2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#cx .file{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
#cx .file label.pick{background:rgba(55,224,255,.1);border:1px solid rgba(120,230,255,.4);border-radius:8px;padding:6px 11px;font-size:12.5px;cursor:pointer;white-space:nowrap}
#cx .file label.pick:hover{background:rgba(55,224,255,.2)}
#cx .file input{display:none}
#cx .fname{font-size:12px;color:#cfe3ea;word-break:break-all}
#cx .radio{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;padding-top:6px}
#cx .radio label{cursor:pointer}
#cx .go{margin-top:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
#cx .btn{background:#e8f3f7;color:#0b1820;border:0;border-radius:999px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer}
#cx .btn:disabled{opacity:.4;cursor:not-allowed}
#cx .btn.ghost{background:none;color:#cfe3ea;border:1px solid rgba(120,230,255,.35);font-weight:500}
#cx .btn.danger{background:none;color:#ffb4ab;border:1px solid rgba(255,90,77,.5);font-weight:500}
#cx .bar{height:6px;border-radius:3px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:12px}
#cx .bar i{display:block;height:100%;width:0;background:#37e0ff;transition:width .2s}
#cx .status{font-size:12.5px;color:#cfe3ea;margin-top:6px;min-height:18px}
#cx .err{color:#ffb4ab}
#cx details{margin-top:8px;font-size:11.5px;color:#8aa6b0}
#cx details pre{white-space:pre-wrap;margin:6px 0 0;font-family:ui-monospace,Consolas,monospace;font-size:11px;max-height:140px;overflow:auto}
#cx .saved{display:flex;align-items:center;gap:12px;background:rgba(55,224,255,.06);border:1px solid rgba(120,230,255,.2);border-radius:12px;padding:10px 12px;margin-bottom:12px}
#cx .saved img{width:54px;height:54px;border-radius:8px;object-fit:cover;flex:none}
#cx .saved .t{flex:1;font-size:12.5px;color:#9fbac4;line-height:1.45}
#cx .saved .t b{color:#fff;font-size:13.5px}
#cx .sum{font-size:12.5px;line-height:1.6;margin:10px 0 0;padding:10px 12px;border-radius:10px;background:rgba(0,0,0,.25)}
#cx .sum li{margin-left:16px}
@media (max-width:560px){#cx .row{grid-template-columns:1fr}#cx .pair{grid-template-columns:1fr 1fr}}`;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mb = n => (n / 1048576 >= 100 ? (n / 1073741824).toFixed(2) + ' GB' : (n / 1048576).toFixed(1) + ' MB');

function summary(meta) {
  const crit = { life: 'Habitability', water: 'Water', geology: 'Geology', resource: 'Resources', novelty: 'Novelty', diversity: 'Sample diversity' };
  const li = [
    `Area ${(meta.size_m / 1000).toFixed(2)} km square around ${Math.abs(meta.centre[0]).toFixed(4)}°${meta.centre[0] < 0 ? 'S' : 'N'}, ${meta.centre[1].toFixed(4)}°E`,
    `Habitat ${meta.habitat.auto ? '(placed automatically on flat ground)' : ''} at ${meta.habitat.lat}, ${meta.habitat.lon}; ${meta.reach_pct}% of the area reachable on foot`,
    `Map image: ${meta.image}`,
    meta.crism?.length ? `CRISM: ${meta.crism.length} observation(s)${meta.crism_coverage != null ? `, ${meta.crism_coverage}% coverage` : ''}${meta.mapping ? `, ${meta.mapping}` : ''}; minerals found: ${meta.minerals.length ? meta.minerals.join(', ') : 'none above threshold'}` : 'No CRISM data: no mineral layer',
    `Science objectives available: ${meta.criteria.map(c => crit[c] || c).join(', ')}`,
    meta.traverse ? `Novelty from the ${meta.traverse} traverse` : 'No rover traverse in the area: no Novelty',
  ];
  return `<ul class="sum">${li.map(x => `<li>${esc(x)}</li>`).join('')}${(meta.notes || []).map(n => `<li style="color:#8aa6b0">${esc(n)}</li>`).join('')}</ul>`;
}

async function zipBlob(files) {
  const { zipSync } = await import(FFLATE);
  const entries = {}; for (const [k, b] of Object.entries(files)) entries[k] = [new Uint8Array(await b.arrayBuffer()), { level: /\.(jpg|png)$/.test(k) ? 0 : 6 }];
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}
async function unzipFiles(file) {
  const { unzipSync } = await import(FFLATE);
  const all = unzipSync(new Uint8Array(await file.arrayBuffer())), out = {};
  for (const [path, data] of Object.entries(all)) { const name = path.split('/').pop(); if ([...REQUIRED, ...OPTIONAL].includes(name)) out[name] = new Blob([data]); }
  return out;
}
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }

// opens the dialog; resolves { meta, thumbUrl } when a site is ready to open, or null when closed
export function openCustomDialog() {
  if (!document.getElementById('cxStyle')) { const st = document.createElement('style'); st.id = 'cxStyle'; st.textContent = CSS; document.head.appendChild(st); }
  return new Promise(async resolve => {
    const back = document.createElement('div'); back.id = 'cxBack';
    back.innerHTML = `<div id="cx" role="dialog" aria-modal="true" aria-labelledby="cxTitle">
      <button class="x" type="button" aria-label="Close">×</button>
      <h2 id="cxTitle">Custom landing site</h2>
      <p class="lead">Use your own Mars data: the planner builds the same map, routes, EVA view, CRISM minerals and science value as for Gale and Jezero.
        Everything is processed in this browser; nothing is uploaded.</p>
      <div id="cxSaved"></div>
      <div class="tabs"><button type="button" data-t="build" class="on">Build from data</button><button type="button" data-t="pkg">Load a site package</button></div>
      <div data-p="build">
        <div class="row"><div class="lab">Site name</div><div><input type="text" id="cxName" placeholder="Custom site" maxlength="40"></div></div>
        <div class="row"><div class="lab">Elevation (DEM)<span class="req">REQUIRED</span><small>GeoTIFF</small></div><div>
          <div class="file"><label class="pick">Choose file<input type="file" id="cxDem" accept=".tif,.tiff"></label><span class="fname" id="cxDemN">none</span></div>
          <div class="hint">A HiRISE / CTX DTM or any heights in metres, equirectangular or longitude/latitude (large files are fine: only the chosen area is read).</div></div></div>
        <div class="row"><div class="lab">Area<small>up to 10 × 10 km</small></div><div>
          <div class="pair"><input type="number" id="cxLat" step="any" placeholder="centre lat °N"><input type="number" id="cxLon" step="any" placeholder="centre lon °E"><input type="number" id="cxKm" min="1" max="10" step="0.5" value="10" title="size (km)"></div>
          <div class="hint">Leave the centre empty to use the middle of the DEM. Size in km.</div></div></div>
        <div class="row"><div class="lab">Habitat<small>optional</small></div><div>
          <div class="pair2"><input type="number" id="cxHLat" step="any" placeholder="lat °N"><input type="number" id="cxHLon" step="any" placeholder="lon °E"></div>
          <div class="hint">Empty: the flattest ground near the middle of the area.</div></div></div>
        <div class="row"><div class="lab">Map image<small>optional</small></div><div>
          <div class="file"><label class="pick">Choose file<input type="file" id="cxImg" accept=".tif,.tiff,.jpg,.jpeg,.png"></label><span class="fname" id="cxImgN">none: shaded relief of the DEM</span></div>
          <div class="hint">GeoTIFF (HiRISE / CTX orthoimage), or a JPG/PNG that shows exactly the chosen square.</div></div></div>
        <div class="row"><div class="lab">CRISM minerals<small>optional</small></div><div>
          <div class="file"><label class="pick">Choose files<input type="file" id="cxCrism" accept=".img,.hdr" multiple></label><span class="fname" id="cxCrismN">none</span></div>
          <div class="hint">MTRDR summary parameters: each <code>.img</code> with its <code>.hdr</code> (several observations allowed; the first listed wins where they overlap). Adds the mineral layer and the Habitability, Water, Resources and Sample-diversity objectives.</div></div></div>
        <div class="row"><div class="lab">Mineral mapping<small>with CRISM</small></div><div>
          <select id="cxMap"><option value="general">General: Gale + Jezero indices</option><option value="gale">Gale-type: clay, sulfate, hematite</option><option value="jezero">Jezero-type: carbonate, clay, olivine</option></select>
          <div class="hint">Which CRISM indices feed each science objective (the team's Gale / Jezero table). General suits a site of unknown type.</div></div></div>
        <div class="row"><div class="lab">THEMIS<small>optional</small></div><div>
          <div class="file"><label class="pick">Choose file<input type="file" id="cxTi" accept=".tif,.tiff"></label><span class="fname" id="cxTiN">none: flat ground stands in for firm ground</span></div>
          <div class="hint">Thermal inertia GeoTIFF (firm ground for the Resources objective).</div></div></div>
        <div class="row"><div class="lab">Rover traverse<small>for Novelty</small></div><div>
          <div class="radio"><label><input type="radio" name="cxTr" value="auto" checked> Auto (Curiosity / Perseverance, NASA)</label><label><input type="radio" name="cxTr" value="file"> File</label><label><input type="radio" name="cxTr" value="none"> None</label></div>
          <div class="file" id="cxTrF" style="display:none;margin-top:6px"><label class="pick">Choose file<input type="file" id="cxTr" accept=".json,.geojson,.csv"></label><span class="fname" id="cxTrN">none</span><input type="text" id="cxRover" placeholder="rover name" style="width:140px"></div></div></div>
        <div class="go"><button class="btn" type="button" id="cxBuild" disabled>Build site</button><span class="hint" id="cxNeed">Choose a DEM to start.</span></div>
      </div>
      <div data-p="pkg" style="display:none">
        <p class="lead" style="margin-top:0">A site package is the folder of files a Gale / Jezero site uses (<code>terrain.json</code>, <code>dem.bin</code>, <code>texture_color.jpg</code>, <code>route_walk.json</code>, <code>route_rover.json</code>, <code>science.*</code>, <code>reach.bin</code>, and optionally <code>minerals.*</code>), e.g. one downloaded from this dialog.</p>
        <div class="go" style="margin-top:0"><label class="btn ghost" style="display:inline-block">Choose folder<input type="file" id="cxDir" webkitdirectory multiple style="display:none"></label>
          <label class="btn ghost" style="display:inline-block">Choose .zip or files<input type="file" id="cxZip" accept=".zip,.json,.bin,.jpg,.png" multiple style="display:none"></label></div>
      </div>
      <div id="cxRun" style="display:none"><div class="bar"><i id="cxBar"></i></div><div class="status" id="cxStat"></div><details><summary>Details</summary><pre id="cxLog"></pre></details></div>
      <div id="cxDone"></div>
    </div>`;
    document.body.appendChild(back);
    const $ = id => back.querySelector('#' + id), cx = $('cx');
    let worker = null, closed = false;
    const close = val => { if (closed) return; closed = true; if (worker) worker.terminate(); back.remove(); removeEventListener('keydown', onKey); window.__cxOpen = false; resolve(val); };
    const onKey = e => { if (e.key === 'Escape') close(null); };
    addEventListener('keydown', onKey); window.__cxOpen = true;     // while open, the intro ignores Enter / Space (it would pick a card)
    cx.querySelector('.x').onclick = () => close(null);
    back.addEventListener('pointerdown', e => e.stopPropagation());
    back.addEventListener('click', e => { if (e.target === back) close(null); });
    cx.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
      cx.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
      cx.querySelectorAll('[data-p]').forEach(p => p.style.display = p.dataset.p === b.dataset.t ? '' : 'none');
    });

    const opened = async (pkg) => {
      const f = pkg.files, t = f['card.jpg'] || f['texture_color.jpg'];
      close({ meta: pkg.meta, thumbUrl: URL.createObjectURL(t) });
    };
    // a site already saved in this browser
    const showSaved = async () => {
      const pkg = await loadSite(); const box = $('cxSaved');
      if (!pkg) { box.innerHTML = ''; return; }
      const t = pkg.files['card.jpg'] || pkg.files['texture_color.jpg'], url = URL.createObjectURL(t);
      box.innerHTML = `<div class="saved"><img alt="" src="${url}"><div class="t"><b>${esc(pkg.meta.name)}</b><br>Saved in this browser · ${esc(new Date(pkg.meta.created).toLocaleString())}<br>${esc((pkg.meta.criteria || []).length)} science objectives · ${pkg.meta.crism?.length ? 'CRISM minerals' : 'no CRISM'}</div>
        <button class="btn" type="button" data-a="open">Open</button><button class="btn ghost" type="button" data-a="zip">Download .zip</button><button class="btn danger" type="button" data-a="del" title="Delete from this browser">Delete</button></div>`;
      box.querySelector('[data-a=open]').onclick = () => opened(pkg);
      box.querySelector('[data-a=zip]').onclick = async e => { e.target.disabled = true; download(await zipBlob(pkg.files), `${(pkg.meta.name || 'custom-site').replace(/[^\w-]+/g, '_')}.zip`); e.target.disabled = false; };
      box.querySelector('[data-a=del]').onclick = async () => { if (!confirm(`Delete "${pkg.meta.name}" from this browser? This cannot be undone.`)) return; await deleteSite(); showSaved(); };
    };
    showSaved();

    // ---- build from data
    const fileName = (inp, out, empty) => inp.addEventListener('change', () => { const fs = [...inp.files]; $(out).textContent = fs.length ? fs.map(f => `${f.name} (${mb(f.size)})`).join(', ') : empty; check(); });
    fileName($('cxDem'), 'cxDemN', 'none'); fileName($('cxImg'), 'cxImgN', 'none: shaded relief of the DEM'); fileName($('cxCrism'), 'cxCrismN', 'none');
    fileName($('cxTi'), 'cxTiN', 'none: flat ground stands in for firm ground'); fileName($('cxTr'), 'cxTrN', 'none');
    cx.querySelectorAll('input[name=cxTr]').forEach(r => r.onchange = () => { $('cxTrF').style.display = cx.querySelector('input[name=cxTr]:checked').value === 'file' ? 'flex' : 'none'; });
    function check() {
      const dem = $('cxDem').files[0], crism = [...$('cxCrism').files];
      const imgs = crism.filter(f => /\.img$/i.test(f.name)).map(f => f.name.replace(/\.img$/i, '').toLowerCase()), hdrs = crism.filter(f => /\.hdr$/i.test(f.name)).map(f => f.name.replace(/\.hdr$/i, '').toLowerCase());
      const lone = [...imgs.filter(n => !hdrs.includes(n)), ...hdrs.filter(n => !imgs.includes(n))];
      $('cxNeed').textContent = !dem ? 'Choose a DEM to start.' : lone.length ? `CRISM needs both .img and .hdr for: ${lone.join(', ')} (otherwise skipped)` : '';
      $('cxBuild').disabled = !dem;
    }
    const num = id => { const v = $(id).value.trim(); return v === '' ? null : Number(v); };
    $('cxBuild').onclick = () => {
      const lat = num('cxLat'), lon = num('cxLon'), hlat = num('cxHLat'), hlon = num('cxHLon'), tr = cx.querySelector('input[name=cxTr]:checked').value;
      if ((lat == null) !== (lon == null) || (hlat == null) !== (hlon == null)) { $('cxStat').innerHTML = '<span class="err">Give both latitude and longitude (or leave both empty).</span>'; $('cxRun').style.display = ''; return; }
      const inp = {
        name: $('cxName').value.trim() || 'Custom site', dem: $('cxDem').files[0], image: $('cxImg').files[0] || null, crism: [...$('cxCrism').files], themis: $('cxTi').files[0] || null,
        traverse: tr === 'file' ? $('cxTr').files[0] || null : null, roverName: $('cxRover').value.trim() || 'rover', autoTraverse: tr === 'auto',
        mapping: $('cxMap').value, centre: lat == null ? null : { lat, lon }, habitat: hlat == null ? null : { lat: hlat, lon: hlon }, sizeKm: Math.min(10, Math.max(1, num('cxKm') || 10)),
      };
      run(inp);
    };
    function run(inp) {
      $('cxBuild').disabled = true; $('cxRun').style.display = ''; $('cxDone').innerHTML = ''; $('cxLog').textContent = '';
      const t0 = performance.now();
      worker = new Worker(new URL('./worker.js?v=2', import.meta.url), { type: 'module' });
      worker.onmessage = async ev => {
        const m = ev.data;
        if (m.type === 'progress') { $('cxBar').style.width = m.pct + '%'; $('cxStat').textContent = m.msg; }
        else if (m.type === 'log') $('cxLog').textContent += m.msg + '\n';
        else if (m.type === 'error') { $('cxStat').innerHTML = `<span class="err">Could not build the site: ${esc(m.msg)}</span>`; $('cxBuild').disabled = false; worker.terminate(); worker = null; }
        else if (m.type === 'done') {
          worker.terminate(); worker = null;
          const pkg = { meta: m.meta, files: m.files }, bad = await checkFiles(pkg.files);
          if (bad) { $('cxStat').innerHTML = `<span class="err">Built files failed the check: ${esc(bad)}</span>`; $('cxBuild').disabled = false; return; }
          await saveSite(pkg);
          $('cxStat').textContent = `Built in ${((performance.now() - t0) / 1000).toFixed(0)} s and saved in this browser.`;
          finished(pkg);
        }
      };
      worker.onerror = e => { $('cxStat').innerHTML = `<span class="err">The builder stopped: ${esc(e.message || 'unknown error')}</span>`; $('cxBuild').disabled = false; };
      worker.postMessage(inp);
    }
    function finished(pkg) {
      $('cxDone').innerHTML = `${summary(pkg.meta)}<div class="go"><button class="btn" type="button" id="cxOpen">Open ${esc(pkg.meta.name)}</button><button class="btn ghost" type="button" id="cxDl">Download site package (.zip)</button></div>`;
      $('cxOpen').onclick = () => opened(pkg);
      $('cxDl').onclick = async e => { e.target.disabled = true; download(await zipBlob(pkg.files), `${pkg.meta.name.replace(/[^\w-]+/g, '_')}.zip`); e.target.disabled = false; };
      showSaved(); $('cxOpen').focus();
    }

    // ---- load a site package (folder, files or zip)
    const takePackage = async list => {
      $('cxRun').style.display = ''; $('cxBar').style.width = '30%'; $('cxStat').textContent = 'Reading the package…'; $('cxDone').innerHTML = '';
      try {
        let files = {};
        for (const f of list) { if (/\.zip$/i.test(f.name)) Object.assign(files, await unzipFiles(f)); else if ([...REQUIRED, ...OPTIONAL].includes(f.name)) files[f.name] = f; }
        const bad = await checkFiles(files);
        if (bad) { $('cxStat').innerHTML = `<span class="err">Not a site package: ${esc(bad)}</span>`; return; }
        const t = JSON.parse(await files['terrain.json'].text()), s = JSON.parse(await files['science.json'].text());
        let mins = []; if (files['minerals.json']) { try { const m = JSON.parse(await files['minerals.json'].text()); mins = Object.keys(m.minerals || {}); } catch (e) { /* optional */ } }
        const [w, so, e, n] = t.area_lonlat_W_S_E_N || [0, 0, 0, 0], w0 = JSON.parse(await files['route_walk.json'].text()).waypoints?.[0] || {};
        const meta = { name: t.site_name || list[0]?.webkitRelativePath?.split('/')[0] || 'Custom site', created: new Date().toISOString(), rover: (s.sources?.traverse ? 'rover' : null),
          centre: [+(so + n) / 2, +(w + e) / 2], size_m: t.nx * t.cell_m, area_lonlat: t.area_lonlat_W_S_E_N, habitat: { lon: w0.lon, lat: w0.lat, auto: false },
          dem: { file: 'dem.bin (package)' }, image: t.texture?.source || 'package image', crism: s.sources?.crism?.files || [], crism_coverage: s.sources?.crism?.coverage ? +(100 * s.sources.crism.coverage).toFixed(1) : null,
          criteria: s.criteria.map(c => c.key), minerals: mins, traverse: s.sources?.traverse ? 'rover' : null, reach_pct: null, notes: ['Loaded from a site package.'], fromPackage: true, sourceText: t.source };
        const nov = s.criteria.find(c => c.key === 'novelty'); if (nov) { const r = /from the (\w+) traverse/i.exec(nov.label); if (r) meta.rover = meta.traverse = r[1]; }
        const R = new Uint8Array(await files['reach.bin'].arrayBuffer()); let k = 0; for (const v of R) if (v > 0 && v !== 255) k++; meta.reach_pct = +(100 * k / R.length).toFixed(1);
        const pkg = { meta, files }; await saveSite(pkg);
        $('cxBar').style.width = '100%'; $('cxStat').textContent = 'Package checked and saved in this browser.';
        finished(pkg);
      } catch (err) { $('cxStat').innerHTML = `<span class="err">Could not read the package: ${esc(err.message)}</span>`; }
    };
    $('cxDir').onchange = e => takePackage([...e.target.files]);
    $('cxZip').onchange = e => takePackage([...e.target.files]);
    setTimeout(() => (back.querySelector('#cxSaved [data-a=open]') || $('cxDem').closest('.file').querySelector('label')).focus?.(), 50);
  });
}
