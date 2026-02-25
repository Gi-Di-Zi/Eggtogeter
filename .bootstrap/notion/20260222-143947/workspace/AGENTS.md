# AGENTS.md (Repository)

이 파일은 **프로젝트 규칙(문서 로깅/개발 환경/프론트 스타일)**을 정의합니다.  
워크플로우/스킬 목록은 여기서 관리하지 않습니다(별도 폴더에서 관리).

---

## 1) 기본 원칙(필수)
- 답변/문서/로그는 **한국어**로 작성합니다.
- 문서는 **UTF-8(가능하면 BOM 없음)** 으로 저장합니다.
- **파일/폴더 삭제 금지**, 이동/리네임은 **반드시 사전 질문 후** 진행합니다.

---

## 2) 프로젝트 컨텍스트(개발 환경/스타일) — 단일 소스
- 프로젝트의 “현재 상태/결정/개발 환경/스타일”은 아래 문서가 **Source of Truth** 입니다:
  - `@/.agent/Project_Context.md`

### 규칙
- 작업 시작 시 `Project_Context.md`를 먼저 읽고, 환경/명령/컨벤션을 따른다.
- 문서가 없으면 **최소 템플릿을 생성**하고, 사용자에게 채워야 할 항목을 안내한다.
- 작업 종료 시 “변경된 결정/상태/다음 작업”을 이 문서에 반영한다.

---

## 3) 문서 로깅 시스템(핵심)

이 프로젝트는 다음 3종 로그/문서를 운영합니다.

### 3.1 기획 문서(Planning) — PRD / Flow / Design / Backlog
- PRD: `docs/Resources/PRD/` 또는 `docs/Resources/PRD.md`
- Flow: `docs/Resources/Flow/` 또는 `docs/Resources/Flow.md`
- Design: `docs/Resources/Design/` 또는 `docs/Resources/Design.md`
- Backlog: `docs/Resources/Backlog.md`

**규칙**
- 기능 변경이 사용자 흐름/화면/요구사항에 영향을 주면 해당 문서를 갱신한다.
- Flow 문서에는 가능하면 Mermaid 다이어그램(시퀀스/상태)을 포함한다.
- Design 문서에는 UI 상태(loading/empty/error)와 인터랙션(hover/focus/keyboard)을 명시한다.

### 3.2 진행 중 정리(Progress)
- 일자별 진행 로그: `docs/Progress/YYYY-MM-DD.md`

**각 파일 최소 섹션**
- 오늘 목표
- 완료한 일(변경 파일/핵심 결정)
- 다음 할 일
- 이슈/리스크(재현/증거 포함)

### 3.3 오류 로그(Error Logs)
- 오류/장애/재현 가능한 버그는 아래 중 하나에 기록한다:
  - `docs/Logs/errors.jsonl` (권장)
  - 또는 `docs/Logs/errors.md`

**errors.jsonl 권장 스키마**
- `ts` (ISO-8601)
- `severity` (info/warn/error/critical)
- `area` (frontend/backend/infra/build/test 등)
- `summary` (한 줄 요약)
- `steps` (재현 절차 배열)
- `expected` / `actual`
- `env` (민감정보 없이)
- `notes` (원인/가설/해결/링크)

### 3.4 테스트 데이터 로그(Test Data Logs)
- 테스트(자동/수동/E2E/UI)를 수행한 경우, 사용한 테스트 데이터를 별도 파일로 기록한다:
  - `docs/TestData/YYYY-MM-DD_<task-REDACTED>.md`

**각 파일 최소 섹션**
- 테스트 목적/범위
- 데이터 출처(시드/샘플/수동 입력) 및 준비 절차
- 사용 데이터 식별자(계정/레코드/파일)  
  - 민감정보는 `REDACTED` 또는 별칭 사용
- 테스트 케이스별 데이터 매핑
- 종료 후 데이터 상태(원복/유지/보관 위치)

**규칙**
- `docs/Logs/execution_history.jsonl`의 해당 실행 로그에 Test Data 파일 경로를 함께 남긴다.
- 테스트 데이터가 운영/실사용 데이터와 섞이지 않도록 구분한다.
- 계정정보/토큰/개인정보를 그대로 기록하지 않는다.

---

## 4) 프론트엔드 스타일/디자인 원칙(핵심)

### 4.1 UI 기본 방향
- 일관성: 컴포넌트/간격/타이포/색상 사용 패턴을 통일한다.
- 단순성: 불필요한 시각 요소를 줄이고, 목적이 분명한 UI를 만든다.
- 접근성: 키보드 내비게이션/포커스 표시/명도 대비를 고려한다.
- 상태 설계: loading/empty/error 상태를 항상 정의한다.
- 반응형: 화면 크기 변화에서 레이아웃이 깨지지 않도록 한다.

### 4.2 스타일 적용 규칙(실행 가능한 수준)
- 가능하면 “디자인 토큰”으로 관리한다(색/간격/라운드/그림자).
  - 예: CSS 변수(theme), Tailwind config, token 파일 등 프로젝트 방식에 맞춘다.
- 레이아웃/여백은 Tailwind 유틸을 우선 사용하고, 컴포넌트는 Element Plus 기본 스타일을 존중한다.
- 매직 넘버(임의의 px/색상코드) 남발을 피하고, 기존 스케일/토큰이 있으면 그것을 우선한다.
- UI 변경이 크면 **Design 문서에 먼저 범위/시안을 기록**하고 진행한다.

### 4.3 디자인 원칙
- 60-30-10 원칙(배경 60%, 구조 30%, 강조 10%)을 기본 가이드로 삼는다.
- 강조(10%)는 “핵심 CTA/현재 상태/경고”에만 사용한다(남발 금지).

---

## 5) 세션 종료 시 기록(필수)
작업 턴 종료 전 아래를 수행한다.

1) `@/.agent/Project_Context.md` 업데이트(현재 상태/결정/다음 할 일)
2) 실행 로그 1줄 기록:
   - `@/docs/Logs/execution_history.jsonl`
3) 오류/장애가 있었다면:
   - `@/docs/Logs/errors.jsonl` 또는 `errors.md`에 기록
4) 테스트를 수행했다면:
   - `@/docs/TestData/YYYY-MM-DD_<task-REDACTED>.md` 기록
