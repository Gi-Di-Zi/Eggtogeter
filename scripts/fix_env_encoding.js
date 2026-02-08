import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = {
    '.env': 'VITE_MAPTILER_KEY=4cgNqfH7O1QXBZB5Og2Z\nVITE_GOOGLE_MAPS_API_KEY=AIzaSyCDcdXmOo4yWK_jHxI2T9Aj4KehBSlPUTc\n',
    '.env.development': 'VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0\n'
};

for (const [file, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(__dirname, '../', file), content, { encoding: 'utf8' });
    console.log(`Recreated ${file}`);
}
