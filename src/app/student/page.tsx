'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TrendingUp, Lightbulb, Wallet, ArrowRight, LogOut, ShoppingBag, MapPin, Settings, Landmark, Trophy, Crown, Medal, Users } from 'lucide-react';
import Link from 'next/link';

export default function StudentDashboard() {
    const [student, setStudent] = useState<any>(null);
    const [balance, setBalance] = useState(0);
    const [savingsTotal, setSavingsTotal] = useState(0);
    const [investmentTotal, setInvestmentTotal] = useState(0);
    const [investmentProfitRate, setInvestmentProfitRate] = useState(0);
    // 투자왕 명예의 전당 상태
    const [investRanking, setInvestRanking] = useState<any[]>([]);
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
                    .select('balance')
                    .eq('id', session.student.id)
                    .single();

                if (roster) {
                    setBalance(roster.balance || 0);
                    // 세션에 저장된 잔액도 업데이트
                    session.student.balance = roster.balance || 0;
                    localStorage.setItem('student_session', JSON.stringify(session));
                }

                // 저축 총액 조회 (API 경유 - RLS 우회)
                try {
                    const sumRes = await fetch(`/api/student/dashboard/summary?studentId=${session.student.id}`);
                    if (sumRes.ok) {
                        const sumData = await sumRes.json();
                        setSavingsTotal(sumData.totalSavings || 0);
                    }
                } catch (e) {
                    console.error('Savings fetch error:', e);
                }

                // 투자 총액 및 수익률 조회
                try {
                    const res = await fetch(`/api/student/investment/portfolio?studentId=${session.student.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        const portfolio = data.portfolio || [];
                        const totalInvested = portfolio.reduce((sum: number, inv: any) => sum + (inv.totalCost || 0), 0);
                        const totalValue = portfolio.reduce((sum: number, inv: any) => sum + (inv.marketValue || 0), 0);

                        setInvestmentTotal(totalInvested);
                        if (totalInvested > 0) {
                            setInvestmentProfitRate(((totalValue - totalInvested) / totalInvested) * 100);
                        } else {
                            setInvestmentProfitRate(0);
                        }
                    }
                } catch (e) {
                    console.error('Investment fetch error:', e);
                }

                // 투자왕 명예의 전당 조회
                try {
                    const rankRes = await fetch(`/api/student/dashboard/ranking?classId=${session.student.class_id}`);
                    if (rankRes.ok) {
                        const rankData = await rankRes.json();
                        setInvestRanking(rankData.ranking || []);
                    }
                } catch (e) {
                    console.error('Ranking fetch error:', e);
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

    // 순위별 메달 아이콘 및 색상 반환 함수
    const getRankStyle = (rank: number) => {
        switch (rank) {
            case 0: return { emoji: '🥇', color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20', border: 'border-yellow-200 dark:border-yellow-800' };
            case 1: return { emoji: '🥈', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-700/30', border: 'border-slate-200 dark:border-slate-600' };
            case 2: return { emoji: '🥉', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800' };
            default: return { emoji: '', color: 'text-slate-500', bg: '', border: '' };
        }
    };

    if (loading) return <div className="p-8 flex justify-center items-center h-screen text-slate-800 dark:text-white">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">학생 대시보드</h1>
                    <div className="flex items-center gap-4">
                        <Link href="/student/settings" className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                        </Link>
                        <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                            <LogOut className="w-4 h-4" />
                            교실 나가기
                        </button>
                    </div>
                </div>

                {/* 상단 3단 카드 영역 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    {/* 1번: 환영 + 잔액 (축소) */}
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-5 flex flex-col justify-between shadow-sm hover:shadow-md rounded-2xl relative overflow-hidden transition-all">
                        <div className="relative z-10">
                            <h2 className="text-lg font-bold mb-1 text-slate-800 dark:text-white">
                                {student?.name || '학생'}님 👋
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-3">오늘도 현명한 경제 생활을 해보세요.</p>

                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">나의 현재 잔액</p>
                                <h2 className="text-3xl font-bold text-blue-600 dark:text-blue-400">{balance.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span></h2>
                            </div>
                        </div>
                        <div className="absolute right-[-15px] bottom-[-15px] text-blue-100 dark:text-blue-900/20 rotate-12">
                            <Wallet className="w-24 h-24" />
                        </div>
                    </div>

                    {/* 2번: 저축 + 투자 위젯 (중앙) */}
                    <div className="flex flex-col gap-3">
                        {/* 저축 현황 */}
                        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-5 rounded-2xl shadow-lg shadow-blue-500/20 flex flex-col justify-center flex-1 transition-all hover:scale-[1.02] hover:shadow-xl">
                            <div className="flex items-center gap-2 mb-2 text-blue-100">
                                <Landmark className="w-4 h-4" />
                                <p className="text-xs font-bold uppercase tracking-wider">나의 총 저축액</p>
                            </div>
                            <h3 className="text-2xl font-black text-white">
                                {savingsTotal.toLocaleString()} <span className="text-sm font-normal opacity-80">원</span>
                            </h3>
                        </div>
                        {/* 투자 현황 */}
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center flex-1 transition-all hover:shadow-md">
                            <div className="flex items-center gap-2 mb-1.5 text-slate-500 dark:text-slate-400">
                                <TrendingUp className="w-4 h-4" />
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">나의 총 투자액</p>
                            </div>
                            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-0.5">
                                {investmentTotal.toLocaleString()} <span className="text-sm font-normal text-slate-500">원</span>
                            </h3>
                            <div className="flex items-center gap-1.5">
                                <span className={`text-xs font-bold flex items-center ${investmentProfitRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {investmentProfitRate > 0 && '+'}
                                    {investmentProfitRate.toFixed(2)}%
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium border-l border-slate-200 dark:border-slate-700 pl-1.5">수익률</span>
                            </div>
                        </div>
                    </div>

                    {/* 3번: 투자왕 명예의 전당 */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-amber-200 dark:border-amber-900/40 p-5 rounded-2xl shadow-sm transition-all hover:shadow-md">
                        <div className="flex items-center gap-2 mb-3">
                            <Trophy className="w-5 h-5 text-amber-500" />
                            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">투자왕 명예의 전당</h3>
                        </div>
                        {investRanking.length === 0 ? (
                            <div className="text-center py-4 text-xs text-slate-400">아직 투자 데이터가 없습니다.</div>
                        ) : (
                            <div className="space-y-2">
                                {investRanking.map((r: any, idx: number) => {
                                    const style = getRankStyle(idx);
                                    return (
                                        <div key={r.id} className={`flex items-center gap-2.5 p-2 rounded-xl ${style.bg} border ${style.border} transition-all`}>
                                            <span className="text-lg">{style.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${r.id === student?.id ? 'text-amber-600 dark:text-amber-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                                    {r.name}
                                                    {r.id === student?.id && <span className="ml-1 text-[10px] font-medium text-amber-500">(나)</span>}
                                                </p>
                                            </div>
                                            <span className={`text-xs font-bold tabular-nums ${r.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                {r.netProfit >= 0 ? '+' : ''}{r.netProfit.toLocaleString()}원
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <h3 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">오늘의 활동</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/student/bank" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-blue-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Landmark className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">은행</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">송금 및 저축하기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-blue-500" />
                    </Link>

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
                            <p className="text-sm text-slate-500 dark:text-slate-400">오늘의 퀴즈 맞추고 상금 받기</p>
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
                            <h4 className="font-bold text-slate-900 dark:text-white">교실 부동산</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">자리 거래하기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-rose-500" />
                    </Link>

                    <Link href="/student/log" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-slate-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">활동 기록</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">내 거래 내역 보기</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-slate-500" />
                    </Link>

                    <Link href="/student/groups" className="p-6 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-orange-500 transition-all flex items-center gap-4 group shadow-sm hover:shadow-md">
                        <div className="p-3 rounded-xl bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                            <Users className="w-6 h-6" />
                        </div>
                        <div className="text-left flex-1">
                            <h4 className="font-bold text-slate-900 dark:text-white">모둠 활동</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">모둠 자금 기부 및 자리 구매</p>
                        </div>
                        <ArrowRight className="w-5 h-5 ml-auto text-slate-300 dark:text-slate-600 group-hover:text-orange-500" />
                    </Link>
                </div>

            </div>
        </div>
    );
}
