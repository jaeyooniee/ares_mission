# web/data: files the site loads

Everything here is produced from real NASA/USGS data of the Gale crater team area (137.36–137.42°E, 4.78–4.72°S, about 3.5 km).
The page (`index.html`) reads these files with `fetch`, so open it through a web server (see the root README).

| File | Size | What it is | How it was made |
|---|---|---|---|
| `dem.bin` | 0.79 MB | Terrain heights, **444 × 444** float32 values (little-endian), 8 m per cell, row 0 = north, metres above the Mars datum | HiRISE DEM `Gale_DEM_SMG_1m` (1 m) → cropped and resampled to a 2 m grid by the Python pipeline → every 4th cell → last row dropped to make the grid square |
| `terrain.json` | 1 KB | Grid size, cell size, elevation range, area bounds, texture info, pipeline walking/rover settings, and the demo assumptions that are **not** from the pipeline | Written by hand from the pipeline config and metadata |
| `route_walk.json` | 0.15 MB | Optimal and straight-line **walking** routes + summary | Python pipeline, mode `walk` (slope limit 18°, Tobler speed × 0.6, Pandolf metabolic rate at Mars gravity) |
| `route_rover.json` | 0.15 MB | Optimal and straight-line **rover** routes + summary | Python pipeline, mode `rover` (slope limit 28°, 2.5 m/s, 250 Wh/km) |
| `texture_color.jpg` | 5.9 MB | 4081 × 4095 px colour image draped over the terrain | USGS HiRISE colour mosaic cropped to the same area and grid as the DEM |

Route files: `columns = [x, y, z, dist_m, slope_deg, t_min, o2_kg, rover_wh]`. `x` is east and `y` is south, in metres from the north-west corner of the area.

## Honest notes

- The colour image is a **processed** USGS product (colour strips fused with the 25 cm red mosaic and sharpened). It is not a true-colour photograph.
- Suit battery (450 Wh), rover battery (40 kWh), crew (2) and rover cabin oxygen (4 kg) are demo assumptions, not pipeline results. Rover life-support power is not included.
- No science stops are included in the times. There is no soil, boulder, mineral or live space-weather data in this build.
- All oxygen, time and energy values come from simplified models and have not been validated against real rover data.

Source: USGS Astrogeology, *Mars MSL Gale Merged Orthophoto Mosaic 25cm* (colour version by T. Parker and F. J. Calef III); NASA/JPL-Caltech/University of Arizona (HiRISE).
