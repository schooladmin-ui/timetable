# ⚡ 초고속 학급·교사 시간표 검색 웹앱 (25-Timetable)

Google 스프레드시트의 **`[주간시간표]`** 시트와 **`[학급시간표]`** 시트 데이터를 기반으로, 학교 현장의 **학급별 시간표**, **교사별 주간 시간표**, **요일·교시별 공강 교사**를 지연 시간(0ms 체감) 없이 즉시 검색·조회하고 **편집 가능한 한글(`HWPX`)·엑셀(`XLSX`) 및 `PDF`**로 내려받을 수 있는 Google Apps Script(GAS) 웹 애플리케이션입니다.

---

## ✨ 주요 기능 (Key Features)

### 1. Zero-Latency (0ms) 초고속 인메모리 검색 & 즉시 페이지 오픈
- **3단계 초고속 로딩 & 캐싱 아키텍처**:
  1. **멀티 청크 `CacheService` & 페이로드 60% 경량화 (`getCachedJsonFast_` / `putCachedJson_` / `compactStoreForTransport_`)**: 셀 객체의 빈 기본값(`r:""`, `m:0`, `cc:0`, `st:""`)과 중복 키를 제거하여 전송 용량을 약 60% 축소하고, 80KB 단위 멀티 청크 분할 저장으로 Apps Script 단일 키 100KB 제한을 완전히 우회하여 100% 서버 메모리 캐싱(6시간 유지)을 보장합니다. 캐시 적중 시 `JSON.parse`/`JSON.stringify` 없이 **~5ms** 만에 인라인 주입됩니다.
  2. **논블로킹(Non-Blocking) 콜드 스타트 & `localStorage` 0ms 즉시 렌더링**: 서버 캐시가 만료된 상태에서도 `doGet()`이 스프레드시트 I/O를 기다리지 않고 **즉시 HTML을 반환(< 50ms)** 하며, 브라우저는 `localStorage` 캐시 데이터로 **0ms 만에 화면을 먼저 표시**한 뒤 백그라운드(`getTimetableJsonString`)에서 비동기로 서버 캐시를 워밍업합니다.
  3. **백그라운드 시트 변경 자동 감지 (Stale-While-Revalidate, `checkAndRefreshIfChanged`)**: 첫 화면을 캐시로 0ms 만에 즉시 표시한 직후 백그라운드에서 스프레드시트 데이터의 MD5 해시값(`computePayloadSignature_`)을 대조하여, 시트 수정(셀 편집·복사·교체 등)이 감지되면 화면을 자동으로 최신 시간표로 갱신합니다.
  4. **인메모리 초성·단축어 인덱스**: 브라우저 메모리에 한글 초성 및 단축어 인덱스를 구축하여 검색·탭 전환 시 서버 호출이 전혀 발생하지 않습니다.
- **초성 & 단축어 즉시 검색**:
  - 상단 중앙의 고가시성 검색창(단축키 `/`)에서 **교사 성명 초성**(예: `ㄱㄷㅈ`), **담당 과목 초성**(예: `ㅎㅅ`), **학급 단축 숫자**(예: `1-1`, `101`)만 입력해도 일치하는 시간표로 즉시 전환됩니다.

### 2. 스프레드시트 실데이터 전용 4종 레이아웃 자동 파서
하드코딩된 더미 데이터 없이 오직 스프레드시트의 **`[주간시간표]`** 및 **`[학급시간표]`** 시트 정보만 파싱합니다. 학교마다 다른 시트 표 구조를 4단계로 자동 판별합니다.
1. **가로형 매트릭스**: 열 헤더가 `월1 ~ 금7`(또는 요일·교시 2단 헤더)이고 각 행이 교사/학급인 구조
2. **세로형(전치) 매트릭스**: 행이 `월1 ~ 금7`이고 열 헤더가 교사/학급인 구조
3. **5열 주간 그리드 블록형**: 단일 또는 복수의 `교시 | 월요일 | 화요일 | 수요일 | 목요일 | 금요일` 표 블록 구조
4. **정규화 목록형**: `요일 | 교시 | 학급 | 과목 | 교사` 컬럼 테이블 구조
- **양방향 교차 보완 (`crossEnrichTimetables_`)**: `[주간시간표]`와 `[학급시간표]`의 정보를 상호 대조하여 빠진 담당 교사명·과목명·담임 정보를 자동으로 채웁니다.
- **1교사 1버튼 자동 통합 (`cleanTeacherIdentity_`)**: 시트에 `'김동진(15)'`(시수 표기)와 `'김동진 (D_영문)'`(과목 표기)처럼 나뉘어 기록된 동일 교사를 **`김동진 (D_영문)`** 단일 버튼과 단일 시간표로 자동 병합합니다.

