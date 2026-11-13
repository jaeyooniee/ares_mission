# ARES MISSION Data Inventory

> The datasets we can **actually download and use** for the Martian Map challenge. Every link and API below was opened and verified on 2026-11-13.
> The target site is **Jezero Crater** (see the appendix for Gale).

---

## 0. At a glance

| Layer | Dataset | Resolution | Format | Size | How to get it | Use |
|---|---|---|---|---|---|---|
| Precise terrain | HiRISE Jezero DEM (Controlled) | 1 m | GeoTIFF | 1.84 GB | Mars Trek download | Slope, roughness, routing, 3D terrain |
| Prototype terrain | CTX Jezero DEM (Controlled) | 20 m | GeoTIFF | 10 MB | Mars Trek download | Testing the pipeline on day one |
| High-res imagery | HiRISE Jezero orthomosaic | 25 cm | WMTS tiles (z ≤ 17) | (9.8 GB original) | Mars Trek tiles | 3D terrain texture, boulder checks |
| Mid-res imagery | CTX Jezero orthomosaic | 6 m | GeoTIFF / tiles | 36 MB | Mars Trek | Wide background map |
| Geologic units | USGS SIM 3464 Jezero geologic map | 1:75,000 | GeoJSON (API) | small | ArcGIS FeatureServer | Science targets, sandy terrain (traversability risk) |
| Minerals | CRISM MTRDR (7 scenes over Jezero) | ~18 m | PDS IMG | hundreds of MB each | PDS ODE | Clay / carbonate locations = science value |
| Minerals (view only) | CRISM mineral-index mosaics | ~19 m | View only in Trek | – | Mars Trek (no download) | Visual check when choosing targets |
| Thermal | THEMIS night IR mosaic | 100 m | WMTS tiles (z ≤ 9) | (16 GB original) | Mars Trek tiles | Sand vs. rock hint (qualitative) |
| Rover positions | Perseverance 708 waypoints | points | GeoJSON | 0.6 MB | mars.nasa.gov MMGIS | Linking photos to locations, validating slopes |
| Rover path | Perseverance traverse | line | GeoJSON | 1.7 MB | mars.nasa.gov MMGIS | Real drive path on the map |
| First-person photos | Perseverance Raw Images | images | JPG/PNG + JSON | – | Raw Images API | HUD backdrop, "what you will see on arrival" |
| Space weather | DONKI SEP / CME / flares | events | JSON | small | api.nasa.gov | Radiation hazard alerts |
| Landing candidates | Exploration Zones (NASA EMC) | polygons | Trek layer | 1.2 MB | Mars Trek | "Candidate human-landing zones" narrative |

**Challenge requirement "at least three kinds of data"**: terrain (DEM) + optical (HiRISE) + spectral (CRISM) + geologic (USGS) + thermal (THEMIS) + space weather (DONKI) = 6 kinds.

---

## 1. Official resource ①: JPL Mars Trek

**What it is**: A web-based Mars GIS from JPL. The search index holds 2,038 items (225 data products, 18 datasets, 1,783 place names, 12 bookmarks). 61 products overlap the Jezero area.

**Coordinate system**: Mars 2000 sphere (radius 3,396,190 m), equirectangular. Resolutions are listed in degrees; 1° ≈ 59.3 km on Mars.

### Download URL pattern

```
https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=<productLabel>
```

### Web tile (WMTS) URL pattern

```
https://trek.nasa.gov/tiles/Mars/EQ/<productLabel>/1.0.0//default/default028mm/{z}/{row}/{col}.png
```

Capabilities document: `https://trek.nasa.gov/tiles/Mars/EQ/<productLabel>/1.0.0/WMTSCapabilities.xml`

### Key Jezero products (verified)

