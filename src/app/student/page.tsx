'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrendingUp, Lightbulb, Wallet, ArrowRight, LogOut, ShoppingBag, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
    const [user, setUser] = useState<any>(null);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [rosterId, setRosterId] = useState<string | null>(null);
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

            // 학생 잔액 조회 - roster_id 우선, 없으면 이메일 기반 폴백
            let rId = user.user_metadata?.roster_id;

            if (!rId) {
                // 폴백: 이메일에서 세션코드 추출하여 학급/학생 조회
                const email = user.email || '';
                const sessionCode = email.split('_')[0];
                if (sessionCode) {
                    const { data: cls } = await supabase.from('classes').select('id').eq('session_code', sessionCode).single();
                    if (cls) {
                        const { data: r } = await supabase.from('student_roster')
                            .select('id')
                            .eq('class_id', cls.id)
                            .eq('name', user.user_metadata?.name || '')
                            .maybeSingle();
                        if (r) rId = r.id;
                    }
                }
            }

            if (rId) {
                setRosterId(rId);
                // currency 필드를 사용하여 잔액 조회 (finance API와 일치)
                const { data: roster } = await supabase.from('student_roster').select('currency').eq('id', rId).single();
                if (roster) setBalance(roster.currency || 0);
            }

            setLoading(false);
        };
        fetchData();
    }, [supabase, router]);

    // 로그아웃 핸들러
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (loading) return <div className="p-8 flex justify-center items-center h-screen text-slate-800 dark:text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">학생 대시보드</h1>
                    <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                        <LogOut className="w-4 h-4" />
                        교실 나가기
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <div className="md:col-span-2 card bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-none p-8 flex justify-between items-center shadow-lg rounded-2xl">
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
                    <Link href="/student/investment" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-emerald-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">투자하기</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">주식 및 가상화폐 거래</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-emerald-500" />
                    </Link>

                    <Link href="/student/quiz" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-yellow-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 group-hover:bg-yellow-600 group-hover:text-white transition-colors">
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">퀴즈풀기</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">오늘의 퀴즈 풀고 상금 받기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-yellow-500" />
                    </Link>

                    <Link href="/student/market" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-purple-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">마켓가기</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">물건 구매 및 내 보관함</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-purple-500" />
                    </Link>

                    <Link href="/student/real-estate" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-amber-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">자리/부동산</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">내 자리를 구매하고 확인하기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-amber-500" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
