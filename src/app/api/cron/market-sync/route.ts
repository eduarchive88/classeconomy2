/*
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

// Mapping symbols to Yahoo Finance tickers
const SYMBOLS: Record<string, string> = {
    '삼성전자': '005930.KS',
    '삼성SDI': '006400.KS',
    'POSCO홀딩스': '005490.KS',
    '대한항공': '003490.KS',
    'LG전자': '066570.KS',
    '현대차': '005380.KS',
    '기아': '000270.KS',
    'NAVER': '035420.KS',
    '카카오': '035720.KS',
    'LG화학': '051910.KS',
    '셀트리온': '068270.KS',
    'Apple': 'AAPL',
    'Amazon': 'AMZN',
    'Netflix': 'NFLX',
    'Tesla': 'TSLA',
    'NVIDIA': 'NVDA',
    'Microsoft': 'MSFT',
    'Meta': 'META',
    '비트코인': 'BTC-KRW',
    '이더리움': 'ETH-KRW',
    '리플': 'XRP-KRW',
};

export async function GET(request: Request) {
    // Verify Cron Secret or Admin?
    // For demo, we skip strict auth but in prod should check 'Authorization' header.

    const supabase = createClient();
    const updates = [];

    for (const [name, ticker] of Object.entries(SYMBOLS)) {
        try {
            const quote = await yahooFinance.quote(ticker);
            const price = quote.regularMarketPrice;

            // FX Rate for US stocks? Yahoo automatically returns in currency of exchange?
            // US stocks (AAPL) are in USD. We need KRW.
            // Fetch USD/KRW rate.
            let finalPrice = price;

            if (quote.currency === 'USD') {
                const fx = await yahooFinance.quote('KRW=X'); // USD/KRW
                finalPrice = price * (fx.regularMarketPrice || 1300);
            }

            updates.push({
                symbol: name, // Store by Name (Korean) for display
                type: ticker.includes('-KRW') ? 'coin' : 'stock',
                price: finalPrice,
                updated_at: new Date().toISOString()
            });

        } catch (e) {
            console.error(`Failed to fetch ${name}`, e);
        }
    }

    if (updates.length > 0) {
        const { error } = await supabase.from('market_data').upsert(updates, { onConflict: 'symbol' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, updated: updates.length });
}
*/

import { NextResponse } from 'next/server';
export async function GET() {
    return NextResponse.json({ message: "Market sync is currently disabled for build stabilization." });
}
