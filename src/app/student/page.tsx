
'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function StudentDashboard() {
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser();
            if (error || !user) { // Role check might be needed if strictly separating
                router.push('/');
            } else {
                setUser(user);
            }
        };
        checkUser();
    }, [supabase, router]);

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <h1 className="text-2xl font-bold mb-6">학생 대시보드</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none">
                    <h2 className="text-lg font-medium opacity-90">내 자산</h2>
                    <p className="text-3xl font-bold mt-2">1,500,000 원</p>
                </div>
                <div className="card">
                    <h2 className="text-xl font-semibold mb-2">활동 하기</h2>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <button className="p-4 rounded-lg bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200 transition">투자하기</button>
                        <button className="p-4 rounded-lg bg-orange-100 text-orange-700 font-medium hover:bg-orange-200 transition">송금하기</button>
                        <button className="p-4 rounded-lg bg-purple-100 text-purple-700 font-medium hover:bg-purple-200 transition">퀴즈풀기</button>
                        <button className="p-4 rounded-lg bg-pink-100 text-pink-700 font-medium hover:bg-pink-200 transition">마켓가기</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
