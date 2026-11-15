"""Gale weather timeline (3 sols per scenario) from the public EMARS v1.0 reanalysis (Penn State Data Commons).

Reads only the few bytes of the 4 GCM grid points around Gale from the NetCDF-3 'back_mean' files with HTTP range
requests (the files are 1-2 GB each), and writes web/data/weather_gale.json in the format the ui-2 page reads:
  point {lat, lon, elev_m, ...}, scenarios[] {id, label, mars_year, note, hours[{lmst, sol}], ls[], ts_c[], tair_c[],
  ps_pa[], wind_ms[], wind_dir_deg[], dust_tau[]}
Corrections (as described in the ui-2 Info > Weather model page):
  - the GCM ground is ~3 km above the Gale floor: pressure moved hydrostatically to the habitat height (H = R T / g);
    dust optical depth scaled with that pressure (well-mixed dust column)
  - wind = the lowest model level (the page applies the 0.65 factor to 2 m itself)
Usage: python emars_extract.py OUT.json
"""
import json, math, struct, sys, concurrent.futures as cf
sys.path.insert(0, __import__('os').path.dirname(__file__))
import nc3

BASE = "https://www.datacommons.psu.edu/download/meteorology/greybush/emars-1p0/data/"
LAT, LON, ELEV = -4.7375, 137.4038, -4054.0          # Gale habitat (web/data route_walk.json waypoint 0)
R_CO2, G = 191.8, 3.71
SCEN = [  # id, label, Mars year, file Ls range, start Ls, note
    ("clear", "Clear season", 32, "Ls090-120", 100.0, "Aphelion season, low dust: the usual clear-sky EVA case"),
    ("dusty", "Dusty season", 29, "Ls240-270", 250.0, "Perihelion dust season: higher dust opacity, stronger winds"),
    ("storm", "Global dust storm", 28, "Ls270-300", 275.0, "The 2007 global dust storm (MY28) near its peak"),
]
HOURS = 72

def bilin_idx(lats, lons):
    i = j = 0
    for k in range(len(lats) - 1):
        if min(lats[k], lats[k + 1]) <= LAT <= max(lats[k], lats[k + 1]): i = k; break
    lon = LON % 360
    for k in range(len(lons) - 1):
        if lons[k] <= lon <= lons[k + 1]: j = k; break
    wy = (LAT - lats[i]) / (lats[i + 1] - lats[i]); wx = (lon - lons[j]) / (lons[j + 1] - lons[j])
    return i, j, wy, wx

