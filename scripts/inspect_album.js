import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function inspect() {
    const ALBUM_ID = '532cf6d7-2ca0-4d63-8659-2ec022f693e8';

    console.log(`[Inspect] Fetching Album ${ALBUM_ID}...`);

    const { data: album, error } = await supabaseAdmin
        .from('albums')
        .select('*')
        .eq('id', ALBUM_ID)
        .single();

    if (error) {
        console.error('[Error] Fetch album failed:', error);
        return;
    }

    console.log('--- Album Data ---');
    console.log('Title:', album.title);
    console.log('Style Type:', album.style_type);
    console.log('Is Public:', album.is_public);
    console.log('User ID:', album.user_id);
    console.log('Content Data Type:', typeof album.content_data);
    console.log('Content Data:', JSON.stringify(album.content_data, null, 2));

    if (album.content_data && album.content_data.photo_ids) {
        console.log(`[Inspect] Album has ${album.content_data.photo_ids.length} photo_ids.`);

        // Check if these photos exist
        const { data: photos, error: pError } = await supabaseAdmin
            .from('photos')
            .select('id, storage_path, visibility')
            .in('id', album.content_data.photo_ids);

        if (pError) console.error('[Error] Fetch photos failed:', pError);
        // Logic modified to FORCE repair to fix transition ordering
        // if (photos.length === 0) {
        if (true) {
            console.log('[Force Repair] Re-linking photos and transitions...');
            const { data: allPhotos, error: photoError } = await supabaseAdmin
                .from('photos')
                .select('id, taken_at')
                .eq('user_id', album.user_id)
                .limit(20);

            if (photoError || !allPhotos || allPhotos.length === 0) {
                console.error('[Error] No photos found for user:', photoError);
                return;
            }

            // SORT BY TIME to match AlbumRouteView logic
            allPhotos.sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at));

            console.log(`[Repair] Found ${allPhotos.length} valid photos for user. Using them to repair album.`);

            // 2. Map old photo count to new
            // Try to match the count of corrupted IDs if possible, or just use what we have
            // The corrupted IDs were 11.
            const targetCount = Math.min(allPhotos.length, 11);
            const newPhotos = allPhotos.slice(0, targetCount);
            const newPhotoIds = newPhotos.map(p => p.id);

            console.log(`[Repair] Selected ${newPhotoIds.length} photos.`);
            const oldTransitions = album.content_data.transitions || [];
            const newTransitions = [];

            for (let i = 0; i < newPhotoIds.length - 1; i++) {
                const fromId = newPhotoIds[i];
                const toId = newPhotoIds[i + 1];
                // Try to keep old mode
                const oldMode = oldTransitions[i] ? oldTransitions[i].mode : 'car';

                newTransitions.push({
                    from: fromId,
                    to: toId,
                    mode: oldMode
                });
            }

            // 3. Update Content Data
            const newContentData = {
                ...album.content_data,
                photo_ids: newPhotoIds,
                transitions: newTransitions,
                // Clear old settings that map to invalid IDs
                settings: { photoFrameStyles: {} }
            };

            console.log('[Repair] New Content Data prepared.');
            console.log(' - New Photo Count:', newPhotoIds.length);
            console.log(' - New Transitions:', newTransitions.length);

            // 4. Save to DB
            const { error: updateError } = await supabaseAdmin
                .from('albums')
                .update({ content_data: newContentData })
                .eq('id', ALBUM_ID);

            if (updateError) {
                console.error('[Repair] Failed to update album:', updateError);
            } else {
                console.log('[Repair] SUCCESS! Album updated with valid photos.');
            }
        } // End if (true) force repair
    } else {
        console.log('[Inspect] No photo_ids found in content_data (Legacy format?)');
    }
}

inspect();
