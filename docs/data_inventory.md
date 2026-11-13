# ARES MISSION 데이터 목록

> Martian Map 과제에서 우리가 **실제로 받을 수 있는 데이터**를 정리한 문서. 2026-11-13에 링크·API를 직접 열어서 확인함.
> 장소는 **Jezero 크레이터** 기준 (Gale은 맨 아래 참고).

---

## 0. 한눈에 보기: 우리가 쓸 데이터

| 레이어 | 데이터 | 해상도 | 형식 | 크기 | 받는 방법 | 용도 |
|---|---|---|---|---|---|---|
| 정밀 지형 | HiRISE Jezero DEM (Controlled) | 1 m | GeoTIFF | 1.84 GB | Mars Trek 다운로드 | 경사·거칠기·경로 계산, 3D 지형 |
| 시제품용 지형 | CTX Jezero DEM (Controlled) | 20 m | GeoTIFF | 10 MB | Mars Trek 다운로드 | 첫날 파이프라인 테스트용 |
| 고해상도 영상 | HiRISE Jezero 정사영상 | 25 cm | WMTS 타일 (z≤17) | (원본 9.8 GB) | Mars Trek 타일 | 3D 지형 텍스처, 바위 확인 |
| 중해상도 영상 | CTX Jezero 정사영상 | 6 m | GeoTIFF / 타일 | 36 MB | Mars Trek | 넓은 배경지도 |
| 지질 단위 | USGS SIM 3464 Jezero 지질도 | 1:75,000 | GeoJSON (API) | 작음 | ArcGIS FeatureServer | 과학 목표 지점, 모래 지대(통행 위험) |
| 광물 | CRISM MTRDR (Jezero 7장) | ~18 m | PDS IMG | 장당 수백 MB | PDS ODE | 점토·탄산염 위치 = 과학 가치 |
| 광물 (보기용) | CRISM 광물 지수 모자이크 | ~19 m | Trek 화면에서만 보기 | - | Mars Trek (다운로드 불가) | 장소 고를 때 눈으로 확인 |
| 열 | THEMIS 야간 IR 모자이크 | 100 m | WMTS 타일 (z≤9) | (원본 16 GB) | Mars Trek 타일 | 모래/암반 참고 (정성적) |
| 로버 위치 | Perseverance 정차 지점 708개 | 지점 | GeoJSON | 0.6 MB | mars.nasa.gov MMGIS | 사진 위치 연결, 실측 경사 검증 |
| 로버 경로 | Perseverance 주행 경로 | 선 | GeoJSON | 1.7 MB | mars.nasa.gov MMGIS | 지도 위 실제 주행선 |
| 1인칭 사진 | Perseverance Raw Images | 이미지 | JPG/PNG + JSON | - | Raw Images API | HUD 배경, "도착하면 이렇게 보임" |
| 우주기상 | DONKI SEP/CME/플레어 | 이벤트 | JSON | 작음 | api.nasa.gov | 방사선 위험 경보 |
| 착륙 후보지 | Exploration Zones (NASA EMC) | 다각형 | Trek 레이어 | 1.2 MB | Mars Trek | "유인 탐사 후보지" 스토리 |

**과제 조건 "데이터 3종 이상"**: 지형(DEM) + 광학(HiRISE) + 분광(CRISM) + 지질(USGS) + 열(THEMIS) + 우주기상(DONKI) → 6종 충족.

---

## 1. 공식 리소스 ① JPL Mars Trek

**무엇**: JPL이 만든 웹 기반 화성 GIS. 검색 항목 2,038개 (데이터 제품 225, 데이터셋 18, 지명 1,783, 북마크 12). Jezero 구역과 겹치는 제품은 61개.

**좌표계**: Mars 2000 구체 (반지름 3,396,190 m), 등장방형(Equirectangular). 해상도는 도(°) 단위로 표시됨. 화성에서 1° ≈ 59.3 km.

### 다운로드 URL 형식

```
https://trek.nasa.gov/mars/TrekWS/rest/cat/data/stream?label=<productLabel>
```

### 웹 타일(WMTS) URL 형식

```
https://trek.nasa.gov/tiles/Mars/EQ/<productLabel>/1.0.0//default/default028mm/{z}/{row}/{col}.png
```

능력 문서: `https://trek.nasa.gov/tiles/Mars/EQ/<productLabel>/1.0.0/WMTSCapabilities.xml`

### Jezero 핵심 제품 (확인 완료)

