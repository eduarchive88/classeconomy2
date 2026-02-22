import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/admin';

export async function POST(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { seatId } = await request.json();

        if (!seatId) {
            return NextResponse.json({ error: 'Seat ID is required' }, { status: 400 });
        }

        // 1. Get buyer info
        const { data: buyer, error: buyerError } = await supabaseAdmin
            .from('student_roster')
            .select('*')
            .eq('profile_id', user.id)
            .single();

        if (buyerError || !buyer) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        // 2. Get seat info
        const { data: seat, error: seatError } = await supabaseAdmin
            .from('seats')
            .select('*')
            .eq('id', seatId)
            .single();

        if (seatError || !seat) {
            return NextResponse.json({ error: 'Seat not found' }, { status: 404 });
        }

        // 3. Validations
        if (seat.student_id === buyer.id) {
            return NextResponse.json({ error: '이미 본인의 자리입니다.' }, { status: 400 });
        }

        if (buyer.balance < seat.price) {
            return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
        }

        const isOccupied = !!seat.student_id;

        // Use RPC or admin transactions to be secure, but for now we'll do sequential updates
        // Since Supabase REST doesn't have true transactions without RPC, we'll do our best with admin

        // 4. Deduct from buyer
        const { error: deductError } = await supabaseAdmin.from('student_roster')
            .update({ balance: buyer.balance - seat.price })
            .eq('id', buyer.id);

        if (deductError) throw deductError;

        // 5. Pay seller if occupied
        if (isOccupied) {
            const { data: seller } = await supabaseAdmin.from('student_roster').select('*').eq('id', seat.student_id).single();
            if (seller) {
                const payout = Math.floor(seat.price * 0.85);

                await supabaseAdmin.from('student_roster')
                    .update({ balance: seller.balance + payout })
                    .eq('id', seat.student_id);

                // Log for seller
                await supabaseAdmin.from('transactions').insert({
                    student_id: seat.student_id,
                    amount: payout,
                    type: 'real_estate_income',
                    description: `자리 판매 수익 (${seat.row_idx + 1}-${seat.col_idx + 1})`
                });

                // Log Tax
                const taxAmount = seat.price - payout;
                await supabaseAdmin.from('transactions').insert({
                    student_id: seat.student_id,
                    amount: -taxAmount,
                    type: 'tax',
                    description: `자리 판매 세금 (15%)`
                });
            }
        }

        // 6. Update Seat (New Owner, Price Increase)
        const nextPrice = Math.floor(seat.price * 1.1) + 100;

        const { error: updateSeatError } = await supabaseAdmin.from('seats')
            .update({
                student_id: buyer.id,
                price: nextPrice
            })
            .eq('id', seat.id);

        if (updateSeatError) throw updateSeatError;

        // 7. Log for buyer
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
