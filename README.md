# EggTogether

지도 기반 사진 공유와 이동 경로 기반 앨범 재생(무빙 앨범)을 제공하는 웹 프로젝트입니다.

## 주요 기능
- 사진 업로드 및 메타데이터(EXIF) 기반 위치/시간 표시
- 지도(MapLibre) 기반 사진 시각화
- 친구/공유 범위 기반 사진 접근 제어
- 무빙 앨범 재생(경로, 전환 모드, 타임라인)
- Supabase 기반 인증/DB/스토리지 연동

## 기술 스택
- Frontend: Vue 3 + TypeScript + Vite
- State: Pinia
- UI: Element Plus
- Map/Geo: MapLibre GL, Turf.js, Three.js
- Backend: Supabase

## 요구 사항
- Node.js 20+
- npm
- Docker Desktop (로컬 Supabase 사용 시)
- Supabase CLI

## 빠른 시작
1. 의존성 설치
```bash
npm install
```

2. 환경 변수 준비 (`.env`)
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

3. 개발 서버 실행
```bash
npm run dev
```

4. 빌드
```bash
npm run build
```

## 로컬 Supabase
로컬 개발/테스트 시 Docker Desktop이 필요합니다.

```bash
npx supabase start
npx supabase status -o json
```

중지:
```bash
npx supabase stop
```

## npm 스크립트
- `npm run dev`: 개발 서버
- `npm run build`: 타입체크 + 프로덕션 빌드
- `npm run preview`: 빌드 결과 미리보기
- `npm run notion:sync`: Notion 설정 동기화
- `npm run notion:watch`: Notion 변경 감시 동기화
- `npm run notion:bootstrap`: Notion bootstrap pull
- `npm run notion:bootstrap:apply`: bootstrap apply

## 스크립트 기반 점검(수동 회귀)
프로젝트에는 단일 테스트 러너(`npm test`)가 없고, `scripts/`의 점검 스크립트를 조합해 회귀를 확인합니다.

주요 점검 예시:
```bash
# 타입 안정성
npx vue-tsc -b --pretty false

# 인증 플로우 점검
node scripts/test_local_auth.js

# 테스트 데이터 시드
node scripts/seed_test_data.js

# 앨범/전환 로직 점검
node scripts/seed_album.js
node scripts/verify_transition_logic.js
```

## 문서
- 프로젝트 컨텍스트: `.agent/Project_Context.md`
- 진행 로그: `docs/Progress/`
- 실행/오류 로그: `docs/Logs/`
- 테스트 데이터 로그: `docs/TestData/`

## 트러블슈팅
- `EPERM` 권한 오류가 발생하면:
  - 터미널/에디터를 관리자 권한으로 재실행
  - 백신/보안도구의 파일 잠금 여부 확인
  - Docker Desktop/WSL/권한 정책 상태 점검
- Docker는 켜져 있는데 Supabase CLI가 실패하면:
  - Docker Desktop Linux Engine 권한 문제 여부 확인
  - 현재 사용자 계정의 Docker 접근 권한 확인
