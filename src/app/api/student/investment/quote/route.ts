import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Yahoo Finance 차트 API를 직접 호출하여 시세 조회 (npm 패키지 의존 없음)
async function fetchYahooQuote(symbol: string) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;

    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        next: { revalidate: 0 } // 캐시 비활성화
    });

    if (!res.ok) {
        throw new Error(`Yahoo API responded with status ${res.status}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
        throw new Error('No chart result');
    }

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const previousClose = meta.chartPreviousClose || meta.previousClose || price;
    const change = price - previousClose;
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;

    return {
        symbol: meta.symbol,
        price,
        change,
        changePercent,
        name: meta.shortName || meta.longName || symbol,
        isError: false
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        const quote = await fetchYahooQuote(symbol);
        return NextResponse.json(quote);
    } catch (error: any) {
        console.error(`Quote error for ${symbol}:`, error?.message || error);
        return NextResponse.json({
            symbol,
            price: 0,
            change: 0,
            changePercent: 0,
            name: symbol,
            isError: true
        });
    }
}
