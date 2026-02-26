import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const supabase = createClient();

    try {
        const { data: investments, error } = await supabase
            .from('investments')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;

        // 보유 종목별 현재 시세 가져오기
        const portfolio = await Promise.all(investments.map(async (inv: any) => {
            try {
                const quote = await yahooFinance.quote(inv.symbol, {}, { timeout: 8000 });
                const currentPrice = quote.regularMarketPrice || inv.average_price;
                return {
                    ...inv,
                    currentPrice,
                    marketValue: currentPrice * inv.quantity,
                    totalCost: inv.average_price * inv.quantity,
                    profit: (currentPrice * inv.quantity) - (inv.average_price * inv.quantity),
                    profitPercent: ((currentPrice - inv.average_price) / inv.average_price) * 100
                };
            } catch (e: any) {
                console.error(`Portfolio quote error for ${inv.symbol}:`, e?.message || e);
                // 시세 조회 실패 시 평균 매수가를 현재가로 대체
                return {
                    ...inv,
                    currentPrice: inv.average_price,
                    marketValue: inv.average_price * inv.quantity,
                    totalCost: inv.average_price * inv.quantity,
                    profit: 0,
                    profitPercent: 0
                };
            }
        }));

        return NextResponse.json({ portfolio });
    } catch (error: any) {
        console.error('Portfolio Fetch Error:', error?.message || error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