| 제품명 | productLabel | 해상도 | 크기 | 다운로드 | 타일 |
|---|---|---|---|---|---|
| MRO HiRISE, Jezero DEM, Controlled | `JEZ_hirise_soc_006_DTM_MOLAtopography_DeltaGeoid_1m_Eqc_latTs0_lon0_blend40` | 1 m | 1.84 GB | ✅ .tif | ❌ |
| MRO HiRISE, Jezero Mosaic, Controlled | `JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd` | 25 cm | 9.8 GB | ✅ | ✅ z≤17 |
| MRO CTX, Jezero DEM, Controlled | `JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0` | 20 m | 10 MB | ✅ .tif | - |
| MRO CTX, Jezero Mosaic, Controlled | `JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0` | 6 m | 36 MB | ✅ .tif | ✅ z≤13 |
| MO THEMIS-IR Night, Global Mosaic | `THEMIS_NightIR_ControlledMosaics_100m_v2_oct2018` | 100 m | 16 GB (전역) | 비추천 | ✅ z≤9 |
| MO THEMIS-IR Day, Global Mosaic | `THEMIS_DayIR_ControlledMosaics_100m_v2_oct2018` | 100 m | 16 GB (전역) | 비추천 | ✅ |
| MGS TES, Global Thermal Inertia | `TES_Thermal_Inertia` | 수 km | 17 MB | ✅ | ✅ z≤1 |
| MGS MOLA, Global Surface Roughness | `mola_roughness` | 수 km | 14 MB | ✅ | - |
| Perseverance (Mars 2020) Path | `Perseverance_Traverse_Path` | 선 | - | ✅ .zip | - |
| Exploration Zones (NASA EMC) | `EZMars` | 다각형 | 1.2 MB | ✅ | - |
| Global Geology (SIM 3292) | `SIM3292_Global_Geology` | 1:20M | 55 MB | ✅ | ✅ |

- HiRISE DEM 범위: 동경 77.2229~77.5840°, 북위 18.3068~18.6693° (약 21 × 21 km).
- **CRISM 광물 지수 레이어 16종**(점토, 탄산염, 황산염, 철 광물 등)은 Trek에서 "dataset" 형태라 **다운로드도 타일도 안 됨** → 화면에서 보기만 가능. 계산에 쓰려면 PDS ODE (아래 6번)에서 받아야 함.
- **열관성 정량 지도는 Trek에 고해상도가 없음**. TES 열관성은 수 km 해상도라 국소 경로에 못 씀. THEMIS IR은 밝기 영상(정성적)이라 "참고"용.

### 쓸 수 없는 것

- HiRISE DEM은 일부 구역만 잘라서 받는 기능 없음 → 1.84 GB 전체를 받은 뒤 Python으로 잘라야 함.
- 파일 크기를 미리 알려주지 않음 (content-length 없음).

---

## 2. 공식 리소스 ② USGS-NASA Planetary Geologic Mapping (ArcGIS Hub)

**무엇**: USGS가 출판한 행성 지질도 목록. 화성은 148건 (출판 116, 진행 중 32), 축척 1:30M~1:18K.

목록 API: `https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/PGM_Map_Database_MARS_INTERACTIVE2/FeatureServer/1`

### 우리가 쓸 것: SIM 3464 "Geologic Map of Jezero Crater and the Nili Planum Region" (Sun & Stack, 2020, 1:75K)

- 인터랙티브 지도: https://doi.org/10.5066/P9CZYIO7
- **GeoJSON 바로 받기** (화성 경위도로 변환):

```
https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Jezero_FeatureServiceFromPro/FeatureServer/8/query?where=1%3D1&outFields=unit,name,symbol,Unit_Description,Unit_Interpretation&outSR=4326&f=geojson
```

  - `outSR=4326`은 지구 좌표계 번호지만 여기서는 경위도(도) 숫자로만 받는 용도. 값은 화성 경위도임.
  - 한 번에 최대 2,000개까지 반환. 지질 단위 다각형은 1,308개라 한 번에 다 받아짐.
- 원래 좌표계: Transverse Mercator, 중앙 경선 77.5°E, Mars 2000 구체.

| 레이어 번호 | 내용 | 개수 |
|---|---|---|
| 8 | Geologic Units (지질 단위) | 1,308 |
| 7 | Surface Features (어두운 피복 물질, 융기) | 285 |
| 6 | Linear Features (선형 지형) | - |
| 5 | Geologic Contacts (경계선) | - |
| 2 | Landing Ellipse (착륙 타원) | - |
| 0 | Map Boundary | - |

### 지질 단위 15종과 활용 제안

