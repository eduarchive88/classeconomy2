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
            const data = XLSX.utils.sheet_to_json(ws);

            // Validate and format
            const formatted = data.map((item: any) => ({
                question: item['문제'] || item['question'],
                options: item['보기'] ? item['보기'].split(',') : (item['options'] || []), // Comma separated or array
                answer: item['정답'] || item['answer'],
                explanation: item['해설'] || item['explanation'],
                reward: item['상금'] || item['reward'] || 500
            })).filter(q => q.question && q.answer);

            setGeneratedQuizzes([...generatedQuizzes, ...formatted]);
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
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/teacher"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <div className="flex-1 flex justify-between items-center">
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <FileText className="w-8 h-8 text-blue-600" />
                        퀴즈 관리
                    </h1>
                    <ClassSelector onClassChange={fetchQuizzes} />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Left: Create/Upload & Preview */}
                <div className="space-y-6 lg:sticky lg:top-8">
                    <div className="glass-panel p-6 shadow-lg">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Plus className="w-5 h-5 text-green-600" />
                            새 퀴즈 등록
                        </h2>

                        <button
                            onClick={() => setShowManualModal(true)}
                            className="w-full btn-secondary py-3 flex items-center justify-center gap-2 mb-6"
                        >
                            <Plus className="w-4 h-4" />
                            퀴즈 직접 추가하기
                        </button>

                        {/* Tabs or Sections */}
                        <div className="space-y-6">
                            {/* Excel Upload */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-slate-600">
                                    <Upload className="w-4 h-4" /> 엑셀 일괄 업로드
                                </h3>
                                <input
                                    type="file"
                                    accept=".xlsx, .xls"
                                    onChange={handleFileUpload}
                                    className="block w-full text-sm text-slate-500
                                    file:mr-4 file:py-2 file:px-4
                                    file:rounded-full file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-blue-50 file:text-blue-700
                                    hover:file:bg-blue-100"
                                />
                                <p className="text-xs text-slate-400 mt-1">컬럼: 문제, 정답(O/X), 해설</p>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-slate-500">또는 AI로 생성</span>
                                </div>
                            </div>

                            {/* AI Generation */}
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium mb-1">주제</label>
                                    <input
                                        type="text"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                        placeholder="예: 화폐의 역사, 인플레이션"
                                        className="w-full p-2 border rounded-lg"
                                    />
                                </div>
                                <label className="block text-sm font-medium mb-1">난이도</label>
                                <select
                                    value={difficulty}
                                    onChange={(e) => setDifficulty(e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value="상">상</option>
                                    <option value="중">중</option>
                                    <option value="하">하</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">문항 수</label>
                                <select
                                    value={count}
                                    onChange={(e) => setCount(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    <option value={5}>5문제</option>
                                    <option value={10}>10문제</option>
                                    <option value={15}>15문제</option>
                                    <option value={20}>20문제</option>
                                </select>
                            </div>
                            <button
                                onClick={generateAIQuizzes}
                                disabled={loading}
                                className="w-full btn-secondary py-2 flex justify-center items-center gap-2"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                AI 퀴즈 생성
                            </button>
                        </div>
                    </div>
                </div>

                {/* Preview Generated */}
                {generatedQuizzes.length > 0 && (
                    <div className="glass-panel p-6 border-2 border-blue-100 dark:border-blue-800">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-blue-800 dark:text-blue-300">생성된 퀴즈 ({generatedQuizzes.length}개)</h3>
                            <button
                                onClick={saveQuizzes}
                                disabled={saving}
                                className="btn-primary py-1.5 px-4 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                저장하기
                            </button>
                        </div>
                        <div className="space-y-3 max-h-[400px] overflow-y-auto">
                            {generatedQuizzes.map((q, i) => (
                                <div key={i} className="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 shadow-sm relative group">
                                    <button
                                        onClick={() => removeGenerated(i)}
                                        className="absolute top-2 right-2 text-slate-300 hover:text-red-500"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                    <p className="font-medium pr-6">Q. {q.question}</p>
                                    <div className="flex gap-2 mt-2 text-sm">
                                        <span className={`font-bold ${q.answer === 'O' ? 'text-blue-600' : 'text-red-600'}`}>
                                            A. {q.answer}
                                        </span>
                                        <span className="text-slate-500">| {q.explanation}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Right: Existing Quizzes List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-600" />
                    저장된 퀴즈 ({quizzes.length}개)
                </h2>

                <div className="space-y-3">
                    {quizzes.map((quiz) => (
                        <div key={quiz.id}
                            onClick={() => handleShowStats(quiz)}
                            className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all cursor-pointer group"
                        >
                            <div className="flex justify-between items-start mb-2">
                                <p className="font-medium text-slate-800 dark:text-slate-200 flex-1 pr-4">Q. {quiz.question}</p>
                                <button
                                    onClick={(e) => handleDeleteQuiz(quiz.id, e)}
                                    className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="삭제"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="mt-3 space-y-2">
                                {(() => {
                                    try {
                                        const options = typeof quiz.options === 'string' ? JSON.parse(quiz.options) : quiz.options;
                                        if (Array.isArray(options)) {
                                            return options.map((opt: string, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className={`text-sm px-3 py-2 rounded-lg flex items-center gap-2 ${quiz.answer === (idx + 1)
                                                        ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200 font-medium'
                                                        : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                                        }`}
                                                >
                                                    {quiz.answer === (idx + 1) && (
                                                        <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                    <span>{idx + 1}. {opt}</span>
                                                </div>
                                            ));
                                        }
                                    } catch (e) {
                                        // Fallback for old format
                                    }
                                    return (
                                        <div className="flex gap-3">
                                            <span className={`font-bold ${quiz.answer === 'O' ? 'text-blue-600' : 'text-red-600'}`}>
                                                A. {quiz.answer}
                                            </span>
                                            <span className="text-slate-400 truncate max-w-[200px]">{quiz.explanation}</span>
                                        </div>
                                    );
                                })()}
                            </div>
                            <div className="flex justify-end items-center text-sm mt-3">
                                <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded flex items-center gap-1">
                                    <BarChart2 className="w-3 h-3" />
                                    통계 보기
                                </div>
                            </div>
                        </div>
                    ))}
                    {quizzes.length === 0 && (
                        <div className="text-center py-12 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed dark:border-slate-700">
                            등록된 퀴즈가 없습니다.
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Modal */}
            {
                selectedQuiz && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedQuiz(null)}>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">퀴즈 통계</h3>
                                <button onClick={() => setSelectedQuiz(null)} className="text-slate-400 hover:text-slate-600">
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="mb-6 bg-slate-50 dark:bg-slate-700 p-4 rounded-xl">
                                <p className="font-medium text-lg mb-2 text-slate-800 dark:text-white">Q. {selectedQuiz.question}</p>
                                <div className="flex gap-2 text-sm text-slate-600">
                                    <span>정답: {selectedQuiz.answer}</span>
                                    <span>|</span>
                                    <span>{selectedQuiz.explanation}</span>
                                </div>
                            </div>

                            {statsLoading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                                </div>
                            ) : stats ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl text-center">
                                            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium mb-1">총 배포 횟수</div>
                                            <div className="text-2xl font-bold text-blue-900 dark:text-blue-200">{stats.distributionCount}회</div>
                                        </div>
                                        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-xl text-center">
                                            <div className="text-sm text-green-600 dark:text-green-400 font-medium mb-1">문제 푼 학생</div>
                                            <div className="text-2xl font-bold text-green-900 dark:text-green-200">{stats.solvers?.length || 0}명</div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="font-bold mb-3 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-slate-500" />
                                            풀이 기록
                                        </h4>
                                        <div className="space-y-2">
                                            {stats.solvers && stats.solvers.length > 0 ? (
                                                stats.solvers.map((s: any, i: number) => (
                                                    <div key={i} className="flex justify-between items-center p-3 border dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700">
                                                        <div>
                                                            <span className="font-medium mr-2">{s.student_roster?.number}번 {s.student_roster?.name}</span>
                                                            <span className="text-xs text-slate-400">{new Date(s.created_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${s.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {s.is_correct ? '정답' : '오답'}
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-center text-slate-400 py-4">아직 문제를 푼 학생이 없습니다.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-red-500">데이터를 불러오지 못했습니다.</div>
                            )}
                        </div>
                    </div>
                )
            }

            {/* Manual Creation Modal */}
            {
                showManualModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-slate-800 dark:text-white">퀴즈 직접 만들기</h3>
                                <button onClick={() => setShowManualModal(false)}><X className="w-6 h-6 text-slate-400" /></button>
                            </div>
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                                <div>
                                    <label className="block text-sm font-bold mb-1 text-slate-800 dark:text-slate-200">문제</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg"
                                        rows={2}
                                        value={manualQuiz.question}
                                        onChange={e => setManualQuiz({ ...manualQuiz, question: e.target.value })}
                                        placeholder="문제를 입력하세요"
                                    />
                                </div>
                                <div className="grid grid-cols-1 gap-2">
                                    <label className="block text-sm font-bold mb-1">보기</label>
                                    {[1, 2, 3, 4].map(num => (
                                        <input
                                            key={num}
                                            type="text"
                                            placeholder={`보기 ${num}`}
                                            className="w-full p-2 border rounded-lg text-sm"
                                            value={(manualQuiz as any)[`option${num}`]}
                                            onChange={e => setManualQuiz({ ...manualQuiz, [`option${num}`]: e.target.value })}
                                        />
                                    ))}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold mb-1">정답 번호</label>
                                        <select
                                            className="w-full p-2 border rounded-lg"
                                            value={manualQuiz.answer}
                                            onChange={e => setManualQuiz({ ...manualQuiz, answer: Number(e.target.value) })}
                                        >
                                            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}번</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold mb-1">상금</label>
                                        <input
                                            type="number"
                                            className="w-full p-2 border rounded-lg"
                                            value={manualQuiz.reward}
                                            onChange={e => setManualQuiz({ ...manualQuiz, reward: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold mb-1">해설</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg"
                                        rows={2}
                                        value={manualQuiz.explanation}
                                        onChange={e => setManualQuiz({ ...manualQuiz, explanation: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-2">
                                <button onClick={() => setShowManualModal(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg">취소</button>
                                <button onClick={handleManualSubmit} className="btn-primary px-6">추가하기</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}
