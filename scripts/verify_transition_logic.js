import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyLogic() {
    const ALBUM_ID = '532cf6d7-2ca0-4d63-8659-2ec022f693e8';

    // 1. Fetch Album Data
    const { data: album } = await supabase
        .from('albums')
        .select('*')
        .eq('id', ALBUM_ID)
        .single();

    if (!album) {
        console.error('Album not found');
        return;
    }

    const transitions = album.content_data.transitions || [];
    const photoIds = album.content_data.photo_ids || [];

    console.log(`[Verify] Album has ${photoIds.length} photo_ids and ${transitions.length} transitions.`);

    // 2. Fetch Photos
    const { data: rawPhotos } = await supabase
        .from('photos')
        .select('id, taken_at')
        .in('id', photoIds);

    if (!rawPhotos) {
        console.error('Photos not found');
        return;
    }

    console.log(`[Verify] Fetched ${rawPhotos.length} photos.`);

    // 3. Simulate Frontend Sort
    const sortedPhotos = [...rawPhotos].sort((a, b) => new Date(a.taken_at).getTime() - new Date(b.taken_at).getTime());

    console.log('[Verify] Sorted Photos Order:');
    sortedPhotos.forEach((p, i) => console.log(`${i}: ${p.id} (${p.taken_at})`));

    // 4. Simulate Transition Lookup
    console.log('\n[Verify] Checking Transitions...');
    let matchCount = 0;
    let failCount = 0;

    for (let i = 0; i < sortedPhotos.length - 1; i++) {
        const from = sortedPhotos[i];
        const to = sortedPhotos[i + 1];

        const trans = transitions.find(t => t.from === from.id && t.to === to.id);
        const mode = trans?.mode || 'car';

        if (trans) {
            console.log(`[MATCH] ${from.id} -> ${to.id} : ${mode}`);
            matchCount++;
        } else {
            console.warn(`[FAIL]  ${from.id} -> ${to.id} : Missing! Default to 'car'`);
            failCount++;
        }
    }

    console.log(`\n[Result] Matches: ${matchCount}, Failures: ${failCount}`);
}

verifyLogic();
