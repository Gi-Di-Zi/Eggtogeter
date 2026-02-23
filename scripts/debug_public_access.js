import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

function readJsonWithEncodingFallback(filePath) {
    const buf = fs.readFileSync(filePath)
    if (buf.length >= 2) {
        const b0 = buf[0]
        const b1 = buf[1]
        if (b0 === 0xff && b1 === 0xfe) {
            return JSON.parse(buf.toString('utf16le').replace(/^\uFEFF/, ''))
        }
        if (b0 === 0xfe && b1 === 0xff) {
            const swapped = Buffer.allocUnsafe(buf.length - 2)
            for (let i = 2, j = 0; i + 1 < buf.length; i += 2, j += 2) {
                swapped[j] = buf[i + 1]
                swapped[j + 1] = buf[i]
            }
            return JSON.parse(swapped.toString('utf16le').replace(/^\uFEFF/, ''))
        }
    }
    return JSON.parse(buf.toString('utf8').replace(/^\uFEFF/, ''))
}

const status = readJsonWithEncodingFallback('status.json')
const SUPABASE_URL = status.API_URL
const SUPABASE_ANON_KEY = status.ANON_KEY
async function resolvePublicAlbumId(supabase) {
    if (process.env.PUBLIC_ALBUM_ID) return process.env.PUBLIC_ALBUM_ID

    const { data, error } = await supabase
        .from('albums')
        .select('id')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

    if (error) {
        console.error('[Fail] Resolve public album id failed:', error)
        return null
    }
    return data?.id || null
}

async function debug() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const albumId = await resolvePublicAlbumId(supabase)

    if (!albumId) {
        console.error('[Fail] No public album found.')
        process.exitCode = 1
        return
    }

    console.log('[Debug] Testing Public Access with ID:', albumId)

    console.log('[1/2] Fetching Album...')
    const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', albumId)
        .eq('is_public', true)
        .single()

    if (albumError) {
        console.error('[Fail] Album Fetch Failed:', albumError)
        process.exitCode = 1
        return
    }
    console.log('[Pass] Album Fetched:', album.title)

    if (!album.content_data?.photo_ids?.length) {
        console.warn('[Warn] No photo IDs in album content_data')
        return
    }

    console.log('[2/2] Fetching Photos...')
    const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id,user_id,visibility')
        .in('id', album.content_data.photo_ids)

    if (photosError) {
        console.error('[Fail] Photos Fetch Error:', photosError)
        process.exitCode = 1
    } else if (!photos || photos.length === 0) {
        console.error('[Fail] Photos Fetch Empty. Expected:', album.content_data.photo_ids.length)
        process.exitCode = 1
    } else {
        console.log('[Pass] Photos Fetched:', photos.length)
    }
}

debug().catch((e) => {
    console.error('[Unhandled]', e)
    process.exitCode = 1
})
