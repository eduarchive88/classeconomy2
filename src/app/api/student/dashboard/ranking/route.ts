import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

// 학급 내 투자 수익 상위 3명 조회 API
export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const classId = url.searchParams.get('classId');

        if (!classId) {
            return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 같은 학급의 모든 학생 조회
        const { data: students, error: studentsError } = await adminSupabase
            .from('student_roster')
            .select('id, name, student_number')
            .eq('class_id', classId);

        if (studentsError || !students || students.length === 0) {
            return NextResponse.json({ ranking: [] });
        }

        // 각 학생의 투자 수익 합계 조회 (stock_profit, stock_loss, investment_sell 등)
        const investmentTypes = ['stock_profit', 'stock_loss', 'investment_sell'];
        const buyTypes = ['stock_buy', 'investment_buy'];

        const rankings = [];

        for (const student of students) {
            // 투자 매도 수익 합산 (investment_sell, stock_sell 타입의 양수 거래)
            const { data: sellTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', ['stock_profit', 'investment_sell', 'stock_sell']);

            // 투자 매수 비용 합산
            const { data: buyTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', ['stock_buy', 'investment_buy', 'stock_loss']);

            const totalGain = sellTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;
            const totalCost = buyTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;

            // 순수익 = 매도 수익 - 매수 비용
            const netProfit = totalGain - totalCost;

            rankings.push({
                id: student.id,
                name: student.name,
                studentNumber: student.student_number,
                netProfit
            });
        }

        // 순수익 기준 내림차순 정렬 후 상위 3명
        rankings.sort((a, b) => b.netProfit - a.netProfit);
        const top3 = rankings.slice(0, 3);

        return NextResponse.json({ ranking: top3 });
    } catch (error: any) {
        console.error('Investment ranking error:', error);
        return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
    }
}
