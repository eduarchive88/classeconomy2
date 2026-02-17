
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { students, sessionCode, class_id } = await request.json();
    const supabase = createClient();

    // 1. Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Insert into student_roster
    const rosterData = students.map((s: any) => ({
        teacher_id: user.id,
        class_id: class_id,
        grade: s.grade,
        class_info: sessionCode || s.class, // 사용자가 입력한 세션코드를 최우선으로 저장
        number: s.number,
        name: s.name,
        allowance: s.allowance,
    }));

    const { error } = await supabase
        .from('student_roster')
        .upsert(rosterData, { onConflict: 'class_id, number' });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
    const { id } = await request.json();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
        .from('student_roster')
        .delete()
        .eq('id', id)
        .eq('teacher_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
}