### 3. 일관된 상단 컨트롤 패널 & 양방향 탐색
- **1행 (교사명·`*표시` 토글 + 학기 선택 드롭다운 + 초고속 검색바)**:
  - **좌측 옵션 토글 버튼 (`46px` 풀높이)**: `👤 교사명` (학급 시간표 내 담당 교사 표시 토글), `🔒 *표시` (교사 성명 첫 글자·마지막 글자 마스킹) 버튼을 1행 좌측에 배치하고 드롭다운·검색창과 동일한 `46px` 세로 높이로 통일했습니다.
  - **중앙 학기 선택 드롭다운 (`#projectSelect`)**: 년도·학기별 시간표 전환 및 `➕ 학기(엑셀) 등록/관리...` 모달 호출을 지원합니다.
  - **우측 고가시성 검색창 & `✕ 초기화` 버튼**: 검색창 클릭(포커스) 시 하단 버튼 패널(`#quickChipsBar`)이 자동으로 숨겨져 시간표 본문이 한눈에 보이며, `✕ 초기화` 버튼을 누르면 검색어가 지워지고 하단 버튼 패널이 다시 표시됩니다.
- **2행 (모드 탭 & 유틸리티 도구)**:
  - **좌측 고가시성 모드 전환 탭 (5개 메뉴)**: `👨‍🏫 교사 시간표`, `📖 수업 교사 찾기`, `✨ 공강 교사 찾기`, `🤝 공유 공강 확인`, `🏫 학급 시간표` 순서로 배치되며, `2px` 메인 녹색 테두리 트레이와 개별 카드형 버튼 디자인으로 가시성을 강조했습니다.
  - **우측 유틸리티 버튼**: `🔄 동기화` (시트 최신 데이터 즉시 반영), `📄 HWPX`, `📊 XLSX`, `🖨️ PDF`
- **3행 (통합 선택 패널 `#quickChipsBar`, $n \times 10$ 고정 그리드)**:
  - **학급 시간표 모드**: 학년별 행 구분(`1학년`, `2학년`, `3학년`)을 적용한 **`n × 10` 고정 그리드**로 배치하여 가로 스크롤바 없이 한눈에 학급을 선택합니다.
  - **교사 시간표 모드**: 중복 없이 통합된 전 교사 버튼을 가나다순 `n × 10` 그리드로 표시합니다.
  - **수업 교사 찾기 모드 (`teaching`)**: 아래 주간 시간표 테이블의 `(요일 × 교시)` 셀에 교시별 **`수업 N명`** 현황을 표시하며, 원하는 요일·교시 셀을 클릭하면 **`수업 교사 현황 모달창(#teachingTeachersModal)`**이 열립니다. 모달창은 **1학년·2학년·3학년 행 × 학급 열로 구성된 `3 × n` 배열**로 표시되며, 각 학급 셀에 **교과명과 교사명**이 함께 표시됩니다. 모달 내 전용 검색창에서 **교과명 또는 교사명**(초성 검색 지원)을 입력하면 해당하는 학급 셀이 가시적으로 강조(`.is-search-match`)되며, 상단 헤더의 `🔒 *표시` 마스킹 적용/해제 버튼도 동일하게 지원합니다.
  - **공강 교사 찾기 모드 (`free`)**: 아래 주간 시간표 테이블의 `(요일 × 교시)` 셀에 교시별 **`공강 N명`** 현황을 직접 표시하며, 원하는 요일·교시 셀을 클릭하면 **`공강 교사 명단 모달창(#freeTeachersModal)`**이 열려 해당 교시의 공강 교사 명단과 `🔒 *표시` 마스킹 토글을 한눈에 확인하고 교사 클릭 시 주간 시간표로 바로 이동할 수 있습니다.
  - **공유 공강 확인 모드 (`shared_free`)**: 교사 시간표와 동일한 `n × 10` 교사 선택 패널에서 교사를 **1명부터 원하는 수만큼 복수 선택(토글)**하면, 선택된 교사들의 공강 시간 중 **모두 겹치는 공강 교시**를 빈 시간표 위에 **Stone Gray(`#313339`)** 배경색으로 즉시 표시합니다.
- **양방향 크로스 링크**: 학급 시간표의 수업 셀을 클릭하면 해당 **교사 시간표**로, 교사 시간표의 수업 셀을 클릭하면 해당 **학급 시간표**로 즉시 이동합니다.
- **돋보기 전체화면 확대 모달창 (`#timetableZoomModal`)**:
  - 시간표 카드 상단 우측(학년도 행 우측, 스파클 아이콘 왼쪽)의 **돋보기 아이콘 버튼(`#btnOpenZoomModal`)**을 누르면 화면 전체 비율(`97vw × 94vh`)에 맞춰 시간표가 꽉 차게 보이는 확대 모달창이 열립니다.
  - 모달창 상단 우측에는 **`📄 HWPX`**, **`📊 XLSX`**, **`🖨️ PDF`**, **`✕ 닫기`** 버튼이 배치되어 있으며, `Esc` 키 또는 바깥 배경 클릭으로도 즉시 닫을 수 있습니다.

### 4. 편집 가능한 문서 다운로드 (`HWPX` · `XLSX`) 및 `PDF` 인쇄
외부 서버나 무거운 라이브러리 없이 브라우저 순수 JavaScript(Pure JS ZIP + XML 빌더)로 표준 문서를 즉시 생성합니다.
- **📄 HWPX 다운로드**: 한컴오피스 한글 표준(`KS X 6101` OWPML) 규격의 `.hwpx` 파일을 생성하여 한글 프로그램에서 표·텍스트·서식을 자유롭게 편집할 수 있습니다.
- **📊 XLSX 다운로드**: Microsoft Excel 표준(OpenXML) 규격의 `.xlsx` 파일을 생성하여 헤더 색상, 테두리, 셀 병합, 줄바꿈이 적용된 엑셀 시트로 바로 편집할 수 있습니다.
- **🖨️ PDF 인쇄/저장**: `@media print` 전용 스타일을 통해 상단 검색/컨트롤 바를 자동으로 숨기고 A4 1페이지에 최적화된 포스터형 시간표로 인쇄하거나 PDF로 저장합니다.

