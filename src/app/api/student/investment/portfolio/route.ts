import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getInvestmentPrice } from '@/utils/investment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const supabase = createClient();

    try {
        const { data: student, error: studentError } = await supabase
            .from('student_roster')
            .select('balance, class_id')
            .eq('id', studentId)
            .single();

        if (studentError || !student) throw new Error('Student not found');

        const { data: investments, error } = await supabase
            .from('investments')
            .select('*')
            .eq('student_id', studentId)
            .gt('quantity', 0);

        if (error) throw error;

        // 보유 종목별 현재 시세 가져오기 (설정 반영)
        const portfolio = await Promise.all(investments.map(async (inv: any) => {
            const { price: currentPrice } = await getInvestmentPrice(inv.symbol, student.class_id);
            const actualPrice = currentPrice || inv.average_price;

            return {
                ...inv,
                currentPrice: actualPrice,
                marketValue: actualPrice * inv.quantity,
                totalCost: inv.average_price * inv.quantity,
                profit: (actualPrice * inv.quantity) - (inv.average_price * inv.quantity),
                profitPercent: inv.average_price > 0
                    ? ((actualPrice - inv.average_price) / inv.average_price) * 100
                    : 0
            };
        }));

        return NextResponse.json({ portfolio, balance: student.balance });
    } catch (error: any) {
        console.error('Portfolio Fetch Error:', error?.message || error);
        return NextResponse.json({ error: '포트폴리오 정보를 불러오는데 실패했습니다.' }, { status: 500 });
    }
}
