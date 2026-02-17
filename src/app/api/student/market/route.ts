
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export async function GET(request: Request) {
    const supabase = createClient();

    // 1. Auth & Student Context
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rosterId, classId } = await getStudentFromAuth(supabase, user);
    if (!classId) return NextResponse.json({ error: 'Student class not found' }, { status: 404 });

    // 2. Fetch Market Items
    const { data: items } = await supabase
        .from('market_items')
        .select('*')
        .eq('class_id', classId)
        .order('price', { ascending: true });

    // 3. Fetch Student Inventory (optional, to show owned count?)
    // For now, just return items.

    return NextResponse.json({ items: items || [] });
}

export async function POST(request: Request) {
    const { itemId, quantity = 1 } = await request.json();
    const supabase = createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { rosterId } = await getStudentFromAuth(supabase, user);
    if (!rosterId) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // 2. Fetch Item & Student Balance
    const { data: item } = await supabase.from('market_items').select('*').eq('id', itemId).single();
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

    const { data: student } = await supabase.from('student_roster').select('balance').eq('id', rosterId).single();
    if (!student) return NextResponse.json({ error: 'Student record error' }, { status: 500 });

    // 3. Validate
    const totalCost = item.price * quantity;
    if ((student.balance || 0) < totalCost) {
        return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
    }

    if (item.stock !== -1 && item.stock < quantity) {
        return NextResponse.json({ error: '재고가 부족합니다.' }, { status: 400 });
    }

    // 4. Execute Transaction (Ideally in a transaction block, but Supabase HTTP limit)
    // 4.1 Deduct Balance
    const newBalance = (student.balance || 0) - totalCost;

    await supabase.from('transactions').insert({
        student_id: rosterId,
        amount: -totalCost, // Negative for expense
        type: 'purchase',
        description: `마켓 구매: ${item.name}`
    });

    await supabase.from('student_roster').update({ balance: newBalance }).eq('id', rosterId);

    // 4.2 Update Stock
    if (item.stock !== -1) {
        await supabase.from('market_items').update({ stock: item.stock - quantity }).eq('id', itemId);
    }

    // 4.3 Add to Inventory
    // Check if we already have this item? Or just add new row?
    // User might want "stacking".
    // Let's check existing inventory for this item.
    const { data: existingInv } = await supabase
        .from('student_inventory')
        .select('id, quantity')
        .eq('student_id', rosterId)
        .eq('item_id', itemId)
        .maybeSingle();

    if (existingInv) {
        await supabase.from('student_inventory')
            .update({ quantity: existingInv.quantity + quantity })
            .eq('id', existingInv.id);
    } else {
        await supabase.from('student_inventory').insert({
            student_id: rosterId,
            item_id: itemId,
            quantity: quantity
        });
    }

    return NextResponse.json({ success: true, balance: newBalance });
}