| 기호 | 이름 | 활용 제안 |
|---|---|---|
| NHjf1, NHjf2 | Jezero fan 1, 2 (삼각주) | **과학 목표** (퇴적층, 생명 흔적 후보) |
| Njf | Jezero floor | 크레이터 바닥 |
| Aeb | Eolian bedform (바람 퇴적 모래) | **통행 위험: 무른 모래** (THEMIS보다 훨씬 정밀) |
| cr | Crater rim | 급경사 주의 |
| ce, ci | Crater ejecta, interior | |
| Nle, Nue | Lower / Upper etched | |
| Nnp1, Nnp2, Hnpf | Nili Planum 1, 2, fan | |
| Nrb | Rugged bright (거친 밝은 지형) | 거칠기 주의 |
| su | Smooth, undivided | |

> 단위 해석(예: Aeb = 무른 모래)은 우리 팀의 제안. 발표 전에 `Unit_Description` 필드 원문으로 확인할 것.

### Gale은?

Gale 크레이터 정밀 지질도(1:60K)는 아직 **In Progress**라 쓸 수 없음.

---

## 3. 공식 리소스 ③ Curiosity's Proposed Path up Mount Sharp (PIA23179, 2019)

**무엇**: Mount Sharp 3D 조감 지형 위에 지질 단위(점토층, 황산염층, Greenheugh Pediment, Gediz Vallis)를 색칠하고 Curiosity 경로를 그린 결과물. HiRISE, CRISM, CTX, HRSC로 만듦.

**데이터가 아니라 결과물 예시**. 우리 거주지 디스플레이 화면의 디자인 레퍼런스로 씀.

