
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { tradeId, action } = await request.json(); // action: 'approve' | 'reject'
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data: trade, error: tradeError } = await supabase
            .from('group_seat_trades')
            .select('*')
            .eq('id', tradeId)
            .single();

        if (tradeError || !trade) throw new Error('Trade not found');

        if (action === 'approve') {
            // 승인 처리 (함수 사용)
            const { error: buyError } = await supabase.rpc('buy_group_seat', {
                p_group_id: trade.group_id,
                p_seat_id: trade.seat_id,
                p_price: trade.price,
                p_description: '모둠 자리 구매 승인'
            });
            if (buyError) throw buyError;

            await supabase.from('group_seat_trades').update({ status: 'approved' }).eq('id', tradeId);
        } else {
            // 거절 처리
            await supabase.from('group_seat_trades').update({ status: 'rejected' }).eq('id', tradeId);
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
