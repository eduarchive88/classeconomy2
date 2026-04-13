import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// GET: 학급 전체 학생의 저축 현황 조회 (데이터 이전 검증 및 현황 파악용)
export async function GET(request: Request) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata?.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    if (!classId) {
        return NextResponse.json({ error: 'classId is required' }, { status: 400 });
    }

    // 교사 소유 학급인지 확인
    const { data: cls } = await supabase
        .from('classes')
        .select('id')
        .eq('id', classId)
        .eq('teacher_id', user.id)
        .single();

    if (!cls) {
        return NextResponse.json({ error: 'Class not found or unauthorized' }, { status: 403 });
    }

    // 학급 학생 목록
    const { data: students } = await adminSupabase
        .from('student_roster')
        .select('id, name, number')
        .eq('class_id', classId)
        .order('number', { ascending: true });

    if (!students || students.length === 0) {
        return NextResponse.json({ students: [] });
    }

    const studentIds = students.map((s: any) => s.id);

    // 전체 저축 계좌 조회 (active + withdrawn 모두)
    const { data: accounts } = await adminSupabase
        .from('bank_accounts')
        .select('*')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

    // 학생별로 저축 정보 집계
    const result = students.map((s: any) => {
        const studentAccounts = (accounts || []).filter((a: any) => a.student_id === s.id);
        const activeAccounts = studentAccounts.filter((a: any) => a.status === 'active');
        const totalSavings = activeAccounts.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);

        return {
            student_id: s.id,
            name: s.name,
            number: s.number,
            totalSavings,
            activeAccountCount: activeAccounts.length,
            totalAccountCount: studentAccounts.length,
            accounts: studentAccounts.map((a: any) => ({
                id: a.id,
                amount: a.amount,
                interest_rate: a.interest_rate,
                status: a.status,
                locked_until: a.locked_until,
                created_at: a.created_at,
                withdrawn_at: a.withdrawn_at,
            }))
        };
    });

    return NextResponse.json({ students: result });
}

// POST: 교사가 학생의 저축 계좌를 수동으로 추가 (데이터 이전 누락 수정용)
export async function POST(request: Request) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata?.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { studentId, amount, lockedUntil, interestRate, deductBalance } = body;

    if (!studentId || !amount || amount <= 0) {
        return NextResponse.json({ error: 'studentId와 amount(양수)가 필요합니다.' }, { status: 400 });
    }

    // 교사 소유 학생인지 확인
    const { data: student } = await supabase
        .from('student_roster')
        .select('id, name, balance, class_id')
        .eq('id', studentId)
        .single();

    if (!student) {
        return NextResponse.json({ error: '학생을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 해당 학급이 이 선생님 소유인지 확인
    const { data: cls } = await supabase
        .from('classes')
        .select('id')
        .eq('id', student.class_id)
        .eq('teacher_id', user.id)
        .single();

    if (!cls) {
        return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
    }

    const lockDate = lockedUntil
        ? new Date(lockedUntil)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 기본 2주 후

    const { error: insertError } = await adminSupabase
        .from('bank_accounts')
        .insert({
            student_id: studentId,
            amount: amount,
            interest_rate: interestRate ?? 0.01,
            locked_until: lockDate.toISOString(),
            status: 'active',
        });

    if (insertError) {
        return NextResponse.json({ error: '저축 계좌 생성 실패: ' + insertError.message }, { status: 500 });
    }

    // 잔액에서 차감 (이전 데이터 복원이 아닌 신규 가입인 경우에만 필요)
    // 이전 데이터 복원 시에는 이미 잔액에서 차감됐으므로 deductBalance=false로 호출 가능
    if (deductBalance !== false) {
        await adminSupabase
            .from('student_roster')
            .update({ balance: (student.balance || 0) - amount })
            .eq('id', studentId);

        await adminSupabase.from('transactions').insert({
            student_id: studentId,
            type: 'deposit',
            amount: -amount,
            description: '교사 수동 저축 등록',
        });
    }

    return NextResponse.json({ success: true, message: `${student.name} 학생의 저축 계좌가 등록되었습니다.` });
}
