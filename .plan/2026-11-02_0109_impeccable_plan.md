# 🎨 Impeccable 25대 전수 검증 및 UI/UX 고도화 구현 계획서

- **작성 일시 (KST)**: `2026-11-02 01:09`
- **대상 프로젝트**: `25-timetable` (초고속 학급·교사 시간표 검색 웹앱)
- **검증 대상 파일**: `index.html`, `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`
- **정적 스캔 도구 결과 (`impeccable detect .` & `impeccable doctor .`)**:
  - `detect`: `index.html` 내 안티패턴 **2건** 검출 (`[cramped-padding]` `.search-input-wrap` 상하 패딩 0px, `[tiny-text]` `11.5px` 및 `11px` 소형 텍스트)
  - `doctor`: `PRODUCT.md` 스키마 최신화 필요, `DESIGN.md` 최신 컨트롤바·컴포넌트 명세 보완 필요, `.impeccable/design.json` `schemaVersion: 2` 및 단일 녹색 테마 동기화 필요

---

## 1. 6대 도메인 25개 항목 전수 검사 스코어카드 (25-Check Matrix)

| 도메인 | # | 세부 검증 항목 (Command) | 판정 | 주요 발견 사항 및 진단 요약 |
| :--- | :---: | :--- | :---: | :--- |
| **1. 시스템 & 컨텍스트**<br>(System & Context) | 1 | `detect` | ⚠️ **WARN** | `impeccable detect .` 실행 결과 `[cramped-padding]`(`.search-input-wrap` 상하 내부 여백 0px) 및 `[tiny-text]`(`.q-chip`, `.proj-preset-chip`, `.proj-file-sub` `11.5px`, `.proj-active-badge` `11px`) 2종 검출 |
| | 2 | `doctor` | ⚠️ **WARN** | `PRODUCT.md` 스키마 섹션 미비, `DESIGN.md` 최신 UI 구조(1행 토글 버튼, 모드 탭 순서, 공유 공강 모드) 미반영, `.impeccable/design.json` 구버전(`blue` 잔존) 검출 |
| | 3 | `init` | ⚠️ **WARN** | `PRODUCT.md`에 `Positioning`, `Operating Context`, `Product Principles` 섹션 및 최신 기능(공유 공강 확인, 학기별 시트 업로드) 업데이트 필요 |
| | 4 | `document` | ⚠️ **WARN** | `DESIGN.md`에 `Colors`, `Components` 규범 섹션과 개편된 1행·2행 컨트롤바 규격을 동기화하고 `.impeccable/design.json`(`schemaVersion: 2`) 갱신 필요 |
| | 5 | `extract` | ✅ **PASS** | `:root` CSS 변수(`--main-color`, `--brand-stone`, `--radius-*` 등)로 디자인 토큰이 잘 추출되어 있으나, 일부 인라인 스타일(`선택 초기화` 버튼 등)의 클래스 분리 권장 |
| **2. 사용성 & 접근성**<br>(Evaluation) | 6 | `critique` | ✅ **PASS** | 0ms 즉시 검색, 실시간 현재 교시 하이라이트, 양방향 셀 클릭 이동 등 닐슨 휴리스틱 핵심 기준 우수 |
| | 7 | `audit` | ⚠️ **WARN** | WCAG AA 명도 대비는 충족하나, `.mode-tabs`(`role="tablist"`) 하위 버튼에 `role="tab"`·`aria-selected` 속성이 없고 토글 버튼(`교사명`, `*표시`)에 `aria-pressed` 속성이 누락됨 |
| | 8 | `clarify` | ✅ **PASS** | 버튼 레이블(`👨‍🏫 교사 시간표`, `✨ 공강 교사 찾기`, `🤝 공유 공강 확인`, `🏫 학급 시간표`), 툴팁 설명, 시트 미연결 안내 문구가 명확함 |
| **3. 시각 & 타이포그래피**<br>(Visual & Type) | 9 | `typeset` | ⚠️ **WARN** | 본문 및 헤더 위계(`36px` / `34px` / `32px`)는 뛰어나나, `.q-chip`(`11.5px`), `.proj-preset-chip`(`11.5px`), `.proj-active-badge`(`11px`) 등 `12px` 미만 타이포그래피를 최소 `12px` 이상으로 상향 필요 |
| | 10 | `colorize` | ✅ **PASS** | 단일 메인 녹색(`#027046`), 다크 그린(`#015434`), 민트 틴트(`#EAF6F0`), Stone Gray(`#313339`) 역할 분리가 일관됨 |
| | 11 | `layout` | ⚠️ **WARN** | `.search-input-wrap` 및 `.project-select-wrap`의 상하 패딩이 `0`으로 설정되어 정적 검사에서 `[cramped-padding]` 발생 (`padding: 6px 16px` 등으로 보정 필요) |
| | 12 | `bolder` | ✅ **PASS** | 2행 좌측 모드 전환 탭(`.mode-tabs`)에 `2px` 메인 녹색 테두리, 민트 틴트 트레이 배경, `800` 굵기 카드형 버튼을 적용하여 시각적 존재감 확보 완료 |
| | 13 | `quieter` | ✅ **PASS** | 우측 유틸리티 버튼(`동기화`, `HWPX`, `XLSX`, `PDF`)은 절제된 뉴트럴 톤을 유지하여 좌측 핵심 모드 탭과의 시각적 계층이 명확함 |
| **4. 디테일 & 인터랙션**<br>(Craft & Motion) | 14 | `polish` | ✅ **PASS** | 1행 좌측 `👤 교사명`·`🔒 *표시` 버튼(`.top-toggle-btn`)이 학기 드롭다운 및 검색창과 동일한 `46px` 높이·`12px` 곡률·`2px` 보더로 정교하게 정렬됨 |
| | 15 | `animate` | ✅ **PASS** | 버튼 호버 시 미세 상승(`translateY(-1px)`) 및 그림자 트랜지션(`0.14s ease`)이 자연스럽게 동작함 |
| | 16 | `delight` | ✅ **PASS** | 단축키 `/` 즉시 포커스, 초성 검색(`ㄱㄷㅈ`), 현재 수업 교시 자동 하이라이트, 점심시간 1/2 행 등 실사용자 친화적 디테일 우수 |
| | 17 | `overdrive` | ✅ **PASS** | 외부 서버 없이 브라우저 내 순수 JS로 HWPX·XLSX 문서를 즉시 빌드하고 전체화면 확대 모달을 제공하는 고성능 기능 구현 |
| **5. 견고성 & 상태 처리**<br>(Robustness & State) | 18 | `harden` | ✅ **PASS** | 공강 교사 0명 및 미선택 시 빈 시간표(`—`) 렌더링, 긴 과목명·교사명 말줄임(`text-overflow: ellipsis`) 및 줄바꿈 방어 처리 완료 |
| | 19 | `onboard` | ✅ **PASS** | 스프레드시트 미연결 시 상단 설정 안내 패널(`#sheetSetupPanel`) 및 학기 엑셀 세트 업로드 모달 안내가 직관적임 |
| | 20 | `distill` | ✅ **PASS** | 학기 드롭다운과 중복되던 `📂 학기 엑셀 등록` 버튼을 제거하고 검색창 포커스 시 칩 패널을 자동 숨김 처리하여 화면 복잡도를 최소화함 |
| | 21 | `adapt` | ⚠️ **WARN** | 모바일 화면(`@media (max-width: 640px)`)에서도 학급·교사·공강 버튼 그리드가 10열(`repeat(10, minmax(0, 1fr))`)로 고정되어 좁은 화면에서 버튼 폭이 과도하게 좁아짐 (모바일 5열 반응형 전환 필요) |
| | 22 | `optimize` | ✅ **PASS** | 멀티 청크 `CacheService` + 페이로드 60% 경량화 + `localStorage` 0ms 즉시 렌더링 + 백그라운드 MD5 변경 감지로 최상위 렌더링 성능 확보 |
| **6. 구조 & 대안 탐색**<br>(Exploration) | 23 | `shape` | ✅ **PASS** | 1행(토글 옵션 + 학기 선택 + 즉시 검색) → 2행(핵심 4대 모드 탭 + 내보내기 유틸리티) → 3행(`n × 10` 통합 선택 패널) → 본문 시간표 카드의 IA 구조가 명확함 |
| | 24 | `live` | ✅ **PASS** | 전체화면 확대 모달창(`#timetableZoomModal`)과 메인 시간표 카드가 실시간 동기화(`syncModalTimetableView_`)되어 교실 TV/전자칠판 환경에서도 즉시 활용 가능 |
| | 25 | `generate` | ✅ **PASS** | 웹 뷰, 인쇄/PDF 뷰, HWPX 한글 문서, XLSX 엑셀 문서의 4가지 출력 포맷이 동일한 데이터 모델(`getCurrentExportModel_`)에서 일관되게 생성됨 |

