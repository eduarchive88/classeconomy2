'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MapPin, DollarSign, ArrowLeft, RefreshCw, User, Lock } from 'lucide-react';
import Link from 'next/link';

export default function StudentRealEstate() {
    const [seats, setSeats] = useState<any[]>([]);
    const [roster, setRoster] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    // 동적 그리드 크기 (API 응답에서 받아옴)
    const [gridRows, setGridRows] = useState(5);
    const [gridCols, setGridCols] = useState(6);
    // 내가 대기 중인 거래 목록 (pending)
    const [pendingTrades, setPendingTrades] = useState<any[]>([]);
    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        try {
            const sessionStr = localStorage.getItem('student_session');
            let studentId = '';
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    studentId = session.student?.id || '';
                } catch (e) { }
            }

            const response = await fetch('/api/student/real-estate', {
                headers: {
                    'x-student-id': studentId
                }
            });
            if (!response.ok) throw new Error('데이터를 불러오는데 실패했습니다.');

            const data = await response.json();

            if (data.roster) setRoster(data.roster);
            if (data.seats) setSeats(data.seats);
            // 서버에서 전달된 그리드 크기 반영
            if (data.gridRows) setGridRows(data.gridRows);
            if (data.gridCols) setGridCols(data.gridCols);
            // 내 포딩 거래 목록 (pending)
            if (data.pendingTrades) setPendingTrades(data.pendingTrades);

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 자리 구매/인수 처리
    const handlePurchase = async (seat: any) => {
        if (!roster) return;
        if (!seat) return;

        // 잠긴 자리는 구매 불가
        if (seat.is_locked) {
            alert('이 자리는 구매할 수 없습니다.');
            return;
        }

        // 이미 본인 자리인 경우
        if (seat.student_id === roster.id) {
            alert('이미 본인의 자리입니다.');
            return;
        }

        if (roster.balance < seat.price) {
            alert('잔액이 부족합니다.');
            return;
        }

        const isOccupied = !!seat.student_id;
        const confirmMsg = isOccupied
            ? `${seat.price.toLocaleString()}원에 이 자리를 인수하시겠습니까?\n(원주인에게 85% 지급, 15%는 세금)\n* 승인 음 승인대기로 인수 접수, 금액은 즐리 차감됩니다.`
            : `${seat.price.toLocaleString()}원에 이 자리를 구매하시겠습니까?\n* 승인 음 승인대기로 구매 접수, 금액은 즐리 차감됩니다.`;

        if (!confirm(confirmMsg)) return;

        setSubmitting(true);
        try {
            const sessionStr = localStorage.getItem('student_session');
            let studentId = '';
            if (sessionStr) {
                try {
                    const session = JSON.parse(sessionStr);
                    studentId = session.student?.id || '';
                } catch (e) { }
            }

            const response = await fetch('/api/student/real-estate/buy', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-student-id': studentId
                },
                body: JSON.stringify({ seatId: seat.id })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '구매 중 오류가 발생했습니다.');
            }

            // pending 상태 처리 (즉시 구매 비허용)
            if (result.pending) {
                alert('📋 구매 요청이 접수되었습니다.\n선생님의 승인을 기다려주세요.');
            } else {
                alert('✅ 구매가 완료되었습니다!');
            }
            fetchData();
        } catch (e: any) {
            console.error(e);
            alert('오류 발생: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    // 내가 소유한 모든 자리 (복수 소유 가능)
    const mySeats = seats.filter((s: any) => s.student_id === roster?.id);
    // 마지막으로 구매한 자리 = 현재 내 자리 (updated_at 기준, 없으면 created_at)
    const currentSeat = mySeats.length > 0
        ? mySeats.reduce((latest: any, s: any) => {
            const latestTime = new Date(latest.updated_at || latest.created_at || 0).getTime();
            const sTime = new Date(s.updated_at || s.created_at || 0).getTime();
            return sTime > latestTime ? s : latest;
        })
        : null;

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/student"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <MapPin className="w-8 h-8 text-amber-500" />
                    교실 부동산 시장
                </h1>
                <button
                    onClick={fetchData}
                    className="ml-auto p-2 text-slate-400 hover:text-blue-600 transition-colors"
                    disabled={loading}
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* My Info Card */}
            <div className="glass-panel p-6 mb-8 border-l-4 border-l-blue-500 bg-blue-50/30 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                        <div className="text-sm text-slate-500">내 자산</div>
                        <div className="text-xl font-bold text-slate-800">{roster?.balance?.toLocaleString()}원</div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <div className="text-sm text-slate-500">현재 내 자리</div>
                        <div className="text-lg font-bold text-blue-700">
                            {currentSeat ? `${currentSeat.row_idx + 1}행 ${currentSeat.col_idx + 1}열` : '미배정'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Blackboard Area */}
            <div className="mb-10 text-center">
                <div className="inline-block px-12 py-3 bg-slate-800 text-white rounded-lg shadow-xl font-bold text-lg mb-4 border-4 border-slate-700">
                    칠 판 (BOARD)
                </div>
                <div className="flex justify-center flex-wrap gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border rounded"></div> 인수가능</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 border rounded"></div> 내 자리</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400 border rounded"></div> 판매중</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-200 border rounded"></div> 인수불가</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-100 border border-dashed rounded"></div> 구매 불가</span>
                </div>
            </div>

            {/* Seat Grid - 동적 크기 */}
            <div className="overflow-x-auto pb-4">
                <div className="grid gap-3 mx-auto w-fit" style={{ gridTemplateColumns: `repeat(${gridCols}, minmax(100px, 1fr))` }}>
                    {Array.from({ length: gridRows }).map((_, r) => (
                        Array.from({ length: gridCols }).map((_, c) => {
                            const seat = seats.find((s: any) => s.row_idx === r && s.col_idx === c);

                            // 내가 pending 요청한 자리인지 확인
                            const myPendingTrade = pendingTrades.find((t: any) => t.seat_id === seat?.id);

                            // 상태 분류
                            const isLocked = seat?.is_locked; // 교사가 잠근 자리
                            const isNoSeat = !seat; // seat 데이터 자체가 없는 빈 셀
                            const isMyCurrent = currentSeat && seat?.id === currentSeat.id; // 마지막 구매 = 현재 내 자리
                            const isMyOther = seat?.student_id != null && seat.student_id === roster?.id && !isMyCurrent; // 내 다른 보유 자리 = 판매중
                            const isOccupied = seat?.student_id && seat?.student_id !== roster?.id; // 다른 학생 자리
                            const canAfford = roster && seat && roster.balance >= seat.price; // 구매 가능 여부
                            const isEmpty = seat && !seat.student_id; // 비어있는 구매 가능 자리

                            // 클릭 가능 여부 (pending 중 인 자리는 다시 클릭 불가)
                            const isClickable = !isNoSeat && !isLocked && !isMyCurrent && !isMyOther && canAfford && !myPendingTrade;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={`
                                        aspect-square rounded-xl border-2 p-3 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden
                                        ${isMyCurrent ? 'bg-blue-500 border-blue-600 text-white shadow-lg z-10 scale-105' :
                                            myPendingTrade ? 'bg-yellow-100 border-yellow-400 cursor-not-allowed' :
                                                isMyOther ? 'bg-emerald-100 border-emerald-400 shadow-sm' :
                                                    isLocked || isNoSeat ? 'bg-slate-50 border-slate-100 border-dashed opacity-50 cursor-not-allowed' :
                                                        !canAfford && (isOccupied || isEmpty) ? 'bg-red-50 border-red-200 cursor-not-allowed' :
                                                            isOccupied ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 cursor-pointer' :
                                                                'bg-white border-slate-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer shadow-sm hover:shadow-md'
                                        }
                                    `}
                                    onClick={() => isClickable && handlePurchase(seat)}
                                >
                                    <div className={`text-[10px] absolute top-1 left-2 font-bold ${isMyCurrent ? 'text-blue-100' : isMyOther ? 'text-emerald-500' : 'text-slate-400'}`}>
                                        {r + 1}-{c + 1}
                                    </div>

                                    {isMyCurrent ? (
                                        <div className="font-bold text-sm">내 자리</div>
                                    ) : myPendingTrade ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-lg">⏳</span>
                                            <div className="text-yellow-700 text-xs font-bold">승인대기중</div>
                                            <div className="text-[10px] text-yellow-600 font-bold">
                                                {myPendingTrade.price?.toLocaleString()}원
                                            </div>
                                        </div>
                                    ) : isMyOther ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-lg">🏷️</span>
                                            <div className="text-emerald-700 text-xs font-bold">판매중</div>
                                            <div className="text-[10px] text-emerald-500 font-bold">
                                                {seat.price?.toLocaleString()}원
                                            </div>
                                        </div>
                                    ) : isLocked || isNoSeat ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <Lock className="w-4 h-4 text-slate-300" />
                                            <div className="text-slate-300 text-[10px]">구매 불가</div>
                                        </div>
                                    ) : (
                                        <>
                                            {isOccupied && (
                                                <div className="text-xs text-indigo-600 font-bold mb-1">
                                                    {seat.student?.name}
                                                </div>
                                            )}
                                            {seat ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`text-xs font-bold flex items-center gap-0.5 ${!canAfford ? 'text-red-400' :
                                                        isOccupied ? 'text-indigo-500' : 'text-amber-600'
                                                        }`}>
                                                        <DollarSign className="w-3 h-3" />
                                                        {seat.price?.toLocaleString()}
                                                    </div>
                                                    {canAfford ? (
                                                        <div className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isOccupied
                                                            ? 'bg-indigo-100 text-indigo-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                            }`}>
                                                            인수가능
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">
                                                            인수불가
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-slate-300 text-xs italic">비어있음</div>
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })
                    ))}
                </div>
            </div>

            <div className="mt-8 p-4 bg-slate-50 rounded-xl border text-sm text-slate-500">
                <p className="font-bold mb-2">💡 자리 구매 안내</p>
                <ul className="list-disc ml-5 space-y-1">
                    <li>원하는 빈 자리를 클릭하여 구매할 수 있습니다.</li>
                    <li>
                        <span className="font-bold text-indigo-600">적대적 인수:</span> 이미 다른 친구가 구매한 자리도 더 비싼 가격에 인수할 수 있습니다.
                    </li>
                    <li>인수 시 원래 주인에게 구매 금액의 85%가 지급되며, 15%는 세금으로 차감됩니다.</li>
                    <li>자리를 뺏긴 친구는 자동으로 자리를 잃게 되며, 자리 가격은 10% 상승합니다.</li>
                    <li><span className="font-bold text-red-500">인수불가:</span> 잔액이 부족한 자리는 빨간색으로 표시됩니다.</li>
                    <li><span className="font-bold text-emerald-600">판매중:</span> 여러 자리를 소유한 경우, 마지막 구매 자리만 '내 자리'이고 나머지는 판매중입니다.</li>
                </ul>
            </div>
        </div>
    );
}
