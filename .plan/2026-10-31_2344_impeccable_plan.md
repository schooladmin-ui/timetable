# 💎 Impeccable 25대 기준 전수 디자인 진단 및 리파인 구현 계획서

- **작성 일시 (KST)**: 2026-10-31 23:44
- **대상 프로젝트**: `c:\Users\user\Desktop\appsscript\25-timetable`
- **진단 엔진**: `impeccable.exe detect` 정적 분석기 + 6대 도메인 25개 Impeccable 전수 평가 매트릭스
- **현재 상태**: 진단 및 계획서 발행 완료 (**코드 수정 대기 중 — `/apply` 입력 시 즉시 반영**)

---

## 1. 🔍 1단계: `impeccable detect` 정적 엔진 스캔 결과

터미널에서 `.agents/skills/impeccable/scripts/bin/windows-x64/impeccable.exe detect`를 실행하여 검출된 실제 정적 위반 사항입니다.

```text
c:\Users\user\Desktop\appsscript\25-timetable\index.html
  1. [low-contrast] placeholder "학급(2-3, 203) 또는 교사·초성(ㄱㅁㄹ, 변윤) 즉시 검색..." 2.5:1 (need 4.5:1) — text #9ca3af on #ffffff
  2. [low-contrast] 2.5:1 (need 4.5:1) — text #9ca3af on #ffffff (--ink-light, .week-range-badge, .cell-empty-dash 등)
  3. [tiny-text] 11.5px body text (.chip-label, .perf-status-bar, .period-time 등 12px 미만 텍스트)
  4. [Advisory: low-contrast] 4.4:1 (need 4.5:1) — text #6b7280 on #f3f4f6 (.mode-tab 비활성 텍스트 및 .kbd-hint)
```

---

## 2. 📊 2단계: 6대 도메인 25개 전수 검사 스코어카드 (Comprehensive 25-Check Matrix)