- **종합 결과**: **25개 항목 중 `✅ PASS` 18개 / `⚠️ WARN` 7개 / `❌ FAIL` 0개**

---

## 2. 우선순위별 핵심 개선 과제 (Prioritized Action Items)

### 🚨 P1 (Critical — 정적 스캔 안티패턴 0건 달성 & 가독성/접근성 보강)
1. **`[tiny-text]` 안티패턴 전면 해소 (`index.html`)**:
   - `.q-chip` (`11.5px` → `12px`)
   - `.proj-preset-chip` (`11.5px` → `12px`)
   - `.proj-file-sub` (`11.5px` → `12px`)
   - `.proj-active-badge` (`11px` → `12px`)
   - 공유 공강 확인 모드 `'선택 초기화'` 버튼 인라인 폰트 크기 (`11px` → `12px`, 전용 클래스 `.chip-reset-btn` 적용)
2. **`[cramped-padding]` 안티패턴 해소 (`index.html`)**:
   - `.search-input-wrap`의 패딩을 `padding: 0 16px`에서 `padding: 6px 16px`으로 변경하고, `.project-select-wrap`의 패딩을 `padding: 0 12px`에서 `padding: 6px 12px`로 변경하여 상하 보더와 내부 요소 사이에 충분한 인셋 여백을 확보(`height: 46px` 유지)합니다.
