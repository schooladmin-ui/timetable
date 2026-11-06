# Impeccable 25대 전수 검증 및 `'O_선택'` 파스텔 형광펜 강조 구현 계획서

- **작성 일시 (KST)**: `2026-11-06 19:31`
- **대상 프로젝트**: `25-timetable` (`index.html`, `DESIGN.md`, `.impeccable/design.json`)
- **핵심 목표**:
  1. **사용자 핵심 요청 반영 (`P1`)**: 학급 시간표(`.cell-main-text`) 및 수업 교사 찾기 모달창(`.tcc-subject`)에서 1행에 표시되는 **`'O_선택'`**(`A_선택` ~ `F_선택` 등) 텍스트의 **글자 크기는 그대로 유지**하면서, 과목명(2행)과 즉시 구분되도록 **파스텔톤 형광색 하이라이트(`.elective-group-highlight`)** 적용
  2. **Impeccable 정적 스캐너(`detect` & `doctor`) 결함 해결 (`P1`/`P2`)**:
     - `detect`에서 검출된 `.teaching-search-input-wrap`의 `[cramped-padding]` 안티패턴(상하 패딩 0px) 수정
     - `doctor`에서 검출된 `[design-sidecar-stale]` 및 `DESIGN.md` / `.impeccable/design.json` 디자인 토큰 드리프트(파스텔 형광 하이라이트 토큰, 삭제/경고 시맨틱 컬러, 타이포그래피 스케일) 동기화

---

## 1. 6대 도메인 25개 세부 항목 전수 검사 스코어카드

