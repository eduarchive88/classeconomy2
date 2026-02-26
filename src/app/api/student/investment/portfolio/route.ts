import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Yahoo Finance 차트 API를 직접 호출 (npm 패키지 의존 없음)
async function fetchCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            next: { revalidate: 0 }
        });

        if (!res.ok) return null;

        const data = await res.json();
        const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
        return price || null;
    } catch {
        return null;
    }
}

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
            .select('balance')
            .eq('id', studentId)
            .single();

        if (studentError) throw studentError;

        const { data: investments, error } = await supabase
            .from('investments')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;

        // 보유 종목별 현재 시세 가져오기
        const portfolio = await Promise.all(investments.map(async (inv: any) => {
            const currentPrice = await fetchCurrentPrice(inv.symbol) || inv.average_price;
            return {
                ...inv,
                currentPrice,
                marketValue: currentPrice * inv.quantity,
                totalCost: inv.average_price * inv.quantity,
                profit: (currentPrice * inv.quantity) - (inv.average_price * inv.quantity),
                profitPercent: ((currentPrice - inv.average_price) / inv.average_price) * 100
            };
        }));

        return NextResponse.json({ portfolio, balance: student.balance });
    } catch (error: any) {
        console.error('Portfolio Fetch Error:', error?.message || error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