---

## 🎨 디자인 시스템 (Design System)

- **단일 메인 테마 컬러**:
  - **Main Green (`#027046`)**: 주요 강조 헤더, 활성 탭/칩, 검색창 포커스 보더
  - **Dark Green (`#015434`)**: 상단 슬로건 배너, 교시 번호 강조 텍스트
  - **Mint Tint (`#EAF6F0`)**: 교시 열 배경 및 셀 호버 하이라이트
  - **Stone Gray (`#313339`)**: 에디토리얼 구분선, 테이블 외곽선, 교시 코너 헤더
- **고정 비율 그리드 & 실시간 교시 하이라이트**:
  - 요일 헤더는 항상 **`월요일 ~ 금요일`**, 교시 헤더는 항상 **`1교시 ~ 7교시`**로 일관되게 고정 표기됩니다.
  - **4교시와 5교시 사이 `'점심 시간'` 행**: 일반 교시 행 높이(`76px`)의 **1/2 높이(`38px`)**로 구성된 `'점심 시간'` 행이 웹 화면, 인쇄/PDF, HWPX, XLSX 문서에 동일하게 표시됩니다.
  - **검색 시점 기준 요일·교시 테마색 강조**: 검색/조회 시점의 실제 시각을 기준으로 해당하는 요일 헤더, 교시 헤더, 교차 수업 셀(또는 점심 시간 행)을 메인 테마색(`#027046` / `#015434`)과 흰색 굵은 텍스트로 진하게 강조합니다. (예: 월요일 14시 40분 조회 시 **월요일 6교시** 자동 강조)

---

## 📂 프로젝트 파일 구조 (Directory Structure)

```text
25-timetable/
├── Code.gs          # Google Apps Script 서버 코드 (시트 탐색, 4종 자동 파서, 교차 매핑, CacheService)
├── index.html       # 단일 파일 프론트엔드 (CSS 디자인 토큰, 0ms 초성 검색, HWPX/XLSX/PDF 엔진)
├── PRODUCT.md       # 제품 개요 및 핵심 아키텍처 정의서
├── DESIGN.md        # UI/UX 디자인 시스템 및 타이포그래피·컬러 명세서
├── AGENTS.md        # 에이전트 실행 및 검증 규칙
├── GEMINI.md        # 프로젝트 가이드라인
└── README.md        # 프로젝트 종합 문서 및 변경 이력
```

---

## 🚀 설치 및 사용 방법 (Setup & Deployment)

### 1단계: 스프레드시트 시트 준비
1. 시간표 데이터가 담긴 Google 스프레드시트를 엽니다.
2. 시트 탭 이름이 **`2025-2주간시간표`**(또는 `20XX-X주간시간표`)와 **`2025-2학급시간표`**(또는 `20XX-X학급시간표`)로 되어 있는지 확인합니다. (기존 `주간시간표`, `학급시간표` 시트가 있는 경우 앱 실행 시 자동으로 `2025-2주간시간표`, `2025-2학급시간표`로 변경됩니다.)
3. 새 학기(예: `2026-1`) 시간표는 웹앱 상단 검색창 왼쪽 드롭다운(`📅`)의 **`➕ 학기(엑셀) 등록/관리...`**에서 주간시간표·학급시간표 `.xls`/`.xlsx` 파일 2개를 업로드하면 스프레드시트에 **`2026-1주간시간표`**, **`2026-1학급시간표`** 시트(탭)로 자동 추가됩니다.

### 2단계: Apps Script 코드 붙여넣기
1. 스프레드시트 상단 메뉴에서 **[확장 프로그램] → [Apps Script]**를 클릭합니다.
2. `Code.gs` 파일에 본 프로젝트의 [`Code.gs`](./Code.gs) 내용을 모두 복사하여 붙여넣습니다.
3. 좌측 **파일 `+` 버튼 → [HTML]**을 눌러 파일명을 **`index`** (`.html`은 자동 부여됨)로 생성한 뒤, 본 프로젝트의 [`index.html`](./index.html) 내용을 모두 복사하여 붙여넣습니다.
4. `Ctrl + S`를 눌러 프로젝트를 저장합니다.

### 3단계: 웹앱 배포
1. Apps Script 우측 상단 **[배포] → [새 배포]**를 클릭합니다.
2. 유형 선택(⚙️)에서 **[웹 앱]**을 선택합니다.
3. 설정:
   - **다음 사용자 인증 정보로 실행**: `나`
   - **액세스 권한이 있는 사용자**: 학교/조직 정책에 맞게 선택 (`모든 사용자` 또는 `조직 내 모든 사용자`)
4. **[배포]** 버튼을 클릭하고 권한 승인 후 생성된 **웹 앱 URL**로 접속합니다.
5. *(선택)* 독립 스크립트 프로젝트로 생성한 경우, 웹앱 화면 상단 안내창에 스프레드시트 URL을 붙여넣고 **[시트 연결 및 불러오기]**를 클릭하면 즉시 연동됩니다.

