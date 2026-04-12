
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { tradeId, action } = await request.json(); // action: 'approve' | 'reject'
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createAdminClient();

    try {
        // 거래 정보 조회
        const { data: trade, error: tradeError } = await supabaseAdmin
            .from('group_seat_trades')
            .select('*, seat:seat_id(row_idx, col_idx, price), group:group_id(name, class_id)')
            .eq('id', tradeId)
            .eq('status', 'pending')
            .single();

        if (tradeError || !trade) {
            return NextResponse.json({ error: '해당 거래를 찾을 수 없거나 이미 처리되었습니다.' }, { status: 404 });
        }

        // 교사 권한 확인
        const { data: classInfo } = await supabaseAdmin
            .from('classes')
            .select('teacher_id')
            .eq('id', trade.group.class_id)
            .single();

        if (classInfo?.teacher_id !== user.id) {
            return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
        }

        if (action === 'approve') {
            // 승인: buy_group_seat RPC로 잔액 차감 + 소유권 이전 원자 처리
            const { error: buyError } = await supabaseAdmin.rpc('buy_group_seat', {
                p_group_id: trade.group_id,
                p_seat_id: trade.seat_id,
                p_price: trade.price,
                p_description: `모둠 자리 구매 승인 (${trade.seat.row_idx + 1}-${trade.seat.col_idx + 1})`
            });

            if (buyError) throw buyError;

            await supabaseAdmin
                .from('group_seat_trades')
                .update({ status: 'approved' })
                .eq('id', tradeId);

            return NextResponse.json({ success: true, message: '승인되었습니다.' });

        } else {
            // 거절: 잔액 선차감 없었으므로 환불 불필요, 상태만 변경
            await supabaseAdmin
                .from('group_seat_trades')
                .update({ status: 'rejected' })
                .eq('id', tradeId);

            return NextResponse.json({ success: true, message: '거절되었습니다.' });
        }

    } catch (error: any) {
        console.error('Group seat trade approval error:', error);
        return NextResponse.json({ error: error.message || '처리 중 오류가 발생했습니다.' }, { status: 500 });
    }
}
