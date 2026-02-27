
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { studentId, seatId, groupId, price, isAutoApprove } = await request.json();
    const supabase = createAdminClient();

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID is missing' }, { status: 400 });
    }

    // 1. 모둠 정보 및 설정 조회
    const { data: group, error: groupError } = await supabase
        .from('groups')
        .select('leader_id, balance, class_id')
        .eq('id', groupId)
        .single();

    if (groupError || group.leader_id !== studentId) {
        return NextResponse.json({ error: 'Only group leaders can purchase seats' }, { status: 403 });
    }

    // 2. 클래스 설정 (자동 승인 여부)
    const { data: classData } = await supabase
        .from('classes')
        .select('is_auto_group_seat')
        .eq('id', group.class_id)
        .single();

    const isAutoAllowed = classData?.is_auto_group_seat === true;

    // 3. 자리 가격 정보 확인
    const { data: seat } = await supabase
        .from('group_seats')
        .select('price')
        .eq('id', seatId)
        .single();

    if (!seat) return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
    const currentPrice = seat.price;

    if (isAutoAllowed) {
        // 4-A. 즉시 구매 처리
        const { error: buyError } = await supabase.rpc('buy_group_seat', {
            p_group_id: groupId,
            p_seat_id: seatId,
            p_price: currentPrice,
            p_description: '모둠 자리 구매 (자동 승인)'
        });
        if (buyError) return NextResponse.json({ error: buyError.message }, { status: 400 });
        return NextResponse.json({ success: true, message: '자리를 성공적으로 구매했습니다!' });
    } else {
        // 4-B. 구매 신청 생성
        if (group.balance < currentPrice) {
            return NextResponse.json({ error: 'Insufficient group balance' }, { status: 400 });
        }

        const { error: tradeError } = await supabase
            .from('group_seat_trades')
            .insert({
                class_id: group.class_id,
                group_id: groupId,
                seat_id: seatId,
                price: currentPrice,
                status: 'pending'
            });

        if (tradeError) return NextResponse.json({ error: tradeError.message }, { status: 400 });
        return NextResponse.json({ success: true, pending: true, message: '구매 요청이 접수되었습니다. 선생님의 승인을 기다려주세요.' });
    }
}