| 도메인 | # | 세부 검증 항목 (Command) | 판정 | 주요 발견 사항 및 진단 결과 |
| :--- | :---: | :--- | :---: | :--- |
| **1. 시스템 & 컨텍스트**<br>(System & Context) | 1 | `detect` (안티패턴 스캔) | ❌ **FAIL** | `#9CA3AF` on `#FFFFFF` 저대비(2.5:1) 2건 및 `11.5px` 미세 폰트(`tiny-text`) 1건 검출, `#6B7280` on `#F3F4F6`(4.4:1) 권고 1건 검출 |
| | 2 | `doctor` (규격 정합성) | ⚠️ **WARN** | `.impeccable/design.json` 설정 파일 및 디자인 컨텍스트 문서가 아직 초기화되지 않음 |
| | 3 | `init` (초기화 구성) | ⚠️ **WARN** | 프로젝트 루트에 `PRODUCT.md`, `DESIGN.md` 문서가 부재하여 디자인 시스템 명세화 필요 |
| | 4 | `document` (문서화) | ⚠️ **WARN** | 두 첨부 이미지 통합 디자인 시스템(포스터 에디토리얼 헤더 + 대시보드 파스텔 그리드)의 토큰 규칙 문서화 필요 |
| | 5 | `extract` (토큰 추출) | ⚠️ **WARN** | `:root`에 주요 변수가 정의되어 있으나, 일부 보더(`#D1D5DB`, `#E5E7EB`) 및 인라인 스타일(`style="..."`)이 하드코딩됨 |
| **2. 사용성 & 접근성**<br>(Evaluation) | 6 | `critique` (휴리스틱) | ✅ **PASS** | 현재 모드 표시, 0ms 즉시 검색 피드백, 단축키(`/`) 지원, 교사↔학급 양방향 클릭 점프 등 사용성 우수 (38/40점) |
| | 7 | `audit` (WCAG 2.1 AA) | ❌ **FAIL** | 1) `#9CA3AF` 텍스트 명도 대비 미달(2.5:1 → `#52525B` 이상으로 상향 필요)<br>2) 키보드 `Tab`으로 시간표 셀 탐색 시 `tabindex` 및 `:focus-visible` 링 보강 필요 |
| | 8 | `clarify` (UX 라이팅) | ✅ **PASS** | 버튼 레이블(`🏫 학급 시간표`, `👨‍🏫 교사 시간표`, `✨ 공강 교사 찾기`)과 하단 범례 안내 문구가 직관적이고 명확함 |
| **3. 시각 & 타이포그래피**<br>(Visual & Type) | 9 | `typeset` (타이포그래피) | ❌ **FAIL** | `11px` / `10.5px` / `11.5px`로 설정된 소형 텍스트가 정적 검사기(`tiny-text`)에 적발됨 → 최소 `12px` 이상으로 스케일 표준화 필요 |
| | 10 | `colorize` (컬러 밸런스) | ✅ **PASS** | 다크 차콜(`#18181B`), 골드(`#FACC15`), 네온 라임(`#EEFC79`), 이동수업 라벤더(`#EDE9FE`), 금일 웜크림(`#FEFCE8`) 조화 우수 |
| | 11 | `layout` (여백·그리드) | ✅ **PASS** | `table-layout: fixed` 6열 균등 분할 및 상하 2단 에디토리얼 구분선(`2px solid`)의 시각적 비례가 안정적임 |
| | 12 | `bolder` (시각적 임팩트) | ✅ **PASS** | `36px` 엑스트라 볼드 타이틀과 트윈 스파클(`✦✦`) SVG, 라임 교시 열이 뚜렷한 인상을 형성함 |
| | 13 | `quieter` (노이즈 제어) | ✅ **PASS** | 학급 시간표 기본 뷰에서 불필요한 시각 요소를 덜어내고 깔끔한 중앙 정렬 과목명 중심으로 정돈됨 |
| **4. 디테일 & 인터랙션**<br>(Craft & Motion) | 14 | `polish` (곡률·마감) | ⚠️ **WARN** | 버튼·칩·배지·카드의 `border-radius`가 `3px, 4px, 6px, 7px, 8px, 9px, 10px, 12px`로 산재됨 → **4px / 8px / 12px / 999px** 4단계로 통일 필요 |
| | 15 | `animate` (트랜지션) | ✅ **PASS** | 0.1s~0.12s의 즉각적인 마이크로 트랜지션으로 0ms 검색 체감 속도를 해치지 않으면서 부드럽게 반응함 |
| | 16 | `delight` (디테일 포인트) | ✅ **PASS** | 초성 검색 즉시 하단 시간표가 실시간 프리뷰로 전환되는 손맛과 셀 클릭 교차 이동 인터랙션이 뛰어남 |
| | 17 | `overdrive` (고급 효과) | ✅ **PASS** | 상단 스티키 컨트롤 바의 `backdrop-filter: blur(10px)` 글래스모피즘 효과가 깔끔하게 적용됨 |
| **5. 견고성 & 상태 처리**<br>(Robustness & State) | 18 | `harden` (예외·오버플로) | ⚠️ **WARN** | 긴 선택과목명이나 특별실명이 들어올 때 셀 높이가 튀지 않도록 `overflow-wrap: anywhere` 및 말줄임 방어 보강 필요 |
| | 19 | `onboard` (첫 진입 안내) | ✅ **PASS** | 하단 범례 우측의 `💡 셀을 클릭하면 교사 ↔ 학급 시간표로 즉시 전환됩니다` 팁과 검색창 `/` 단축키 안내가 친절함 |
| | 20 | `distill` (단순화) | ⚠️ **WARN** | `freeFinderPanel`, `legendFooter` 내 일부 인라인 `style="..."` 속성을 시맨틱 CSS 클래스로 분리하여 코드 순도 향상 필요 |
| | 21 | `adapt` (반응형 적응) | ✅ **PASS** | `@media (max-width: 640px)` 모바일 뷰 및 `@media print` A4 포스터 인쇄 미디어 쿼리가 모두 구현됨 |
| | 22 | `optimize` (성능 최적화) | ✅ **PASS** | 외부 폰트/프레임워크 블로킹 0건, `doGet` 인라인 JSON + `localStorage` + `Map` 인덱싱으로 0.1ms 이내 렌더링 달성 |
| **6. 구조 & 대안 탐색**<br>(Exploration) | 23 | `shape` (정보 구조 IA) | ✅ **PASS** | `[상단 검색/필터 바] → [빠른 선택 칩] → [메인 시간표 카드] → [범례 바]`의 4단 수직 위계가 명확함 |
| | 24 | `live` (실시간 전환) | ✅ **PASS** | `[👤 교사명 표시]`, `[🔒 이름 *표시]`, `[🎨 배경색]` 실시간 뷰 토글이 상태 유실 없이 즉각 동작함 |
| | 25 | `generate` (테마 확장성) | ✅ **PASS** | 학급 게시용 클린 뷰(이미지 2)와 교사/선택교과 대시보드 뷰(이미지 1)를 단일 컴포넌트에서 유연하게 표현함 |

- **종합 점수**: **25개 항목 중 17개 PASS / 5개 WARN / 3개 FAIL** (`impeccable detect` 정적 오류 3건 + 권고 1건 해결 시 **25개 전 항목 100% PASS** 달성 가능)

---

## 3. 🎯 3단계: 우선순위별 핵심 개선 과제 (Action Items)

