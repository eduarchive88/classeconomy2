import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Fetch last 50 transactions for the student
    const { data: transactions, error } = await adminSupabase
        .from('transactions')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transactions: transactions || [] });
}
