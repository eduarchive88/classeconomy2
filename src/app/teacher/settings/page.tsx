
'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Settings, Plus, Trash2, Key, Info, Save, ArrowLeft, Sun, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';

export default function SettingsPage() {
    const [apiKey, setApiKey] = useState('');
    const [classes, setClasses] = useState<any[]>([]);
    const [newClassName, setNewClassName] = useState('');
    const [newSessionCode, setNewSessionCode] = useState('');
    const [editingClassId, setEditingClassId] = useState<string | null>(null);
    const [editSessionCode, setEditSessionCode] = useState('');
    const [priceMode, setPriceMode] = useState('realtime');
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
                if (settingsData.investment_price_mode) {
                    setPriceMode(settingsData.investment_price_mode);
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

    const handleSavePriceMode = async (newMode: string) => {
        setPriceMode(newMode);
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ investment_price_mode: newMode })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
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

    const handleUpdateSessionCode = async (id: string) => {
        if (!editSessionCode.trim()) return alert('새로운 세션 코드를 입력해주세요.');
        setLoading(true);
        try {
            const { error } = await supabase
                .from('classes')
                .update({ session_code: editSessionCode })
                .eq('id', id);

            if (error) {
                if (error.code === '23505') throw new Error('중복된 세션 코드입니다. 다른 코드를 사용해주세요.');
                throw error;
            }

            setClasses(classes.map(c => c.id === id ? { ...c, session_code: editSessionCode } : c));
            setEditingClassId(null);
            setEditSessionCode('');
            alert('세션 코드가 수정되었습니다.');
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

                {/* 경제/투자 설정 */}
                <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        경제/투자 운영 설정
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <h3 className="font-medium text-slate-900 dark:text-slate-100 mb-2">시장 가격(주식/코인) 조회 주기</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">학생들의 시장 페이지 및 상장 주식 가격 변동 타이밍을 결정합니다.</p>

                            <div className="space-y-3">
                                <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors dark:border-slate-600">
                                    <input
                                        type="radio"
                                        name="priceMode"
                                        value="weekly"
                                        checked={priceMode === 'weekly'}
                                        onChange={(e) => handleSavePriceMode(e.target.value)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-800 dark:text-white">주간 변동 (매주 월요일 9시 고정)</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">일주일에 단 한번만 가격이 바뀌어 예측 가능한 환경 조성에 좋습니다.</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors dark:border-slate-600">
                                    <input
                                        type="radio"
                                        name="priceMode"
                                        value="hourly"
                                        checked={priceMode === 'hourly'}
                                        onChange={(e) => handleSavePriceMode(e.target.value)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-800 dark:text-white">시간별 변동 (매 정각)</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">매 정각마다 최신 시세를 스냅샷으로 저장합니다. 비교적 안정적입니다.</div>
                                    </div>
                                </label>

                                <label className="flex items-start gap-3 p-3 border rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors dark:border-slate-600">
                                    <input
                                        type="radio"
                                        name="priceMode"
                                        value="realtime"
                                        checked={priceMode === 'realtime'}
                                        onChange={(e) => handleSavePriceMode(e.target.value)}
                                        className="mt-1"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-800 dark:text-white">실시간 변동 (기본값)</div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400">조회하는 시점의 실제 주식/코인 시세가 항상 반영됩니다.</div>
                                    </div>
                                </label>
                            </div>
                        </div>
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
                            <div key={c.id} className="flex flex-col gap-2 p-4 border dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <div className="flex justify-between items-center">
                                    <div className="flex-1">
                                        <div className="font-bold text-slate-800 dark:text-white mb-1">{c.name}</div>
                                        {editingClassId === c.id ? (
                                            <div className="flex items-center gap-2 mt-2">
                                                <input 
                                                    type="text" 
                                                    value={editSessionCode} 
                                                    onChange={e => setEditSessionCode(e.target.value)}
                                                    className="p-1 border rounded text-sm bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                                                    placeholder="새 세션 코드"
                                                />
                                                <button onClick={() => handleUpdateSessionCode(c.id)} className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">저장</button>
                                                <button onClick={() => setEditingClassId(null)} className="text-xs px-2 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300">취소</button>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                코드: <code className="bg-slate-200 dark:bg-slate-700 px-1 rounded">{c.session_code}</code>
                                                <button 
                                                    onClick={() => {
                                                        setEditingClassId(c.id);
                                                        setEditSessionCode(c.session_code);
                                                    }} 
                                                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                                                >
                                                    수정
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteClass(c.id)}
                                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors ml-4"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
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
