const { Client } = require('pg')

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new Client({
    connectionString: DB_URL,
})

async function run() {
    try {
        await client.connect()
        console.log('✅ Connected to DB')

        // 1. Check if function exists
        const checkRes = await client.query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_schema = 'public' 
      AND routine_name = 'get_public_album_photos';
    `)

        if (checkRes.rowCount > 0) {
            console.log('✅ Function get_public_album_photos EXISTS in DB.')
        } else {
            console.error('❌ Function get_public_album_photos DOES NOT EXIST in DB.')
        }

        // 2. Reload Schema Cache
        console.log('🔄 Reloading PostgREST schema cache...')
        await client.query("NOTIFY pgrst, 'reload config'")
        console.log('✅ Reload signal sent.')

    } catch (e) {
        console.error('❌ Error:', e)
    } finally {
        await client.end()
    }
}

run()
