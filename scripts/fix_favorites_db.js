
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Load Env manually (since we are not in Vite)
const envPath = path.resolve(__dirname, '../.env')
if (!fs.existsSync(envPath)) {
    console.error('Error: .env file not found at', envPath)
    process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf-8')
const envConfig = {}
const lines = envContent.replace(/\r\n/g, '\n').split('\n')
for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim()
        let val = trimmed.substring(idx + 1).trim()
        // remove quotes if present
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1)
        }
        envConfig[key] = val
    }
}
console.log('Loaded keys:', Object.keys(envConfig)) // Debug log

const supabaseUrl = envConfig['VITE_SUPABASE_URL']
const supabaseKey = envConfig['VITE_SUPABASE_ANON_KEY'] // Using Anon key might be limited strictly by RLS. 
// If RLS prevents update/delete, we might need SERVICE_ROLE_KEY if available, but usually distinct user won't have it.
// Assuming the user (logged in or anon) has rights, or I'm running this with implicit permissions?
// Wait, 'supabase-js' client is client-side. The user has "user_id". 
// But this script runs as "admin" conceptually.
// If I use ANON_KEY, I am subject to RLS.
// RLS for 'categories': 'public' can usually read.
// Writers usually need to be authenticated.
// This script is running OUTSIDE the auth context of a logged-in user.
// !! CRITICAL: This script won't work with ANON KEY if tables are protected by RLS and require 'auth.uid()'.
// Does the user have a SERVICE_ROLE_KEY in .env?
// Let's check imports.
// If not, I can't really fix DB issues from a script unless I have admin credentials.
// Or I can temporarily disable RLS, or use a method to sign in?
// Actually, I can allow the user to run this from the browser console? No, that's messy.
// Let's check if there is a VITE_SUPABASE_SERVICE_ROLE_KEY in `.env`.
// The user's `.env` listing showed 344 bytes. It likely has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
// If I don't have service role key, I can't overwrite data usually.
// EXCEPT: If the RLS allows anon updates (unlikely) or if I simulate a login.
// But I don't have the user's password.
// ALTERNATIVE: Use the SQL tool provided by Supabase MCP server?
// Oh wait, I tried Supabase MCP and it failed with "Unauthorized".
//
// Let's assume for a moment the user is developing locally or owns the project and might have put the Service Key or I can try with Anon Key and see if it fails (maybe RLS is open for dev).
//
// Better approach: Create the script, but if it fails on Auth, I will ask user to provide Service Key or run SQL in dashboard.
//
// Actually, I see `supabase_schema_photos.sql` in the file list. Maybe I can read that to see RLS policies?
//
// Let's try to write the script. If it fails, I'll report.

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Supabase credentials missing in .env')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
    console.log('Starting DB Cleanup...')

    // Debug: List all categories to check visibility
    const { data: allCats, error: allError } = await supabase.from('categories').select('*').limit(10)
    console.log('Debug: Visible Categories:', allCats)
    if (allError) console.error('Debug: Error:', allError)

    // 1. Fetch all potential favorite categories
    // We look for is_favorite = true OR name contains 'Favorite'/'즐겨찾기'
    const { data: categories, error } = await supabase
        .from('categories')
        .select('*')
        .or('is_favorite.eq.true,name.eq.Favorites,name.eq.즐겨찾기')

    if (error) {
        console.error('Error fetching categories:', error)
        return
    }

    console.log(`Found ${categories.length} candidate categories.`)

    if (categories.length === 0) {
        console.log('No favorites found. creating one...')
        // Create one logic?
        return
    }

    // 2. Identify Master (The one with is_favorite=true, or just the first one)
    // Preference: is_favorite=true > Created first
    categories.sort((a, b) => {
        if (a.is_favorite && !b.is_favorite) return -1
        if (!a.is_favorite && b.is_favorite) return 1
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

    const master = categories[0]
    const duplicates = categories.slice(1)

    console.log(`Master Category: ${master.id} (${master.name})`)
    if (duplicates.length > 0) {
        console.log(`Duplicates to merge/delete: ${duplicates.map(d => d.id).join(', ')}`)
    }

    // 3. Update Master to be Golden
    const { error: updateError } = await supabase
        .from('categories')
        .update({
            name: '즐겨찾기',
            color: '#FFD700',
            is_favorite: true
        })
        .eq('id', master.id)

    if (updateError) {
        console.error('Error updating master:', updateError)
        // If this fails due to RLS, everything stops here.
        return
    }
    console.log('Master category updated.')

    // 4. Process Duplicates
    for (const dup of duplicates) {
        console.log(`Processing duplicate: ${dup.id}`)

        // 4a. Move photos
        const { data: relations } = await supabase
            .from('photo_categories')
            .select('*')
            .eq('category_id', dup.id)

        if (relations && relations.length > 0) {
            console.log(`  Moving ${relations.length} photo relations...`)
            for (const rel of relations) {
                // Insert new relation to master (ignore if exists)
                const { error: insertError } = await supabase
                    .from('photo_categories')
                    .insert({ photo_id: rel.photo_id, category_id: master.id })
                    .select() // to check result

                if (insertError) {
                    // Start duplicate key error is expected (23505), ignore it
                    if (!insertError.message.includes('duplicate key')) {
                        console.error('  Error moving relation:', insertError)
                    }
                }
            }
        }

        // 4b. Delete duplicate relations
        const { error: delRelError } = await supabase
            .from('photo_categories')
            .delete()
            .eq('category_id', dup.id)

        if (delRelError) console.error('  Error deleting relations:', delRelError)

        // 4c. Delete duplicate category
        const { error: delCatError } = await supabase
            .from('categories')
            .delete()
            .eq('id', dup.id)

        if (delCatError) console.error('  Error deleting category:', delCatError)
        else console.log(`  Duplicate deleted: ${dup.id}`)
    }

    console.log('Cleanup Complete.')
}

main()
