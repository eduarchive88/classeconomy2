
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

    // 2. Prepare Transactions
    const transactions = studentIds.map((studentId: string) => {
        if (type === 'special_allowance') {
            return {
                from_id: null, // System money
                to_id: studentId,
                amount: amount,
                type: 'special_allowance',
                description: description || '특별 수당'
            };
        } else if (type === 'fine') {
            return {
                from_id: studentId,
                to_id: null, // Money burnt (or could go to teacher: user.id)
                amount: amount,
                type: 'fine',
                description: description || '벌금'
            };
        }
    }).filter(Boolean);

    // 3. Insert Batch
    const { error } = await supabase.from('transactions').insert(transactions);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
