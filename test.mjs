import pg from 'pg';
const { Client } = pg;

const client = new Client({
    host: '222.98.198.91',
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres'
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to DB successfully!");
        const res = await client.query('SELECT 1 as val');
        console.log("Query result:", res.rows[0]);
    } catch (e) {
        console.error("DB Connection Failed:", e.message);
    } finally {
        await client.end();
    }
}
run();
