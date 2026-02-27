
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Home, Users, Plus, Save, Trash2, ArrowLeft, Grid, MapPin, DollarSign, Wand2, Minus, Lock, Check, X, Shield, Crown } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function GroupActivityManagement() {
    const [students, setStudents] = useState<any[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [seats, setSeats] = useState<any[]>([]);
    const [trades, setTrades] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'management' | 'seats' | 'trades'>('management');

    // 자리 관련 상태
    const [rows, setRows] = useState(3);
    const [cols, setCols] = useState(4);
    const [seatMode, setSeatMode] = useState<'assign' | 'price' | 'lock'>('assign');
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [priceInput, setPriceInput] = useState<number>(4000);
    const [isAutoGroupSeat, setIsAutoGroupSeat] = useState(false);

    const supabase = createClient();

    const fetchData = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            // 1. 학생 목록
            const { data: studentsData } = await supabase
                .from('student_roster')
                .select('*')
                .eq('class_id', selectedClassId)
                .order('name', { ascending: true });
            setStudents(studentsData || []);

            // 2. 모둠 목록
            const resGroups = await fetch(`/api/teacher/groups?classId=${selectedClassId}`);
            const dataGroups = await resGroups.json();
            setGroups(dataGroups.groups || []);

            // 3. 자리 및 클래스 설정
            const resSeats = await fetch(`/api/teacher/groups/seats?classId=${selectedClassId}`);
            const dataSeats = await resSeats.json();
            setRows(dataSeats.groupRows || 3);
            setCols(dataSeats.groupCols || 4);
            setIsAutoGroupSeat(dataSeats.isAutoGroupSeat || false);
            setSeats(dataSeats.seats || []);

            // 4. 승인 대기 거래
            const { data: tradesData } = await supabase
                .from('group_seat_trades')
                .select('*, group:group_id(name), seat:seat_id(row_idx, col_idx)')
                .eq('class_id', selectedClassId)
                .eq('status', 'pending');
            setTrades(tradesData || []);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 모둠 생성 및 저장
    const handleSaveGroups = async (updatedGroups: any[]) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedClassId, groups: updatedGroups })
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || '저장 실패');
            }
            alert('모둠 설정이 저장되었습니다.');
            fetchData();
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const addGroup = () => {
        const newGroup = {
            id: `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: `${groups.length + 1}모둠`,
            leader_id: null,
            memberIds: []
        };
        setGroups([...groups, newGroup]);
        setSelectedGroupId(newGroup.id);
    };

    const deleteGroup = async (id: string) => {
        if (!confirm('정말 이 모둠을 삭제하시겠습니까? 소속 멤버와 자산 정보가 사라집니다.')) return;
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/groups', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupId: id })
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || '삭제 실패');
            }
            fetchData();
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // 자리 저장
    const handleSaveSeat = async (row: number, col: number) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        const existingSeat = seats.find(s => s.row_idx === row && s.col_idx === col);

        let updateData: any = {
            row_idx: row,
            col_idx: col,
        };
        if (existingSeat) updateData.id = existingSeat.id;

        if (seatMode === 'assign') {
            updateData.group_id = selectedGroupId; // null이면 비우기
        } else if (seatMode === 'price') {
            updateData.price = priceInput;
        } else if (seatMode === 'lock') {
            updateData.is_locked = !existingSeat?.is_locked;
        }

        try {
            const res = await fetch('/api/teacher/groups/seats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedClassId, seats: [updateData] })
            });
            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || '저장 실패');
            }
            fetchData();
        } catch (e: any) {
            alert('오류: ' + e.message);
        }
    };

    // 기본 가격 자동 적용 (인플레이션 규칙)
    const applyDefaultPrices = async () => {
        if (!confirm('현재 모둠 자리 가격을 인플레이션 규칙((학급 총 자산 * 60%) / 모둠 수)으로 일괄 적용하시겠습니까?')) return;

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        setLoading(true);
        try {
            const totalAssets = students.reduce((sum, s) => sum + (s.balance || 0), 0) || 0;
            const groupCount = groups.length || 1;

            const basePrice = Math.floor((totalAssets * 0.6) / groupCount);
            const finalBasePrice = Math.max(100, basePrice);

            const updates = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const variation = Math.floor(finalBasePrice * 0.1);
                    const rowFactor = r - Math.floor(rows / 2);
                    const price = Math.max(100, finalBasePrice + (rowFactor * variation));

                    const existingSeat = seats.find(s => s.row_idx === r && s.col_idx === c);
                    let updateData: any = {
                        row_idx: r,
                        col_idx: c,
                        price: Math.floor(price / 10) * 10
                    };
                    if (existingSeat) {
                        updateData.id = existingSeat.id;
                        updateData.group_id = existingSeat.group_id;
                        updateData.is_locked = existingSeat.is_locked;
                    }
                    updates.push(updateData);
                }
            }

            const res = await fetch('/api/teacher/groups/seats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedClassId, seats: updates })
            });

            if (!res.ok) {
                const d = await res.json();
                throw new Error(d.error || '가격 적용 실패');
            }

            fetchData();
            alert('가격이 적용되었습니다.');
        } catch (e: any) {
            alert('오류: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const updateGridSize = async (newRows: number, newCols: number) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        try {
            const res = await fetch('/api/teacher/groups/seats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedClassId, groupRows: newRows, groupCols: newCols })
            });
            if (!res.ok) throw new Error('설정 실패');
            setRows(newRows);
            setCols(newCols);
            fetchData();
        } catch (e: any) {
            alert(e.message);
        }
    };

    const updateAutoBuy = async (val: boolean) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        try {
            const res = await fetch('/api/teacher/groups/seats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: selectedClassId, isAutoGroupSeat: val })
            });
            if (!res.ok) throw new Error('설정 실패');
            setIsAutoGroupSeat(val);
        } catch (e: any) {
            alert(e.message);
        }
    };

    const handleTradeAction = async (tradeId: string, action: 'approve' | 'reject') => {
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/groups/approve-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tradeId, action })
            });
            if (!res.ok) throw new Error('처리 실패');
            alert(action === 'approve' ? '승인되었습니다.' : '거절되었습니다.');
            fetchData();
        } catch (e: any) {
            alert(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen pb-20">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
                <Link href="/teacher" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="w-8 h-8 text-orange-500" />
                        모둠 활동 관리
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">학급 모둠을 편성하고 전용 부동산 자리를 운영합니다.</p>
                </div>
                <div className="ml-auto">
                    <ClassSelector onClassChange={fetchData} />
                </div>
            </div>

            {/* 탭 메뉴 */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-8 overflow-x-auto scrollbar-hide">
                <button
                    onClick={() => setActiveTab('management')}
                    className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'management' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    모둠 편성 및 관리
                </button>
                <button
                    onClick={() => setActiveTab('seats')}
                    className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap ${activeTab === 'seats' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    모둠 자리 배치도
                </button>
                <button
                    onClick={() => setActiveTab('trades')}
                    className={`px-6 py-3 font-semibold text-sm transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${activeTab === 'trades' ? 'border-orange-500 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    구매 승인 관리
                    {trades.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{trades.length}</span>}
                </button>
            </div>

            {/* 탭 콘텐츠 */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeTab === 'management' && (
                    <div className="grid gap-6">
                        <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-500" />
                                우리 반 모둠 목록
                            </h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={addGroup}
                                    className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-slate-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> 모둠 추가
                                </button>
                                <button
                                    onClick={() => handleSaveGroups(groups)}
                                    className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-bold flex items-center gap-2 hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/20"
                                >
                                    <Save className="w-4 h-4" /> 전체 저장
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {groups.map((group, idx) => {
                                const groupMemberIds = group.group_members?.map((m: any) => m.student_id) || group.memberIds || [];

                                return (
                                    <div
                                        key={group.id || `new-${idx}`}
                                        onClick={() => { if (group.id) setSelectedGroupId(group.id); }}
                                        className={`glass-panel p-5 relative group cursor-pointer transition-all duration-300 ${selectedGroupId === group.id ? 'ring-8 ring-orange-100 border-4 border-orange-600 bg-orange-50 shadow-2xl transform scale-[1.05] z-10 dark:bg-orange-950/40 dark:ring-orange-900/20' : 'hover:border-orange-200 dark:hover:border-slate-500'}`}
                                    >
                                        {selectedGroupId === group.id && (
                                            <div className="absolute -top-3 -right-3 bg-orange-600 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-lg flex items-center gap-1 z-20">
                                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                                선택됨
                                            </div>
                                        )}
                                        <button
                                            onClick={() => deleteGroup(group.id)}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 p-1 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>

                                        <input
                                            value={group.name}
                                            onChange={(e) => {
                                                const newGroups = [...groups];
                                                newGroups[idx].name = e.target.value;
                                                setGroups(newGroups);
                                            }}
                                            className="text-xl font-bold bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 focus:border-orange-500 focus:outline-none mb-4 w-full dark:text-white"
                                            placeholder="모둠 이름을 입력하세요"
                                        />

                                        <div className="mb-4">
                                            <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-2">
                                                <Shield className="w-3 h-3 text-amber-500" /> 모둠장 설정
                                            </label>
                                            <select
                                                value={group.leader_id || ''}
                                                onChange={(e) => {
                                                    const newGroups = [...groups];
                                                    newGroups[idx].leader_id = e.target.value || null;
                                                    setGroups(newGroups);
                                                }}
                                                className="w-full p-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                            >
                                                <option value="">모둠장 선택 없음</option>
                                                {students.filter(s => groupMemberIds.includes(s.id)).map(s => (
                                                    <option key={s.id} value={s.id}>{s.number}. {s.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">모둠원 관리</label>
                                            <div className="min-h-[100px] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-2 space-y-1">
                                                {groupMemberIds.length === 0 && <p className="text-[11px] text-center py-8 text-slate-400">아래 학생 명단에서 선택하세요</p>}
                                                <div className="flex flex-wrap gap-1">
                                                    {students.filter(s => groupMemberIds.includes(s.id)).map(s => (
                                                        <div key={s.id} className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs flex items-center gap-1 dark:text-slate-200">
                                                            {s.name}
                                                            <button
                                                                onClick={() => {
                                                                    const newGroups = [...groups];
                                                                    newGroups[idx].memberIds = groupMemberIds.filter((id: string) => id !== s.id);
                                                                    // API 응답 구조와 맞추기 위해 group_members도 업데이트 필요할 수 있음
                                                                    newGroups[idx].group_members = newGroups[idx].memberIds.map((id: string) => ({ student_id: id }));
                                                                    if (newGroups[idx].leader_id === s.id) newGroups[idx].leader_id = null;
                                                                    setGroups(newGroups);
                                                                }}
                                                                className="hover:text-red-500"
                                                            ><X className="w-3 h-3" /></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium">현재 모둠 자산:</span>
                                            <span className="font-bold text-orange-600 dark:text-orange-400">{(group.balance || 0).toLocaleString()}원</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* 모둠에 배정되지 않은 학생 목록 */}
                        <div className="glass-panel p-6 bg-slate-50/50">
                            <div className="flex items-center gap-3 mb-4">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">학급 학생 명단</h3>
                                {selectedGroupId ? (
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800">
                                        ▶ '{groups.find(g => g.id === selectedGroupId)?.name}' 모둠에 배정 중
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 bg-slate-100 text-slate-500 text-xs font-medium rounded-full border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                        위에서 모둠 카드를 클릭하여 선택하세요
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {students.map(s => {
                                    const assignedGroup = groups.find(g => (g.group_members?.some((m: any) => m.student_id === s.id)) || (g.memberIds?.includes(s.id)));
                                    return (
                                        <button
                                            key={s.id}
                                            disabled={!!assignedGroup || !selectedGroupId}
                                            onClick={() => {
                                                if (!selectedGroupId) {
                                                    alert('먼저 위에서 대상 모둠 카드를 클릭해주세요.');
                                                    return;
                                                }
                                                const targetGroup = groups.find(g => g.id === selectedGroupId);
                                                if (targetGroup) {
                                                    const newGroups = [...groups];
                                                    const gIdx = newGroups.findIndex(g => g.id === selectedGroupId);
                                                    const currentIds = newGroups[gIdx].memberIds || newGroups[gIdx].group_members?.map((m: any) => m.student_id) || [];
                                                    if (!currentIds.includes(s.id)) {
                                                        newGroups[gIdx].memberIds = [...currentIds, s.id];
                                                        newGroups[gIdx].group_members = newGroups[gIdx].memberIds.map((id: string) => ({ student_id: id }));
                                                        setGroups(newGroups);
                                                    }
                                                }
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${assignedGroup ? 'bg-slate-200 text-slate-400 line-through dark:bg-slate-800' : !selectedGroupId ? 'bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-slate-800' : 'bg-white border text-slate-700 hover:border-orange-500 hover:text-orange-600 shadow-sm dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'}`}
                                        >
                                            {s.number}. {s.name} {assignedGroup && `[${assignedGroup.name}]`}
                                        </button>
                                    );
                                })}
                            </div>
                            <p className="text-[11px] text-slate-400 mt-4">* 위 모둠 카드를 클릭하여 대상 모둠을 선택한 후, 학생을 클릭하면 해당 모둠에 배정됩니다.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'seats' && (
                    <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
                        <div className="space-y-6">
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                    <Grid className="w-5 h-5 text-orange-500" />
                                    자리 설정
                                </h3>

                                <div className="mb-6">
                                    <p className="text-xs font-bold text-slate-500 mb-2 uppercase">그리드 크기</p>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <input
                                                type="number" value={rows}
                                                onChange={(e) => updateGridSize(Number(e.target.value), cols)}
                                                className="w-full p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            />
                                        </div>
                                        <span className="text-slate-400">×</span>
                                        <div className="flex-1">
                                            <input
                                                type="number" value={cols}
                                                onChange={(e) => updateGridSize(rows, Number(e.target.value))}
                                                className="w-full p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center bg-slate-50 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <button
                                            onClick={() => setSeatMode('assign')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${seatMode === 'assign' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            모둠배정
                                        </button>
                                        <button
                                            onClick={() => setSeatMode('price')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${seatMode === 'price' ? 'bg-white dark:bg-slate-700 shadow-sm text-orange-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            가격설정
                                        </button>
                                        <button
                                            onClick={() => setSeatMode('lock')}
                                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${seatMode === 'lock' ? 'bg-white dark:bg-slate-700 shadow-sm text-red-600' : 'text-slate-500 hover:text-slate-700'}`}
                                        >
                                            잠금설정
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
                                        <span className="text-xs font-semibold text-slate-400 whitespace-nowrap">자동 승인</span>
                                        <button
                                            onClick={() => updateAutoBuy(!isAutoGroupSeat)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isAutoGroupSeat ? 'bg-green-500' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isAutoGroupSeat ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>

                                {seatMode === 'assign' && (
                                    <div className="mt-6 space-y-2">
                                        <button
                                            onClick={() => setSelectedGroupId(null)}
                                            className={`w-full p-2 text-left text-xs rounded-lg transition-colors ${selectedGroupId === null ? 'bg-red-50 text-red-600 border border-red-200' : 'hover:bg-slate-50 text-slate-600'}`}
                                        >배정 해제 (공실)</button>
                                        {groups.map(g => (
                                            <button
                                                key={g.id}
                                                onClick={() => setSelectedGroupId(g.id)}
                                                className={`w-full p-2 text-left text-xs rounded-lg transition-all ${selectedGroupId === g.id ? 'bg-orange-500 text-white shadow-md font-bold' : 'hover:bg-slate-50 text-slate-600 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                                            >{g.name}</button>
                                        ))}
                                    </div>
                                )}

                                {seatMode === 'price' && (
                                    <div className="mt-6 space-y-4">
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">적용할 가격 (원)</label>
                                            <input
                                                type="number" value={priceInput}
                                                onChange={(e) => setPriceInput(Number(e.target.value))}
                                                className="w-full p-2 rounded-lg border dark:bg-slate-800 dark:border-slate-700 mb-2 font-mono"
                                                step={100}
                                            />
                                            <p className="text-[10px] text-slate-400">* 클릭 시 해당 가격으로 변경됩니다.</p>
                                        </div>
                                        <hr className="border-slate-200 dark:border-slate-700" />
                                        <button
                                            onClick={applyDefaultPrices}
                                            className="w-full py-2 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/40 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                            기본 규칙 자동 적용
                                        </button>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">
                                            * 인플레이션 규칙으로 자동 책정됩니다. (총 자산의 60% / 모둠 수)
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="glass-panel p-8 bg-white dark:bg-slate-800">
                            <div className="bg-slate-800 text-white p-2 rounded mb-8 text-center text-xs font-bold uppercase tracking-widest">
                                칠판 (FRONT)
                            </div>
                            <div className="overflow-auto max-h-[600px] p-4">
                                <div
                                    className="grid gap-3 mx-auto w-fit"
                                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(100px, 1fr))` }}
                                >
                                    {Array.from({ length: rows }).map((_, r) => (
                                        Array.from({ length: cols }).map((_, c) => {
                                            const seat = seats.find(s => s.row_idx === r && s.col_idx === c);
                                            const group = groups.find(g => g.id === seat?.group_id);

                                            return (
                                                <div
                                                    key={`${r}-${c}`}
                                                    onClick={() => handleSaveSeat(r, c)}
                                                    className={`aspect-video rounded-xl border-2 flex flex-col items-center justify-center text-center cursor-pointer transition-all relative ${seat?.is_locked ? 'bg-red-50 border-red-200' : group ? 'bg-orange-50 border-orange-400 shadow-md ring-2 ring-orange-100' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-70 hover:opacity-100 hover:border-slate-400 hover:shadow-lg'}`}
                                                >
                                                    <span className="absolute top-1 left-2 text-[10px] font-mono text-slate-400">{r + 1}-{c + 1}</span>
                                                    {seat?.is_locked ? (
                                                        <Lock className="w-5 h-5 text-red-400" />
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center gap-0.5 px-2">
                                                            {group ? (
                                                                <div className="text-[13px] font-black text-orange-700 dark:text-orange-300 mb-0.5 drop-shadow-sm">{group.name}</div>
                                                            ) : (
                                                                <div className="text-[10px] font-medium text-slate-300 dark:text-slate-600 italic mb-0.5">미배정</div>
                                                            )}
                                                            <div className={`text-[10px] font-mono ${group ? 'text-slate-500 dark:text-slate-400 font-bold' : 'text-slate-400'}`}>
                                                                {seat?.price != null ? `${seat.price.toLocaleString()}원` : <span className="text-[9px] opacity-60">가격 미설정</span>}
                                                            </div>
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
                )}

                {activeTab === 'trades' && (
                    <div className="grid gap-6">
                        <div className="glass-panel p-6">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <DollarSign className="w-6 h-6 text-emerald-500" />
                                모둠 자리 구매 승인 대기 목록
                            </h2>
                            {trades.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 italic">현재 대기 중인 구매 신청이 없습니다.</div>
                            ) : (
                                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {trades.map(t => (
                                        <div key={t.id} className="py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 dark:text-white">
                                                        <span className="text-orange-500">{t.group?.name}</span> 모둠의 자리 구매 신청
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                                                        <MapPin className="w-3 h-3 text-slate-400" /> {t.seat?.row_idx + 1}행 {t.seat?.col_idx + 1}열
                                                        <span className="mx-1">•</span>
                                                        <DollarSign className="w-3 h-3 text-emerald-500" /> <span className="font-bold text-emerald-600 dark:text-emerald-400">{t.price.toLocaleString()}원</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex gap-2 w-full md:w-auto">
                                                <button
                                                    onClick={() => handleTradeAction(t.id, 'approve')}
                                                    className="flex-1 md:w-24 py-2 bg-emerald-500 text-white rounded-lg text-sm font-bold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Check className="w-4 h-4" /> 승인
                                                </button>
                                                <button
                                                    onClick={() => handleTradeAction(t.id, 'reject')}
                                                    className="flex-1 md:w-24 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <X className="w-4 h-4" /> 거절
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="mt-auto py-8 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                        만든 사람: 경기도 지구과학 교사 뀨짱, 문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">카카오톡 오픈채팅</a>,
                        블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">뀨짱쌤의 교육자료 아카이브</a>
                    </p>
                </div>
            </footer>
        </div>
    );
}
