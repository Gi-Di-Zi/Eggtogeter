const { Client } = require('pg')

const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new Client({
    connectionString: DB_URL,
})

async function run() {
    try {
        await client.connect()
        console.log('✅ Connected to DB')

        // Grant Permissions
        const grantSql = `
      GRANT EXECUTE ON FUNCTION get_public_album_photos(UUID) TO anon;
      GRANT EXECUTE ON FUNCTION get_public_album_photos(UUID) TO authenticated;
      GRANT EXECUTE ON FUNCTION get_public_album_photos(UUID) TO service_role;
    `
        console.log('Running GRANT SQL...')
        await client.query(grantSql)
        console.log('✅ Permissions granted.')

        // Reload Schema Cache
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
