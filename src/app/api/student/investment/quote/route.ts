import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getInvestmentPrice } from '@/utils/investment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const studentId = searchParams.get('studentId'); // 학생 ID 추가 수용

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const supabase = createClient();

    try {
        let classId = null;

        // 1. studentId가 제공된 경우 학급 ID 조회
        if (studentId) {
            const { data: student } = await supabase
                .from('student_roster')
                .select('class_id')
                .eq('id', studentId)
                .single();
            classId = student?.class_id;
        }

        // 2. studentId가 없는 경우 현재 세션에서 학급 ID 시도
        if (!classId) {
            const { data: { user } } = await supabase.auth.getUser();
            classId = user?.user_metadata?.class_id;
        }

        // 3. 설정에 따른 가격 조회
        if (!classId) {
            // 학급 정보를 알 수 없는 경우 실시간 가격 반환 (기본값)
            const liveRes = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            const liveData = await liveRes.json();
            const meta = liveData?.chart?.result?.[0]?.meta;
            let price = meta?.regularMarketPrice || 0;

            // 미국 주식 등 달러 기준인 경우 한화로 변환 (간이 환율 1350원 적용)
            if (price && meta?.currency === 'USD') {
                price = Math.round(price * 1350);
            }

            return NextResponse.json({
                symbol,
                price,
                change: 0,
                changePercent: 0,
                name: symbol,
                isError: false
            });
        }

        const { price, mode } = await getInvestmentPrice(symbol, classId);

        return NextResponse.json({
            symbol,
            price,
            change: 0, // 스냅샷 모드에서는 고정가이므로 변동 폭 0으로 처리 가능
            changePercent: 0,
            name: symbol,
            mode,
            isError: false
        });
    } catch (error: any) {
        console.error(`Quote error for ${symbol}:`, error?.message || error);
        return NextResponse.json({
            symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            name: symbol,
            isError: true
        });
    }
}