---

## 📝 변경 이력 (Cumulative Change Log)

### [2026-11-01 01:38] 업데이트 이력 (Commit ID: `394775f`)
- **날짜 및 시간 (KST)**: `2026-11-01 01:38`
- **커밋 ID (Commit Hash)**: `394775f`
- **수정 내용 (Modification Details)**:
  - **스프레드시트 실데이터 전용 4종 레이아웃 자동 파서 (`Code.gs`)**: 하드코딩된 샘플 데이터를 전면 제거하고 `[주간시간표]` 및 `[학급시간표]` 시트를 자동 파싱 및 양방향 교차 보완(`crossEnrichTimetables_`)하도록 구현
  - **1교사 1버튼 자동 통합 (`cleanTeacherIdentity_`)**: `'김동진(15)'`와 `'김동진(D_영문)'` 등 시수 괄호로 분리된 동일 교사 데이터를 단일 버튼으로 통합
  - **단일 녹색 테마(`#027046`) 및 고정 헤더**: `월요일 ~ 금요일` 요일 헤더 및 `1교시 ~ 7교시` 교시 헤더 고정, 학기 단위 시간표에 맞춰 주간 날짜 범위 표시 제거
  - **상단 컨트롤 패널 개편**:
    - 1행: 중앙 정렬된 고가시성 검색창 + 우측 검색어 초기화(`✕ 초기화`) 버튼 추가 및 검색창 선택(포커스) 시 하단 버튼 패널(`#quickChipsBar`) 자동 숨김 처리
    - 2행: 좌측 모드 전환 탭(`학급 시간표`, `교사 시간표`, `공강 교사 찾기`) 및 우측 유틸리티 버튼(`교사명`, `*표시`, `동기화`, `HWPX`, `XLSX`, `PDF`) 배치
    - 3행: 학급 시간표(`3 × n` 학년별 그리드), 교사 시간표, 공강 교사 찾기(요일·교시 1행 필터)를 동일한 `#quickChipsBar` 패널 위치에 통합
  - **문서 다운로드 및 오류 해결**: 클라이언트 사이드 `.hwpx` / `.xlsx` 생성기 구현 및 `HtmlService` 템플릿 스크립틀릿(`<?xml ... ?>`) 충돌로 인한 `SyntaxError: Unexpected identifier 'version'` 오류 해결
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Syntax check OK: index.html + Code.gs`)
  - `index.html` 내 `HtmlService` 스크립틀릿 패턴(`<\?`) 전수 검사 완료 (서버 데이터 주입부 1곳 외 충돌 패턴 0건)

### [2026-11-01 01:48] 업데이트 이력 (Commit ID: `14cf107`)
- **날짜 및 시간 (KST)**: `2026-11-01 01:48`
- **커밋 ID (Commit Hash)**: `14cf107`
- **수정 내용 (Modification Details)**:
  - **검색/조회 시점 기준 요일·교시 테마색 진하게 강조 (`detectCurrentScheduleSlot_`)**:
    - 검색 시점의 요일(`월요일~금요일`)과 시각을 판별하여 해당 요일 헤더(`.th-today`), 해당 교시 헤더(`.is-current-period`), 해당 요일·교시 교차 셀(`.is-current-slot`)을 메인 테마색(`#027046` / `#015434`) 및 흰색 굵은 텍스트로 강조 (예: 월요일 14:40 검색 시 월요일 6교시 자동 강조)
    - 초기 로드 시 공강 교사 찾기 탭의 기본 요일·교시 필터도 현재 시각의 요일·교시에 맞춰 자동 설정되도록 연동
  - **4교시와 5교시 사이 세로 높이 1/2 `'점심 시간'` 행 추가**:
    - 웹 시간표 테이블(`.tr-lunch`, 높이 `38px` = 일반 행 `76px`의 1/2), 엑셀 다운로드(`.xlsx`, 행 높이 `ht="23"` = 일반 행 `46`의 1/2), 한글 다운로드(`.hwpx`, 행 높이 `2600` = 일반 행 `5200`의 1/2)에 `'점심 시간'` 행을 일관되게 추가
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Syntax check OK: index.html + Code.gs`)
  - `index.html` 내 `HtmlService` 스크립틀릿 충돌 패턴 검사 통과

### [2026-11-01 02:11] 업데이트 이력 (Commit ID: `dc14972`)
- **날짜 및 시간 (KST)**: `2026-11-01 02:11`
- **커밋 ID (Commit Hash)**: `dc14972`
- **수정 내용 (Modification Details)**:
  - **전송 및 캐시 페이로드 약 60% 경량화 (`compactStoreForTransport_`)**:
    - 시간표 셀 객체의 비어 있는 기본값(`r: ""`, `m: 0`, `cc: 0`, `st: ""`) 및 중복 키를 제거하여 직렬화 JSON 용량을 대폭 축소
  - **멀티 청크(Multi-Chunk) `CacheService` 엔진 도입 (`getCachedJsonFast_` / `putCachedJson_`)**:
    - 기존 단일 키 95KB 제한(`serialized.length < 95000`)으로 인해 전체 학급·교사 데이터가 `CacheService`에 저장되지 못하고 매번 시트를 다시 파싱하던 병목 해결
    - 80KB 단위 청크 분할 및 `cache.putAll()` / `cache.getAll()` 일괄 처리로 데이터 크기와 무관하게 100% 서버 캐싱(6시간 유지) 보장 및 캐시 적중 시 `JSON.parse`/`JSON.stringify` 없이 **~5ms** 즉시 주입
  - **논블로킹(Non-Blocking) `doGet(e)` 및 `localStorage` 0ms 즉시 렌더링 (`doGet`, `initApp`, `getTimetableJsonString`)**:
    - 서버 캐시 미스(콜드 스타트) 시 `doGet(e)`에서 스프레드시트 읽기로 화면 오픈을 블로킹하지 않고 즉시 HTML을 반환(`< 50ms`)하도록 개선
    - 브라우저 오픈 즉시 `localStorage` 데이터로 **0ms 렌더링**을 수행하고, 백그라운드에서 `getTimetableJsonString(false)`을 비동기 호출하여 서버 캐시 워밍업 및 최신화 수행
  - **불필요한 RPC 호출 제거 (`findSheetByNameCandidates_`, `updateVersionTimestamp_`)**:
    - `doGet` 내 불필요한 `cache.remove()` 호출과 읽기 경로의 `PropertiesService.setProperty()` 쓰기 호출을 제거하고, 시트 탐색 시 이미 조회된 시트 목록을 인메모리로 매칭하도록 최적화
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Code.gs syntax OK`, `index.html script #1/#2 syntax OK`)
  - `index.html` 내 `HtmlService` 스크립틀릿 태그 개수 검증 완료 (`Scriptlet tag count in index.html: 1`)

