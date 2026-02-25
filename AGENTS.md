# AGENTS.md (Repository)

이 파일은 **프로젝트 규칙(문서 로깅/개발 환경/스타일/위임 정책)**을 정의합니다.  
워크플로우/스킬 목록은 `.agent/skills/`에서 관리합니다.

---

## 1) 기본 원칙(필수)
- 답변/문서/로그는 **한국어**로 작성합니다.
- 문서는 **UTF-8(가능하면 BOM 없음)** 으로 저장합니다.
- **파일/폴더 삭제 금지**, 이동/리네임은 **반드시 사전 질문 후** 진행합니다.
- 민감정보(토큰/키/개인정보)는 코드/문서/로그에 기록하지 않고 `REDACTED` 처리합니다.

---

## 2) 프로젝트 컨텍스트(개발 환경/스타일) — 단일 소스
- 프로젝트의 “현재 상태/결정/개발 환경/스타일”은 아래 문서가 **Source of Truth** 입니다:
  - `@/.agent/Project_Context.md`

### 규칙
- 작업 시작 시 `Project_Context.md`를 먼저 읽고, 환경/명령/컨벤션을 따른다.
- 문서가 없으면 **최소 템플릿을 생성**하고, 사용자에게 채워야 할 항목을 안내한다.
- 작업 종료 시 “변경된 결정/상태/다음 할 일”을 이 문서에 반영한다.

---

## 3) SSOT 및 문서 로깅 시스템(핵심)

### 3.1 운영 SSOT 문서
- 계획/기능/아이디어/추후 적용 항목: `docs/Resources/Backlog.md`
- 현재 막힘/오류/결정 필요 항목: `docs/Resources/Issue_Tracker.md`

**규칙**
- 대형 작업(autowork/bugfix 포함)은 SSOT 문서를 먼저 확인하고 우선순위를 정한다.
- 기능 변경이 사용자 흐름/화면/요구사항에 영향을 주면 PRD/Flow/Design/Backlog를 함께 갱신한다.

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
  - `docs/TestData/YYYY-MM-DD_<task-slug>.md`

**각 파일 최소 섹션**
- 테스트 목적/범위
- 데이터 출처(시드/샘플/수동 입력) 및 준비 절차
- 사용 데이터 식별자(민감정보는 `REDACTED`)
- 테스트 케이스별 데이터 매핑
- 종료 후 데이터 상태(원복/유지/보관 위치)

**규칙**
- `docs/Logs/execution_history.jsonl`의 해당 실행 로그에 Test Data 파일 경로를 함께 남긴다.
- 테스트 데이터가 운영/실사용 데이터와 섞이지 않도록 구분한다.

---

## 4) 기술 스택/코딩 스타일(WSL 전환 기준)

### 4.1 기본 스택 고정
- Frontend는 **반드시** `Vite + TypeScript + Vue 3`을 사용한다.
  - Vue는 **Composition API**를 기본으로 강제한다.
  - `.vue` 기본 템플릿은 **`<script setup lang="ts">`**를 강제한다.
- Backend는 **반드시** `Spring Boot`를 기준으로 한다.
  - 계층은 Controller / Service / Repository(또는 Adapter)를 유지한다.
  - DTO(Request/Response) 분리를 강제한다.

### 4.2 프론트엔드 UI/디자인 원칙
- 일관성: 컴포넌트/간격/타이포/색상 패턴 통일
- 단순성: 목적이 분명한 UI 유지
- 접근성: 키보드 내비게이션/포커스 표시/명도 대비 고려
- 상태 설계: loading/empty/error 상태를 항상 정의
- 반응형: 모바일/데스크톱 레이아웃 안정성 유지

### 4.3 스타일 적용 규칙
- 가능하면 디자인 토큰(CSS 변수/Tailwind config)을 우선 사용
- 매직 넘버 남발 금지, 기존 스케일/토큰 우선
- 큰 UI 변경은 Design 문서에 범위/시안 기록 후 진행

---

