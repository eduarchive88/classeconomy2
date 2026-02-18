'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ArrowLeft, History, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function StudentLog() {
    const [transactions, setTransactions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: student } = await supabase
                .from('student_roster')
                .select('id')
                .eq('profile_id', user.id)
                .single();

            if (student) {
                const { data } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('student_id', student.id)
                    .order('created_at', { ascending: false })
                    .limit(50); // Last 50 logs

                if (data) setTransactions(data);
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
            case 'special_allowance': return '특별 용돈';
            case 'fine': return '벌금';
            case 'quiz_reward': return '퀴즈 상금';
            case 'stock_profit': return '투자 수익';
            case 'stock_loss': return '투자 손실';
            case 'real_estate_income': return '임대 수익';
            case 'market_purchase': return '상점 구매';
            case 'real_estate_purchase': return '부동산 구매';
            case 'tax': return '세금';
            default: return type;
        }
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
                                <div className="font-bold text-slate-800 mb-1">{tx.description}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-2">
                                    <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">
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
