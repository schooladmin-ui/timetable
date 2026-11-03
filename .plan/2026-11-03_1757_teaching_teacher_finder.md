# 수업 교사 찾기(Teaching Teacher Finder) 메뉴 및 3×N 학급별 수업 현황 모달 구현 계획서

- **작성 일시 (KST)**: 2026-11-03 17:57
- **대상 파일**: `c:\Users\user\Desktop\appsscript\25-timetable\index.html`
- **모드**: `/ask` 계획서 작성 전용 (코드 미수정 상태, `/apply` 명령 시 즉시 반영)

---

## 1. 요구사항 요약

1. **선택 메뉴(탭) 추가 및 순서 변경 (총 5개 탭)**
   - 순서: **`교사 시간표` → `수업 교사 찾기` → `공강 교사 찾기` → `공유 공강 확인` → `학급 시간표`**
2. **`수업 교사 찾기` 메인 시간표 그리드 UI**
   - `공강 교사 찾기`와 동일한 레이아웃 및 동작 방식 적용.
   - 매 요일(월~금) × 교시(1~N교시) 셀에 해당 교시의 **수업 교사 수(`수업 N명`)**가 표시되며, 셀을 클릭하면 해당 요일·교시의 **수업 교사 모달창**이 열림.
3. **`수업 교사 찾기` 모달창 UI (3×n 학급 기준 배열)**
   - 모달창 본문은 **학급 기준 3×n 배열(Grid)**로 표시.
   - **행(Row)**: 위에서부터 **1학년, 2학년, 3학년** (각 행은 학년 단위로 구분).
   - **열(Column)**: 각 학년의 **1반 ~ n반(학급)** 순서로 정렬.
   - **각 셀(Cell)**: 학급명(예: `1-1`)과 함께 학급 시간표처럼 **교과명**과 **교사명**을 동시에 표시 (`👤 교사명` 상단 토글 상태와 무관하게 모달 내에서는 항상 교과명 + 교사명 표시, `🔒 *표시` 마스킹 토글은 실시간 연동).
4. **모달창 내 실시간 검색창 및 가시적 하이라이트**
   - 모달창 내부에 전용 검색창을 배치하여 사용자가 **교과명** 또는 **교사명**(초성 검색 및 한글 조합 중 검색 포함)을 입력할 수 있음.
   - 검색어 입력 시 해당하는 학급 셀은 **강하게 하이라이트(`.is-search-match`)** 되고, 해당하지 않는 셀은 **흐리게(`opacity` 축소, `.is-search-dimmed`)** 처리되어 3×n 배열 내에서 즉각 구분됨.
5. **모달창 내 교사명 마스킹(`🔒 *표시`) 적용/해제 토글 버튼**
   - `공강 교사 찾기` 모달창(`#btnFreeModalToggleMask`)과 동일한 위치·스타일의 **`🔒 *표시` 마스킹 적용/해제 버튼(`#btnTeachingModalToggleMask`)**을 `수업 교사 찾기` 모달창 헤더에 배치.
   - 버튼 클릭 시 `toggleMaskTeacherName()`이 호출되어 상단 컨트롤 바·공강 교사 모달·수업 교사 모달의 마스킹 상태가 모두 동기화되며, 모달 내 3×n 학급 셀의 교사명 표시(`*길*` ↔ `홍길동`)가 검색어 하이라이트 상태를 유지한 채 즉시 전환됨.

---

## 2. 세부 설계 및 구현 계획

### Step 1. 상단 모드 탭(`mode-tabs`)에 `수업 교사 찾기` 추가
- **위치**: `index.html` 내 `.mode-tabs` 영역
- **변경 내용**:
  ```html
  <div class="mode-tabs" role="tablist">
    <button type="button" class="mode-tab active" role="tab" aria-selected="true" id="tabTeacher" onclick="switchMode('teacher')">
      👨‍🏫 교사 시간표
    </button>
    <button type="button" class="mode-tab" role="tab" aria-selected="false" id="tabTeaching" onclick="switchMode('teaching')">
      📖 수업 교사 찾기
    </button>
    <button type="button" class="mode-tab" role="tab" aria-selected="false" id="tabFree" onclick="switchMode('free')">
      ✨ 공강 교사 찾기
    </button>
    <button type="button" class="mode-tab" role="tab" aria-selected="false" id="tabSharedFree" onclick="switchMode('shared_free')">
      🤝 공유 공강 확인
    </button>
    <button type="button" class="mode-tab" role="tab" aria-selected="false" id="tabClass" onclick="switchMode('class')">
      🏫 학급 시간표
    </button>
  </div>
  ```
