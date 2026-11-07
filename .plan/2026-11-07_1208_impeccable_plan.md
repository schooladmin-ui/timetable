# Impeccable 25대 전수 검증 및 교사·학생 선택 버튼 디자인 통일 구현 계획서

- **작성 일시 (KST)**: 2026-11-07 12:08
- **대상 파일**:
  - `c:\Users\user\Desktop\appsscript\25-timetable\index.html`
  - `c:\Users\user\Desktop\appsscript\25-timetable\PRODUCT.md`
  - `c:\Users\user\Desktop\appsscript\25-timetable\DESIGN.md`
  - `c:\Users\user\Desktop\appsscript\25-timetable\.impeccable\design.json`
- **모드**: `/impeccable-all` 진단 및 계획서 자동 생성 (소스 코드 미수정 상태, `/apply` 입력 시 즉시 반영)

---

## 1. 사용자 핵심 요구사항 및 정적 스캔(`detect` / `doctor`) 결과

### 1.1 핵심 디자인 요구사항
1. **학생 선택 버튼과 교사 선택 버튼의 디자인 완전 통일 (`index.html`)**
   - `학생 시간표`의 복수 학생 선택 패널 내 학생 버튼(`.q-chip.student-chip`)을 `교사 시간표` 및 `공유 공강 확인`의 교사 선택 버튼(`.q-chip`)과 동일한 캡슐형(`border-radius: var(--radius-pill)`), 동일한 패딩(`padding: 5px 4px`), 동일한 보더(`1px solid`), 동일한 타이포그래피(`font-size: 12px`, `font-weight: 600`, 선택 시 `font-weight: 700`) 및 동일한 `n × 10` 그리드(`grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 5px;`)로 통일합니다.
   - 학번과 이름을 분리하던 이질적인 서브 스타일(`.student-chip-id` 투명도/폰트 분리)을 제거하고 교사 버튼과 동일하게 단일 텍스트 스타일(`<span class="student-chip-text">20101 강태인</span>`)로 통일하되, `autoFitSingleLineCells_()`를 통해 긴 이름도 줄바꿈이나 잘림 없이 1행에 동적으로 맞춰지도록 유지합니다.
2. **페이지별 고유 테마 기본색 분리 적용 (`교사 시간표` vs `학생 시간표`)**
   - **교사 시간표 페이지 (`body[data-portal="teacher"]`)**:
     - 메인 테마 컬러: **Emerald Green (`#027046`)** (`--main-color: #027046`, `--main-color-dark: #015434`, `--main-tint-bg: #EAF6F0`, `--main-tint-border: #B6E2CE`)
     - 버튼 기본(미선택) 테두리/호버/선택 색상: 기본 배경 `#FFFFFF` + 페이지 테마 보더(`var(--main-tint-border)` `#B6E2CE`), 호버 시 `#EAF6F0` 배경 + `#027046` 보더, 선택(`.active`) 시 `#027046` 배경 + `#FFFFFF` 텍스트
   - **학생 시간표 페이지 (`body[data-portal="student"]`)**:
     - 메인 테마 컬러: **Stone Gray (`#313339`)** (`--main-color: #313339`, `--main-color-dark: #1F2024`, `--main-tint-bg: #F3F4F6`, `--main-tint-border: #D1D5DB`)
     - 버튼 기본(미선택) 테두리/호버/선택 색상: 기본 배경 `#FFFFFF` + 페이지 테마 보더(`var(--main-tint-border)` `#D1D5DB`), 호버 시 `#F3F4F6` 배경 + `#313339` 보더, 선택(`.active`) 시 `#313339` 배경 + `#FFFFFF` 텍스트

