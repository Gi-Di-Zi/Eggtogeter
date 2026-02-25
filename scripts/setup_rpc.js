import { Client } from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const DB_URL = process.env.DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const sqlPath = path.resolve(__dirname, '../supabase/migrations/20260224234000_add_get_public_album_photos_rpc.sql')

const client = new Client({ connectionString: DB_URL })

async function run() {
    try {
        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found: ${sqlPath}`)
        }

        console.log('Connecting to DB...')
        await client.connect()
        console.log('Connected to DB')

        console.log('Reading SQL file...')
        const sql = fs.readFileSync(sqlPath, 'utf8')

        console.log('Executing SQL...')
        await client.query(sql)
        console.log('RPC function get_public_album_photos created/updated successfully.')
    } catch (error) {
        console.error('Error:', error)
        process.exitCode = 1
    } finally {
        await client.end()
    }
}

void run()
