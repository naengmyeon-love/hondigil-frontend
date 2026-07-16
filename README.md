# 혼디길 프론트엔드

혼디길은 제주 초보 걷기·러닝 코스를 고르고, 출발 위치·사진·도착 위치를 인증해 완주 기록과 주변 맛집을 확인하는 정적 웹 앱입니다. 완주할수록 나의 제주방의 여행자, 돌하르방, 귤나무가 자랍니다.

프레임워크, 번들러, npm 패키지 없이 HTML·CSS·브라우저 기본 ES Modules로 동작합니다. 저장소 루트를 GitHub Pages에 배포하면 별도 빌드 없이 실행됩니다.

## 폴더 구조

```text
hondigil-frontend/
├── index.html
├── assets/
│   ├── css/
│   │   ├── tokens.css
│   │   ├── base.css
│   │   ├── components.css
│   │   ├── layouts.css
│   │   ├── pages.css
│   │   └── responsive.css
│   └── js/
│       ├── app.js
│       ├── config.js
│       ├── router.js
│       ├── state.js
│       ├── storage.js
│       ├── utils.js
│       ├── data/
│       │   ├── courses.js
│       │   └── restaurants.js
│       ├── services/
│       │   ├── activity.js
│       │   ├── backend.js
│       │   ├── events.js
│       │   ├── gps.js
│       │   ├── growth.js
│       │   ├── map.js
│       │   └── sharing.js
│       ├── components/
│       │   ├── course-card.js
│       │   ├── icons.js
│       │   ├── modal.js
│       │   ├── navigation.js
│       │   └── toast.js
│       └── pages/
│           ├── activity.js
│           ├── admin.js
│           ├── completion.js
│           ├── course-detail.js
│           ├── courses.js
│           ├── home.js
│           ├── jejuroom.js
│           ├── onboarding.js
│           ├── records.js
│           ├── restaurants.js
│           └── settings.js
├── static/assets/
│   ├── hondigil-jeju-hero.webp
│   └── hondigil-mark.svg
├── backup/
│   ├── index-before-refactor.html
│   └── 혼디길_지도_UIUX_개선본(3).html
└── TEST_REPORT.md
```

## 파일별 역할

- `index.html`: 접근성 랜드마크, 앱 루트, Leaflet CDN, CSS와 `app.js` 연결만 포함합니다.
- `tokens.css`: 브랜드 색, 간격, 반경, 그림자, 레이어 등 디자인 토큰입니다.
- `base.css`: reset, 본문 타이포그래피, 포커스, 큰 글씨·동작 감소 기반 스타일입니다.
- `components.css`: 버튼, 카드, 필터, 입력, 모달, 토스트, 스위치입니다.
- `layouts.css`: 앱 셸, 상단/사이드 내비게이션, 하단 내비게이션, 그리드입니다.
- `pages.css`: 홈, 지도, 활동, 완주, 맛집, 제주방, 온보딩, 관리자 화면 전용 스타일입니다.
- `responsive.css`: 360px 모바일부터 태블릿·데스크톱까지의 미디어 쿼리입니다.
- `app.js`: 앱 초기화와 한 번만 등록되는 공통 이벤트 위임을 담당합니다.
- `router.js`: 해시 해석, 화면 렌더링, 지도·타이머 정리를 담당합니다.
- `state.js`: 현재 화면, 필터, 지도, 타이머, 백엔드 연결 등 메모리 상태입니다.
- `storage.js`: LocalStorage 읽기·쓰기, 데이터 검증, 이전 `hondigil_mvp_v3` 마이그레이션, 초기화입니다.
- `data/`: 기본 코스·식당 샘플 데이터입니다. Django 연결 시 서버 데이터로 안전하게 교체할 수 있습니다.
- `services/`: Leaflet, GPS, 활동, 성장, 공유, 사용 통계, 선택적 Django 동기화 로직입니다.
- `components/`: 공통 SVG 아이콘과 반복 UI, 모달, 토스트입니다.
- `pages/`: 라우터가 사용하는 화면별 HTML 렌더 함수입니다.

