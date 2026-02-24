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
    console.log("Fetching all classes...");
    const classRes = await fetch(`${url}/rest/v1/classes?select=id,name,session_code`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const classes = await classRes.json();
    console.log("Available classes:", classes.map(c => c.session_code));

    // Find class1 or the test class
    const cls = classes.find(c => c.session_code?.toLowerCase() === 'class1'.toLowerCase() || c.name?.includes('class1'));
    if (!cls) return console.log("Class1 not found in list");

    console.log("Found Class:", cls.name, "ID:", cls.id);

    console.log("Fetching roster for class...");
    const rosterRes = await fetch(`${url}/rest/v1/student_roster?class_id=eq.${cls.id}&select=*`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` }
    });
    const roster = await rosterRes.json();

    const student = roster.find(s => s.grade === 2 && s.class_info === 2 && s.number === 1 || s.name === '20201' || String(s.profile_id) === '20201' || String(s.number) === '20201');
    console.log("Target Student (20201):", student);

    if (student) {
        console.log("Fetching seats...");
        const seatsRes = await fetch(`${url}/rest/v1/seats?class_id=eq.${cls.id}&select=id,price,row_idx,col_idx,student_id`, {
            headers: { apikey: key, Authorization: `Bearer ${key}` }
        });
        const seats = await seatsRes.json();
        console.log("Seats owned by this student:", seats.filter(s => s.student_id === student.id));
        console.log("Occupied Seats in class counts:", seats.filter(s => s.student_id !== null).length, "/", seats.length);
    } else {
        console.log("First 5 students in roster:", roster.slice(0, 5));
    }
}

check();
