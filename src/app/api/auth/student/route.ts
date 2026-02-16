
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, sessionCode } = await request.json();
    const supabase = createClient();

    // 1. Validate session code and find the teacher (class)
    const { data: teacher, error: teacherError } = await supabase
        .from('profiles')
        .select('id, class_info')
        .eq('role', 'teacher')
        .eq('session_code', sessionCode)
        .single();

    if (teacherError || !teacher) {
        return NextResponse.json({ error: '유효하지 않은 세션 코드입니다.' }, { status: 400 });
    }

    // 2. Find student in this teacher's roster
    const { data: rosterEntry, error: rosterError } = await supabase
        .from('student_roster')
        .select('*')
        .eq('teacher_id', teacher.id)
        .eq('number', studentId) // Assuming input is the 'number' (e.g. 15 or 1101 depending on how they uploaded)
        .single();

    if (rosterError || !rosterEntry) {
        return NextResponse.json({ error: '해당 학번/번호가 명단에 없습니다.' }, { status: 400 });
    }

    // 3. Auto-generate credentials
    const fakeEmail = `${sessionCode}_${studentId}@student.local`;
    const defaultPassword = `${sessionCode}_${studentId}`;

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: defaultPassword,
    });

    if (signInError) {
        // If sign in fails, create new user (Sign Up)
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: fakeEmail,
            password: defaultPassword,
            options: {
                data: {
                    role: 'student',
                    student_id: studentId,
                    name: rosterEntry.name,
                    class_info: teacher.class_info,
                    grade: rosterEntry.grade,
                    number: rosterEntry.class_info // Note: Mapping might be loose here, but sufficient for now
                }
            }
        });

        if (signUpError) {
            return NextResponse.json({ error: '계정 생성 실패: ' + signUpError.message }, { status: 400 });
        }

        // Mark as registered in roster
        await supabase
            .from('student_roster')
            .update({ is_registered: true })
            .eq('id', rosterEntry.id);
    }

    return NextResponse.json({ success: true });
}
