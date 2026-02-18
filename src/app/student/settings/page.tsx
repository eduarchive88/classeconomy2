'use client';

import { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Lock, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudentSettings() {
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    const [student, setStudent] = useState<any>(null);

    // Password Change State
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setMounted(true);
        const stored = localStorage.getItem('student_session');
        if (stored) {
            setStudent(JSON.parse(stored).student);
        }
    }, []);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            return alert('새 비밀번호가 일치하지 않습니다.');
        }
        if (newPassword.length < 4) {
            return alert('비밀번호는 4자리 이상이어야 합니다.');
        }

        setLoading(true);
        try {
            const res = await fetch('/api/student/settings/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    currentPassword,
                    newPassword
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '변경 실패');

            alert('비밀번호가 변경되었습니다. 다음 로그인부터 새 비밀번호를 사용해주세요.');

            // Update local storage if needed (though password isn't stored there usually)
            // Clear fields
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    if (!mounted) return null;

    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/student" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold">환경 설정</h1>
            </div>

            <div className="space-y-6">
                {/* Theme Setting */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                        화면 테마
                    </h2>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setTheme('light')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'light'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <Sun className="w-6 h-6" />
                                <span className="font-medium">라이트 모드</span>
                            </div>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all ${theme === 'dark'
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                                }`}
                        >
                            <div className="flex flex-col items-center gap-2">
                                <Moon className="w-6 h-6" />
                                <span className="font-medium">다크 모드</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Password Setting */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        비밀번호 변경
                    </h2>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">현재 비밀번호</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="현재 비밀번호를 입력하세요"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">새 비밀번호</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="변경할 비밀번호를 입력하세요"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">새 비밀번호 확인</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="변경할 비밀번호를 다시 입력하세요"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-primary py-3 rounded-xl flex justify-center items-center gap-2 font-bold"
                        >
                            {loading ? <span className="animate-spin">⌛</span> : <Save className="w-5 h-5" />}
                            비밀번호 변경하기
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
