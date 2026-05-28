import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getInvestmentPrice } from '@/utils/investment';
import { INVESTMENT_SYMBOLS } from '@/lib/constants';

export async function POST(request: Request) {
    const { action, studentId, symbol, quantity } = await request.json();
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    if (!studentId || !symbol || !quantity || quantity <= 0) {
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

        // 현재 시세 조회
        const { price: currentPrice } = await getInvestmentPrice(symbol, student.class_id);
        if (!currentPrice || currentPrice <= 0) {
            return NextResponse.json({ error: '현재 시세를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
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

        // RPC 내부 한글 인코딩 깨짐 교정:
        // PostgreSQL 함수 안의 한글 리터럴(개, 매수, 단가, 원 등)이 ?로 깨지는 문제를
        // RPC 성공 직후 앱 레벨에서 올바른 한글 description으로 덮어씁니다.
        const actionLabel = action === 'buy' ? '매수' : '매도';
        const correctDescription = `${stockName} ${quantity}개 ${actionLabel} (단가: ${currentPrice.toLocaleString()}원)`;
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
