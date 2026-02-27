'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, RefreshCcw, Newspaper, DollarSign, PieChart, Wallet, AlertCircle } from 'lucide-react';
import Link from 'next/link';

// 거래 가능한 종목 목록
const STOCKS = [
    { symbol: 'AAPL', name: '애플 (Apple)' },
    { symbol: 'TSLA', name: '테슬라 (Tesla)' },
    { symbol: '005930.KS', name: '삼성전자' },
    { symbol: '000660.KS', name: 'SK하이닉스' },
    { symbol: '005380.KS', name: '현대차' },
    { symbol: '035420.KS', name: 'NAVER' },
    { symbol: 'BTC-USD', name: '비트코인 (Bitcoin)' },
    { symbol: 'ETH-USD', name: '이더리움 (Ethereum)' }
];

export default function InvestmentPage() {
    const [studentId, setStudentId] = useState<string | null>(null);
    const [quotes, setQuotes] = useState<any>({});
    const [news, setNews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newsLoading, setNewsLoading] = useState(true);
    const [quoteErrors, setQuoteErrors] = useState<Record<string, boolean>>({}); // 가격 가져오기 실패 추적

    // 거래 모달 상태
    const [selectedStock, setSelectedStock] = useState<any>(null);
    const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null);
    const [quantity, setQuantity] = useState('');
    const [tradeLoading, setTradeLoading] = useState(false);

    // 포트폴리오 상태
    const [portfolio, setPortfolio] = useState<any[]>([]);
    const [balance, setBalance] = useState<number>(0);
    const [portfolioLoading, setPortfolioLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem('student_session');
        if (stored) {
            setStudentId(JSON.parse(stored).student.id);
        }
        fetchQuotes();
        fetchNews();
        if (stored) {
            fetchPortfolio(JSON.parse(stored).student.id);
        }

        // 10초마다 시세 자동 갱신
        const interval = setInterval(fetchQuotes, 10000);
        return () => clearInterval(interval);
    }, []);

    // 시세 가져오기
    const fetchQuotes = async () => {
        const newQuotes: any = {};
        const errors: Record<string, boolean> = {};
        for (const stock of STOCKS) {
            try {
                const res = await fetch(`/api/student/investment/quote?symbol=${stock.symbol}${studentId ? `&studentId=${studentId}` : ''}`);
                const data = await res.json();
                if (res.ok && !data.isError) {
                    newQuotes[stock.symbol] = data;
                    errors[stock.symbol] = false;
                } else {
                    errors[stock.symbol] = true;
                }
            } catch (error) {
                console.error(`Failed to fetch ${stock.symbol}`, error);
                errors[stock.symbol] = true;
            }
        }
        setQuotes(newQuotes);
        setQuoteErrors(errors);
        setLoading(false);
    };

    // 포트폴리오 가져오기
    const fetchPortfolio = async (id: string) => {
        try {
            const res = await fetch(`/api/student/investment/portfolio?studentId=${id}`);
            const data = await res.json();
            if (data.portfolio) {
                setPortfolio(data.portfolio);
            }
            if (data.balance !== undefined) {
                setBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to fetch portfolio', error);
        } finally {
            setPortfolioLoading(false);
        }
    };

    // 뉴스 가져오기
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

    // 거래 처리
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
                if (studentId) fetchPortfolio(studentId);
            } else {
                alert(json.error);
            }
        } catch (error) {
            alert('거래 실패');
        } finally {
            setTradeLoading(false);
        }
    };

    // 거래 모달 열기
    const openTradeModal = (stock: any, action: 'buy' | 'sell') => {
        setSelectedStock(stock);
        setTradeAction(action);
        setQuantity('');
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl pb-24">
            {/* 헤더 */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <Link href="/student" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    <h1 className="text-2xl font-bold">투자 시장</h1>
                </div>
                <button onClick={() => { setLoading(true); fetchQuotes(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <RefreshCcw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* ===== 1. 나의 투자 현황 (포트폴리오) - 최상단 ===== */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 mb-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <PieChart className="w-6 h-6 text-emerald-500" />
                    나의 투자 현황 (포트폴리오)
                </h2>

                {portfolioLoading ? (
                    <div className="text-center py-8 text-slate-400">불러오는 중...</div>
                ) : portfolio.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-700/50">
                                <tr>
                                    <th className="px-4 py-3 rounded-l-lg">종목</th>
                                    <th className="px-4 py-3 text-right">보유량</th>
                                    <th className="px-4 py-3 text-right">평단가</th>
                                    <th className="px-4 py-3 text-right">현재가</th>
                                    <th className="px-4 py-3 text-right rounded-r-lg">수익률</th>
                                </tr>
                            </thead>
                            <tbody>
                                {portfolio.map((item) => {
                                    const isProfitable = item.profit >= 0;
                                    const stockName = STOCKS.find(s => s.symbol === item.symbol)?.name || item.symbol;

                                    return (
                                        <tr key={item.symbol} className="border-b dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                                {stockName}
                                                <div className="text-xs text-slate-400 font-normal">{item.symbol}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono">{item.quantity}주</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500">{Math.floor(item.average_price).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold">{item.currentPrice?.toLocaleString()}</td>
                                            <td className={`px-4 py-3 text-right font-mono font-bold ${isProfitable ? 'text-red-500' : 'text-blue-500'}`}>
                                                {isProfitable ? '+' : ''}{Math.floor(item.profit).toLocaleString()} ({item.profitPercent.toFixed(2)}%)
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 flex flex-col items-center justify-center text-slate-500">
                        <Wallet className="w-12 h-12 mb-3 text-slate-300" />
                        <p>아직 보유한 주식이 없습니다.</p>
                        <p className="text-sm text-slate-400 mt-1">아래 시장에서 첫 투자를 시작해보세요!</p>
                    </div>
                )}
            </div>

            {/* ===== 2. 투자 안내 - 포트폴리오 바로 아래 ===== */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 mb-6">
                <p className="font-bold mb-2">💡 투자 안내</p>
                <ul className="list-disc ml-5 space-y-1">
                    <li>주식은 <strong>소수점 단위</strong>로도 구매 가능합니다. (예: 0.5주)</li>
                    <li>실시간 가격 변동에 따라 수익률이 달라질 수 있습니다.</li>
                    <li>가격은 Yahoo Finance에서 실시간 연동됩니다. 네트워크 상황에 따라 지연될 수 있습니다.</li>
                </ul>
            </div>

            {/* ===== 3. 시장 현황 (시세 카드) ===== */}
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-indigo-500" />
                시장 현황
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {STOCKS.map((stock) => {
                    const quote = quotes[stock.symbol];
                    const hasError = quoteErrors[stock.symbol];
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
                                ) : hasError ? (
                                    <div className="flex items-center gap-1 text-amber-500 text-sm">
                                        <AlertCircle className="w-4 h-4" />
                                        <span>가격 불러오기 실패</span>
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

            {/* ===== 4. 경제 뉴스 ===== */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Newspaper className="w-6 h-6 text-indigo-500" />
                    오늘의 경제 뉴스
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

            {/* 거래 모달 */}
            {tradeAction && selectedStock && (() => {
                const currentQuantity = portfolio.find(p => p.symbol === selectedStock.symbol)?.quantity || 0;
                const expectedAmount = Number(quantity) * selectedStock.price;

                // 구매/판매 가능 여부 검증
                const isBuyDisabled = tradeAction === 'buy' && expectedAmount > balance;
                const isSellDisabled = tradeAction === 'sell' && Number(quantity) > currentQuantity;
                const isSubmitDisabled = tradeLoading || isBuyDisabled || isSellDisabled || Number(quantity) <= 0;

                return (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-xl font-bold mb-1">
                                {selectedStock.name} {tradeAction === 'buy' ? '매수' : '매도'}
                            </h3>
                            <div className="flex justify-between items-center mb-6">
                                <p className="text-slate-500 text-sm">
                                    현재가: <span className="font-mono font-bold text-slate-800 dark:text-white">{selectedStock.price?.toLocaleString()}원</span>
                                </p>
                                <div className="text-right text-sm">
                                    {tradeAction === 'buy' ? (
                                        <p className="text-indigo-600 dark:text-indigo-400 font-medium">보유 자금: {balance.toLocaleString()}원</p>
                                    ) : (
                                        <p className="text-emerald-600 dark:text-emerald-400 font-medium">보유 주식: {currentQuantity}주</p>
                                    )}
                                </div>
                            </div>

                            <form onSubmit={handleTrade}>
                                <div className="mb-6">
                                    <label className="block text-sm font-medium mb-2 text-slate-600 dark:text-slate-400">
                                        수량 (주)
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            min="0.0001"
                                            step="any"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            className={`w-full p-4 pl-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 transition-all text-right pr-12 font-bold text-lg outline-none
                                                ${(isBuyDisabled || isSellDisabled)
                                                    ? 'border-red-500 focus:border-red-500 text-red-600'
                                                    : 'border-transparent focus:border-indigo-500'}`}
                                            placeholder="0"
                                            required
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                            주
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center mt-2">
                                        <div className="text-xs text-red-500 font-medium">
                                            {isBuyDisabled && '보유 자금이 부족합니다.'}
                                            {isSellDisabled && '보유 주식이 부족합니다.'}
                                        </div>
                                        <div className={`text-right text-sm font-medium ${isBuyDisabled ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                            예상 금액: {Math.ceil(expectedAmount).toLocaleString()} 원
                                        </div>
                                    </div>
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
                                        disabled={isSubmitDisabled}
                                        className={`flex-1 py-3 rounded-xl font-bold text-white transition-all shadow-lg 
                                            ${isSubmitDisabled
                                                ? 'bg-slate-300 dark:bg-slate-700 shadow-none cursor-not-allowed'
                                                : tradeAction === 'buy'
                                                    ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                                                    : 'bg-blue-500 hover:bg-blue-600 shadow-blue-500/30'
                                            }`}
                                    >
                                        {tradeLoading ? '처리 중...' : (tradeAction === 'buy' ? '매수하기' : '매도하기')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                );
            })()}

            {/* 푸터 */}
            <footer className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
                <p>만든 사람: 경기도 지구과학 교사 뀨짱</p>
                <p className="mt-1">
                    문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">카카오톡 오픈채팅</a>
                    <span className="mx-2">|</span>
                    블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">뀨짱쌤의 교육자료 아카이브</a>
                </p>
            </footer>
        </div>
    );
}
