
'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Settings, Plus, Trash2, Key, Info, Save, ArrowLeft, Sun } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [classes, setClasses] = useState<any[]>([]);
    const [newClassName, setNewClassName] = useState('');
    const [newSessionCode, setNewSessionCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const supabase = createClient();

    useEffect(() => {
        const loadInitialData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);

                // Load API key from teacher_settings table
                const res = await fetch('/api/teacher/settings');
                const settingsData = await res.json();
                if (settingsData.google_ai_api_key) {
                    setApiKey(settingsData.google_ai_api_key);
                }

                // Load classes
                const { data } = await supabase
                    .from('classes')
                    .select('*')
                    .eq('teacher_id', user.id)
                    .order('created_at', { ascending: false });

                if (data) setClasses(data);
            }
        };
        loadInitialData();
    }, []);

    const handleSaveApiKey = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ google_ai_api_key: apiKey })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'API 키 저장 실패');
            }

            alert(data.message || 'API 키가 저장되었습니다.');
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddClass = async () => {
        if (!newClassName || !newSessionCode) return alert('학급 이름과 세션 코드를 입력해주세요.');
        if (!user) return;

        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('classes')
                .insert([{
                    teacher_id: user.id,
                    name: newClassName,
                    session_code: newSessionCode
                }])
                .select();

            if (error) {
                if (error.code === '23505') throw new Error('중복된 세션 코드입니다. 다른 코드를 사용해주세요.');
                throw error;
            }

            setClasses([data[0], ...classes]);
            setNewClassName('');
            setNewSessionCode('');
            alert('학급이 추가되었습니다.');
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClass = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까? 관련 학생 데이터가 모두 삭제될 수 있습니다.')) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('classes')
                .delete()
                .eq('id', id);

            if (error) throw error;
            setClasses(classes.filter(c => c.id !== id));
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/teacher"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title="대시보드로 돌아가기"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <div className="flex-1 flex justify-between items-center">
                    <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <Settings className="w-8 h-8 text-slate-600" />
                        시스템 설정
                    </h1>
                </div>
            </div>

            <div className="space-y-8">
                {/* 1. UI 설정 */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                        <Sun className="w-5 h-5 text-amber-500" />
                        화면 설정
                    </h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-slate-900 dark:text-slate-100">테마 모드 (다크/라이트)</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">화면의 밝기를 설정합니다.</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </section>

                {/* 데이터 관리 */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                        <Save className="w-5 h-5 text-blue-600" />
                        데이터 관리
                    </h2>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-slate-900 dark:text-slate-100">전체 로그 다운로드 (Excel/CSV)</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">모든 학급의 학생 거래 내역을 다운로드합니다.</p>
                        </div>
                        <button
                            onClick={async () => {
                                if (!confirm('전체 로그를 다운로드 하시겠습니까?')) return;
                                try {
                                    setLoading(true);
                                    const response = await fetch('/api/teacher/logs/export');
                                    const { data } = await response.json();

                                    if (!data || data.length === 0) {
                                        alert('다운로드할 데이터가 없습니다.');
                                        return;
                                    }

                                    // JSON to CSV
                                    const headers = ['날짜', '학급', '이름', '유형', '금액', '설명'];
                                    const csvContent = [
                                        headers.join(','),
                                        ...data.map((row: any) => [
                                            `"${row.created_at}"`,
                                            `"${row.class_name}"`,
                                            `"${row.student_name}"`,
                                            `"${row.type}"`,
                                            row.amount,
                                            `"${row.description}"`
                                        ].join(','))
                                    ].join('\n');

                                    // BOM for Excel Korean support
                                    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
                                    const url = URL.createObjectURL(blob);
                                    const link = document.createElement('a');
                                    link.href = url;
                                    link.download = `student_economy_logs_${new Date().toISOString().slice(0, 10)}.csv`;
                                    link.click();
                                } catch (e) {
                                    console.error(e);
                                    alert('다운로드 중 오류가 발생했습니다.');
                                } finally {
                                    setLoading(false);
                                }
                            }}
                            className="btn-outline flex items-center gap-2"
                            disabled={loading}
                        >
                            <Save className="w-4 h-4" />
                            다운로드
                        </button>
                    </div>
                </section>
                {/* AI 설정 */}
                <section className="glass-panel p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" />
                        AI 서비스 설정
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium">Google Gemini API Key</label>
                                <a
                                    href="https://aistudio.google.com/app/apikey"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-600 hover:underline"
                                >
                                    API 키 발급받기 →
                                </a>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                                    className="flex-1 p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    placeholder="AI_..."
                                />
                                <button
                                    onClick={handleSaveApiKey}
                                    disabled={loading}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    저장
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                * 입력하신 키는 선생님 계정 정보에 안전하게 저장되며, 퀴즈 생성 시 사용됩니다.
                            </p>
                        </div>
                    </div>
                </section>

                {/* 학급 관리 */}
                <section className="glass-panel p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-emerald-600" />
                        학급 추가 및 관리
                    </h2>

                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">학급 명칭</label>
                            <input
                                type="text"
                                value={newClassName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClassName(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                placeholder="예: 1학년 3반"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">접속 세션 코드 (중복 불가)</label>
                            <input
                                type="text"
                                value={newSessionCode}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSessionCode(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                placeholder="예: classy103"
                            />
                        </div>
                        <button
                            onClick={handleAddClass}
                            disabled={loading}
                            className="md:col-span-2 btn-primary bg-emerald-600 hover:bg-emerald-700"
                        >
                            학급 추가하기
                        </button>
                    </div>

                    <div className="space-y-4">
                        <h3 className="font-medium text-slate-700 dark:text-slate-300">운영 중인 학급 ({classes.length})</h3>
                        {classes.map(c => (
                            <div key={c.id} className="flex justify-between items-center p-4 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-white">{c.name}</div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400">코드: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{c.session_code}</code></div>
                                </div>
                                <button
                                    onClick={() => handleDeleteClass(c.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                        {classes.length === 0 && (
                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl border-dashed border-2 dark:border-slate-700">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                등록된 학급이 없습니다.
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex justify-start">
                    <Link href="/teacher" className="text-slate-500 dark:text-slate-400 hover:underline text-sm">
                        ← 대시보드로 돌아가기
                    </Link>
                </div>
            </div>
        </div>
    );
}
