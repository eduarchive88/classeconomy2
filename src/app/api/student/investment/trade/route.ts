
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { symbol, amount, action } = await request.json(); // amount is Quantity of stocks
    const supabase = createClient();

    // 1. Check Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Current Price
    const { data: marketData, error: marketError } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .single();

    if (marketError || !marketData) {
        return NextResponse.json({ error: 'Market data not found for ' + symbol }, { status: 404 });
    }

    const price = Number(marketData.price);
    const totalCost = price * amount;

    // 3. Process Trade
    if (action === 'buy') {
        // Check Balance
        const { data: profile } = await supabase.from('profiles').select('money').eq('id', user.id).single();
        if (!profile || profile.money < totalCost) {
            return NextResponse.json({ error: '잔액이 부족합니다.' }, { status: 400 });
        }

        // Check Asset for Average Price Calculation
        const { data: asset } = await supabase
            .from('assets')
            .select('*')
            .eq('user_id', user.id)
            .eq('symbol', symbol)
            .single();

        let newAmount = amount;
        let newAvgPrice = price;

        if (asset) {
            const currentTotalValue = asset.amount * asset.average_price;
            const newTotalValue = currentTotalValue + totalCost;
            newAmount = Number(asset.amount) + Number(amount);
            newAvgPrice = newTotalValue / newAmount;
        }

        // Transaction (Deduct Money)
        const { error: txError } = await supabase.from('transactions').insert({
            from_id: user.id, // User pays
            to_id: null, // To system/market
            amount: totalCost,
            type: 'investment_buy',
            description: `${symbol} ${amount}주 매수`
        });

        if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

        // Update Asset
        await supabase.from('assets').upsert({
            user_id: user.id,
            symbol,
            amount: newAmount,
            average_price: newAvgPrice
        }, { onConflict: 'user_id, symbol' });

    } else if (action === 'sell') {
        // Check Asset
        const { data: asset } = await supabase
            .from('assets')
            .select('*')
            .eq('user_id', user.id)
            .eq('symbol', symbol)
            .single();

        if (!asset || asset.amount < amount) {
            return NextResponse.json({ error: '보유 수량이 부족합니다.' }, { status: 400 });
        }

        // Transaction (Gain Money)
        const { error: txError } = await supabase.from('transactions').insert({
            from_id: null,
            to_id: user.id, // User gets money
            amount: totalCost,
            type: 'investment_sell',
            description: `${symbol} ${amount}주 매도`
        });

        if (txError) return NextResponse.json({ error: txError.message }, { status: 500 });

        // Update Asset
        const remaining = Number(asset.amount) - Number(amount);
        if (remaining > 0) {
            await supabase.from('assets').update({ amount: remaining }).eq('id', asset.id);
        } else {
            await supabase.from('assets').delete().eq('id', asset.id);
        }
    }

    return NextResponse.json({ success: true, price });
}