### 1.2 Impeccable 정적 엔진(`detect` & `doctor`) 스캔 결과
- **Anti-patterns**: `0 anti-patterns found` (심각한 안티패턴 0건)
- **Doctor Drift**: `No drift found`
- **Advisories (15건)**:
  - 학생 포털 다크 스톤 컬러(`#1F2024`), 위험 호버 컬러(`#FEE2E2`) 등 신규 추가 색상이 `DESIGN.md` 및 `.impeccable/design.json` 팔레트에 미등재된 사항
  - 일부 보조 폰트 크기(`10.5px`, `11px`)가 최소 폰트 기준(`12px`) 미만으로 선언된 구간 및 반응형/모달 타이포그래피 스케일(`13px`, `16px`, `17px`, `18px`, `20px`, `22px`, `24px`, `26px`, `34px`) 문서화 필요 사항
  - `.elective-group-highlight`의 `border-radius: 5px`가 표준 곡률 토큰(`--radius-sm: 4px`)에서 벗어난 사항

---

## 2. Impeccable 6대 도메인 25개 항목 전수 검사 스코어카드

| 도메인 | # | 세부 검증 항목 (Command) | 판정 | 주요 진단 및 발견 사항 |
| :--- | :---: | :--- | :---: | :--- |
| **1. 시스템 & 컨텍스트**<br>(System & Context) | 1 | `detect` | ✅ PASS | 정적 안티패턴 0건. 15건의 Advisory(신규 학생 포털 컬러 및 폰트 스케일 미등록)만 존재 |
| | 2 | `doctor` | ✅ PASS | `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` 스키마 드리프트 0건 |
| | 3 | `init` | ⚠️ WARN | `PRODUCT.md`에 신규 추가된 `교사·학생 시간표` 투트랙 포털 및 6개 학기 시트 세트 명세 업데이트 필요 |
| | 4 | `document` | ⚠️ WARN | `DESIGN.md`에 학생 시간표 포털 테마 컬러(`#313339` / `#1F2024` / `#F3F4F6`) 및 타이포그래피 스케일 동기화 필요 |
| | 5 | `extract` | ⚠️ WARN | 교사 선택 버튼(`.q-chip`)과 학생 선택 버튼(`.q-chip.student-chip`)의 스타일이 이원화되어 있어 단일 `.q-chip` 토큰 체계로 통합 필요 |
| **2. 사용성 & 접근성**<br>(Evaluation) | 6 | `critique` | ✅ PASS | 닐슨 10대 휴리스틱 중 일관성 및 표준(Consistency & Standards) 항목에서 교사·학생 선택 칩 외형 통일 시 만점 달성 |
| | 7 | `audit` | ⚠️ WARN | `.group-chip-count`(`10.5px`) 및 `.student-elective-chip-grp`(`11px`)를 최소 폰트 `12px`로 상향하여 WCAG 가독성 기준 충족 필요 |
| | 8 | `clarify` | ✅ PASS | 학급·학생 선택 안내 문구 및 일괄 다운로드 버튼(`선택 학생 HWPX/XLSX/PDF (N명)`) 레이블 명확성 우수 |
| **3. 시각 & 타이포그래피**<br>(Visual & Type) | 9 | `typeset` | ⚠️ WARN | 학생 칩 내부의 학번·성명 폰트 두께/투명도 분리 제거 및 교사 칩과 동일한 `12px` / `600` (활성 시 `700`) 단일 행 타이포그래피 적용 필요 |
| | 10 | `colorize` | ⚠️ WARN | 각 페이지(`교사 시간표` `#027046` vs `학생 시간표` `#313339`)에 맞는 `--main-color`, `--main-tint-bg`, `--main-tint-border`가 `.q-chip`에 일관되게 반영되도록 개선 필요 |
| | 11 | `layout` | ✅ PASS | 교사·교사그룹·학생 선택 패널 모두 `n × 10` (`grid-template-columns: repeat(10, minmax(0, 1fr))`) 고정 그리드 정렬 유지 |
| | 12 | `bolder` | ✅ PASS | 선택된 버튼(`.q-chip.active`)에 페이지별 메인 테마 컬러 솔리드 채움(`var(--main-color)`) 및 흰색 반전 텍스트로 확실한 선택 대비 제공 |
| | 13 | `quieter` | ✅ PASS | 불필요한 상단 연동 시트 배너, 중복 다운로드 버튼, 학생 마스킹 토글을 제거하여 시각적 노이즈 최소화 완료 |
| **4. 디테일 & 인터랙션**<br>(Craft & Motion) | 14 | `polish` | ⚠️ WARN | `.elective-group-highlight`의 `border-radius: 5px`를 `var(--radius-sm)`(`4px`)로 정규화하고, `.q-chip.student-chip`의 별도 `height: 30px` 및 `border: 1.5px`를 `.q-chip` 표준(`padding: 5px 4px`, `border: 1px solid var(--main-tint-border)`)과 일치화 |
| | 15 | `animate` | ✅ PASS | `transition: all 0.12s ease` / `0.14s ease`로 즉각적이고 매끄러운 상태 전환 제공 |
| | 16 | `delight` | ✅ PASS | 학생 검색 시 소속 학급 자동 포커싱 및 일반 과목 학급명(`2학년 1반`) 자동 변환으로 사용자 경험 향상 |
| | 17 | `overdrive` | ✅ PASS | 브라우저 순수 JS 기반 실시간 1행 자동 맞춤(`autoFitSingleLineCells_`) 및 다중 학생 HWPX/XLSX/PDF 즉시 생성 |
| **5. 견고성 & 상태 처리**<br>(Robustness & State) | 18 | `harden` | ✅ PASS | 긴 과목명 및 긴 학생 이름도 1행 자동 축소(`autoFitSingleLineCells_`)로 줄바꿈·잘림 완벽 방어 |
| | 19 | `onboard` | ✅ PASS | 학생명렬 미등록 시 안내 화면 표시(학생 포털에서는 업로드 버튼 비노출, 교사 포털에서만 관리) |
| | 20 | `distill` | ✅ PASS | 학생 시간표 내 중복 서브 모드 탭 및 상단 중복 HWPX/XLSX/PDF 버튼 제거 완료 |
| | 21 | `adapt` | ✅ PASS | 데스크톱 `n × 10` 그리드 및 모바일(`<= 640px`) 반응형 그리드 정상 동작 |
| | 22 | `optimize` | ✅ PASS | `CacheService` 멀티 청크 및 `localStorage` 기반 0ms 즉시 렌더링 유지 |
| **6. 구조 & 대안 탐색**<br>(Exploration) | 23 | `shape` | ✅ PASS | 최상단 `교사 시간표 | 학생 시간표` 1×2 포털 스위치와 하단 `n × 10` 선택 패널 구조 확립 |
| | 24 | `live` | ✅ PASS | 포털 전환 시 `body[data-portal]` 속성 기반으로 전체 테마 토큰이 실시간 전환됨 |
| | 25 | `generate` | ✅ PASS | 단일 `.q-chip` 컴포넌트가 CSS 변수만으로 교사 포털(Green)과 학생 포털(Stone Gray) 양쪽 테마에 완벽 대응 |

