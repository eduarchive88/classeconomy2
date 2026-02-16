
'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Settings, Plus, Trash2, Key, Info, Save } from 'lucide-react';
import Link from 'next/link';

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
                // Load API key from metadata
                setApiKey(user.user_metadata?.google_api_key || '');

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
            const { error } = await supabase.auth.updateUser({
                data: { google_api_key: apiKey }
            });
            if (error) throw error;
            alert('API 키가 저장되었습니다.');
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
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 flex items-center gap-2 text-slate-800 dark:text-white">
                <Settings className="w-8 h-8 text-slate-600" />
                시스템 설정
            </h1>

            <div className="space-y-8">
                {/* AI 설정 */}
                <section className="glass-panel p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Key className="w-5 h-5 text-indigo-600" />
                        AI 서비스 설정
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Google Gemini API Key</label>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value)}
                                    className="flex-1 p-2 border rounded-lg"
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
                            <p className="text-xs text-slate-500 mt-2">
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

                    <div className="grid gap-4 md:grid-cols-2 mb-6 p-4 bg-slate-50 rounded-xl">
                        <div>
                            <label className="block text-sm font-medium mb-1">학급 명칭</label>
                            <input
                                type="text"
                                value={newClassName}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewClassName(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white"
                                placeholder="예: 1학년 3반"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">접속 세션 코드 (중복 불가)</label>
                            <input
                                type="text"
                                value={newSessionCode}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewSessionCode(e.target.value)}
                                className="w-full p-2 border rounded-lg bg-white"
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
                        <h3 className="font-medium text-slate-700">운영 중인 학급 ({classes.length})</h3>
                        {classes.map(c => (
                            <div key={c.id} className="flex justify-between items-center p-4 border rounded-xl hover:bg-slate-50 transition-colors">
                                <div>
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-sm text-slate-500">코드: <code className="bg-slate-200 px-1 rounded">{c.session_code}</code></div>
                                </div>
                                <button
                                    onClick={() => handleDeleteClass(c.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        ))}
                        {classes.length === 0 && (
                            <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border-dashed border-2">
                                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                                등록된 학급이 없습니다.
                            </div>
                        )}
                    </div>
                </section>

                <div className="flex justify-start">
                    <Link href="/teacher" className="text-slate-500 hover:underline text-sm">
                        ← 대시보드로 돌아가기
                    </Link>
                </div>
            </div>
        </div>
    );
}
