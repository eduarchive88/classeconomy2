
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Coins, AlertTriangle, check } from 'lucide-react';

export default function FinanceManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [amount, setAmount] = useState(0);
    const [type, setType] = useState<'special_allowance' | 'fine'>('special_allowance');
    const [reason, setReason] = useState('');
    const supabase = createClient();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        // We should fetch from 'profiles' if they are registered, or 'student_roster'? 
        // Ideally we want to give money to 'profiles' (actual accounts). 
        // If they haven't signed up, they don't have a profile yet (unless we pre-created).
        // The current flow relies on 'first login' to create profile.
        // So we can only give money to 'registered' students.

        // Let's fetch profiles where role is student.
        const { data } = await supabase.from('profiles').select('*').eq('role', 'student');
        if (data) setStudents(data);
    };

    const handleSubmit = async () => {
        if (selectedStudents.length === 0) return alert('학생을 선택해주세요.');
        if (amount <= 0) return alert('금액을 입력해주세요.');

        setLoading(true);
        try {
            const res = await fetch('/api/teacher/finance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentIds: selectedStudents,
                    amount,
                    type,
                    description: reason
                }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            alert('처리되었습니다.');
            setAmount(0);
            setReason('');
            setSelectedStudents([]);
            fetchStudents(); // Refresh balances
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (id: string) => {
        if (selectedStudents.includes(id)) {
            setSelectedStudents(selectedStudents.filter(s => s !== id));
        } else {
            setSelectedStudents([...selectedStudents, id]);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">재정 관리 (상벌점)</h1>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6 sticky top-8">
                        <h2 className="text-xl font-semibold mb-4">지급/차감 설정</h2>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">유형</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => setType('special_allowance')}
                                        className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${type === 'special_allowance' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'hover:bg-slate-50'}`}
                                    >
                                        <Coins className="w-4 h-4" /> 특별 수당
                                    </button>
                                    <button
                                        onClick={() => setType('fine')}
                                        className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${type === 'fine' ? 'bg-red-100 border-red-500 text-red-700' : 'hover:bg-slate-50'}`}
                                    >
                                        <AlertTriangle className="w-4 h-4" /> 벌금
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">금액</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(Number(e.target.value))}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="0"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-1">사유</label>
                                <input
                                    type="text"
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="예: 청소 당번, 지각 등"
                                />
                            </div>

                            <button
                                onClick={handleSubmit}
                                className={`w-full btn-primary ${type === 'fine' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                                disabled={loading}
                            >
                                {loading ? '처리중...' : (type === 'special_allowance' ? '지급하기' : '부과하기')}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">학생 목록 ({students.length})</h2>
                        <button
                            onClick={() => setSelectedStudents(students.map(s => s.id))}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            전체 선택
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {students.map((student) => (
                            <div
                                key={student.id}
                                onClick={() => toggleStudent(student.id)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedStudents.includes(student.id) ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-lg">{student.name}</span>
                                    <span className="text-xs text-slate-500">{student.number}번</span>
                                </div>
                                <div className="text-sm text-slate-600">
                                    잔액: {student.money?.toLocaleString()}원
                                </div>
                            </div>
                        ))}
                        {students.length === 0 && (
                            <div className="col-span-full text-center py-8 text-slate-400">
                                등록된 학생(접속 완료한 학생)이 없습니다.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
