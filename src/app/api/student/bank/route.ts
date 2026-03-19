import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    // 1. Get student info (class info for finding mates)
    const { data: student, error: studentError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info, balance, class_id')
        .eq('id', studentId)
        .single();

    if (studentError || !student) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // 2. Get classmates (for transfer target list: same session)
    const { data: classmates, error: matesError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info')
        .eq('class_id', student.class_id)
        .neq('id', studentId); // Exclude self

    // 3. Get my bank accounts (savings)
    const { data: accounts, error: accountsError } = await adminSupabase
        .from('bank_accounts')
        .select('*')
        .eq('student_id', studentId)
        .eq('status', 'active');

    // 4. Get recent transactions
    const { data: transactions, error: txError } = await adminSupabase
        .from('transactions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(20);

    return NextResponse.json({
        student,
        classmates: classmates || [],
        accounts: accounts || [],
        transactions: transactions || []
    });
}

export async function POST(request: Request) {
    const { action, studentId, targetIds, amount, accountId } = await request.json();
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    if (!studentId || !action) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check sender balance first
    const { data: sender, error: senderError } = await supabase
        .from('student_roster')
        .select('balance, name')
        .eq('id', studentId)
        .single();

    if (senderError || !sender) {
        return NextResponse.json({ error: 'Sender not found' }, { status: 404 });
    }

    if (action === 'transfer') {
        if (!targetIds || !Array.isArray(targetIds) || targetIds.length === 0 || !amount || amount <= 0) {
            return NextResponse.json({ error: 'Invalid transfer details' }, { status: 400 });
        }

        const totalAmount = amount * targetIds.length;
        if (sender.balance < totalAmount) {
            return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
        }

        // 1. Deduct from sender
        const { error: deductError } = await adminSupabase
            .from('student_roster')
            .update({ balance: sender.balance - totalAmount })
            .eq('id', studentId);

        if (deductError) return NextResponse.json({ error: 'Transfer failed (sender)' }, { status: 500 });

        // 2. Loop through each target
        let successCount = 0;
        for (const targetId of targetIds) {
            const { data: receiver } = await adminSupabase.from('student_roster').select('balance, name').eq('id', targetId).single();

            if (receiver) {
                // Log transaction for sender
                await adminSupabase.from('transactions').insert({
                    student_id: studentId,
                    type: 'transfer_sent',
                    amount: -amount,
                    description: `To: ${receiver.name}`
                });

                // Add to receiver
                await adminSupabase.from('student_roster').update({ balance: receiver.balance + amount }).eq('id', targetId);

                // Log transaction for receiver
                await adminSupabase.from('transactions').insert({
                    student_id: targetId,
                    type: 'transfer_received',
                    amount: amount,
                    description: `From: ${sender.name}`
                });

                successCount++;
            }
        }

        if (successCount === 0) {
            // Rollback if ALL failed (rare)
            await adminSupabase.from('student_roster').update({ balance: sender.balance }).eq('id', studentId);
            return NextResponse.json({ error: 'All receivers not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `${successCount}명에게 송금 완료` });

    } else if (action === 'deposit') {
        if (!amount || amount <= 0) return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
        if (sender.balance < amount) return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });

        // 1. Deduct from balance
        const { error: deductError } = await adminSupabase
            .from('student_roster')
            .update({ balance: sender.balance - amount })
            .eq('id', studentId);

        if (deductError) return NextResponse.json({ error: 'Deposit failed' }, { status: 500 });

        // 2. Create bank account (Savings)
        const lockedUntil = new Date();
        lockedUntil.setDate(lockedUntil.getDate() + 14); // 2 weeks lock

        const { error: accountError } = await adminSupabase.from('bank_accounts').insert({
            student_id: studentId,
            amount: amount,
            interest_rate: 0.01, // 1%
            locked_until: lockedUntil.toISOString(),
            status: 'active'
        });

        if (accountError) {
            // Rollback balance (simple version)
            await adminSupabase.from('student_roster').update({ balance: sender.balance }).eq('id', studentId);
            return NextResponse.json({ error: 'Deposit failed (account creation)' }, { status: 500 });
        }

        // 3. Log transaction
        await adminSupabase.from('transactions').insert({
            student_id: studentId,
            type: 'deposit',
            amount: -amount,
            description: 'Savings Deposit (2 weeks)'
        });

        return NextResponse.json({ success: true, message: 'Deposit successful' });

    } else if (action === 'withdraw') {
        if (!accountId) return NextResponse.json({ error: 'Account ID required' }, { status: 400 });

        const { data: account, error: accError } = await adminSupabase
            .from('bank_accounts')
            .select('*')
            .eq('id', accountId)
            .eq('student_id', studentId)
            .single();

        if (accError || !account) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        if (account.status !== 'active') return NextResponse.json({ error: 'Account already withdrawn' }, { status: 400 });

        const now = new Date();
        const lockedUntil = new Date(account.locked_until);

        if (now < lockedUntil) {
            return NextResponse.json({ error: `Cannot withdraw until ${lockedUntil.toLocaleDateString()}` }, { status: 400 });
        }

        // Calculate interest
        const interest = Math.floor(account.amount * account.interest_rate);
        const totalAmount = account.amount + interest;

        // 1. Update account status
        const { error: updateError } = await adminSupabase
            .from('bank_accounts')
            .update({
                status: 'withdrawn',
                withdrawn_at: now.toISOString()
            })
            .eq('id', accountId);

        if (updateError) return NextResponse.json({ error: 'Withdrawal failed' }, { status: 500 });

        // 2. Add to balance
        await adminSupabase
            .from('student_roster')
            .update({ balance: sender.balance + totalAmount })
            .eq('id', studentId);

        // 3. Log transaction
        await adminSupabase.from('transactions').insert({
            student_id: studentId,
            type: 'withdraw',
            amount: totalAmount,
            description: `Savings Withdrawal (Principal: ${account.amount}, Interest: ${interest})`
        });

        return NextResponse.json({ success: true, message: 'Withdrawal successful' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
