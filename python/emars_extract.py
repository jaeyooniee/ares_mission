"""Weather timeline (3 sols per scenario) at a landing site from the public EMARS v1.0 reanalysis (Penn State Data Commons).

Reads only the few bytes of the 4 GCM grid points around the site from the NetCDF-3 'back_mean' files with HTTP range
requests (the files are 1-2 GB each), and writes the JSON the page reads:
  point {lat, lon, elev_m, ...}, scenarios[] {id, label, mars_year, note, hours[{lmst, sol}], ls[], ts_c[], tair_c[],
  ps_pa[], wind_ms[], wind_dir_deg[], dust_tau[]}
Corrections (as described in the page's Info > Weather & radiation model):
  - the GCM ground (a ~300 km average) differs from the habitat height: pressure moved hydrostatically to the habitat
    height (H = R T / g); dust optical depth scaled with that pressure (well-mixed dust column)
  - wind = the lowest model level (the page applies the 0.65 factor to 2 m itself)
  - the timeline starts at local midnight of the site (local mean solar time from the site's longitude)
Usage: python emars_extract.py SITE [OUT.json]       SITE = gale | jezero | mawrth | meridiani | columbia | melas
       python emars_extract.py all                    (every site, each to its own data folder)
"""
import json, math, struct, sys, os, time, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nc3

BASE = "https://www.datacommons.psu.edu/download/meteorology/greybush/emars-1p0/data/"
R_CO2, G = 191.8, 3.71
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "data")
# habitat of each built-in site: lon, lat (planetocentric, east-positive) and height in that site's DEM (route_walk.json waypoint 0)
SITES = {
    "gale":      (137.40381, -4.73752, -4054.22, "weather_gale.json"),
    "jezero":    (77.45504, 18.44693, -2569.77, "jezero/weather.json"),
    "mawrth":    (-18.47289, 23.03504, -3289.58, "mawrth/weather.json"),
    "meridiani": (-5.48406, -2.02261, -1381.25, "meridiani/weather.json"),
    "columbia":  (175.50186, -14.58121, -1935.01, "columbia/weather.json"),
    "melas":     (-70.2618, -13.25821, -2901.72, "melas/weather.json"),
}
SCEN = [  # id, label, Mars year, file Ls range, start Ls, note
    ("clear", "Clear season", 32, "Ls090-120", 100.0, "Aphelion season, low dust: the usual clear-sky EVA case"),
    ("dusty", "Dusty season", 29, "Ls240-270", 250.0, "Perihelion dust season: higher dust opacity, stronger winds"),
    ("storm", "Global dust storm", 28, "Ls270-300", 275.0, "The 2007 global dust storm (MY28) near its peak"),
]
HOURS = 72

def fetch(url, a, b, tries=6):                    # polite: retry with a growing pause when the server is slow
    for k in range(tries):
        try: return nc3.fetch(url, a, b)
        except Exception:
            if k == tries - 1: raise
            time.sleep(3 * (k + 1))

def cell(lats, lons, LAT, LON):
    """grid row i (and i+1), columns j and j2 around the point (j2 wraps to column 0 past the last longitude), weights"""
    i = next(k for k in range(len(lats) - 1) if min(lats[k], lats[k + 1]) <= LAT <= max(lats[k], lats[k + 1]))
    lon = LON % 360
    j = next((k for k in range(len(lons) - 1) if lons[k] <= lon <= lons[k + 1]), len(lons) - 1)
    j2 = (j + 1) % len(lons); lon2 = lons[j2] + (360 if j2 == 0 else 0)
    return i, j, j2, (LAT - lats[i]) / (lats[i + 1] - lats[i]), (lon - lons[j]) / (lon2 - lons[j])

