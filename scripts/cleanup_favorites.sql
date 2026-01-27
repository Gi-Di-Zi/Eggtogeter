-- [수정된 스크립트]
-- PL/pgSQL 블록 대신 표준 SQL 문으로 분리하여 순차적으로 실행합니다.

-- 1. 가장 적합한 '즐겨찾기' 항목 하나를 선택해서 Gold로 설정 (나머지는 무시)
UPDATE categories
SET name = '즐겨찾기', color = '#FFD700', is_favorite = true
WHERE id = (
    SELECT id
    FROM categories
    WHERE is_favorite = true OR name IN ('Favorites', '즐겨찾기')
    ORDER BY is_favorite DESC, id ASC
    LIMIT 1
);

-- 2. 중복 카테고리의 사진들을 메인 카테고리로 이동 (충돌 방지)
-- (이미 메인 카테고리를 가지고 있는 사진은 제외하고 이동)
UPDATE photo_categories
SET category_id = (
    SELECT id FROM categories 
    WHERE is_favorite = true AND color = '#FFD700' 
    LIMIT 1
)
WHERE category_id IN (
    SELECT id FROM categories 
    WHERE (is_favorite = true OR name IN ('Favorites', '즐겨찾기'))
    AND id != (SELECT id FROM categories WHERE is_favorite = true AND color = '#FFD700' LIMIT 1)
)
AND photo_id NOT IN (
    SELECT photo_id FROM photo_categories 
    WHERE category_id = (SELECT id FROM categories WHERE is_favorite = true AND color = '#FFD700' LIMIT 1)
);

-- 3. 이동되지 못한(이미 메인에도 존재했던) 중복 연결 삭제
DELETE FROM photo_categories
WHERE category_id IN (
    SELECT id FROM categories 
    WHERE (is_favorite = true OR name IN ('Favorites', '즐겨찾기'))
    AND id != (SELECT id FROM categories WHERE is_favorite = true AND color = '#FFD700' LIMIT 1)
);

-- 4. 이제 비어있는 중복 카테고리 본체 삭제
DELETE FROM categories
WHERE (is_favorite = true OR name IN ('Favorites', '즐겨찾기'))
AND id != (SELECT id FROM categories WHERE is_favorite = true AND color = '#FFD700' LIMIT 1);
