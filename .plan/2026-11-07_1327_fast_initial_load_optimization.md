# 초기 창 열림 및 첫 데이터 로딩 속도 최적화 계획서

- **작성 일시 (KST)**: 2026-11-07 13:27
- **대상 파일**:
  - `c:\Users\user\Desktop\appsscript\25-timetable\Code.gs`
  - `c:\Users\user\Desktop\appsscript\25-timetable\index.html`

---

## 1. 초기 로딩 지연의 핵심 원인 진단

창이 켜진 후(인메모리 로드 완료 후)의 조회·탭 전환 속도는 즉시(0ms) 동작하지만, **처음 창이 켜지고 초기 데이터를 읽어오는 단계**에서 다음 5가지 병목이 중첩되어 발생하고 있습니다.

### ① [가장 치명적] `CacheService` 100KB(UTF-8 바이트) 초과로 인한 서버 캐시 100% 실패 (`Code.gs`)
- Google Apps Script `CacheService`의 단일 키 최대 용량은 글자 수가 아닌 **UTF-8 바이트 기준 100KB(102,400 Bytes)**입니다.
- 한글 1글자는 UTF-8에서 **3바이트**를 차지합니다. 현재 `CACHE_CHUNK_SIZE = 80000`(8만 글자)으로 설정되어 있어, 한글이 많은 시간표 + 학생명렬(약 477명) JSON에서는 단일 청크 크기가 **약 130KB~160KB**에 달합니다.
- 이로 인해 `putCachedJson_()` 내 `cache.putAll()` 호출 시 `Argument too large: value` 예외가 발생하고 `catch (e) {}`에 의해 조용히 무시되면서 **서버 캐시가 전혀 저장되지 않는 상태(100% 캐시 미스)**가 지속되고 있습니다.
- 결과적으로 창을 열 때마다 `doGet()`이 캐시를 찾지 못해 `initialJson = null`을 반환하고, 창이 열린 뒤 매번 6개 시트(`주간시간표`, `학급시간표`, `선택과목2·3학년`, `학생명렬2·3학년`, `교사그룹`)를 스프레드시트 원본에서 처음부터 다시 읽고 파싱하느라 초기 로딩에 수 초가 소요됩니다.

### ② 학생명렬(`students`) JSON 페이로드의 중복 필드 직렬화 (`Code.gs`)
- `parseStudentElectiveRows_()`에서 학생 객체마다 정식 키와 축약 키(`name`/`n`, `grade`/`g`, `classNum`/`c`, `num`/`no`, `classKey`/`ck`, `electives`/`ch`)를 **모두 중복 생성**하여 전송하고 있습니다.
- 클라이언트(`index.html`)의 `normalizePayloadStudents_()`가 이미 축약 키를 정식 키로 즉시 복원하므로, 서버에서는 축약 키만 직렬화하면 학생 페이로드 크기를 **55% 이상 축소**할 수 있습니다.

### ③ `<head>` 내 외부 엑셀 라이브러리(`xlsx.full.min.js`) 렌더 블로킹 (`index.html`)
- `index.html` 7행의 `<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>`에 `defer` 속성이 없어, 브라우저가 첫 화면 DOM을 그리고 `initApp()`을 실행하기 전에 외부 CDN에서 약 900KB(압축 300KB)의 스크립트를 내려받아 컴파일할 때까지 창 표시가 멈춥니다.

### ④ 초기 부팅 시 중복 서버 RPC 호출 및 `ss.getSheets()` 3중 호출 (`Code.gs` & `index.html`)
- 초기 시간표 페이로드(`payload`) 안에 이미 `semesterSets`와 `activePrefix`가 포함되어 있음에도, `initApp()` 실행 200ms 후 `syncProjectsFromServerInBackground_()`(`getServerProjectsBundle`)를 또 호출하여 서버에서 `SpreadsheetApp`을 중복 실행하고 있습니다.
- 또한 `buildTimetablePayloadFromRealSheets_()` 내부에서 `ensureDefaultSemesterSheetNames_(ss)`, 본문, `discoverSemesterSheetSets_(ss)`가 각각 `ss.getSheets()`와 `sheet.getName()`을 별도로 호출(총 3회 반복)하여 불필요한 SpreadsheetApp RPC 지연이 발생합니다.

### ⑤ `localStorage` 대용량 페이로드 이중 직렬화 (`index.html`)
- 초기 데이터 수신 시 `STORAGE_KEY`에 전체 페이로드를 `JSON.stringify`로 저장하고, 동시에 `PROJECTS_STORAGE_KEY` 내부에도 동일한 `payload` 전체를 또 `JSON.stringify`로 저장·로드하고 있어 부팅 시 `JSON.parse`/`JSON.stringify` 비용이 2배로 발생합니다.

---

## 2. 세부 개선 계획

