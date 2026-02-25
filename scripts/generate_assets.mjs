// EggTogether Asset Generator
// A1 이미지를 기반으로 A2, A3, 모바일 버전을 파생 생성
// Usage: node scripts/generate_assets.mjs

import Jimp from 'jimp';
import { promises as fs } from 'fs';
import path from 'path';

const CANDIDATE_BASE = 'C:/Users/DJ/.gemini/antigravity/brain/288d15cc-f234-4d72-92c7-2dd55e95e29a';
const CANDIDATES_OUT = './docs/Resources/Design/Assets/candidates/eggtogether_main_image_20260224';
const PUBLIC_BG = './public/assets/bg';
const PUBLIC_BRAND = './public/assets/brand';
const PUBLIC_UI = './public/assets/ui';
const PUBLIC_MAP = './public/assets/map';

async function ensureDirs() {
    for (const d of [CANDIDATES_OUT, PUBLIC_BG, PUBLIC_BRAND, PUBLIC_UI, PUBLIC_MAP]) {
        await fs.mkdir(d, { recursive: true });
    }
}

// PNG → WebP: jimp save as webp
async function saveWebP(img, dest, quality = 80) {
    // jimp doesn't natively do WebP, save as high-quality JPEG then rename
    // We'll save PNG to candidates and WebP-named PNG actually (browser compatible)
    await img.writeAsync(dest);
    console.log(`  SAVED: ${dest}`);
}

async function processAuthBgs() {
    console.log('\n[AUTH BACKGROUNDS]');

    // A1 원본 로드 (cand_a 사용)
    const srcPath = path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png');
    const srcPathB = path.join(CANDIDATE_BASE, 'a1_login_bg_cand_b_1771942445038.png');

    // --- A1: Login (원본 그대로, 리사이즈만) ---
    console.log('Processing A1 Login bg...');
    const a1 = await Jimp.read(srcPath);
    const a1Resized = a1.clone().resize(1920, 1080);
    await saveWebP(a1Resized, `${CANDIDATES_OUT}/A1_login_bg_final.png`);
    // Final destination (PNG as WebP-named for now, will be converted)
    await saveWebP(a1Resized.clone(), `${PUBLIC_BG}/auth-login-v1.png`);

    // --- A1-M: Login Mobile (중앙 크롭 → 1080x1920) ---
    console.log('Processing A1-M Login mobile bg...');
    const a1m = await Jimp.read(srcPath);
    // 원본에서 가운데 부분 세로 크롭
    const origW = a1m.getWidth();
    const origH = a1m.getHeight();
    // 세로 비율 1080:1920 = 0.5625
    // 원본 비율이 16:9이므로, 높이 기준으로 너비를 맞춤
    // target: 1080x1920 → aspect 9:16
    // 원본 height H → new width = H * (9/16)
    const cropW = Math.floor(origH * (9 / 16));
    const cropX = Math.floor((origW - cropW) / 2); // 중앙 크롭
    const a1mCropped = a1m.crop(cropX, 0, cropW, origH).resize(1080, 1920);
    await saveWebP(a1mCropped, `${CANDIDATES_OUT}/A1M_login_mobile_final.png`);
    await saveWebP(a1mCropped.clone(), `${PUBLIC_BG}/auth-login-mobile-v1.png`);

    // --- A2: Register (색조 따뜻하게: +10 hue warm, +10 brightness) ---
    console.log('Processing A2 Register bg...');
    const a2 = await Jimp.read(srcPathB);
    a2.resize(1920, 1080)
        .color([{ apply: 'mix', params: ['#FFE4D6', 15] }]); // 따뜻한 살구빛 오버레이
    await saveWebP(a2, `${CANDIDATES_OUT}/A2_register_bg_cand_a.png`);
    await saveWebP(a2.clone(), `${PUBLIC_BG}/auth-register-v1.png`);

    // --- A2-M: Register Mobile ---
    console.log('Processing A2-M Register mobile bg...');
    const a2m = await Jimp.read(srcPathB);
    const ow2 = a2m.getWidth(), oh2 = a2m.getHeight();
    const cw2 = Math.floor(oh2 * (9 / 16));
    const cx2 = Math.floor((ow2 - cw2) / 2);
    a2m.crop(cx2, 0, cw2, oh2).resize(1080, 1920)
        .color([{ apply: 'mix', params: ['#FFE4D6', 15] }]);
    await saveWebP(a2m, `${CANDIDATES_OUT}/A2M_register_mobile_final.png`);
    await saveWebP(a2m.clone(), `${PUBLIC_BG}/auth-register-mobile-v1.png`);

    // --- A3: Forgot PW (채도 낮추고 청량한 블루 오버레이) ---
    console.log('Processing A3 Forgot-PW bg...');
    const a3 = await Jimp.read(srcPath);
    a3.resize(1920, 1080)
        .color([
            { apply: 'desaturate', params: [20] },
            { apply: 'mix', params: ['#D6EEF8', 20] } // 청량한 하늘색 오버레이
        ]);
    await saveWebP(a3, `${CANDIDATES_OUT}/A3_forgot_bg_cand_a.png`);
    await saveWebP(a3.clone(), `${PUBLIC_BG}/auth-forgot-v1.png`);

    // --- A3-M: Forgot PW Mobile ---
    console.log('Processing A3-M Forgot mobile bg...');
    const a3m = await Jimp.read(srcPath);
    const ow3 = a3m.getWidth(), oh3 = a3m.getHeight();
    const cw3 = Math.floor(oh3 * (9 / 16));
    const cx3 = Math.floor((ow3 - cw3) / 2);
    a3m.crop(cx3, 0, cw3, oh3).resize(1080, 1920)
        .color([
            { apply: 'desaturate', params: [20] },
            { apply: 'mix', params: ['#D6EEF8', 20] }
        ]);
    await saveWebP(a3m, `${CANDIDATES_OUT}/A3M_forgot_mobile_final.png`);
    await saveWebP(a3m.clone(), `${PUBLIC_BG}/auth-forgot-mobile-v1.png`);

    console.log('✅ Auth backgrounds done.');
}

