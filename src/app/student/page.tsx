'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrendingUp, Lightbulb, Wallet, ArrowRight, LogOut, ShoppingBag, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
    const [student, setStudent] = useState<any>(null);
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            // 로컬스토리지에서 세션 정보 가져오기
            const sessionStr = localStorage.getItem('student_session');
            if (!sessionStr) {
                router.push('/');
                return;
            }

            try {
                const session = JSON.parse(sessionStr);

                // 세션 만료 확인
                if (new Date(session.expiresAt) < new Date()) {
                    localStorage.removeItem('student_session');
                    router.push('/');
                    return;
                }

                setStudent(session.student);

                // 최신 잔액 조회
                const { data: roster } = await supabase
                    .from('student_roster')
                    .select('currency')
                    .eq('id', session.student.id)
                    .single();

                if (roster) {
                    setBalance(roster.currency || 0);
                    // 세션에 저장된 잔액도 업데이트
                    session.student.currency = roster.currency || 0;
                    localStorage.setItem('student_session', JSON.stringify(session));
                }
            } catch (error) {
                console.error('Session error:', error);
                localStorage.removeItem('student_session');
                router.push('/');
                return;
            }

            setLoading(false);
        };
        fetchData();
    }, [supabase, router]);

    // 로그아웃 핸들러
    const handleSignOut = async () => {
        localStorage.removeItem('student_session');
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

                    <Link href="/student/quiz" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-amber-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">퀴즈 풀기</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">경제 퀴즈로 돈 벌기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-amber-500" />
                    </Link>

                    <Link href="/student/shop" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-purple-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <ShoppingBag className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">상점</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">아이템 구매하기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-purple-500" />
                    </Link>

                    <Link href="/student/real-estate" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-rose-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                            <MapPin className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">교실 부동산 시장</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">자리 거래하기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-rose-500" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