| Product | productLabel | Resolution | Size | Download | Tiles |
|---|---|---|---|---|---|
| MRO HiRISE, Jezero DEM, Controlled | `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40` | 1 m | 1.84 GB | ✅ .tif | ❌ |
| MRO HiRISE, Jezero Mosaic, Controlled | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | 25 cm | 9.8 GB | ✅ | ✅ z ≤ 17 |
| MRO CTX, Jezero DEM, Controlled | `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0` | 20 m | 10 MB | ✅ .tif | – |
| MRO CTX, Jezero Mosaic, Controlled | `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` | 6 m | 36 MB | ✅ .tif | ✅ z ≤ 13 |
| MO THEMIS-IR Night, Global Mosaic | `THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018` | 100 m | 16 GB (global) | not recommended | ✅ z ≤ 9 |
| MO THEMIS-IR Day, Global Mosaic | `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018` | 100 m | 16 GB (global) | not recommended | ✅ |
| MGS TES, Global Thermal Inertia | `TES_Thermal_Inertia` | several km | 17 MB | ✅ | ✅ z ≤ 1 |
| MGS MOLA, Global Surface Roughness | `mola_roughness` | several km | 14 MB | ✅ | – |
| Perseverance (Mars 2020) Path | `Perseverance_Traverse_Path` | line | – | ✅ .zip | – |
| Exploration Zones (NASA EMC) | `EZMars` | polygons | 1.2 MB | ✅ | – |
| Global Geology (SIM 3292) | `SIM3292_Global_Geology` | 1:20M | 55 MB | ✅ | ✅ |

- HiRISE DEM extent: 77.2229°E–77.5840°E, 18.3068°N–18.6693°N (about 21 × 21 km).
- The **16 CRISM mineral-index layers** (clays, carbonates, sulfates, iron minerals, etc.) are "dataset" items in Trek, so they have **neither a download nor tiles**. They are view-only. Get the computation-ready data from PDS ODE (section 6).
- **Trek has no high-resolution quantitative thermal-inertia map.** TES thermal inertia is several km per pixel, too coarse for local routing. THEMIS IR is a brightness image (qualitative), so treat it as a hint only.

### Limitations

- There is no way to download only part of the HiRISE DEM. Download the full 1.84 GB and crop it in Python.
- Trek does not report file size ahead of time (no content-length header).

---

## 2. Official resource ②: USGS-NASA Planetary Geologic Mapping (ArcGIS Hub)

**What it is**: An index of published USGS planetary geologic maps. For Mars there are 148 entries (116 published, 32 in progress) at scales from 1:30M to 1:18K.

Index API: `https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PGM_Map_Database_MARS_INTERACTIVE2/FeatureServer/1`

### What we will use: SIM 3464, "Geologic Map of Jezero Crater and the Nili Planum Region" (Sun & Stack, 2020, 1:75K)

- Interactive map: https://doi.org/10.5066/P9CZYIO7
- **Download GeoJSON directly** (reprojected to Mars longitude/latitude):

```
https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8/query?where=1%3D1&outFields=unit,name,symbol,Unit_Description,Unit_Interpretation&outSR=4326&f=geojson
```

  - `outSR=4326` is an Earth coordinate-system code, used here only to get plain longitude/latitude in degrees. The values are Mars coordinates.
  - The server returns at most 2,000 features per request. The 1,308 geologic unit polygons come back in a single request.
- Native coordinate system: Transverse Mercator, central meridian 77.5°E, Mars 2000 sphere.

| Layer ID | Contents | Count |
|---|---|---|
| 8 | Geologic Units | 1,308 |
| 7 | Surface Features (dark-colored mantling material, ridged) | 285 |
| 6 | Linear Features | – |
| 5 | Geologic Contacts | – |
| 2 | Landing Ellipse | – |
| 0 | Map Boundary | – |

### The 15 geologic units and how we might use them

