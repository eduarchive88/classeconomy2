import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
    const body = await request.json();
    const sessionCode = body.sessionCode?.trim();
    const studentId = body.studentId;
    const password = body.password;
    const supabase = createClient();

    // 1. 세션코드로 학급 찾기
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .ilike('session_code', sessionCode)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: '유효하지 않은 세션코드입니다.' }, { status: 400 });
    }

    // 2. 학번 파싱 (형식: 5자리 숫자 GCCNN, 예: 20201 = 2학년 02반 01번)
    if (!/^\d{5}$/.test(studentId)) {
        return NextResponse.json({ error: '학번은 5자리 숫자여야 합니다. (예: 20201 = 2학년 2반 1번)' }, { status: 400 });
    }

    // DB 컬럼이 text 타입이므로 문자열로 비교 (앞자리 0 제거)
    const grade = String(parseInt(studentId.charAt(0))); // "2"
    const classInfo = String(parseInt(studentId.substring(1, 3))); // "2" (02 → 2)
    const number = String(parseInt(studentId.substring(3, 5))); // "1" (01 → 1)

    console.log(`Student login attempt: grade=${grade}, class_info=${classInfo}, number=${number}, class_id=${classData.id}`);

    // 3. 학생 찾기 (balance 컬럼 사용, DB 스키마에 맞춤)
    const { data: student, error: studentError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info, number, balance')
        .select('id, name, grade, class_info, number, balance, password') // password 컬럼 추가
        .eq('class_id', classData.id)
        .eq('grade', grade)
        .eq('class_info', classInfo)
        .eq('number', number)
        .maybeSingle();

    if (studentError || !student) {
        return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 비밀번호 검증
    // DB에 비밀번호가 없으면(null/empty) 초기 비밀번호 '1234'로 간주
    const dbPassword = student.password || '1234';
    if (dbPassword !== password) {
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 4. 세션 토큰 생성 (간단한 방식)
    const sessionToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간 후

    // 5. 세션 정보를 로컬스토리지에 저장하도록 클라이언트에 반환
    // (Supabase Auth를 사용하지 않으므로 서버에서 세션을 관리하지 않음)
    return NextResponse.json({
        success: true,
        student: {
            id: student.id,
            name: student.name,
            grade: student.grade,
            class_info: student.class_info,
            number: student.number,
            balance: student.balance || 0,
            class_id: classData.id,
            class_name: classData.name,
        },
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        message: '로그인 성공'
    });
}
