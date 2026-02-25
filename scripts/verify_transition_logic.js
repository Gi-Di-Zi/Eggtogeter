import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
})

async function resolveAlbumId() {
    if (process.env.ALBUM_ID) return process.env.ALBUM_ID

    // Prefer latest Boat Test Album created by seed script.
    const { data: seeded } = await supabase
        .from('albums')
        .select('id')
        .eq('title', 'Boat Test Album')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (seeded?.id) return seeded.id

    // Fallback: any latest album.
    const { data: anyAlbum } = await supabase
        .from('albums')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    return anyAlbum?.id ?? null
}

async function verifyLogic() {
    const albumId = await resolveAlbumId()
    if (!albumId) {
        console.error('[Fail] Album not found')
        process.exitCode = 1
        return
    }

    const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .single()

    if (albumError || !album) {
        console.error('[Fail] Fetch album failed:', albumError?.message || 'unknown')
        process.exitCode = 1
        return
    }

    const transitions = album.content_data?.transitions || []
    const photoIds = album.content_data?.photo_ids || []

    console.log(`[Verify] Album: ${album.id}`)
    console.log(`[Verify] Album has ${photoIds.length} photo_ids and ${transitions.length} transitions.`)

    if (photoIds.length < 2) {
        console.warn('[Warn] Not enough photo IDs to verify transitions.')
        return
    }

    const { data: rawPhotos, error: photoError } = await supabase
        .from('photos')
        .select('id, taken_at')
        .in('id', photoIds)

    if (photoError || !rawPhotos) {
        console.error('[Fail] Photos query failed:', photoError?.message || 'unknown')
        process.exitCode = 1
        return
    }

    if (rawPhotos.length === 0) {
        console.error('[Fail] Fetched 0 photos for album photo_ids')
        process.exitCode = 1
        return
    }

    const sortedPhotos = [...rawPhotos].sort(
        (a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime()
    )

    let matchCount = 0
    let failCount = 0

    for (let i = 0; i < sortedPhotos.length - 1; i++) {
        const from = sortedPhotos[i]
        const to = sortedPhotos[i + 1]
        const trans = transitions.find((t) => t.from === from.id && t.to === to.id)

        if (trans) {
            matchCount++
            console.log(`[MATCH] ${from.id} -> ${to.id} : ${trans.mode || 'car'}`)
        } else {
            failCount++
            console.warn(`[MISS]  ${from.id} -> ${to.id}`)
        }
    }

    console.log(`[Result] Matches: ${matchCount}, Failures: ${failCount}`)

    if (failCount > 0) {
        process.exitCode = 1
    }
}

verifyLogic().catch((e) => {
    console.error('[Unhandled]', e)
    process.exitCode = 1
})
