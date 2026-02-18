// Quiz Management Page
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
// GoogleGenerativeAI는 서버 API 라우트에서 사용하므로 클라이언트에서 제거
import { Loader2, Plus, Upload, Wand2, Save, Trash2, FileText, BarChart2, X, RefreshCw, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function QuizManagement() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [generatedQuizzes, setGeneratedQuizzes] = useState<any[]>([]);
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('중');
    const [count, setCount] = useState(5);
    const [saving, setSaving] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [manualQuiz, setManualQuiz] = useState({
        question: '',
        option1: '',
        option2: '',
        option3: '',
        option4: '',
        answer: 1,
        explanation: '정답입니다',
        reward: 500
    });

    // Stats Modal
    const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        fetchQuizzes();
    }, []);

    const fetchQuizzes = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        const { data, error } = await supabase
            .from('quizzes')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('created_at', { ascending: false });

        if (data) setQuizzes(data);
    };

    const handleDeleteQuiz = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까? 관련 데이터(배포 기록, 학생 풀이 등)가 모두 삭제될 수 있습니다.')) return;

        const { error } = await supabase.from('quizzes').delete().eq('id', id);
        if (error) {
            alert('삭제 실패: ' + error.message);
        } else {
            fetchQuizzes();
        }
    };

    const handleShowStats = async (quiz: any) => {
        setSelectedQuiz(quiz);
        setStatsLoading(true);
        setStats(null);

        try {
            // 1. Distribution Count
            const { count: distCount } = await supabase
                .from('daily_quizzes')
                .select('*', { count: 'exact', head: true })
                .eq('quiz_id', quiz.id);

            // 2. Solvers
            // Get all daily_quiz_ids for this quiz
            const { data: dailyIds } = await supabase
                .from('daily_quizzes')
                .select('id')
                .eq('quiz_id', quiz.id);

            let solvers: any[] = [];
            if (dailyIds && dailyIds.length > 0) {
                const ids = dailyIds.map(d => d.id);
                // Get submissions
                const { data: subs } = await supabase
                    .from('quiz_submissions')
                    .select('student_id, is_correct, created_at, student_roster(name, number)')
                    .in('daily_quiz_id', ids);

                if (subs) solvers = subs;
            }

            setStats({
                distributionCount: distCount || 0,
                solvers: solvers
            });
        } catch (e: any) {
            console.error(e);
            alert('통계 불러오기 실패');
        } finally {
            setStatsLoading(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            // Strategy 1: Attempt to parse by headers
            const data = XLSX.utils.sheet_to_json(ws);

            // Helper to find value by multiple keys (case-insensitive)
            const findValue = (item: any, keys: string[]) => {
                for (const key of keys) {
                    if (item[key] !== undefined) return item[key];
                    // Exact match case-insensitive
                    const lowerKey = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
                    if (lowerKey) return item[lowerKey];
                    // Partial match for specific Korean keys
                    if (key === '정답' || key === '문제') {
                        const partialKey = Object.keys(item).find(k => k.includes(key));
                        if (partialKey) return item[partialKey];
                    }
                }
                return undefined;
            };

            let formatted: any[] = data.map((item: any) => {
                const question = findValue(item, ['문제', '질문', 'question', 'q']);
                const rawOptions = findValue(item, ['보기', '선택지', 'options', 'opt']);
                // Added '정답(O/X)' explicitly or via partial match logic
                const answer = findValue(item, ['정답', '답', 'answer', 'a', '정답(O/X)']);
                const explanation = findValue(item, ['해설', '설명', 'explanation', 'exp']);
                const reward = findValue(item, ['상금', '포인트', 'reward', 'point']);

                const opt1 = findValue(item, ['보기1', 'option1', 'opt1', '1']);
                const opt2 = findValue(item, ['보기2', 'option2', 'opt2', '2']);
                const opt3 = findValue(item, ['보기3', 'option3', 'opt3', '3']);
                const opt4 = findValue(item, ['보기4', 'option4', 'opt4', '4']);

                let options: string[] = [];
                if (typeof rawOptions === 'string') {
                    options = rawOptions.split(/,|\n|\r\n/).map(s => s.trim()).filter(Boolean);
                } else if (opt1 || opt2) {
                    options = [opt1, opt2, opt3, opt4].filter(Boolean).map(String);
                }

                return {
                    question,
                    options,
                    answer,
                    explanation,
                    reward: reward || 500
                };
            }).filter((q: any) => q.question && q.options && q.options.length > 0 && q.answer); // Ensure answer exists

            // Strategy 2: Fallback to strict column index (Header: 1)
            // A=Question, B-E=Options, F=Answer, G=Reward
            if (formatted.length === 0) {
                const dataArray = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                // Skip header if first row resembles header
                const firstRow = dataArray[0];
                const isHeader = firstRow && (
                    String(firstRow[0]).includes('문제') ||
                    String(firstRow[0]).toLowerCase().includes('question') ||
                    String(firstRow[0]) === 'A'
                );
                const startIndex = isHeader ? 1 : 0;

                for (let i = startIndex; i < dataArray.length; i++) {
                    const row = dataArray[i];
                    if (!row || row.length < 2) continue;

                    // 0: Question, 1-4: Opts, 5: Ans, 6: Rwd
                    const qText = row[0];
                    if (!qText) continue;

                    const opts = [row[1], row[2], row[3], row[4]].filter(Boolean).map(String);
                    if (opts.length < 2) continue;

                    const ansRaw = row[5];
                    const rwd = row[6] || 500;

                    let ansNum = 1;
                    if (typeof ansRaw === 'number') {
                        ansNum = ansRaw;
                    } else if (typeof ansRaw === 'string') {
                        const parsed = parseInt(ansRaw);
                        if (!isNaN(parsed)) {
                            ansNum = parsed;
                        } else {
                            const idx = opts.findIndex(o => o.trim() === ansRaw.trim());
                            if (idx !== -1) ansNum = idx + 1;
                        }
                    }

                    formatted.push({
                        question: qText,
                        options: opts,
                        answer: ansNum,
                        explanation: '',
                        reward: Number(rwd)
                    });
                }
            }

            if (formatted.length === 0) {
                alert('엑셀 파일에서 유효한 퀴즈를 찾지 못했습니다.\n\n[지원 형식]\n1. 헤더 인식: 문제, 보기, 정답, 상금\n2. 컬럼 고정: A열(문제), B~E열(보기), F열(정답), G열(상금)');
            } else {
                alert(`${formatted.length}개의 퀴즈를 불러왔습니다.`);
                setGeneratedQuizzes((prev: any) => [...prev, ...formatted]);
            }
        };
        reader.readAsBinaryString(file);
    };

    // AI 퀴즈 생성 - 서버 API 라우트를 통해 생성 (교사 설정 API 키 자동 사용)
    const generateAIQuizzes = async () => {
        if (!topic) return alert('주제를 입력해주세요.');

        setLoading(true);
        try {
            // 서버 API가 프롬프트를 구성하므로 주제(topic)만 전송
            const res = await fetch('/api/teacher/quizzes/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: topic,
                    difficulty,
                    count
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'AI 퀴즈 생성 실패');
            }

            setGeneratedQuizzes([...generatedQuizzes, ...data.quizzes]);
        } catch (e: any) {
            alert('생성 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const saveQuizzes = async () => {
        if (generatedQuizzes.length === 0) return;

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return alert('반을 선택해주세요.');

        setSaving(true);
        try {
            const payload = {
                quizzes: generatedQuizzes,
                class_id: selectedClassId // Correct field name for API
            };

            const response = await fetch('/api/teacher/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('저장 실패');

            alert('저장되었습니다.');
            setGeneratedQuizzes([]);
            fetchQuizzes();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setSaving(false);
        }
    };

    const removeGenerated = (index: number) => {
        setGeneratedQuizzes(generatedQuizzes.filter((_, i) => i !== index));
    };

    const handleManualSubmit = () => {
        if (!manualQuiz.question || !manualQuiz.option1 || !manualQuiz.option2 || !manualQuiz.option3 || !manualQuiz.option4) {
            return alert('모든 항목을 입력해주세요.');
        }

        const formatted = {
            question: manualQuiz.question,
            options: [manualQuiz.option1, manualQuiz.option2, manualQuiz.option3, manualQuiz.option4],
            answer: Number(manualQuiz.answer),
            explanation: manualQuiz.explanation,
            reward: Number(manualQuiz.reward)
        };

        setGeneratedQuizzes([...generatedQuizzes, formatted]);
        setShowManualModal(false);
        setManualQuiz({
            question: '',
            option1: '',
            option2: '',
            option3: '',
            option4: '',
            answer: 1,
            explanation: '정답입니다',
            reward: 500
        });
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
            <div className="flex items-center gap-4 w-full md:w-auto">
                <Link
                    href="/teacher"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FileText className="w-8 h-8 text-blue-600" />
                    퀴즈 관리
                </h1>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <ClassSelector onClassChange={fetchQuizzes} />

                <button
                    onClick={async () => {
                        if (!confirm('오늘의 퀴즈를 수동으로 배포하시겠습니까?\n(이미 배포된 반은 제외됩니다.)')) return;
                        try {
                            const res = await fetch('/api/cron/daily-quiz');
                            const data = await res.json();
                            if (data.success) {
                                alert('퀴즈 배포가 완료되었습니다.');
                            } else {
                                alert('배포 실패: ' + JSON.stringify(data));
                            }
                        } catch (e: any) {
                            alert('오류: ' + e.message);
                        }
                    }}
                    className="btn-secondary py-2 px-4 flex items-center gap-2 bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
                >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden md:inline">오늘의 퀴즈 배포</span>
                </button>

                <button
                    onClick={() => setShowManualModal(true)}
                    className="btn-primary py-2 px-5 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                >
                    <Plus className="w-5 h-5" />
                    <span>새 퀴즈 등록</span>
                </button>
            </div>
        </div>

            {/* Quiz Stats Overview / Dashboard could go here */ }

    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                <FileText className="w-5 h-5 text-slate-500" />
                퀴즈 목록 <span className="text-sm font-normal text-slate-500">({quizzes.length}개)</span>
            </h2>
            {/* Filter/Search could go here */}
        </div>

        {quizzes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {quizzes.map((quiz) => (
                    <div key={quiz.id}
                        onClick={() => handleShowStats(quiz)}
                        className="bg-slate-50 dark:bg-slate-700/50 p-5 rounded-xl border border-slate-100 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-500 transition-all cursor-pointer group hover:shadow-md relative"
                    >
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                                className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                title="삭제"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="mb-3 pr-8">
                            <span className="inline-block px-2 py-0.5 rounded textxs font-medium bg-blue-100 text-blue-700 mb-2">
                                상금 {quiz.reward?.toLocaleString()}원
                            </span>
                            <p className="font-bold text-slate-800 dark:text-slate-100 line-clamp-2">Q. {quiz.question}</p>
                        </div>

                        <div className="space-y-1.5 mb-4">
                            {/* Simplified Options Display */}
                            {(() => {
                                try {
                                    const options = typeof quiz.options === 'string' ? JSON.parse(quiz.options) : quiz.options;
                                    if (Array.isArray(options)) {
                                        // Show only first 2 options or summary
                                        return (
                                            <div className="text-sm text-slate-500 dark:text-slate-400">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">1</span>
                                                    <span className="truncate">{options[0]}</span>
                                                </div>
                                                {options.length > 1 && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-600">2</span>
                                                        <span className="truncate">{options[1]}</span>
                                                    </div>
                                                )}
                                                {options.length > 2 && <div className="text-xs text-slate-400 mt-1">+ {options.length - 2} more</div>}
                                            </div>
                                        );
                                    }
                                } catch (e) { }
                            })()}
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-600">
                            <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                                정답: {quiz.answer}번
                            </div>
                            <div className="flex items-center gap-1 text-xs text-blue-600 hover:underline">
                                <BarChart2 className="w-3 h-3" />
                                통계 보기
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        ) : (
            <div className="text-center py-20 text-slate-400 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-dashed border-slate-300">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>등록된 퀴즈가 없습니다.</p>
                <p className="text-sm mt-1">새 퀴즈를 등록하여 학생들에게 문제를 출제해보세요.</p>
            </div>
        )}
    </div>

    {/* Unified Registration Modal */ }
    {
        showManualModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Plus className="w-6 h-6 text-blue-600" />
                            퀴즈 등록
                        </h3>
                        <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: AI & Excel */}
                            <div className="space-y-8">
                                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                                    <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2">
                                        <Wand2 className="w-5 h-5" /> AI로 퀴즈 생성
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1.5 text-slate-600">주제</label>
                                            <input
                                                type="text"
                                                value={topic}
                                                onChange={(e) => setTopic(e.target.value)}
                                                placeholder="예: 화폐의 역사, 수요와 공급"
                                                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5 text-slate-600">난이도</label>
                                                <select
                                                    value={difficulty}
                                                    onChange={(e) => setDifficulty(e.target.value)}
                                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm"
                                                >
                                                    <option value="상">상</option>
                                                    <option value="중">중</option>
                                                    <option value="하">하</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-1.5 text-slate-600">문항 수</label>
                                                <select
                                                    value={count}
                                                    onChange={(e) => setCount(Number(e.target.value))}
                                                    className="w-full p-2.5 border border-slate-200 rounded-lg text-sm"
                                                >
                                                    <option value={3}>3문제</option>
                                                    <option value={5}>5문제</option>
                                                    <option value={10}>10문제</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button
                                            onClick={generateAIQuizzes}
                                            disabled={loading}
                                            className="w-full btn-primary py-2.5 flex justify-center items-center gap-2 text-sm"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                            AI 퀴즈 생성하기
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300">
                                    <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                        <Upload className="w-5 h-5" /> 엑셀 업로드
                                    </h4>
                                    <p className="text-xs text-slate-500 mb-4">
                                        문제, 보기1~4, 정답, 상금 컬럼이 포함된 엑셀 파일을 업로드하세요.
                                    </p>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="block w-full text-sm text-slate-500
                                                file:mr-4 file:py-2 file:px-4
                                                file:rounded-full file:border-0
                                                file:text-sm file:font-semibold
                                                file:bg-slate-200 file:text-slate-700
                                                hover:file:bg-slate-300 cursor-pointer"
                                    />
                                </div>
                            </div>

                            {/* Right: Manual Input */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <Plus className="w-5 h-5" /> 직접 입력
                                    </h4>
                                    {generatedQuizzes.length > 0 && (
                                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                            {generatedQuizzes.length}개 생성됨 (저장 대기)
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Question</label>
                                        <textarea
                                            className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            rows={2}
                                            value={manualQuiz.question}
                                            onChange={e => setManualQuiz({ ...manualQuiz, question: e.target.value })}
                                            placeholder="문제를 입력하세요"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                        {[1, 2, 3, 4].map(num => (
                                            <div key={num} className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{num}</div>
                                                <input
                                                    type="text"
                                                    placeholder={`보기 ${num}`}
                                                    className="flex-1 p-2 border rounded-lg text-sm"
                                                    value={(manualQuiz as any)[`option${num}`]}
                                                    onChange={e => setManualQuiz({ ...manualQuiz, [`option${num}`]: e.target.value })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Answer</label>
                                            <select
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={manualQuiz.answer}
                                                onChange={e => setManualQuiz({ ...manualQuiz, answer: Number(e.target.value) })}
                                            >
                                                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}번</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Reward</label>
                                            <input
                                                type="number"
                                                className="w-full p-2 border rounded-lg text-sm"
                                                value={manualQuiz.reward}
                                                onChange={e => setManualQuiz({ ...manualQuiz, reward: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <button onClick={handleManualSubmit} className="w-full btn-secondary py-2 text-sm">
                                        리스트에 추가
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Generated Preview Area */}
                        {generatedQuizzes.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-lg">생성된 퀴즈 확인 ({generatedQuizzes.length})</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto p-1">
                                    {generatedQuizzes.map((q, i) => (
                                        <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                                            <button
                                                onClick={() => removeGenerated(i)}
                                                className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 bg-white rounded-full shadow-sm"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                            <p className="font-bold text-sm mb-2 pr-6 line-clamp-1">{q.question}</p>
                                            <div className="text-xs text-slate-500 mb-2">
                                                정답: <span className="font-bold text-blue-600">{q.answer}번</span> | 상금: {q.reward}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3 bg-slate-50/50">
                        <button
                            onClick={() => setShowManualModal(false)}
                            className="px-5 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors font-medium"
                        >
                            취소
                        </button>
                        <button
                            onClick={saveQuizzes}
                            disabled={saving || generatedQuizzes.length === 0}
                            className="btn-primary px-8 py-2.5 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {generatedQuizzes.length}개 퀴즈 저장하기
                        </button>
                    </div>
                </div>
            </div>
        )
    }
        </div >
    );
}
