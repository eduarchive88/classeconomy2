
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();

    try {
        // 1. Check Auth
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Get Teacher's Classes
        const { data: classes } = await supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', user.id);

        if (!classes || classes.length === 0) {
            return NextResponse.json({ error: 'No classes found' }, { status: 404 });
        }

        const classIds = classes.map(c => c.id);

        // 3. Get All Students in those classes
        const { data: students } = await supabase
            .from('student_roster')
            .select('id, name, class_id')
            .in('class_id', classIds);

        if (!students || students.length === 0) {
            return NextResponse.json({ error: 'No students found' }, { status: 404 });
        }

        const studentIds = students.map(s => s.id);
        const studentMap = students.reduce((acc, s) => {
            acc[s.id] = { name: s.name, className: classes.find(c => c.id === s.class_id)?.name };
            return acc;
        }, {} as Record<string, { name: string, className: string }>);

        // 4. Get All Transactions
        const { data: transactions } = await supabase
            .from('transactions')
            .select('*')
            .in('student_id', studentIds)
            .order('created_at', { ascending: false });

        if (!transactions) {
            return NextResponse.json({ data: [] });
        }

        // 5. Format Data for CSV
        const csvData = transactions.map(t => ({
            created_at: new Date(t.created_at).toLocaleString('ko-KR'),
            class_name: studentMap[t.student_id]?.className || 'Unknown',
            student_name: studentMap[t.student_id]?.name || 'Unknown',
            type: t.type,
            amount: t.amount,
            description: t.description
        }));

        return NextResponse.json({ data: csvData });

    } catch (error) {
        console.error('Export Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
