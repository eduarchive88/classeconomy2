
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export default function InvestmentPage() {
    const [marketData, setMarketData] = useState<any[]>([]);
    const [assets, setAssets] = useState<any[]>([]);
    const [balance, setBalance] = useState(0);
    const [selectedSymbol, setSelectedSymbol] = useState<any>(null);
    const [amount, setAmount] = useState(1);
    const [loading, setLoading] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        fetchData();
        // Poll every 1 minute? Or just once.
    }, []);

    const fetchData = async () => {
        const { data: market } = await supabase.from('market_data').select('*').order('price', { ascending: false });
        if (market) setMarketData(market);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const { data: profile } = await supabase.from('profiles').select('money').eq('id', user.id).single();
            if (profile) setBalance(profile.money);

            const { data: myAssets } = await supabase.from('assets').select('*').eq('user_id', user.id);
            if (myAssets) setAssets(myAssets);
        }
    };

    const handleTrade = async (action: 'buy' | 'sell') => {
        if (!selectedSymbol) return;
        setLoading(true);
        try {
            const res = await fetch('/api/student/investment/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: selectedSymbol.symbol,
                    amount,
                    action
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            alert(action === 'buy' ? '매수되었습니다.' : '매도되었습니다.');
            setAmount(1);
            setSelectedSymbol(null);
            fetchData();
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const myAsset = (symbol: string) => assets.find(a => a.symbol === symbol);

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">투자 센터</h1>
                <div className="text-right">
                    <p className="text-sm text-slate-500">내 잔액</p>
                    <p className="text-2xl font-bold text-emerald-600">{balance.toLocaleString()} 원</p>
                </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
                <div className="glass-panel p-6">
                    <h2 className="text-xl font-semibold mb-4">시장 현황 (실시간)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-slate-500 border-b">
                                    <th className="p-3">종목명</th>
                                    <th className="p-3">현재가</th>
                                    <th className="p-3">거래</th>
                                </tr>
                            </thead>
                            <tbody>
                                {marketData.map((item) => (
                                    <tr key={item.symbol} className="border-b hover:bg-slate-50">
                                        <td className="p-3 font-medium">
                                            {item.symbol}
                                            <span className="ml-2 text-xs text-slate-400 capitalize">{item.type}</span>
                                        </td>
                                        <td className="p-3 font-bold">{Number(item.price).toLocaleString()} 원</td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => setSelectedSymbol(item)}
                                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                            >
                                                주문
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    {selectedSymbol ? (
                        <div className="glass-panel p-6 border-blue-500 border-2">
                            <h3 className="text-lg font-bold mb-4">{selectedSymbol.symbol} 주문</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between text-sm">
                                    <span>현재가</span>
                                    <span className="font-bold">{Number(selectedSymbol.price).toLocaleString()}원</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span>보유 수량</span>
                                    <span>{myAsset(selectedSymbol.symbol)?.amount || 0} 주</span>
                                </div>

                                <div>
                                    <label className="block text-sm mb-1">수량</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={amount}
                                        onChange={e => setAmount(Number(e.target.value))}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>

                                <div className="pt-2 text-right font-bold text-lg">
                                    총 {(Number(selectedSymbol.price) * amount).toLocaleString()} 원
                                </div>

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <button
                                        onClick={() => handleTrade('buy')}
                                        disabled={loading}
                                        className="btn-primary bg-red-500 hover:bg-red-600 border-none"
                                    >
                                        매수
                                    </button>
                                    <button
                                        onClick={() => handleTrade('sell')}
                                        disabled={loading}
                                        className="btn-primary bg-blue-500 hover:bg-blue-600 border-none"
                                    >
                                        매도
                                    </button>
                                </div>
                                <button onClick={() => setSelectedSymbol(null)} className="w-full text-sm text-slate-400">취소</button>
                            </div>
                        </div>
                    ) : (
                        <div className="glass-panel p-6 bg-slate-50 text-center text-slate-400">
                            <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-20" />
                            <p>종목을 선택하여 거래하세요</p>
                        </div>
                    )}

                    <div className="glass-panel p-6">
                        <h3 className="text-lg font-bold mb-4">내 보유 자산</h3>
                        <div className="space-y-3">
                            {assets.map((a) => {
                                const currentPrice = marketData.find(m => m.symbol === a.symbol)?.price || a.average_price;
                                const profit = (currentPrice - a.average_price) * a.amount;
                                const profitRate = ((currentPrice - a.average_price) / a.average_price) * 100;

                                return (
                                    <div key={a.id} className="p-3 bg-white rounded-lg shadow-sm border">
                                        <div className="flex justify-between mb-1">
                                            <span className="font-semibold">{a.symbol}</span>
                                            <span className="text-sm">{a.amount}주</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className={profit >= 0 ? 'text-red-500' : 'text-blue-500'}>
                                                {profitRate.toFixed(1)}% ({profit.toLocaleString()}원)
                                            </span>
                                            <span className="text-slate-500">평단: {Number(a.average_price).toLocaleString()}</span>
                                        </div>
                                    </div>
                                )
                            })}
                            {assets.length === 0 && <p className="text-sm text-slate-400 text-center">보유 자산이 없습니다.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
