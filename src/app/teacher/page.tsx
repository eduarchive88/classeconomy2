'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Users, Coins, BookOpen, Settings, ChevronRight, LogOut, Plus, MapPin, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
    const [user, setUser] = useState<any>(null);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchUserAndClasses = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user || user.user_metadata.role !== 'teacher') {
                router.push('/');
                return;
            }
            setUser(user);

            // Fetch classes
            const { data: classData } = await supabase
                .from('classes')
                .select('*')
                .eq('teacher_id', user.id)
                .order('name', { ascending: true });

            if (classData && classData.length > 0) {
                setClasses(classData);
                const savedClassId = localStorage.getItem('selected_class_id');
                if (savedClassId && classData.find((c: any) => c.id === savedClassId)) {
                    setSelectedClassId(savedClassId);
                } else {
                    setSelectedClassId(classData[0].id);
                    localStorage.setItem('selected_class_id', classData[0].id);
                }
            }
        };
        fetchUserAndClasses();
    }, [supabase, router]);

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedClassId(id);
        localStorage.setItem('selected_class_id', id);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            선생님 대시보드
                            {classes.find((c: any) => c.id === selectedClassId)?.name && (
                                <span className="text-2xl font-normal text-slate-500">
                                    ({classes.find((c: any) => c.id === selectedClassId).name})
                                </span>
                            )}
                        </h1>
                        <p className="text-slate-500 mt-1">{user?.user_metadata?.name || 'OOO'} 선생님 환영합니다</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {classes.length > 0 && (
                            <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                                <span className="text-sm font-medium text-slate-500 whitespace-nowrap">운영 학급:</span>
                                <select
                                    value={selectedClassId}
                                    onChange={handleClassChange}
                                    className="bg-transparent border-none focus:ring-0 font-bold text-slate-800 dark:text-white pr-8"
                                >
                                    {classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <Link href="/teacher/settings" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors" title="학급 추가">
                                    <Plus className="w-5 h-5 text-slate-400" />
                                </Link>
                            </div>
                        )}
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            로그아웃
                        </button>
                    </div>
                </div>

                {classes.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="bg-blue-50 dark:bg-blue-900/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Plus className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2">아직 개설된 학급이 없습니다</h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
                            경제 교육을 시작하기 위해 먼저 학급을 생성해주세요. <br />
                            학급을 생성하면 학생들을 등록하고 관리할 수 있습니다.
                        </p>
                        <Link
                            href="/teacher/settings"
                            className="btn-primary inline-flex items-center gap-2 px-8 py-3"
                        >
                            <Settings className="w-5 h-5" />
                            학급 개설하러 가기
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Link href="/teacher/students" className="card group hover:border-blue-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <Users className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">학생 명단 관리</h2>
                            <p className="text-slate-500 text-sm">학생들을 등록하고 정보를 관리합니다.</p>
                        </Link>

                        <Link href="/teacher/finance" className="card group hover:border-emerald-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <Coins className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">재무/금융 관리</h2>
                            <p className="text-slate-500 text-sm">특별 수당 지급 및 벌금 부과를 관리합니다.</p>
                        </Link>

                        <Link href="/teacher/quizzes" className="card group hover:border-indigo-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                    <BookOpen className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-indigo-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">퀴즈 문제 정하기</h2>
                            <p className="text-slate-500 text-sm">오늘의 퀴즈를 등록하고 AI로 문제를 생성합니다.</p>
                        </Link>

                        <Link href="/teacher/real-estate" className="card group hover:border-amber-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                    <MapPin className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-amber-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">부동산/자리 관리</h2>
                            <p className="text-slate-500 text-sm">교실 자리 배치 및 임대료/매매가를 관리합니다.</p>
                        </Link>

                        <Link href="/teacher/market" className="card group hover:border-purple-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <ShoppingBag className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-purple-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">학급 마켓</h2>
                            <p className="text-slate-500 text-sm">학생들이 구매할 수 있는 상품/쿠폰을 등록합니다.</p>
                        </Link>

                        <Link href="/teacher/settings" className="card group hover:border-slate-500 transition-all">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                                    <Settings className="w-6 h-6" />
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500" />
                            </div>
                            <h2 className="text-xl font-bold mb-1">시스템 설정</h2>
                            <p className="text-slate-500 text-sm">API 키 및 전체 학급 정보를 관리합니다.</p>
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
