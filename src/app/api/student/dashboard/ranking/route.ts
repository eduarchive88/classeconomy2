import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

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

// 학급 내 투자 수익 상위 3명 조회 API (미실현 수익 = 포트폴리오 평가 손익 기준)
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
            return NextResponse.json({ ranking: [] });
        }

        // 모든 학생의 보유 종목 한 번에 조회 (quantity > 0인 것만)
        const studentIds = students.map((s: any) => s.id);
        const { data: allInvestments } = await adminSupabase
            .from('investments')
            .select('student_id, symbol, quantity, average_price')
            .in('student_id', studentIds)
            .gt('quantity', 0);

        if (!allInvestments || allInvestments.length === 0) {
            return NextResponse.json({ ranking: [] });
        }

        // 심볼별 현재가 캐시 (같은 종목은 한 번만 조회)
        const priceCache: Record<string, number> = {};
        const uniqueSymbols = [...new Set(allInvestments.map((inv: any) => inv.symbol))];

        await Promise.all(uniqueSymbols.map(async (symbol: string) => {
            const price = await fetchCurrentPrice(symbol);
            if (price !== null) priceCache[symbol] = price;
        }));

        // 학생별 미실현 수익(포트폴리오 평가 손익) 계산
        const rankings: { id: string; name: string; studentNumber: number; netProfit: number }[] = [];

        for (const student of students) {
            const studentInvestments = allInvestments.filter((inv: any) => inv.student_id === student.id);

            if (studentInvestments.length === 0) continue;

            // 미실현 수익 = (현재가 - 평단가) * 보유량 의 합
            let unrealizedProfit = 0;
            for (const inv of studentInvestments) {
                const currentPrice = priceCache[inv.symbol] || inv.average_price;
                unrealizedProfit += (currentPrice - inv.average_price) * inv.quantity;
            }

            rankings.push({
                id: student.id,
                name: student.name,
                studentNumber: student.number,
                netProfit: Math.round(unrealizedProfit)
            });
        }

        // 미실현 수익 기준 내림차순 정렬 후 상위 3명
        rankings.sort((a, b) => b.netProfit - a.netProfit);
        const top3 = rankings.slice(0, 3);

        return NextResponse.json({ ranking: top3 });
    } catch (error: any) {
        console.error('Investment ranking error:', error);
        return NextResponse.json({ error: 'Failed to fetch ranking' }, { status: 500 });
    }
}
