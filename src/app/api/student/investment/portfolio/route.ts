import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');

    if (!studentId) {
        return NextResponse.json({ error: 'Student ID required' }, { status: 400 });
    }

    const supabase = createClient();

    try {
        const { data: investments, error } = await supabase
            .from('investments')
            .select('*')
            .eq('student_id', studentId);

        if (error) throw error;

        // Fetch current prices for all held stocks
        const portfolio = await Promise.all(investments.map(async (inv) => {
            try {
                const quote = await yahooFinance.quote(inv.symbol);
                const currentPrice = quote.regularMarketPrice || inv.average_price; // Fallback
                return {
                    ...inv,
                    currentPrice,
                    marketValue: currentPrice * inv.quantity,
                    totalCost: inv.average_price * inv.quantity,
                    profit: (currentPrice * inv.quantity) - (inv.average_price * inv.quantity),
                    profitPercent: ((currentPrice - inv.average_price) / inv.average_price) * 100
                };
            } catch (e) {
                return {
                    ...inv,
                    currentPrice: inv.average_price, // Fallback if quote fails
                    marketValue: inv.average_price * inv.quantity,
                    totalCost: inv.average_price * inv.quantity,
                    profit: 0,
                    profitPercent: 0
                };
            }
        }));

        return NextResponse.json({ portfolio });
    } catch (error) {
        console.error('Portfolio Fetch Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
