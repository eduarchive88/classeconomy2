import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET /api/teacher/logs?classId=xxx (optional)
// 교사 본인 학급의 거래 내역 조회 (admin client로 RLS 우회)
export async function GET(request: Request) {
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classIdFilter = searchParams.get('classId'); // optional

    // 교사 본인의 학급 조회
    const { data: classes } = await adminSupabase
        .from('classes')
        .select('id, name')
        .eq('teacher_id', user.id);

    if (!classes || classes.length === 0) {
        return NextResponse.json({ data: [] });
    }

    const classIds = classIdFilter
        ? classes.filter(c => c.id === classIdFilter).map(c => c.id)
        : classes.map(c => c.id);

    if (classIds.length === 0) {
        return NextResponse.json({ data: [] });
    }

    // 학생 목록
    const { data: students } = await adminSupabase
        .from('student_roster')
        .select('id, name, number, class_id')
        .in('class_id', classIds);

    if (!students || students.length === 0) {
        return NextResponse.json({ data: [] });
    }

    const studentIds = students.map(s => s.id);
    const studentMap: Record<string, { name: string; number: string; className: string }> = {};
    students.forEach((s: any) => {
        const cls = classes.find(c => c.id === s.class_id);
        studentMap[s.id] = { name: s.name, number: s.number, className: cls?.name || '' };
    });

    // 거래 내역 (admin으로 RLS 우회)
    const { data: transactions, error: txError } = await adminSupabase
        .from('transactions')
        .select('*')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
        .limit(5000);

    if (txError) {
        console.error('[logs API] 거래 내역 조회 실패:', txError);
        return NextResponse.json({ error: txError.message }, { status: 500 });
    }

    const data = (transactions || []).map((t: any) => ({
        ...t,
        student_name: studentMap[t.student_id]?.name || 'Unknown',
        student_number: studentMap[t.student_id]?.number || '',
        class_name: studentMap[t.student_id]?.className || '',
    }));

    return NextResponse.json({ data });
}