- `syncModeTabsUI()` 함수에 `#tabTeaching` 및 `#btnTeachingModalToggleMask` 활성화/마스킹 상태 동기화 로직을 추가합니다.

---

### Step 2. 상태(`state`) 및 수업 교사 집계 헬퍼 함수 추가
- **`state` 확장**:
  - `teachingDayIdx: 0` (현재 시각 요일 인덱스로 초기화)
  - `teachingPeriodIdx: 0` (현재 시각 교시 인덱스로 초기화)
  - `teachingModalQuery: ''` (수업 교사 모달 내 검색어 상태)
- **수업 교사 집계 함수 `getTeachingTeacherObjects_(data, dayIdx, periodIdx)`**:
  - `data.teachers`에서 `tObj.grid[periodIdx][dayIdx]`에 수업(`slot && (slot.s || slot.c)`)이 배정된 교사 객체 목록을 추출합니다.
  - 만약 `data.classes`의 특정 학급 셀(`cObj.grid[periodIdx][dayIdx]`)에만 교사명(`slot.t`)이 존재하고 `data.teachers`에 누락된 경우까지 포함하여 해당 교시 실제 수업 교사 수를 정확히 반환합니다.
- **`getActiveTargetObject_(data)` 연동**:
  - `state.mode === 'teaching'`일 때 모달에서 특정 학급/교사를 클릭해 시간표를 조회하는 경우(`state.currentKey`) 해당 교사(또는 학급) 시간표를 표시하고, 상단 `quickChipsBar`에 `'📋 X요일 Y교시 수업 현황 다시 열기'` 및 `'← 수업 교사 찾기 표로 돌아가기'` 복귀 바(`free-back-bar`)를 제공합니다.

---

### Step 3. `수업 교사 찾기` 메인 요일×교시 그리드 렌더링 (`renderTimetable`)
- `state.mode === 'teaching' && !targetObj` 분기 추가:
  - `#headerMainTitle`: `'수업 교사 찾기'`
  - `#headerSubRole`: `'요일·교시 셀을 클릭하면 학급별 수업 교사 현황이 표시됩니다'`
  - 각 요일(`0..4`) × 교시(`0..maxP-1`) 셀에:
    - `<div class="free-slot-badge">수업 N명</div>`
    - `<div class="free-slot-hint">클릭하여 현황 보기</div>` (0명일 경우 `'수업 교사 없음'`)
    - 클릭 시 `openTeachingTeachersModal(dayIdx, periodIdx)` 실행, 키보드 `Enter`/`Space` 지원(`handleTeachingSlotCellKey`).

---

