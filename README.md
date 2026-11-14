# ARES MISSION · Martian Map

Our entry for the 2026 NASA Space Apps Challenge, **Interplanetary Survival Guide: Martian Map**.

A local map and route-planning tool for the first astronauts on Mars to plan and carry out a surface excursion (a "Marswalk").

- **Habitat transparent display**: compare routes over real 3D terrain and review the time and oxygen budget (planning)
- **Helmet HUD and rover HUD**: first-person guidance, warnings, return-to-habitat safety factor, ABORT and solar-particle alert (execution)
- Routes are computed offline by our Python pipeline from real NASA terrain data (slope / roughness cost map → optimal route → time, oxygen and energy)

Live site: https://aresmission.us · Challenge page: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/

> **Current status**: the site shows the **real Gale crater team area** (about 3.5 km): a HiRISE elevation model (8 m grid made from a 1 m source) with a USGS HiRISE colour mosaic on top. Walking and rover routes come from the Python pipeline. The colour is *processed* colour, not a true-colour photo. Soil, boulders, minerals, live space weather, radiation and rover photos are **not** in this build. Battery and rover-cabin values are demo assumptions. See [web/data/README.md](web/data/README.md).

## Project structure

```
ares_mission/
├─ index.html          Web app (3D map, helmet / rover HUD) · the file GitHub Pages serves
├─ CNAME               Custom domain for GitHub Pages
├─ web/
│  ├─ css/intro.css    Intro screen styles
│  ├─ js/intro.js      Intro screen (logo → "ARES MISSION" typed to its right → fly-in)
│  └─ data/            Real-data files the page loads (terrain, routes, texture) + README
├─ python/             Data processing (co-registration → slope / roughness → cost map → route → resource budget)
├─ data/
│  ├─ raw/             Raw data (DEM, imagery, ...). Not committed to Git
│  └─ processed/       Intermediate results. Not committed to Git
├─ docs/
│  └─ data_inventory.md  Datasets we use (Gale first, Jezero planned) and how to get them
└─ .nojekyll           Tells GitHub Pages to serve files as-is
```

**Flow**: raw NASA data (`data/raw`) → Python pipeline (`python/`, currently kept in the team's shared folder) → web files (`web/data`) → `index.html`.

## Data

The NASA / USGS datasets we use and how to download them are listed in [docs/data_inventory.md](docs/data_inventory.md). Raw data (GeoTIFF, etc.) is too large for Git and is excluded (see `.gitignore`).

## Run locally

The web app is static and needs no build step. It uses ES modules, loads Three.js (pinned to version 0.160.0) from the jsDelivr CDN, and reads files with `fetch`, so it needs an internet connection and must be served from a local web server instead of being opened by double-clicking `index.html`.

```bash
python -m http.server 8000
```

Then open http://localhost:8000. Add `?intro=0` to skip the intro screen while developing. Click or press any key to skip it.

## Deployment

GitHub Pages (`main` branch, repository root) with a custom domain: https://aresmission.us

## Data sources

- NASA/JPL-Caltech/University of Arizona: HiRISE DEM of Gale crater (`Gale_DEM_SMG_1m`) and HiRISE orthomosaic, via JPL Mars Trek
- USGS Astrogeology: *Mars MSL Gale Merged Orthophoto Mosaic 25cm*, HiRISE colour version (T. Parker, F. J. Calef III)
- Planned, not in this build: USGS geologic map of Jezero (SIM 3464), NASA PDS CRISM, Mars 2020 Raw Images and rover waypoints, NASA CCMC DONKI space weather

## Team

ARES MISSION (5 members)
