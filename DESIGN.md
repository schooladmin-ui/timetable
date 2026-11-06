---
name: 25-Timetable
description: 초고속 학급·교사 시간표 검색 및 HWPX·XLSX·PDF 문서 출력 시스템
colors:
  brand-green: "#027046"
  brand-green-dark: "#015434"
  brand-green-tint: "#EAF6F0"
  brand-green-border: "#B6E2CE"
  brand-stone: "#313339"
  bg-page: "#F4F6F8"
  bg-card: "#FFFFFF"
  ink-primary: "#111827"
  ink-secondary: "#313339"
  ink-subtle: "#52525B"
  badge-yellow-bg: "#FEF08A"
  badge-yellow-text: "#713F12"
  elective-hl-bg: "#D9F99D"
  elective-hl-border: "#BEF264"
  elective-hl-text: "#1A2E05"
  semantic-danger-bg: "#FEF2F2"
  semantic-danger-border: "#FCA5A5"
  semantic-danger-text: "#B91C1C"
  semantic-danger-strong: "#DC2626"
  semantic-match-bg: "#DCFCE7"
  semantic-match-tint: "#D1FAE5"
  semantic-today-glow: "#6EE7B7"
  border-neutral-light: "#E5E7EB"
  ink-placeholder: "#9CA3AF"
typography:
  display:
    fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Malgun Gothic', sans-serif"
    fontSize: "36px"
    fontWeight: 800
    lineHeight: 1.1
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.25
  body:
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "'Pretendard Variable', 'Pretendard', sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "20px"
  xl: "32px"
components:
  mode-tab-active:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.bg-card}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 15px"
  mode-tab-inactive:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.brand-green-dark}"
    rounded: "{rounded.md}"
    height: "38px"
    padding: "0 15px"
  top-toggle-btn:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.lg}"
    height: "46px"
    padding: "0 14px"
  quick-chip:
    backgroundColor: "{colors.bg-card}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.pill}"
    padding: "5px 4px"
---

# 🎨 디자인 시스템 명세서 (`DESIGN.md`)

## Overview

**The Crisp Editorial Grid.** 본 프로젝트는 학교 현장의 복잡한 시간표 데이터를 한눈에 판독할 수 있도록 에디토리얼 인쇄물의 명쾌한 타이포그래피 위계와 고대비 격자(Grid) 시스템을 결합한 디자인 언어를 사용합니다. 단일 메인 컬러인 **Emerald Green (`#027046`)** 과 구조적 프레임 컬러인 **Stone Gray (`#313339`)** 만으로 시각적 위계를 통일하며, 불필요한 장식을 배제하고 즉각적인 탐색과 문서 출력(HWPX, XLSX, PDF)에 집중합니다.

## Colors

본 프로젝트는 **녹색(`#027046`)** 을 유일한 메인 테마 컬러로 사용하며, 에디토리얼 구분선 및 코너 프레임에는 **Stone Gray(`#313339`)** 를 조합합니다.

| 구분 | 토큰명 | HEX 코드 | 주요 적용 영역 및 역할 |
| :---: | :--- | :---: | :--- |
| **Primary** | `--main-color` | `#027046` | 주간 시간표 요일 헤더 배경, 메인 타이틀, 활성 모드 탭/칩 배경, 현재 수업 슬롯 강조 |
| **Primary Dark** | `--main-color-dark` | `#015434` | 상단 슬로건 배너, 비활성 모드 탭 텍스트, 오늘 요일 헤더 강조, 교시 번호 텍스트 |
| **Primary Tint** | `--main-tint-bg` | `#EAF6F0` | 모드 탭 트레이 배경, 교시 열 배경, 점심 시간 행 배경, 셀 호버 및 활성 토글 배경 |
| **Structural Frame** | `--brand-stone` | `#313339` | 에디토리얼 상·하단 2px 구분선, 시간표 외곽 프레임, 좌측 상단 `교시` 코너 헤더, 공유 공강(`is-shared-free`) 강조 셀 |
| **Status Accent** | `--badge-yellow-bg` | `#FEF08A` | `보강`·`교체`·`이동` 상태 배지 배경 (텍스트 `#713F12`, WCAG AA 고대비 충족) |
| **Elective Highlighter** | `--elective-hl-bg` | `#D9F99D` | 선택과목 1행(`'O_선택'`) 파스텔 형광펜 마커 하이라이트 배경 (보더 `#BEF264`, 텍스트 `#1A2E05`, 글자 크기 유지) |

## Typography

- **Font Stack**: `'Pretendard Variable'`, `'Pretendard'`, `-apple-system`, `'Malgun Gothic'`, `sans-serif`
- **Display (`36px` / `800` / `-0.035em`)**: 시간표 카드 메인 타이틀 (`#headerMainTitle`: `학급 시간표`, `주간 시간표`, `공유 공강 시간표`)
- **Affiliation & Sub-Role (`34px` / `800` / `-0.03em`)**: 우측 학급명 및 담임·교사 성명 표기
- **Headline (`32px` / `600` / `-0.03em`)**: 상단 학년도·학기 표기 (`#headerSchoolYear`: `2025학년도 2학기`)
- **Cell Subject (`15px` / `700`)**: 시간표 각 교시 셀의 핵심 교과목명 (`.cell-main-text`)
- **Mode Tab (`14px` / `800`)**: 2행 좌측 4대 핵심 모드 전환 탭 (`.mode-tab`)
- **Minimum Floor (`12px`)**: 모든 칩(`.q-chip`), 배지, 보조 설명은 최소 `12px` 이상을 유지하여 고해상도 디스플레이 가독성을 보장합니다 (`tiny-text` 0건).

