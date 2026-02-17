
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Home, MapPin, DollarSign, ArrowLeft, RefreshCw, ShoppingCart, User } from 'lucide-react';
import Link from 'next/link';

export default function StudentRealEstate() {
    const [seats, setSeats] = useState<any[]>([]);
    const [roster, setRoster] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const supabase = createClient();

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 1. Get student roster info
            const classId = user.user_metadata.class_id;
            const { data: rosterData } = await supabase
                .from('student_roster')
                .select('*')
                .eq('profile_id', user.id)
                .single();

            if (rosterData) setRoster(rosterData);

            // 2. Get seats for this class
            const { data: seatsData } = await supabase
                .from('seats')
                .select('*, student:student_id(name, number)')
                .eq('class_id', classId);

            if (seatsData) setSeats(seatsData);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePurchase = async (seat: any) => {
        if (!roster) return;
        if (seat.student_id) return; // Already occupied

        if (roster.balance < seat.price) {
            alert('잔액이 부족합니다.');
            return;
        }

        if (!confirm(`${seat.price.toLocaleString()}원에 이 자리를 구매하시겠습니까?`)) return;

        setSubmitting(true);
        try {
            // 1. Check if class has auto-purchase enabled
            const { data: classData } = await supabase.from('classes').select('is_auto_real_estate').eq('id', roster.class_id).single();

            if (classData?.is_auto_real_estate) {
                // Direct purchase (Immediate)
                // In a real app, use an RPC or transaction

                // Update balance
                const { error: balError } = await supabase.from('student_roster')
                    .update({ currency: roster.currency - seat.price })
                    .eq('id', roster.id);
                if (balError) throw balError;

                // Calculate new price (5% increase, minimum 5% higher than current price)
                const newPrice = Math.ceil(seat.price * 1.05);

                // Update seat with new owner and increased price
                const { error: seatError } = await supabase.from('seats')
                    .update({
                        student_id: roster.id,
                        price: newPrice
                    })
                    .eq('id', seat.id);
                if (seatError) throw seatError;

                // Record transaction
                await supabase.from('transactions').insert({
                    student_id: roster.id,
                    amount: seat.price,
                    type: 'real_estate_purchase',
                    description: `자리 구매 (${seat.row_idx + 1}-${seat.col_idx + 1})`
                });

                alert('구매가 완료되었습니다!');
            } else {
                // Trade Request (Requires Approval)
                const { error: tradeError } = await supabase.from('seat_trades').insert({
                    class_id: roster.class_id,
                    seat_id: seat.id,
                    buyer_id: roster.id,
                    seller_id: null, // Bank purchase
                    price: seat.price,
                    status: 'pending'
                });
                if (tradeError) throw tradeError;
                alert('구매 요청을 보냈습니다. 선생님의 승인을 기다려주세요.');
            }
            fetchData();
        } catch (e: any) {
            alert('오류 발생: ' + e.message);
        } finally {
            setSubmitting(false);
        }
    };

    const mySeat = seats.find(s => s.student_id === roster?.id);

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
                            {mySeat ? `${mySeat.row_idx + 1}행 ${mySeat.col_idx + 1}열` : '미배정'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Blackboard Area */}
            <div className="mb-10 text-center">
                <div className="inline-block px-12 py-3 bg-slate-800 text-white rounded-lg shadow-xl font-bold text-lg mb-4 border-4 border-slate-700">
                    칠 판 (BOARD)
                </div>
                <div className="flex justify-center gap-4 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-white border rounded"></div> 구매 가능</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-blue-500 border rounded"></div> 내 자리</span>
                    <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 border rounded"></div> 다른 학생</span>
                </div>
            </div>

            {/* Seat Grid */}
            <div className="overflow-x-auto pb-4">
                <div className="grid gap-3 mx-auto w-fit" style={{ gridTemplateColumns: `repeat(6, minmax(100px, 1fr))` }}>
                    {Array.from({ length: 5 }).map((_, r) => (
                        Array.from({ length: 6 }).map((_, c) => {
                            const seat = seats.find(s => s.row_idx === r && s.col_idx === c);
                            const isMine = seat?.student_id === roster?.id;
                            const isOccupied = seat?.student_id && !isMine;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    className={`
                                        aspect-square rounded-xl border-2 p-3 flex flex-col items-center justify-center text-center transition-all relative overflow-hidden
                                        ${isMine ? 'bg-blue-500 border-blue-600 text-white shadow-lg z-10 scale-105' :
                                            isOccupied ? 'bg-slate-100 border-slate-200 opacity-60' :
                                                'bg-white border-slate-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer shadow-sm hover:shadow-md'
                                        }
                                    `}
                                    onClick={() => !isOccupied && !isMine && handlePurchase(seat)}
                                >
                                    <div className={`text-[10px] absolute top-1 left-2 font-bold ${isMine ? 'text-blue-100' : 'text-slate-300'}`}>
                                        {r + 1}-{c + 1}
                                    </div>

                                    {isMine ? (
                                        <div className="font-bold text-sm">내 자리</div>
                                    ) : isOccupied ? (
                                        <div className="text-xs text-slate-500 font-medium">
                                            {seat.student?.name}
                                        </div>
                                    ) : seat ? (
                                        <div className="flex flex-col items-center gap-1">
                                            <div className="text-xs font-bold text-amber-600 flex items-center gap-0.5">
                                                <DollarSign className="w-3 h-3" />
                                                {seat.price?.toLocaleString()}
                                            </div>
                                            <div className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                                구매가능
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-slate-300 text-xs italic">비어있음</div>
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
                    <li>자리 구매 시 현재 잔액에서 가격만큼 차감됩니다.</li>
                    <li>선생님 설정에 따라 즉시 구매되거나, 승인이 필요할 수 있습니다.</li>
                    <li>한 번 구매한 자리는 다른 사람이 구매할 수 없습니다.</li>
                </ul>
            </div>
        </div>
    );
}
