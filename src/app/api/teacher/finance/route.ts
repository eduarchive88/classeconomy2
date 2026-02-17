
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentIds, amount, type, description } = await request.json();
    const supabase = createClient();

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
    const updateResults: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const studentId of studentIds) {
        try {
            // Fetch current balance
            // balance 컬럼으로 잔액 조회 (DB 스키마에 맞춤)
            const { data: roster, error: rosterError } = await supabase
                .from('student_roster')
                .select('balance, name')
                .eq('id', studentId)
                .single();

            if (rosterError || !roster) {
                console.error(`Student ${studentId} not found:`, rosterError);
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
            // balance 컬럼으로 잔액 업데이트
            const { error: updateError } = await supabase
                .from('student_roster')
                .update({ balance: newBalance })
                .eq('id', studentId);

            if (updateError) {
                console.error(`Failed to update student ${studentId}:`, updateError);
                failCount++;
                continue;
            }

            console.log(`Successfully updated student ${roster.name} (${studentId}): ${roster.balance} → ${newBalance}`);
            successCount++;

            // Prepare Transaction Log
            // Prepare Transaction Log
            transactions.push({
                student_id: studentId,
                amount: amount,
                type: type,
                description: description || (type === 'special_allowance' ? '특별 수당' : '벌금')
            });
        } catch (error: any) {
            console.error(`Error processing student ${studentId}:`, error);
            failCount++;
        }
    }

    // Insert transaction logs
    if (transactions.length > 0) {
        const { error: transactionError } = await supabase.from('transactions').insert(transactions);
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
