
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const statusPath = path.resolve('status.json');
if (!fs.existsSync(statusPath)) {
    console.error('status.json not found');
    process.exit(1);
}
const status = JSON.parse(fs.readFileSync(statusPath, 'utf8').replace(/^\uFEFF/, ''));
const supabase = createClient(status.API_URL, status.SERVICE_ROLE_KEY);

async function seedAlbum() {
    console.log('Seeding album...');
    const userId = 'e6af15dd-39ec-4321-b6a3-b61d0ac345ea';

    // Get 2 photos
    const { data: photos } = await supabase.from('photos').select('*').eq('user_id', userId).limit(2);
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

    if (error) console.error('Error:', error);
    else console.log('Album created!');
}

seedAlbum();
