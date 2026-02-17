
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

    // 2. 해당 학급의 명단에서 학생 찾기
    // 10120 형식 파싱 (학년-반-번호) -> 뒷자리 번호만 추출
    const idNum = parseInt(studentId);
    let number = idNum;

    // 5자리 학번인 경우 뒷 2자리를 번호로 간주
    if (studentId.length >= 3) {
        number = idNum % 100;
    }

    // class_id와 number로 학생 찾기 (가장 정확함)
    const { data: rosterEntry, error: rosterError } = await supabase
        .from('student_roster')
        .select('*')
        .eq('class_id', classData.id)
        .eq('number', number)
        .single();

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
                    number: rosterEntry.number,
                    roster_id: rosterEntry.id,
                    class_id: classData.id
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
