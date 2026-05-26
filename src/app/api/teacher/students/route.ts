
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { verifyTeacher } from '@/utils/teacher-auth';

export async function POST(request: Request) {
    const { students, sessionCode, class_id } = await request.json();
    const supabase = createClient();

    // 1. DB 기반 교사 여부 확인 (user_metadata.role 대신 안정적인 DB 검증)
    const auth = await verifyTeacher(supabase);
    if (!auth.ok) return auth.errorResponse!;
    const user = auth.user;

    // 2. Insert into student_roster
    const rosterData = students.map((s: any) => ({
        teacher_id: user.id,
        class_id: class_id,
        grade: s.grade,
        class_info: sessionCode || s.class,
        number: s.number,
        name: s.name,
        allowance: s.allowance,
        password: s.password || '1234', // 기본 비밀번호 1234
    }));

    const { error } = await supabase
        .from('student_roster')
        .upsert(rosterData, { onConflict: 'class_id, grade, class_info, number' }); // class_id, number 만으로는 유니크하지 않을 수 있음 (학년/반 포함 필요)

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
    const { id, password } = await request.json();
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error } = await supabase
        .from('student_roster')
        .update({ password })
        .eq('id', id)
        .eq('teacher_id', user.id);

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
