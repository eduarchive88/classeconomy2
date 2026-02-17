
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, sessionCode } = await request.json();
    const supabase = createClient();

    // 1. Validate session code and find the teacher (class)
    // 1. Validate session code and find the class/teacher
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, teacher_id, name')
        .eq('session_code', sessionCode)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: '유효하지 않은 세션 코드입니다.' }, { status: 400 });
    }
    const teacherId = classData.teacher_id;

    // 2. 해당 교사의 명단에서 학생 찾기
    // 10120 형식 파싱 (학년-반-번호)
    const idNum = parseInt(studentId);
    let query = supabase.from('student_roster').select('*').eq('teacher_id', teacherId);

    if (studentId.length === 5) {
        const grade = Math.floor(idNum / 10000);
        const classInfo = Math.floor((idNum % 10000) / 100);
        const number = idNum % 100;
        query = query.eq('grade', grade).eq('class_info', classInfo).eq('number', number);
    } else {
        // Fallback for older format
        query = query.eq('number', studentId);
    }

    const { data: rosterEntry, error: rosterError } = await query.single();

    if (rosterError || !rosterEntry) {
        return NextResponse.json({ error: '해당 학번/번호가 명단에 없습니다.' }, { status: 400 });
    }

    // 3. 인증 정보 자동 생성
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
                    class_info: classData.name,
                    grade: rosterEntry.grade,
                    number: rosterEntry.number // Fix: rosterEntry has 'number' column
                }
            }
        });

        if (signUpError) {
            return NextResponse.json({ error: '계정 생성 실패: ' + signUpError.message }, { status: 400 });
        }

        // Mark as registered in roster and link class_id
        await supabase
            .from('student_roster')
            .update({
                is_registered: true,
                class_id: classData.id
            })
            .eq('id', rosterEntry.id);
    }

    return NextResponse.json({ success: true });
}