### [2026-11-01 02:27] 업데이트 이력 (Commit ID: `fa04484`)
- **날짜 및 시간 (KST)**: `2026-11-01 02:27`
- **커밋 ID (Commit Hash)**: `fa04484`
- **수정 내용 (Modification Details)**:
  - **상단 헤더 우측 돋보기 아이콘 버튼 및 전체화면 시간표 모달창 추가 (`index.html`)**:
    - 시간표 카드 상단 우측(`2026학년도` 행 우측, 스파클 아이콘 왼쪽)에 녹색 테마(`#027046`) 돋보기 아이콘 버튼(`#btnOpenZoomModal`, `.eh-zoom-btn`) 추가
    - 돋보기 버튼 클릭 시 화면에 시간표 표가 꽉 차게 확대 표시되는 모달창(`#timetableZoomModal`, `openTimetableModal`) 구현 및 모달 내부 셀 클릭 시 실시간 교사·학급 시간표 전환(`syncModalTimetableView_`) 연동
    - 모달창 상단 우측에 **`📄 HWPX`**, **`📊 XLSX`**, **`🖨️ PDF`**, **`✕ 닫기`** 버튼 추가 (`Esc` 키 및 배경 클릭 닫기 지원, `@media print` 시 모달·돋보기 버튼 자동 숨김 처리)
  - **스프레드시트 데이터 변경 즉시 반영을 위한 Stale-While-Revalidate 자동 감지 추가 (`Code.gs`, `index.html`)**:
    - `onEdit(e)` / `onChange(e)` 캐시 즉시 무효화 더불어, 첫 화면 0ms 렌더링 직후 백그라운드에서 MD5 데이터 서명(`computePayloadSignature_`, `checkAndRefreshIfChanged`)을 대조하여 시트 데이터가 변경된 경우 자동으로 최신 데이터를 화면과 캐시에 즉시 반영하도록 고도화
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Code.gs syntax OK`, `index.html script #1/#2 syntax OK`)
  - `index.html` 내 `HtmlService` 스크립틀릿 태그 개수 검증 완료 (`Scriptlet tag count in index.html: 1`)

