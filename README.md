# ARES MISSION · Martian Map

Our entry for the 2026 NASA Space Apps Challenge, **Interplanetary Survival Guide: Martian Map**.

A local map and route-planning tool for the first astronauts on Mars to plan and carry out a surface excursion (a "Marswalk"), from the habitat's transparent display to the helmet and rover HUD.

Live site: https://aresmission.us · Challenge page: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/

## What it does

- **Weather and radiation (every built-in site)**: hourly EMARS weather scenarios at each site, a Curiosity RAD radiation layer (quiet / elevated / solar event; measured at Gale and moved to each site with its surface pressure), an injectable SEP alert that replays the 10 Sept 2017 event, and an injectable dust storm (the 2007 global storm). A* re-plans the way home from where the crew is.
- **Seven landing sites**: Gale crater, Jezero crater, Columbia Hills (Spirit) and East Melas (Valles Marineris), 10 × 10 km each, plus Mawrth Vallis (5.1 km) and Meridiani Planum (4.7 km, next to Victoria crater), all on real terrain models, or a **Custom site** built in the browser from your own DEM, image, CRISM and THEMIS files. Switch with **Location ▼** in the top bar.
- **Science value**: pick objectives (scored against NASA Moon to Mars objectives) and the map shows where the terrain is strong in all of them, with a ranked list of top sites. The route visits the best two.
- **Route planning**: walking and rover routes on the slope / cost grid of the DEM (A* in the page, then smoothed), with a time, oxygen and energy budget from the team pipeline's models (Tobler walking speed × suit factor, Pandolf metabolic O₂ at Mars gravity, rover speed and Wh/km). Optimal and straight-line routes are compared side by side, with an elevation profile.
- **GO / NO-GO**: GO when the safety factor (supply ÷ need) is at least ×1.5. The badge at the top right always shows the current state.
- **Helmet HUD and rover HUD**: first-person traverse with time left, return-to-habitat estimate, ABORT (re-planned route home), and training injects for a solar-particle (SEP) alert and a suit leak (rover: power fault).
- **Layers**: imagery, elevation, slope, cost map, CRISM minerals and science value; at Gale also Curiosity CheMin drill sites and the Curiosity traverse as ground truth (reference only, not used in scoring).

## Honest notes

- The Gale colour image is a *processed* USGS colour mosaic, not a true-colour photo. Grey strips without colour data use **estimated** colour from brightness. The Jezero, Mawrth and Meridiani images are greyscale, tinted for display. East Melas has no image in the data folder, so its map is shaded relief of the DEM. The Mawrth, Meridiani, Columbia Hills and East Melas science rows are proposed by us (the team table covers Gale and Jezero); see `web/data/README.md`.
- Science stops come from a simple rule on the mineral maps. It is an assumption, not validated science.
- Suit battery, rover battery and cabin oxygen are demo assumptions. All time, oxygen and energy values come from simplified models that have not been validated against real rover data.
- Not in this build: soft soil, boulders, live space weather (DONKI), rover photos.

Details of every data file: [web/data/README.md](web/data/README.md).

## Project structure

```
ares_mission/
├─ index.html            Web app (3D map, science value, routes, helmet / rover HUD) · the file GitHub Pages serves
├─ CNAME                 Custom domain for GitHub Pages
├─ favicon.svg, favicon.ico, apple-touch-icon.png
├─ web/
│  ├─ css/intro.css      Intro screen styles
│  ├─ js/intro.js        Intro screen (logo → route draws → "ARES MISSION" → fade into the app)
│  ├─ js/custom/         Custom site: dialog.js (upload dialog), worker.js (builds the site in a Web Worker),
│  │                     store.js (keeps it in this browser, IndexedDB). Nothing is uploaded anywhere
│  ├─ img/               Logo and site-card images
│  └─ data/              Gale site files (terrain, routes, texture, minerals, science value, CheMin) + README
│     ├─ jezero/         Jezero site files, same names and formats
│     ├─ mawrth/         Mawrth Vallis site files
│     ├─ meridiani/      Meridiani Planum site files
│     ├─ columbia/       Columbia Hills site files
│     └─ melas/          East Melas site files
├─ python/               Data pipeline (currently kept in the team's shared folder)
├─ data/raw, data/processed   Raw data and intermediate results. Not committed to Git
├─ docs/
│  └─ data_inventory.md  Datasets we use and how to get them
└─ .nojekyll             Tells GitHub Pages to serve files as-is
```

