
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, sessionCode } = await request.json();
    const supabase = createClient();

    // 1. 세션 코드로 학급/교사 찾기
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, teacher_id, name')
        .eq('session_code', sessionCode)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: '유효하지 않은 세션 코드입니다.' }, { status: 400 });
    }

    // 2. 해당 학급의 명단에서 학생 찾기
    const idNum = parseInt(studentId);
    let number = idNum;

    // 3자리 이상 학번인 경우 뒷 2자리를 번호로 간주
    if (studentId.length >= 3) {
        number = idNum % 100;
    }

    // class_id와 number로 학생 찾기
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

    // 먼저 로그인 시도
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: defaultPassword,
    });

    if (signInError) {
        // 로그인 실패 시 회원가입 후 자동 로그인
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

        // 명단에 등록 완료 표시
        await supabase
            .from('student_roster')
            .update({
                is_registered: true,
                class_id: classData.id
            })
            .eq('id', rosterEntry.id);

        // signUp 후 바로 signIn하여 세션 쿠키 확보
        const { data: autoSignIn, error: autoSignInError } = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: defaultPassword,
        });

        if (autoSignInError) {
            // 자동 로그인 실패해도 계정은 생성됨 - 클라이언트에서 재시도 안내
            return NextResponse.json({
                success: true,
                retry: true,
                message: '계정이 생성되었습니다. 다시 로그인해주세요.'
            });
        }
    }

    return NextResponse.json({ success: true });
}