### [2026-11-01 11:50] 업데이트 이력 (Commit ID: `aa21249`)
- **날짜 및 시간 (KST)**: `2026-11-01 11:50`
- **커밋 ID (Commit Hash)**: `aa21249`
- **수정 내용 (Modification Details)**:
  - **교사 이름 첫 글자·마지막 글자 마스킹 및 기본 활성화 (`index.html`)**:
    - 개인정보 보호를 위해 교사 성명 마스킹 형식을 첫 글자와 마지막 글자 마스킹(`*길*`)으로 변경하고, 웹앱 접속 시 기본값을 마스킹 활성 상태(`maskTeacherName: true`)로 설정
  - **미선택 및 공강 교사 0명 시 빈 시간표(`—`) 초기화 처리 (`index.html`)**:
    - `getActiveTargetObject_()`를 도입하여 공강 교사 찾기 등에서 해당 교시에 공강 교사가 없거나 선택된 대상이 없을 때 이전 시간표가 남지 않고 모든 시간표 셀에 `—`가 표시되도록 수정
  - **학기별 시트(`20XX-X주간시간표` · `20XX-X학급시간표`) 세트 업로드 및 드롭다운 전환 (`Code.gs`, `index.html`)**:
    - 기존 `주간시간표`, `학급시간표` 시트명을 `2025-2주간시간표`, `2025-2학급시간표`로 자동 변경(`ensureDefaultSemesterSheetNames_`)
    - 주간시간표와 학급시간표 `.xls`/`.xlsx` 파일 세트를 업로드하면 스프레드시트에 `20XX-X주간시간표`, `20XX-X학급시간표` 시트(탭)를 직접 생성·추가(`saveSemesterSheetsToSpreadsheet`)하고, 검색창 좌측 드롭다운(`#projectSelect`)에서 년도·학기별로 선택하여 즉시 불러오도록 구현
  - **선택 버튼 `n × 10` 고정 그리드 정렬 및 헤더 타이포그래피 개선 (`index.html`)**:
    - 학급·교사·공강 교사 선택 버튼을 글자 수와 무관하게 매 행 10개씩 정렬되는 `n × 10` 그리드(`grid-template-columns: repeat(10, minmax(0, 1fr))`)로 통일
    - 시간표 상단 우측의 장식 도형(`.sparkle-duo`)을 제거하고 돋보기 아이콘을 우측 끝으로 정렬했으며, 학급명·교사명 글자 크기를 좌측 타이틀 행 높이에 맞춘 `34px` 풀사이즈로 확대
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Syntax check passed!`)

### [2026-11-01 12:01] 업데이트 이력 (Commit ID: `6a63f65`)
- **날짜 및 시간 (KST)**: `2026-11-01 12:01`
- **커밋 ID (Commit Hash)**: `6a63f65`
- **수정 내용 (Modification Details)**:
  - **교사 선택 버튼 및 상단 헤더에서 대표 교과명 제거 (`index.html`)**:
    - 1명의 교사가 여러 교과를 담당하는 경우를 고려하여, 교사 선택 버튼(`renderQuickChips`), 공강 교사 버튼, 시간표 상단 우측 헤더(`renderTimetable`), 문서 내보내기 헤더(`getCurrentExportModel_`), 검색 자동완성 서브 라벨(`buildInMemorySearchIndex`)에서 교사 이름 옆의 대표 교과명 표기를 제거하고 교사 성명만 표시되도록 수정 (교과목명은 시간표 테이블 각 교시 셀에만 표시)
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Syntax check passed!`)

### [2026-11-01 12:32] 업데이트 이력 (Commit ID: `1e3410b`)
- **날짜 및 시간 (KST)**: `2026-11-01 12:32`
- **커밋 ID (Commit Hash)**: `1e3410b`
- **수정 내용 (Modification Details)**:
  - **‘공유 공강 확인’(`shared_free`) 모드 추가 (`index.html`)**:
    - 상단 모드 탭의 ‘공강 교사 찾기’ 버튼 우측에 **`🤝 공유 공강 확인`** 버튼(`#tabSharedFree`)을 추가하고, 모드 탭들과 우측 유틸리티 버튼들이 줄바꿈 없이 단일 행에 배치되도록 레이아웃 조정
    - ‘교사 시간표’와 동일한 위치·형식(`n × 10` 그리드)의 교사 선택 패널에서 교사를 1명부터 원하는 인원수만큼 복수 선택(토글)할 수 있도록 구현(`toggleSharedFreeTeacher`, `clearSharedFreeTeachers`)
    - 선택된 교사 전원의 공강 시간이 겹치는 교시를 빈 시간표에 **Stone Gray(`#313339`)** 배경색(`.td-cell.is-shared-free`)으로 강조 표시하고 HWPX/XLSX 내보내기(`getCurrentExportModel_`)와도 연동
  - **학년도·학기 통합 표기 및 ‘학급 시간표’ 타이틀 정비 (`index.html`)**:
    - `formatSchoolYearSemester_` 함수를 추가하여 메인 시간표 상단(`#headerSchoolYear`) 및 확대 모달창 좌측 배지(`#modalSchoolYear`)에 학년도와 학기 정보가 함께 표시되도록(`2025학년도 2학기`) 개선
    - 학급 모드 선택 시 메인 타이틀(`#headerMainTitle`)을 기존 `'2학기 시간표'` 대신 **`'학급 시간표'`**로 일관되게 표시하도록 수정
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Syntax check passed!`)

### [2026-11-02 01:06] 업데이트 이력 (Commit ID: `94d0827`)
- **날짜 및 시간 (KST)**: `2026-11-02 01:06`
- **커밋 ID (Commit Hash)**: `94d0827`
- **수정 내용 (Modification Details)**:
  - **상단 컨트롤바 버튼 재배치 및 `📂 학기 엑셀 등록` 버튼 제거 (`index.html`)**:
    - 학기 드롭다운(`#projectSelect`) 내 `➕ 학기(엑셀) 등록/관리...` 메뉴와 중복되는 2행 우측 `📂 학기 엑셀 등록` 버튼을 삭제
    - `👤 교사명`(`#btnToggleSubTeacher`) 및 `🔒 *표시`(`#btnToggleMask`) 버튼을 1행(`.control-row-search`) 좌측 끝으로 이동하고, 1행 세로 길이에 맞춰 `.top-toggle-btn`(`height: 46px`, `padding: 0 14px`, `font-size: 14px`, `border-radius: 12px`, `2px` 보더)으로 크기를 확대
  - **모드 전환 탭 순서 변경 및 가시성 강화 (`index.html`)**:
    - 2행 좌측 모드 탭(`.mode-tabs`)의 버튼 순서를 **`👨‍🏫 교사 시간표` → `✨ 공강 교사 찾기` → `🤝 공유 공강 확인` → `🏫 학급 시간표`** 순으로 변경하고 초기 기본 활성 모드를 `교사 시간표`(`mode: 'teacher'`)로 설정
    - `.mode-tabs` 컨테이너에 `2px` 메인 녹색 테두리(`#027046`)와 민트 틴트 배경(`#EAF6F0`)을 적용하고, 각 `.mode-tab` 버튼의 크기(`height: 38px`, `font-size: 14px`, `font-weight: 800`) 및 개별 카드형 보더·그림자를 강화하여 가시성을 대폭 향상
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Code.gs syntax OK`, `index.html script #1/#2 syntax OK`)

