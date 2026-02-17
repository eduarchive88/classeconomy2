
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();

    try {
        // 1. Fetch all students from roster who have an allowance set
        const { data: roster, error: rosterError } = await supabase
            .from('student_roster')
            .select('name, number, allowance, class_id')
            .gt('allowance', 0);

        if (rosterError) throw rosterError;
        if (!roster || roster.length === 0) {
            return NextResponse.json({ success: true, message: 'No allowances to distribute' });
        }

        // 2. Fetch all student profiles to get their UUIDs
        // We match by name and number (and optionally session_code/class if needed)
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, number')
            .eq('role', 'student');

        if (profileError) throw profileError;

        // 3. Prepare transactions
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];

        const transactions: any[] = [];

        roster.forEach(item => {
            const profile = profiles?.find(p =>
                p.name === item.name &&
                p.number?.toString() === item.number?.toString()
            );

            if (profile) {
                transactions.push({
                    to_id: profile.id,
                    amount: item.allowance,
                    type: 'weekly_salary',
                    description: `주급 지급 (${dateStr})`
                });
            }
        });

        if (transactions.length === 0) {
            return NextResponse.json({ success: true, message: 'No registered students found for distribution' });
        }

        // 4. Batch insert transactions
        const { error: insertError } = await supabase
            .from('transactions')
            .insert(transactions);

        if (insertError) throw insertError;

        return NextResponse.json({
            success: true,
            distributed_to: transactions.length,
            message: `Successfully distributed weekly salary to ${transactions.length} students`
        });

    } catch (error: any) {
        console.error('Weekly salary distribution error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
