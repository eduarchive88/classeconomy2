import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
    const { sessionCode, studentId } = await request.json();
    const supabase = createClient();

    // 1. 세션코드로 학급 찾기
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('id, name')
        .eq('session_code', sessionCode)
        .single();

    if (classError || !classData) {
        return NextResponse.json({ error: '유효하지 않은 세션코드입니다.' }, { status: 400 });
    }

    // 2. 학번 파싱 (형식: 5자리 숫자 GCCNN, 예: 20201 = 2학년 02반 01번)
    if (!/^\d{5}$/.test(studentId)) {
        return NextResponse.json({ error: '학번은 5자리 숫자여야 합니다. (예: 20201 = 2학년 2반 1번)' }, { status: 400 });
    }

    const grade = parseInt(studentId.charAt(0)); // 첫 번째 자리: 학년
    const classInfo = parseInt(studentId.substring(1, 3)); // 2-3번째 자리: 반
    const number = parseInt(studentId.substring(3, 5)); // 4-5번째 자리: 번호

    // 3. 학생 찾기
    const { data: student, error: studentError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info, number, currency')
        .eq('class_id', classData.id)
        .eq('grade', grade)
        .eq('class_info', classInfo)
        .eq('number', number)
        .maybeSingle();

    if (studentError || !student) {
        return NextResponse.json({ error: '해당 학번의 학생을 찾을 수 없습니다.' }, { status: 404 });
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
            currency: student.currency,
            class_id: classData.id,
            class_name: classData.name,
        },
        sessionToken,
        expiresAt: expiresAt.toISOString(),
        message: '로그인 성공'
    });
}
