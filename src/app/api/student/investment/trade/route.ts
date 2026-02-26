import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// Yahoo Finance 차트 API를 직접 호출하여 현재가 조회
async function fetchCurrentPrice(symbol: string): Promise<number | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
    } catch {
        return null;
    }
}

export async function POST(request: Request) {
    const { action, studentId, symbol, quantity } = await request.json();
    const supabase = createClient();
    const adminSupabase = createAdminClient();

    if (!studentId || !symbol || !quantity || quantity <= 0) {
        return NextResponse.json({ error: 'Invalid trade details' }, { status: 400 });
    }

    try {
        // 1. 현재 시세 조회
        const currentPrice = await fetchCurrentPrice(symbol);
        if (!currentPrice) {
            return NextResponse.json({ error: '현재 시세를 불러올 수 없습니다. 잠시 후 다시 시도해주세요.' }, { status: 500 });
        }

        const totalCost = Math.floor(currentPrice * quantity); // Floor for integer currency? or allow float? Let's assume integer currency for simplicity, but price is float.
        // Assuming balance is integer, but investments can track precision.
        // Let's ceil the cost to be safe for currency.
        const cost = Math.ceil(currentPrice * quantity);

        // 2. Get Student Balance
        const { data: student, error: studentError } = await supabase
            .from('student_roster')
            .select('balance')
            .eq('id', studentId)
            .single();

        if (studentError || !student) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

        if (action === 'buy') {
            if (student.balance < cost) {
                return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
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
                description: `Bought ${quantity} ${symbol} @ ${currentPrice}`
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
                return NextResponse.json({ error: 'Insufficient quantity' }, { status: 400 });
            }

            // Calculate profit/loss for logging (optional)
            const revenue = Math.floor(currentPrice * quantity);

            // Update Investment
            const newQuantity = existing.quantity - quantity;
            if (newQuantity <= 0) {
                // Or keep with 0 quantity? Let's delete for cleanliness or keep with 0?
                // Let's delete if 0 to avoid clutter, or update to 0. 
                // Updating to 0 preserves average price history? No, average price assumes holding.
                // Let's allow partial sell.
                if (Math.abs(newQuantity) < 0.000001) { // Float safety
                    await adminSupabase.from('investments').delete().eq('id', existing.id);
                } else {
                    await adminSupabase.from('investments').update({
                        quantity: newQuantity,
                        updated_at: new Date().toISOString()
                        // Average price doesn't change on sell
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
                description: `Sold ${quantity} ${symbol} @ ${currentPrice}`
            });

            return NextResponse.json({ success: true, message: `Sold ${symbol}` });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Trade Error:', error);
        return NextResponse.json({ error: 'Trade failed' }, { status: 500 });
    }
}
