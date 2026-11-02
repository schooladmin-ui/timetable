# 공강 교사 찾기 UI 개편 계획서 (시간표 셀 클릭 + 공강 교사 모달창)

- **작성 일시 (KST)**: 2026-11-02 20:41
- **대상 파일**: `c:\Users\user\Desktop\appsscript\25-timetable\index.html`
- **모드**: `/ask` (계획서 작성 전용 · 소스 코드 미수정)

---

## 1. 현황 및 문제점 분석

1. **상단 가로형 요일·교시 버튼 나열의 인지 부담**
   - 현재 `✨ 공강 교사 찾기`(`state.mode === 'free'`) 선택 시 상단 `#quickChipsBar`에 `[월요일~금요일] | [1교시~7교시]` 12개 버튼이 1행으로 나열되고, 그 아래에 수십 명의 교사 칩 버튼이 펼쳐집니다.
   - 2차원 구조인 시간표(요일 × 교시)를 1차원 가로 버튼 두 묶음으로 선택해야 하므로 직관성이 떨어지고 혼란을 유발합니다.
2. **하단 메인 시간표 테이블의 활용도 저하**
   - 정작 화면 중앙의 가장 넓고 직관적인 5요일 × 7교시 시간표 격자(`#ttTbody`)는 교사를 선택하기 전까지 모든 셀이 빈 대시(`—`)로만 표시되어 공간이 낭비되고 있습니다.

---

## 2. 개선 방향 및 UI/UX 설계

### A. 상단 `quickChipsBar` 영역 단순화 (`state.mode === 'free'`)
- 기존의 복잡한 `[월~금] | [1~7교시]` 버튼 바 및 상단 교사 칩 목록을 제거합니다.
- 대신 간결한 안내 배너(또는 선택된 교사 시간표 미리보기 시 상단 안내 + `전체 공강 시간표로 돌아가기` 버튼)만 표시하여 시선이 즉시 아래 시간표 테이블로 향하도록 구성합니다.

### B. 메인 시간표 테이블(`#ttTbody`)을 대화형 '요일 × 교시 선택 그리드'로 전환
- `공강 교사 찾기` 모드 진입 시 메인 시간표 헤더 타이틀을 **`공강 교사 찾기`**로 표시하고, 부제(`#headerSubRole`)에 **`교시별 셀을 클릭하면 공강 교사 명단이 열립니다`** 안내를 표시합니다.
- 시간표의 각 `(요일, 교시)` 셀(`td.td-cell`)에 해당 시간대의 **공강 교사 수(`공강 N명`)**와 **대표 교사 미리보기(예: 외 N명 / 명단 보기)**를 표시합니다.
- 모든 `(요일, 교시)` 셀에 `.clickable` 및 `.free-slot-cell` 클래스를 부여하여 마우스 오버 시 하이라이트 효과를 주고, 클릭(또는 키보드 `Enter`/`Space`) 시 즉시 해당 `(요일, 교시)`의 **공강 교사 명단 모달창**을 호출합니다.

### C. 공강 교사 명단 전용 모달창 (`#freeTeachersModal`) 신설
- 시간표 셀 클릭 시 팝업되는 모달 다이얼로그(`#freeTeachersModal`)를 추가합니다.
- **모달 헤더**:
  - 학년도·학기 배지(예: `2026학년도 2학기`)
  - 선택된 요일·교시 타이틀(예: **`월요일 1교시 공강 교사`**) 및 인원수 배지(**`총 30명`**)
  - 모달 내부에서도 바로 앞/뒤 교시나 다른 요일로 빠르게 전환할 수 있는 미니 배지 또는 `✕ 닫기 (Esc)` 버튼 제공
- **모달 바디**:
  - 해당 교시에 수업이 없는 공강 교사들의 이름 버튼을 깔끔한 그리드(칩/카드 형태)로 표시합니다 (`*표시` 마스킹 토글 설정 실시간 반영, 담당 과목/담임 학급 보조 표기 포함).
  - **연계 동작**: 모달창 내 교사 이름을 클릭하면 모달이 닫히면서 해당 교사의 주간 시간표를 확인(또는 교사 시간표로 이동)할 수 있도록 연결합니다.