| 파일 | URL |
|---|---|
| JPEG (726 KB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.jpg |
| TIFF (13 MB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.tif |
| GIF 애니메이션 (2.9 MB) | https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/pia23/pia23179/PIA23179.gif |
| 라벨 붙은 버전 | https://assets.science.nasa.gov/dynamicimage/assets/science/psd/photojournal/pia/pia23/pia23179/figures/PIA23179_fig1.jpg |

우리 차별점: 이 그림은 경로를 "그린" 것이고, 우리는 경사·지반·장애물로 경로를 "계산"하고 시간·산소까지 낸다.

---

## 4. 공식 리소스 ④ NASA Worldview

**무엇**: 지구 위성 영상 뷰어. 레이어 1,346개, 투영은 지구용 3개(geographic, arctic, antarctic).

**화성 데이터는 0개**. 데이터로는 못 씀.

쓸 수 있는 용도:
- **UI 레퍼런스**: 시간 슬라이더, 레이어 목록·투명도, 두 시점 비교(Comparison), 차트 기능.
- **선택**: 지구 먼지폭풍·에어로졸 레이어를 "화성 먼지폭풍도 이렇게 보여주겠다"는 비유로 발표에 사용.

---

## 5. 공식 리소스 ⑤ Mars Perseverance Raw Images

**무엇**: Perseverance 원본 사진 107만 장 이상 (API 기준 594,071건, 최신 sol 2031).

### API

```
https://mars.nasa.gov/rss/api/?feed=raw_images&category=mars2020,ingenuity&feedtype=json&ver=1.2&num=100&page=0&&order=sol+desc&&search=%7CNAVCAM_LEFT&&condition_2=110:sol:gte&condition_3=110:sol:lte&
```

- 카메라 필터: `search=%7C<카메라ID>` (`|`를 반드시 `%7C`로 인코딩. 안 하면 400 에러)
  - 예: `NAVCAM_LEFT`, `NAVCAM_RIGHT`, `FRONT_HAZCAM_LEFT_A`, `MCZ_LEFT`(Mastcam-Z)
- sol 범위: `condition_2=<시작>:sol:gte&condition_3=<끝>:sol:lte`
- 예시 결과: sol 110 Navcam Left = 48장

### 사진 1장에 들어있는 정보

| 필드 | 내용 |
|---|---|
| `sol`, `site`, `drive` | 언제, 어느 정차 지점에서 |
| `image_files` | small(320), medium(800), large(1200), full_res(PNG) |
| `extended.mastAz`, `mastEl` | 카메라가 본 방위각·고도각 |
| `camera.camera_model_component_list` | CAHV 카메라 모델 |
| `date_taken_utc`, `date_taken_mars` | 촬영 시각 |

**⚠️ 위경도 없음**. 지도 위치는 아래 6번의 waypoints 파일과 `site_drive`로 연결해야 함.

---

## 6. 공식 리소스 외 보조 데이터 (모두 NASA 데이터, 확인 완료)

### Perseverance 정차 지점 (사진 위치 연결의 핵심)

```
https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json   (708개 지점, 0.6 MB)
https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_traverse.json    (559개 구간, 1.7 MB)
```

각 지점 속성: `RMC`("site_drive"), `site`, `drive`, `sol`, `lat`, `lon`, `elev_geoid`, `roll`, `pitch`, `yaw`, `tilt`, `dist_total_m`, `images`(파노라마 정보).

- 연결 방법: Raw Images의 `site`+`drive` = waypoints의 `site`+`drive`
  - 예: sol 110 사진 → site 4, drive 922 → 북위 18.44020°, 동경 77.44964° (HiRISE DEM 범위 안)
- **보너스 1**: `pitch`/`roll`/`tilt`는 로버가 실제로 기운 각도 → 우리가 DEM으로 계산한 경사와 비교하면 계산 검증이 됨.
- **보너스 2**: 708개 지점 모두 원통형 파노라마 정보(`azmin`/`azmax`/`elmin`/`elmax`)가 있음. 단, 파노라마 이미지 파일의 실제 주소는 아직 확인 못 함 (`Layers/mosaics/...` 경로가 403).

Curiosity(Gale)도 같은 형식: `https://mars.nasa.gov/mmgis-maps/MSL/Layers/json/MSL_waypoints.json` (1,389개)

### CRISM 광물 데이터 (계산용)

PDS ODE 검색 (Jezero 범위 MTRDR 7건):

```
https://oderest.rsl.wustl.edu/live2/?target=mars&query=product&results=c&ihid=MRO&iid=CRISM&pt=MTRDR&westernlon=77.2&easternlon=77.6&minlat=18.3&maxlat=18.7&output=JSON
```

- `results=c`는 개수만. 파일 목록은 `results=f`로 바꿔서 받음.
- MTRDR = 지도 투영된 CRISM 제품 + 광물 요약 지수. 파일이 커서 필요한 1~2장만 받을 것.

### DONKI 우주기상

```
https://api.nasa.gov/DONKI/SEP?startDate=2025-01-01&endDate=2025-03-01&api_key=DEMO_KEY
```

- 2025-01-01 ~ 03-01 SEP(태양 고에너지 입자) 이벤트 13건 확인.
- **⚠️ 한 번에 최대 60일까지만 조회 가능**. 1년치는 60일씩 나눠서 요청해야 함. Notion 가이드의 1년 단위 예시 코드는 그대로 쓰면 400 에러가 남.
- `DEMO_KEY`는 호출 횟수 제한이 작음. https://api.nasa.gov 에서 무료 키를 받아 쓸 것.

---

## 7. 주의사항 요약

1. **용량**: HiRISE DEM 1.84 GB는 해커톤 시작하자마자 다운로드 시작. 기다리는 동안 CTX DEM(10 MB)으로 파이프라인부터 완성.
2. **HiRISE 영상 9.8 GB는 받지 말 것**. 웹에서는 WMTS 타일로 바로 띄우면 됨.
3. **좌표계**: Trek 제품은 등장방형 + Mars 2000 구체, USGS 지질도 원본은 Transverse Mercator(77.5°E). 정합할 때 지구 좌표계(EPSG:4326 등)를 그대로 쓰면 안 됨.
4. **무른 모래 레이어**: THEMIS(100 m)보다 USGS 지질도의 Aeb 단위가 정밀함. THEMIS는 보조 참고로.
5. **CRISM**: Trek은 보기만 가능. 계산용은 PDS ODE MTRDR.
6. **사진 위치**: Raw Images에는 위경도가 없음 → waypoints 파일로 연결.
7. **DONKI**: 60일 제한.
8. **출처 표기**: 제출 페이지 References에 위 데이터 출처를 모두 적을 것.

---

## 8. 추천 다운로드 순서 (해커톤 시작 직후)

1. HiRISE Jezero DEM 다운로드 시작 (1.84 GB, 가장 오래 걸림)
2. CTX Jezero DEM (10 MB) → 경사·비용 지도·경로 파이프라인 먼저 완성
3. USGS 지질도 GeoJSON → 과학 목표 + 모래 지대
4. M20 waypoints / traverse GeoJSON → 로버 경로, 사진 연결
5. Raw Images API → 경로 근처 지점의 Navcam / Mastcam-Z 사진
6. DONKI → 60일씩 끊어서
7. (여유 있으면) CRISM MTRDR 1~2장

---

## 부록: Gale 크레이터를 고를 경우

| 데이터 | 상태 |
|---|---|
| HiRISE Gale DEM (`Gale_DEM_SMG_1m`) | 1 m, **5.78 GB** |
| CTX / HiRISE Curiosity 주행 지역 모자이크 | 있음 |
| USGS 정밀 지질도 | 1:60K **진행 중 (없음)** |
| Curiosity waypoints | 1,389개 |
| 과제문 예시 (boxwork, Mount Sharp) | 해당 |

→ 데이터 준비 부담을 생각하면 Jezero가 유리함.
