// ARES MISSION · the custom landing site lives in this browser only (IndexedDB): { meta, files: { name: Blob } }.
const DB = 'ares-mission-custom', STORE = 'site', KEY = 'current';
// the files every site has (Gale / Jezero use the same names); minerals.* are optional (no CRISM = no mineral layer)
export const REQUIRED = ['terrain.json', 'dem.bin', 'texture_color.jpg', 'route_walk.json', 'route_rover.json', 'science.json', 'science.bin', 'reach.bin'];
export const OPTIONAL = ['minerals.json', 'minerals.png', 'card.jpg'];

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => { const t = db.transaction(STORE, mode), q = fn(t.objectStore(STORE)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
}
export const saveSite = pkg => tx('readwrite', s => s.put(pkg, KEY));
export const loadSite = () => tx('readonly', s => s.get(KEY)).catch(() => null);
export const deleteSite = () => tx('readwrite', s => s.delete(KEY));
export async function siteMeta() { const p = await loadSite(); return p ? p.meta : null; }

// check a set of files (from the builder, a folder or a zip) before it is used as a site
export async function checkFiles(files) {
  const miss = REQUIRED.filter(f => !files[f]);
  if (miss.length) return `Missing file(s): ${miss.join(', ')}`;
  let t, s;
  try { t = JSON.parse(await files['terrain.json'].text()); } catch (e) { return 'terrain.json is not valid JSON'; }
  try { s = JSON.parse(await files['science.json'].text()); } catch (e) { return 'science.json is not valid JSON'; }
  if (!t.nx || !t.cell_m || t.nx !== t.ny) return 'terrain.json: nx, ny (equal) and cell_m are needed';
  if (files['dem.bin'].size !== t.nx * t.ny * 4) return `dem.bin has ${files['dem.bin'].size} bytes, expected ${t.nx * t.ny * 4} (nx x ny float32)`;
  const n = s.meshW * s.meshH;
  if (!s.criteria || files['science.bin'].size !== s.criteria.length * n) return `science.bin size does not match science.json (${s.criteria?.length} criteria x ${s.meshW} x ${s.meshH})`;
  if (files['reach.bin'].size !== n) return 'reach.bin size does not match science.json';
  if (!t.texture || !files[t.texture.file]) return `terrain.json names the image ${t.texture?.file}, which is not in the files`;
  return '';
}
