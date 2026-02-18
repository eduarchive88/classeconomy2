// Quiz Management Page
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
import { Loader2, Plus, Upload, Wand2, Save, Trash2, FileText, BarChart2, X, RefreshCw, Users, ArrowLeft, CheckCircle2 } from 'lucide-react';
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
    const [todayQuizzes, setTodayQuizzes] = useState<any[]>([]);
    const [todayQuizLoading, setTodayQuizLoading] = useState(false);

    // Modal States
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
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
            // Get today's date in YYYY-MM-DD format (KST)
            const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

            const { data, error } = await supabase
                .from('daily_quizzes')
                .select('*, quiz:quiz_id(*)')
                .eq('class_id', selectedClassId)
                .eq('date', today);

            if (error) throw error;
            setTodayQuizzes(data || []);
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
            // 1. Get total distribution count for this quiz
            const { count: distCount } = await supabase
                .from('daily_quizzes')
                .select('*', { count: 'exact', head: true })
                .eq('quiz_id', quiz.id);

            // 2. Get solvers info
            const { data: dailyIds } = await supabase
                .from('daily_quizzes')
                .select('id')
                .eq('quiz_id', quiz.id);

            let solvers: any[] = [];
            if (dailyIds && dailyIds.length > 0) {
                const ids = dailyIds.map((d: any) => d.id);
                const { data: subs } = await supabase
                    .from('quiz_submissions')
                    .select('student_id, is_correct, choice, created_at, student_roster(name, number)')
                    .in('daily_quiz_id', ids)
                    .order('created_at', { ascending: false });

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
                solvers,
                totalDistributions: distCount || 0
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

            const data = XLSX.utils.sheet_to_json(ws);

            const findValue = (item: any, keys: string[]) => {
                for (const key of keys) {
                    if (item[key] !== undefined) return item[key];
                    const lowerKey = Object.keys(item).find(k => k.toLowerCase() === key.toLowerCase());
                    if (lowerKey) return item[lowerKey];
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
            }).filter((q: any) => q.question && q.options && q.options.length > 0 && q.answer);

            if (formatted.length === 0) {
                const dataArray = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
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

    const downloadSampleFile = () => {
        const sampleData = [
            {
                '문제': '인플레이션이 발생했을 때 나타나는 현상으로 옳은 것은?',
                '보기1': '물가가 하락한다',
                '보기2': '화폐 가치가 하락한다',
                '보기3': '수출이 유리해진다',
                '보기4': '저축의 실질 가치가 상승한다',
                '정답': 2,
                '상금': 1000,
                '해설': '인플레이션은 물가가 지속적으로 상승하여 화폐 가치가 떨어지는 현상입니다.'
            },
            {
                '문제': '수요와 공급의 법칙에 대한 설명으로 옳은 것은?',
                '보기1': '가격이 오르면 수요량은 늘어난다',
                '보기2': '가격이 내리면 공급량은 늘어난다',
                '보기3': '수요가 공급보다 많으면 가격이 오른다',
                '보기4': '공급이 수요보다 많으면 가격이 오른다',
                '정답': 3,
                '상금': 500,
                '해설': '수요가 공급보다 많으면(초과 수요) 가격이 상승하는 요인이 됩니다.'
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Quiz_Sample");
        XLSX.writeFile(workbook, "퀴즈_업로드_양식_샘플.xlsx");
    };

    const generateAIQuizzes = async () => {
        if (!topic) return alert('주제를 입력해주세요.');

        setLoading(true);
        try {
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
                class_id: selectedClassId
            };

            const response = await fetch('/api/teacher/quizzes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('저장 실패');

            alert('저장되었습니다.');
            setGeneratedQuizzes([]);
            setShowPreviewModal(false);
            setShowRegistrationModal(false);
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
                    <h1 className="text-3xl font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <FileText className="w-8 h-8 text-blue-600" />
                        퀴즈 관리
                    </h1>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                    <ClassSelector onClassChange={fetchData} />
                    <button
                        onClick={() => setShowRegistrationModal(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-6 rounded-2xl flex items-center gap-2 shadow-lg hover:shadow-xl transition-all text-sm font-black"
                    >
                        <Plus className="w-5 h-5" />
                        <span>생성 및 등록</span>
                    </button>
                </div>
            </div>

            {/* Today's Quiz Status Banner */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[2.5rem] shadow-2xl p-8 mb-12 text-white relative overflow-hidden border border-white/10">
                <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12">
                    <Wand2 className="w-48 h-48" />
                </div>

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                    <div className="flex-1">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-md border border-white/20 text-xs font-black mb-4 uppercase tracking-widest">
                            <RefreshCw className="w-3.5 h-3.5" />
                            Daily Statistics
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">오늘의 퀴즈 채널</h2>

                        {todayQuizLoading ? (
                            <div className="flex items-center gap-3 text-blue-100 font-bold italic">
                                <Loader2 className="w-6 h-6 animate-spin" /> 상태를 확인하고 있습니다...
                            </div>
                        ) : todayQuizzes.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {todayQuizzes.map((dq, idx) => (
                                    <div key={dq.id} className="bg-white/15 backdrop-blur-md border border-white/25 p-4 rounded-3xl flex items-center gap-4 group transition-all hover:bg-white/20">
                                        <div className="w-10 h-10 rounded-2xl bg-green-500 shadow-lg shadow-green-500/30 flex items-center justify-center font-black text-sm">#{idx + 1}</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black text-blue-100 uppercase mb-0.5">ACTIVE QUIZ</div>
                                            <div className="text-[15px] font-bold truncate">{dq.quiz?.question || '데이터 없음'}</div>
                                        </div>
                                    </div>
                                ))}
                                {todayQuizzes.length < 2 && (
                                    <div className="border-2 border-dashed border-white/30 p-4 rounded-3xl flex items-center justify-center gap-2 opacity-60">
                                        <p className="text-xs font-bold italic">추가 배포 대기 중...</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 bg-red-500/20 backdrop-blur-sm border border-red-500/30 p-4 rounded-3xl w-fit">
                                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div>
                                <p className="text-sm font-bold text-red-100">오늘 배포된 퀴즈가 아직 없습니다. (매일 오전 8시 자동 배포)</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-3 min-w-[240px]">
                        <button
                            onClick={async () => {
                                if (!confirm('오늘의 퀴즈를 즉시 배포하시겠습니까?\n(이미 2개가 배포된 학급은 제외됩니다.)')) return;
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
                            className="bg-white text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl transition-all active:scale-95 group"
                        >
                            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                            오늘의 퀴즈 즉시 배포
                        </button>
                        <p className="text-center text-[10px] text-blue-200 font-medium">배포 시 학급의 모든 학생들에게 퀴즈가 노출됩니다.</p>
                    </div>
                </div>
            </div>

            {/* Main Quiz List */}
            <div className="bg-white dark:bg-slate-800/50 rounded-[3rem] shadow-sm border border-slate-100 dark:border-slate-800 p-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                            <FileText className="w-8 h-8 text-blue-600" />
                            퀴즈 라이브러리 <span className="text-xl font-bold text-slate-300">({quizzes.length})</span>
                        </h2>
                        <p className="text-slate-500 font-medium mt-2">학생들에게 배포할 수 있는 퀴즈 자산 목록입니다.</p>
                    </div>
                </div>

                {quizzes.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {quizzes.map((quiz) => {
                            const isDistributedToday = todayQuizzes.some(dq => dq.quiz_id === quiz.id);
                            return (
                                <div key={quiz.id}
                                    onClick={() => handleShowStats(quiz)}
                                    className={`group cursor-pointer bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border-2 transition-all hover:scale-[1.02] hover:shadow-2xl active:scale-[0.98] relative flex flex-col min-h-[220px] ${isDistributedToday ? 'border-blue-500 shadow-blue-500/10' : 'border-slate-50 dark:border-slate-800'}`}
                                >
                                    {isDistributedToday && (
                                        <div className="absolute -top-3 left-8 px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black rounded-full shadow-xl z-20 flex items-center gap-1.5 ring-4 ring-white dark:ring-slate-800">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
                                            오늘 배포 중
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-6">
                                        <div className="p-3.5 bg-blue-50 dark:bg-blue-900/30 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                                            <FileText className="w-6 h-6 text-blue-600 group-hover:text-white" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-black text-slate-300 group-hover:text-blue-400 uppercase tracking-tighter transition-colors">₩{quiz.reward?.toLocaleString()} REWARD</span>
                                            <button
                                                onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                                                className="p-2 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight line-clamp-3 mb-2">Q. {quiz.question}</h3>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-50 dark:border-slate-800 flex justify-between items-center">
                                        <div className="flex -space-x-2">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-700"></div>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-black text-xs group-hover:translate-x-1 transition-transform">
                                            <BarChart2 className="w-4 h-4" />
                                            데이터 보기
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="text-center py-32 text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 rounded-[3rem] border-4 border-dashed border-slate-100 dark:border-slate-800">
                        <div className="bg-white dark:bg-slate-800 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200 dark:shadow-none">
                            <Plus className="w-10 h-10 text-slate-200" />
                        </div>
                        <p className="text-lg font-bold">생성된 퀴즈가 없습니다.</p>
                        <p className="text-xs font-medium mt-2">AI로 생성하거나 수동으로 추가해보세요.</p>
                    </div>
                )}
            </div>

            {/* Registration Choice Modal */}
            {showRegistrationModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-lg overflow-hidden shadow-2xl border border-white/20">
                        <div className="p-10">
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h3 className="text-3xl font-black text-slate-800 dark:text-white">퀴즈 등록 방식</h3>
                                    <p className="text-slate-400 font-bold mt-1">어떤 방식으로 퀴즈를 생성할까요?</p>
                                </div>
                                <button onClick={() => setShowRegistrationModal(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                    <X className="w-8 h-8 text-slate-400" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-[2rem] border-2 border-blue-100 dark:border-blue-800/50">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 bg-blue-600 rounded-xl text-white">
                                            <Wand2 className="w-5 h-5" />
                                        </div>
                                        <span className="font-black text-blue-600 dark:text-blue-400">AI 스마트 생성</span>
                                    </div>
                                    <div className="space-y-4">
                                        <input
                                            type="text"
                                            placeholder="주제 (예: 인플레이션, 환율)"
                                            className="w-full bg-white dark:bg-slate-900 border-none rounded-2xl p-4 text-sm font-bold shadow-sm"
                                            value={topic}
                                            onChange={(e) => setTopic(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            {['하', '중', '상'].map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => setDifficulty(d)}
                                                    className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${difficulty === d ? 'bg-blue-600 text-white shadow-lg' : 'bg-white dark:bg-slate-900 text-slate-400'}`}
                                                >
                                                    난이도 {d}
                                                </button>
                                            ))}
                                        </div>
                                        <button
                                            onClick={generateAIQuizzes}
                                            disabled={loading}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50 flex justify-center items-center gap-2 transition-all active:scale-95"
                                        >
                                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Wand2 className="w-6 h-6" />}
                                            AI 퀴즈 생성하기
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-2">
                                        <label className="cursor-pointer bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-blue-400 transition-all group text-center flex-1 flex flex-col justify-center items-center">
                                            <XLSX_Icon />
                                            <span className="block font-black text-sm text-slate-600 dark:text-slate-300 mt-3">엑셀 업로드</span>
                                            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
                                        </label>
                                        <button
                                            onClick={downloadSampleFile}
                                            className="text-[10px] font-bold text-slate-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-1"
                                        >
                                            <Upload className="w-3 h-3" />
                                            샘플 양식 다운로드
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => { setShowRegistrationModal(false); setShowManualModal(true); }}
                                        className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-blue-400 transition-all text-center flex flex-col justify-center items-center"
                                    >
                                        <Plus className="w-8 h-8 text-slate-300 mx-auto" />
                                        <span className="block font-black text-sm text-slate-600 dark:text-slate-300 mt-3">직접 입력</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Creation Modal */}
            {showManualModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in zoom-in-95">
                    <div className="bg-white dark:bg-slate-800 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
                        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white">직접 퀴즈 입력</h3>
                                <p className="text-slate-400 font-bold text-xs mt-1 tracking-tight">수동으로 퀴즈 내용을 작성합니다.</p>
                            </div>
                            <button onClick={() => setShowManualModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">질문 내용</label>
                                <textarea
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-5 text-base font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all min-h-[120px]"
                                    placeholder="학생들에게 낼 퀴즈 문제를 입력하세요."
                                    value={manualQuiz.question}
                                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setManualQuiz({ ...manualQuiz, question: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">선택지 {i}</label>
                                        <input
                                            type="text"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-bold focus:border-blue-500 outline-none transition-all"
                                            placeholder={`선택지 ${i}번 내용`}
                                            value={(manualQuiz as any)[`option${i}`]}
                                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualQuiz({ ...manualQuiz, [`option${i}`]: e.target.value })}
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">정답 번호</label>
                                    <select
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black focus:border-blue-500 outline-none appearance-none cursor-pointer"
                                        value={manualQuiz.answer}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setManualQuiz({ ...manualQuiz, answer: parseInt(e.target.value) })}
                                    >
                                        {[1, 2, 3, 4].map(i => (
                                            <option key={i} value={i}>{i}번</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">퀴즈 보상 (₩)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-sm font-black focus:border-blue-500 outline-none"
                                        placeholder="상금액"
                                        value={manualQuiz.reward}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setManualQuiz({ ...manualQuiz, reward: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-8 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                            <button
                                onClick={handleManualSubmit}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-blue-200 dark:shadow-none flex justify-center items-center gap-3 transition-all active:scale-[0.98]"
                            >
                                <Save className="w-6 h-6" />
                                퀴즈 생성 및 미리보기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Modal for Generated/Uploaded Quizzes */}
            {showPreviewModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center z-[110] p-4 animate-in fade-in scale-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-white/10">
                        <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                    <Wand2 className="w-8 h-8 text-blue-600" />
                                    퀴즈 최종 검토
                                </h3>
                                <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Review {generatedQuizzes.length} Quizzes before saving</p>
                            </div>
                            <button onClick={() => setShowPreviewModal(false)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <X className="w-8 h-8 text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10 space-y-6 bg-slate-50/30 dark:bg-slate-900/30">
                            {generatedQuizzes.map((q: any, i: number) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border-2 border-slate-100 dark:border-slate-700 relative group hover:border-blue-500/50 transition-all shadow-sm hover:shadow-xl">
                                    <button
                                        onClick={() => removeGenerated(i)}
                                        className="absolute top-6 right-6 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                    <div className="flex items-center gap-3 mb-6">
                                        <span className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm">{i + 1}</span>
                                        <span className="px-4 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-widest">₩{q.reward?.toLocaleString()} Reward</span>
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-6 leading-relaxed">{q.question}</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {q.options.map((opt: string, idx: number) => (
                                            <div
                                                key={idx}
                                                className={`p-4 rounded-2xl border-2 text-sm font-bold flex items-center gap-3 ${q.answer === idx + 1 ? 'bg-green-50 border-green-500 text-green-700' : 'bg-slate-50/50 border-slate-100 text-slate-500 dark:bg-slate-900/50 dark:border-slate-800'}`}
                                            >
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${q.answer === idx + 1 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'}`}>
                                                    {idx + 1}
                                                </div>
                                                {opt}
                                            </div>
                                        ))}
                                    </div>
                                    {q.explanation && (
                                        <div className="mt-6 p-5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl text-[13px] font-medium text-slate-500 italic flex gap-2">
                                            <span className="font-black text-blue-500">EX:</span>
                                            {q.explanation}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-10 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col gap-4">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    className="flex-1 px-8 py-5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-white rounded-[1.5rem] font-black hover:bg-slate-200 transition-colors"
                                >
                                    수정하기
                                </button>
                                <button
                                    onClick={saveQuizzes}
                                    disabled={saving || generatedQuizzes.length === 0}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[1.5rem] shadow-2xl shadow-blue-500/20 disabled:opacity-50 flex justify-center items-center gap-3 transition-all active:scale-95"
                                >
                                    {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Save className="w-6 h-6" />}
                                    라이브러리에 최종 등록 ({generatedQuizzes.length}개)
                                </button>
                            </div>
                            <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">Saved quizzes will be available for distribution immediately.</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Stats Modal */}
            {selectedQuiz && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center z-[120] p-4 animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-800 rounded-[3.5rem] w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-white/5">
                        <div className="p-10 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h3 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                    <BarChart2 className="w-8 h-8 text-blue-600" />
                                    실시간 퀴즈 통계
                                </h3>
                                <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">Submission Analysis & Distribution history</p>
                            </div>
                            <button onClick={() => setSelectedQuiz(null)} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                                <X className="w-8 h-8" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-10">
                            <div className="mb-10 p-8 rounded-[2.5rem] bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">Target Question</p>
                                <h4 className="text-xl font-bold text-slate-800 dark:text-white leading-tight">Q. {selectedQuiz.question}</h4>
                            </div>

                            {statsLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                                    <p className="text-slate-400 font-black animate-pulse uppercase text-xs tracking-widest">Syncing analytics...</p>
                                </div>
                            ) : stats ? (
                                <div className="space-y-12">
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="bg-blue-600 p-8 rounded-[2.5rem] text-center shadow-xl shadow-blue-500/20 text-white">
                                            <div className="text-4xl font-black mb-2">{stats.totalAttempts}<span className="text-sm ml-1 opacity-70">명</span></div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">전체 참여</div>
                                        </div>
                                        <div className="bg-green-500 p-8 rounded-[2.5rem] text-center shadow-xl shadow-green-500/20 text-white">
                                            <div className="text-4xl font-black mb-2">{stats.correctRate}<span className="text-sm ml-1 opacity-70">%</span></div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">평균 정답률</div>
                                        </div>
                                        <div className="bg-slate-800 dark:bg-slate-700 p-8 rounded-[2.5rem] text-center shadow-xl text-white">
                                            <div className="text-4xl font-black mb-2">{stats.totalDistributions}<span className="text-sm ml-1 opacity-70">회</span></div>
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-80">총 배포수</div>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between mb-2">
                                            <h5 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <Users className="w-5 h-5" /> 문항별 선택 분포
                                            </h5>
                                        </div>
                                        <div className="space-y-4">
                                            {(typeof selectedQuiz.options === 'string' ? JSON.parse(selectedQuiz.options) : selectedQuiz.options).map((opt: string, idx: number) => {
                                                const choiceIdx = idx + 1;
                                                const count = stats.counts[choiceIdx] || 0;
                                                const percentage = stats.totalAttempts > 0 ? Math.round((count / stats.totalAttempts) * 100) : 0;
                                                const isCorrect = selectedQuiz.answer === choiceIdx;

                                                return (
                                                    <div key={idx} className="space-y-2">
                                                        <div className="flex justify-between items-end px-1">
                                                            <div className={`text-xs font-black flex items-center gap-2 ${isCorrect ? 'text-green-600' : 'text-slate-500'}`}>
                                                                <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] ${isCorrect ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>{choiceIdx}</span>
                                                                {opt} {isCorrect && <CheckCircle2 className="w-3.5 h-3.5" />}
                                                            </div>
                                                            <div className="text-[11px] font-black text-slate-400">{count}명 ({percentage}%)</div>
                                                        </div>
                                                        <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-50 dark:border-slate-800">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-1000 ${isCorrect ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-slate-300 dark:bg-slate-700'}`}
                                                                style={{ width: `${percentage}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="space-y-6 pt-10 border-t border-slate-100 dark:border-slate-700">
                                        <h5 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <Users className="w-5 h-5" /> 세부 참여 현황
                                        </h5>
                                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner">
                                            {stats.solvers.length > 0 ? (
                                                <table className="w-full text-left">
                                                    <thead>
                                                        <tr className="bg-slate-100/50 dark:bg-slate-800/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                            <th className="px-6 py-4">NO</th>
                                                            <th className="px-6 py-4">이름</th>
                                                            <th className="px-6 py-4">선택한 답</th>
                                                            <th className="px-6 py-4 text-center">결과</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                                        {stats.solvers.map((s: any, i: number) => (
                                                            <tr key={i} className="hover:bg-white dark:hover:bg-slate-800. transition-all group">
                                                                <td className="px-6 py-4 text-[13px] font-bold text-slate-400">{s.student_roster?.number}</td>
                                                                <td className="px-6 py-4 text-[14px] font-black text-slate-700 dark:text-slate-200">{s.student_roster?.name}</td>
                                                                <td className="px-6 py-4 text-[13px] font-bold text-slate-500">{s.choice}번</td>
                                                                <td className="px-6 py-4 text-center">
                                                                    {s.is_correct ?
                                                                        <span className="px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black ring-1 ring-green-500/20">CORRECT</span> :
                                                                        <span className="px-3 py-1 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black ring-1 ring-red-500/20">WRONG</span>
                                                                    }
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div className="py-20 text-center flex flex-col items-center gap-4">
                                                    <Users className="w-12 h-12 text-slate-200" />
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No participation recorded yet</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/40 rounded-[2.5rem]">
                                    <p className="text-slate-400 font-black uppercase text-xs tracking-widest">No analytics database found</p>
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

function XLSX_Icon() {
    return (
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center mx-auto shadow-lg shadow-green-500/20">
            <Upload className="w-6 h-6 text-white" />
        </div>
    );
}
