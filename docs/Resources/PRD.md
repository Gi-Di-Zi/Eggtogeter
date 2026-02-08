# [Constraints Checklist]
- [x] 언어: 한국어 (Korean)
- [x] 경로: `@/docs/Resources/PRD.md`
- [x] 3단계 프로토콜 준수

# EggTogether - 제품 요구사항 정의서 (PRD) v6 (2026-02-03)

## 1. 프로젝트 개요 (Overview)

### 1.1 프로젝트 명
**EggTogether** (에그투게더)

### 1.2 비전 및 목표
EggTogether는 **지도 기반의 위치 중심 사진 공유 및 타임라인 기록 서비스**입니다.
사용자의 소중한 추억을 단순한 리스트가 아닌 **지도 위의 발자취**로 시각화하며, 친구 및 지인과 함께 추억을 "알(Egg)"처럼 모으고 공유하는 경험을 제공합니다.

### 1.3 핵심 가치
- **Contextual**: 사진이 촬영된 '장소'와 '시간'을 직관적으로 연결.
- **Persistent**: 끊김 없는 지도 경험 (Persistent Map).
- **Social**: 친구와 메모리를 공유하고 함께 지도를 완성하는 경험.
- **Storytelling**: 단순 기록을 넘어선 '무빙 앨범'을 통한 서사적 공유.
- **Flexibility**: 사진이 없는 텍스트 전용 기록도 지도 위에 남길 수 있음.
- **Secure**: 엄격한 권한 관리(RLS)를 통한 사생활 보호.

---

## 2. 사용자 페르소나 (Target Personas)

### 2.1 여행 기록자 (The Traveler)
- 여행 경로와 방문한 장소의 사진을 지도 위에 예쁘게 남기고 싶어함.
- 사진의 위치 정보(GPS)가 자동으로 반영되길 원함.

### 2.2 커플/데이트 (The Memories)
- 데이트한 장소들을 지도에 기록하여 "우리가 함께한 지도"를 만들고 싶어함.
- 기념일이나 특정 장소를 검색해서 추억을 회상하고 싶어함.

### 2.3 소셜 커넥터 (The Socialite)
- 친구들과 지도와 사진을 공유하고 싶어함.
- 친구의 여행 기록을 자신의 지도 위에서 보고 싶어함.
- 여행 영상을 앨범으로 만들어 유튜브나 SNS에 공유하고 싶어함.

---

## 3. 기능 명세 (Feature Specifications)

### 3.1 핵심 기능 (Current Status)

| 구분 | 기능명 | 상세 설명 | 구현 상태 |
| :--- | :--- | :--- | :--- |
| **지도** | **Persistent Map** | Google Maps (메인) + MapTiler (테마) 기반. 3D 빌딩 및 Ghost Mode 지원. | ✅ 완료 |
| **사진** | **Upload & Metadata** | EXIF 자동 인식, 드래그 앤 드롭, Google Geocoding을 통한 주소 자동 변환. | ✅ 완료 |
| **사진** | **Infinite Scroll** | 대량 데이터의 효율적 로딩 (List/Grid/Compact 뷰). | ✅ 완료 |
| **사진** | **Text-Only Entry** | 사진 없이 텍스트(설명)만으로 기록 남기기 가능. | ✅ 완료 |
| **분류** | **Category System** | 사용자 정의 카테고리 및 색상 관리. (내 사진 전용) | ✅ 완료 |
| **인증** | **Auth Flow** | 회원가입, 로그인, 비밀번호 찾기 (Supabase). Glassmorphism UI 적용. | ✅ 완료 |
| **프로필** | **User Profile** | 별명, 아바타 설정 (DiceBear 자동 생성). | ✅ 완료 |
| **친구** | **Friend System** | 이메일/별명 검색, 친구 요청/수락, 아바타 표시. | ✅ 완료 |
| **공유** | **Photo Sharing** | 기본 비공개(Private). 친구 전체/특정 친구 공유 기능. RLS 기반 보안 강화. | ✅ 완료 |
| **공유** | **Friend Photos View** | 홈 화면에서 친구 사진 필터링(닉네임 표시) 및 조회. | ✅ 완료 |
| **앨범** | **Moving Album** | 3D 지도 기반 이동 경로 애니메이션 생성 및 재생. | ✅ 완료 |
| **i18n** | **Localization** | 한국어/영어(En) 다국어 지원 (UI 전체 적용). | ✅ 완료 |