---

## 3. 우선순위별 핵심 개선 과제

### P1 (Critical — 사용자 명시 요구사항)
1. **학생 선택 버튼(`.q-chip.student-chip`) 디자인을 교사 선택 버튼(`.q-chip`)과 완전 동일화 (`index.html`)**
   - `.q-chip.student-chip`에서 교사 버튼과 달랐던 별도 높이(`height: 30px`), 두꺼운 보더(`1.5px`), 그림자, 학번/이름 분리 스타일(`.student-chip-id`, `.student-chip-name`)을 제거하고 `.q-chip` 기본 스타일(`padding: 5px 4px`, `border-radius: var(--radius-pill)`, `font-size: 12px`, `font-weight: 600`, 선택 시 `.q-chip.active`의 `background: var(--main-color); color: #FFFFFF; border-color: var(--main-color); font-weight: 700;`)을 그대로 상속받도록 통일합니다.
2. **각 페이지에 맞는 기본색 및 활성색 자동 적용 (`index.html`)**
   - `.q-chip`의 기본 테두리를 `border: 1px solid var(--main-tint-border);`로 설정하여:
     - **교사 시간표 페이지 (`data-portal="teacher"`)**: 미선택 기본 보더 `#B6E2CE`(그린 틴트 보더), 호버 배경 `#EAF6F0` + 보더 `#027046`, 선택(`.active`) 배경 **`#027046` (Emerald Green)** + 흰색 텍스트
     - **학생 시간표 페이지 (`data-portal="student"`)**: 미선택 기본 보더 `#D1D5DB`(스톤 그레이 틴트 보더), 호버 배경 `#F3F4F6` + 보더 `#313339`, 선택(`.active`) 배경 **`#313339` (Stone Gray)** + 흰색 텍스트
   - 이를 통해 교사 시간표 버튼과 학생 시간표 버튼이 형태·크기·두께·비율은 100% 동일하면서 페이지별 기본색과 강조색만 각 페이지 테마에 맞게 다르게 적용됩니다.