### Step 4. `수업 교사 찾기` 전용 3×n 학급 배열 모달창 HTML & CSS 구현
- **모달창 구조 (`#teachingTeachersModal`)**:
  - 대화상자 폭: 1학년~3학년의 전체 학급(예: 학년당 8~12학급)이 한눈에 들어오도록 `width: min(96vw, 1280px)`, `max-height: 90vh` 적용.
  - **모달 헤더 (`tt-modal-header`)**:
    - 학년도/학기 배지(`#teachingModalBadge`), 타이틀(`#teachingModalTitle`: 예 `월요일 1교시 수업 교사`), 부가 메타(`#teachingModalSubMeta`: 예 `총 24명`), 닫기 버튼(`✕ 닫기`).
    - **`🔒 *표시` 마스킹 적용/해제 버튼 (`#btnTeachingModalToggleMask`)**:
      - `공강 교사 찾기` 모달창의 `#btnFreeModalToggleMask`와 완전히 동일한 마크업·스타일 적용:
        ```html
        <button
          type="button"
          class="util-btn top-toggle-btn active-opt"
          id="btnTeachingModalToggleMask"
          aria-pressed="true"
          onclick="toggleMaskTeacherName()"
          title="교사 성명 첫 글자·마지막 글자 * 마스킹 전환"
          style="height: 36px; padding: 0 12px; font-size: 13.5px;"
        >
          🔒 *표시
        </button>
        ```
      - `toggleMaskTeacherName()` 실행 시 `teachingTeachersModal`이 열려 있으면 `renderTeachingTeachersModalContent_()`를 즉시 재호출하여(현재 입력된 모달 검색어 및 하이라이트 유지) 3×n 학급 셀 내 모든 교사명의 마스킹 적용/해제를 실시간 반영합니다.
  - **모달 검색 바 (`.teaching-modal-search-bar`)**:
    - 검색 입력창(`#teachingModalSearchInput`): `placeholder="교과명(예: 국어, 수학) 또는 교사명(초성 지원) 검색..."`
    - 검색어 초기화 버튼(`✕ 초기화`) 및 실시간 검색 일치 카운트 배지(`#teachingModalSearchCount`).
  - **모달 본문 3×n 학급 그리드 (`#teachingModalClassGrid`)**:
    - 1학년, 2학년, 3학년 각 행(`.teaching-grade-row`)이 위에서부터 순서대로 배치됩니다.
    - 좌측에 학년 헤더 배지(`1학년`, `2학년`, `3학년`)가 고정 표시되고, 우측에 해당 학년의 학급들이 `grid-template-columns: repeat(var(--max-class-cols, 10), minmax(0, 1fr))` 형태의 **3×n 균등 격자**로 정렬됩니다.
    - 각 학급 셀(`.teaching-class-cell`) 내부 구성:
      1. **학급 헤더 라벨 (`.tcc-class-label`)**: 예 `1-1` (또는 `1반`)
      2. **교과명 (`.tcc-subject`)**: `cell.s` (괄호 부제목 및 이동/보강 상태 배지 포함)
      3. **교사명 (`.tcc-teacher`)**: `formatTeacherName(cell.t, false)` (마스킹 토글 연동, 미배정 시 생략)
      4. 빈 교시인 경우 `—` 표시 (`.is-empty-slot`)

---

### Step 5. 모달창 내 교과명·교사명 검색 및 가시적 구분(Highlight) 로직
- **실시간 필터링 함수 `handleTeachingModalSearch(query)`**:
  - 검색어가 비어 있으면 모든 셀을 기본 상태로 표시하고 일치 카운트를 숨깁니다.
  - 검색어가 입력되면 각 학급 셀의 **교과명(`cell.s`)**, **교사 실명(`cell.t`)**, **마스킹된 교사명(`formatTeacherName(cell.t, false)`)**, **학급명(`cObj.label`, `cObj.key`)**에 대해 기존 초성·한글 조합 매칭 엔진(`matchKoreanFieldRank_`) 및 부분 문자열 매칭을 수행합니다.
  - **일치하는 셀 (`.teaching-class-cell.is-search-match`)**:
    - 테두리: `2.5px solid var(--main-color)` 및 포커스 링(`0 0 0 3px rgba(2, 112, 70, 0.22)`)
    - 배경: `#DCFCE7` (선명한 민트 그린 하이라이트) + 상단 학급 배지 반전(`background: var(--main-color); color: #FFFFFF`)
    - 살짝 떠오르는 강조 효과(`transform: translateY(-1px)`)
  - **불일치하는 셀 (`.teaching-class-cell.is-search-dimmed`)**:
    - `opacity: 0.25`, `filter: grayscale(40%)`를 적용하여 일치하는 셀만 즉각 눈에 띄도록 시각적 대비 극대화.
  - 검색창 우측 상태 배지에 `'검색 일치: N개 학급'`(일치 항목이 없으면 `'일치하는 교과/교사 없음'`)을 실시간 업데이트합니다.

---

## 3. 검증 계획 (Rule 2 터미널 기반 정적 검증)
- `/apply` 실행 후 `index.html` 내 인라인 스크립트를 추출하여 `node --check` 구문 검사를 수행하고, HTML 태그 열림/닫힘 무결성을 검증합니다.

