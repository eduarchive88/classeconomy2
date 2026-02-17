
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Coins, AlertTriangle, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function FinanceManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [amount, setAmount] = useState(0);
    const [type, setType] = useState<'special_allowance' | 'fine' | 'salary_update'>('special_allowance');
    const [reason, setReason] = useState('');
    const [activeTab, setActiveTab] = useState<'finance' | 'salary'>('finance');
    const supabase = createClient();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        // 1. Get class details to get session_code
        const { data: classData } = await supabase
            .from('classes')
            .select('session_code')
            .eq('id', selectedClassId)
            .single();

        if (!classData) return;

        // 2. Fetch profiles matching the session_code (registered students)
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student')
            .eq('session_code', classData.session_code)
            .order('number', { ascending: true });

        // 3. Match with student_roster to get salary (allowance)
        const { data: roster } = await supabase
            .from('student_roster')
            .select('name, number, allowance')
            .eq('class_id', selectedClassId);

        if (profiles && roster) {
            const merged = profiles.map(p => {
                const r = roster.find(item => item.name === p.name && item.number?.toString() === p.number?.toString());
                return { ...p, allowance: r?.allowance || 0 };
            });
            setStudents(merged);
        } else if (profiles) {
            setStudents(profiles);
        }
    };

    const handleSubmit = async () => {
        if (selectedStudents.length === 0) return alert('학생을 선택해주세요.');
        if (amount <= 0) return alert('금액을 입력해주세요.');

        setLoading(true);
        try {
            if (type === 'salary_update') {
                // Update allowance in student_roster
                const { error: updateError } = await supabase
                    .from('student_roster')
                    .update({ allowance: amount })
                    .in('name', selectedStudents.map(id => students.find(s => s.id === id)?.name))
                    .eq('class_id', localStorage.getItem('selected_class_id'));

                if (updateError) throw updateError;
            } else {
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
            }
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
        <div className="p-4 md:p-8 max-w-6xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/teacher"
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                    title="대시보드로 돌아가기"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">재무/금융 관리</h1>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6 sticky top-8">
                        <div className="flex border-b mb-4">
                            <button onClick={() => setActiveTab('finance')} className={`flex-1 py-2 font-medium ${activeTab === 'finance' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>지급/차감</button>
                            <button onClick={() => setActiveTab('salary')} className={`flex-1 py-2 font-medium ${activeTab === 'salary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>주급 설정</button>
                        </div>

                        {activeTab === 'finance' ? (
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
                        ) : (
                            <div className="p-4 bg-blue-50 rounded-xl text-blue-700 text-sm mb-4">
                                <p className="font-bold mb-1">💡 주급 자동 지급</p>
                                <p>지정한 금액이 매주 월요일 오전 8시에 학생들에게 자동으로 지급됩니다.</p>
                                <input type="hidden" value={() => { if (type !== 'salary_update') setType('salary_update'); return ''; }} />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">{activeTab === 'salary' ? '변경할 주급 금액' : '금액'}</label>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => {
                                    setAmount(Number(e.target.value));
                                    if (activeTab === 'salary') setType('salary_update');
                                }}
                                className="w-full p-2 border rounded-lg"
                                placeholder="0"
                            />
                        </div>

                        {activeTab === 'finance' && (
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
                        )}

                        <button
                            onClick={handleSubmit}
                            className={`w-full btn-primary ${type === 'fine' ? 'bg-red-600 hover:bg-red-700' : activeTab === 'salary' ? 'bg-indigo-600' : ''}`}
                            disabled={loading}
                        >
                            {loading ? '처리중...' : (activeTab === 'salary' ? '주급 일괄 수정' : type === 'special_allowance' ? '지급하기' : '부과하기')}
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
                            <div className="text-xs text-blue-500 mt-1">
                                설정된 주급: {student.allowance?.toLocaleString()}원
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
        </div >
    );
}
