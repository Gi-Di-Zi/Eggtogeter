-- Public album photo resolver for guest playback.
-- Returns photos in the exact order of album.content_data.photo_ids.

CREATE OR REPLACE FUNCTION public.get_public_album_photos(p_album_id uuid)
RETURNS SETOF public.photos
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    WITH target_album AS (
        SELECT a.content_data
        FROM public.albums AS a
        WHERE a.id = p_album_id
          AND a.is_public = true
    ),
    ordered_photo_ids AS (
        SELECT ordinality::int AS ord, (value)::uuid AS photo_id
        FROM target_album,
             jsonb_array_elements_text(COALESCE(target_album.content_data->'photo_ids', '[]'::jsonb))
             WITH ORDINALITY AS t(value, ordinality)
    )
    SELECT p.*
    FROM ordered_photo_ids AS o
    JOIN public.photos AS p ON p.id = o.photo_id
    ORDER BY o.ord;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_album_photos(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_album_photos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_album_photos(uuid) TO service_role;
