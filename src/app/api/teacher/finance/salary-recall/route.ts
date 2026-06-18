import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/teacher/finance/salary-recall
// 선택된 학생들의 설정 주급만큼 잔액을 차감 (마이너스 허용)
export async function POST(request: Request) {
    const { studentIds } = await request.json();

    if (!studentIds || studentIds.length === 0) {
        return NextResponse.json({ error: '학생을 선택해주세요.' }, { status: 400 });
    }

    const supabase = createClient();
    const adminSupabase = createAdminClient();

    // 교사 인증
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 교사 본인 학급인지 확인
    const { data: teacherClass } = await adminSupabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user.id)
        .limit(1)
        .maybeSingle();

    if (!teacherClass) {
        return NextResponse.json({ error: 'Unauthorized: 교사 계정이 아닙니다.' }, { status: 401 });
    }

    // 학생 잔액·주급 조회 (교사 본인 학생만)
    const { data: students, error: fetchError } = await adminSupabase
        .from('student_roster')
        .select('id, name, balance, allowance')
        .in('id', studentIds)
        .eq('teacher_id', user.id);

    if (fetchError || !students?.length) {
        return NextResponse.json({ error: '학생 정보를 불러올 수 없습니다.' }, { status: 500 });
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
    const transactions: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const student of students) {
        const allowance = student.allowance || 0;
        if (allowance <= 0) continue; // 주급 0원 학생은 건너뜀

        const newBalance = (student.balance || 0) - allowance;

        const { error: updateError } = await adminSupabase
            .from('student_roster')
            .update({ balance: newBalance })
            .eq('id', student.id);

        if (updateError) {
            console.error(`[salary-recall] 잔액 차감 실패 - ${student.name}:`, updateError);
            failCount++;
            continue;
        }

        transactions.push({
            student_id: student.id,
            amount: -allowance,
            type: 'allowance_recall',
            description: `주급 1회 회수 (${dateStr})`,
        });

        successCount++;
    }

    if (transactions.length > 0) {
        const { error: insertError } = await adminSupabase
            .from('transactions')
            .insert(transactions);
        if (insertError) {
            console.error('[salary-recall] 거래 기록 삽입 실패:', insertError);
        }
    }

    return NextResponse.json({
        success: true,
        successCount,
        failCount,
        message: `${successCount}명 주급 회수 완료${failCount > 0 ? `, ${failCount}명 실패` : ''}`,
    });
}
