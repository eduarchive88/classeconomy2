
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export async function POST(request: Request) {
    const { groupId, amount, description } = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rosterId } = await getStudentFromAuth(supabase, user);
    if (!rosterId) return NextResponse.json({ error: 'Student record not found' }, { status: 403 });

    // SQL RPC 함수 호출 (원자성 보장)
    const { error } = await supabase.rpc('donate_to_group', {
        p_student_id: rosterId,
        p_group_id: groupId,
        p_amount: amount,
        p_description: description || '모둠 자금 기부'
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