async function processMapMarkers() {
    console.log('\n[MAP MARKERS]');
    // 원본 이미지에서 달걀 캐릭터 부분을 잘라 64x64 마커 생성
    const src = await Jimp.read(
        path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png')
    );
    const w = src.getWidth();
    const h = src.getHeight();

    // 오른쪽 60% 영역의 상단 부분에서 캐릭터를 추정 크롭 (중앙 캐릭터)
    // 폴라로이드 안 달걀 캐릭터: 오른쪽 중앙 영역
    const charX = Math.floor(w * 0.55);
    const charY = Math.floor(h * 0.15);
    const charSize = Math.floor(h * 0.65);

    // D1: Default marker (원색 그대로)
    const d1 = src.clone()
        .crop(charX, charY, Math.min(charSize, w - charX), Math.min(charSize, h - charY))
        .resize(64, 64);
    await saveWebP(d1, `${CANDIDATES_OUT}/D1_marker_default_cand_a.png`);
    await saveWebP(d1.clone(), `${PUBLIC_MAP}/marker-egg-default-v1.png`);

    // D2: Active marker (핀 레드 오버레이로 강조)
    const d2 = src.clone()
        .crop(charX, charY, Math.min(charSize, w - charX), Math.min(charSize, h - charY))
        .resize(64, 64)
        .color([{ apply: 'mix', params: ['#F06A6A', 25] }]);
    await saveWebP(d2, `${CANDIDATES_OUT}/D2_marker_active_cand_a.png`);
    await saveWebP(d2.clone(), `${PUBLIC_MAP}/marker-egg-active-v1.png`);

    console.log('✅ Map markers done.');
}

async function processOGImage() {
    console.log('\n[OG IMAGE - E1]');
    // OG: 1200x630 (약 1.9:1) → 원본 16:9를 크롭
    const src = await Jimp.read(
        path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png')
    );
    const srcW = src.getWidth();
    const srcH = src.getHeight();
    // 1200x630 비율 = 1.904:1, 원본 1920x1080 = 1.777:1
    // 원본 전체를 1200x630으로 단순 리사이즈 (캐릭터 비율 유지)
    const e1 = src.clone().resize(1200, 630);
    await saveWebP(e1, `${CANDIDATES_OUT}/E1_og_home_cand_a.png`);
    await saveWebP(e1.clone(), `${PUBLIC_BRAND}/og-home-v1.png`);
    console.log('✅ OG image done.');
}

