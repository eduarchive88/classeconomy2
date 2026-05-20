
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentIds, amount, type, description } = await request.json();
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    // 1. Check Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!studentIds || studentIds.length === 0 || amount <= 0) {
        return NextResponse.json({ error: 'Invalid Request' }, { status: 400 });
    }

    // 2. Process Transactions (Update Balance & Log)
    const transactions: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const studentId of studentIds) {
        try {
            // Fetch current balance
            // balance 컬럼으로 잔액 조회 (교사 본인의 학생인지 검증하기 위해 teacher_id 필터 추가)
            const { data: roster, error: rosterError } = await adminSupabase
                .from('student_roster')
                .select('balance, name')
                .eq('id', studentId)
                .eq('teacher_id', user.id)
                .single();

            if (rosterError || !roster) {
                console.error(`Student ${studentId} not found or not managed by teacher ${user.id}:`, rosterError);
                failCount++;
                continue;
            }

            let amountChange = 0;

            if (type === 'special_allowance') {
                amountChange = amount;
            } else if (type === 'fine') {
                amountChange = -amount;
            }

            const newBalance = (roster.balance || 0) + amountChange;

            // Update Balance
            // balance 컬럼으로 잔액 업데이트 (교사 본인의 학생인지 다시 한번 체크)
            const { error: updateError } = await adminSupabase
                .from('student_roster')
                .update({ balance: newBalance })
                .eq('id', studentId)
                .eq('teacher_id', user.id);

            if (updateError) {
                console.error(`Failed to update student ${studentId}:`, updateError);
                failCount++;
                continue;
            }

            console.log(`Successfully updated student ${roster.name} (${studentId}): ${roster.balance} → ${newBalance}`);
            successCount++;

            // Prepare Transaction Log
            // 벌금인 경우 마이너스 금액이 transactions에 기록되도록 -amount 적용
            transactions.push({
                student_id: studentId,
                amount: type === 'fine' ? -amount : amount,
                type: type,
                description: description || (type === 'special_allowance' ? '특별 수당' : '벌금')
            });
        } catch (error: any) {
            console.error(`Error processing student ${studentId}:`, error);
            failCount++;
        }
    }

    // Insert transaction logs using adminSupabase to bypass RLS policies safely
    if (transactions.length > 0) {
        const { error: transactionError } = await adminSupabase.from('transactions').insert(transactions);
        if (transactionError) {
            console.error('Transaction log error:', transactionError);
            return NextResponse.json({
                error: 'Failed to log transactions: ' + transactionError.message,
                successCount,
                failCount
            }, { status: 500 });
        }
    }

    return NextResponse.json({
        success: true,
        successCount,
        failCount,
        message: `${successCount}명 처리 완료${failCount > 0 ? `, ${failCount}명 실패` : ''}`
    });
}