3. **탭 및 토글 버튼 WAI-ARIA 시맨틱 속성 보강 (`index.html`)**:
   - `.mode-tabs` 내 4개 탭 버튼(`#tabTeacher`, `#tabFree`, `#tabSharedFree`, `#tabClass`)에 `role="tab"` 및 `aria-selected` 속성을 부여하고 `syncModeTabsUI()`에서 동적으로 갱신합니다.
   - 1행 좌측 토글 버튼(`#btnToggleSubTeacher`, `#btnToggleMask`)에 `aria-pressed` 속성을 부여하고 `syncModeTabsUI()`에서 동적으로 갱신합니다.

### ⚡ P2 (Important — 모바일 반응형 적응성 & 디자인 문서/사이드카 동기화)
1. **모바일(`<= 640px`) 칩 그리드 반응형 열 수 최적화 (`index.html`)**:
   - `@media (max-width: 640px)` 구간에서 `.grade-row-chips`, `.teacher-chips-wrap`, `.ff-results`의 그리드 열 수를 `repeat(5, minmax(0, 1fr))`로 조정하여 모바일에서도 교사명과 학급명이 잘리지 않고 5열×N행으로 선명하게 보이도록 개선합니다.
   - 모바일에서 `.control-row-search`와 `.mode-tabs`가 화면 폭에 자연스럽게 맞도록 여백을 다듬습니다.
