'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Users, Coins, BookOpen, Settings, ChevronRight, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user || user.user_metadata.role !== 'teacher') {
                router.push('/');
            } else {
                setUser(user);
            }
        };
        checkUser();
    }, [supabase, router]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white">선생님 대시보드</h1>
                    <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
                        <LogOut className="w-4 h-4" />
                        로그아웃
                    </button>
                </div>

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

                    <div className="card group opacity-60">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-lg bg-slate-100 text-slate-600">
                                <Settings className="w-6 h-6" />
                            </div>
                        </div>
                        <h2 className="text-xl font-bold mb-1">시스템 설정</h2>
                        <p className="text-slate-500 text-sm">준비 중인 기능입니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
