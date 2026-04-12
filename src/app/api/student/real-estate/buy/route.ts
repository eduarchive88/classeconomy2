import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        const { seatId } = await request.json();

        if (!seatId) {
            return NextResponse.json({ error: 'Seat ID is required' }, { status: 400 });
        }

        let rosterId: string | null = null;
        let classId: string | null = null;

        if (user) {
            const studentInfo = await getStudentFromAuth(supabase, user);
            rosterId = studentInfo.rosterId;
            classId = studentInfo.classId;
        }

        const supabaseAdmin = createAdminClient();

        if (!rosterId || !classId) {
            const headerStudentId = request.headers.get('x-student-id');
            if (headerStudentId) {
                const { data: roster } = await supabaseAdmin
                    .from('student_roster')
                    .select('id, class_id')
                    .eq('id', headerStudentId)
                    .single();

                if (roster) {
                    rosterId = roster.id;
                    classId = roster.class_id;
                }
            }
        }

        if (!rosterId || !classId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. 구매자 정보 조회
        const { data: buyer, error: buyerError } = await supabaseAdmin
            .from('student_roster')
            .select('*')
            .eq('id', rosterId)
            .single();

        if (buyerError || !buyer) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. 자리 정보 조회
        const { data: seat, error: seatError } = await supabaseAdmin
            .from('seats')
            .select('*')
            .eq('id', seatId)
            .single();

        if (seatError || !seat) {
            return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
        }

        // 3. 잠긴 자리 체크
        if (seat.is_locked) {
            return NextResponse.json({ error: '이 자리는 구매할 수 없습니다.' }, { status: 400 });
        }

        // 4. 유효성 검증
        if (seat.student_id === buyer.id) {
            return NextResponse.json({ error: '이미 본인의 자리입니다.' }, { status: 400 });
        }

        if (buyer.balance < seat.price) {
            return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
        }

        // 5. 즉시 구매 허용 여부 확인
        const { data: classData, error: classConfigError } = await supabaseAdmin
            .from('classes')
            .select('is_auto_real_estate')
            .eq('id', classId)
            .maybeSingle();

        if (classConfigError) {
            console.error('Class config fetch error:', classConfigError);
        }

        // 즉시 구매 허용 여부 확인 (캐시 방지를 위해 DB에서 직접 확인 권장하나 현재 구조 유지하며 검증 강화)
        const isAutoAllowed = classData?.is_auto_real_estate === true;

        // 즉시 구매 비허용인 경우 → pending 요청으로 전환 (잔액 선만 후 승인 대기)
        if (!isAutoAllowed) {
            try {
                const { error: tradeError } = await supabaseAdmin
                    .from('seat_trades')
                    .insert({
                        class_id: classId,
                        seat_id: seat.id,
                        buyer_id: rosterId,
                        seller_id: seat.student_id || null,
                        price: seat.price,
                        status: 'pending'
                    });

                if (tradeError) {
                    console.error('Trade insert error:', tradeError);

                    // 만약 동일한 자리에 대해 이미 대기 중인 요청이 있다면?
                    if (tradeError.code === '23505') { // unique violation
                        return NextResponse.json({ error: '이미 해당 자리에 대한 구매 요청이 진행 중입니다.' }, { status: 400 });
                    }

                    return NextResponse.json({ error: '구매 요청 중 오류가 발생했습니다. 선생님께 문의해주세요.' }, { status: 500 });
                }

                // 잔액 선차감 (승인 대기 중 쇜다음을 막기 위해)
                const { error: deductError } = await supabaseAdmin
                    .from('student_roster')
                    .update({ balance: buyer.balance - seat.price })
                    .eq('id', rosterId!);

                if (deductError) {
                    console.error('Deduct error after pending insert:', deductError);
                    // 차감 실패 시 트레이드 실행 취소
                    await supabaseAdmin.from('seat_trades').delete().eq('buyer_id', rosterId!).eq('seat_id', seat.id).eq('status', 'pending');
                    return NextResponse.json({ error: '잔액 차감 중 오류가 발생했습니다.' }, { status: 500 });
                }

                // 거래 기록
                await supabaseAdmin.from('transactions').insert({
                    student_id: rosterId,
                    amount: -seat.price,
                    type: 'real_estate_pending',
                    description: `자리 구매 승인 대기 (${seat.row_idx + 1}-${seat.col_idx + 1})`
                });

                return NextResponse.json({
                    success: true,
                    pending: true,
                    message: '구매 요청이 접수되었습니다. 선생님의 승인을 기다려주세요.'
                });
            } catch (e: any) {
                console.error('seat_trades fallback error:', e);
                return NextResponse.json({ error: '구매 요청 중 서버 오류가 발생했습니다.' }, { status: 500 });
            }
        }

        // === 즉시 구매 로직 ===
        const isOccupied = !!seat.student_id;

        // 5-1. 구매자의 기존 자리 전부 판매중(student_id=null)으로 전환 (새 자리 제외)
        await supabaseAdmin.from('seats')
            .update({ student_id: null })
            .eq('student_id', buyer.id)
            .eq('class_id', classId)
            .neq('id', seat.id);

        // 6. 구매자 잔액 차감
        const { error: deductError } = await supabaseAdmin.from('student_roster')
            .update({ balance: buyer.balance - seat.price })
            .eq('id', buyer.id);

        if (deductError) throw deductError;

        // 7. 기존 소유자가 있으면 판매 대금 지급
        if (isOccupied) {
            const { data: seller } = await supabaseAdmin.from('student_roster').select('*').eq('id', seat.student_id).single();
            if (seller) {
                const payout = Math.floor(seat.price * 0.85);

                await supabaseAdmin.from('student_roster')
                    .update({ balance: seller.balance + payout })
                    .eq('id', seat.student_id);

                // 판매자 거래 기록
                await supabaseAdmin.from('transactions').insert({
                    student_id: seat.student_id,
                    amount: payout,
                    type: 'real_estate_income',
                    description: `자리 판매 수익 (${seat.row_idx + 1}-${seat.col_idx + 1})`
                });

                const taxAmount = seat.price - payout;
                await supabaseAdmin.from('transactions').insert({
                    student_id: seat.student_id,
                    amount: -taxAmount,
                    type: 'tax',
                    description: `자리 판매 세금 (15%)`
                });
            }
        }

        // 8. 자리 소유권 업데이트 + 가격 인상
        const nextPrice = Math.floor(seat.price * 1.1) + 100;

        const { error: updateSeatError } = await supabaseAdmin.from('seats')
            .update({
                student_id: buyer.id,
                price: nextPrice
            })
            .eq('id', seat.id);

        if (updateSeatError) throw updateSeatError;

        // 9. 구매자 거래 기록
        await supabaseAdmin.from('transactions').insert({
            student_id: buyer.id,
            amount: -seat.price,
            type: 'real_estate_purchase',
            description: `자리 구매 (${seat.row_idx + 1}-${seat.col_idx + 1})`
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Seat purchase error:', error);
        return NextResponse.json({ error: error.message || '구매 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
