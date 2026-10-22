import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getInvestmentPrice } from '@/utils/investment';
import { INVESTMENT_SYMBOLS, QTY_EPSILON, roundQuantity } from '@/lib/constants';

export async function POST(request: Request) {
    const { action, studentId, symbol, quantity: rawQuantity } = await request.json();
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    // 부동소수 오차 방지를 위해 소수점 6자리로 반올림
    let quantity = roundQuantity(Number(rawQuantity));

    if (!studentId || !symbol || !Number.isFinite(quantity) || quantity < QTY_EPSILON) {
        return NextResponse.json({ error: 'Invalid trade details' }, { status: 400 });
    }

    try {
        // 학급 ID 조회 (시세 조회에 필요)
        const { data: student, error: studentError } = await supabase
            .from('student_roster')
            .select('class_id')
            .eq('id', studentId)
            .single();

        if (studentError || !student) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 매도: 실제 보유량 기준으로 검증하고, '전량 매도'는 DB에 저장된 정확한 값으로 맞춤
        // (예: 보유 2.9999999999999996주에 3주 매도 요청 → RPC에서 수량 부족으로 거절되던 문제 방지)
        if (action === 'sell') {
            const { data: holdings } = await adminSupabase
                .from('investments')
                .select('quantity')
                .eq('student_id', studentId)
                .eq('symbol', symbol)
                .gt('quantity', 0);
            const held = (holdings || []).reduce((sum: number, h: any) => sum + Number(h.quantity), 0);

            if (held < QTY_EPSILON || quantity > held + QTY_EPSILON) {
                return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 });
            }
            if (Math.abs(held - quantity) <= QTY_EPSILON) {
                quantity = held;
            }
        }

        // 현재 시세 조회
        let { price: currentPrice } = await getInvestmentPrice(symbol, student.class_id);

        // 시세를 가져오지 못한 경우: 매도는 보유 평단가를 fallback으로 사용, 매수는 차단
        if (!currentPrice || currentPrice <= 0) {
            if (action === 'sell') {
                const { data: holding } = await adminSupabase
                    .from('investments')
                    .select('average_price')
                    .eq('student_id', studentId)
                    .eq('symbol', symbol)
                    .gt('quantity', 0)
                    .limit(1)
                    .single();
                currentPrice = holding?.average_price || 0;
            }
            if (!currentPrice || currentPrice <= 0) {
                return NextResponse.json({ error: '현재 시세를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
            }
        }

        const stockInfo = INVESTMENT_SYMBOLS.find(s => s.symbol === symbol);
        const stockName = stockInfo?.name || symbol;

        // DB 트랜잭션으로 원자적 처리 (RPC)
        const rpcName = action === 'buy' ? 'process_investment_buy' : 'process_investment_sell';
        if (action !== 'buy' && action !== 'sell') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const { data: result, error: rpcError } = await adminSupabase.rpc(rpcName, {
            p_student_id: studentId,
            p_symbol: symbol,
            p_quantity: quantity,
            p_price: currentPrice,
            p_stock_name: stockName,
        });

        if (rpcError) {
            console.error(`${rpcName} RPC error:`, rpcError);
            return NextResponse.json({ error: '거래 처리에 실패했습니다.' }, { status: 500 });
        }

        if (result?.error) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        // 매매 후 남은 부동소수 오차 찌꺼기(예: 2.22e-16주)는 0으로 정리
        await adminSupabase
            .from('investments')
            .update({ quantity: 0 })
            .eq('student_id', studentId)
            .eq('symbol', symbol)
            .gt('quantity', 0)
            .lt('quantity', QTY_EPSILON);

        // RPC 내부 한글 인코딩 깨짐 교정:
        // PostgreSQL 함수 안의 한글 리터럴(개, 매수, 단가, 원 등)이 ?로 깨지는 문제를
        // RPC 성공 직후 앱 레벨에서 올바른 한글 description으로 덮어씁니다.
        const actionLabel = action === 'buy' ? '매수' : '매도';
        const correctDescription = `${stockName} ${roundQuantity(quantity)}개 ${actionLabel} (단가: ${currentPrice.toLocaleString()}원)`;
        const txType = action === 'buy' ? 'investment_buy' : 'investment_sell';
        const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

        await adminSupabase
            .from('transactions')
            .update({ description: correctDescription })
            .eq('student_id', studentId)
            .in('type', [txType, action === 'buy' ? 'stock_buy' : 'stock_sell'])
            .gte('created_at', fiveSecondsAgo);

        return NextResponse.json({ success: true, message: `${action === 'buy' ? 'Bought' : 'Sold'} ${symbol}` });

    } catch (error) {
        console.error('Trade Error:', error);
        return NextResponse.json({ error: '거래 처리에 실패했습니다.' }, { status: 500 });
    }
}
