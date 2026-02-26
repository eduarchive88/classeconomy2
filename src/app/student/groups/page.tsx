'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Users,
    ChevronLeft,
    Wallet,
    PlusCircle,
    LayoutGrid,
    Crown,
    CheckCircle2,
    Lock,
    Unlock,
    AlertCircle,
    Info,
    ArrowRight
} from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { getStudentInfo } from '@/utils/student-auth';

interface GroupMember {
    student_id: string;
    nickname: string;
}

interface GroupInfo {
    id: string;
    name: string;
    leader_id: string;
    balance: number;
    members: GroupMember[];
}

interface GroupSeat {
    id: string;
    row_idx: number;
    col_idx: number;
    group_id: string | null;
    price: number;
    is_locked: boolean;
    group_name?: string;
}

interface ClassSettings {
    group_rows: number;
    group_cols: number;
}

export default function StudentGroupsPage() {
    const router = useRouter();
    const supabase = createClient();
    const [loading, setLoading] = useState(true);
    const [student, setStudent] = useState<any>(null);
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [seats, setSeats] = useState<GroupSeat[]>([]);
    const [settings, setSettings] = useState<ClassSettings>({ group_rows: 4, group_cols: 4 });
    const [donationAmount, setDonationAmount] = useState<string>('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedSeat, setSelectedSeat] = useState<GroupSeat | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const studentInfo = await getStudentInfo();
            if (!studentInfo) {
                router.push('/student/login');
                return;
            }
            setStudent(studentInfo);

            // Get group info
            const { data: memberData } = await supabase
                .from('group_members')
                .select('group_id, groups(id, name, leader_id, balance)')
                .eq('student_id', studentInfo.id)
                .single();

            if (memberData && memberData.groups) {
                const groupData = memberData.groups as any;

                // Get all members of this group
                const { data: allMembers } = await supabase
                    .from('group_members')
                    .select('student_id, students(nickname)')
                    .eq('group_id', groupData.id);

                setGroup({
                    id: groupData.id,
                    name: groupData.name,
                    leader_id: groupData.leader_id,
                    balance: groupData.balance,
                    members: (allMembers || []).map((m: any) => ({
                        student_id: m.student_id,
                        nickname: m.students?.nickname || '알 수 없음'
                    }))
                });
            }

            // Get class settings
            const { data: classData } = await supabase
                .from('classes')
                .select('group_rows, group_cols')
                .eq('id', studentInfo.class_id)
                .single();

            if (classData) {
                setSettings({
                    group_rows: classData.group_rows || 4,
                    group_cols: classData.group_cols || 4
                });
            }

            // Get seats
            const { data: seatsData } = await supabase
                .from('group_seats')
                .select('*, groups(name)')
                .eq('class_id', studentInfo.class_id);

            setSeats((seatsData || []).map((s: any) => ({
                ...s,
                group_name: s.groups?.name
            })));

        } catch (error) {
            console.error('Data loading error:', error);
        } finally {
            setLoading(false);
        }
    }, [supabase, router]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleDonate = async () => {
        if (!group || !donationAmount || isNaN(Number(donationAmount))) return;
        const amount = Number(donationAmount);
        if (amount <= 0) {
            alert('기부 금액은 0보다 커야 합니다.');
            return;
        }
        if (amount > student.balance) {
            alert('잔액이 부족합니다.');
            return;
        }

        if (!confirm(`${amount.toLocaleString()}원을 모둠 자금으로 기부하시겠습니까?\n기부된 자금은 돌려받을 수 없습니다.`)) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/student/groups/donate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    groupId: group.id,
                    amount
                })
            });

            if (response.ok) {
                alert('기부가 완료되었습니다!');
                setDonationAmount('');
                loadData();
            } else {
                const error = await response.json();
                alert(`기부 실패: ${error.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            alert('기부 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleBuySeat = async () => {
        if (!group || !selectedSeat) return;
        if (group.leader_id !== student.id) {
            alert('모둠장만 자리를 구매할 수 있습니다.');
            return;
        }

        if (selectedSeat.group_id) {
            alert('이미 주인이 있는 자리입니다.');
            return;
        }

        if (selectedSeat.is_locked) {
            alert('잠겨있는 자리는 구매할 수 없습니다.');
            return;
        }

        if (group.balance < selectedSeat.price) {
            alert('모둠 자금이 부족합니다.');
            return;
        }

        if (!confirm(`'${selectedSeat.price.toLocaleString()}원'에 이 자리를 구매하시겠습니까?`)) return;

        setSubmitting(true);
        try {
            const response = await fetch('/api/student/groups/buy-seat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: student.id,
                    groupId: group.id,
                    seatId: selectedSeat.id
                })
            });

            const result = await response.json();
            if (response.ok) {
                alert(result.message || '구매 요청이 완료되었습니다!');
                setSelectedSeat(null);
                loadData();
            } else {
                alert(`구매 실패: ${result.message || '알 수 없는 오류'}`);
            }
        } catch (error) {
            alert('구매 중 오류가 발생했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    if (!group) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
                <div className="max-w-xl mx-auto text-center py-20">
                    <Users className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-700 mb-6" />
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">소속된 모둠이 없습니다</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8">선생님이 학생을 모둠에 편성해 주셔야 활동에 참여할 수 있습니다.</p>
                    <button
                        onClick={() => router.push('/student')}
                        className="flex items-center gap-2 mx-auto px-6 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <ChevronLeft className="w-4 h-4" /> 대시보드로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    const isLeader = group.leader_id === student.id;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/student')}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </button>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
                            모둠 활동
                        </h1>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-orange-50 dark:bg-orange-900/20 rounded-full border border-orange-100 dark:border-orange-800/30">
                        <Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span className="text-sm font-bold text-orange-700 dark:text-orange-400">{group.name}</span>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Group Status & Donation */}
                    <div className="space-y-6">
                        {/* Group Info Card */}
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Info className="w-5 h-5 text-orange-500" />
                                    우리 모둠 정보
                                </h3>
                                {isLeader && (
                                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                                        <Crown className="w-3 h-3" /> Leader
                                    </span>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">모둠 자산</p>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-black text-orange-600 dark:text-orange-400">
                                            {group.balance.toLocaleString()}
                                        </span>
                                        <span className="text-sm font-bold text-orange-500">원</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 px-1">모둠원 목록</p>
                                    <div className="flex flex-wrap gap-2">
                                        {group.members.map(member => (
                                            <div
                                                key={member.student_id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${member.student_id === group.leader_id
                                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400'
                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                                    }`}
                                            >
                                                {member.student_id === group.leader_id && <Crown className="w-3.5 h-3.5" />}
                                                <span className="text-sm font-medium">{member.nickname}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Donation Card */}
                        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-6 shadow-lg shadow-orange-500/20 text-white">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                                    <Wallet className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold">모둠 자금 기부</h3>
                                    <p className="text-xs text-orange-50/80">개인 자산에서 모둠으로 기부</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-medium text-orange-50">내 잔액</span>
                                        <span className="text-sm font-bold">{student.balance.toLocaleString()}원</span>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={donationAmount}
                                            onChange={(e) => setDonationAmount(e.target.value.replace(/[^0-9]/g, ''))}
                                            placeholder="기부할 금액 입력"
                                            className="w-full bg-white text-slate-900 px-4 py-3 rounded-xl font-bold placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                                            원
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleDonate}
                                    disabled={submitting || !donationAmount}
                                    className="w-full bg-white text-orange-600 font-black py-4 rounded-2xl shadow-lg hover:bg-orange-50 disabled:bg-orange-300/50 disabled:text-orange-50/50 transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {submitting ? (
                                        <div className="w-5 h-5 border-2 border-orange-600 border-t-transparent animate-spin rounded-full" />
                                    ) : (
                                        <>기부하기 <ArrowRight className="w-4 h-4" /></>
                                    )}
                                </button>
                                <p className="text-[10px] text-center text-orange-50/70">
                                    * 한 번 기부한 금액은 다시 돌려받을 수 없습니다.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Seating Arrangement */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 min-h-[500px] flex flex-col">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-orange-100 dark:bg-orange-900/40 rounded-xl text-orange-600 dark:text-orange-400">
                                        <LayoutGrid className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">모둠 자리 배치도</h3>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">자리를 선택하여 상세 정보를 확인하세요</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 px-4 py-2 rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-orange-500"></div>
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 italic">우리 모둠</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700"></div>
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 italic">구매 가능</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-800"></div>
                                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 italic">타모둠</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 overflow-auto">
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${settings.group_cols}, minmax(0, 1fr))`,
                                    gap: '12px',
                                    padding: '12px'
                                }}>
                                    {Array.from({ length: settings.group_rows * settings.group_cols }).map((_, idx) => {
                                        const r = Math.floor(idx / settings.group_cols);
                                        const c = idx % settings.group_cols;
                                        const seat = seats.find(s => s.row_idx === r && s.col_idx === c);
                                        const isMyGroup = seat?.group_id === group.id;
                                        const isOtherGroup = seat?.group_id && seat.group_id !== group.id;
                                        const isSelected = selectedSeat?.id === seat?.id && seat !== undefined;

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => seat && setSelectedSeat(seat)}
                                                disabled={!seat}
                                                className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center transition-all shadow-sm ${!seat
                                                        ? 'bg-transparent border border-dashed border-slate-200 dark:border-slate-800 opacity-20 cursor-not-allowed'
                                                        : isMyGroup
                                                            ? 'bg-orange-500 text-white shadow-orange-500/20 transform scale-105 z-10'
                                                            : isOtherGroup
                                                                ? 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-500'
                                                                : isSelected
                                                                    ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500 text-orange-600 ring-4 ring-orange-500/10 scale-110 z-20'
                                                                    : 'bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:border-orange-300 dark:hover:border-orange-700/50 hover:bg-orange-50/50 dark:hover:bg-orange-900/10'
                                                    }`}
                                            >
                                                {seat?.is_locked && !isMyGroup && (
                                                    <div className="absolute -top-1.5 -right-1.5 p-1 bg-slate-900 dark:bg-slate-700 rounded-lg shadow-lg">
                                                        <Lock className="w-2.5 h-2.5 text-white" />
                                                    </div>
                                                )}

                                                {isMyGroup ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <CheckCircle2 className="w-6 h-6" />
                                                        <span className="text-[10px] font-black uppercase text-orange-100">Mine</span>
                                                    </div>
                                                ) : isOtherGroup ? (
                                                    <div className="flex flex-col items-center gap-1 truncate w-full px-1">
                                                        <Users className="w-5 h-5 opacity-40" />
                                                        <span className="text-[9px] font-bold truncate max-w-full italic">{seat.group_name}</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        <span className="text-[10px] font-bold opacity-60 italic mb-0.5">{r + 1}-{c + 1}</span>
                                                        <span className="text-xs font-bold">{Math.floor(seat?.price || 0 / 10000)}만</span>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Selection Preview */}
                            <div className={`mt-8 transition-all duration-300 ${selectedSeat ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-100 dark:border-orange-800/30 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center shadow-md border border-orange-200 dark:border-orange-800">
                                            <LayoutGrid className="w-8 h-8 text-orange-500" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-slate-900 dark:text-white">모둠 자리 상세 정보</h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <LayoutGrid className="w-4 h-4" /> 행: {selectedSeat?.row_idx ? selectedSeat.row_idx + 1 : 1}, 열: {selectedSeat?.col_idx ? selectedSeat.col_idx + 1 : 1}
                                                </span>
                                                <span className="flex items-center gap-1 font-bold text-orange-600 dark:text-orange-400">
                                                    <Wallet className="w-4 h-4" /> 가격: {selectedSeat?.price.toLocaleString()}원
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                                        {selectedSeat?.group_id ? (
                                            <div className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold rounded-xl flex items-center gap-2">
                                                <Users className="w-5 h-5" />
                                                {selectedSeat.group_id === group.id ? '우리 모둠 소유 자리' : `'${selectedSeat.group_name}' 소유 자리`}
                                            </div>
                                        ) : selectedSeat?.is_locked ? (
                                            <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold rounded-xl flex items-center gap-2 italic">
                                                <Lock className="w-5 h-5" /> 선생님이 잠금 처리한 자리
                                            </div>
                                        ) : isLeader ? (
                                            <button
                                                onClick={handleBuySeat}
                                                disabled={submitting}
                                                className="w-full sm:w-auto px-8 py-4 bg-orange-600 text-white font-black rounded-2xl shadow-lg shadow-orange-600/20 hover:bg-orange-700 transition-all flex items-center justify-center gap-2 group whitespace-nowrap"
                                            >
                                                {submitting ? (
                                                    <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                                                ) : (
                                                    <>자리 구매하기 <PlusCircle className="w-5 h-5 group-hover:rotate-90 transition-transform" /></>
                                                )}
                                            </button>
                                        ) : (
                                            <div className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold rounded-xl flex items-center gap-2 text-sm italic">
                                                <Info className="w-5 h-5" /> 구매 가능 (모둠장만 구매 가능)
                                            </div>
                                        )}
                                        <button
                                            onClick={() => setSelectedSeat(null)}
                                            className="w-full sm:w-auto px-6 py-4 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-600 transition-all whitespace-nowrap border border-slate-200 dark:border-slate-600"
                                        >
                                            취소
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Guide Section */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-slate-100 dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                    <Info className="w-5 h-5 text-blue-500" />
                                    활동 가이드
                                </h4>
                                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        모둠원들은 각자 원하는 만큼 모둠 자금을 <b>기부</b>할 수 있습니다.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        기부한 돈은 <b>개인 자산에서 차감</b>되며, 다시 돌려받을 수 없으니 주의하세요.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        <b>모둠장</b>은 모여진 자금으로 모둠 자리를 구매할 수 있습니다.
                                    </li>
                                </ul>
                            </div>
                            <div className="bg-slate-100 dark:bg-slate-800/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-700/50">
                                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
                                    <AlertCircle className="w-5 h-5 text-amber-500" />
                                    자리 구매 규칙
                                </h4>
                                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        모둠 자리의 기본 가격은 개인 부동산 자리 가격의 <b>4배</b>입니다.
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        누군가 자리를 구매하면, 전체 모둠 자리의 가격이 오를 수 있습니다 (인플레이션).
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-orange-500 font-bold">•</span>
                                        선생님의 설정에 따라 구매 즉시 승인되거나 대기 상태가 될 수 있습니다.
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

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