`backup/`은 리팩터링 이전 원본 확인용이며 실행 코드에서 참조하지 않습니다.

## 로컬 실행

ES Modules는 `file://` 직접 실행이 아니라 정적 서버에서 확인해야 합니다.

```bash
python3 -m http.server 8000
```

Windows에서 `python3` 명령이 없다면 다음을 사용할 수 있습니다.

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000/`을 엽니다. npm 설치나 빌드는 필요하지 않습니다.

## GitHub Pages 배포

1. GitHub 저장소의 **Settings → Pages**로 이동합니다.
2. **Deploy from a branch**를 선택합니다.
3. 배포할 브랜치와 `/(root)` 폴더를 선택합니다.
4. 저장 후 `https://<사용자>.github.io/hondigil-frontend/`에 접속합니다.

모든 로컬 자산과 ES Module import는 상대 경로를 사용하므로 `/hondigil-frontend/` 하위 경로에서도 작동합니다. 배포 빌드나 GitHub Actions는 필요하지 않습니다.

## 주요 해시 경로

- `#home`: 홈
- `#courses`: 코스 목록과 필터
- `#course/saryeoni`: 코스 상세와 Leaflet 지도
- `#activity`: 진행 중 활동과 세 단계 인증
- `#completion`: 최근 완주 결과
- `#restaurants`: 선택 코스 주변 맛집
- `#jejuroom`: 성장형 제주방
- `#records`: 전체 완주 기록
- `#settings`: 화면·데이터 설정
- `#admin`: 옵션으로 켤 수 있는 로컬 통계 데모

이전 경로인 `#progress`, `#result`, `#room`, `#more`도 각각 새 경로로 호환됩니다. `#/home`처럼 슬래시가 있는 해시도 읽습니다.

## LocalStorage 구조

| 키 | 내용 |
| --- | --- |
| `hondigil:user` | 익명 ID, 닉네임, 생성·최근 방문 시각 |
| `hondigil:active-course` | 진행 코스와 출발·사진·도착 인증 상태 |
| `hondigil:records` | 최대 100개의 완주 기록 |
| `hondigil:last-record-id` | 완주 결과 화면에 표시할 기록 ID |
| `hondigil:pending-completions` | 연결 복구 후 재시도할 완주 동기화 |
| `hondigil:events` | 최대 500개의 로컬 이용 이벤트 |
| `hondigil:metrics` | 관리자 데모용 누적 집계 |
| `hondigil:sync-queue` | 외부 전송 재시도 큐 |
| `hondigil:preferences` | 큰 글씨, 동작 감소, 제주방 배경 |

기존 저장 키와 기록 형식은 유지합니다. 제공된 UI/UX 개선본의 단일 키 `hondigil_mvp_v3`만 존재하는 경우, 첫 실행 때 닉네임·완주 기록·화면 설정을 현재 구조로 한 번 마이그레이션합니다.

## 유지보수 주의사항

- 파일과 import 경로의 대소문자 및 `.js` 확장자를 유지합니다.
- 저장소 이름이나 도메인을 포함한 절대 자산 경로를 추가하지 않습니다.
- 화면 이벤트는 `app.js`의 이벤트 위임으로 연결해 재렌더링 때 중복 등록하지 않습니다.
- `router.js`는 화면 전환 전에 Leaflet 지도와 활동 경과 타이머를 정리합니다.
- 코스·식당 데이터의 기존 ID는 저장 기록과 연결되므로 임의로 바꾸지 않습니다.
- 위치는 사용자 동작 시 한 번만 확인합니다. 사진 원본과 실시간 이동 경로를 LocalStorage에 저장하지 않습니다.
- Django 동기화를 함께 사용할 때만 `config.js`의 `DJANGO_API_URL`을 같은 출처의 상대 URL로 설정합니다. GitHub Pages 기본 배포에서는 빈 값으로 둡니다.
- 운영 전 실제 코스·식당 정보 검수, 개인정보처리방침, 서버 인증과 관리자 권한을 별도로 마련해야 합니다.