### Step 1. 서버 멀티청크 캐시(`CacheService`) 안정화 및 콜드 스타트 프리워밍 (`Code.gs`)
1. **안전한 청크 크기 적용**:
   - `CACHE_CHUNK_SIZE`를 `80000`에서 **`30000`(3만 글자, 한글 100% 기준 최대 90KB, 실제 평균 45~55KB)**으로 조정하여 Apps Script `CacheService`의 100KB 제한을 100% 안전하게 통과하도록 수정합니다.
   - `clearTimetableCache_()`에서 제거하는 청크 키 범위를 `0 ~ 14`까지 확장하고, `CACHE_KEY_PREFIX`를 `'TT_FAST_V7_'`로 갱신합니다.
2. **`doGet()` 서버 인라인 주입 보장**:
   - `getCachedJsonFast_()`가 정상 동작하게 되면, 창을 열 때 `doGet()` 단계에서 이미 캐시된 JSON이 HTML 내부(`SERVER_INLINE_RAW`)에 **~5ms** 만에 인라인 주입되어 추가 네트워크 왕복 없이 **창이 켜지자마자 데이터가 즉시 표시**됩니다.

### Step 2. 학생명렬(`students`) 전송 페이로드 경량화 및 시트 스캔 1회 통합 (`Code.gs`)
1. **학생 객체 중복 키 제거 (`parseStudentElectiveRows_`)**:
   - 서버에서 생성하는 학생 항목은 축약 키(`{ id, n, g, c, no, ck, ch, art }`)만 포함하도록 경량화하고, 클라이언트 `normalizePayloadStudents_()`에서 기존처럼 정식 속성(`name`, `grade`, `classNum`, `num`, `classKey`, `electives`)을 자동 복원합니다.
2. **스프레드시트 시트 목록(`ss.getSheets()`) 1회 조회 재사용**:
   - `buildTimetablePayloadFromRealSheets_()` 진입 시 `ensureDefaultSemesterSheetNames_(ss)`가 먼저 레거시 시트명이 있을 때만 변경을 수행하고, 변경된 시트 배열과 시트명 배열(`allSheets`, `allSheetNames`)을 반환하여 `discoverSemesterSheetSets_(ss, allSheets, allSheetNames)`까지 단일 시트 목록을 재사용하도록 개선합니다.
   - 레거시 `'교사묶음'` 시트 A1 셀 검사는 시트명에 `'교사묶음'`이 실제로 포함된 경우에만 수행되므로 불필요한 RPC가 발생하지 않도록 유지합니다.

### Step 3. 초기 렌더링 블로킹 제거 및 부팅 시퀀스 경량화 (`index.html`)
1. **SheetJS(`xlsx.full.min.js`) 비동기 지연 로드(`defer`)**:
   - `<script defer src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>`로 변경하여 초기 창 열림과 첫 화면 렌더링이 외부 CDN 다운로드에 블로킹되지 않도록 합니다.
2. **`initApp()` 중복 백그라운드 RPC 제거**:
   - `SERVER_INLINE_RAW` 또는 서버 응답으로 이미 `semesterSets`가 포함된 데이터를 받은 경우, 불필요한 `syncProjectsFromServerInBackground_()` 중복 호출을 생략합니다.
   - 로컬 캐시(`STORAGE_KEY`)로 즉시 화면을 먼저 그린 뒤 백그라운드에서 서버 변경 여부를 확인할 때는 전체 재파싱 대신 가벼운 `revalidateSheetInBackground_()`(또는 캐시 우선 `refreshFromSheet`)만 1회 수행하도록 정리합니다.
3. **`PROJECTS_STORAGE_KEY` 경량화**:
   - `PROJECTS_STORAGE_KEY`에는 학기 메타데이터(시트명, 학급·교사·학생 수 등)만 저장하고 대용량 `payload` 본문은 `STORAGE_KEY`에만 단일 저장하도록 하여 초기 `localStorage` 파싱/저장 속도를 2배 이상 단축합니다.

---

## 3. 기대 효과

| 구간 | 기존 상태 | 개선 후 기대 속도 |
| :--- | :--- | :--- |
| **첫 화면 HTML 표시** | `xlsx.full.min.js` 동기 다운로드 대기 (~0.5~1.2초 블로킹) | **즉시 렌더링 (<0.1초)** |
| **초기 데이터 로딩 (평상시 / 캐시 히트)** | 100KB 초과로 캐시 저장 실패 → 매번 6개 시트 전체 재파싱 (2.5~4.5초) | **`doGet` 인라인 캐시 주입으로 창 열림과 동시에 즉시 표시 (~0.05초)** |
| **초기 데이터 로딩 (시트 수정 직후 / 콜드 스타트)** | `ss.getSheets()` 3중 호출 + 대용량 중복 JSON 직렬화 + 중복 RPC 경쟁 | **로컬 캐시 즉시 표시(0초) + 단일 RPC 및 시트 1회 스캔으로 체감 대기 시간 대폭 단축** |
| **창이 켜진 후 검색/탭 전환** | 인메모리 0ms (기존 동일) | **인메모리 0ms 그대로 유지** |

