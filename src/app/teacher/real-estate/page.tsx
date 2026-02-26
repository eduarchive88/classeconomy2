
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Home, Users, Plus, Save, Trash2, ArrowLeft, Grid, MapPin, DollarSign, Wand2, Minus, Lock } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function RealEstateManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [seats, setSeats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState<'assign' | 'price' | 'lock'>('assign');
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState<number>(1000);
    const [trades, setTrades] = useState<any[]>([]);
    const [tradesLoading, setTradesLoading] = useState(false);
    // 행/열 동적 조절
    const [rows, setRows] = useState(5);
    const [cols, setCols] = useState(6);
    const [isAutoBuy, setIsAutoBuy] = useState(true);
    const supabase = createClient();

    const fetchData = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        // 학생 목록 불러오기
        const { data: studentsData } = await supabase
            .from('student_roster')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('number', { ascending: true });
        if (studentsData) setStudents(studentsData);

        // 클래스 설정 불러오기
        const { data: classData } = await supabase
            .from('classes')
            .select('is_auto_real_estate')
            .eq('id', selectedClassId)
            .single();
        if (classData) setIsAutoBuy(classData.is_auto_real_estate);

        // 자리 데이터 불러오기
        const { data: seatsData } = await supabase
            .from('seats')
            .select('*')
            .eq('class_id', selectedClassId);
        if (seatsData) {
            setSeats(seatsData);
            // 기존 자리 데이터에서 최대 행/열 추출
            if (seatsData.length > 0) {
                const maxRow = Math.max(...seatsData.map(s => s.row_idx)) + 1;
                const maxCol = Math.max(...seatsData.map(s => s.col_idx)) + 1;
                setRows(Math.max(rows, maxRow));
                setCols(Math.max(cols, maxCol));
            }
        }

        // 승인 대기 거래 불러오기
        setTradesLoading(true);
        const { data: tradesData } = await supabase
            .from('seat_trades')
            .select('*, seller:seller_id(name, number), buyer:buyer_id(name, number)')
            .eq('class_id', selectedClassId)
            .eq('status', 'pending');
        if (tradesData) setTrades(tradesData);
        setTradesLoading(false);
    };

    // 거래 승인/거절 처리
    const handleTradeApproval = async (trade: any, approve: boolean) => {
        setLoading(true);
        try {
            if (approve) {
                await supabase.from('seats').update({ student_id: trade.buyer_id }).eq('id', trade.seat_id);
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

    // 자리 저장(배정 또는 가격 설정)
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
                    const previousSeat = seats.find(s => s.student_id === selectedStudentId && (s.row_idx !== row || s.col_idx !== col));
                    if (previousSeat) {
                        await supabase
                            .from('seats')
                            .update({ student_id: null })
                            .eq('id', previousSeat.id);
                    }
                    updateData.student_id = selectedStudentId;
                } else {
                    setLoading(false);
                    return;
                }
            } else if (mode === 'price') {
                updateData.price = priceInput;
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

    // 기본 가격 자동 적용 (인플레이션 규칙)
    const applyDefaultPrices = async () => {
        if (!confirm('현재 자리 가격을 모두 초기화하고 인플레이션 규칙((총 자산 * 60%) / 학생 수)을 적용하시겠습니까?')) return;

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            const { data: roster } = await supabase
                .from('student_roster')
                .select('balance, allowance')
                .eq('class_id', selectedClassId);

            const totalAssets = roster?.reduce((sum, s) => sum + (s.balance || 0), 0) || 0;
            const studentCount = roster?.length || 1;

            const basePrice = Math.floor((totalAssets * 0.6) / studentCount);
            const finalBasePrice = Math.max(100, basePrice);

            const updates = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const variation = Math.floor(finalBasePrice * 0.1);
                    // 뒷자리일수록 비싸게 (r이 클수록 가격 UP)
                    const rowFactor = r - Math.floor(rows / 2);
                    const price = Math.max(100, finalBasePrice + (rowFactor * variation));

                    updates.push({
                        class_id: selectedClassId,
                        row_idx: r,
                        col_idx: c,
                        price: Math.floor(price / 10) * 10
                    });
                }
            }

            const { data: currentSeats } = await supabase.from('seats').select('*').eq('class_id', selectedClassId);
            const enrichedUpdates = updates.map(u => {
                const existing = currentSeats?.find(s => s.row_idx === u.row_idx && s.col_idx === u.col_idx);
                return {
                    ...u,
                    student_id: existing?.student_id || null
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
                    {/* 설정 패널 */}
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                            <Grid className="w-5 h-5 text-amber-600" />
                            설정
                        </h2>

                        {/* 행/열 조절 UI */}
                        <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
                            <p className="text-sm font-medium mb-3 text-slate-700 dark:text-slate-300">자리 배치 (행 × 열)</p>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">행</span>
                                    <button onClick={() => setRows(Math.max(1, rows - 1))} className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="font-bold text-lg w-6 text-center text-slate-800 dark:text-white">{rows}</span>
                                    <button onClick={() => setRows(rows + 1)} className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                <span className="text-slate-400">×</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">열</span>
                                    <button onClick={() => setCols(Math.max(1, cols - 1))} className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="font-bold text-lg w-6 text-center text-slate-800 dark:text-white">{cols}</span>
                                    <button onClick={() => setCols(cols + 1)} className="p-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors">
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 모드 전환 */}
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg mb-6">
                            <button
                                onClick={() => setMode('assign')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'assign' ? 'bg-white dark:bg-slate-700 shadow text-slate-800 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                직접 배정
                            </button>
                            <button
                                onClick={() => setMode('price')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'price' ? 'bg-white dark:bg-slate-700 shadow text-amber-600' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <DollarSign className="w-4 h-4 inline mr-1" />
                                가격/마켓
                            </button>
                            <button
                                onClick={() => setMode('lock')}
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${mode === 'lock' ? 'bg-white dark:bg-slate-700 shadow text-red-600' : 'text-slate-500 dark:text-slate-400'}`}
                            >
                                <Lock className="w-4 h-4 inline mr-1" />
                                구매 잠금
                            </button>
                        </div>

                        {mode === 'price' && (
                            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={isAutoBuy}
                                            onChange={async (e) => {
                                                const checked = e.target.checked;
                                                const classId = localStorage.getItem('selected_class_id');
                                                if (classId) {
                                                    setIsAutoBuy(checked);
                                                    await supabase.from('classes').update({ is_auto_real_estate: checked }).eq('id', classId);
                                                    alert(checked ? '자동 구매가 활성화되었습니다.' : '자동 구매가 비활성화되었습니다 (선생님 승인 필요).');
                                                }
                                            }}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                                    </div>
                                    <span className="text-sm font-bold text-amber-900 dark:text-amber-300 group-hover:text-amber-700 dark:group-hover:text-amber-200 transition-colors">학생 즉시 구매 허용</span>
                                </label>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                                    * 켜짐: 학생이 빈 자리를 클릭하면 즉시 잔액이 차감되고 구매됩니다. <br />
                                    * 꺼짐: 구매 요청만 생성되며 선생님이 승인해야 합니다.
                                </p>
                            </div>
                        )}

                        {mode === 'lock' && (
                            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800">
                                <p className="text-sm text-red-700 dark:text-red-300 font-bold mb-1">🔒 구매 잠금 모드</p>
                                <p className="text-xs text-red-500 dark:text-red-400">자리를 클릭하면 잠금/잠금해제가 토글됩니다. 잠긴 자리는 학생에게 '구매 불가'로 표시됩니다.</p>
                            </div>
                        )}

                        {mode === 'assign' ? (
                            <div className="space-y-2">
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">배정할 학생을 선택하고 자리를 클릭하세요.</p>
                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                    <button
                                        onClick={() => setSelectedStudentId('unassign')}
                                        className={`w-full p-2 text-left rounded-lg text-sm transition-colors flex items-center gap-2 ${selectedStudentId === 'unassign' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
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
                                                className={`w-full p-2 text-left rounded-lg text-sm transition-colors flex justify-between ${selectedStudentId === s.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                <span>{s.number}. {s.name}</span>
                                                {isAssigned && <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1 rounded">배정됨</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">설정할 가격 (원)</label>
                                    <input
                                        type="number"
                                        value={priceInput}
                                        onChange={(e) => setPriceInput(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                        step={100}
                                    />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">이 가격을 입력하고 자리를 클릭하면 가격이 변경됩니다.</p>
                                </div>
                                <hr className="border-slate-200 dark:border-slate-700" />
                                <button
                                    onClick={applyDefaultPrices}
                                    className="w-full py-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors"
                                >
                                    <Wand2 className="w-4 h-4" />
                                    기본 규칙 자동 적용
                                </button>
                                <p className="text-xs text-slate-400 dark:text-slate-500">
                                    * 인플레이션 규칙으로 자동 책정됩니다. (총 자산의 60% / 학생 수)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* 승인 대기 거래 */}
                    <div className="glass-panel p-6 border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                            <Users className="w-5 h-5 text-amber-600" />
                            승인 대기 중인 거래 ({trades.length})
                        </h2>
                        {tradesLoading ? (
                            <div className="py-4 text-center text-slate-400">불러오는 중...</div>
                        ) : trades.length > 0 ? (
                            <div className="space-y-3">
                                {trades.map((t) => (
                                    <div key={t.id} className="bg-white dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700 shadow-sm">
                                        <div className="text-sm mb-2 text-slate-700 dark:text-slate-300">
                                            <span className="font-bold text-blue-600 dark:text-blue-400">{t.buyer?.name}</span> 학생이
                                            <span className="font-bold text-amber-600 dark:text-amber-400"> {t.price.toLocaleString()}원</span>에 구매 요청
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleTradeApproval(t, true)}
                                                className="flex-1 py-1 bg-green-600 text-white text-xs font-bold rounded hover:bg-green-700 transition-colors"
                                            >
                                                승인
                                            </button>
                                            <button
                                                onClick={() => handleTradeApproval(t, false)}
                                                className="flex-1 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                                            >
                                                거절
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm">대기 중인 거래가 없습니다.</p>
                        )}
                    </div>
                </div>

                {/* 자리 배치도 */}
                <div className="glass-panel p-6 overflow-x-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex gap-4 text-sm text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded shadow-sm"></div> 빈 자리</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded shadow-sm"></div> 배정됨</span>
                            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-50 border border-red-300 rounded shadow-sm"></div> 구매 잠금</span>
                        </div>
                        <div className="px-4 py-1 bg-slate-800 dark:bg-slate-600 text-white rounded text-xs font-bold shadow-md">
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
                                        onClick={async () => {
                                            if (mode === 'lock') {
                                                // 잠금 토글
                                                const selectedClassId = localStorage.getItem('selected_class_id');
                                                if (!selectedClassId) return;
                                                const isCurrentlyLocked = seat?.is_locked || false;
                                                if (seat) {
                                                    await supabase.from('seats').update({ is_locked: !isCurrentlyLocked }).eq('id', seat.id);
                                                } else {
                                                    await supabase.from('seats').upsert({
                                                        class_id: selectedClassId,
                                                        row_idx: r,
                                                        col_idx: c,
                                                        price: 0,
                                                        is_locked: true
                                                    }, { onConflict: 'class_id, row_idx, col_idx' });
                                                }
                                                fetchData();
                                            } else {
                                                handleSaveSeat(r, c);
                                            }
                                        }}
                                        className={`
                                            aspect-square rounded-xl border-2 p-2 flex flex-col items-center justify-center text-center transition-all cursor-pointer relative overflow-hidden
                                            ${seat?.is_locked
                                                ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 shadow-sm'
                                                : seat?.student_id
                                                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500'
                                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500'
                                            }
                                            ${mode === 'price' ? 'hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 dark:hover:border-amber-600' : ''}
                                            ${mode === 'lock' ? 'hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-400 dark:hover:border-red-600' : ''}
                                        `}
                                    >
                                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 absolute top-1 left-2">
                                            {r + 1}-{c + 1}
                                        </div>

                                        {seat?.is_locked ? (
                                            <div className="flex flex-col items-center gap-1">
                                                <Lock className="w-5 h-5 text-red-400" />
                                                <div className="text-red-500 text-[10px] font-bold">구매 불가</div>
                                            </div>
                                        ) : student ? (
                                            <div className="font-bold text-slate-800 dark:text-white break-keep leading-tight">
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-normal mb-0.5">{student.number}번</div>
                                                {student.name}
                                            </div>
                                        ) : (
                                            <div className="text-slate-300 dark:text-slate-600 text-xs">
                                                빈 자리
                                            </div>
                                        )}

                                        {!seat?.is_locked && (
                                            <div className="absolute bottom-1 right-2 text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-900/30 px-1 rounded">
                                                {seat?.price?.toLocaleString() || 0}
                                            </div>
                                        )}
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
