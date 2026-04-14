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
        // 0. 학생의 학급 ID 조회
        const { data: student, error: studentError } = await supabase
            .from('student_roster')
            .select('balance, class_id')
            .eq('id', studentId)
            .single();

        if (studentError || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        // 1. 현재 시세 조회
        const { price: currentPrice } = await getInvestmentPrice(symbol, student.class_id);
        if (!currentPrice || currentPrice <= 0) {
            return NextResponse.json({ error: '현재 시세를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
        }

        const cost = Math.ceil(currentPrice * quantity);
        const stockInfo = INVESTMENT_SYMBOLS.find(s => s.symbol === symbol);
        const stockName = stockInfo?.name || symbol;

        // 2. 해당 종목의 모든 보유 행 조회 (중복 행 대응)
        const { data: rows } = await adminSupabase
            .from('investments')
            .select('*')
            .eq('student_id', studentId)
            .eq('symbol', symbol)
            .gt('quantity', 0);

        // 중복 행을 하나로 합산 (가중평균 평단가)
        const totalQuantity = (rows || []).reduce((s: number, r: any) => s + r.quantity, 0);
        const weightedAvgPrice = totalQuantity > 0
            ? (rows || []).reduce((s: number, r: any) => s + r.average_price * r.quantity, 0) / totalQuantity
            : 0;

        // 중복 정리 헬퍼: 첫 번째 행만 남기고 나머지 삭제
        const consolidate = async (newQty: number, newAvg: number) => {
            if (!rows || rows.length === 0) return;
            const keeper = rows[0];
            const extras = rows.slice(1).map((r: any) => r.id);

            if (extras.length > 0) {
                await adminSupabase.from('investments').delete().in('id', extras);
            }

            if (newQty <= 0) {
                await adminSupabase.from('investments').delete().eq('id', keeper.id);
            } else {
                await adminSupabase.from('investments').update({
                    quantity: newQty,
                    average_price: newAvg,
                    updated_at: new Date().toISOString()
                }).eq('id', keeper.id);
            }
        };

        if (action === 'buy') {
            if (student.balance < cost) {
                return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
            }

            // 잔액 차감
            await adminSupabase.from('student_roster')
                .update({ balance: student.balance - cost })
                .eq('id', studentId);

            const newTotalQty = totalQuantity + quantity;
            const newAvgPrice = totalQuantity > 0
                ? (weightedAvgPrice * totalQuantity + currentPrice * quantity) / newTotalQty
                : currentPrice;

            if (rows && rows.length > 0) {
                // 기존 행 있으면 통합 업데이트
                await consolidate(newTotalQty, newAvgPrice);
            } else {
                // 없으면 새 행 생성
                await adminSupabase.from('investments').insert({
                    student_id: studentId,
                    symbol,
                    quantity,
                    average_price: currentPrice
                });
            }

            await adminSupabase.from('transactions').insert({
                student_id: studentId,
                type: 'investment_buy',
                amount: -cost,
                description: `${stockName} ${quantity}개 매수 (단가: ${Math.floor(currentPrice).toLocaleString()}원)`
            });

            return NextResponse.json({ success: true, message: `Bought ${symbol}` });

        } else if (action === 'sell') {
            if (totalQuantity <= 0 || totalQuantity < quantity) {
                return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 });
            }

            const revenue = Math.floor(currentPrice * quantity);
            const newQty = totalQuantity - quantity;

            // 중복 행 정리하면서 수량 업데이트
            await consolidate(newQty, weightedAvgPrice);

            // 잔액 추가
            await adminSupabase.from('student_roster')
                .update({ balance: student.balance + revenue })
                .eq('id', studentId);

            await adminSupabase.from('transactions').insert({
                student_id: studentId,
                type: 'investment_sell',
                amount: revenue,
                description: `${stockName} ${quantity}개 매도 (단가: ${Math.floor(currentPrice).toLocaleString()}원)`
            });

            return NextResponse.json({ success: true, message: `Sold ${symbol}` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Trade Error:', error);
        return NextResponse.json({ error: '거래 처리에 실패했습니다.' }, { status: 500 });
    }
}
