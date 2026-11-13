# ARES MISSION · Martian Map

Our entry for the 2026 NASA Space Apps Challenge, **Interplanetary Survival Guide: Martian Map**.

A local map and route-planning tool for the first astronauts on Mars to plan and carry out a surface excursion (a "Marswalk").

- **Habitat transparent display**: compare routes over 3D terrain and review the time and oxygen budget (planning)
- **Helmet HUD**: first-person AR route guidance and warnings (execution)
- Routes are computed from real NASA terrain data: slope / ground / obstacle cost map → optimal route → time and oxygen budget

Challenge page: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/

> **Current status**: `index.html` is the v2 demo built before the hackathon. It has an EVA planner (habitat transparent display) plus a helmet HUD and a pressurized-rover HUD, with a GO / NO-GO readiness check. The terrain is **synthetic** (2 km × 2 km, 10 m grid) and all time, oxygen and battery figures are illustrative. It will be replaced with an app driven by the real HiRISE DEM during the hackathon.

## Project structure

```
ares_mission/
├─ index.html          Web app entry point (the file GitHub Pages serves)
├─ CNAME               Custom domain for GitHub Pages
├─ web/
│  ├─ js/              UI code (3D terrain, HUD, panels)
│  ├─ css/             Styles
│  └─ data/            Output from the Python pipeline (heightmap.png, route.json, ...) read by the web app via fetch
├─ python/             Data processing (co-registration → slope / ground / obstacles → cost map → route → resource budget)
├─ data/
│  ├─ raw/             Raw data (DEM, imagery, ...). Not committed to Git
│  └─ processed/       Intermediate results. Not committed to Git
├─ docs/
│  └─ data_inventory.md  List of datasets we use and how to get them
└─ .nojekyll           Tells GitHub Pages to serve files as-is
```

**Flow**: `data/raw` (raw data) → `python/` (computation) → `web/data` (web-ready output) → `index.html` + `web/js` (UI)

Heavy computation is done ahead of time in Python; the web app only loads and displays the results.

## Data

The NASA datasets we use and how to download them are listed in [docs/data_inventory.md](docs/data_inventory.md).

Raw data (GeoTIFF, etc.) is too large for Git and is excluded (see `.gitignore`). Each team member downloads it into `data/raw/`.

## Run locally

The web app is static and needs no build step. It uses ES modules and loads Three.js (pinned to version 0.160.0) from the jsDelivr CDN, so it needs an internet connection and must be served from a local web server instead of being opened by double-clicking `index.html`.

```bash
python -m http.server 8000
```

Then open http://localhost:8000. (VS Code Live Server also works.)

## Deployment

GitHub Pages (`main` branch, repository root) with a custom domain: https://aresmission.us

## Data sources

- NASA/JPL Mars Trek — HiRISE, CTX and THEMIS DEMs and imagery
- USGS Astrogeology — Geologic Map of Jezero Crater and the Nili Planum Region (SIM 3464, Sun & Stack 2020)
- NASA/JPL-Caltech — Mars 2020 Perseverance Raw Images and rover waypoints
- NASA PDS Geosciences Node — MRO CRISM
- NASA CCMC DONKI — space weather events

## Team

ARES MISSION (5 members)
