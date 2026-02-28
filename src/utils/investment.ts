import { createAdminClient } from './supabase/server';
import { PriceMode } from '@/lib/constants';

/**
 * Yahoo Finance 차트 API를 직접 호출하여 현재 시세 조회
 */
export async function fetchLivePrice(symbol: string): Promise<{ price: number; previousClose: number } | null> {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            next: { revalidate: 0 }
        });
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        let price = meta?.regularMarketPrice || null;
        let previousClose = meta?.chartPreviousClose || meta?.regularMarketPreviousClose || null;

        // 미국 주식 등 달러 기준인 경우 한화로 변환 (간이 환율 1350원 적용)
        if (price && meta?.currency === 'USD') {
            price = Math.round(price * 1350);
        }
        if (previousClose && meta?.currency === 'USD') {
            previousClose = Math.round(previousClose * 1350);
        }

        return { price, previousClose };
    } catch (error) {
        console.error(`Live price fetch error for ${symbol}:`, error);
        return null;
    }
}

/**
 * 교사의 설정에 따라 주식/코인의 현재 가격 또는 스냅샷 가격을 반환합니다.
 */
export async function getInvestmentPrice(symbol: string, classId: string): Promise<{ price: number; previousClose: number; mode: PriceMode }> {
    const supabase = createAdminClient();

    // 1. 학급에 연결된 교사의 설정(price_mode) 가져오기
    const { data: classData } = await supabase
        .from('classes')
        .select('teacher_id')
        .eq('id', classId)
        .single();

    let mode: PriceMode = 'realtime';
    if (classData?.teacher_id) {
        const { data: settings } = await supabase
            .from('teacher_settings')
            .select('investment_price_mode')
            .eq('teacher_id', classData.teacher_id)
            .single();

        if (settings?.investment_price_mode) {
            mode = settings.investment_price_mode as PriceMode;
        }
    }

    // 2. 모드에 따른 가격 조회
    if (mode === 'realtime') {
        const liveData = await fetchLivePrice(symbol);
        return { price: liveData?.price || 0, previousClose: liveData?.previousClose || 0, mode };
    }

    // hourly 또는 weekly 인 경우 DB 스냅샷(market_data) 조회
    const { data: marketData } = await supabase
        .from('market_data')
        .select('price')
        .eq('symbol', symbol)
        .eq('price_mode', mode)
        .maybeSingle();

    if (marketData) {
        const liveData = await fetchLivePrice(symbol);
        const previousClose = liveData?.previousClose || marketData.price;
        return { price: marketData.price, previousClose, mode };
    }

    // 스냅샷이 없는 경우 실시간 가격을 가져와서 반환 (Fall-back)
    const fallbackData = await fetchLivePrice(symbol);
    return { price: fallbackData?.price || 0, previousClose: fallbackData?.previousClose || 0, mode: 'realtime' };
}
