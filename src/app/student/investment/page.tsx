'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Newspaper, DollarSign } from 'lucide-react';
import Link from 'next/link';

const STOCKS = [
    { symbol: 'AAPL', name: '애플 (Apple)' },
    { symbol: 'TSLA', name: '테슬라 (Tesla)' },
    { symbol: 'BTC-USD', name: '비트코인 (Bitcoin)' },
    { symbol: 'ETH-USD', name: '이더리움 (Ethereum)' }
];

export default function InvestmentPage() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [quotes, setQuotes] = useState<any>({});
    const [news, setNews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newsLoading, setNewsLoading] = useState(true);

    // Trade Modal
    const [selectedStock, setSelectedStock] = useState<any>(null); // { symbol, name, price }
    const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [tradeLoading, setTradeLoading] = useState(false);

    // My Portfolio
    // TODO: Fetch portfolio from a separate API or include in quote API?
    // For now, let's just show trade interface. Portfolio viewing can be added later or via bank API enhancement.

    useEffect(() => {
        const stored = localStorage.getItem('student_info');
        if (stored) {
            setStudentId(JSON.parse(stored).id);
        }
        fetchQuotes();
        fetchNews();

        const interval = setInterval(fetchQuotes, 10000); // Refresh quotes every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchQuotes = async () => {
        const newQuotes: any = {};
        for (const stock of STOCKS) {
            try {
                const res = await fetch(`/api/student/investment/quote?symbol=${stock.symbol}`);
                const data = await res.json();
                if (res.ok) {
                    newQuotes[stock.symbol] = data;
                }
            } catch (error) {
                console.error(`Failed to fetch ${stock.symbol}`, error);
            }
        }
        setQuotes(newQuotes);
        setLoading(false);
    };

    const fetchNews = async () => {
        try {
            const res = await fetch('/api/student/investment/news');
            const data = await res.json();
            if (res.ok) {
                setNews(data.news);
            }
        } catch (error) {
            console.error('Failed to fetch news', error);
        } finally {
            setNewsLoading(false);
        }
    };

    const handleTrade = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStock || !tradeAction || !quantity) return;

        setTradeLoading(true);
        try {
            const res = await fetch('/api/student/investment/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: tradeAction,
                    studentId,
                    symbol: selectedStock.symbol,
                    quantity: Number(quantity)
                })
            });
            const json = await res.json();
            if (res.ok) {
                alert('거래가 완료되었습니다.');
                setQuantity('');
                setTradeAction(null);
                setSelectedStock(null);
                // Refresh balance/portfolio if we had that data visible
            } else {
                alert(json.error);
            }
        } catch (error) {
            alert('거래 실패');
        } finally {
            setTradeLoading(false);
        }
    };

    const openTradeModal = (stock: any, action: 'buy' | 'sell') => {
        setSelectedStock(stock);
        setTradeAction(action);
        setQuantity('');
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl pb-24">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/student/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-bold">투자 시장</h1>
                </div>
                <button onClick={() => { setLoading(true); fetchQuotes(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Market Status (Quotes) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {STOCKS.map((stock) => {
                    const quote = quotes[stock.symbol];
                    const isUp = quote?.change >= 0;

                    return (
                        <div key={stock.symbol} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="font-bold text-lg">{stock.name}</h3>
                                    <span className="text-xs font-mono text-slate-500">{stock.symbol}</span>
                                </div>
                                {quote ? (
                                    <div className={`text-right ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                                        <div className="text-xl font-bold flex items-center justify-end gap-1">
                                            {isUp ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                                            {quote.price.toLocaleString()}
                                        </div>
                                        <div className="text-sm font-medium">
                                            {isUp ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                                        </div>
                                    </div>
                                ) : (
                                    <div className="animate-pulse bg-slate-200 dark:bg-slate-700 w-24 h-10 rounded"></div>
                                )}
                            </div>

                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={() => openTradeModal({ ...stock, price: quote?.price }, 'buy')}
                                    disabled={!quote}
                                    className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold transition-colors disabled:opacity-50"
                                >
                                    매수
                                </button>
                                <button
                                    onClick={() => openTradeModal({ ...stock, price: quote?.price }, 'sell')}
                                    disabled={!quote}
                                    className="flex-1 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 font-bold transition-colors disabled:opacity-50"
                                >
                                    매도
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Economic News */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-indigo-500" />
                    오늘의 경제 뉴스 (AI 요약)
                </h2>

                {newsLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="animate-pulse flex gap-4">
                                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-700 rounded-xl"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : news.length > 0 ? (
                    <div className="space-y-6">
                        {news.map((item, idx) => (
                            <a key={idx} href={item.link} target="_blank" rel="noopener noreferrer" className="block group">
                                <h3 className="font-bold text-lg mb-2 group-hover:text-indigo-600 transition-colors line-clamp-1">
                                    {item.title}
                                </h3>
                                <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-xl text-sm text-slate-600 dark:text-slate-300">
                                    {item.summary}
                                </div>
                                <div className="mt-2 text-xs text-slate-400">
                                    {new Date(item.pubDate).toLocaleDateString()}
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-500">
                        뉴스를 불러오지 못했습니다.
                    </div>
                )}
            </div>

            {/* Trade Modal */}
            {tradeAction && selectedStock && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold mb-1">
                            {selectedStock.name} {tradeAction === 'buy' ? '매수' : '매도'}
                        </h3>
                        <p className="text-slate-500 mb-6 text-sm">
                            현재가: <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedStock.price?.toLocaleString()}</span>
                        </p>

                        <form onSubmit={handleTrade}>
                            <div className="mb-6">
                                <label className="block text-sm font-medium mb-2 text-slate-600 dark:text-slate-400">
                                    수량 (주/코인)
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        step="0.0001"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        className="w-full p-4 pl-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-lg font-bold transition-all"
                                        placeholder="0.0"
                                        required
                                    />
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                </div>
                                {quantity && selectedStock.price && (
                                    <div className="mt-2 text-right text-sm font-medium text-indigo-600 dark:text-indigo-400">
                                        예상 금액: {Math.floor(Number(quantity) * selectedStock.price).toLocaleString()} 미소
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => { setTradeAction(null); setSelectedStock(null); }}
                                    className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    취소
                                </button>
                                <button
                                    type="submit"
                                    disabled={tradeLoading}
                                    className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-indigo-500/30 ${tradeAction === 'buy'
                                            ? 'bg-red-500 hover:bg-red-600'
                                            : 'bg-blue-500 hover:bg-blue-600'
                                        }`}
                                >
                                    {tradeLoading ? '처리 중...' : (tradeAction === 'buy' ? '매수하기' : '매도하기')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
