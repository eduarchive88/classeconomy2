
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
    const updates: Promise<any>[] = [];

    for (const studentId of studentIds) {
        // Fetch current balance
        const { data: roster, error: rosterError } = await supabase
            .from('student_roster')
            .select('currency')
            .eq('id', studentId)
            .single();

        if (rosterError || !roster) continue;

        let amountChange = 0;
        let fromId: string | null = null;
        let toId: string | null = null;

        if (type === 'special_allowance') {
            amountChange = amount;
            // from_id is null (System)
            // to_id is linked to student_id (Roster ID)
        } else if (type === 'fine') {
            amountChange = -amount;
            // from_id is student (Roster ID)
            // to_id is null (System)
        }

        // Update Balance
        updates.push(
            supabase
                .from('student_roster')
                .update({ currency: (roster.currency || 0) + amountChange })
                .eq('id', studentId)
        );

        // Prepare Transaction Log
        transactions.push({
            student_id: studentId, // Link to Roster ID
            from_id: type === 'fine' ? null : null, // Original system used auth.uid, here we just use null for system or maybe teacher id? Let's use null for now. 
            // Better: linking `student_id` is enough. `to_id` / `from_id` are for User Profiles.
            // If student has a user profile, we could try to find it, but requirement says "even if not logged in".
            // So we rely on `student_id` column.
            amount: amount,
            type: type,
            description: description || (type === 'special_allowance' ? '특별 수당' : '벌금')
        });
    }

    await Promise.all(updates);
    const { error } = await supabase.from('transactions').insert(transactions);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
