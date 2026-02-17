
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Home, Users, Plus, Save, Trash2, ArrowLeft, Grid, MapPin, DollarSign, Wand2 } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function RealEstateManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [seats, setSeats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'assign' | 'price'>('assign');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState<number>(1000);
    const [trades, setTrades] = useState<any[]>([]);
    const [tradesLoading, setTradesLoading] = useState(false);
    const supabase = createClient();

    const rows = 5;
    const cols = 6;

    const fetchData = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        // Fetch students
        const { data: studentsData } = await supabase
            .from('student_roster')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('number', { ascending: true });
        if (studentsData) setStudents(studentsData);

        // Fetch seats
        const { data: seatsData } = await supabase
            .from('seats')
            .select('*')
            .eq('class_id', selectedClassId);
        if (seatsData) setSeats(seatsData);

        // Fetch pending trades
        setTradesLoading(true);
        const { data: tradesData } = await supabase
            .from('seat_trades')
            .select('*, seller:seller_id(name, number), buyer:buyer_id(name, number)')
            .eq('class_id', selectedClassId)
            .eq('status', 'pending');
        if (tradesData) setTrades(tradesData);
        setTradesLoading(false);
    };

    const handleTradeApproval = async (trade: any, approve: boolean) => {
        setLoading(true);
        try {
            if (approve) {
                // 1. Update seat owner
                await supabase.from('seats').update({ student_id: trade.buyer_id }).eq('id', trade.seat_id);
                // 2. Mark trade approved
                await supabase.from('seat_trades').update({ status: 'approved' }).eq('id', trade.id);
            } else {
                await supabase.from('seat_trades').update({ status: 'rejected' }).eq('id', trade.id);
            }
            alert(approve ? '승인되었습니다.' : '거절되었습니다.');
            fetchData();
        } catch (e: any) {
            alert('처리 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveSeat = async (row: number, col: number) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            const existingSeat = seats.find(s => s.row_idx === row && s.col_idx === col);
            let updateData: any = {
                class_id: selectedClassId,
                row_idx: row,
                col_idx: col,
            };

            if (mode === 'assign') {
                if (selectedStudentId === 'unassign') {
                    updateData.student_id = null;
                } else if (selectedStudentId) {
                    updateData.student_id = selectedStudentId;
                } else {
                    // Do nothing if no student selected
                    setLoading(false);
                    return;
                }
            } else if (mode === 'price') {
                updateData.price = priceInput;
                // Preserve existing student if update doesn't specify it? 
                // Upsert will overwrite. Need to be careful.
                // If existing seat, keep student_id.
                if (existingSeat) {
                    updateData.student_id = existingSeat.student_id;
                }
            }

            const { error } = await supabase
                .from('seats')
                .upsert(updateData, { onConflict: 'class_id, row_idx, col_idx' });

            if (error) throw error;
            fetchData();
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const applyDefaultPrices = async () => {
        if (!confirm('현재 자리 가격을 모두 초기화하고 기본 규칙(앞자리가 비쌈)을 적용하시겠습니까?')) return;

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            const updates = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const price = Math.max(100, 3000 - (r * 500)); // Example rule
                    updates.push({
                        class_id: selectedClassId,
                        row_idx: r,
                        col_idx: c,
                        price: price
                    });
                }
            }

            // This might overwrite students if we use upsert without student_id...
            // Need to merge with existing seats or be careful.
            // Better to iterate existing seats map? 
            // For simplicity, let's keep students if possible, or just accept reset risk? 
            // Proper way: fetch current seats, merge.

            const { data: currentSeats } = await supabase.from('seats').select('*').eq('class_id', selectedClassId);
            const enrichedUpdates = updates.map(u => {
                const existing = currentSeats?.find(s => s.row_idx === u.row_idx && s.col_idx === u.col_idx);
                return {
                    ...u,
                    student_id: existing?.student_id || null // Preserve student
                };
            });

            const { error } = await supabase.from('seats').upsert(enrichedUpdates, { onConflict: 'class_id, row_idx, col_idx' });
            if (error) throw error;

            fetchData();
            alert('가격이 적용되었습니다.');
        } catch (e: any) {
            alert('오류: ' + e.message);
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
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <MapPin className="w-8 h-8 text-amber-500" />
                    부동산/자리 관리
                </h1>
                <div className="ml-auto">
                    <ClassSelector onClassChange={fetchData} />
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    {/* Control Panel */}
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Grid className="w-5 h-5 text-amber-600" />
                            설정
                        </h2>

                        {/* Mode Switch */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6">
                            <button
                                onClick={() => setMode('assign')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'assign' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
                            >
                                직접 배정
                            </button>
                            <button
                                onClick={() => setMode('price')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'price' ? 'bg-white shadow text-amber-600' : 'text-slate-500'}`}
                            >
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                가격 설정/마켓
                            </button>
                        </div>

                        {mode === 'price' && (
                            <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-100">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            onChange={async (e) => {
                                                const checked = e.target.checked;
                                                const classId = localStorage.getItem('selected_class_id');
                                                if (classId) {
                                                    await supabase.from('classes').update({ is_auto_real_estate: checked }).eq('id', classId);
                                                    alert(checked ? '자동 구매가 활성화되었습니다.' : '자동 구매가 비활성화되었습니다 (선생님 승인 필요).');
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </div>
                                    <span className="text-sm font-bold text-amber-900 group-hover:text-amber-700 transition-colors">학생 즉시 구매 허용</span>
                                </label>
                                <p className="text-[11px] text-amber-600 mt-2">
                                    * 켜짐: 학생이 빈 자리를 클릭하면 즉시 잔액이 차감되고 구매됩니다. <br />
                                    * 꺼짐: 구매 요청만 생성되며 선생님이 승인해야 합니다.
                                </p>
                            </div>
                        )}

                        {mode === 'assign' ? (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-500 mb-2">배정할 학생을 선택하고 자리를 클릭하세요.</p>
                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                    <button
                                        onClick={() => setSelectedStudentId('unassign')}
                                        className={`w-full p-2 text-left rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedStudentId === 'unassign' ? 'bg-red-50 text-red-600 border border-red-200' : 'hover:bg-slate-50'}`}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        자리 비우기 (배정 해제)
                                    </button>
                                    {students.map((s) => {
                                        const isAssigned = seats.some(seat => seat.student_id === s.id);
                                        return (
                                            <button
                                                key={s.id}
                                                onClick={() => setSelectedStudentId(s.id)}
                                                className={`w-full p-2 text-left rounded-lg text-sm transition-colors flex justify-between ${selectedStudentId === s.id ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'hover:bg-slate-50'}`}
                                            >
                                                <span>{s.number}. {s.name}</span>
                                                {isAssigned && <span className="text-xs text-slate-400 bg-slate-100 px-1 rounded">배정됨</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">설정할 가격 (원)</label>
                                    <input
                                        type="number"
                                        value={priceInput}
                                        onChange={(e) => setPriceInput(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                        step={100}
                                    />
                                    <p className="text-xs text-slate-500 mt-1">이 가격을 입력하고 자리를 클릭하면 가격이 변경됩니다.</p>
                                </div>
                                <hr />
                                <button
                                    onClick={applyDefaultPrices}
                                    className="w-full btn-secondary text-amber-700 bg-amber-50 hover:bg-amber-100 flex items-center justify-center gap-2"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    기본 규칙 자동 적용
                                </button>
                                <p className="text-xs text-slate-400">
                                    * 앞줄부터 3000원, 2500원... 순으로 자동 책정됩니다.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Pending Trades */}
                    <div className="glass-panel p-6 border-amber-200 bg-amber-50/30">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Users className="w-5 h-5 text-amber-600" />
                            승인 대기 중인 거래 ({trades.length})
                        </h2>
                        {tradesLoading ? (
                            <div className="py-4 text-center text-slate-400">불러오는 중...</div>
                        ) : trades.length > 0 ? (
                            <div className="space-y-3">
                                {trades.map((t) => (
                                    <div key={t.id} className="bg-white p-3 rounded-lg border shadow-sm">
                                        <div className="text-sm mb-2">
                                            <span className="font-bold text-blue-600">{t.buyer?.name}</span> 학생이
                                            <span className="font-bold text-amber-600"> {t.price.toLocaleString()}원</span>에 구매 요청
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleTradeApproval(t, true)}
                                                className="flex-1 py-1 bg-green-600 text-white text-xs font-bold rounded"
                                            >
                                                승인
                                            </button>
                                            <button
                                                onClick={() => handleTradeApproval(t, false)}
                                                className="flex-1 py-1 bg-slate-200 text-slate-700 text-xs font-bold rounded"
                                            >
                                                거절
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-slate-400 text-sm">대기 중인 거래가 없습니다.</p>
                        )}
                    </div>
                </div>

                <div className="glass-panel p-6 overflow-x-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-4 text-sm text-slate-500">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border rounded shadow-sm"></div> 빈 자리</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded shadow-sm"></div> 배정됨</span>
                        </div>
                        <div className="px-4 py-1 bg-slate-800 text-white rounded text-xs font-bold shadow-md">
                            칠판 (BOARD)
                        </div>
                    </div>

                    <div className="grid gap-2 mx-auto w-fit" style={{ gridTemplateColumns: `repeat(${cols}, minmax(80px, 1fr))` }}>
                        {Array.from({ length: rows }).map((_, r) => (
                            Array.from({ length: cols }).map((_, c) => {
                                const seat = seats.find(s => s.row_idx === r && s.col_idx === c);
                                const student = students.find(s => s.id === seat?.student_id);

                                return (
                                    <div
                                        key={`${r}-${c}`}
                                        onClick={() => handleSaveSeat(r, c)}
                                        className={`
                                            aspect-square rounded-xl border-2 p-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden
                                            ${seat?.student_id
                                                ? 'bg-blue-50 border-blue-200 shadow-sm hover:shadow-md hover:border-blue-400'
                                                : 'bg-white border-slate-100 hover:border-slate-300'
                                            }
                                            ${mode === 'price' ? 'hover:bg-amber-50 hover:border-amber-300' : ''}
                                        `}
                                    >
                                        <div className="text-xs font-bold text-slate-400 absolute top-1 left-2">
                                            {r + 1}-{c + 1}
                                        </div>

                                        {student ? (
                                            <div className="font-bold text-slate-800 break-keep leading-tight">
                                                <div className="text-xs text-slate-500 font-normal mb-0.5">{student.number}번</div>
                                                {student.name}
                                            </div>
                                        ) : (
                                            <div className="text-slate-300 text-xs">
                                                빈 자리
                                            </div>
                                        )}

                                        <div className="absolute bottom-1 right-2 text-xs font-mono text-amber-600 font-semibold bg-amber-50 px-1 rounded">
                                            {seat?.price?.toLocaleString() || 0}
                                        </div>
                                    </div>
                                );
                            })
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
