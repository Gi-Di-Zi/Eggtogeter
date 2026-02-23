import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load Status
const statusPath = path.resolve('status.json');
if (!fs.existsSync(statusPath)) {
    console.error('status.json not found. Run "npx supabase status -o json > status.json" first.');
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
            // Convert BE -> LE bytes
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

const statusContent = readJsonWithEncodingFallback(statusPath);
let status;
try {
    status = JSON.parse(statusContent);
} catch (e) {
    console.error('Failed to parse status.json:', e.message);
    process.exit(1);
}

const SUPABASE_URL = status.API_URL;
const SERVICE_ROLE_KEY = status.SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const USERS = [
    { email: 'qpo8291@naver.com', password: 'password123', role: 'Main User' },
    { email: 'qpo8291@gmail.com', password: 'password123', role: 'Friend User' }
];

// Seoul Center
const SEOUL_LAT = 37.5665;
const SEOUL_LNG = 126.9780;

async function seed() {
    console.log('[Seed] Starting with Admin Client...');

    const userMap = {};

    // 0. List all users to check existence
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
        console.error('[Error] List users failed:', listError.message);
        process.exit(1);
    }

    // 1. Create/Confirm Users
    for (const u of USERS) {
        console.log(`[User] Processing ${u.email}...`);
        let user = users.find(existing => existing.email === u.email);

        if (!user) {
            console.log(`       Creating new user...`);
            const { data: newData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: u.email,
                password: u.password,
                email_confirm: true
            });
            if (createError) {
                console.error(`       Create Failed: ${createError.message}`);
                continue;
            }
            user = newData.user;
            console.log(`       Created & Confirmed (ID: ${user.id})`);
        } else {
            console.log(`       User exists (ID: ${user.id})`);
            if (!user.email_confirmed_at) {
                console.log(`       Confirming email...`);
                const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
                    user.id,
                    { email_confirm: true }
                );
                if (updateError) console.error(`       Confirm Failed: ${updateError.message}`);
                else console.log(`       Confirmed.`);
            }
        }
        userMap[u.email] = user.id;
    }

    const mainUserId = userMap[USERS[0].email];
    if (!mainUserId) {
        console.error('[Fail] Main user ID missing. Aborting photos.');
        return;
    }

    // 2. Seed Photos for Main User
    console.log(`[Photos] Seeding 20 photos for ${USERS[0].email} (${mainUserId})...`);

    // Clean up existing photos first (Optional, but good for clean state)
    console.log('       Cleaning up existing photos...');
    const { data: existingPhotos } = await supabaseAdmin.from('photos').select('id, storage_path').eq('user_id', mainUserId);
    if (existingPhotos && existingPhotos.length > 0) {
        const paths = existingPhotos.map(p => p.storage_path).filter(p => p);
        if (paths.length > 0) await supabaseAdmin.storage.from('photos').remove(paths);
        await supabaseAdmin.from('photos').delete().eq('user_id', mainUserId);
    }

    // Load Assets
    const assetFiles = ['cat.png', 'city.png', 'cafe.png', 'nature.png'];
    const assets = {};
    for (const file of assetFiles) {
        const p = path.join('public', 'test_assets', file);
        if (fs.existsSync(p)) {
            assets[file] = fs.readFileSync(p);
        } else {
            console.warn(`[Warn] Asset not found: ${p}`);
        }
    }
    const assetKeys = Object.keys(assets);
    if (assetKeys.length === 0) {
        console.error('[Fail] No assets found in public/test_assets');
        return;
    }

    // Ensure Bucket Exists
    await supabaseAdmin.storage.createBucket('photos', { public: true });

    for (let i = 0; i < 20; i++) {
        const randomAssetKey = assetKeys[Math.floor(Math.random() * assetKeys.length)];
        const fileContent = assets[randomAssetKey];
        const fileName = `seed_${Date.now()}_${i}.png`;
        const filePath = `${mainUserId}/${fileName}`;

        // A. Upload to Storage
        const { error: uploadError } = await supabaseAdmin.storage
            .from('photos')
            .upload(filePath, fileContent, {
                contentType: 'image/png',
                upsert: true
            });

        if (uploadError) {
            console.error(`       [${i + 1}/20] Upload Failed: ${uploadError.message}`);
        }

        // B. Insert DB Record
        // Random Location: Sudogwon (Seoul Metro)
        // Center: 37.5665, 126.9780
        // Spread: +/- 0.3 deg (~30km)
        const lat = SEOUL_LAT + (Math.random() - 0.5) * 0.6;
        const lng = SEOUL_LNG + (Math.random() - 0.5) * 0.6;

        // Random Date: 2025 Jan - Dec
        const start2025 = new Date('2025-01-01T00:00:00Z').getTime();
        const end2025 = new Date('2025-12-31T23:59:59Z').getTime();
        const randomTime = start2025 + Math.random() * (end2025 - start2025);
        const takenAt = new Date(randomTime).toISOString();

        const { error: dbError } = await supabaseAdmin.from('photos').insert({
            user_id: mainUserId,
            storage_path: filePath,
            description: `[Seeded] ${randomAssetKey.split('.')[0]} photo in Sudogwon`,
            latitude: lat,
            longitude: lng,
            taken_at: takenAt,
            visibility: 'private'
        });

        if (dbError) {
            console.error(`       [${i + 1}/20] DB Insert Failed: ${dbError.message}`);
        } else {
            console.log(`       [${i + 1}/20] Seeded: ${randomAssetKey} @ ${lat.toFixed(4)}, ${lng.toFixed(4)} (${takenAt})`);
        }
    }

    console.log('[Seed] Completed.');
}

seed();
