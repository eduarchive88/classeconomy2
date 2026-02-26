import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';

// 종목명 매핑 (DB에 stock_name 컬럼이 없으므로 코드에서 매핑)
const STOCK_NAME_MAP: Record<string, string> = {
    'AAPL': '애플 (Apple)',
    'TSLA': '테슬라 (Tesla)',
    '005930.KS': '삼성전자',
    '000660.KS': 'SK하이닉스',
    '005380.KS': '현대차',
    '035420.KS': 'NAVER',
    'BTC-USD': '비트코인 (Bitcoin)',
    'ETH-USD': '이더리움 (Ethereum)',
};

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

// 교사용 - 학급 전체 학생 투자 현황 조회 API (미실현 수익 기준 + 벌크 쿼리 최적화)
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
            return NextResponse.json({ students: [], totalStudents: 0 });
        }

        const studentIds = students.map((s: any) => s.id);

        // 모든 학생의 보유 종목 한 번에 조회 (quantity > 0)
        const { data: allInvestments } = await adminSupabase
            .from('investments')
            .select('student_id, symbol, quantity, average_price')
            .in('student_id', studentIds)
            .gt('quantity', 0);

        // 모든 학생의 투자 관련 거래 한 번에 조회 (벌크 쿼리)
        const investmentTypes = ['investment_buy', 'investment_sell', 'stock_buy', 'stock_sell', 'stock_profit', 'stock_loss'];
        const { data: allTransactions } = await adminSupabase
            .from('transactions')
            .select('student_id, amount, type')
            .in('student_id', studentIds)
            .in('type', investmentTypes);

        // 심볼별 현재가 캐시
        const priceCache: Record<string, number> = {};
        const uniqueSymbols = [...new Set((allInvestments || []).map((inv: any) => inv.symbol))];

        await Promise.all(uniqueSymbols.map(async (symbol: string) => {
            const price = await fetchCurrentPrice(symbol);
            if (price !== null) priceCache[symbol] = price;
        }));

        // 투자 관련 거래 타입
        const gainTypes = ['investment_sell', 'stock_sell', 'stock_profit'];
        const costTypes = ['investment_buy', 'stock_buy', 'stock_loss'];

        const result = [];

        for (const student of students) {
            // 해당 학생의 거래 필터링 (벌크 데이터에서)
            const studentTxs = (allTransactions || []).filter((tx: any) => tx.student_id === student.id);
            const costTxs = studentTxs.filter((tx: any) => costTypes.includes(tx.type));
            const gainTxs = studentTxs.filter((tx: any) => gainTypes.includes(tx.type));

            const totalCost = costTxs.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0);
            const totalGain = gainTxs.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount || 0), 0);
            const realizedProfit = totalGain - totalCost;

            // 미실현 수익: 현재 보유 종목의 평가 손익
            const studentInvestments = (allInvestments || []).filter((inv: any) => inv.student_id === student.id);
            let unrealizedProfit = 0;
            let currentHoldingValue = 0;
            let holdingCost = 0;

            const portfolioWithPrice = studentInvestments.map((inv: any) => {
                const currentPrice = priceCache[inv.symbol] || inv.average_price;
                const marketValue = currentPrice * inv.quantity;
                const cost = inv.average_price * inv.quantity;
                unrealizedProfit += (marketValue - cost);
                currentHoldingValue += marketValue;
                holdingCost += cost;
                return {
                    stock_name: STOCK_NAME_MAP[inv.symbol] || inv.symbol,
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

            const hasInvestment = costTxs.length > 0 || gainTxs.length > 0 || studentInvestments.length > 0;

            result.push({
                id: student.id,
                name: student.name,
                studentNumber: student.number,
                totalCost,
                totalGain,
                realizedProfit: Math.round(realizedProfit),
                unrealizedProfit: Math.round(unrealizedProfit),
                netProfit,
                profitRate,
                currentHoldingValue: Math.round(currentHoldingValue),
                portfolio: portfolioWithPrice,
                hasInvestment
            });
        }

        return NextResponse.json({ students: result, totalStudents: students.length });
    } catch (error: any) {
        console.error('Teacher investment fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