## Layout

- **상단 컨트롤바 (`.control-bar`, 최대 폭 `1080px`)**:
  - **1행 (`.control-row-search`, 높이 `46px` 통일)**: 좌측 `👤 교사명`·`🔒 *표시` 토글 버튼(`.top-toggle-btn`) + 중앙 학기 선택 드롭다운(`.project-select-wrap`) + 우측 초성·단축어 즉시 검색창(`.search-input-wrap`).
  - **2행 (`.control-row-actions`)**: 좌측 고가시성 4대 모드 탭(`👨‍🏫 교사 시간표` → `✨ 공강 교사 찾기` → `🤝 공유 공강 확인` → `🏫 학급 시간표`) + 우측 유틸리티 버튼(`🔄 동기화`, `📄 HWPX`, `📊 XLSX`, `🖨️ PDF`).
  - **3행 (`#quickChipsBar`, `n × 10` 고정 그리드)**: 데스크톱 기준 매 행 10개씩 정렬되는 `repeat(10, minmax(0, 1fr))` 고정 그리드. 모바일(`<= 640px`)에서는 `repeat(5, minmax(0, 1fr))` 5열 그리드로 자동 전환됩니다.
- **메인 시간표 시트 컨테이너 (`.sheet-container`, 최대 폭 `940px`)**:
  - 6열(`교시` 84px + `월~금` 5등분) 고정 비율 테이블. 일반 교시 행 높이 `76px`, 4교시와 5교시 사이 `'점심 시간'` 행 높이 `38px`(1/2 비율).

## Elevation & Depth

- **Tonal & Crisp Border Layering**: 본 시스템은 흐릿한 그림자 대신 `1.5px ~ 2px` 실선 보더(`#027046`, `#313339`)와 민트 틴트(`#EAF6F0`) 배경 대비를 통해 계층을 구분합니다.
- **Shadow Vocabulary**:
  - **Control Elevation** (`0 2px 8px rgba(2, 112, 70, 0.08)`): 1행 검색창, 학기 드롭다운, 활성 토글 버튼의 미세 부양감.
  - **Mode Tray Elevation** (`0 3px 10px rgba(2, 112, 70, 0.12)`): 2행 모드 탭 트레이 및 활성 모드 탭 강조.
  - **Modal Backdrop Shadow** (`0 24px 64px rgba(0, 0, 0, 0.38)`): 전체화면 시간표 확대 모달 및 학기 시트 관리 모달.

## Shapes

- `--radius-sm` (`4px`): 상태 배지(`.status-pill`), 학년 배지(`.grade-row-badge`), 키보드 힌트(`.kbd-hint`)
- `--radius-md` (`8px`): 모드 탭 버튼(`.mode-tab`), 유틸리티 버튼(`.util-btn`), 시간표 테이블 외곽 래퍼(`.timetable-table-wrap`)
- `--radius-lg` (`12px`): 1행 토글 버튼(`.top-toggle-btn`), 학기 드롭다운(`.project-select-wrap`), 검색창(`.search-input-wrap`), 모드 탭 트레이(`.mode-tabs`), 메인 시간표 카드(`.timetable-card`)
- `--radius-pill` (`999px`): 학급·교사·공강 빠른 선택 칩(`.q-chip`)

## Components

### Mode Tabs (`.mode-tabs` / `.mode-tab`)
- **트레이**: `#EAF6F0` 배경, `2px solid #027046` 테두리, `12px` 곡률, `5px` 패딩, `6px` 간격.
- **비활성 탭**: `#FFFFFF` 카드형 배경, `1.5px solid #B6E2CE` 보더, `#015434` 텍스트(`14px`, `800`). 호버 시 `#027046` 보더 및 `-1px` 상승.
- **활성 탭 (`.mode-tab.active`)**: `#027046` 배경, `#FFFFFF` 텍스트, `#015434` 보더 및 그린 글로우 그림자.

### Top Row Toggle Buttons (`.top-toggle-btn`)
- **형태**: 1행 좌측 배치, 높이 `46px`, 좌우 패딩 `14px`, `12px` 곡률, `2px` 보더.
- **활성 상태 (`.active-opt`)**: `#EAF6F0` 배경, `2px solid #027046` 보더, `#015434` `800` 텍스트 (`aria-pressed="true"`).

### Quick Selection Chips (`.q-chip`)
- **형태**: `--radius-pill` (`999px`), `#FFFFFF` 배경, `1px solid #D1D5DB` 보더, `12px` 폰트, 말줄임(`ellipsis`) 처리.
- **활성 상태 (`.q-chip.active`)**: `#027046` 배경, `#FFFFFF` 텍스트.

## Do's and Don'ts

### Do:
- **Do** 단일 메인 테마 컬러 `#027046`과 구조적 컬러 `#313339`만 사용하여 브랜드 일관성을 유지하세요.
- **Do** 모든 텍스트와 칩 레이블의 최소 글자 크기를 `12px` 이상으로 유지하세요.
- **Do** 검색/조회 시점의 현재 교시(`.is-current-slot`)는 `#027046` 배경과 `#FFFFFF` 텍스트로, 공유 공강(`.is-shared-free`)은 `#313339` 배경으로 명확히 구분하세요.

### Don't:
- **Don't** 하드코딩된 더미 시간표 데이터를 코드에 포함하지 마세요.
- **Don't** `@media print` 인쇄 시 상단 컨트롤바(`.control-bar-wrap`)나 확대 아이콘(`.eh-zoom-btn`)이 노출되지 않도록 하세요.
