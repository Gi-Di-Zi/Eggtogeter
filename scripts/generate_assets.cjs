'use strict';
// jimp v1.6.0 CJS — PNG 전용, stderr 오류 전체 출력
const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

const BRAIN = 'C:/Users/DJ/.gemini/antigravity/brain/288d15cc-f234-4d72-92c7-2dd55e95e29a';
const CAND = 'docs/Resources/Design/Assets/candidates/eggtogether_main_image_20260224';
const BG = 'public/assets/bg';
const BRAND = 'public/assets/brand';
const UI = 'public/assets/ui';
const MAP = 'public/assets/map';

const SRC_A = BRAIN + '/a1_login_bg_cand_a_1771942140640.png';
const SRC_B = BRAIN + '/a1_login_bg_cand_b_1771942445038.png';

[CAND, BG, BRAND, UI, MAP, 'public'].forEach(function (d) { fs.mkdirSync(d, { recursive: true }); });

function log(msg) { process.stdout.write(msg + '\n'); }

async function run() {
    log('=== EggTogether Asset Generator ===');

    log('Loading source images...');
    const imgA = await Jimp.read(SRC_A);
    const imgB = await Jimp.read(SRC_B);
    const aw = imgA.width, ah = imgA.height;
    log('Source A: ' + aw + 'x' + ah);
    log('Source B: ' + imgB.width + 'x' + imgB.height);

    // A1 Login Desktop
    log('[A1] Login desktop...');
    const a1 = imgA.clone().resize({ w: 1920, h: 1080 });
    await a1.write(CAND + '/A1_login_bg_final.png');
    await imgA.clone().resize({ w: 1920, h: 1080 }).write(BG + '/auth-login-v1.png');
    log('  A1 done');

    // A1-M Login Mobile
    log('[A1-M] Login mobile...');
    var cw1 = Math.floor(ah * 9 / 16);
    var cx1 = Math.floor((aw - cw1) / 2);
    var a1m = imgA.clone().crop({ x: cx1, y: 0, w: cw1, h: ah }).resize({ w: 1080, h: 1920 });
    await a1m.write(CAND + '/A1M_login_mobile_final.png');
    await imgA.clone().crop({ x: cx1, y: 0, w: cw1, h: ah }).resize({ w: 1080, h: 1920 }).write(BG + '/auth-login-mobile-v1.png');
    log('  A1-M done');

    // A2 Register Desktop
    log('[A2] Register desktop...');
    var bw = imgB.width, bh = imgB.height;
    await imgB.clone().resize({ w: 1920, h: 1080 }).brightness(0.04).write(CAND + '/A2_register_bg_cand_a.png');
    await imgB.clone().resize({ w: 1920, h: 1080 }).brightness(0.04).write(BG + '/auth-register-v1.png');
    log('  A2 done');

    // A2-M Register Mobile
    log('[A2-M] Register mobile...');
    var cw2 = Math.floor(bh * 9 / 16);
    var cx2 = Math.floor((bw - cw2) / 2);
    await imgB.clone().brightness(0.04).crop({ x: cx2, y: 0, w: cw2, h: bh }).resize({ w: 1080, h: 1920 }).write(CAND + '/A2M_register_mobile_final.png');
    await imgB.clone().brightness(0.04).crop({ x: cx2, y: 0, w: cw2, h: bh }).resize({ w: 1080, h: 1920 }).write(BG + '/auth-register-mobile-v1.png');
    log('  A2-M done');

    // A3 Forgot Desktop
    log('[A3] Forgot-PW desktop...');
    await imgA.clone().resize({ w: 1920, h: 1080 }).color([{ apply: 'desaturate', params: [22] }]).brightness(0.04).write(CAND + '/A3_forgot_bg_cand_a.png');
    await imgA.clone().resize({ w: 1920, h: 1080 }).color([{ apply: 'desaturate', params: [22] }]).brightness(0.04).write(BG + '/auth-forgot-v1.png');
    log('  A3 done');

    // A3-M Forgot Mobile
    log('[A3-M] Forgot mobile...');
    var cw3 = Math.floor(ah * 9 / 16);
    var cx3 = Math.floor((aw - cw3) / 2);
    await imgA.clone().color([{ apply: 'desaturate', params: [22] }]).brightness(0.04).crop({ x: cx3, y: 0, w: cw3, h: ah }).resize({ w: 1080, h: 1920 }).write(CAND + '/A3M_forgot_mobile_final.png');
    await imgA.clone().color([{ apply: 'desaturate', params: [22] }]).brightness(0.04).crop({ x: cx3, y: 0, w: cw3, h: ah }).resize({ w: 1080, h: 1920 }).write(BG + '/auth-forgot-mobile-v1.png');
    log('  A3-M done');

    // B1 Mascot 1400x1400
    log('[B1] Mascot...');
    var b1X = Math.floor(aw * 0.48);
    var b1W = Math.min(Math.floor(aw * 0.52), aw - b1X);
    await imgA.clone().crop({ x: b1X, y: 0, w: b1W, h: ah }).resize({ w: 1400, h: 1400 }).write(CAND + '/B1_mascot_main_cand_a.png');
    await imgA.clone().crop({ x: b1X, y: 0, w: b1W, h: ah }).resize({ w: 1400, h: 1400 }).write(BRAND + '/mascot-main-v1.png');
    log('  B1 done');

    // C1 Home Empty 800x600
    log('[C1] Home empty...');
    var c1X = Math.floor(aw * 0.42);
    var c1W = Math.min(Math.floor(aw * 0.58), aw - c1X);
    await imgA.clone().crop({ x: c1X, y: 0, w: c1W, h: ah }).resize({ w: 800, h: 600 }).write(CAND + '/C1_home_empty_cand_a.png');
    await imgA.clone().crop({ x: c1X, y: 0, w: c1W, h: ah }).resize({ w: 800, h: 600 }).write(UI + '/home-empty-v1.png');
    log('  C1 done');

    // C2 404 1000x700
    log('[C2] 404 state...');
    var inner = imgA.clone().resize({ w: 1000, h: 563 });
    var canvas = new Jimp({ width: 1000, height: 700, color: 0xFFF5E6FF });
    canvas.composite(inner, 0, 68);
    await canvas.write(CAND + '/C2_not_found_cand_a.png');
    var canvas2 = new Jimp({ width: 1000, height: 700, color: 0xFFF5E6FF });
    canvas2.composite(imgA.clone().resize({ w: 1000, h: 563 }), 0, 68);
    await canvas2.write(UI + '/not-found-v1.png');
    log('  C2 done');

    // D1 Marker Default 64x64
    log('[D1] Marker default...');
    var mX = Math.floor(aw * 0.57), mY = Math.floor(ah * 0.08);
    var mS = Math.min(Math.floor(ah * 0.80), aw - mX);
    await imgA.clone().crop({ x: mX, y: mY, w: mS, h: Math.min(mS, ah - mY) }).resize({ w: 64, h: 64 }).write(CAND + '/D1_marker_default_cand_a.png');
    await imgA.clone().crop({ x: mX, y: mY, w: mS, h: Math.min(mS, ah - mY) }).resize({ w: 64, h: 64 }).write(MAP + '/marker-egg-default-v1.png');
    log('  D1 done');

    // D2 Marker Active 64x64
    log('[D2] Marker active...');
    await imgA.clone().crop({ x: mX, y: mY, w: mS, h: Math.min(mS, ah - mY) }).resize({ w: 64, h: 64 }).color([{ apply: 'mix', params: ['#F06A6A', 28] }]).write(CAND + '/D2_marker_active_cand_a.png');
    await imgA.clone().crop({ x: mX, y: mY, w: mS, h: Math.min(mS, ah - mY) }).resize({ w: 64, h: 64 }).color([{ apply: 'mix', params: ['#F06A6A', 28] }]).write(MAP + '/marker-egg-active-v1.png');
    log('  D2 done');

    // E1 OG 1200x630
    log('[E1] OG image...');
    await imgA.clone().resize({ w: 1200, h: 675 }).crop({ x: 0, y: 22, w: 1200, h: 630 }).write(CAND + '/E1_og_home_cand_a.png');
    await imgA.clone().resize({ w: 1200, h: 675 }).crop({ x: 0, y: 22, w: 1200, h: 630 }).write(BRAND + '/og-home-v1.png');
    log('  E1 done');

    // F1 Favicons
    log('[F1] Favicons...');
    var fX = Math.floor(aw * 0.60), fY = Math.floor(ah * 0.10);
    var fS = Math.min(Math.floor(ah * 0.72), aw - fX);
    var fH = Math.min(fS, ah - fY);
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 16, h: 16 }).write(CAND + '/F1_favicon_16.png');
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 16, h: 16 }).write('public/favicon-16x16.png');
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 32, h: 32 }).write(CAND + '/F1_favicon_32.png');
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 32, h: 32 }).write('public/favicon-32x32.png');
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 180, h: 180 }).write(CAND + '/F1_apple_touch_icon_180.png');
    await imgA.clone().crop({ x: fX, y: fY, w: fS, h: fH }).resize({ w: 180, h: 180 }).write('public/apple-touch-icon.png');
    log('  F1 done');

    log('\nALL ASSETS GENERATED!');
    log('Auth BGs   -> ' + BG);
    log('Brand      -> ' + BRAND);
    log('UI States  -> ' + UI);
    log('Map        -> ' + MAP);
    log('Candidates -> ' + CAND);
}

run().catch(function (err) {
    process.stderr.write('ERROR: ' + err.message + '\n');
    process.stderr.write(err.stack + '\n');
    process.exit(1);
});
