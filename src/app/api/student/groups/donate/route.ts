import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, groupId, amount, description } = await request.json();
    const supabase = createClient();

    if (!studentId) {
        return NextResponse.json({ message: '학생 ID가 누락되었습니다.' }, { status: 400 });
    }

    // SQL RPC 함수 호출 (원자성 보장)
    const { error } = await supabase.rpc('donate_to_group', {
        p_student_id: studentId,
        p_group_id: groupId,
        p_amount: amount,
        p_description: description || '모둠 자금 기부'
    });

    if (error) {
        return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