### 3.2 무빙 앨범 상세 기능 (Moving Album Details)

#### A. 애니메이션 엔진 (Animation Engine)
- **상태 기계(FSM)**: `Ready` -> `Moving` -> `Paused` (정차) -> `DayChange` -> `Finished` 상태 전이 구현.
- **포커스 효과**: 사진 도달 시 지도 애니메이션을 3초간 정지하여 몰입감 제공.
- **속도 제어**: 0.5x ~ 5x 범위의 실시간 속도 조절 지원 (`el-slider`).
- **MapTiler Themes**: Outdoor, Winter 등 다양한 지도 테마 지원.

#### B. 시각 요소 (Visual Elements)
- **3D 이동 수단**: 도보, 자동차, 비행기, 자전거, 버스, 지하철, 배 등 수단별 3D 모델(GLTF/Fallback 아이콘).
- **스네이킹 타임라인(Zigzag)**: 지그재그 형태의 3라인 타임라인으로 대량의 사진을 한눈에 파악.
- **동적 오버레이**: 현재 위치의 날짜, 사진 설명, 폴라로이드 스타일 프레임 제공.
- **미니맵**: 전체 경로 중 현재 위치를 표시하는 2D 미니맵 오버레이.

#### C. 제작 도구 (Creation Tool)
- **드래그 앤 드롭**: 사진 선택 및 순서 조정.
- **구간 수단 설정**: 사진 사이의 이동 수단을 개별 설정 가능.
- **Google Places 연동**: 장소 검색 및 좌표/주소 자동 입력.

### 3.3 UI/UX 디자인 원칙 (Updated)

#### A. Modern Aesthetic
- **Glassmorphism**: 로그인, 회원가입 모달 등에 반투명/블러 효과 적용.
- **Unified Design**: 업로드, 수정, 위치 선택 모달의 UI/UX 일관성 확보.
- **Feedback**: 로딩 인디케이터, 성공/실패 메시지(Toast)의 적극적 활용.

#### B. 지도 마커 디자인
- **사진 마커**: 원형 썸네일 + 테두리(카테고리 컬러).
- **텍스트 마커**: 화이트 카드 + 강한 그림자(Deep Shadow). 앨범 조회 시 컴팩트 오버레이 사용.
- **이동 수단 마커**: 경로 상에서 실시간으로 이동하는 3D 오브젝트 + 지도 베어링 동기화.

---

## 4. 사용자 흐름 (User Flows)

### 4.1 사진 공유 및 관리
1.  **업로드**: 기본적으로 **비공개(Private)**로 업로드됨.
2.  **공유 설정**: 업로드 시 또는 '사진 관리'에서 **친구 전체** 혹은 **특정 친구**를 선택하여 공유.
3.  **조회**:
    - 내 지도: 내 사진 + 내가 공유받은 친구 사진 표시.
    - 필터: 상단 필터에서 특정 친구의 닉네임을 선택하여 해당 친구의 사진만 보기 가능.

### 4.2 앨범 감상
1.  **재생**: 지도 위에서 카메라가 경로를 따라 이동하며 사진을 순차적으로 비춤.
2.  **제어**: 타임라인이나 컨트롤 덱(Play/Pause, 배속)을 통해 자유롭게 시점 이동.
3.  **몰입**: 3D 건물(Ghost Mode)과 계절별/테마별 지도를 배경으로 감상.

---

## 5. 기술 아키텍처 및 스키마 (Technical Architecture)

### 5.1 데이터 구조 (Schema Update)

#### `photos`
*   `storage_path`: `text` (**Nullable**) - 사진이 없는 텍스트 기록 허용.
*   `visibility`: `varchar` (default: **'private'**) - 보안 강화.
*   `address`: `text` - Google Geocoding API 결과 저장.

#### `photo_shares`
*   `photo_id`, `user_id`: 특정 친구 공유 시 1:N 관계 매핑.

#### `friends`
*   단방향 요청 기반, 수락 시 양방향 조회 가능 (`status = 'accepted'`).

### 5.2 향후 로드맵 (Upcoming Features)

#### A. 계정 및 보안 (Account & Security)
1.  **회원 정보 수정 (Profile Update)**
    *   **비밀번호 재확인**: 정보 수정 접근 시 현재 비밀번호 확인 절차 필수.
    *   **수정 항목**: 닉네임, 아바타 등.
