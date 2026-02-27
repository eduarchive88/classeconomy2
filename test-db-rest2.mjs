import fs from 'fs';

function getEnv() {
    const raw = fs.readFileSync('.env.local', 'utf-8');
    const env = {};
    for (const line of raw.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
    }
    return env;
}

const env = getEnv();
const url = env['NEXT_PUBLIC_SUPABASE_URL'];
const key = env['SUPABASE_SERVICE_ROLE_KEY'];

async function check() {
    console.log("Fetching market_data...");
    const mdRes = await fetch(`${url}/rest/v1/market_data?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    console.log("market_data:", await mdRes.json());

    console.log("Fetching teacher_settings...");
    const tsRes = await fetch(`${url}/rest/v1/teacher_settings?select=*&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    console.log("teacher_settings:", await tsRes.json());
}
check();
