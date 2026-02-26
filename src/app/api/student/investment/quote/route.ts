import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

// yahoo-finance2 경고 메시지 억제 (cookie consent 관련)
yahooFinance.suppressNotices(['yahooSurvey']);

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        // yahoo-finance2 quote 호출 (타임아웃 설정)
        const quote = await yahooFinance.quote(symbol, {}, { timeout: 8000 });

        // 유효한 가격이 있는지 확인
        if (!quote || !quote.regularMarketPrice) {
            console.warn(`No price data for ${symbol}`);
            return NextResponse.json({
                symbol: symbol,
                price: 0,
                change: 0,
                changePercent: 0,
                name: symbol,
                isError: true // 프론트에서 에러 상태 구분
            });
        }

        return NextResponse.json({
            symbol: quote.symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange || 0,
            changePercent: quote.regularMarketChangePercent || 0,
            name: quote.shortName || quote.longName || symbol,
            isError: false
        });
    } catch (error: any) {
        console.error('Yahoo Finance Error:', error?.message || error);
        // 에러 시 isError=true로 전달하여 UI에서 명확한 오류 표시
        return NextResponse.json({
            symbol: symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            name: symbol,
            isError: true
        });
    }
}
