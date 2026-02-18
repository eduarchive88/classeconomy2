// Quiz Management Page
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
// GoogleGenerativeAI는 서버 API 라우트에서 사용하므로 클라이언트에서 제거
import { Loader2, Plus, Upload, Wand2, Save, Trash2, FileText, BarChart2, X, RefreshCw, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';
import Footer from '@/components/Footer';

export default function QuizManagement() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [generatedQuizzes, setGeneratedQuizzes] = useState<any[]>([]);
    const [topic, setTopic] = useState('');
    const [difficulty, setDifficulty] = useState('중');
    const [count, setCount] = useState(5);
    const [saving, setSaving] = useState(false);

    // Today's Quiz State
    const [todayQuiz, setTodayQuiz] = useState<any>(null);
    const [todayQuizLoading, setTodayQuizLoading] = useState(false);

    // Modal States
    const [showManualModal, setShowManualModal] = useState(false);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [selectedQuiz, setSelectedQuiz] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [statsLoading, setStatsLoading] = useState(false);

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

    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = () => {
        fetchQuizzes();
        fetchTodayQuiz();
    };

    const fetchTodayQuiz = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setTodayQuizLoading(true);
        try {
            // Get today's date in YYYY-MM-DD format (local)
            const today = new Date().toISOString().split('T')[0];

            const { data, error } = await supabase
                .from('daily_quizzes')
                .select('*, quiz:quiz_id(*)')
                .eq('class_id', selectedClassId)
                .eq('date', today)
                .maybeSingle();

            if (error && error.code !== 'PGRST116') throw error;
            setTodayQuiz(data);
        } catch (e) {
            console.error('Fetch Today Quiz Error:', e);
        } finally {
            setTodayQuizLoading(false);
        }
    };

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
                const ids = dailyIds.map((d: any) => d.id);
                // Get submissions including the new 'choice' field
                const { data: subs } = await supabase
                    .from('quiz_submissions')
                    .select('student_id, is_correct, choice, created_at, student_roster(name, number)')
                    .in('daily_quiz_id', ids);

                if (subs) solvers = subs;
            }

            // Calculate stats
            const totalAttempts = solvers.length;
            const correctCount = solvers.filter((s: any) => s.is_correct).length;
            const correctRate = totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 0;
            const counts: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };

            solvers.forEach((s: any) => {
                if (s.choice) {
                    counts[s.choice] = (counts[s.choice] || 0) + 1;
                }
            });

            setStats({
                totalAttempts,
                correctRate,
                counts,
                solvers
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
                setGeneratedQuizzes(formatted);
                setShowPreviewModal(true);
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

            setGeneratedQuizzes(data.quizzes);
            setShowPreviewModal(true);
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

        setGeneratedQuizzes([formatted]);
        setShowPreviewModal(true);
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
        <div className="container mx-auto p-4 max-w-7xl pb-20">
            {/* Header Section */}
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
                    <ClassSelector onClassChange={fetchData} />
                    <button
                        onClick={() => setShowManualModal(true)}
                        className="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all text-sm font-bold"
                    >
                        <Plus className="w-5 h-5 font-bold" />
                        <span>새 퀴즈 만들기</span>
                    </button>
                </div>
            </div>

            {/* Today's Quiz Status Banner */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl shadow-xl p-6 mb-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Wand2 className="w-32 h-32" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/30 border border-blue-400/30 text-xs font-bold mb-3 uppercase tracking-wider">
                            <RefreshCw className="w-3 h-3" />
                            Today's Mission
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black mb-2">오늘의 퀴즈 상태</h2>

                        {todayQuizLoading ? (
                            <div className="flex items-center gap-2 text-blue-100 italic">
                                <Loader2 className="w-5 h-5 animate-spin" /> 확인 중...
                            </div>
                        ) : todayQuiz ? (
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-lg bg-green-500 text-[10px] font-bold">배포 완료</span>
                                    <span className="text-blue-50 font-medium">Q. {todayQuiz.quiz?.question || '데이터 없음'}</span>
                                </div>
                                <p className="text-xs text-blue-200 ml-16">배포일: {todayQuiz.date}</p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-red-400 text-[10px] font-bold">미배포</span>
                                <p className="text-blue-50">오늘 배출된 퀴즈가 아직 없습니다.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={async () => {
                                if (!confirm('오늘의 퀴즈를 수동으로 배포하시겠습니까?\n(이미 배포된 반은 제외됩니다.)')) return;
                                try {
                                    const res = await fetch('/api/cron/daily-quiz');
                                    const data = await res.json();
                                    if (data.success) {
                                        alert('퀴즈 배포가 완료되었습니다.');
                                        fetchTodayQuiz();
                                    } else {
                                        alert('배포 실패: ' + JSON.stringify(data));
                                    }
                                } catch (e: any) {
                                    alert('오류: ' + e.message);
                                }
                            }}
                            className="bg-white text-blue-700 hover:bg-blue-50 px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
                        >
                            <RefreshCw className="w-5 h-5" />
                            오늘의 퀴즈 즉시 배포
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Quiz List */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            퀴즈 라이브러리 <span className="text-base font-medium text-slate-400">({quizzes.length})</span>
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">지금까지 생성된 모든 퀴즈 목록입니다.</p>
                    </div>
                </div>

                {quizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {quizzes.map((quiz) => (
                            <div key={quiz.id}
                                onClick={() => handleShowStats(quiz)}
                                className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all cursor-pointer group hover:shadow-xl relative"
                            >
                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                                        className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="mb-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                            상금 ₩{quiz.reward?.toLocaleString()}
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">Q. {quiz.question}</h3>
                                </div>

                                <div className="space-y-2 mb-6 opacity-60">
                                    {(() => {
                                        try {
                                            const opts = typeof quiz.options === 'string' ? JSON.parse(quiz.options) : quiz.options;
                                            if (Array.isArray(opts)) {
                                                return opts.slice(0, 2).map((opt, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                                        <div className="w-5 h-5 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[10px] shrink-0">{idx + 1}</div>
                                                        <span className="truncate">{opt}</span>
                                                    </div>
                                                ));
                                            }
                                        } catch (e) { }
                                    })()}
                                    <div className="text-[10px] text-slate-400">... 자세히 보려면 클릭</div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></div>
                                        <span className="text-xs font-bold text-slate-500">정답: {quiz.answer}번</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                        <BarChart2 className="w-3.5 h-3.5" />
                                        통계 보기
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24 text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                        <FileText className="w-16 h-16 mx-auto mb-4 opacity-10" />
                        <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400">등록된 퀴즈가 없습니다.</h3>
                        <p className="text-sm mt-2">새 퀴즈를 등록하여 학생들에게 경제 지식을 공유해보세요!</p>
                        <button
                            onClick={() => setShowManualModal(true)}
                            className="mt-6 btn-primary py-3 px-8 rounded-2xl shadow-lg inline-flex items-center gap-2"
                        >
                            <Plus className="w-5 h-5" /> 퀴즈 등록하기
                        </button>
                    </div>
                )}
            </div>

            {/* Registration Choice Modal */}
            {showManualModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-white/20">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                                        <Plus className="w-7 h-7 text-blue-600" />
                                    </div>
                                    새로운 퀴즈 등록
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">퀴즈를 생성할 방법을 선택하거나 직접 입력해주세요.</p>
                            </div>
                            <button onClick={() => setShowManualModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                                <X className="w-8 h-8" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Left Side: AI & File */}
                                <div className="space-y-6">
                                    <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 p-8 rounded-[2rem] border border-blue-100 dark:border-blue-800 transition-all hover:shadow-lg">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600 text-[10px] font-black text-white mb-6 tracking-tighter shadow-md">
                                            <Wand2 className="w-3 h-3" /> 추천 방식
                                        </div>
                                        <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">AI 지능형 퀴즈 생성</h4>
                                        <div className="space-y-5">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Quiz Topic</label>
                                                <input
                                                    type="text"
                                                    value={topic}
                                                    onChange={(e) => setTopic(e.target.value)}
                                                    placeholder="예: 현대의 암호화폐, 화폐의 진화 등"
                                                    className="w-full p-4 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 outline-none shadow-sm dark:shadow-none placeholder:text-slate-300"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Level</label>
                                                    <select
                                                        value={difficulty}
                                                        onChange={(e) => setDifficulty(e.target.value)}
                                                        className="w-full p-4 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none"
                                                    >
                                                        <option value="상">난이도 상 (전문화)</option>
                                                        <option value="중">난이도 중 (일반)</option>
                                                        <option value="하">난이도 하 (기초)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Quantity</label>
                                                    <select
                                                        value={count}
                                                        onChange={(e) => setCount(Number(e.target.value))}
                                                        className="w-full p-4 bg-white dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 shadow-sm outline-none"
                                                    >
                                                        <option value={3}>3문항 생성</option>
                                                        <option value={5}>5문항 생성</option>
                                                        <option value={10}>10문항 생성</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <button
                                                onClick={generateAIQuizzes}
                                                disabled={loading}
                                                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none flex justify-center items-center gap-3 transform transition-all active:scale-95"
                                            >
                                                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                                                AI로 최적의 퀴즈 만들기
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-900/40 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 relative hover:bg-white dark:hover:bg-slate-900/60 transition-all cursor-pointer overflow-hidden group">
                                        <div className="flex flex-col items-center text-center">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                                <Upload className="w-8 h-8 text-slate-400" />
                                            </div>
                                            <h4 className="font-bold text-slate-700 dark:text-slate-300">Excel 대량 시트 업로드</h4>
                                            <p className="text-xs text-slate-400 mt-2 mb-6 max-w-[200px]">대량의 문제를 한 번에 등록하고 싶을 때 사용하세요.</p>

                                            <input
                                                type="file"
                                                accept=".xlsx, .xls"
                                                onChange={handleFileUpload}
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                            />
                                            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                파일 탐색기 열기
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Manual Form */}
                                <div className="bg-white dark:bg-slate-900/50 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                                    <div className="flex items-center justify-between mb-8">
                                        <h4 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">직접 문항 입력</h4>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">Question Content</label>
                                            <textarea
                                                className="w-full p-5 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 outline-none shadow-inner"
                                                rows={3}
                                                value={manualQuiz.question}
                                                onChange={e => setManualQuiz({ ...manualQuiz, question: e.target.value })}
                                                placeholder="학생들에게 물어볼 핵심 질문을 작성하세요"
                                            />
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {[1, 2, 3, 4].map(num => (
                                                <div key={num} className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400">{num}</div>
                                                    <input
                                                        type="text"
                                                        placeholder={`보기 ${num} 입력`}
                                                        className="flex-1 p-3.5 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-4 focus:ring-blue-500/10 outline-none shadow-inner"
                                                        value={(manualQuiz as any)[`option${num}`]}
                                                        onChange={e => setManualQuiz({ ...manualQuiz, [`option${num}`]: e.target.value })}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Correct Answer</label>
                                                <select
                                                    className="w-full p-4 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 shadow-inner outline-none"
                                                    value={manualQuiz.answer}
                                                    onChange={e => setManualQuiz({ ...manualQuiz, answer: Number(e.target.value) })}
                                                >
                                                    {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}번이 정답</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Prize Reward</label>
                                                <div className="relative">
                                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₩</span>
                                                    <input
                                                        type="number"
                                                        className="w-full p-4 pl-8 bg-slate-50 dark:bg-slate-900 border-none rounded-2xl text-sm focus:ring-4 focus:ring-blue-500/10 shadow-inner outline-none font-bold text-blue-600"
                                                        value={manualQuiz.reward}
                                                        onChange={e => setManualQuiz({ ...manualQuiz, reward: Number(e.target.value) })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleManualSubmit}
                                            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95"
                                        >
                                            이 문제를 리스트에 대기시키기
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generated Quizzes Preview Modal */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-white/20">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 z-10">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                        <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
                                            <Wand2 className="w-7 h-7 text-green-600" />
                                        </div>
                                        생성된 퀴즈 검토
                                    </h3>
                                    <p className="text-slate-500 text-sm mt-1">저장하기 전에 내용을 확인해주세요.</p>
                                </div>
                                <button onClick={() => setShowPreviewModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400">
                                    <X className="w-8 h-8" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-hide">
                            {generatedQuizzes.map((q, i) => (
                                <div key={i} className="group bg-slate-50 dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 relative transition-all hover:bg-white dark:hover:bg-slate-900">
                                    <button
                                        onClick={() => removeGenerated(i)}
                                        className="absolute top-4 right-4 p-2 bg-white dark:bg-slate-800 text-slate-300 hover:text-red-500 rounded-xl shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="px-3 py-1 bg-blue-100/50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-lg">QUEST {i + 1}</span>
                                        <span className="px-3 py-1 bg-amber-100/50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-[10px] font-black rounded-lg">₩{q.reward?.toLocaleString()}</span>
                                    </div>
                                    <h4 className="font-bold text-slate-800 dark:text-white mb-4 pr-10 leading-snug">{q.question}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {q.options.map((opt: string, idx: number) => (
                                            <div key={idx} className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${q.answer === idx + 1 ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 text-green-700 dark:text-green-400 font-bold' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500'}`}>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${q.answer === idx + 1 ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-700'}`}>{idx + 1}</div>
                                                <span className="truncate">{opt}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-4">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    className="flex-1 px-8 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-white rounded-2xl font-bold border border-slate-200 dark:border-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    수정하기 (뒤로)
                                </button>
                                <button
                                    onClick={saveQuizzes}
                                    disabled={saving || generatedQuizzes.length === 0}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50 flex justify-center items-center gap-3 transition-all active:scale-95"
                                >
                                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                    {generatedQuizzes.length}개의 퀴즈 즉시 저장 & 라이브러리 추가
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-400 font-medium italic">저장 버튼 클릭 시 선택한 클래스의 학생들에게 퀴즈가 공개될 수 있도록 라이브러리에 저장됩니다.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Existing Stats Modal (Already implemented by handleShowStats) */}
            {selectedQuiz && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[80] p-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                    <BarChart2 className="w-6 h-6 text-blue-600" />
                                    퀴즈 결과 데이터
                                </h3>
                                <p className="text-slate-500 text-sm mt-1">학생들의 실시간 퀴즈 정답률과 참여 통계입니다.</p>
                            </div>
                            <button onClick={() => setSelectedQuiz(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="mb-8">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Question</p>
                                <h4 className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{selectedQuiz.question}</h4>
                            </div>

                            {statsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                                    <p className="text-slate-400 font-bold animate-pulse">통계 데이터를 가져오는 중...</p>
                                </div>
                            ) : stats ? (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-3xl text-center">
                                            <div className="text-3xl font-black text-blue-600 mb-1">{stats.totalAttempts}명</div>
                                            <div className="text-xs font-bold text-blue-400 uppercase">전체 참여 인원</div>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-3xl text-center">
                                            <div className="text-3xl font-black text-green-600 mb-1">{stats.correctRate}%</div>
                                            <div className="text-xs font-bold text-green-400 uppercase">평균 정답률</div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h5 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <Users className="w-4 h-4" /> 문항별 선택 비율
                                        </h5>
                                        <div className="space-y-3">
                                            {(typeof selectedQuiz.options === 'string' ? JSON.parse(selectedQuiz.options) : selectedQuiz.options).map((opt: string, idx: number) => {
                                                const choiceIdx = idx + 1;
                                                const count = stats.counts[choiceIdx] || 0;
                                                const percentage = stats.totalAttempts > 0 ? Math.round((count / stats.totalAttempts) * 100) : 0;
                                                return (
                                                    <div key={idx} className="space-y-1.5">
                                                        <div className="flex justify-between text-xs font-bold">
                                                            <span className={selectedQuiz.answer === choiceIdx ? 'text-green-600' : 'text-slate-500'}>
                                                                {choiceIdx}번. {opt} {selectedQuiz.answer === choiceIdx && '(정답)'}
                                                            </span>
                                                            <span className="text-slate-400">{count}명 ({percentage}%)</span>
                                                        </div>
                                                        <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${selectedQuiz.answer === choiceIdx ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-3xl">
                                    <p className="text-slate-400">데이터가 확보되지 않았습니다.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            <Footer />
        </div>
    );
}
