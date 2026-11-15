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

## jezero/: the second landing site

`web/data/jezero/` has **the same files in the same formats** as above (the page picks the folder from the intro's site card, or `?site=jezero`), for a **10 × 10 km** area of Jezero crater around the Perseverance landing site (77.3058–77.4834°E, 18.3916–18.5600°N).

| File | Jezero source |
|---|---|
| `dem.bin`, `terrain.json` | HiRISE DTM `JEZ_hirise_soc_006` (1 m, Mars 2020 landing-site product) → 4 m → every 4th cell (16 m), **624 × 624**, same pipeline (`pipeline_min.py`) as Gale |
| `route_walk.json`, `route_rover.json` | same pipeline + smoothing (`run_smooth10.py`), H → Carbonate-2 → Clay-1 → H (Mg carbonate + Fe/Mg clay: the lake-sediment / habitability pair closest to the habitat) |
| `texture_color.jpg` | Jezero visible mosaic (HiRISE, CTX, HRSC), cropped to the area. **Greyscale, tinted to a Mars colour for display**: the colour is not measured |
| `minerals.json`, `minerals.png` | CRISM MTRDR summary parameters, 4 FRT + 1 HRL observations (95.8% coverage), robust z per observation; 6 classes (Mg carbonate, olivine, Fe/Mg clay, hydrated, low-/high-Ca pyroxene) |
| `science.json`, `science.bin`, `reach.bin` | team `science.py` with the Jezero rows of `Min_trial/category_minerals_by_site.txt` (see `web.jezero_mapping` in `science.json`); novelty from the Perseverance traverse (NASA MMGIS `M20_traverse.json`) |

Not included for Jezero: `cost.png` (the page draws the cost map itself).

## mawrth/ and meridiani/: two more landing sites

Same files and formats as `jezero/` (`?site=mawrth`, `?site=meridiani`). Each area is the **largest square that its HiRISE DTM covers completely** (no gaps), so they are smaller than Gale and Jezero. Built with the same team code (`pipeline.py` → `pipeline_min.py` + `run_smooth10.py` → `science.py`); the habitat is the flattest ground near the middle and the two route stops are the best patches of two water-related minerals.

| | Mawrth Vallis | Meridiani Planum |
|---|---|---|
| Area | 5.1 km square, centre 23.0435°N, 18.4569°W, 320 × 320 at 16 m | 4.7 km square, centre 2.0217°S, 5.4823°W, 296 × 296 at 16 m (Victoria crater rim in the south-west corner) |
| DTM | HiRISE `DTEEC_006755_2030_011383_2030` (1 m) | HiRISE `DTEEC_021747_1780_022380_1780` (1 m) |
| Texture | HiRISE `PSP_006755_2030` red ortho, greyscale tinted for display | HiRISE `ESP_021747_1780` red ortho, greyscale tinted for display |
| CRISM | 2 FRT + 1 HRL MTRDR, **absolute index thresholds** (clays and hydration cover most of the area, so robust z would miss them) | 7 FRT used (of 9 listed), robust z per observation |
| Science rows | **proposed** (not in the team table): Fe/Mg + Al clays, kaolinite, hydrated silica | **proposed**: habitability from sulfates incl. jarosite (BD2265) + hematite; diversity = sulfate, hematite, pyroxene / olivine |
| Novelty | none (no rover has been there) | Opportunity traverse (PDS Analyst's Notebook `MERB_traverse_5130`) |
| THEMIS TI | `00N300E` tile | `30S300E` tile |

Honest notes: Meridiani's plains are under basaltic sand, so CRISM signals there are weak; on their own, Habitability and Resources have no place scoring ≥ 0.6, and the page says so. The proposed rows are documented in each `science.json` under `web.<site>_mapping`.
