import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// 학생 비밀번호 변경 API (RLS 우회를 위해 Admin 클라이언트 사용)
export async function POST(request: Request) {
    const { studentId, currentPassword, newPassword } = await request.json();
    const adminSupabase = createAdminClient();

    if (!studentId || !newPassword) {
        return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
    }

    // 1. 학생 확인 및 현재 비밀번호 검증 (Admin 클라이언트로 RLS 우회)
    const { data: student, error } = await adminSupabase
        .from('student_roster')
        .select('id, password')
        .eq('id', studentId)
        .single();

    if (error || !student) {
        return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 현재 비밀번호 검증 (기존 비밀번호가 있는 경우)
    const currentDbPassword = student.password || '1234';
    if (String(currentDbPassword) !== String(currentPassword)) {
        return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 2. 비밀번호 업데이트 (Admin 클라이언트로 RLS 우회)
    const { error: updateError } = await adminSupabase
        .from('student_roster')
        .update({ password: newPassword })
        .eq('id', studentId);

    if (updateError) {
        console.error('비밀번호 변경 실패:', updateError);
        return NextResponse.json({ error: '비밀번호 변경 실패: ' + updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '비밀번호가 변경되었습니다.' });
}
