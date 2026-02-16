
'use client';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

    if (!user) return <div className="p-8">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-8">
            <h1 className="text-2xl font-bold mb-6">선생님 대시보드</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="card">
                    <h2 className="text-xl font-semibold mb-2">학생 관리</h2>
                    <p className="text-slate-500 mb-4">학생 명단 관리 및 포인트 지급</p>
                    <button className="btn-primary w-full">관리하기</button>
                </div>
                <div className="card">
                    <h2 className="text-xl font-semibold mb-2">시장 관리</h2>
                    <p className="text-slate-500 mb-4">물품 등록 및 거래 내역 확인</p>
                    <button className="btn-primary w-full">관리하기</button>
                </div>
                <div className="card">
                    <h2 className="text-xl font-semibold mb-2">설정</h2>
                    <p className="text-slate-500 mb-4">학급 설정 및 퀴즈 설정</p>
                    <button className="btn-primary w-full">설정하기</button>
                </div>
            </div>
        </div>
    );
}
