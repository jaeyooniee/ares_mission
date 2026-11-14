# web/data: files the site loads

Everything here is produced from real NASA/USGS data of the Gale crater area: **10 × 10 km** (137.311–137.480°E, 4.866–4.697°S), chosen because the CRISM mineral mapping covers it fully.

The page (`index.html`) reads these files with `fetch`, so open it through a web server (see the root README).

| File | What it is | How it was made |
|---|---|---|
| `dem.bin` | Terrain heights, **624 × 624** float32 values (little-endian), 16 m per cell, row 0 = north, metres above the Mars datum | HiRISE DEM `Gale_DEM_SMG_1m` (1 m) → resampled to 4 m → every 4th cell (16 m) → south edge trimmed to make the grid square |
| `terrain.json` | Grid size, cell size, elevation range, area, texture and mineral info, destinations, walking/rover settings, demo assumptions | Written by `build_site10km_data.py` (personal experiment, see the jae_experiment folder) |
| `route_walk.json` | Optimal and straight-line **walking** routes + summary (H → Clay-2 → PolySulf-2 → H) | Python pipeline, walk mode (slope limit 18°, Tobler × 0.6, Pandolf at Mars gravity), smoothed |
| `route_rover.json` | Optimal and straight-line **rover** routes + summary | Python pipeline, rover mode (slope limit 28°, 2.5 m/s, 250 Wh/km), smoothed |
| `texture_color.jpg` | 8162 × 8190 px colour image draped over the terrain (about 1.2 m per px) | USGS HiRISE colour mosaic cropped to the area. **Grey strips and the edge with no colour data are ESTIMATED colour** (brightness → colour table from this area's real colour pixels, not measured) |
| `cost.png` | Cost-map layer (walk), yellow = blocked | Python pipeline |
| `minerals.png` | CRISM mineral overlay (transparent colour per class) | CRISM MTRDR summary parameters (5 FRT observations), thresholds as in the team pipeline |

Route files: `columns = [x, y, z, dist_m, slope_deg, t_min, o2_kg, rover_wh]`. `x` is east and `y` is south, in metres from the north-west corner of the area.

## Honest notes

- The colour image is a **processed** USGS product (colour strips fused with the 25 cm red mosaic and sharpened). It is not a true-colour photograph.
- Estimated colour (grey strips) is a guess from brightness, not a measurement.
- Destinations are chosen by a simple rule (one clay stop, one polyhydrated sulfate stop, the strongest patch of each class near the habitat). The rule is an assumption, not validated science.
- Suit battery, rover battery, crew and rover cabin oxygen are demo assumptions, not pipeline results. Rover life-support power is not included.
- No soil, boulder or live space-weather data in this build.
- All oxygen, time and energy values come from simplified models and have not been validated against real rover data.

Source: USGS Astrogeology, *Mars MSL Gale Merged Orthophoto Mosaic 25cm* (colour version by T. Parker and F. J. Calef III); NASA/JPL-Caltech/University of Arizona (HiRISE); NASA/JPL/ JHU-APL CRISM team (MTRDR summary parameters).
