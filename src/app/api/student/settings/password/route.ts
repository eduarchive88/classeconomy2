import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, currentPassword, newPassword } = await request.json();
    const supabase = createClient();

    if (!studentId || !newPassword) {
        return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    // 1. 학생 확인 및 현재 비밀번호 검증
    const { data: student, error } = await supabase
        .from('student_roster')
        .select('id, password')
        .eq('id', studentId)
        .single();

    if (error || !student) {
        return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 현재 비밀번호 검증 (기존 비밀번호가 있는 경우)
    if (student.password && student.password !== currentPassword) {
        return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 2. 비밀번호 업데이트
    const { error: updateError } = await supabase
        .from('student_roster')
        .update({ password: newPassword })
        .eq('id', studentId);

    if (updateError) {
        return NextResponse.json({ error: '비밀번호 변경 실패' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
