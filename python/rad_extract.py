"""Curiosity RAD dose rate at Gale -> web/data/radiation_gale.json (hourly, on the weather timeline's local-time axis).

Source: NASA PDS Planetary Plasma Interactions node, MSL-M-RAD-3-RDR-V1.0 (one ASCII .TXT + .LBL per sol).
Only small byte ranges are read: from each sol's label we take the byte offset of every observation's
TOT_DOSE_E (plastic detector, closest to tissue) and TOT_DOSE_B (silicon) values, then fetch, for each
observation, the bytes from its header (START_OBS_MARS = sol + local mean solar time) to its dose values.

Three real windows (as in the team's data-source notes):
  quiet     sols 543-545   (15-17 Feb 2014, Ls 90: the same season as the clear-season EMARS weather, about 22 sols before it)
  elevated  sols 2646-2648 (Jan 2020, solar minimum)
  sep       sols 1811-1813 (10 Sept 2017 solar energetic particle event)
The page's weather timeline starts at the scenario's first hour (LMST 23:10 of "sol 1") and runs 72 h, so each RAD
window starts at 23:10 on the sol before its first sol. Each hourly value is the mean of the observations within
+-35 min of that time (observations are ~16 min long, about every 17 min), linear in time across any gap.

Usage: python rad_extract.py [out.json]      (needs only the Python standard library)
"""
import json, re, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

BASE = "https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/DATA/"
UA = {"User-Agent": "ares-mission-build/1.0 (rad_extract.py)"}
SCEN = [
    dict(id="quiet", label="Quiet · Feb 2014", dir="SOL_00450_00583", sol0=543,
         note="Galactic cosmic-ray background near solar maximum; RAD sols 543-545 (Ls 90), the same season as the clear-season weather, about 22 sols before its window."),
    dict(id="elevated", label="Elevated · Jan 2020", dir="SOL_02580_02713", sol0=2646,
         note="Background near the 2019-2020 solar minimum, when the Sun's field shields least; RAD sols 2646-2648."),
    dict(id="sep", label="Solar event · Sept 2017", dir="SOL_01773_01869", sol0=1811,
         note="The 10 September 2017 solar energetic particle event as RAD measured it; sols 1811-1813."),
]
LMST0, HOURS = 23 + 10 / 60, 72          # same axis as web/data/weather_gale.json (hours[0].lmst = 23.16)

def get(url, rng=None, tries=4):
    for k in range(tries):
        try:
            h = dict(UA)
            if rng: h["Range"] = f"bytes={rng[0]}-{rng[1]}"
            with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=60) as r:
                return r.read().decode("latin-1")
        except Exception as e:
            if k == tries - 1: raise
    return ""

def sol_files(d):
    html = get(BASE + d + "/")
    best = {}
    for name, sol, ver in re.findall(r'href="(RAD_RDR_\d{4}_\d{3}_\d{2}_\d{2}_(\d{4})_V(\d\d)\.LBL)"', html):
        sol = int(sol)
        if sol not in best or ver > best[sol][1]: best[sol] = (name, ver)
    return {s: n for s, (n, v) in best.items()}

def read_sol(d, lbl_name):
    """[(sol_time_in_sols, dose_e, dose_b)] for every observation of one sol that has dosimetry"""
    lbl = get(BASE + d + "/" + lbl_name)
    txt = BASE + d + "/" + lbl_name.replace(".LBL", ".TXT")
    off = {}
    for obs, kind, o in re.findall(r'\^OBS(\d{3})_(L1_TABLE|TOT_DOSE_E_ELEMENT|TOT_DOSE_B_ELEMENT)\s*=\s*\(\s*"[^"]+"\s*,\s*(\d+)\s*<BYTES>\)', lbl):
        off.setdefault(obs, {})[kind] = int(o)
    jobs = [(obs, o) for obs, o in sorted(off.items()) if "L1_TABLE" in o and "TOT_DOSE_E_ELEMENT" in o]
    def one(j):
        obs, o = j
        a = max(0, o["L1_TABLE"] - 700); b = max(o["TOT_DOSE_E_ELEMENT"], o.get("TOT_DOSE_B_ELEMENT", 0)) + 12
        s = get(txt, (a, b))
        m = re.search(r'START_OBS_MARS="(\d{4}) (\d\d):(\d\d):(\d\d)"', s)
        if not m: return None
        val = lambda p: float(s[p - 1 - a:p - 1 - a + 7].strip() or "nan")    # PDS byte offsets are 1-based, values are 7 bytes
        e = val(o["TOT_DOSE_E_ELEMENT"]); bb = val(o["TOT_DOSE_B_ELEMENT"]) if "TOT_DOSE_B_ELEMENT" in o else float("nan")
        t = int(m[1]) + (int(m[2]) + int(m[3]) / 60 + int(m[4]) / 3600 + 8 / 60) / 24.0   # observation centre (~16 min long)
        return (t, e, bb) if e == e and 0 < e < 1000 else None
    with ThreadPoolExecutor(8) as ex:
        return [r for r in ex.map(one, jobs) if r]

