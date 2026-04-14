import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { INVESTMENT_SYMBOLS } from '@/lib/constants';
import { fetchLivePrice } from '@/utils/investment';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createAdminClient();
    const now = new Date();
    const day = now.getDay(); // 1 = Monday
    const hours = now.getHours(); // 0-23

    const updates = [];
    const logs = [];

    for (const item of INVESTMENT_SYMBOLS) {
        try {
            const liveData = await fetchLivePrice(item.symbol);
            if (liveData !== null) {
                // 1. 항상 'hourly' 스냅샷 업데이트
                updates.push({
                    symbol: item.symbol,
                    type: item.type,
                    price: liveData.price,
                    price_mode: 'hourly',
                    updated_at: now.toISOString()
                });

                // 2. 월요일 오전 9시 KST (= UTC 0시) 인 경우 'weekly' 스냅샷 업데이트
                if (day === 1 && hours === 0) {
                    updates.push({
                        symbol: item.symbol,
                        type: item.type,
                        price: liveData.price,
                        price_mode: 'weekly',
                        updated_at: now.toISOString()
                    });
                }

                logs.push(`${item.name}: ${liveData.price.toLocaleString()}원 업데이트 완료`);
            }
        } catch (e: any) {
            console.error(`Failed to sync ${item.symbol}:`, e.message);
        }
    }

    if (updates.length > 0) {
        const { error } = await supabase
            .from('market_data')
            .upsert(updates, { onConflict: 'symbol,price_mode' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    return NextResponse.json({
        success: true,
        timestamp: now.toISOString(),
        updated_count: updates.length,
        logs
    });
}
