
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Coins, AlertTriangle, Check, ArrowLeft, Edit2, Save, X } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function FinanceManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
    const [amount, setAmount] = useState(0);
    const [type, setType] = useState<'special_allowance' | 'fine' | 'salary_update'>('special_allowance');
    const [reason, setReason] = useState('');
    const [activeTab, setActiveTab] = useState<'finance' | 'salary'>('finance');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState<number>(0);
    const supabase = createClient();

    useEffect(() => {
        fetchStudents();
    }, []);

    const fetchStudents = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        // 1. Fetch ALL students from roster for this class
        const { data: roster, error: rosterError } = await supabase
            .from('student_roster')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('number', { ascending: true });

        if (rosterError) {
            console.error('Roster fetch error:', rosterError);
            return;
        }

        // 2. Fetch profiles to get current balances (only for those who logged in)
        const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'student');

        // 3. Merge: Roster is the base
        const merged = (roster || []).map(r => {
            const p = profiles?.find(profile =>
                profile.name === r.name &&
                profile.number?.toString() === r.number?.toString()
            );
            return {
                ...r,
                // If profile exists, use its money, otherwise 0
                money: p?.money || 0,
                profile_id: p?.id || null
            };
        });

        setStudents(merged);
    };

    const handleSubmit = async () => {
        if (selectedStudents.length === 0) return alert('학생을 선택해주세요.');

        if (activeTab === 'finance') {
            if (amount <= 0) return alert('금액을 입력해주세요.');

            setLoading(true);
            try {
                const rosterIds = selectedStudents;

                const res = await fetch('/api/teacher/finance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        studentIds: rosterIds, // Use roster IDs directly
                        amount,
                        type,
                        description: reason
                    }),
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || '처리 실패');
                }

                alert('처리되었습니다.');
                setAmount(0);
                setReason('');
                setSelectedStudents([]);
                fetchStudents();
            } catch (e: any) {
                alert('오류: ' + e.message);
            } finally {
                setLoading(false);
            }
        } else {
            // Bulk salary update
            if (amount < 0) return alert('금액은 0원 이상이어야 합니다.');
            setLoading(true);
            try {
                const { error: updateError } = await supabase
                    .from('student_roster')
                    .update({ allowance: amount })
                    .in('id', selectedStudents);

                if (updateError) throw updateError;

                alert('주급이 일괄 수정되었습니다.');
                setAmount(0);
                setSelectedStudents([]);
                fetchStudents();
            } catch (e: any) {
                alert('오류: ' + e.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleIndividualSalaryUpdate = async (id: string, newVal: number) => {
        try {
            const { error } = await supabase
                .from('student_roster')
                .update({ allowance: newVal })
                .eq('id', id);

            if (error) throw error;
            setEditingId(null);
            fetchStudents();
        } catch (e: any) {
            alert('수정 실패: ' + e.message);
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
                <div className="ml-auto">
                    <ClassSelector onClassChange={fetchStudents} />
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6 sticky top-8">
                        <div className="flex border-b mb-4">
                            <button onClick={() => setActiveTab('finance')} className={`flex-1 py-2 font-medium ${activeTab === 'finance' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>지급/차감</button>
                            <button onClick={() => setActiveTab('salary')} className={`flex-1 py-2 font-medium ${activeTab === 'salary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-400'}`}>주급 설정</button>
                        </div>

                        {activeTab === 'finance' ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">유형</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setType('special_allowance')}
                                            className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${type === 'special_allowance' ? 'bg-blue-600 border-blue-600 text-white' : 'hover:bg-slate-50'}`}
                                        >
                                            <Coins className="w-4 h-4" /> 특별 수당
                                        </button>
                                        <button
                                            onClick={() => setType('fine')}
                                            className={`p-3 rounded-lg border flex items-center justify-center gap-2 ${type === 'fine' ? 'bg-red-600 border-red-600 text-white' : 'hover:bg-slate-50'}`}
                                        >
                                            <AlertTriangle className="w-4 h-4" /> 벌금
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 mt-4">금액</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 mt-4">사유</label>
                                    <input
                                        type="text"
                                        value={reason}
                                        onChange={e => setReason(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="예: 청소 당번, 지각 등"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="p-4 bg-blue-50 rounded-xl text-blue-700 text-sm">
                                    <p className="font-bold mb-1">💡 주급 관리 안내</p>
                                    <p>• 매주 월요일 오전 8시에 자동 지급됩니다.</p>
                                    <p>• 아래 목록에서 학생별로 직접 수정하거나,</p>
                                    <p>• 학생을 선택 후 일괄 수정할 수 있습니다.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 mt-4">일괄 변경할 금액</label>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleSubmit}
                            className={`w-full btn-primary mt-6 ${type === 'fine' && activeTab === 'finance' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                            disabled={loading}
                        >
                            {loading ? '처리중...' : (activeTab === 'salary' ? '선택 학생 주급 수정' : type === 'special_allowance' ? '지급하기' : '부과하기')}
                        </button>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">학생 목록 ({students.length})</h2>
                        <button
                            onClick={() => {
                                if (selectedStudents.length === students.length) setSelectedStudents([]);
                                else setSelectedStudents(students.map(s => s.id));
                            }}
                            className="text-sm text-blue-600 hover:underline"
                        >
                            {selectedStudents.length === students.length ? '선택 해제' : '전체 선택'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {students.map((student) => (
                            <div
                                key={student.id}
                                className={`p-4 rounded-xl border transition-all ${selectedStudents.includes(student.id) ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-3" onClick={() => toggleStudent(student.id)}>
                                        <div className={`w-4 h-4 rounded border ${selectedStudents.includes(student.id) ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                            {selectedStudents.includes(student.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <div>
                                            <span className="font-bold text-lg">{student.name}</span>
                                            <span className="text-xs text-slate-500 ml-2">{student.number}번</span>
                                        </div>
                                    </div>
                                    {!student.profile_id && (
                                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">미접속</span>
                                    )}
                                </div>

                                <div className="flex flex-col gap-1 ml-7">
                                    <div className="text-sm text-slate-600">
                                        현재 잔액: <span className="font-medium">{student.money?.toLocaleString()}원</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm text-blue-600 group">
                                        <div className="flex items-center gap-1">
                                            주급:
                                            {editingId === student.id ? (
                                                <input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={e => setEditValue(Number(e.target.value))}
                                                    className="w-20 p-1 border rounded text-xs"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="font-bold">{student.allowance?.toLocaleString()}원</span>
                                            )}
                                        </div>

                                        {activeTab === 'salary' && (
                                            <div className="flex gap-1">
                                                {editingId === student.id ? (
                                                    <>
                                                        <button onClick={() => handleIndividualSalaryUpdate(student.id, editValue)} className="p-1 hover:bg-blue-100 rounded text-blue-600"><Check className="w-4 h-4" /></button>
                                                        <button onClick={() => setEditingId(null)} className="p-1 hover:bg-red-100 rounded text-red-600"><X className="w-4 h-4" /></button>
                                                    </>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setEditingId(student.id);
                                                            setEditValue(student.allowance || 0);
                                                        }}
                                                        className="p-1 hover:bg-blue-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {students.length === 0 && (
                            <div className="col-span-full text-center py-8 text-slate-400">
                                등록된 학생 명단이 없습니다. [학생 관리]에서 명단을 추가해주세요.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
