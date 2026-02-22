import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // 1. Get Student Info for class_id
    const { data: studentData, error: studentError } = await adminSupabase
        .from('student_roster')
        .select('*')
        .eq('id', studentId)
        .single();

    if (studentError || !studentData) {
        return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    // 2. Get Market Items for Class
    const { data: marketItems, error: itemsError } = await adminSupabase
        .from('market_items')
        .select('*')
        .eq('class_id', studentData.class_id)
        .gt('stock', 0)
        .order('price', { ascending: true });

    if (itemsError) {
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    return NextResponse.json({ roster: studentData, items: marketItems || [] });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { studentId, itemId } = body;

        if (!studentId || !itemId) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const adminSupabase = createAdminClient();

        // 1. Get Student
        const { data: roster, error: rosterError } = await adminSupabase
            .from('student_roster')
            .select('*')
            .eq('id', studentId)
            .single();

        if (rosterError || !roster) throw new Error('Student not found');

        // 2. Get Item
        const { data: item, error: itemError } = await adminSupabase
            .from('market_items')
            .select('*')
            .eq('id', itemId)
            .single();

        if (itemError || !item) throw new Error('Item not found');
        if (item.stock <= 0) throw new Error('재고가 없습니다.');

        if (roster.balance < item.price) {
            return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
        }

        // 3. Deduct Balance
        await adminSupabase
            .from('student_roster')
            .update({ balance: roster.balance - item.price })
            .eq('id', studentId);

        // 4. Decrement Stock
        await adminSupabase
            .from('market_items')
            .update({ stock: item.stock - 1 })
            .eq('id', itemId);

        // 5. Log Transaction
        await adminSupabase.from('transactions').insert({
            student_id: studentId,
            amount: -item.price,
            type: 'market_purchase',
            description: `상점 구매: ${item.name}`
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
