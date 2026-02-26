import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

// Yahoo Finance에서 현재가 조회 (심볼별 캐시)
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

// 학급 내 투자 수익 상위 3명 조회 API (실현 + 미실현 수익 합산)
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
            .select('id, name, number')
            .eq('class_id', classId);

        if (studentsError || !students || students.length === 0) {
            console.error('Students fetch error:', studentsError);
            return NextResponse.json({ ranking: [] });
        }

        // 모든 학생의 보유 종목을 먼저 조회하여 고유 심볼 목록 추출
        const { data: allInvestments } = await adminSupabase
            .from('investments')
            .select('student_id, symbol, stock_name, quantity, average_price')
            .in('student_id', students.map(s => s.id))
            .gt('quantity', 0);

        // 심볼별 현재가 캐시 (같은 종목은 한 번만 조회)
        const priceCache: Record<string, number> = {};
        const uniqueSymbols = [...new Set((allInvestments || []).map(inv => inv.symbol))];

        await Promise.all(uniqueSymbols.map(async (symbol) => {
            const price = await fetchCurrentPrice(symbol);
            if (price !== null) priceCache[symbol] = price;
        }));

        // 투자 관련 거래 타입
        const gainTypes = ['investment_sell', 'stock_sell', 'stock_profit'];
        const costTypes = ['investment_buy', 'stock_buy', 'stock_loss'];

        const rankings = [];

        for (const student of students) {
            // 실현 수익: 매도 거래
            const { data: gainTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', gainTypes);

            // 실현 비용: 매수 거래
            const { data: costTxs } = await adminSupabase
                .from('transactions')
                .select('amount')
                .eq('student_id', student.id)
                .in('type', costTypes);

            const realizedGain = gainTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;
            const realizedCost = costTxs?.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0) || 0;
            const realizedProfit = realizedGain - realizedCost;

            // 미실현 수익: 현재 보유 종목의 평가 손익
            const studentInvestments = (allInvestments || []).filter(inv => inv.student_id === student.id);
            let unrealizedProfit = 0;

            for (const inv of studentInvestments) {
                const currentPrice = priceCache[inv.symbol] || inv.average_price;
                unrealizedProfit += (currentPrice - inv.average_price) * inv.quantity;
            }

            // 총 순수익 = 실현 수익 + 미실현 수익
            const totalNetProfit = realizedProfit + unrealizedProfit;

            // 투자 경험이 있는 학생만 순위에 포함
            const hasInvestment = (gainTxs && gainTxs.length > 0) || (costTxs && costTxs.length > 0) || studentInvestments.length > 0;

            if (hasInvestment) {
                rankings.push({
                    id: student.id,
                    name: student.name,
                    studentNumber: student.number,
                    netProfit: Math.round(totalNetProfit)
                });
            }
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
