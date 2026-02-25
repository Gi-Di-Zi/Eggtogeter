# Workspace Organization (2026-02-24)

## 목적
- 이동/삭제 없이 현재 워크스페이스를 안정적으로 유지할 수 있도록 폴더/파일 역할을 고정한다.
- 생성 산출물과 소스 코드를 분리해 작업 중 `git status` 노이즈를 줄인다.

## 폴더 역할
- `src/`: 프론트엔드 애플리케이션 소스 코드
- `public/`: 정적 자산
- `supabase/`: 스키마/설정 등 DB 관련 소스
- `scripts/`: 로컬 검증/자동화 스크립트
- `docs/`: 기획/진행/로그 문서
- `.agent/`: 프로젝트 컨텍스트 및 협업 설정
- `.bootstrap/`: Notion bootstrap 스냅샷 보관
- `output/`: 테스트/검증 산출물(스크린샷 등)
- `old/`: 보관용 디렉터리(삭제 대신 보관 원칙)

## 루트 파일 운영 기준
- 유지 대상(설정/실행 필수): `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `.env*`, `AGENTS.md`, `README.md`
- 운영 로그/임시 성격: `start_log.txt`, `debug.log`, `build_log.txt`, `status.json`, `user_dump.json`, `.git_acl_backup.txt`
- 원칙: 임시/로그 파일은 생성 자체는 허용하되 소스 변경과 분리 관리한다.

## 이번 턴에 적용한 정리
- `.gitignore` 보강:
  - `.vite-codex/`
  - `.npm-cache/`
  - `.npm-cache-pw-*/`
  - `output/`
  - `push-work/`
  - `scripts/_e2e_svc_key.txt`

## 이동/리네임 승인 후 진행할 후보
- `start_log.txt`, `debug.log`, `build_log.txt` -> `old/logs/` 하위 날짜별 보관
- `status.json`, `user_dump.json` -> `old/runtime/` 보관 후 템플릿만 유지
- 루트 단일 SQL(`get_hash.sql`) -> `supabase/sql/` 또는 `docs/Resources/sql/`로 이동

## 운영 체크리스트
1. 세션 시작 시 `git status --short --untracked-files=all` 확인
2. 임시 파일이 생기면 `.gitignore`에 먼저 반영
3. 이동/리네임이 필요하면 사전 승인 후 실행

## 2026-02-24 적용 결과 (루트 정리 2차)
- 이동 완료(삭제 없음):
  - build_log.txt, debug.log, start_log.txt -> old/logs/2026-02-24_root_cleanup/
  - user_dump.json, .git_acl_backup.txt -> old/runtime/2026-02-24_root_cleanup/
  - get_hash.sql -> old/sql/2026-02-24_root_cleanup/
- 루트 유지:
  - status.json (현재 scripts/seed_test_data.js, scripts/seed_album.js, scripts/debug_public_access.js가 참조)
  - 필수 설정/빌드 파일(package.json, vite.config.ts, tsconfig*, index.html, .env*)
- 메모:
  - old/는 보관 경로이므로 Git에서는 이동이 삭제로 보일 수 있다.
