import { Client } from 'pg'

const DB_URL = process.env.CHECK_ALBUM_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const ALBUM_ID = process.env.CHECK_ALBUM_ID || 'ead7a510-f7d8-4ca5-acc5-9d18c414fb99'

const client = new Client({ connectionString: DB_URL })

async function run() {
    try {
        await client.connect()

        const res = await client.query(
            'SELECT id, title, is_public, user_id, created_at FROM albums WHERE id = $1',
            [ALBUM_ID]
        )

        if (res.rows.length === 0) {
            console.log('[Album] NOT_FOUND', ALBUM_ID)
        } else {
            console.log('[Album] FOUND', res.rows[0])
        }

        const policies = await client.query(
            "SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='albums' ORDER BY policyname"
        )
        console.log(`[Policy] albums policies: ${policies.rows.length}`)
        policies.rows.forEach((p) => {
            console.log(` - ${p.policyname} (${p.cmd})`)
        })
    } catch (e) {
        console.error('[Error]', e)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

run()
