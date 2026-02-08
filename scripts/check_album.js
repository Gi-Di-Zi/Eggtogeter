const { Client } = require('pg')

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ALBUM_ID = 'ead7a510-f7d8-4ca5-acc5-9d18c414fb99'

const client = new Client({
    connectionString: DB_URL,
})

async function run() {
    try {
        await client.connect()

        // 1. Check Album
        const res = await client.query(`SELECT id, title, is_public, user_id FROM albums WHERE id = $1`, [ALBUM_ID])
        if (res.rows.length === 0) {
            console.log('❌ Album NOT FOUND in DB.')
        } else {
            console.log('✅ Album Found:', res.rows[0])
        }

        // 2. Check RLS Policies on albums
        const policies = await client.query(`
        SELECT policyname, qual, cmd FROM pg_policies WHERE tablename = 'albums'
    `)
        console.log('ℹ️ RLS Policies for albums:', policies.rows)

    } catch (e) {
        console.error('❌ Error:', e)
    } finally {
        await client.end()
    }
}

run()
