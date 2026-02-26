import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let rosterId: string | null = null;
        let classId: string | null = null;

        if (user) {
            const studentInfo = await getStudentFromAuth(supabase, user);
            rosterId = studentInfo.rosterId;
            classId = studentInfo.classId;
        }

        const supabaseAdmin = createAdminClient();

        if (!rosterId || !classId) {
            const headerStudentId = request.headers.get('x-student-id');
            if (headerStudentId) {
                const { data: roster } = await supabaseAdmin
                    .from('student_roster')
                    .select('id, class_id')
                    .eq('id', headerStudentId)
                    .single();

                if (roster) {
                    rosterId = roster.id;
                    classId = roster.class_id;
                }
            }
        }

        if (!rosterId || !classId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Get student roster info
        const { data: rosterData, error: rosterError } = await supabaseAdmin
            .from('student_roster')
            .select('*')
            .eq('id', rosterId)
            .single();

        if (rosterError || !rosterData) {
            return NextResponse.json({ error: 'Student not found in roster' }, { status: 404 });
        }

        // 2. Get seats for this class
        const { data: seatsData, error: seatsError } = await supabaseAdmin
            .from('seats')
            .select(`
                *,
                student:student_id(name, number)
            `)
            .eq('class_id', classId);

        if (seatsError) {
            return NextResponse.json({ error: seatsError.message }, { status: 500 });
        }

        // 3. 이 학생의 pending 거래 목록 (승인 대기 중)
        const { data: pendingTrades } = await supabaseAdmin
            .from('seat_trades')
            .select('id, seat_id, status, price, created_at')
            .eq('buyer_id', rosterId)
            .eq('status', 'pending');

        // 그리드 크기 계산 (교사 설정과 동기화)
        const allSeats = seatsData || [];
        let gridRows = 5; // 기본값
        let gridCols = 6; // 기본값
        if (allSeats.length > 0) {
            gridRows = Math.max(...allSeats.map((s: any) => s.row_idx)) + 1;
            gridCols = Math.max(...allSeats.map((s: any) => s.col_idx)) + 1;
        }

        return NextResponse.json({
            roster: rosterData,
            seats: allSeats,
            gridRows,
            gridCols,
            pendingTrades: pendingTrades || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