def extract(site, out=None):
    LON, LAT, ELEV, rel = SITES[site]; out = out or os.path.join(DATA, rel)
    res = {"source": "EMARS v1.0 reanalysis (Greybush et al. 2019), Penn State Data Commons doi:10.18113/D3W375; NASA Ames Mars GCM with TES/MCS assimilation",
           "built_by": "emars_extract.py (HTTP range reads of the back_mean NetCDF-3 files, 4 grid points around the site, bilinear)",
           "site": site, "point": {"lat": LAT, "lon": LON, "elev_m": ELEV}, "scenarios": []}
    # the GCM surface height (static) from an analysis file
    a_url = BASE + "emars_v1.0_anal_mean_MY32_Ls090-120.nc"
    Ha = nc3.Header(fetch(a_url, 0, 131071))
    alats, alons = nc3.read_static(a_url, Ha, "lat"), nc3.read_static(a_url, Ha, "lon")
    phi = nc3.read_static(a_url, Ha, "Surface_geopotential")
    ai, aj, aj2, awy, awx = cell(alats, alons, LAT, LON); nla = len(alons)
    g = lambda r, c: phi[r * nla + c]
    phis = (1 - awy) * ((1 - awx) * g(ai, aj) + awx * g(ai, aj2)) + awy * ((1 - awx) * g(ai + 1, aj) + awx * g(ai + 1, aj2))
    z_gcm = phis / G
    res["point"].update({"phi_s": round(phis, 1), "gcm_ground_m": round(z_gcm, 0), "grid_lat": [alats[ai], alats[ai + 1]], "grid_lon": [alons[aj], alons[aj2]]})
    for sid, label, my, rng, ls0, note in SCEN:
        url = BASE + f"emars_v1.0_back_mean_MY{my}_{rng}.nc"
        H = nc3.Header(fetch(url, 0, 262143))
        lats, lons = nc3.read_static(url, H, "lat"), nc3.read_static(url, H, "lon")
        i, j, j2, wy, wx = cell(lats, lons, LAT, LON); nl = len(lons)
        nrec = H.numrecs
        def scalar(var, r):
            v = H.v(var); fmt, sz = nc3.TYPES[v["type"]]; p = v["begin"] + r * H.recsize
            return struct.unpack(fmt, fetch(url, p, p + sz - 1))[0]
        lo, hi = 0, nrec - 1                             # first record at Ls >= ls0 ...
        while lo < hi:
            mid = (lo + hi) // 2
            if scalar("Ls", mid) < ls0: lo = mid + 1
            else: hi = mid
        r0 = lo
        for _ in range(30):                              # ... whose local time at the site is near midnight
            lmst = (scalar("mars_hour", r0) + LON / 15) % 24
            if lmst < 1 or lmst > 23: break
            r0 += 1
        recs = list(range(r0, min(nrec, r0 + HOURS)))
        levels = H.v("t")["shape"][1]; low = levels - 1
        def four(var, r, base):                          # rows i and i+1 in one request (in the variable's own type, float32 here)
            v = H.v(var); fmt, sz = nc3.TYPES[v["type"]]
            a = v["begin"] + r * H.recsize + (base + i * nl) * sz
            vals = struct.unpack(">" + fmt.strip(">") * (2 * nl), fetch(url, a, a + 2 * nl * sz - 1))
            return vals[j], vals[j2], vals[nl + j], vals[nl + j2]
        bil = lambda q: (1 - wy) * ((1 - wx) * q[0] + wx * q[1]) + wy * ((1 - wx) * q[2] + wx * q[3])
        def one(r):
            lowest = low * len(lats) * nl                # lowest model level
            return {"r": r, "ls": scalar("Ls", r), "mh": scalar("mars_hour", r), "ts": bil(four("ts", r, 0)), "ps": bil(four("ps", r, 0)),
                    "dod": bil(four("dod", r, 0)), "t": bil(four("t", r, lowest)), "u": bil(four("u", r, lowest)), "v": bil(four("v", r, lowest))}
        with cf.ThreadPoolExecutor(5) as ex: rows = sorted(ex.map(one, recs), key=lambda d: d["r"])
        S = {"id": sid, "label": label, "mars_year": my, "note": note, "file": url.split("/")[-1], "hours": [], "ls": [], "ts_c": [], "tair_c": [],
             "ps_pa": [], "wind_ms": [], "wind_dir_deg": [], "dust_tau": []}
        lm0 = (rows[0]["mh"] + LON / 15) % 24
        for k, d in enumerate(rows):
            Hs = R_CO2 * d["t"] / G                       # scale height (m) at the lowest level temperature
            ps = d["ps"] * math.exp((z_gcm - ELEV) / Hs)  # moved to the habitat height
            S["hours"].append({"lmst": round((lm0 + k) % 24, 2), "sol": int((lm0 + k) // 24) + 1})
            S["ls"].append(round(d["ls"], 3)); S["ts_c"].append(round(d["ts"] - 273.15, 2)); S["tair_c"].append(round(d["t"] - 273.15, 2))
            S["ps_pa"].append(round(ps, 1)); S["wind_ms"].append(round(math.hypot(d["u"], d["v"]), 2))
            S["wind_dir_deg"].append(round((270 - math.degrees(math.atan2(d["v"], d["u"]))) % 360, 1))
            S["dust_tau"].append(round(d["dod"] * ps / d["ps"], 3))
        print(f"{site} {sid}: MY{my} Ls {S['ls'][0]:.1f}-{S['ls'][-1]:.1f}, LMST start {lm0:.2f}, tau {min(S['dust_tau']):.2f}-{max(S['dust_tau']):.2f}, "
              f"wind {min(S['wind_ms']):.1f}-{max(S['wind_ms']):.1f} m/s, ts {min(S['ts_c']):.0f}..{max(S['ts_c']):.0f} C, ps {min(S['ps_pa']):.0f}-{max(S['ps_pa']):.0f} Pa", flush=True)
        res["scenarios"].append(S)
    json.dump(res, open(out, "w"), separators=(",", ":"))
    print(f"written {out} (GCM ground {z_gcm:.0f} m vs habitat {ELEV:.0f} m)", flush=True)

if __name__ == "__main__":
    if len(sys.argv) < 2: sys.exit(__doc__)
    if sys.argv[1] == "all":
        for s in SITES: extract(s)
    else:
        extract(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
