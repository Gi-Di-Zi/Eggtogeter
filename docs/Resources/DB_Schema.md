# [Constraints Checklist]
- [x] 언어: 한국어 (Korean)
- [x] 인코딩: UTF-8 (No BOM)
- [x] 경로: `@/docs/Resources/DB_Schema.md`
- [x] 3단계 프로토콜 준수

# EggTogether Database Schema

## 1. Overview
EggTogether는 **Supabase (PostgreSQL)** 를 기반으로 구축되었습니다.
- **인증**: Supabase Auth (`auth.users`)
- **데이터베이스**: `public` 스키마
- **스토리지**: `photos` 버킷

---

## 2. Tables

### 2.1 `profiles`
사용자 프로필 정보를 저장합니다. `auth.users` 테이블과 1:1로 매핑됩니다.
> **Note**: Supabase Auth의 Trigger로 자동 생성/업데이트 됩니다.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, FK(`auth.users.id`) | 사용자 고유 ID |
| `email` | `text` | | 이메일 주소 |
| `nickname` | `text` | `Nullable` | 표시용 닉네임 |
| `avatar_url` | `text` | `Nullable` | 프로필 이미지 URL (DiceBear 등) |
| `created_at` | `timestamptz` | `Default: now()` | 생성 일시 |
| `updated_at` | `timestamptz` | `Default: now()` | 수정 일시 |

### 2.2 `photos`
지도에 표시될 사진 및 텍스트 기록을 저장합니다.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, `Default: gen_random_uuid()` | 사진 고유 ID |
| `user_id` | `uuid` | FK(`auth.users.id`), `Not Null` | 작성자 ID |
| `storage_path` | `text` | `Nullable` | 스토리지 경로 (텍스트 전용인 경우 NULL) |
| `description` | `text` | `Nullable` | 사진 설명 및 텍스트 기록 내용 |
| `latitude` | `float8` | `Not Null` | 위도 |
| `longitude` | `float8` | `Not Null` | 경도 |
| `taken_at` | `timestamptz` | `Validation required` | 촬영 일시 (사용자 지정 가능) |
| `address` | `text` | `Nullable` | 주소 (Kakao Map 역지오코딩 결과) |
| `visibility` | `varchar` | `Check('friends', 'specific', 'private')` | 공유 범위 (기본: 'private') |
| `created_at` | `timestamptz` | `Default: now()` | 업로드 일시 |

### 2.3 `friends`
사용자 간의 친구 관계를 관리합니다. (양방향이 아닌 단방향 요청 구조 등 로직 확인 필요, 현재는 레코드 존재 시 관계 성립)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, `Default: gen_random_uuid()` | 관계 ID |
| `requester_id` | `uuid` | FK(`auth.users.id`), `Not Null` | 요청자 |
| `recipient_id` | `uuid` | FK(`auth.users.id`), `Not Null` | 수신자 |
| `status` | `varchar` | `Check('pending', 'accepted', 'blocked')` | 관계 상태 |
| `created_at` | `timestamptz` | `Default: now()` | 요청 일시 |
| `updated_at` | `timestamptz` | `Default: now()` | 상태 변경 일시 |

> **Unique Constraint**: `(requester_id, recipient_id)`

### 2.4 `photo_shares`
`visibility`가 `'specific'`일 때, 특정 친구와의 공유 권한을 매핑합니다.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, `Default: gen_random_uuid()` | 공유 ID |
| `photo_id` | `uuid` | FK(`photos.id`), `On Delete Cascade` | 대상 사진 |
| `user_id` | `uuid` | FK(`auth.users.id`), `On Delete Cascade` | 공유받는 사용자 |
| `created_at` | `timestamptz` | `Default: now()` | 공유 일시 |

> **Unique Constraint**: `(photo_id, user_id)`

### 2.5 `albums`
'무빙 앨범'과 같은 큐레이션된 콘텐츠를 저장합니다.

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | **PK**, `Default: gen_random_uuid()` | 앨범 ID |
| `user_id` | `uuid` | FK(`auth.users.id`), `Not Null` | 생성자 |
| `title` | `text` | `Not Null` | 앨범 제목 |
| `description` | `text` | `Nullable` | 앨범 설명 |
| `style_type` | `text` | `Check('route_anim', 'scroll_view', 'ai_video')` | 표현 방식 |
| `is_public` | `boolean` | `Default: false` | 전체 공개 여부 |
| `content_data` | `jsonb` | `Not Null` | 사진 ID 배열, 트랜지션 설정 등 |
| `created_at` | `timestamptz` | `Default: now()` | 생성 일시 |
| `updated_at` | `timestamptz` | `Default: now()` | 수정 일시 |

---

## 3. RLS Policies (Summary)

### `photos`
- **SELECT**:
    1. 내 사진 (`auth.uid() = user_id`)
    2. 친구 공개 (`visibility = 'friends'` AND 친구 관계 성립)
    3. 특정 공개 (`visibility = 'specific'` AND `photo_shares`에 존재)
- **INSERT/UPDATE/DELETE**: 작성자 본인만 가능.

### `friends`
- 관련 당사자(`requester` 혹은 `recipient`)만 조회 및 상태 업데이트 가능.

### `albums`
- **SELECT**: 작성자 본인 OR `is_public = true`.
- **MANAGE**: 작성자 본인만 가능.