| Symbol | Name | Suggested use |
|---|---|---|
| NHjf1, NHjf2 | Jezero fan 1, 2 (delta) | **Science targets** (sedimentary layers, candidate biosignature sites) |
| Njf | Jezero floor | Crater floor |
| Aeb | Eolian bedform (wind-blown sand) | **Traversability hazard: loose sand** (far more precise than THEMIS) |
| cr | Crater rim | Steep-slope caution |
| ce, ci | Crater ejecta, crater interior | |
| Nle, Nue | Lower / upper etched unit | |
| Nnp1, Nnp2, Hnpf | Nili Planum 1, 2, fan | |
| Nrb | Rugged bright unit | Roughness caution |
| su | Smooth unit, undivided | |

> The interpretations (e.g., Aeb = loose sand) are our team's suggestions. Check the original `Unit_Description` field before presenting.

### What about Gale?

The detailed Gale Crater geologic map (1:60K) is still **In Progress**, so it is not available.

---

## 3. Official resource ③: Curiosity's Proposed Path up Mount Sharp (PIA23179, 2019)

**What it is**: A 3D oblique view of Mount Sharp with geologic units colored in (clay-bearing unit, sulfate-bearing unit, Greenheugh Pediment, Gediz Vallis) and Curiosity's proposed route drawn on top. Built from HiRISE, CRISM, CTX and HRSC.

**This is an example product, not a dataset.** We use it as a design reference for the habitat display.

