import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/teacher/finance/wealth?classId=xxx
// 학급 학생별 저축 총액 + 투자 원금 합계를 반환합니다.
export async function GET(request: Request) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    if (!classId) {
        return NextResponse.json({ error: 'classId required' }, { status: 400 });
    }

    // 교사 본인의 학급인지 확인
    const { data: cls } = await adminSupabase
        .from('classes')
        .select('id')
        .eq('id', classId)
        .eq('teacher_id', user.id)
        .single();

    if (!cls) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // 해당 학급 학생 ID 목록
    const { data: students } = await adminSupabase
        .from('student_roster')
        .select('id')
        .eq('class_id', classId);

    if (!students || students.length === 0) {
        return NextResponse.json({ wealth: [] });
    }

    const studentIds = students.map((s: any) => s.id);

    // 저축 총액: bank_accounts (active 계좌만)
    const { data: accounts } = await adminSupabase
        .from('bank_accounts')
        .select('student_id, amount')
        .in('student_id', studentIds)
        .eq('status', 'active');

    const savingsMap: Record<string, number> = {};
    for (const acc of accounts || []) {
        savingsMap[acc.student_id] = (savingsMap[acc.student_id] || 0) + (acc.amount || 0);
    }

    // 투자 원금: investments (보유 중인 것만, average_price × quantity)
    const { data: investments } = await adminSupabase
        .from('investments')
        .select('student_id, quantity, average_price')
        .in('student_id', studentIds)
        .gt('quantity', 0);

    const investMap: Record<string, number> = {};
    for (const inv of investments || []) {
        investMap[inv.student_id] = (investMap[inv.student_id] || 0) + (inv.quantity * inv.average_price);
    }

    const wealth = studentIds.map((id: string) => ({
        student_id: id,
        total_savings: Math.round(savingsMap[id] || 0),
        investment_cost: Math.round(investMap[id] || 0),
    }));

    return NextResponse.json({ wealth });
}
