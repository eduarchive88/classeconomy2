
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Lightbulb, CheckCircle, XCircle } from 'lucide-react';

export default function StudentQuiz() {
    const [quiz, setQuiz] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [result, setResult] = useState<{ isCorrect: boolean, reward: number } | null>(null);
    const supabase = createClient();

    useEffect(() => {
        fetchDailyQuiz();
    }, []);

    const fetchDailyQuiz = async () => {
        try {
            // Fetch from API to handle "Lazy Init" of daily quiz safely server-side
            const res = await fetch('/api/student/quiz');
            const data = await res.json();

            if (data.solved) {
                setSubmitted(true);
                setResult({ isCorrect: data.isCorrect, reward: data.reward });
                // We still want to show the quiz context if possible, but API might just return status
            }

            if (data.quiz) {
                setQuiz(data.quiz);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (selectedOption === null) return;

        try {
            const res = await fetch('/api/student/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quizId: quiz.id, answer: selectedOption }),
            });

            const data = await res.json();
            setSubmitted(true);
            setResult({ isCorrect: data.isCorrect, reward: data.reward });
        } catch (e) {
            alert('제출 오류');
        }
    };

    if (loading) return <div className="p-8">로딩 중...</div>;

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Lightbulb className="w-6 h-6 text-yellow-500" />
                오늘의 퀴즈
            </h1>

            <div className="card bg-white p-6">
                {quiz ? (
                    <>
                        <div className="mb-6">
                            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold mb-3">
                                상금 {quiz.reward}원
                            </span>
                            <h2 className="text-xl font-bold text-slate-800">{quiz.question}</h2>
                        </div>

                        <div className="space-y-3 mb-6">
                            {quiz.options.map((opt: string, idx: number) => {
                                const optNum = idx + 1;
                                // Determine styling based on state
                                let style = "p-4 w-full text-left rounded-xl border-2 transition-all ";

                                if (submitted) {
                                    if (optNum === quiz.answer) style += "border-emerald-500 bg-emerald-50 text-emerald-700 font-bold";
                                    else if (selectedOption === optNum && !result?.isCorrect) style += "border-red-500 bg-red-50 text-red-700";
                                    else style += "border-slate-100 bg-slate-50 opacity-60";
                                } else {
                                    if (selectedOption === optNum) style += "border-blue-500 bg-blue-50 ring-2 ring-blue-200";
                                    else style += "border-slate-200 hover:border-blue-300 hover:bg-slate-50";
                                }

                                return (
                                    <button
                                        key={idx}
                                        disabled={submitted}
                                        onClick={() => setSelectedOption(optNum)}
                                        className={style}
                                    >
                                        {optNum}. {opt}
                                    </button>
                                )
                            })}
                        </div>

                        {!submitted ? (
                            <button
                                onClick={handleSubmit}
                                disabled={selectedOption === null}
                                className="w-full btn-primary py-4 text-lg"
                            >
                                정답 제출하기
                            </button>
                        ) : (
                            <div className={`p-4 rounded-xl text-center ${result?.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {result?.isCorrect ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <CheckCircle className="w-8 h-8" />
                                        <p className="font-bold text-lg">정답입니다!</p>
                                        <p>상금 {result.reward}원이 지급되었습니다.</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <XCircle className="w-8 h-8" />
                                        <p className="font-bold text-lg">아쉽네요! 오답입니다.</p>
                                        <p>내일 다시 도전해보세요.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 text-slate-500">
                        <p className="text-lg">오늘의 퀴즈가 아직 준비되지 않았습니다.</p>
                        <p className="text-sm mt-2">선생님께 말씀드려보세요!</p>
                    </div>
                )}
            </div>
        </div>
    );
}