2.  **회원 탈퇴 (Account Deletion)**
    *   **Hard Delete**: 데이터(사진, 친구 관계 등) 영구 삭제.
    *   **Safety**: 강력한 경고 모달 제공. 본인 이메일을 직접 입력해야 '탈퇴' 버튼 활성화.

#### B. 온보딩 및 랜딩 (Onboarding & Landing)
1.  **랜딩 페이지 (Landing Page)**
    *   초기 접속 시 로그인 화면이 아닌 '서비스 소개 페이지' 노출.
    *   "시작하기" 버튼 클릭 시 로그인/회원가입 화면으로 전환.
    *   주요 기능(내 지도, 친구 공유, 무빙 앨범)을 매력적인 그래픽/애니메이션으로 소개.
2.  **튜토리얼 / 투어 (User Tour)**
    *   신규 가입 유저가 최초 로그인 시 `Tour` 모드 자동 실행.
    *   메뉴(드로어), 지도 조작, 업로드 방법 등을 단계별 툴팁으로 안내.

#### C. 인스턴트 무빙 앨범 (Instant Moving Album)
1.  **비로그인/게스트 모드**: 로그인 없이도 랜딩 페이지에서 즉시 사용 가능.
2.  **프로세스**: 사진 다중 선택 -> 메타데이터 확인/수정 -> 무빙 앨범 재생.
3.  **특징**:
    *   User ID에 귀속되지 않는 휘발성 세션 혹은 로컬 스토리지 기반.
    *   "내 앨범" 저장 불가 (저장하려면 로그인 유도).

#### D. 수익화 및 크레딧 (Monetization & Credits)
1.  **크레딧 페이지 (Credits)**
    *   제작자 소개 및 AI 활용 고지(Disclaimer).
2.  **광고 (Ads)**
    *   **Google AdSense**: 메인 지도 하단(1개), 내 계정 화면(1개) 배치.
    *   **Ad-Block 감지**: 확장 프로그램 감지 시 "광고 차단 해제 권고" 모달 표시.
3.  **후원 (Donation)**
    *   Buy Me a Coffee 연동 (내 계정 화면).

#### E. UI/UX 고도화 (Refinement)
1.  **모바일 최적화**: 작은 화면(Phone)에서의 패딩, 폰트 크기, 레이아웃 세부 조정.
2.  **레이아웃 개선**:
    *   **Home Drawer**: 사진 업로드 버튼 상단으로 부착(Anchor).
    *   **Photo Drawer**: 사진 표시/숨김 토글에 텍스트 라벨 추가 (직관성 강화).
    *   **Album Drawer**: 폰트 스타일을 Photo Drawer와 통일.
    *   **Scroll Narrative**: 스크롤 기반 스토리텔링 뷰의 세부 디자인 및 설정 기능 구현.

#### F. 테스트 인프라 (Testing Infrastructure)
1.  **메일 테스트 (Mailtrap)**
    *   **목적**: 회원가입, 비밀번호 재설정 등 이메일 발송 기능의 안전한 테스트 환경 구축.
    *   **도구**: Mailtrap.io (가상 SMTP 서버).
    *   **적용**: 로컬 개발 환경(`env.local`)에서만 Mailtrap SMTP 사용 설정.
2.  **성능 테스트 (Stress Testing)**
    *   **대상**: 무빙 앨범 경로 애니메이션 (`AlbumRouteView`).
    *   **시나리오**: 사진 개수별(10장, 50장, 100장, 500장 등) 렌더링 성능 및 애니메이션 안정성 검증.
    *   **최적화**: 대량 마커 렌더링 시 프레임 드랍 방지 및 메모리 누수 확인.

### 5.3 Frontend Stack (Updated)
*   **Map Provider**:
    *   **Main**: Google Maps JavaScript API (Geocoding, Places 포함).
    *   **Themes**: MapTiler (Vector Tiles) for Album viewing.
*   **3D**: Three.js + MapLibre GL JS의 커스텀 레이어 연동.
*   **Localization**: `vue-i18n` (ko, en).

---

## 6. 제약 사항 및 개발 규칙 (Constraints & Rules)
- **배포 환경**: Netlify (SPA Routing 설정 필요 `_redirects`).
- **RLS (Security)**: `photos` 테이블은 **반드시** `visibility` 조건을 포함한 정책에 의해서만 조회 가능해야 함.
- **Windows 인코딩**: `UTF-8` (No BOM) 필수.
