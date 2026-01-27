# 프로젝트 시스템 개요

## 프로젝트 정의
**EggTogether**는 지도 기반의 사진 공유 및 타임라인 기록 서비스입니다. 사용자는 사진을 업로드하여 지도 위에 추억을 남기고, 타임라인을 통해 과거를 회상할 수 있습니다.

## 핵심 로직 및 아키텍처
- **Frontend**: Vue.js 3 (Composition API) 기반의 SPA.
- **Map Integration**: MapLibre GL JS를 사용하여 지도를 렌더링하고, 커스텀 마커와 팝업을 통해 사진 정보를 시각화합니다.
- **State Management**: Pinia를 사용하여 인증(Auth) 및 사용자 프로필 상태를 관리합니다.
- **Data & Storage**: Supabase를 Backend로 사용하여 인증, DB(PostgreSQL), 파일 스토리지(Photos)를 처리합니다.

## 기술 스택
- **OS**: Windows 11
- **Backend (BaaS)**: Supabase (Auth, DB, Storage)
- **Frontend**: 
    - Vite + Vue.js + TypeScript
    - MapLibre GL JS + Deck.gl
    - Element-plus (UI)
    - Pinia (State)
- **Database**: PostgreSQL (via Supabase)

## 주요 기능
- **지도 보기**: 내 위치 및 사진이 업로드된 위치 확인.
- **사진 업로드**: EXIF 데이터를 활용한 자동 위치/날짜 설정 및 수동 보정.
- **타임라인**: 시간 순 사진 보기.
- **인증**: 회원가입, 로그인, 로그아웃.
