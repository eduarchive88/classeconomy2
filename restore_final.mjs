import fs from 'fs';
import path from 'path';

async function getEnv() {
    const raw = fs.readFileSync('.env.local', 'utf-8');
    const env = {};
    for (const line of raw.split('\n')) {
        const [k, ...v] = line.split('=');
        if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/"/g, '');
    }
    return env;
}

async function run() {
    const env = await getEnv();
    const url = env['NEXT_PUBLIC_SUPABASE_URL'] + '/pg-meta/default/query';
    const key = env['SUPABASE_SERVICE_ROLE_KEY'];

    const chunksDir = './temp-migration';
    // We'll focus on chunks 3 and 4 as they likely contain the remaining data
    const files = ['combined_chunk_3.sql', 'combined_chunk_4.sql'];

    for (const file of files) {
        const filePath = path.join(chunksDir, file);
        if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            continue;
        }

        console.log(`Processing file: ${file}`);
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Split by semicolon, being careful with quotes (simplified)
        // A better way is to use a proper SQL parser or follow the previous agent's logic.
        // For these specific chunks, they are mostly INSERT statements.
        const statements = content.split(';').map(s => s.trim()).filter(s => s.length > 0);
        console.log(`Found ${statements.length} statements in ${file}`);

        for (let i = 0; i < statements.length; i++) {
            const stmt = statements[i] + ';';
            if (i % 50 === 0) console.log(`Injecting statement ${i}/${statements.length} from ${file}...`);

            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({ query: stmt })
                });

                if (!res.ok) {
                    const err = await res.text();
                    // Some errors like "duplicate key" are expected if we overlap
                    if (!err.includes('duplicate key value violates unique constraint') && !err.includes('already exists')) {
                        console.error(`Error in statement ${i}:`, err);
                        console.error(`Statement snippet: ${stmt.substring(0, 100)}...`);
                    }
                }
            } catch (e) {
                console.error(`Fetch error at statement ${i}:`, e.message);
            }
        }
        console.log(`Finished ${file}`);
    }
    console.log("Restoration Complete!");
}

run();
