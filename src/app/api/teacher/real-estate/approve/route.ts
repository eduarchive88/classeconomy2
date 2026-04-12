import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';

// 교사: 자리 거래 승인/거절 API
export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { tradeId, action } = await request.json(); // action: 'approve' | 'reject'

        if (!tradeId || !action || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
        }

        const supabaseAdmin = createAdminClient();

        // 거래 정보 조회
        const { data: trade, error: tradeError } = await supabaseAdmin
            .from('seat_trades')
            .select('*, seat:seat_id(*), buyer:buyer_id(*)')
            .eq('id', tradeId)
            .eq('status', 'pending')
            .single();

        if (tradeError || !trade) {
            return NextResponse.json({ error: '해당 거래를 찾을 수 없거나 이미 처리되었습니다.' }, { status: 404 });
        }

        // 교사 권한 확인 (자신의 학급 거래만 처리 가능)
        const { data: classInfo } = await supabaseAdmin
            .from('classes')
            .select('teacher_id')
            .eq('id', trade.class_id)
            .single();

        if (classInfo?.teacher_id !== user.id) {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        if (action === 'approve') {
            // ===== 승인 처리 =====
            const seat = trade.seat;
            const buyer = trade.buyer;
            const isOccupied = !!seat.student_id;

            // 0. 구매자가 기존에 보유한 자리가 있으면 판매중(student_id=null)으로 전환
            const { data: buyerPrevSeat } = await supabaseAdmin
                .from('seats')
                .select('id, row_idx, col_idx')
                .eq('student_id', buyer.id)
                .eq('class_id', trade.class_id)
                .neq('id', seat.id)
                .maybeSingle();

            if (buyerPrevSeat) {
                await supabaseAdmin.from('seats')
                    .update({ student_id: null })
                    .eq('id', buyerPrevSeat.id);
            }

            // 1. 기존 소유자가 있으면 판매 대금 지급 (85%)
            if (isOccupied) {
                const { data: seller } = await supabaseAdmin
                    .from('student_roster')
                    .select('*')
                    .eq('id', seat.student_id)
                    .single();

                if (seller) {
                    const payout = Math.floor(trade.price * 0.85);
                    const taxAmount = trade.price - payout;

                    await supabaseAdmin.from('student_roster')
                        .update({ balance: seller.balance + payout })
                        .eq('id', seat.student_id);

                    // 판매자 수익 기록
                    await supabaseAdmin.from('transactions').insert({
                        student_id: seat.student_id,
                        amount: payout,
                        type: 'real_estate_income',
                        description: `자리 판매 수익 (${seat.row_idx + 1}-${seat.col_idx + 1}) - 승인`
                    });

                    // 세금 기록
                    await supabaseAdmin.from('transactions').insert({
                        student_id: seat.student_id,
                        amount: -taxAmount,
                        type: 'tax',
                        description: `자리 판매 세금 15% (${seat.row_idx + 1}-${seat.col_idx + 1})`
                    });
                }
            }

            // 2. 자리 소유권 이전 + 가격 10% 상승
            const nextPrice = Math.floor(trade.price * 1.1) + 100;
            await supabaseAdmin.from('seats')
                .update({ student_id: buyer.id, price: nextPrice })
                .eq('id', seat.id);

            // 3. 거래 상태 승인으로 업데이트
            await supabaseAdmin.from('seat_trades')
                .update({ status: 'approved', updated_at: new Date().toISOString() })
                .eq('id', tradeId);

            // 4. 기존 pending 거래 내역을 구매 완료로 업데이트
            await supabaseAdmin.from('transactions').insert({
                student_id: buyer.id,
                amount: 0,
                type: 'real_estate_purchase',
                description: `자리 구매 승인 완료 (${seat.row_idx + 1}-${seat.col_idx + 1})`
            });

            return NextResponse.json({ success: true, message: '승인되었습니다.' });

        } else {
            // ===== 거절 처리 =====
            const seat = trade.seat;

            // 1. 구매자 현재 잔액을 직접 조회 (join 대신 명시적 조회로 안전하게)
            const { data: buyerCurrent, error: buyerFetchErr } = await supabaseAdmin
                .from('student_roster')
                .select('id, balance')
                .eq('id', trade.buyer_id)
                .single();

            if (buyerFetchErr || !buyerCurrent) {
                console.error('buyer fetch error:', buyerFetchErr);
                return NextResponse.json({ error: '구매자 정보를 찾을 수 없습니다.' }, { status: 404 });
            }

            const refundedBalance = buyerCurrent.balance + trade.price;

            // 2. 구매자에게 차감된 금액 환불
            const { error: refundError } = await supabaseAdmin
                .from('student_roster')
                .update({ balance: refundedBalance })
                .eq('id', trade.buyer_id);

            if (refundError) {
                console.error('refund error:', refundError);
                return NextResponse.json({ error: '환불 처리 중 오류가 발생했습니다.' }, { status: 500 });
            }

            // 3. 환불 거래 기록
            await supabaseAdmin.from('transactions').insert({
                student_id: trade.buyer_id,
                amount: trade.price,
                type: 'real_estate_refund',
                description: `자리 구매 거절 환불 (${seat.row_idx + 1}-${seat.col_idx + 1})`
            });

            // 4. 거래 상태 거절로 업데이트
            await supabaseAdmin.from('seat_trades')
                .update({ status: 'rejected', updated_at: new Date().toISOString() })
                .eq('id', tradeId);

            return NextResponse.json({ success: true, message: '거절되었습니다. 금액이 환불됩니다.' });
        }

    } catch (error: any) {
        console.error('Trade approval error:', error);
        return NextResponse.json({ error: error.message || '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