async function processUIStates() {
    console.log('\n[UI STATE IMAGES - C1, C2]');
    const src = await Jimp.read(
        path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png')
    );
    const w = src.getWidth();
    const h = src.getHeight();

    // C1: Home Empty (800x600) - 오른쪽 캐릭터 중심 크롭
    const c1X = Math.floor(w * 0.42);
    const c1W = Math.floor(w * 0.58);
    const c1 = src.clone().crop(c1X, 0, c1W, h).resize(800, 600);
    await saveWebP(c1, `${CANDIDATES_OUT}/C1_home_empty_cand_a.png`);
    await saveWebP(c1.clone(), `${PUBLIC_UI}/home-empty-v1.png`);

    // C2: 404 (1000x700) - 전체 이미지에 약한 오버레이
    const c2 = src.clone().resize(1000, 700)
        .color([{ apply: 'mix', params: ['#FFDDE6', 15] }]); // 살짝 핑크 톤으로
    await saveWebP(c2, `${CANDIDATES_OUT}/C2_not_found_cand_a.png`);
    await saveWebP(c2.clone(), `${PUBLIC_UI}/not-found-v1.png`);

    console.log('✅ UI state images done.');
}

async function processMascot() {
    console.log('\n[MASCOT - B1]');
    // B1: 메인 마스코트 투명 배경 1400x1400
    // 원본 이미지에서 폴라로이드 캐릭터 영역 크롭 후 확대
    const src = await Jimp.read(
        path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png')
    );
    const w = src.getWidth();
    const h = src.getHeight();
    // 폴라로이드+캐릭터 영역 (오른쪽 55%부터, 상단 5%부터, 전체 높이)
    const mx = Math.floor(w * 0.48);
    const mw = Math.floor(w * 0.52);
    const b1 = src.clone().crop(mx, 0, mw, h).resize(1400, 1400);
    await saveWebP(b1, `${CANDIDATES_OUT}/B1_mascot_main_cand_a.png`);
    await saveWebP(b1.clone(), `${PUBLIC_BRAND}/mascot-main-v1.png`);
    console.log('✅ Mascot done.');
}

async function processFavicon() {
    console.log('\n[FAVICON - F1]');
    const src = await Jimp.read(
        path.join(CANDIDATE_BASE, 'a1_login_bg_cand_a_1771942140640.png')
    );
    const w = src.getWidth();
    const h = src.getHeight();
    // 중앙 달걀 캐릭터만 크롭
    const fx = Math.floor(w * 0.58);
    const fy = Math.floor(h * 0.10);
    const fsize = Math.floor(h * 0.80);
    const fSrc = src.clone().crop(fx, fy, Math.min(fsize, w - fx), Math.min(fsize, h - fy));

    // 16x16
    await saveWebP(fSrc.clone().resize(16, 16), `${CANDIDATES_OUT}/F1_favicon_16.png`);
    await saveWebP(fSrc.clone().resize(16, 16), './public/favicon-16x16.png');
    // 32x32
    await saveWebP(fSrc.clone().resize(32, 32), `${CANDIDATES_OUT}/F1_favicon_32.png`);
    await saveWebP(fSrc.clone().resize(32, 32), './public/favicon-32x32.png');
    // 180x180 (apple touch icon)
    await saveWebP(fSrc.clone().resize(180, 180), `${CANDIDATES_OUT}/F1_apple_touch_icon.png`);
    await saveWebP(fSrc.clone().resize(180, 180), './public/apple-touch-icon.png');

    console.log('✅ Favicon done.');
}

async function main() {
    console.log('=== EggTogether Asset Generator ===');
    await ensureDirs();
    await processAuthBgs();
    await processMapMarkers();
    await processOGImage();
    await processUIStates();
    await processMascot();
    await processFavicon();
    console.log('\n🎉 All assets generated!');
    console.log('Note: WebP 변환은 별도 sharp 설치 후 가능. 현재 PNG로 저장됨.');
}

main().catch(console.error);
