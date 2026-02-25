import { Client } from 'pg'

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const client = new Client({ connectionString: DB_URL })

async function run() {
    try {
        await client.connect()
        console.log('Connected to DB')

        const checkRes = await client.query(`
            SELECT routine_name
            FROM information_schema.routines
            WHERE routine_schema = 'public'
              AND routine_name = 'get_public_album_photos';
        `)

        if (checkRes.rowCount > 0) {
            console.log('Function get_public_album_photos exists in DB.')
        } else {
            console.error('Function get_public_album_photos does not exist in DB.')
            process.exitCode = 1
        }

        console.log('Reloading PostgREST schema cache...')
        await client.query("NOTIFY pgrst, 'reload config'")
        console.log('Reload signal sent.')
    } catch (error) {
        console.error('Error:', error)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

void run()