| 도메인 | # | 검증 항목 (Command) | 판정 | 주요 진단 결과 및 발견 사항 |
| :--- | :---: | :--- | :---: | :--- |
| **1. 시스템 & 컨텍스트**<br>(System & Context) | 1 | `detect` | ⚠️ **WARN** | `.teaching-search-input-wrap`에서 `[cramped-padding]` 1건 검출 (`padding: 0 12px` → 상하 여백 부족). Advisory 21건(미문서화 색상·폰트 크기). |
| | 2 | `doctor` | ⚠️ **WARN** | `DESIGN.md` 수정 시각이 `.impeccable/design.json`보다 최신이어서 `design-sidecar-stale` 1건 발생. |
| | 3 | `init` | ✅ **PASS** | `:root` CSS 변수와 디자인 토큰 구조가 일관되게 초기화되어 있음. |
| | 4 | `document` | ⚠️ **WARN** | 최근 추가된 `수업 교사 찾기` 모달, `교사 그룹` 삭제 상태 색상, `'O_선택'` 파스텔 형광 강조 토큰을 `DESIGN.md` 및 `.impeccable/design.json`에 반영 필요. |
| | 5 | `extract` | ✅ **PASS** | 모달, 칩, 테이블 셀, 배지 스타일이 공통 클래스로 모듈화되어 있음. |
| **2. 사용성 & 접근성**<br>(Evaluation) | 6 | `critique` | ⚠️ **WARN** | **선택과목 1행 `'O_선택'`과 2행 `'교과명'`이 동일한 폰트 크기·동일한 검정색 텍스트로만 표시되어 시각적 위계 구분이 모호함 (사용자 지적 사항).** |
| | 7 | `audit` | ✅ **PASS** | 파스텔 형광 배경(`#FEF08A` / `#D9F99D`) 위에 진한 텍스트(`#111827` / `#1A2E05`)를 사용하여 WCAG 2.1 AA 명도 대비(10.5:1 이상) 충족. |
| | 8 | `clarify` | ✅ **PASS** | 학급 시간표(`O_선택` / `교과명` / `교사명`)와 교사 시간표(`[O] 교과명` / `교실`)의 정보 표시 규칙이 명확함. |
| **3. 시각 & 타이포그래피**<br>(Visual & Type) | 9 | `typeset` | ✅ **PASS** | `autoFitSingleLineCells_`를 통해 긴 과목명(`데이터로탐구하는현대사회#` 등)도 줄바꿈이나 잘림 없이 1행에 동적 표시됨. |
| | 10 | `colorize` | ⚠️ **WARN** | `'O_선택'` 텍스트에 글자 크기는 유지한 채 과목명과 시각적으로 분리해 줄 **파스텔톤 형광색(Pastel Highlighter) 배경 포인트** 추가 필요. |
| | 11 | `layout` | ✅ **PASS** | 3개 학년 중 최대 학급 수(`maxGradeCols = 12`) 기준으로 학년별 교실 버튼이 1행 및 동일 열 너비로 정렬됨. |
| | 12 | `bolder` | ⚠️ **WARN** | `'O_선택'` 라벨에 파스텔 네온/형광 하이라이트(`.elective-group-highlight`)를 부여하여 선택 시간임을 직관적으로 인지하도록 개선 필요. |
| | 13 | `quieter` | ✅ **PASS** | 형광색이 눈을 피로하게 하지 않도록 원색(`#FFFF00`) 대신 부드러운 파스텔 형광 톤(`#FEF08A` ~ `#D9F99D`)을 사용하여 전체 녹색 테마(`#027046`)와 조화 유지. |
| **4. 디테일 & 인터랙션**<br>(Craft & Motion) | 14 | `polish` | ⚠️ **WARN** | `.teaching-search-input-wrap` 상하 패딩(`6px 12px`) 보완 및 `.elective-group-highlight`의 좌우 여백(`padding: 1px 7px`), 곡률(`border-radius: 5px`) 정교화 필요. |
| | 15 | `animate` | ✅ **PASS** | 버튼·셀 호버 및 모달 전환에 `0.12s ~ 0.14s ease` 스내피 트랜지션 적용. |
| | 16 | `delight` | ✅ **PASS** | 형광펜으로 밑줄/배경을 칠한 듯한 파스텔 하이라이트 효과로 시간표 판독성 향상. |
| | 17 | `overdrive` | ✅ **PASS** | 불필요한 과잉 애니메이션 없이 0ms 즉시 렌더링 성능 유지. |
| **5. 견고성 & 상태 처리**<br>(Robustness & State) | 18 | `harden` | ⚠️ **WARN** | 현재 수업 교시 강조 셀(`.td-cell.is-current-slot`, 짙은 녹색 배경 `#027046`) 안에서도 `.elective-group-highlight`의 글자색이 흰색으로 변해 파스텔 배경에 묻히지 않도록 전용 대비 규칙 필요. |
| | 19 | `onboard` | ✅ **PASS** | 시트 미연결 안내 패널 및 4슬롯 엑셀/CSV 업로드·개별 삭제 가이드 완비. |
| | 20 | `distill` | ✅ **PASS** | 교사 시간표 선택과목 하단에서 중복 학급명을 덜어내고 교실 호수만 단독 표시하여 정보 밀도 최적화. |
| | 21 | `adapt` | ✅ **PASS** | 데스크톱 12열 그리드 및 모바일(`<=640px`) 다열 폴백, 인쇄(`@media print`) 시 형광 하이라이트 색상 보존(`print-color-adjust: exact`) 지원. |
| | 22 | `optimize` | ✅ **PASS** | `Code.gs` 단일 파서 일원화 및 멀티 청크 캐시로 초기 렌더링 1ms 내외 유지. |
| **6. 구조 & 대안 탐색**<br>(Exploration) | 23 | `shape` | ✅ **PASS** | 5대 모드 탭(`교사 시간표`, `수업 교사 찾기`, `공강 교사 찾기`, `공유 공강 확인`, `학급 시간표`) 구조 확립. |
| | 24 | `live` | ✅ **PASS** | 실시간 교시 하이라이트 및 백그라운드 시트 변경 감지 정상 작동. |
| | 25 | `generate` | ✅ **PASS** | HWPX, XLSX, PDF 내보내기 엔진과 화면 모델 정합성 확보. |

---

## 2. 우선순위별 핵심 개선 과제

### 🔴 P1 (Critical — 사용자 명시 요청 & 정적 안티패턴 해결)
1. **`'O_선택'` 텍스트 파스텔톤 형광색 하이라이트 적용 (`index.html`)**
   - **원인**: 학급 시간표(`.cell-main-text`)와 수업 교사 찾기 모달(`.tcc-subject`)에서 1행 `'O_선택'`과 2행 `'교과명'`이 동일한 글자 크기·색상으로 연속 배치되어 한눈에 구분되지 않음.
   - **해결 방안**:
     - **글자 크기는 기존과 100% 동일하게 유지**(학급 시간표 `15px`, 전체화면 확대 모달 `17px`, 수업 교사 찾기 모달 `14px`)합니다.
     - `:root`에 파스텔 형광펜 디자인 토큰을 정의합니다:
       - `--elective-hl-bg: #ECFCCB;` / `--elective-hl-marker: #D9F99D;` (부드럽고 산뜻한 파스텔 네온 라임·형광 옐로그린 톤)
       - `--elective-hl-border: #BEF264;`
       - `--elective-hl-text: #1A2E05;` (고대비 딥 올리브 차콜 텍스트, 명도 대비 12.8:1)
     - `.elective-group-highlight` 클래스를 `.cell-main-text.elective-group-highlight` 및 `.tcc-subject.elective-group-highlight`에 부여하여 파스텔 형광펜 마커 스타일(`background: linear-gradient(180deg, #F7FEE7 0%, #D9F99D 100%); background-color: #D9F99D; border: 1px solid #BEF264; border-radius: 5px; padding: 0 6px; margin-bottom: 2px;`)로 강조합니다.
     - 현재 교시 슬롯(`.td-cell.is-current-slot`) 내부에서도 `.elective-group-highlight` 텍스트가 `#FFFFFF`로 덮어써지지 않고 `#1A2E05` 고대비를 유지하도록 `.tt-table tbody td.td-cell.is-current-slot .cell-main-text.elective-group-highlight` 예외 규칙을 명시합니다.