2. **디자인 문서(`PRODUCT.md`, `DESIGN.md`) 및 `.impeccable/design.json` 최신화**:
   - `PRODUCT.md`: 스키마 메타데이터 및 `Positioning`, `Operating Context`, `Evidence on Hand`, `Product Principles` 섹션을 보강하고 공유 공강 확인·학기별 시트 관리 기능을 반영합니다.
   - `DESIGN.md`: `Colors`, `Components` 규범 섹션 및 최신 컨트롤바 레이아웃(1행 `46px` 토글 버튼, 2행 고가시성 모드 탭 순서, `n × 10` 그리드, 공유 공강 Stone Gray 셀)을 반영합니다.
   - `.impeccable/design.json`: `schemaVersion: 2` 규격으로 업데이트하고 레거시 `blue` 컬러를 제거하여 단일 녹색(`#027046`) + Stone Gray(`#313339`) 토큰과 일치시킵니다.

### ✨ P3 (Polish — 인라인 스타일 정리)
1. **동적 렌더링 인라인 스타일 클래스화 (`index.html`)**:
   - `renderQuickChips()` 내 공유 공강 `'선택 초기화'` 버튼의 인라인 스타일(`style="padding:2px 8px;font-size:11px;"`)을 `.util-btn.chip-reset-btn` CSS 클래스로 분리합니다.

---

## 3. 파일별 구체적 코드 리팩토링 지침 (Step-by-Step Implementation Guide)

### Step 1: `index.html` — `[cramped-padding]` 및 `[tiny-text]` 해소, 반응형/클래스 보강
1. **`.project-select-wrap` 및 `.search-input-wrap` 상하 인셋 패딩 추가**:
   - `.project-select-wrap`: `padding: 6px 12px;` (`height: 46px` 유지)
   - `.search-input-wrap`: `padding: 6px 16px;` (`height: 46px` 유지)
2. **최소 폰트 크기 `12px` 보장 (`tiny-text` 0건)**:
   - `.q-chip`: `font-size: 12px;`
   - `.proj-preset-chip`: `font-size: 12px;`
   - `.proj-file-sub`: `font-size: 12px;`
   - `.proj-active-badge`: `font-size: 12px;`
   - `.util-btn.chip-reset-btn` 클래스 신설 (`height: 28px; padding: 2px 10px; font-size: 12px;`)
3. **모바일(`@media (max-width: 640px)`) 그리드 적응성 개선**:
   - `.grade-row-chips`, `.teacher-chips-wrap`, `.ff-results`에 `grid-template-columns: repeat(5, minmax(0, 1fr));` 적용
4. **WAI-ARIA 속성 연동 (`syncModeTabsUI`)**:
   - `#tabTeacher`, `#tabFree`, `#tabSharedFree`, `#tabClass`에 `role="tab"` 및 `aria-selected` 추가
   - `#btnToggleSubTeacher`, `#btnToggleMask`에 `aria-pressed` 추가

### Step 2: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` — 문서 및 스키마 동기화
1. `PRODUCT.md`에 Impeccable 표준 섹션(`Positioning`, `Operating Context`, `Evidence on Hand`, `Product Principles`) 및 최신 기능을 반영합니다.
2. `DESIGN.md`에 `Colors`, `Components` 섹션 및 최신 컨트롤바/그리드 명세를 반영합니다.
3. `.impeccable/design.json`을 `schemaVersion: 2` 구조로 갱신합니다.

### Step 3: 정적 검증 (`impeccable detect .`, `impeccable doctor .`, Node.js 구문 검사)
1. `.\.agents\skills\impeccable\bin\impeccable.exe detect .` 실행 시 **0 anti-patterns found** 달성 확인
2. `Code.gs` 및 `index.html` 인라인 스크립트 `vm.Script` 정적 구문 검사 통과 확인

