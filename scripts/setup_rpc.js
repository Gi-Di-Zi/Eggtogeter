const { Client } = require('pg')
const fs = require('fs')

// Default local Supabase DB URL
// If this fails, we might need to check 'npx supabase status' again carefully, but this is standard.
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new Client({
    connectionString: DB_URL,
})

async function run() {
    try {
        console.log('Connecting to DB...')
        await client.connect()
        console.log('✅ Connected to DB')

        console.log('Reading SQL file...')
        const sqlPath = './docs/Resources/sql/get_public_album_photos.sql'
        const sql = fs.readFileSync(sqlPath, 'utf8')

        console.log('Executing SQL...')
        await client.query(sql)
        console.log('✅ RPC Function get_public_album_photos created/updated successfully.')

    } catch (e) {
        console.error('❌ Error:', e)
    } finally {
        await client.end()
    }
}

run()
