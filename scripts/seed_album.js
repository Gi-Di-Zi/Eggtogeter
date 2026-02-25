
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const statusPath = path.resolve('status.json');
if (!fs.existsSync(statusPath)) {
    console.error('status.json not found');
    process.exit(1);
}

function readJsonWithEncodingFallback(filePath) {
    const buf = fs.readFileSync(filePath);
    if (buf.length >= 2) {
        const b0 = buf[0];
        const b1 = buf[1];
        // UTF-16 LE BOM
        if (b0 === 0xff && b1 === 0xfe) {
            return buf.toString('utf16le').replace(/^\uFEFF/, '');
        }
        // UTF-16 BE BOM
        if (b0 === 0xfe && b1 === 0xff) {
            const swapped = Buffer.allocUnsafe(buf.length - 2);
            for (let i = 2, j = 0; i + 1 < buf.length; i += 2, j += 2) {
                swapped[j] = buf[i + 1];
                swapped[j + 1] = buf[i];
            }
            return swapped.toString('utf16le').replace(/^\uFEFF/, '');
        }
    }
    return buf.toString('utf8').replace(/^\uFEFF/, '');
}

const status = JSON.parse(readJsonWithEncodingFallback(statusPath));
const supabase = createClient(status.API_URL, status.SERVICE_ROLE_KEY);

async function seedAlbum() {
    console.log('Seeding album...');
    const userId = 'e6af15dd-39ec-4321-b6a3-b61d0ac345ea';

    // Get 2 photos in deterministic order to align with transition verification.
    const { data: photos } = await supabase
        .from('photos')
        .select('*')
        .eq('user_id', userId)
        .order('taken_at', { ascending: true })
        .limit(2);
    if (!photos || photos.length < 2) {
        console.error('Not enough photos');
        return;
    }

    // Cleanup existing test albums
    const { error: deleteError } = await supabase.from('albums').delete().eq('title', 'Boat Test Album');
    if (deleteError) console.log('Cleanup error (ignorable):', deleteError.message);

    const { error } = await supabase.from('albums').insert({
        user_id: userId,
        title: 'Boat Test Album',
        description: 'Test album for boat route',
        style_type: 'route_anim',
        is_public: true,
        content_data: {
            photo_ids: photos.map(p => p.id),
            transitions: [
                {
                    from: photos[0].id,
                    to: photos[1].id,
                    mode: 'boat'
                }
            ]
        }
    });

    if (error) {
        console.error('Error:', error);
        return;
    }

    // Current schema allows: friends | specific | private
    // Keep seeded photos readable in friend-scoped scenarios.
    const { error: visError } = await supabase
        .from('photos')
        .update({ visibility: 'friends' })
        .in('id', photos.map((p) => p.id));

    if (visError) {
        console.warn('Album created, but visibility update skipped:', visError.message);
        return;
    }

    console.log('Album created and photo visibility updated to friends.');
}

seedAlbum();
