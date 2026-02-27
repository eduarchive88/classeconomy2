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

        // 1. 현재 시세 조회 (설정 반영)
        const { price: currentPrice } = await getInvestmentPrice(symbol, student.class_id);
        if (!currentPrice || currentPrice <= 0) {
            return NextResponse.json({ error: '현재 시세를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
        }

        const cost = Math.ceil(currentPrice * quantity);

        // 한글 종목명 매핑
        const stockInfo = INVESTMENT_SYMBOLS.find(s => s.symbol === symbol);
        const stockName = stockInfo?.name || symbol;

        if (action === 'buy') {
            if (student.balance < cost) {
                return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
            }

            // Deduct Balance
            await adminSupabase.from('student_roster').update({ balance: student.balance - cost }).eq('id', studentId);

            // Fetch existing investment
            const { data: existing } = await supabase
                .from('investments')
                .select('*')
                .eq('student_id', studentId)
                .eq('symbol', symbol)
                .single();

            if (existing) {
                // Update average price
                const newTotalQuantity = existing.quantity + quantity;
                const newAveragePrice = ((existing.average_price * existing.quantity) + (currentPrice * quantity)) / newTotalQuantity;

                await adminSupabase.from('investments').update({
                    quantity: newTotalQuantity,
                    average_price: newAveragePrice,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            } else {
                // Insert new
                await adminSupabase.from('investments').insert({
                    student_id: studentId,
                    symbol: symbol,
                    quantity: quantity,
                    average_price: currentPrice
                });
            }

            // Log Transaction
            await adminSupabase.from('transactions').insert({
                student_id: studentId,
                type: 'investment_buy',
                amount: -cost,
                description: `${stockName} ${quantity}개 매수 (단가: ${Math.floor(currentPrice).toLocaleString()}원)`
            });

            return NextResponse.json({ success: true, message: `Bought ${symbol}` });

        } else if (action === 'sell') {
            // Check possession
            const { data: existing } = await supabase
                .from('investments')
                .select('*')
                .eq('student_id', studentId)
                .eq('symbol', symbol)
                .single();

            if (!existing || existing.quantity < quantity) {
                return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 });
            }

            const revenue = Math.floor(currentPrice * quantity);

            // Update Investment
            const newQuantity = existing.quantity - quantity;
            if (newQuantity <= 0) {
                if (Math.abs(newQuantity) < 0.000001) {
                    await adminSupabase.from('investments').delete().eq('id', existing.id);
                } else {
                    await adminSupabase.from('investments').update({
                        quantity: 0,
                        updated_at: new Date().toISOString()
                    }).eq('id', existing.id);
                }
            } else {
                await adminSupabase.from('investments').update({
                    quantity: newQuantity,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            }

            // Add Balance
            await adminSupabase.from('student_roster').update({ balance: student.balance + revenue }).eq('id', studentId);

            // Log Transaction
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