## 5) 세션 종료 시 기록(필수)
작업 턴 종료 전 아래를 수행한다.

1) `@/.agent/Project_Context.md` 업데이트(현재 상태/결정/다음 할 일)
2) 실행 로그 1줄 기록: `@/docs/Logs/execution_history.jsonl`
3) 오류/장애가 있었다면: `@/docs/Logs/errors.jsonl` 또는 `errors.md`
4) 테스트를 수행했다면: `@/docs/TestData/YYYY-MM-DD_<task-slug>.md`
5) 규칙/스킬/설정 스냅샷 파일이 변경됐다면: `python3 scripts/notion_sync_settings.py`
6) Codex가 직접 못 고친 전역/OS 설정 이슈가 있으면: `docs/Resources/Manual_Patches.md` 갱신

### Notion 운영 보조 규칙
- 새 환경에서 로컬 규칙/스킬이 부족하면: `python3 scripts/notion_bootstrap_pull.py`
- 반자동 동기화가 필요하면: `python3 scripts/notion_sync_watch.py`

---

## 6) 실행/위임 정책 (2026-02-25-WSL-R1, 필수)
<!-- [Delegation-Policy-2026-02-25-WSL-R1] -->

### 6.1 Codex 직접 수행(WSL 기본)
- Docker CLI(`docker ps`, `docker compose`, `docker logs` 등)
- Supabase CLI(`supabase start/status/migration/db push` 등)
- 기본 경로는 `npx supabase ...`를 사용한다.
- `npx supabase`가 깨진 경우에만 `bash scripts/supabase_cli_wsl.sh ...`를 fallback으로 사용한다.
- 단위 테스트/타입체크/린트/코드 로직 검증

### 6.2 전역/OS 설정 실패 시 핸드오프
- Docker Desktop WSL 통합, 전역 Codex 설정(`~/.codex/*`) 등은 Codex가 직접 수정하지 못할 수 있다.
- 이 경우 `docs/Resources/Manual_Patches.md`에 아래를 남긴다.
  - 복붙용 설정 블록
  - 적용 절차(단계별)
  - 재시작/검증 절차

### 6.3 멀티 에이전트 활용(작업 기본값)
- `.codex/config.toml`의 멀티 에이전트 구성을 기본 사용한다.
- 최소 활용 규칙:
  - `explorer`: 코드/문서 탐색 및 영향 범위 파악
  - `reviewer`: 규칙 준수/회귀 리스크 점검
  - `scribe`: 문서 초안 및 로그 정리
  - `executor_wsl`: WSL 명령 실행 보조
- 단일 writer 원칙을 유지하며 최종 파일 반영은 `default` 역할에서 수행한다.

### 6.4 Antigravity 위임 유지
- E2E/UI 실제 화면 검증
- 시각 검증(스크린샷 중심 QA)
- 이미지/에셋 생성·가공

### 6.5 Playwright/MCP 정책
- Playwright / Playwright MCP 기반 E2E 자동화는 **신규 작업에서 사용하지 않는다**.
- 관련 문서는 삭제하지 않고 `[DEPRECATED]` 상태로 보관하며 참조를 중단한다.

---

## 7) 이미지/에셋 위임 정책 (2026-02-25-R1)
<!-- [Asset-Delegation-Policy-2026-02-25-R1] -->
- 마스코트/배경/파비콘/아이콘/OG 등 **시각적 에셋 생성·가공·시각 검증**은 Google Antigravity에 위임한다.
- Codex는 요구사항 문서 작성과 코드 연결, 매니페스트 업데이트를 담당한다.
- 요청서: `docs/Resources/Design/Assets/requests/Asset_Request_<YYYY-MM-DD>_<slug>.md`
- 결과서: `docs/Logs/Asset_Report_<YYYYMMDD-HHMM>.md`
- 활성 자산 SSOT: `docs/Resources/Design/Assets/asset_manifest.md`
- 상세 규칙: `docs/Resources/Asset_Delegation_Policy.md` 및 `docs/Resources/Asset_Image_Delegation_Policy.md`