**Flow**: raw NASA / USGS data → team Python pipeline (DEM → slope / cost map → routes; CRISM → minerals; science value) → web files in `web/data` → `index.html`.

## Run locally

The web app is static and needs no build step. It uses ES modules and loads Three.js 0.160.0, fflate 0.8.2 and geotiff 2.1.3 from the jsDelivr CDN, and reads files with `fetch`. It needs an internet connection and must be served from a local web server instead of being opened by double-clicking `index.html`.

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

- `?site=jezero`, `?site=mawrth`, `?site=meridiani`, `?site=columbia`, `?site=melas` open that site directly.
- `?intro=0` skips the intro screen. Click or press any key to skip it.

## Deployment

GitHub Pages (`main` branch, repository root) with a custom domain: https://aresmission.us

## Data sources

- NASA/JPL-Caltech/University of Arizona: HiRISE DEM of Gale crater (`Gale_DEM_SMG_1m`) and HiRISE DTM of Jezero (`JEZ_hirise_soc_006`), via JPL Mars Trek; HiRISE DTMs `DTEEC_006755_2030_011383_2030` (Mawrth) and `DTEEC_021747_1780_022380_1780` (Meridiani) with their HiRISE ortho images, via PDS; Columbia Hills DEM mosaic (HiRISE, CTX, HRSC; USGS 2018) and HiRISE mosaic; CTX stereo DEM D18_034250_1676 / D21_035450_1674 (East Melas)
- USGS Astrogeology: *Mars MSL Gale Merged Orthophoto Mosaic 25cm*, HiRISE colour version (T. Parker, F. J. Calef III); Jezero visible mosaic (HiRISE, CTX by MSSS, HRSC by ESA/DLR/FU Berlin)
- NASA/JPL/JHU-APL: MRO CRISM MTRDR summary parameters (minerals)
- Mars Odyssey THEMIS global thermal inertia mosaic (USGS Astropedia)
- Curiosity and Perseverance traverses: NASA MMGIS (mars.nasa.gov); Opportunity and Spirit traverses: PDS Analyst's Notebook (`MERB_traverse_5130`, `MERA_traverse`)
- Curiosity RAD dose rates: NASA PDS Planetary Plasma Interactions node, MSL-M-RAD-3-RDR-V1.0 (`python/rad_extract.py`); EMARS reanalysis (`python/emars_extract.py`)
- Curiosity CheMin drill sites: NASA PDS CheMin RDR and PDS Analyst's Notebook; clay wt% from Thorpe et al. 2022

## SI (Super Intelligence) disclosure

We used Claude (Anthropic, Claude Opus 5.5) through Claude Code. Where and how:

- **Code**: `index.html` was written with Claude's assistance. The page code and text were generated with the model and edited by the team. The same notice is in the file header.
- **Commits co-authored with Claude**: these commits carry a `Co-Authored-By: Claude` line in the git history.
  - `a5130d4`: a UI prototype page (`index2.html`), later merged into `index.html` and removed
  - `16e79bc`: new UI in `index.html`; also changed `web/js/intro.js` and `web/css/intro.css`, and recomputed the rover times in `web/data/route_rover.json` and the rover speed setting in `web/data/terrain.json` (rover top speed 15 km/h)
  - `66512ba`: brought in the team's new mineral export (`web/data/minerals.json`, `minerals.png`) and the code that reads it
  - `e71717a`: recomputed `web/data/science.json` and `science.bin` with the team's `science.py`, and the code that shows them
- **Data**: the data values come from the NASA / USGS sources above, processed by the team's scripts. In the commits listed above, Claude helped integrate or recompute them; it did not invent data values.
- **Documentation**: this README was written with Claude's assistance.
- **Images, video, audio**: none were generated with SI tools.
- No NASA logos or branding are used.

## Team

ARES MISSION (5 members)
