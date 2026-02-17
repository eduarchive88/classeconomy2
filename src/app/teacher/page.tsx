'use client';

import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { Users, Coins, BookOpen, Settings, ChevronRight, LogOut, ShoppingBag } from 'lucide-react';
import Link from 'next/link';

export default function TeacherDashboard() {
    const [user, setUser] = useState<any>(null);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUser(user);
        };
        fetchUser();
    }, []);

    const selectedClass = classes.find(c => c.id === selectedClassId);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/teacher" className="flex items-center gap-2">
                            <div className="bg-indigo-600 p-2 rounded-lg">
                                <Coins className="w-5 h-5 text-white" />
                            </div>
                            <span className="font-bold text-xl text-slate-800">모의경제</span>
                        </Link>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">
                        안녕하세요, {user?.user_metadata?.name || '선생님'} 👋
                    </h1>
                </div>

                {/* Simplified Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <Link href="/teacher/students" className="block p-6 bg-white rounded-xl border border-slate-200">
                        <Users className="w-6 h-6 text-indigo-600 mb-4" />
                        <h3 className="font-bold">학생 명단 관리</h3>
                    </Link>
                    <Link href="/teacher/bank" className="block p-6 bg-white rounded-xl border border-slate-200">
                        <ShoppingBag className="w-6 h-6 text-emerald-600 mb-4" />
                        <h3 className="font-bold">은행/상점 관리</h3>
                    </Link>
                    <Link href="/teacher/quizzes" className="block p-6 bg-white rounded-xl border border-slate-200">
                        <BookOpen className="w-6 h-6 text-amber-600 mb-4" />
                        <h3 className="font-bold">퀴즈 관리</h3>
                    </Link>
                    <Link href="/teacher/settings" className="block p-6 bg-white rounded-xl border border-slate-200">
                        <Settings className="w-6 h-6 text-slate-600 mb-4" />
                        <h3 className="font-bold">설정</h3>
                    </Link>
                </div>
            </main>
        </div>
    );
}
