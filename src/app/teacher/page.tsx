'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Users, Coins, BookOpen, Settings, ChevronRight, LogOut, Plus } from 'lucide-react';
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
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800 dark:text-white">선생님 대시보드</h1>
                        <p className="text-slate-500 mt-1">{user?.user_metadata?.name || 'OOO'} 선생님 환영합니다</p>
                    </div>
                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-500 whitespace-nowrap">운영 학급:</span>
                            <select
                                value={selectedClassId}
                                onChange={handleClassChange}
                                className="bg-transparent border-none focus:ring-0 font-bold text-slate-800 dark:text-white"
                            >
                                {classes.length > 0 ? (
                                    classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))
                                ) : (
                                    <option value="">학급을 추가해주세요</option>
                                )}
                            </select>
                            <Link href="/teacher/settings" className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                                <Plus className="w-5 h-5 text-slate-400" />
                            </Link>
                        </div>
                    </div>
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