---

## 3. 세부 구현 계획 (`index.html`)

### Step 1. CSS 스타일 추가 (`index.html` `<style>` 영역)
- `.free-slot-cell`: 공강 교사 찾기 테이블 셀 내부의 `공강 N명` 배지(`.free-slot-count`), 보조 안내 텍스트(`.free-slot-hint`), 선택된 셀 강조(`.is-selected-free-slot`) 스타일 정의
- `#freeTeachersModal` (`.free-modal-dialog`, `.free-modal-grid`, `.free-teacher-card` 등):
  - 기존 모달(`.tt-modal-backdrop`, `.proj-modal-dialog`)과 일관된 그린(`#027046`) & 스톤(`#313339`) 테마 적용
  - 반응형 그리드(데스크톱 5열, 태블릿 3~4열, 모바일 2~3열)로 교사 이름 및 담임/과목 정보를 한눈에 볼 수 있도록 구성

### Step 2. 모달 HTML 마크업 추가 (`index.html` `<body>` 하단 모달 영역)
- `#timetableZoomModal`, `#projectManagerModal` 옆에 `#freeTeachersModal` 마크업 추가:
  - 헤더: `#freeModalBadge`(학년도·학기), `#freeModalTitle`(`X요일 N교시 공강 교사`), `#freeModalCount`(`총 N명`), `✕ 닫기` 버튼
  - 바디: `#freeModalTeacherGrid`(공강 교사 버튼 그리드 렌더링 영역) 및 하단 안내 문구(`💡 선생님을 클릭하면 해당 교사의 주간 시간표를 확인할 수 있습니다.`)

### Step 3. JavaScript 렌더링 및 인터랙션 로직 개편 (`index.html` `<script>` 영역)
1. **`renderQuickChips()` 수정**:
   - `state.mode === 'free'`일 때 기존의 요일·교시 버튼 행과 교사 목록 칩 렌더링을 제거합니다.
   - 만약 모달에서 특정 공강 교사를 클릭해 개인 시간표를 보고 있는 상태(`state.currentKey`가 있을 때)라면 상단에 `← 공강 교사 찾기 시간표(전체 교시 그리드)로 돌아가기` 버튼과 현재 조회 중인 요일·교시 모달 다시 열기 버튼을 제공하고, 기본 상태(`state.currentKey === ''`)에서는 상단 칩 바를 숨겨(`is-hidden`) 테이블 집중도를 높입니다.
2. **`renderTimetable()` 수정 (`state.mode === 'free'` 분기 추가)**:
   - `state.mode === 'free'`이고 특정 교사가 선택되지 않은 기본 상태에서, 빈 테이블 대신 **요일 × 교시별 공강 교사 현황 테이블**을 렌더링합니다.
   - 각 셀 클릭 시 `openFreeTeachersModal(dayIdx, periodIdx)`가 실행되도록 `onclick` 및 `onkeydown` 핸들러를 바인딩합니다.
3. **모달 제어 함수 구현**:
   - `window.openFreeTeachersModal(dayIdx, periodIdx)`: `state.freeDayIdx`, `state.freePeriodIdx`를 갱신하고 해당 교시의 공강 교사 목록(`getFreeTeacherObjects_`)을 계산하여 `#freeTeachersModal`을 열고 렌더링합니다.
   - `window.closeFreeTeachersModal()`, `window.handleFreeModalBackdropClick(e)` 및 `Escape` 키 닫기 연동.
   - `window.selectFreeTeacherFromModal(teacherKey)`: 모달에서 특정 교사 클릭 시 모달을 닫고 해당 교사의 주간 시간표를 화면에 표시합니다.

---

## 4. 검증 계획
1. `/apply` 실행 시 `index.html`에 위 변경사항을 반영합니다.
2. 터미널 정적 구문 검증(`node`를 이용한 `index.html` 인라인 스크립트 파싱 체크)을 수행하여 문법 오류가 없는지 확인합니다.