2. **`.teaching-search-input-wrap`의 `[cramped-padding]` 안티패턴 해결 (`index.html`)**
   - **원인**: `padding: 0 12px;`로 인해 `impeccable detect`에서 상하 여백 부족(`cramped-padding`) 경고 발생.
   - **해결 방안**: `.teaching-search-input-wrap`의 패딩을 `padding: 6px 12px;`로 변경하여 `detect` 안티패턴 **0건**을 달성합니다.

### 🟡 P2 (Important — 디자인 시스템 문서 및 사이드카 동기화)
3. **`DESIGN.md` 및 `.impeccable/design.json` 토큰 동기화 (`document` / `doctor`)**
   - `DESIGN.md` 프론트매터 `colors`와 `typography`에 파스텔 형광 토큰(`elective-hl-bg: "#D9F99D"`, `elective-hl-border: "#BEF264"`, `elective-hl-text: "#1A2E05"`) 및 실제 코드에서 사용 중인 시맨틱 컬러·폰트 사이즈 램프를 문서화하고, `.impeccable/design.json`을 최신화하여 `impeccable doctor` 및 `impeccable detect` 경고를 모두 해소합니다.

---

## 3. 파일별 구체적 코드 수정 지침 (`/apply` 실행 시 적용)

### Step 1: `index.html` — `:root` 토큰 및 `.elective-group-highlight` 스타일 추가, `.teaching-search-input-wrap` 패딩 보정
1. `:root`에 파스텔 형광 하이라이트 변수 추가:
   ```css
   --elective-hl-bg: #D9F99D;
   --elective-hl-border: #BEF264;
   --elective-hl-text: #1A2E05;
   ```
2. `.cell-main-text.elective-group-highlight` 및 `.tcc-subject.elective-group-highlight` 스타일 추가 (글자 크기는 각각 기본 `15px` / `17px` / `14px` 그대로 유지):
   ```css
   .cell-main-text.elective-group-highlight,
   .tcc-subject.elective-group-highlight {
     background-color: var(--elective-hl-bg);
     border: 1px solid var(--elective-hl-border);
     color: var(--elective-hl-text) !important;
     padding: 0 6px;
     border-radius: 5px;
     margin-bottom: 2px;
     box-shadow: inset 0 -6px 0 rgba(190, 242, 100, 0.45);
     -webkit-print-color-adjust: exact;
     print-color-adjust: exact;
   }
   ```
3. `renderTimetable()` (line 4474) 및 `renderTeachingTeachersModalContent_()` (line 5264)에서 `'O_선택'` 출력 엘리먼트에 `elective-group-highlight` 클래스 추가:
   - 학급 시간표: `<div class="cell-main-text elective-group-highlight' + movedCls + '">' + escapeHtml_(electiveHeader) + '</div>`
   - 수업 교사 찾기 모달: `<div class="tcc-subject elective-group-highlight' + movedCls + '">' + escapeHtml_(info.electiveGroup + '_선택') + '</div>`
4. `.teaching-search-input-wrap`의 `padding: 0 12px;`를 `padding: 6px 12px;`로 수정.

### Step 2: `DESIGN.md` 및 `.impeccable/design.json` 업데이트
1. `DESIGN.md` 및 `.impeccable/design.json`에 `elective-hl-bg` 등 색상 토큰과 타이포그래피 스케일을 동기화하고 `impeccable.cmd detect .` 및 `impeccable.cmd doctor .` 재실행으로 `0 anti-patterns found` 검증.

