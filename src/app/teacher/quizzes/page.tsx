
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
import { Upload, Sparkles, Save, RotateCw, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function QuizManagement() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [apiKey, setApiKey] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [aiGenerating, setAiGenerating] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        // Load API key from local storage or profile if possible?
        const savedKey = localStorage.getItem('google_api_key');
        if (savedKey) setApiKey(savedKey);
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Parse Logic: A:Question, B:Option1, C:Option2, D:Option3, E:Option4, F:Answer(1-4), G:Reward
            const parsedQuizzes = data.slice(1).map((row: any) => ({
                question: row[0],
                options: [row[1], row[2], row[3], row[4]].filter(Boolean),
                answer: Number(row[5]),
                reward: Number(row[6]) || 500, // Default reward
            })).filter((q: any) => q.question && q.options.length >= 2 && q.answer);

            setQuizzes([...quizzes, ...parsedQuizzes]);
        };
        reader.readAsBinaryString(file);
    };

    const handleAiGenerate = async () => {
        if (!apiKey) return alert('Google API 키를 입력해주세요.');
        if (!aiPrompt) return alert('주제를 입력해주세요.');

        setAiGenerating(true);
        try {
            localStorage.setItem('google_api_key', apiKey); // Save for later

            const res = await fetch('/api/teacher/quizzes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt, apiKey }),
            });

            if (!res.ok) throw new Error((await res.json()).error);

            const { quizzes: newQuizzes } = await res.json();
            setQuizzes([...quizzes, ...newQuizzes]);
            alert(`${newQuizzes.length}개의 퀴즈가 생성되었습니다.`);
        } catch (e: any) {
            alert('AI 생성 오류: ' + e.message);
        } finally {
            setAiGenerating(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizzes }),
            });

            if (!res.ok) throw new Error((await res.json()).error);

            alert('퀴즈가 성공적으로 등록되었습니다.');
            setQuizzes([]);
        } catch (e: any) {
            alert('오류 발생: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/teacher"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title="대시보드로 돌아가기"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">퀴즈 관리 (문제은행)</h1>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-emerald-600" />
                            엑셀 일괄 등록
                        </h2>
                        <div className="space-y-4">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700"
                            />
                            <div className="text-xs text-slate-500 space-y-1">
                                <p>양식: A(문제), B~E(보기), F(정답번호), G(상금)</p>
                                <a href="/sample_quiz_upload.xlsx" className="text-blue-600 underline">샘플 양식 다운로드</a>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-6 border-indigo-100 bg-indigo-50/50">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-indigo-700">
                            <Sparkles className="w-5 h-5" />
                            AI 자동 생성
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Google API Key</label>
                                <input
                                    type="password"
                                    value={apiKey}
                                    onChange={e => setApiKey(e.target.value)}
                                    className="w-full p-2 border rounded-lg bg-white"
                                    placeholder="AI_..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">퀴즈 주제</label>
                                <input
                                    type="text"
                                    value={aiPrompt}
                                    onChange={e => setAiPrompt(e.target.value)}
                                    className="w-full p-2 border rounded-lg bg-white"
                                    placeholder="예: 기초 경제 용어, 환율과 금리"
                                />
                            </div>
                            <button
                                onClick={handleAiGenerate}
                                disabled={aiGenerating}
                                className="btn-primary w-full flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-700"
                            >
                                {aiGenerating ? <RotateCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                {aiGenerating ? '생성 중...' : 'AI로 문제 만들기'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">등록 대기 문제 ({quizzes.length}개)</h2>
                        {quizzes.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? '저장 중...' : '저장하기'}
                            </button>
                        )}
                    </div>

                    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                        {quizzes.map((q, i) => (
                            <div key={i} className="p-4 border rounded-lg bg-white hover:shadow-sm transition">
                                <div className="flex justify-between mb-2">
                                    <h3 className="font-medium text-slate-800">Q. {q.question}</h3>
                                    <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full h-fit">{q.reward}원</span>
                                </div>
                                <ul className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                                    {q.options.map((opt: string, idx: number) => (
                                        <li key={idx} className={`${idx + 1 === q.answer ? 'text-emerald-600 font-bold' : ''}`}>
                                            {idx + 1}. {opt}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        {quizzes.length === 0 && (
                            <div className="text-center py-12 text-slate-400">
                                문제가 없습니다. 엑셀을 업로드하거나 AI로 생성해보세요.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
