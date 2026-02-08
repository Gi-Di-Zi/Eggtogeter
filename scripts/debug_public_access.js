
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import toml from '@iarna/toml'

// Load Supabase Config
const configPath = './supabase/config.toml'
const configContent = fs.readFileSync(configPath, 'utf8')
const config = toml.parse(configContent)

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnZ3RvZ2V0aGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTIzNDU2NzgsImV4cCI6MjAyODg4MTY3OH0.N_needed_for_local_dev'

// Use a specific public album ID provided by user
const ALBUM_ID = 'ead7a510-f7d8-4ca5-acc5-9d18c414fb99'

async function debug() {
    console.log('[Debug] Testing Public Access with ID:', ALBUM_ID)

    // 1. Create client WITHOUT Auth (Guest)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // 2. Try Fetch Album (Should work if is_public=true)
    console.log('[1/2] Fetching Album...')
    const { data: album, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', ALBUM_ID)
        .eq('is_public', true)
        .single()

    if (albumError) {
        console.error('❌ Album Fetch Failed:', albumError)
        return
    }
    console.log('✅ Album Fetched:', album.title)

    if (!album.content_data?.photo_ids?.length) {
        console.warn('⚠️ No photos IDs in album.')
        return
    }

    // 3. Try Fetch Photos (Will likely FAIL due to RLS)
    console.log('[2/2] Fetching Photos...')
    const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('*')
        .in('id', album.content_data.photo_ids)

    if (photosError) {
        console.error('❌ Photos Fetch Error:', photosError)
    } else if (!photos || photos.length === 0) {
        console.error('❌ Photos Fetch Empty (RLS Blocked likely). Expected count:', album.content_data.photo_ids.length)
    } else {
        console.log('✅ Photos Fetched:', photos.length)
    }
}

debug().catch(console.error)
