import yahooFinance from 'yahoo-finance2';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const quote = await yahooFinance.quote(symbol);
        return NextResponse.json({
            symbol: quote.symbol,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            name: quote.shortName || quote.longName
        });
    } catch (error) {
        console.error('Yahoo Finance Error:', error);
        // Fallback mock data to prevent UI from breaking
        return NextResponse.json({
            symbol: symbol,
            price: 50000, // Default fallback price
            change: 0,
            changePercent: 0,
            name: symbol // Fallback name
        });
    }
}
