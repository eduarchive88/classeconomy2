'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Lightbulb, CheckCircle, XCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function StudentQuiz() {
    const [quizzes, setQuizzes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: number }>({}); // daily_quiz_id -> option index
    const [submissionResults, setSubmissionResults] = useState<{ [key: string]: any }>({}); // daily_quiz_id -> result
    const [submitting, setSubmitting] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        fetchDailyQuizzes();
    }, []);

    const fetchDailyQuizzes = async () => {
        try {
            const res = await fetch('/api/student/quiz');
            const data = await res.json();
            if (data.quizzes) {
                setQuizzes(data.quizzes);
                // Pre-fill results for already submitted quizzes
                const initialResults: any = {};
                data.quizzes.forEach((q: any) => {
                    if (q.status !== 'pending') {
                        initialResults[q.daily_quiz_id] = {
                            isCorrect: q.status === 'correct',
                            reward: q.reward,
                            correctAnswer: q.answer
                        };
                    }
                });
                setSubmissionResults(initialResults);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectOption = (dailyQuizId: string, optionIdx: number) => {
        if (submissionResults[dailyQuizId]) return; // Already submitted
        setSelectedAnswers(prev => ({ ...prev, [dailyQuizId]: optionIdx }));
    };

    const handleSubmit = async (dailyQuizId: string) => {
        const answer = selectedAnswers[dailyQuizId];
        if (typeof answer !== 'number') return;

        setSubmitting(prev => ({ ...prev, [dailyQuizId]: true }));
        try {
            const res = await fetch('/api/student/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dailyQuizId, answer }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setSubmissionResults(prev => ({
                ...prev,
                [dailyQuizId]: {
                    isCorrect: data.isCorrect,
                    reward: data.reward,
                    correctAnswer: data.correctAnswer
                }
            }));
        } catch (e: any) {
            alert(e.message || '제출 오류');
        } finally {
            setSubmitting(prev => ({ ...prev, [dailyQuizId]: false }));
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;

    return (
        <div className="p-4 md:p-8 max-w-3xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/student" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Lightbulb className="w-8 h-8 text-yellow-500" />
                    오늘의 퀴즈
                    <span className="text-sm font-normal text-slate-500 ml-2">매일 아침 8시, 2문제가 도착합니다!</span>
                </h1>
            </div>

            {quizzes.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">아직 도착한 퀴즈가 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {quizzes.map((quiz) => {
                        const isSubmitted = !!submissionResults[quiz.daily_quiz_id];
                        const result = submissionResults[quiz.daily_quiz_id];
                        const mySelection = selectedAnswers[quiz.daily_quiz_id];

                        return (
                            <div key={quiz.daily_quiz_id} className="card bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                                        상금 {quiz.reward?.toLocaleString()}원
                                    </span>
                                    {isSubmitted && (
                                        <span className={`flex items-center gap-1 font-bold ${result.isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                            {result.isCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                            {result.isCorrect ? '정답!' : '오답'}
                                        </span>
                                    )}
                                </div>

                                <h3 className="text-lg font-bold text-slate-800 mb-6">Q. {quiz.question}</h3>

                                <div className="space-y-3 mb-6">
                                    {quiz.options?.map((opt: string, idx: number) => {
                                        const optNum = idx + 1; // 1-based
                                        let style = "w-full text-left p-4 rounded-xl border-2 transition-all ";

                                        if (isSubmitted) {
                                            if (optNum === result.correctAnswer) {
                                                style += "border-green-500 bg-green-50 text-green-700 font-bold";
                                            } else if (optNum === mySelection && !result.isCorrect) {
                                                // Wait, we don't know mySelection from API if reloading.
                                                // API only returned status. So if reloading, we can't highlight MY wrong answer unless I stored it.
                                                style += "border-slate-100 bg-slate-50 opacity-60";
                                            } else {
                                                style += "border-slate-100 bg-slate-50 opacity-60";
                                            }
                                        } else {
                                            if (mySelection === optNum) {
                                                style += "border-blue-500 bg-blue-50 ring-2 ring-blue-100";
                                            } else {
                                                style += "border-slate-200 hover:border-blue-300 hover:bg-slate-50";
                                            }
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                disabled={isSubmitted || submitting[quiz.daily_quiz_id]}
                                                onClick={() => handleSelectOption(quiz.daily_quiz_id, optNum)}
                                                className={style}
                                            >
                                                <span className="mr-2 font-bold">{optNum}.</span> {opt}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Explanation Section (Only if Submitted) */}
                                {isSubmitted && (
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                                        <p className="font-bold text-sm text-slate-600 mb-1">📝 해설</p>
                                        <p className="text-sm text-slate-700">{quiz.explanation || '해설이 없습니다.'}</p>
                                    </div>
                                )}

                                {!isSubmitted && (
                                    <button
                                        onClick={() => handleSubmit(quiz.daily_quiz_id)}
                                        disabled={!mySelection || submitting[quiz.daily_quiz_id]}
                                        className="w-full btn-primary py-3 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {submitting[quiz.daily_quiz_id] ? '제출 중...' : '정답 제출하기'}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
