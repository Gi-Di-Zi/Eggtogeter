# EggTogether (에그투게더) 🥚

> **지도 기반의 위치 중심 사진 공유 및 타임라인 기록 서비스**
> 
> EggTogether는 사용자의 소중한 추억을 지도 위의 발자취로 시각화하고, '무빙 앨범'을 통해 서사적인 기록을 공유하는 경험을 제공합니다.

---

## 🚀 주요 기능 (Key Features)

### 🗺️ Persistent Map (끊김 없는 지도 경험)
- 앱의 배경으로 항상 지도가 유지되어 위치 중심의 사용자 경험을 제공합니다.
- V-World 및 CartoDB 레이어를 활용한 선명하고 입체적인 지도 뷰를 지원합니다.

### 📸 스마트 사진 관리
- **EXIF 데이터 연동**: 사진 업로드 시 촬영 장소와 시간을 자동으로 인식하여 지도 위에 배치합니다.
- **다양한 기록 형태**: 사진뿐만 아니라 텍스트 전용 기록(말풍선 마커)도 지도 위에 남길 수 있습니다.
- **공유 범위 설정**: 비공개, 친구 전체, 특정 친구 등 세밀한 프라이버시 제어가 가능합니다.

### 🎬 무빙 앨범 (Moving Album)
- **3D 경로 애니메이션**: Three.js와 MapLibre를 결합하여 지도 위를 이동하는 3D 오브젝트(차량, 도보, 비행기 등) 애니메이션을 구현했습니다.
- **스네이킹 타임라인**: 지그재그 레이아웃을 통해 많은 양의 사진 정보를 한눈에 볼 수 있는 독창적인 타임라인 UI를 제공합니다.
- **애니메이션 제어**: 실시간 속도 조절(0.5x~5x) 및 특정 구간 이동(Seek) 기능을 지원합니다.

### 🤝 소셜 기능 (Social Connectivity)
- **친구 시스템**: 사용자 검색 및 친구 요청/수락을 통해 친구 네트워크를 형성합니다.
- **친구 지도**: 친구와 공유한 사진들을 하나의 지도 위에서 함께 볼 수 있습니다.
- **자동 프로필**: DiceBear 라이브러리를 통해 개성 있는 아바타를 자동으로 생성합니다.

---

## 🛠️ 기술 스택 (Tech Stack)

- **Frontend**: Vite + Vue.js 3 (Composition API) + TypeScript
- **State Management**: Pinia
- **Styling**: Element Plus, Vanilla CSS
- **Map & 3D**: MapLibre GL JS + Three.js + Turf.js
- **Backend (BaaS)**: Supabase (Auth, Database, Storage)
- **Database**: PostgreSQL

---

## 📂 프로젝트 구조 (Project Structure)

```text
src/
├── components/          # 공통 및 기능별 컴포넌트
│   └── album/           # 무빙 앨범 관련 전문 컴포넌트 (Map, Timeline, Controls 등)
├── composables/         # 비즈니스 로직 (애니메이션 엔진 등)
├── stores/              # Pinia 상태 관리 (Auth, Photo, Friend 등)
├── views/               # 페이지 단위 컴포넌트
├── utils/               # 유틸리티 함수 (경로 계산 등)
└── lib/                 # 외부 라이브러리 설정 (Supabase 등)
```

---

## ⚙️ 시작하기 (Getting Started)

### 환경 변수 설정
`.env` 파일을 루트 디렉토리에 생성하고 Supabase 정보를 입력하세요.

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 설치 및 실행
```bash
# 의존성 설치
npm install

# 로컬 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

---

## 📄 문서 가이드 (Documentation)

- **PRD (요구사항 정의서)**: `docs/Resources/PRD.md`
- **DB 스키마**: `docs/Resources/DB_Schema.md`
- **프로젝트 개요**: `docs/Project_System_Overview.md`

---

© 2026 EggTogether Team. All Rights Reserved.