| File | URL |
|---|---|
| JPEG (726 KB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.jpg |
| TIFF (13 MB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.tif |
| Animated GIF (2.9 MB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.gif |
| Annotated version | https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia23/pia23179/figures/PIA23179_fig1.jpg |

How we differ: that figure shows a route that was *drawn*. We *compute* the route from slope, ground and obstacles, and add a time and oxygen budget.

---

## 4. Official resource ④: NASA Worldview

**What it is**: A satellite imagery viewer for Earth. 1,346 layers; the projections are the three Earth ones (geographic, arctic, antarctic).

**It contains zero Mars data**, so it cannot be used as a data source.

What it is useful for:
- **UI reference**: time slider, layer list with opacity, side-by-side comparison, charting.
- **Optional**: Earth dust-storm and aerosol layers as an analogy when explaining how we would show Martian dust storms.

---

## 5. Official resource ⑤: Mars Perseverance Raw Images

**What it is**: Raw Perseverance images, more than 1.07 million in total (594,071 results from the API, latest sol 2031).

### API

```
https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020,ingenuity&feedtype=json&ver=1.2&num=100&page=0&&order=sol+desc&&search=%7CNAVCAM_LEFT&&condition_2=110:sol:gte&condition_3=110:sol:lte&
```

- Camera filter: `search=%7C<CAMERA_ID>` (the `|` **must** be encoded as `%7C`, otherwise the API returns HTTP 400)
  - Examples: `NAVCAM_LEFT`, `NAVCAM_RIGHT`, `FRONT_HAZCAM_LEFT_A`, `MCZ_LEFT` (Mastcam-Z)
- Sol range: `condition_2=<start>:sol:gte&condition_3=<end>:sol:lte`
- Example result: sol 110 Navcam Left returns 48 images

### Fields on each image

| Field | Meaning |
|---|---|
| `sol`, `site`, `drive` | When, and from which stop |
| `image_files` | small (320), medium (800), large (1200), full_res (PNG) |
| `extended.mastAz`, `mastEl` | Camera azimuth and elevation |
| `camera.camera_model_component_list` | CAHV camera model |
| `date_taken_utc`, `date_taken_mars` | Capture time |

**⚠️ No latitude/longitude.** To place a photo on the map, join it to the waypoints file in section 6 using `site` + `drive`.

---

## 6. Supporting data beyond the official list (all NASA data, verified)

### Perseverance waypoints (the key to placing photos)

```
https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json   (708 waypoints, 0.6 MB)
https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json    (559 segments, 1.7 MB)
```

Properties per waypoint: `RMC` ("site_drive"), `site`, `drive`, `sol`, `lat`, `lon`, `elev_geoid`, `roll`, `pitch`, `yaw`, `tilt`, `dist_total_m`, `images` (panorama metadata).

- How to join: Raw Images `site` + `drive` = waypoints `site` + `drive`
  - Example: a sol 110 photo → site 4, drive 922 → 18.4402°N, 77.4496°E (inside the HiRISE DEM extent)
- **Bonus 1**: `pitch` / `roll` / `tilt` are the angles the rover actually experienced. Comparing them with slopes we compute from the DEM validates our terrain pipeline.
- **Bonus 2**: All 708 waypoints carry cylindrical panorama metadata (`azmin` / `azmax` / `elmin` / `elmax`). However, we have not yet found a working URL for the panorama image files (the `Layers/mosaics/...` path returns 403).

Curiosity (Gale) uses the same format: `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json` (1,389 waypoints)

### CRISM mineral data (for computation)

PDS ODE search (7 MTRDR products over Jezero):

```
https://oderest.rsl.wustl.edu/live2/?target=mars&query=product&results=c&ihid=MRO&iid=CRISM&pt=MTRDR&westernlon=77.2&easternlon=77.6&minlat=18.3&maxlat=18.7&output=JSON
```

- `results=c` returns only the count. Change it to `results=f` to get the file list.
- MTRDR = map-projected CRISM product with mineral summary parameters. The files are large, so download only the one or two scenes you need.

### DONKI space weather

```
https://api.nasa.gov/DONKI/SEP?startDate=2025-01-01&endDate=2025-03-01&api_key=DEMO_KEY
```

- Verified: 13 SEP (solar energetic particle) events between 2025-01-01 and 2025-03-01.
- **⚠️ A single request can span at most 60 days.** For a full year, split the range into 60-day chunks. A one-year request returns HTTP 400.
- `DEMO_KEY` has a very low rate limit. Get a free key at https://api.nasa.gov.

---

## 7. Gotchas

1. **Size**: Start the HiRISE DEM download (1.84 GB) the moment the hackathon begins. While it downloads, finish the pipeline using the CTX DEM (10 MB).
2. **Do not download the 9.8 GB HiRISE orthomosaic.** Show it in the web app through WMTS tiles.
3. **Coordinate systems**: Trek products are equirectangular on the Mars 2000 sphere, while the USGS geologic map is natively Transverse Mercator (77.5°E). Never use an Earth CRS (e.g., EPSG:4326) as-is when co-registering.
4. **Loose-sand layer**: The USGS Aeb unit is more precise than THEMIS (100 m). Use THEMIS only as a supporting hint.
5. **CRISM**: view-only in Trek. Use PDS ODE MTRDR for computation.
6. **Photo locations**: Raw Images have no lat/lon. Join to the waypoints file.
7. **DONKI**: 60-day request limit.
8. **Attribution**: List every data source under References on the submission page.

---

## 8. Recommended download order (right after the hackathon starts)

1. Start the HiRISE Jezero DEM download (1.84 GB, the longest wait)
2. CTX Jezero DEM (10 MB) → finish the slope → cost map → route pipeline first
3. USGS geologic map GeoJSON → science targets + sandy terrain
4. M20 waypoints / traverse GeoJSON → rover path, photo placement
5. Raw Images API → Navcam / Mastcam-Z photos near points along the route
6. DONKI → in 60-day chunks
7. (If time allows) one or two CRISM MTRDR scenes

---

## Appendix: if we choose Gale Crater instead

| Data | Status |
|---|---|
| HiRISE Gale DEM (`Gale_DEM_SMG_1m`) | 1 m, **5.78 GB** |
| CTX / HiRISE Curiosity roving-site mosaics | Available |
| Detailed USGS geologic map | 1:60K **in progress (not available)** |
| Curiosity waypoints | 1,389 |
| Challenge example (boxwork, Mount Sharp) | Matches |

→ Considering the data-preparation workload, Jezero is the better choice.
