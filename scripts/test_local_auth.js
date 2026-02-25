import { createClient } from '@supabase/supabase-js';

// Local config
const SUPABASE_URL = 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const MAILPIT_API = 'http://127.0.0.1:54324/api/v1';

console.log(`[Init] Using Supabase URL: ${SUPABASE_URL}`);
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const TEST_EMAIL = `test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'password123';

async function attemptLogin(label = '') {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    });

    if (loginError || !loginData?.session) {
        console.error(`[Fail] Login failed${label ? ` (${label})` : ''}: ${loginError?.message || 'no session'}`);
        process.exitCode = 1;
        return false;
    }

    console.log(`[Success] Login successful! User ID: ${loginData.user.id}`);
    return true;
}

async function runTest() {
    console.log(`[1] Signing up user: ${TEST_EMAIL}`);
    const { data, error } = await supabase.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (error) {
        console.error('[Fail] Signup Error:', error.message);
        process.exit(1);
    }

    if (data.session) {
        console.warn(`[Warn] Session received immediately for ${data.user.id}`);
        console.warn('       This means Email Confirmation is DISABLED or Auto-Confirm is ON.');
    } else {
        console.log(`[1.1] Signup OK. User ID: ${data.user?.id}. Confirmation required.`);
    }

    console.log('[2] Polling Mailpit for ANY messages...');

    let confirmationUrl = null;

    for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 1000));
        try {
            // Fetch ALL messages
            const res = await fetch(`${MAILPIT_API}/messages`);
            if (!res.ok) {
                console.log(`    Polling status ${res.status}...`);
                continue;
            }

            const serverData = await res.json();
            const allMessages = serverData.messages || [];

            console.log(`    [Attempt ${i + 1}] Total Messages: ${serverData.total}`);

            // Find our email
            const myMsg = allMessages.find(m => {
                // 'To' is array of objects {Name, Address}
                return m.To.some(t => t.Address === TEST_EMAIL);
            });

            if (myMsg) {
                console.log(`[3] Found Email! Subject: ${myMsg.Subject}`);

                // Fetch body
                const msgRes = await fetch(`${MAILPIT_API}/message/${myMsg.ID}`);
                const msgData = await msgRes.json();
                const body = msgData.Text || msgData.HTML;

                // Regex for localhost link
                const match = body.match(/(http:\/\/127\.0\.0\.1:54321\/auth\/v1\/verify\?[^\s"'>]+)/);
                if (match) {
                    confirmationUrl = match[1];
                    console.log(`[3.1] Extracted Link: ${confirmationUrl}`);
                    break;
                } else {
                    console.log('[3.1] No Link found in body. Body preview:');
                    console.log(body.substring(0, 100));
                }
            }

        } catch (e) {
            console.error('    Polling Error:', e.message);
        }
    }

    if (!confirmationUrl) {
        console.error('[Fail] Timeout: No email found or no link in email.');
        return;
    }

    console.log('[4] Clicking Verification Link...');
    try {
        const verifyRes = await fetch(confirmationUrl, { redirect: 'follow' });
        console.log(`[4.1] Request finished. Final URL: ${verifyRes.url}`);
        await attemptLogin();

    } catch (e) {
        const message = e?.message || '';
        const causeText = JSON.stringify(e?.cause || {});
        const isConnectionRefused = message.includes('ECONNREFUSED') || causeText.includes('ECONNREFUSED');

        if (isConnectionRefused) {
            // Verification may already be completed before redirect target fails.
            console.log('[Warn] Connection Refused (likely redirection to localhost:3000). checking login...');
            await attemptLogin('after redirect error');
        } else {
            console.error('[Fail] Verification Exception:', e);
            process.exitCode = 1;
        }
    }
}

runTest();
