'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, TrendingUp, Trophy, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';

export default function TeacherInvestmentPage() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<'netProfit' | 'profitRate' | 'studentNumber'>('netProfit');
    const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || user.user_metadata?.role !== 'teacher') {
                router.push('/');
                return;
            }

            const classId = localStorage.getItem('selected_class_id');
            if (!classId) {
                router.push('/teacher');
                return;
            }

            try {
                const res = await fetch(`/api/teacher/investment?classId=${classId}`);
                if (res.ok) {
                    const data = await res.json();
                    setStudents(data.students || []);
                }
            } catch (e) {
                console.error('Fetch error:', e);
            }

            setLoading(false);
        };
        fetchData();
    }, [supabase, router]);

    // 정렬된 학생 목록
    const sortedStudents = [...students].sort((a, b) => {
        if (sortBy === 'netProfit') return b.netProfit - a.netProfit;
        if (sortBy === 'profitRate') return b.profitRate - a.profitRate;
        return a.studentNumber - b.studentNumber;
    });

    // 투자 경험이 있는 학생만 필터
    const investingStudents = students.filter(s => s.hasInvestment);
    // 전체 순수익 합계
    const totalNetProfit = investingStudents.reduce((sum: number, s: any) => sum + s.netProfit, 0);
    // 전체 보유자산 합계
    const totalHoldingValue = investingStudents.reduce((sum: number, s: any) => sum + (s.currentHoldingValue || 0), 0);

    if (loading) return <div className="p-8 text-center text-slate-800 dark:text-white">Loading...</div>;

    return (
        <div className="container mx-auto p-4 max-w-5xl pb-24">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/teacher" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                </Link>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">우리반 투자현황</h1>
            </div>

            {/* 요약 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-2 mb-2 opacity-90">
                        <TrendingUp className="w-5 h-5" />
                        <span className="text-sm font-medium">투자 참여 학생</span>
                    </div>
                    <div className="text-3xl font-bold">{investingStudents.length}<span className="text-lg font-normal opacity-80"> / {students.length}명</span></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                        <BarChart3 className="w-5 h-5" />
                        <span className="text-sm font-medium">현재 보유자산 합계</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white">{totalHoldingValue.toLocaleString()} <span className="text-sm font-normal text-slate-400">원</span></div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-2 text-slate-500 dark:text-slate-400">
                        <Trophy className="w-5 h-5" />
                        <span className="text-sm font-medium">학급 총 순수익</span>
                    </div>
                    <div className={`text-2xl font-bold ${totalNetProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {totalNetProfit >= 0 ? '+' : ''}{totalNetProfit.toLocaleString()} <span className="text-sm font-normal text-slate-400">원</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">실현 + 미실현 수익 합산</p>
                </div>
            </div>

            {/* 정렬 탭 */}
            <div className="flex gap-2 mb-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                    onClick={() => setSortBy('netProfit')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sortBy === 'netProfit'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    🏆 순이익 순
                </button>
                <button
                    onClick={() => setSortBy('profitRate')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sortBy === 'profitRate'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    📈 수익률 순
                </button>
                <button
                    onClick={() => setSortBy('studentNumber')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${sortBy === 'studentNumber'
                        ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                    👤 번호 순
                </button>
            </div>

            {/* 학생 투자 목록 */}
            <div className="space-y-3">
                {sortedStudents.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">등록된 학생이 없습니다.</div>
                ) : (
                    sortedStudents.map((s, idx) => {
                        const rank = sortBy === 'netProfit'
                            ? [...students].sort((a, b) => b.netProfit - a.netProfit).findIndex(x => x.id === s.id) + 1
                            : sortBy === 'profitRate'
                                ? [...students].sort((a, b) => b.profitRate - a.profitRate).findIndex(x => x.id === s.id) + 1
                                : idx + 1;
                        const isExpanded = expandedStudent === s.id;
                        const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}위`;

                        return (
                            <div key={s.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden transition-all hover:shadow-md">
                                <button
                                    onClick={() => setExpandedStudent(isExpanded ? null : s.id)}
                                    className="w-full text-left p-4 flex items-center gap-3"
                                >
                                    {/* 순위 */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${!s.hasInvestment ? 'bg-slate-100 dark:bg-slate-700 text-slate-400' :
                                            rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' :
                                                rank === 2 ? 'bg-slate-100 dark:bg-slate-700 text-slate-500' :
                                                    rank === 3 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
                                                        'bg-slate-50 dark:bg-slate-700 text-slate-400'
                                        }`}>
                                        {s.hasInvestment ? rankEmoji : '-'}
                                    </div>

                                    {/* 학생 정보 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-slate-400 font-medium">{s.studentNumber}번</span>
                                            <span className="font-bold text-slate-800 dark:text-white truncate">{s.name}</span>
                                        </div>
                                        {s.hasInvestment ? (
                                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                <span className="text-xs text-slate-400">실현 {s.realizedProfit >= 0 ? '+' : ''}{s.realizedProfit?.toLocaleString()}원</span>
                                                <span className="text-xs text-slate-400">미실현 {s.unrealizedProfit >= 0 ? '+' : ''}{s.unrealizedProfit?.toLocaleString()}원</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">투자 내역 없음</span>
                                        )}
                                    </div>

                                    {/* 순수익 / 수익률 */}
                                    <div className="text-right shrink-0">
                                        {s.hasInvestment ? (
                                            <>
                                                <div className={`text-sm font-bold tabular-nums ${s.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                                                    {s.netProfit >= 0 ? '+' : ''}{s.netProfit.toLocaleString()}원
                                                </div>
                                                <div className={`text-xs font-medium ${s.profitRate >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                                    {s.profitRate >= 0 ? '+' : ''}{s.profitRate.toFixed(1)}%
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-xs text-slate-300">-</span>
                                        )}
                                    </div>

                                    {/* 확장 아이콘 */}
                                    {s.hasInvestment && (
                                        isExpanded
                                            ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                                            : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                    )}
                                </button>

                                {/* 펼침: 보유 종목 */}
                                {isExpanded && s.portfolio && s.portfolio.length > 0 && (
                                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-medium text-slate-400 mt-3 mb-2">현재 보유 종목</p>
                                        <div className="space-y-1.5">
                                            {s.portfolio.map((p: any, pidx: number) => (
                                                <div key={pidx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 p-2.5 rounded-lg">
                                                    <div>
                                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.stock_name}</span>
                                                        <span className="text-xs text-slate-400 ml-2">{p.quantity}주</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-xs text-slate-500 tabular-nums block">현재가 {p.current_price?.toLocaleString()}원</span>
                                                        <span className={`text-xs font-bold tabular-nums ${p.profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            {p.profit >= 0 ? '+' : ''}{p.profit?.toLocaleString()}원
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {isExpanded && (!s.portfolio || s.portfolio.length === 0) && s.hasInvestment && (
                                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-xs text-slate-400 mt-3">현재 보유 중인 종목이 없습니다. (모두 매도 완료)</p>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 푸터 */}
            <footer className="mt-16 pt-6 border-t border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400 dark:text-slate-500 space-y-1">
                <p>만든 사람: 경기도 지구과학 교사 뀨짱</p>
                <p>
                    문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">카카오톡 오픈채팅</a>
                    {' | '}
                    블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">뀨짱쌤의 교육자료 아카이브</a>
                </p>
            </footer>
        </div>
    );
}
