import fs from 'fs';

async function check() {
    try {
        const raw = fs.readFileSync('.env.local', 'utf-8');
        const env = {};
        for (const line of raw.split('\n')) {
            const [k, ...v] = line.split('=');
            if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
        }
        
        const url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/pg-meta/default/query';
        const key = env['SUPABASE_SERVICE_ROLE_KEY'];

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({ query: 'SELECT (SELECT COUNT(*) FROM economy.transactions) as transactions, (SELECT COUNT(*) FROM economy.student_roster) as roster, (SELECT COUNT(*) FROM economy.investments) as investments;' })
        });
        
        const data = await res.json();
        console.log('FINAL_COUNTS_RESULT:', JSON.stringify(data));
    } catch (e) {
        console.error('ERROR:', e.message);
    }
}

check();
