'use client';
import { useState, useEffect } from 'react';
import { ArrowLeft, History, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function StudentLog() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const sessionStr = localStorage.getItem('student_session');
            if (!sessionStr) return;
            const session = JSON.parse(sessionStr);
            const studentId = session.student?.id;

            if (studentId) {
                const res = await fetch(`/api/student/log?studentId=${studentId}`);
                if (res.ok) {
                    const data = await res.json();
                    setTransactions(data.transactions || []);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, []);

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'allowance': return '용돈';
            case 'transfer_sent': return '송금 보냄';
            case 'transfer_received': return '송금 받음';
            case 'deposit': return '저축 가입';
            case 'withdraw': return '저축 출금';
            case 'special_allowance': return '특별 용돈';
            case 'fine': return '벌금';
            case 'quiz_reward': return '퀴즈 상금';
            case 'stock_profit': return '투자 수익';
            case 'stock_loss': return '투자 손실';
            case 'real_estate_income': return '임대 수익';
            case 'market_purchase': return '상점 구매';
            case 'real_estate_purchase': return '부동산 구매';
            case 'real_estate_pending': return '부동산(승인대기)';
            case 'real_estate_refund': return '부동산(환불)';
            case 'stock_buy': return '주식 매수';
            case 'stock_sell': return '주식 매도';
            case 'investment_buy': return '주식 매수';
            case 'investment_sell': return '주식 매도';
            case 'tax': return '세금';
            default: return type;
        }
    };

    const formatDescription = (desc: string) => {
        if (!desc) return '';
        if (desc.startsWith('To: ')) return desc.replace('To: ', '') + '에게 송금';
        if (desc.startsWith('From: ')) return desc.replace('From: ', '') + '에게 받음';
        if (desc.startsWith('Savings Deposit')) return '학생 우대 정기 예금 가입';
        if (desc.startsWith('Savings Withdrawal (Principal: ')) {
            const match = desc.match(/Principal: (\d+), Interest: (\d+)/);
            if (match) {
                return `저축 만기 출금 (원금: ${Number(match[1]).toLocaleString()}원, 이자: ${Number(match[2]).toLocaleString()}원)`;
            }
            return '저축 만기 출금';
        }
        return desc;
    };

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/student"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-7 h-7 text-slate-600" />
                    활동 기록
                </h1>
                <button
                    onClick={fetchLogs}
                    className="ml-auto p-2 text-slate-400 hover:text-blue-600 transition-colors"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="space-y-4">
                {transactions.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        기록이 없습니다.
                    </div>
                ) : (
                    transactions.map((tx) => (
                        <div key={tx.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex justify-between items-center">
                            <div>
                                <div className="font-bold text-slate-800 mb-1">{formatDescription(tx.description)}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded font-medium ${tx.amount > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                        {getTypeLabel(tx.type)}
                                    </span>
                                    {new Date(tx.created_at).toLocaleString()}
                                </div>
                            </div>
                            <div className={`font-bold text-lg ${tx.amount > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} 원
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
