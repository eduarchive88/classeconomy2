
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { students } = await request.json();
    const supabase = createClient();

    // 1. Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Insert into student_roster
    const rosterData = students.map((s: any) => ({
        teacher_id: user.id,
        grade: s.grade,
        class_info: s.class, // Mapped from 'class' in JSON
        number: s.number,
        name: s.name,
        allowance: s.allowance,
    }));

    const { error } = await supabase
        .from('student_roster')
        .upsert(rosterData, { onConflict: 'teacher_id, grade, class_info, number' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