### P2 (Important — Impeccable 타이포그래피 & 곡률 정합성)
1. **최소 폰트 `12px` 기준 준수 및 비표준 곡률 제거 (`index.html`)**
   - `.group-chip-count`(`10.5px` → `12px`), `.student-elective-chip-grp`(`11px` → `12px`)로 조정하여 `12px` 미만 폰트를 제거합니다.
   - `.elective-group-highlight`의 `border-radius: 5px`를 표준 토큰 `var(--radius-sm)`(`4px`)로 변경합니다.

### P3 (Polish — 디자인 시스템 문서 및 사이드카 동기화)
1. **`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` 업데이트**
   - 학생 시간표 포털 테마 컬러(`#1F2024`, `#F3F4F6`, `#FEE2E2`)와 반응형/모달 폰트 스케일을 `DESIGN.md` 및 `.impeccable/design.json`에 등록하여 `impeccable detect` 시 Advisory까지 0건이 되도록 완벽히 동기화합니다.

---

## 4. 파일별 세부 코드 수정 지침 (`/apply` 실행 시 반영)

### Step 1. `index.html` — `.q-chip` 및 `.q-chip.student-chip` 디자인 통일 & 페이지별 기본색 적용
- **`.q-chip` 기본 스타일**:
  ```css
  .q-chip {
    border: 1px solid var(--main-tint-border);
    background: #FFFFFF;
    color: var(--ink-secondary);
    padding: 5px 4px;
    width: 100%;
    min-width: 0;
    border-radius: var(--radius-pill);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: all 0.12s ease;
  }

  .q-chip:hover {
    border-color: var(--main-color);
    background: var(--main-tint-bg);
  }

  .q-chip.active {
    background: var(--main-color);
    color: #FFFFFF;
    border-color: var(--main-color);
    font-weight: 700;
  }
  ```
- **`.q-chip.student-chip` 스타일 간소화 (교사 버튼 `.q-chip`과 100% 동일 외형 유지 + 1행 자동 맞춤 래퍼만 유지)**:
  ```css
  .q-chip.student-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .student-chip-text {
    display: inline-block;
    white-space: nowrap;
    line-height: 1.2;
  }
  ```
- **`renderQuickChips()` 내 학생 버튼 마크업**:
  - 교사 버튼과 동일하게 `<button type="button" class="q-chip student-chip' + (isSelected ? ' active' : '') + '"><span class="student-chip-text">' + escapeHtml_(stObj.id + ' ' + stObj.name) + '</span></button>` 형태로 렌더링하고 `autoFitSingleLineCells_(bar)`로 1행 동적 텍스트 크기 조정을 수행합니다.

### Step 2. `index.html` — Impeccable 정적 검출 Advisory 해소
- `.group-chip-count`, `.student-elective-chip-grp` 폰트 크기를 `12px`로 통일
- `.elective-group-highlight`의 `border-radius`를 `var(--radius-sm)`으로 변경

### Step 3. `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` — 디자인 컨텍스트 동기화
- 교사 포털(`#027046` Emerald Green)과 학생 포털(`#313339` Stone Gray / `#1F2024` Dark Stone / `#F3F4F6` Stone Tint) 듀얼 포털 테마 토큰 및 타이포그래피 스케일을 문서와 사이드카 JSON에 반영합니다.

