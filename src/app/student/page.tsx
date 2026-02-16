
'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrendingUp, Lightbulb, Wallet, ArrowRight, LogOut, ShoppingBag, Send } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
    const [user, setUser] = useState<any>(null);
    const [balance, setBalance] = useState(0);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) {
                router.push('/');
                return;
            }
            setUser(user);

            const { data: profile } = await supabase.from('profiles').select('money').eq('id', user.id).single();
            if (profile) setBalance(profile.money);
        };
        fetchData();
    }, [supabase, router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">학생 대시보드</h1>
                    <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
                        <LogOut className="w-4 h-4" />
                        교실 나가기
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="md:col-span-2 card bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none p-8 flex justify-between items-center">
                        <div>
                            <p className="text-blue-100 text-sm font-medium mb-1">나의 현재 잔액</p>
                            <h2 className="text-4xl font-bold">{balance.toLocaleString()} 원</h2>
                        </div>
                        <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
                            <Wallet className="w-10 h-10" />
                        </div>
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">오늘의 활동</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/student/investment" className="p-6 rounded-2xl bg-white border-2 border-transparent hover:border-emerald-500 transition-all flex items-center gap-4 group">
                        <div className="p-3 rounded-xl bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-slate-900">투자하기</h4>
                            <p className="text-sm text-slate-500">주식 및 가상화폐 거래</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 group-hover:text-emerald-500" />
                    </Link>

                    <Link href="/student/quiz" className="p-6 rounded-2xl bg-white border-2 border-transparent hover:border-yellow-500 transition-all flex items-center gap-4 group">
                        <div className="p-3 rounded-xl bg-yellow-100 text-yellow-600 group-hover:bg-yellow-600 group-hover:text-white transition-colors">
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-slate-900">퀴즈풀기</h4>
                            <p className="text-sm text-slate-500">오늘의 퀴즈 풀고 상금 받기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 group-hover:text-yellow-500" />
                    </Link>

                    <div className="p-6 rounded-2xl bg-white border-2 border-dashed border-slate-200 opacity-60 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 text-slate-400">
                            <Send className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-slate-400">송금하기</h4>
                            <p className="text-sm text-slate-400">준비 중</p>
                        </div>
                    </div>

                    <div className="p-6 rounded-2xl bg-white border-2 border-dashed border-slate-200 opacity-60 flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-slate-100 text-slate-400">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div className="text-left">
                            <h4 className="font-bold text-slate-400">마켓가기</h4>
                            <p className="text-sm text-slate-400">준비 중</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
