import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';

// Yahoo Finance에서 현재가 조회
async function fetchCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
    } catch {
        return null;
    }
}

// 교사용 - 학급 전체 학생 투자 현황 조회 API (실현 + 미실현 수익 반영)
export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user || user.user_metadata?.role !== 'teacher') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const url = new URL(request.url);
        const classId = url.searchParams.get('classId');

        if (!classId) {
            return NextResponse.json({ error: 'classId is required' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 학급 소유 확인
        const { data: classData } = await adminSupabase
            .from('classes')
            .select('id')
            .eq('id', classId)
            .eq('teacher_id', user.id)
            .single();

        if (!classData) {
            return NextResponse.json({ error: 'Class not found' }, { status: 404 });
        }

        // 학급의 모든 학생 조회
        const { data: students, error: studentsError } = await adminSupabase
            .from('student_roster')
            .select('id, name, number')
            .eq('class_id', classId)
            .order('number', { ascending: true });

        if (studentsError || !students || students.length === 0) {
            console.error('Students fetch error:', studentsError);
            return NextResponse.json({ students: [] });
        }

        // 모든 학생의 보유 종목 조회
        const { data: allInvestments } = await adminSupabase
            .from('investments')
            .select('student_id, symbol, stock_name, quantity, average_price')
            .in('student_id', students.map(s => s.id))
            .gt('quantity', 0);

        // 심볼별 현재가 캐시
        const priceCache: Record<string, number> = {};
        const uniqueSymbols = [...new Set((allInvestments || []).map(inv => inv.symbol))];

        await Promise.all(uniqueSymbols.map(async (symbol) => {
            const price = await fetchCurrentPrice(symbol);
            if (price !== null) priceCache[symbol] = price;
        }));

        // 투자 관련 거래 타입
        const gainTypes = ['investment_sell', 'stock_sell', 'stock_profit'];
        const costTypes = ['investment_buy', 'stock_buy', 'stock_loss'];

        const result = [];

        for (const student of students) {
            // 매수 거래
            const { data: costTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', costTypes);

            // 매도 거래
            const { data: gainTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', gainTypes);

            const totalCost = costTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;
            const totalGain = gainTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;
            const realizedProfit = totalGain - totalCost;

            // 미실현 수익: 현재 보유 종목의 평가 손익
            const studentInvestments = (allInvestments || []).filter(inv => inv.student_id === student.id);
            let unrealizedProfit = 0;
            let currentHoldingValue = 0;
            let holdingCost = 0;

            const portfolioWithPrice = studentInvestments.map(inv => {
                const currentPrice = priceCache[inv.symbol] || inv.average_price;
                const marketValue = currentPrice * inv.quantity;
                const cost = inv.average_price * inv.quantity;
                unrealizedProfit += (marketValue - cost);
                currentHoldingValue += marketValue;
                holdingCost += cost;
                return {
                    stock_name: inv.stock_name,
                    symbol: inv.symbol,
                    quantity: inv.quantity,
                    avg_price: inv.average_price,
                    current_price: currentPrice,
                    market_value: Math.round(marketValue),
                    profit: Math.round(marketValue - cost)
                };
            });

            const netProfit = Math.round(realizedProfit + unrealizedProfit);
            const totalInvested = totalCost + holdingCost;
            const profitRate = totalInvested > 0 ? ((netProfit / totalInvested) * 100) : 0;

            const hasInvestment = (costTxs && costTxs.length > 0) || (gainTxs && gainTxs.length > 0) || studentInvestments.length > 0;

            result.push({
                id: student.id,
                name: student.name,
                studentNumber: student.number,
                totalCost,                  // 총 매수액 (실현)
                totalGain,                  // 총 매도 수익 (실현)
                realizedProfit: Math.round(realizedProfit),
                unrealizedProfit: Math.round(unrealizedProfit),
                netProfit,                  // 순수익 (실현 + 미실현)
                profitRate,                 // 수익률
                currentHoldingValue: Math.round(currentHoldingValue),
                portfolio: portfolioWithPrice,
                hasInvestment
            });
        }

        return NextResponse.json({ students: result });
    } catch (error: any) {
        console.error('Teacher investment fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
