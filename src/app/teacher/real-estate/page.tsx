
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Home, Users, Plus, Save, Trash2, ArrowLeft, Grid, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function RealEstateManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [seats, setSeats] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState(6);
    const [cols, setCols] = useState(6);
    const supabase = createClient();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        // 1. Fetch Students
        const { data: roster } = await supabase
            .from('student_roster')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('number', { ascending: true });

        setStudents(roster || []);

        // 2. Fetch Seats (Assuming table exists, if not we'll handle gracefully)
        const { data: seatData, error } = await supabase
            .from('seats')
            .select('*')
            .eq('class_id', selectedClassId);

        if (!error && seatData) {
            setSeats(seatData);
        } else {
            console.log('Seats table may not exist or error:', error);
            // Default empty seats if table doesn't exist
        }
    };

    const handleSaveSeat = async (row: number, col: number, studentId: string | null) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            // Upsert seat
            const { error } = await supabase
                .from('seats')
                .upsert({
                    class_id: selectedClassId,
                    row_idx: row,
                    col_idx: col,
                    student_id: studentId || null
                }, { onConflict: 'class_id, row_idx, col_idx' });

            if (error) {
                if (error.code === '42P01') {
                    alert('Supabase에 seats 테이블이 없습니다. 다음 SQL을 실행해주세요:\n\nCREATE TABLE seats (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), class_id UUID REFERENCES classes(id), student_id UUID REFERENCES profiles(id), row_idx INTEGER, col_idx INTEGER, UNIQUE(class_id, row_idx, col_idx));');
                } else {
                    throw error;
                }
            }
            fetchData();
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderGrid = () => {
        const grid = [];
        for (let r = 0; r < rows; r++) {
            const rowCells = [];
            for (let c = 0; c < cols; c++) {
                const seat = seats.find(s => s.row_idx === r && s.col_idx === c);
                const assignedStudent = students.find(s => s.id === seat?.student_id);

                rowCells.push(
                    <div
                        key={`${r}-${c}`}
                        className={`aspect-square border rounded-lg p-2 flex flex-col items-center justify-center text-center transition-all ${seat?.student_id ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 hover:border-blue-300'}`}
                    >
                        {assignedStudent ? (
                            <div className="flex flex-col items-center">
                                <span className="text-xs text-slate-500 font-medium mb-1">{assignedStudent.number}번</span>
                                <span className="font-bold text-slate-800">{assignedStudent.name}</span>
                                <button
                                    onClick={() => handleSaveSeat(r, c, null)}
                                    className="mt-2 text-[10px] text-red-500 hover:underline"
                                >
                                    해제
                                </button>
                            </div>
                        ) : (
                            <select
                                onChange={(e) => handleSaveSeat(r, c, e.target.value)}
                                className="w-full text-xs bg-transparent border-none focus:ring-0 text-slate-400"
                                value=""
                            >
                                <option value="">배정하기</option>
                                {students
                                    .filter(s => !seats.find(st => st.student_id === s.id))
                                    .map(s => (
                                        <option key={s.id} value={s.id}>{s.number}. {s.name}</option>
                                    ))
                                }
                            </select>
                        )}
                    </div>
                );
            }
            grid.push(<div key={r} className="grid grid-cols-6 gap-2">{rowCells}</div>);
        }
        return grid;
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
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Grid className="w-5 h-5 text-blue-600" />
                            그리드 설정
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">행 (Rows)</label>
                                    <input
                                        type="number"
                                        value={rows}
                                        onChange={e => setRows(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">열 (Cols)</label>
                                    <input
                                        type="number"
                                        value={cols}
                                        onChange={e => setCols(Number(e.target.value))}
                                        className="w-full p-2 border rounded-lg"
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 italic">* 현재 버전에서는 최대 6x6 그리드를 지원합니다.</p>
                        </div>
                    </div>

                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4">현황 요약</h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>전체 학생:</span>
                                <b>{students.length}명</b>
                            </div>
                            <div className="flex justify-between">
                                <span>배정 완료:</span>
                                <b className="text-blue-600">{seats.filter(s => s.student_id).length}명</b>
                            </div>
                            <div className="flex justify-between">
                                <span>미배정 학생:</span>
                                <b className="text-amber-600">{students.length - seats.filter(s => s.student_id).length}명</b>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 overflow-auto">
                    <div className="mb-6 flex justify-between items-center">
                        <h2 className="text-xl font-semibold">교실 배치도 (칠판 방향)</h2>
                        <div className="w-24 h-4 bg-slate-200 rounded text-[10px] flex items-center justify-center font-bold text-slate-400">BOARD</div>
                    </div>
                    <div className="min-w-[500px] space-y-2">
                        {renderGrid()}
                    </div>
                </div>
            </div>
        </div>
    );
}
