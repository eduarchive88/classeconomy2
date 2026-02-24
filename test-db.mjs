import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("Fetching class 'class1'...");
    const { data: cls } = await supabase.from('classes').select('*').ilike('session_code', 'class1').single();
    if (!cls) return console.log("Class not found");

    console.log("Class ID:", cls.id);

    console.log("Fetching roster for class ID...");
    const { data: roster } = await supabase.from('student_roster').select('*').eq('class_id', cls.id);
    console.log("First 3 students:", roster?.slice(0, 3));

    const student = roster?.find(s => s.grade == 2 && s.class_info == 2 && s.number == 1);
    console.log("Target Student (20201):", student);

    if (student) {
        console.log("Fetching seats for this student...");
        const { data: seats } = await supabase.from('seats').select('*, student:student_id(name, number)').eq('class_id', cls.id);
        console.log("Seats owned by this student:", seats?.filter(s => s.student_id === student.id));
        console.log("Total seats in class:", seats?.length);
    }
}
check();
