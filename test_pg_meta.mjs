import fs from 'fs';

const raw = fs.readFileSync('.env.development.local', 'utf-8');
const env = {};
for (const line of raw.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
}

async function check() {
    try {
        const url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/pg-meta/default/query';
        const key = env['SUPABASE_SERVICE_ROLE_KEY'];
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({ query: 'SELECT 1 as passed' })
        });
        
        console.log("Status:", res.status);
        console.log("Body:", await res.text());
    } catch (e) {
        console.error(e);
    }
}
check();