def main(out):
    res = {"source": "EMARS v1.0 reanalysis (Greybush et al. 2019), Penn State Data Commons doi:10.18113/D3W375; NASA/GFDL Mars GCM with TES/MCS assimilation",
           "built_by": "emars_extract.py (HTTP range reads of the back_mean NetCDF-3 files, 4 grid points around Gale, bilinear)",
           "point": {"lat": LAT, "lon": LON, "elev_m": ELEV}, "scenarios": []}
    # the GCM surface height (static) from an analysis file
    a_url = BASE + "emars_v1.0_anal_mean_MY32_Ls090-120.nc"
    Ha = nc3.Header(nc3.fetch(a_url, 0, 131071))
    for sid, label, my, rng, ls0, note in SCEN:
        url = BASE + f"emars_v1.0_back_mean_MY{my}_{rng}.nc"
        H = nc3.Header(nc3.fetch(url, 0, 262143))
        lats, lons = nc3.read_static(url, H, "lat"), nc3.read_static(url, H, "lon")
        i, j, wy, wx = bilin_idx(lats, lons)
        if "phi_s" not in res["point"]:
            phi = nc3.read_static(a_url, Ha, "Surface_geopotential")
            alats, alons = nc3.read_static(a_url, Ha, "lat"), nc3.read_static(a_url, Ha, "lon")
            ai, aj, awy, awx = bilin_idx(alats, alons)
            g = lambda r, c: phi[r * len(alons) + c]
            ps_ = (1 - awy) * ((1 - awx) * g(ai, aj) + awx * g(ai, aj + 1)) + awy * ((1 - awx) * g(ai + 1, aj) + awx * g(ai + 1, aj + 1))
            res["point"].update({"phi_s": round(ps_, 1), "gcm_ground_m": round(ps_ / G, 0), "grid_lat": [lats[i], lats[i + 1]], "grid_lon": [lons[j], lons[j + 1]]})
        z_gcm = res["point"]["gcm_ground_m"]
        nrec = H.numrecs
        # find the first record at Ls >= ls0 whose local time is near midnight
        def scalar(var, r): return nc3.read_point(url, H, var, r, ())
        lo, hi = 0, nrec - 1
        while lo < hi:                                   # binary search on Ls
            mid = (lo + hi) // 2
            if scalar("Ls", mid) < ls0: lo = mid + 1
            else: hi = mid
        r0 = lo
        for _ in range(30):
            lmst = (scalar("mars_hour", r0) + LON / 15) % 24
            if lmst < 1 or lmst > 23: break
            r0 += 1
        recs = list(range(r0, min(nrec, r0 + HOURS)))
        nl = len(lons); levels = H.v("t")["shape"][1]; low = levels - 1
        def four(var, r, cell):                            # two lat rows x two lon columns, in the variable's own type (float32 here)
            v = H.v(var); fmt, sz = nc3.TYPES[v["type"]]
            a = v["begin"] + r * H.recsize + cell * sz; b = a + (nl + 2) * sz - 1
            vals = struct.unpack(">" + fmt.strip(">") * (nl + 2), nc3.fetch(url, a, b))
            return vals[0], vals[1], vals[nl], vals[nl + 1]
        row2d = lambda var, r: four(var, r, i * nl + j)
        row3d = lambda var, r: four(var, r, (low * len(lats) + i) * nl + j)          # lowest model level
        bil = lambda q: (1 - wy) * ((1 - wx) * q[0] + wx * q[1]) + wy * ((1 - wx) * q[2] + wx * q[3])
        def one(r):
            return {"r": r, "ls": scalar("Ls", r), "mh": scalar("mars_hour", r), "ts": bil(row2d("ts", r)), "ps": bil(row2d("ps", r)),
                    "dod": bil(row2d("dod", r)), "t": bil(row3d("t", r)), "u": bil(row3d("u", r)), "v": bil(row3d("v", r))}
        with cf.ThreadPoolExecutor(12) as ex: rows = sorted(ex.map(one, recs), key=lambda d: d["r"])
        S = {"id": sid, "label": label, "mars_year": my, "note": note, "file": url.split("/")[-1], "hours": [], "ls": [], "ts_c": [], "tair_c": [],
             "ps_pa": [], "wind_ms": [], "wind_dir_deg": [], "dust_tau": []}
        lm0 = (rows[0]["mh"] + LON / 15) % 24
        for k, d in enumerate(rows):
            Hs = R_CO2 * d["t"] / G                       # scale height (m) at the lowest level temperature
            ps = d["ps"] * math.exp((z_gcm - ELEV) / Hs)  # moved down to the habitat height
            S["hours"].append({"lmst": round((lm0 + k) % 24, 2), "sol": int((lm0 + k) // 24) + 1})
            S["ls"].append(round(d["ls"], 3)); S["ts_c"].append(round(d["ts"] - 273.15, 2)); S["tair_c"].append(round(d["t"] - 273.15, 2))
            S["ps_pa"].append(round(ps, 1)); S["wind_ms"].append(round(math.hypot(d["u"], d["v"]), 2))
            S["wind_dir_deg"].append(round((270 - math.degrees(math.atan2(d["v"], d["u"]))) % 360, 1))
            S["dust_tau"].append(round(d["dod"] * ps / d["ps"], 3))
        print(f"{sid}: MY{my} Ls {S['ls'][0]:.1f}-{S['ls'][-1]:.1f}, LMST start {lm0:.2f}, tau {min(S['dust_tau']):.2f}-{max(S['dust_tau']):.2f}, "
              f"wind {min(S['wind_ms']):.1f}-{max(S['wind_ms']):.1f} m/s, ts {min(S['ts_c']):.0f}..{max(S['ts_c']):.0f} C, ps {min(S['ps_pa']):.0f}-{max(S['ps_pa']):.0f} Pa", flush=True)
        res["scenarios"].append(S)
    json.dump(res, open(out, "w"), separators=(",", ":"))
    print("written", out)

if __name__ == "__main__":
    main(sys.argv[1])
