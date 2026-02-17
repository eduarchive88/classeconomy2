import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { sessionCode, studentId } = await request.json();
    const supabase = createClient();

    // 1. 세션코드로 학급 찾기
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id')
        .eq('session_code', sessionCode)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: '유효하지 않은 세션코드입니다.' }, { status: 400 });
    }

    // 2. 학번 파싱 (형식: 학년-반-번호, 예: 3-2-15)
    const parts = studentId.split('-');
    if (parts.length !== 3) {
        return NextResponse.json({ error: '학번 형식이 올바르지 않습니다. (예: 3-2-15)' }, { status: 400 });
    }

    const [grade, classInfo, number] = parts.map(p => parseInt(p));
    if (isNaN(grade) || isNaN(classInfo) || isNaN(number)) {
        return NextResponse.json({ error: '학번은 숫자로만 구성되어야 합니다.' }, { status: 400 });
    }

    // 3. 학생 찾기
    const { data: student, error: studentError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info, number')
        .eq('class_id', classData.id)
        .eq('grade', grade)
        .eq('number', number)
        .maybeSingle();

    if (studentError || !student) {
        return NextResponse.json({ error: '해당 학번의 학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 4. 학생 계정 생성 또는 로그인
    // 학번 기반 이메일 생성 (예: session123_3-2-15@student.local)
    const email = `${sessionCode}_${studentId}@student.local`;
    const password = `${sessionCode}_${studentId}`; // 간단한 비밀번호 (세션코드_학번)

    // 먼저 계정이 있는지 확인
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (signInError) {
        // 계정이 없으면 생성
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    role: 'student',
                    name: student.name,
                    roster_id: student.id,
                    grade: student.grade,
                    class_info: student.class_info,
                    number: student.number,
                }
            }
        });

        if (signUpError) {
            return NextResponse.json({ error: '로그인 실패: ' + signUpError.message }, { status: 500 });
        }

        // 회원가입 후 자동 로그인
        return NextResponse.json({
            success: true,
            user: signUpData.user,
            session: signUpData.session,
            message: '계정이 생성되었습니다.'
        });
    }

    // 로그인 성공
    return NextResponse.json({
        success: true,
        user: signInData.user,
        session: signInData.session,
        message: '로그인 성공'
    });
}
