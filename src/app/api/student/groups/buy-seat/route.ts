
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { studentId, seatId, groupId } = body;
        const supabase = createAdminClient();

        console.log('[BuySeat API] Request:', { studentId, seatId, groupId });

        if (!studentId || !seatId || !groupId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // 1. 모둠 정보 및 설정 조회
        const { data: group, error: groupError } = await supabase
            .from('groups')
            .select('leader_id, balance, class_id')
            .eq('id', groupId)
            .single();

        if (groupError) {
            console.error('[BuySeat API] Group fetch error:', groupError);
            return NextResponse.json({ error: '모둠 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        if (group.leader_id !== studentId) {
            return NextResponse.json({ error: '모둠장만 자리를 구매할 수 있습니다.' }, { status: 403 });
        }

        // 2. 클래스 설정 (자동 승인 여부)
        const { data: classData, error: classError } = await supabase
            .from('classes')
            .select('is_auto_group_seat')
            .eq('id', group.class_id)
            .single();

        if (classError) {
            console.error('[BuySeat API] Class fetch error:', classError);
        }

        const isAutoAllowed = classData?.is_auto_group_seat === true;

        // 3. 자리 가격 정보 확인
        const { data: seat, error: seatError } = await supabase
            .from('group_seats')
            .select('price')
            .eq('id', seatId)
            .single();

        if (seatError || !seat) {
            console.error('[BuySeat API] Seat fetch error:', seatError);
            return NextResponse.json({ error: '자리 정보를 찾을 수 없습니다.' }, { status: 404 });
        }

        const currentPrice = seat.price;

        if (isAutoAllowed) {
            // 4-A. 즉시 구매 처리
            console.log('[BuySeat API] Attempting immediate purchase via RPC buy_group_seat');
            const { data: rpcResult, error: buyError } = await supabase.rpc('buy_group_seat', {
                p_group_id: groupId,
                p_seat_id: seatId,
                p_price: currentPrice,
                p_description: '모둠 자리 구매 (자동 승인)'
            });

            if (buyError) {
                console.error('[BuySeat API] RPC buy_group_seat error:', buyError);
                return NextResponse.json({ error: buyError.message || '구매 처리 중 오류가 발생했습니다.' }, { status: 400 });
            }

            console.log('[BuySeat API] Purchase successful:', rpcResult);
            return NextResponse.json({ success: true, message: '자리를 성공적으로 구매했습니다!' });
        } else {
            // 4-B. 구매 신청 생성
            if (group.balance < currentPrice) {
                return NextResponse.json({ error: '모둠 자금이 부족합니다.' }, { status: 400 });
            }

            console.log('[BuySeat API] Creating trade request');
            const { error: tradeError } = await supabase
                .from('group_seat_trades')
                .insert({
                    class_id: group.class_id,
                    group_id: groupId,
                    seat_id: seatId,
                    price: currentPrice,
                    status: 'pending'
                });

            if (tradeError) {
                console.error('[BuySeat API] Trade insert error:', tradeError);
                return NextResponse.json({ error: tradeError.message || '구매 요청 생성 중 오류가 발생했습니다.' }, { status: 400 });
            }

            return NextResponse.json({ success: true, pending: true, message: '구매 요청이 접수되었습니다. 선생님의 승인을 기다려주세요.' });
        }
    } catch (error: any) {
        console.error('[BuySeat API] Unexpected error:', error);
        return NextResponse.json({ error: error.message || '서버 내부 오류가 발생했습니다.' }, { status: 500 });
    }
}