def despike(obs):
    """5-point running median of each detector, so lone spikes go (the RAD documentation says data taken while the
    rover's neutron generator (DAN) fires should be excluded; those show up as single-observation jumps)"""
    obs.sort()
    med = lambda v: sorted(v)[len(v) // 2]
    out = []
    for i, (t, e, b) in enumerate(obs):
        w = obs[max(0, i - 2):i + 3]
        bs = [o[2] for o in w if o[2] == o[2]]
        out.append((t, med([o[1] for o in w]), med(bs) if bs else float("nan")))
    return out

def hourly(obs, t0):
    obs = despike(obs)
    out_e, out_b = [], []
    for h in range(HOURS):
        t = t0 + h / 24.0
        near = [o for o in obs if abs(o[0] - t) <= 35 / 1440]
        if near:
            e = sum(o[1] for o in near) / len(near); bs = [o[2] for o in near if o[2] == o[2]]; b = sum(bs) / len(bs) if bs else None
        else:                                                  # gap: linear in time between the nearest observations
            lo = [o for o in obs if o[0] < t]; hi = [o for o in obs if o[0] > t]
            if lo and hi:
                p, q = lo[-1], hi[0]; f = (t - p[0]) / (q[0] - p[0]); e = p[1] + (q[1] - p[1]) * f; b = None
            else:
                e = (lo[-1] if lo else hi[0])[1]; b = None
        out_e.append(round(e, 3)); out_b.append(round(b, 3) if b is not None else None)
    return out_e, out_b

def main(out):
    res = {"source": "NASA PDS PPI node, MSL-M-RAD-3-RDR-V1.0 (Curiosity Radiation Assessment Detector, Reduced Data Records)",
           "built_by": "python/rad_extract.py (HTTP range reads of the per-sol RDR text files)",
           "unit": "microGray / hour", "detector_e": "plastic (closest to tissue); the page uses dose_e",
           "detector_b": "silicon", "lmst_start": round(LMST0, 2), "hours": HOURS, "scenarios": []}
    for S in SCEN:
        files = sol_files(S["dir"]); sols = [S["sol0"] - 1, S["sol0"], S["sol0"] + 1, S["sol0"] + 2]
        obs = []
        for s in sols:
            if s in files:
                o = read_sol(S["dir"], files[s]); obs += o; print(f"  {S['id']}: sol {s} {len(o)} observations", flush=True)
            else:
                print(f"  {S['id']}: sol {s} has no RDR file", flush=True)
        t0 = (S["sol0"] - 1) + LMST0 / 24
        e, b = hourly(obs, t0)
        res["scenarios"].append({"id": S["id"], "label": S["label"], "note": S["note"], "sol_start": S["sol0"] - 1,
                                 "sols": sols, "n_obs": len(obs), "dose_e": e, "dose_b": b,
                                 "mean_e": round(sum(e) / len(e), 2), "max_e": max(e)})
        print(f"{S['id']}: {len(obs)} obs, dose E mean {sum(e) / len(e):.2f}, min {min(e):.2f}, max {max(e):.2f} uGy/h", flush=True)
    Path(out).write_text(json.dumps(res, indent=1), encoding="utf-8")
    print("written", out)

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else str(Path(__file__).resolve().parent.parent / "web" / "data" / "radiation_gale.json"))