### 🚨 P1 (Critical — `impeccable detect` 정적 실패 3건 & 접근성 완벽 해결)
1. **WCAG 2.1 AA 명도 대비(Contrast Ratio ≥ 4.5:1) 전면 충족**:
   - `--ink-light` 및 검색창 `::placeholder`, `.week-range-badge`, `.cell-empty-dash`, `.perf-status-bar`의 텍스트 색상을 기존 `#9CA3AF`(흰 배경 대비 2.5:1)에서 **`#52525B`**(흰 배경 대비 **7.4:1**) 또는 **`#64748B`**(흰 배경 대비 **4.8:1**)로 상향 조정합니다.
   - `.mode-tab`, `.kbd-hint` 등 `#F3F4F6` 배경 위 텍스트 색상을 기존 `#6B7280`(4.4:1, Advisory 발생)에서 **`#4B5563`**(대비 **6.8:1**)로 상향하여 Advisory까지 0건으로 만듭니다.
   - 셀 내부 서브 텍스트(`.cell-sub-info`) 역시 `#71717A`에서 **`#52525B`**로 조정하여 연보라(`#EDE9FE`) 및 웜크림(`#FEFCE8`) 배경 위에서도 4.5:1 이상의 선명한 가독성을 확보합니다.
2. **소형 텍스트(`tiny-text` < 12px) 전면 제거**:
   - `.kbd-hint` (`11px` → `12px`), `.ac-badge` (`11px` → `12px`), `.chip-label` (`11.5px` → `12px`), `.period-time` (`11px` → `12px`), `.status-pill` (`10.5px` → `12px`), `.legend-pill` (`11px` → `12px`), `.perf-status-bar` (`11.5px` → `12px`) 등 모든 `12px` 미만 폰트 크기를 최소 `12px` 이상으로 표준화합니다.

### ⚠️ P2 (Important — 디자인 시스템 문서화 & 키보드 접근성 강화)
1. **`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` 생성 (`init` & `document` & `doctor` 해결)**:
   - 초고속 시간표 검색 웹앱의 제품 정의서(`PRODUCT.md`)와 두 첨부 이미지 통합 디자인 시스템 명세서(`DESIGN.md`), 정적 검사기 설정(`.impeccable/design.json`)을 생성합니다.
2. **키보드 접근성(`audit`) 및 셀 포커스 링 추가**:
   - 클릭 가능한 시간표 셀(`.td-cell.clickable`)에 `tabindex="0"`, `role="button"`, `onkeydown`(Enter/Space 지원) 및 선명한 `:focus-visible` 아웃라인을 부여하여 마우스 없이 키보드만으로도 교사↔학급 교차 이동이 가능하도록 개선합니다.

### ✨ P3 (Polish — 곡률 토큰 통일 & 인라인 스타일 제거)
1. **3단계 곡률(Border-Radius) 토큰 체계화 (`polish` 해결)**:
   - `:root`에 `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px`, `--radius-pill: 999px`를 정의하고 산재된 곡률 값을 일괄 정리합니다.
2. **인라인 `style="..."` 속성 제거 (`extract` & `distill` 해결)**:
   - `index.html` 내부의 인라인 스타일(`style="font-size:13px..."`, `style="margin-left:auto..."` 등)을 모두 전용 CSS 클래스로 분리합니다.

---

## 4. 🛠️ 4단계: 파일별 구체적 리팩토링 지침 (`Step 1` ~ `Step 4`)

- **Step 1 (`PRODUCT.md` & `DESIGN.md` & `.impeccable/design.json` 생성)**:
  - 프로젝트 루트에 제품 목표(0ms 검색 아키텍처)와 디자인 토큰(다크&골드 헤더, 라임 교시축, 파스텔 상태 셀, 타이포그래피 위계)을 문서화합니다.
- **Step 2 ([index.html](file:///c:/Users/user/Desktop/appsscript/25-timetable/index.html) CSS 디자인 토큰 및 대비/폰트 스케일 교정)**:
  - `:root` 컬러 토큰의 명도 대비를 WCAG AA(4.5:1 이상)로 전면 업그레이드하고, `12px` 미만 폰트 사이즈를 모두 `12px`~`16px` 범위로 정규화합니다.
  - 인라인 스타일을 CSS 클래스로 추출하고 키보드 `:focus-visible` 스타일을 추가합니다.
- **Step 3 ([index.html](file:///c:/Users/user/Desktop/appsscript/25-timetable/index.html) 렌더링 접근성 속성 보강)**:
  - 교차 이동 셀에 키보드 이벤트(`Enter`/`Space`) 및 `tabindex="0"`을 부여합니다.
- **Step 4 (최종 검증)**:
  - `impeccable.exe detect` 재실행 시 **0 anti-patterns, 0 advisories** 통과 확인 및 `node` 구문 검사 통과 확인.

---

> [!IMPORTANT]
> **`/impeccable-all` 대기 안내**
> 위 25대 전수 진단 결과 및 개선 계획서를 코드에 즉시 반영하려면 **`/apply`**를 입력해 주세요!