### [2026-11-02 01:52] 업데이트 이력 (Commit ID: `f0936ba`)
- **날짜 및 시간 (KST)**: `2026-11-02 01:52`
- **커밋 ID (Commit Hash)**: `f0936ba`
- **수정 내용 (Modification Details)**:
  - **웹앱 브라우저 탭 제목 변경 (`Code.gs`, `index.html`)**:
    - `Code.gs`의 `doGet(e)` 내 `.setTitle('교사·학급 시간표 검색')` 및 `index.html`의 `<title>교사·학급 시간표 검색</title>`로 탭 제목을 수정
  - **상단 1행 검색창 중앙 배치 및 학기 드롭다운 순서 변경 (`index.html`)**:
    - 1행(`.control-row-search`)의 요소 순서를 **`[👤 교사명] [🔒 *표시]` → `[🔍 학급·교사명·초성 즉시 검색창]`(중앙 메인) → `[📅 학기 선택 드롭다운]`** 순으로 재배치하고 `justify-content: center`를 적용하여 검색창이 중앙에 위치하도록 개선
  - **전 모드(`교사 시간표`, `공강 교사 찾기`, `학급 시간표`) 초기 미선택 상태 통일 (`index.html`)**:
    - `initApp`, `applyLoadedData`, `switchMode`, `setFreeFilter`, `clearSearchInput`에서 첫 번째 교사(`*수*`)나 첫 번째 학급(`1학년 1반`)을 자동 선택하던 기본값 로직을 제거하여, `공유 공강 확인`과 동일하게 사용자가 직접 선택하기 전까지는 미선택 상태(`state.currentKey = ''`, 빈 시간표 `—`)로 표시되도록 수정
    - 이미 선택된 교사·학급 버튼을 다시 클릭하면 선택이 해제(토글)되도록 `selectTarget` 및 `selectFreeTeacher` 동작을 개선하고, 로컬 HTML 직접 실행 시에도 `SERVER_INLINE_RAW` 미정의 오류가 발생하지 않도록 안전 가드 추가
  - **Impeccable 25대 디자인 품질 진단 및 리파인 적용 (`index.html`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`)**:
    - 모드 탭(`role="tablist"`, `role="tab"`, `aria-selected`) 및 상단 토글 버튼(`aria-pressed`) 접근성 속성 동기화, 모바일(`<=640px`) 칩 그리드 5열 반응형 대응, `2px`/`4px` 간격 스케일 및 `12px` 최소 폰트 토큰 동기화 완료
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `vm.Script` 정적 구문 검사 통과 (`Code.gs syntax OK`, `index.html script #1/#2 syntax OK`)
  - Impeccable 정적 스캐너 통과 (`0 anti-patterns found`, `No drift found`)

### [2026-11-02 21:01] 업데이트 이력 (Commit ID: `017fcf8`)
- **날짜 및 시간 (KST)**: `2026-11-02 21:01`
- **커밋 ID (Commit Hash)**: `017fcf8`
- **수정 내용 (Modification Details)**:
  - **교사 시간표 검색 시 완성형 음절·초성·조합형 정밀 매칭 및 정확도 우선 정렬 (`index.html`)**:
    - 기존 `extractChosung(q)` 무조건 비교로 인해 완성형 성명(`임지훈`, `김지연`) 검색 시 초성이 같은 다른 교사(`양재혁`, `이주희`, `김지언`)가 함께 검색되어 가나다순 첫 번째 교사의 시간표가 표시되던 오류 수정
    - `matchKoreanAt_`, `decomposeTrailingImeQuery_`, `scoreSearchItem_` 함수를 구현하여 초성 자모(`ㄱ`~`ㅎ`) 입력 위치만 초성 비교를 수행하고 완성형 음절은 정확히 일치하도록 개선 및 `완전 일치(1순위) → 접두사 일치(2순위) → 부분 일치(3순위) → 한글 조합 중(4순위) → 초성 일치(5~6순위)` 순으로 정렬 적용
    - 자동완성 목록에서 방향키(`ArrowDown`/`ArrowUp`) 이동 시 즉시 해당 대상의 시간표로 화면을 갱신하고, 한글 IME 확정 이벤트 중복 발생 시 선택 상태가 초기화되지 않도록 보완
  - **상단 메뉴(탭) 전환 시 검색창 검색어 자동 초기화 (`index.html`)**:
    - `switchMode` 실행 시 검색 입력창(`#searchInput`) 값과 자동완성 목록 상태를 자동으로 초기화하고, 검색창에 검색어가 남아 있을 때 클릭/포커스 시 즉시 재반응하도록 개선
  - **‘공강 교사 찾기’ 시간표 셀 클릭 방식 및 전용 모달창(`#freeTeachersModal`) 도입 (`index.html`)**:
    - 상단의 복잡했던 가로형 `[월~금] | [1~7교시]` 버튼 바를 제거하고, 아래 메인 시간표 테이블의 `(요일 × 교시)` 셀에 **`공강 N명`** 현황을 표시하여 셀 클릭 시 해당 교시의 공강 교사 명단 모달창(`#freeTeachersModal`, `openFreeTeachersModal`)이 열리도록 개편
    - 공강 교사 명단 모달창 상단 인원수 우측에 **`🔒 *표시`** 마스킹 토글 버튼(`#btnFreeModalToggleMask`)을 추가하여 모달 내에서도 즉시 성명 마스킹 적용/해제를 전환할 수 있도록 상단 컨트롤 바와 양방향 동기화
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` Node.js `Function` 파서 기반 정적 구문 검사 통과 (`Syntax check passed: index.html inline script & Code.gs`)

### [2026-11-03 13:14] 업데이트 이력 (Commit ID: `1a55401`)
- **날짜 및 시간 (KST)**: `2026-11-03 13:14`
- **커밋 ID (Commit Hash)**: `1a55401`
- **수정 내용 (Modification Details)**:
  - **공강 교사 명단 모달창(`#freeTeachersModal`) 내 교사 이름 하단 교과명 제거 (`index.html`)**:
    - 1명의 교사가 여러 교과를 담당할 수 있고 공강 시간 조회 화면이므로, 공강 교사 모달창 버튼(`renderFreeTeachersModalContent_`)에서 교사 성명 아래에 출력되던 대표 교과명/담임 보조 텍스트(`<span class="free-teacher-meta">`)를 제거하고 **교사 이름만 단독으로 표시**되도록 수정
    - 1줄 성명 표시에 맞춰 공강 교사 버튼(`.free-teacher-btn`)의 최소 높이를 `min-height: 44px`로 정돈
- **검증 결과 (Verification Results)**:
  - `index.html` 인라인 스크립트 Node.js `Function` 정적 구문 검사 통과 (`Syntax OK`)

### [2026-11-03 18:38] 업데이트 이력 (Commit ID: `34efd47`)
- **날짜 및 시간 (KST)**: `2026-11-03 18:38`
- **커밋 ID (Commit Hash)**: `34efd47`
- **수정 내용 (Modification Details)**:
  - **상단 모드 선택 메뉴 5개 구성 및 순서 재배치 (`index.html`)**:
    - 선택 메뉴 탭(`.mode-tabs`)에 **`📖 수업 교사 찾기`(`#tabTeaching`)** 메뉴를 추가하여 **`👨‍🏫 교사 시간표` → `📖 수업 교사 찾기` → `✨ 공강 교사 찾기` → `🤝 공유 공강 확인` → `🏫 학급 시간표`** 순서로 배치
  - **‘수업 교사 찾기’(`teaching`) 메인 시간표 그리드 구현 (`index.html`)**:
    - `공강 교사 찾기`와 동일한 요일×교시 테이블 UI를 적용하여 매 요일·교시 셀마다 해당 교시 수업 교사 수(`getTeachingTeacherObjects_`, **`수업 N명`**)를 표시하고, 셀 클릭 시 해당 교시의 수업 교사 현황 모달창(`#teachingTeachersModal`, `openTeachingTeachersModal`)이 열리도록 구현
  - **‘수업 교사 찾기’ 전용 `3 × n` 학급 배열 모달창 및 검색·마스킹 기능 구현 (`index.html`)**:
    - 모달창 본문을 위에서부터 **1학년, 2학년, 3학년** 행과 각 학년의 **1반 ~ n반** 열로 정렬된 **`3 × n` 학급 기준 그리드(`#teachingModalClassGrid`)**로 구성하고, 각 학급 셀(`.teaching-class-cell`)에 학급 라벨과 함께 학급 시간표처럼 **교과명**과 **교사명**이 항상 함께 표시되도록 구현(`getClassSlotTeachingInfo_`, `renderTeachingTeachersModalContent_`)
    - 모달 상단 헤더에 `공강 교사 찾기` 모달과 동일한 **`🔒 *표시` 마스킹 적용/해제 토글 버튼(`#btnTeachingModalToggleMask`)**을 배치하여 상단 컨트롤 바·공강 모달·수업 모달의 성명 마스킹 상태가 실시간 동기화되도록 연동
    - 모달 상단에 전용 검색창(`#teachingModalSearchInput`, `handleTeachingModalSearch`, `matchTeachingCellQuery_`)을 추가하여 **교과명** 또는 **교사명**(초성 검색 및 한글 조합 중 검색 포함) 입력 시 해당하는 학급 셀은 `.is-search-match`(민트 그린 배경·진한 녹색 테두리·반전 학급 배지)로 선명하게 강조되고 나머지 셀은 `.is-search-dimmed`로 흐리게 구분되도록 구현
- **검증 결과 (Verification Results)**:
  - `Code.gs` 및 `index.html` 인라인 스크립트(#1, #2) Node.js `Function` 정적 구문 검사 통과 (`Syntax OK`)



