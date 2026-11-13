# ARES MISSION · Martian Map

2026 NASA Space Apps Challenge, **Interplanetary Survival Guide: Martian Map** 과제 출품작.

최초의 화성 우주인이 선외활동(Marswalk)을 계획하고 실행할 때 쓰는 국소 지도·경로 도구.

- **거주지 투명 디스플레이**: 3D 지형 위에서 경로를 비교하고, 시간·산소 예산을 확인 (계획)
- **헬멧 HUD**: 1인칭 시점 AR 경로 안내와 경고 (실행)
- 경로는 실제 NASA 지형 데이터로 계산: 경사·지반·장애물 비용 지도 → 최적 경로 → 시간·산소 예산

과제 페이지: https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/

> **현재 상태**: `index.html`은 해커톤 전에 만든 UI 콘셉트 목업이다. 지형은 Jezero형 **가상 지형**이고, 시간·산소 수치는 시연용 추정치다. 해커톤 중에 실제 HiRISE DEM 기반 앱으로 교체한다.

## 폴더 구조

```
ares_mission/
├─ index.html          웹앱 진입점 (GitHub Pages가 여는 파일)
├─ web/
│  ├─ js/              화면 코드 (3D 지형, HUD, 패널)
│  ├─ css/             스타일
│  └─ data/            Python이 만든 결과물 (heightmap.png, route.json 등) → 웹이 fetch로 읽음
├─ python/             데이터 처리 (정합 → 경사·지반·장애물 → 비용 지도 → 경로 → 자원 예산)
├─ data/
│  ├─ raw/             원본 데이터 (DEM, 영상 등) · Git에 올리지 않음
│  └─ processed/       중간 결과물 · Git에 올리지 않음
├─ docs/
│  └─ data_inventory.md  사용 데이터 목록과 받는 방법
└─ .nojekyll           GitHub Pages가 파일을 그대로 서빙하도록 하는 설정
```

**흐름**: `data/raw` (원본) → `python/` (계산) → `web/data` (웹용 결과물) → `index.html` + `web/js` (화면)

무거운 계산은 Python으로 미리 하고, 웹앱은 결과 파일만 읽어서 보여준다.

## 데이터

사용하는 NASA 데이터와 다운로드 방법은 [docs/data_inventory.md](docs/data_inventory.md)에 정리했다.

원본 데이터(GeoTIFF 등)는 용량이 커서 Git에 올리지 않는다 (`.gitignore` 참고). 각자 `data/raw/`에 받아서 쓴다.

## 로컬 실행

웹앱은 빌드 없이 정적 파일로 동작한다. `fetch`로 파일을 읽기 때문에 `index.html`을 더블클릭하지 말고 로컬 서버로 열 것.

```bash
python -m http.server 8000
```

브라우저에서 http://localhost:8000 접속. (VS Code Live Server를 써도 됨)

## 배포

GitHub Pages (main 브랜치 루트) + 커스텀 도메인.

## 데이터 출처

- NASA/JPL Mars Trek — HiRISE, CTX, THEMIS DEM·영상
- USGS Astrogeology — Geologic Map of Jezero Crater and the Nili Planum Region (SIM 3464, Sun & Stack 2020)
- NASA/JPL-Caltech — Mars 2020 Perseverance Raw Images, 로버 위치(waypoints)
- NASA PDS Geosciences Node — MRO CRISM
- NASA CCMC DONKI — 우주기상 이벤트

## 팀

ARES MISSION (5명)
