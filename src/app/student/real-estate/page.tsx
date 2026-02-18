
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

        // Prevent buying own seat
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
            ? `${seat.price.toLocaleString()}원에 이 자리를 인수하시겠습니까?\n(원주인에게 85% 지급, 15%는 세금)`
            : `${seat.price.toLocaleString()}원에 이 자리를 구매하시겠습니까?`;

        if (!confirm(confirmMsg)) return;

        setSubmitting(true);
        try {
            // 1. Deduct from buyer
            const { error: buyerError } = await supabase.from('student_roster')
                .update({ balance: roster.balance - seat.price })
                .eq('id', roster.id);
            if (buyerError) throw buyerError;

            // 2. Pay seller if occupied
            if (isOccupied) {
                // Fetch seller's current balance to update correctly
                const { data: seller } = await supabase.from('student_roster').select('*').eq('id', seat.student_id).single();

                if (seller) {
                    const payout = Math.floor(seat.price * 0.85);

                    await supabase.from('student_roster')
                        .update({ balance: seller.balance + payout })
                        .eq('id', seat.student_id);

                    // Log for seller
                    await supabase.from('transactions').insert({
                        student_id: seat.student_id,
                        amount: payout,
                        type: 'real_estate_income',
                        description: `자리 판매 수익 (${seat.row_idx + 1}-${seat.col_idx + 1})`
                    });

                    // Log Tax (Implicitly deducted, but good to verify calculation or log system record?)
                    // The user requested: "15% tax deducted... verify reflection".
                    // Since it's omitted from payout, it's effectively burned. 
                    // To show it in "System Logs" or just to be explicit, we can log it as a 'tax' type transaction for the SELLER (negative?) or just leave it?
                    // "15% is tax".
                    // Let's log it for the seller as a 'tax' deduction to explain the gap? 
                    // Or maybe better: Seller receives Full Price, then pays Tax? 
                    // Current logic: Seller receives 85%. 
                    // If we want to be explicit:
                    // Seller receives +Price. Seller pays -15% Tax.
                    // Let's stick to current logic (Seller gets Net) but maybe log the tax as a system record?
                    // Actually, let's just Log a 'tax' record for the Seller with 0 amount or just description?
                    // Wait, usually 'tax' is money leaving the system. 
                    // If we want to show it to the teacher/system, maybe insert a transaction for the seller with 0 amount but description "Tax deducted"?
                    // Or change logic: 
                    // 1. Seller +Price
                    // 2. Seller -15% Tax
                    // This is clearer for logs.
                    // But I will stick to the requester's implicit "deducted".
                    // However, to satisfy "make sure it's reflected", good logs help.
                    // Let's change logic to:
                    // Payout = Price. 
                    // Tax = Price * 0.15.
                    // Net = Price * 0.85.
                    // Update Seller Balance += Net. (Same as before)
                    // Log: "Sold for [Price]. Tax [Tax] deducted. Net [Net]."
                    await supabase.from('transactions').insert({
                        student_id: seat.student_id,
                        amount: -(seat.price - payout), // The tax amount (negative? No, it's never received). 
                        // Actually, let's just log it as a separate info if needed. 
                        // Providing a 'tax' type transaction on the SELLER with negative amount is weird if they didn't receive the full amount first.
                        // But let's add a log for the BUYER? No.
                        // Let's just update the description for the seller.
                    });
                     */
                }
            }

            // 3. Update Seat (New Owner, Price Increase)
            // Increase price by 10% + 100 won padding
            const nextPrice = Math.floor(seat.price * 1.1) + 100;

            const { error: seatError } = await supabase.from('seats')
                .update({
                    student_id: roster.id,
                    price: nextPrice
                })
                .eq('id', seat.id);
            if (seatError) throw seatError;

            // 4. Log for buyer
            await supabase.from('transactions').insert({
                student_id: roster.id,
                amount: -seat.price,
                type: 'real_estate_purchase',
                description: `자리 구매 (${seat.row_idx + 1}-${seat.col_idx + 1})`
            });

            alert('구매가 완료되었습니다!');
            fetchData();
        } catch (e: any) {
            console.error(e);
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
                                            isOccupied ? 'bg-indigo-50 border-indigo-200 hover:border-indigo-400 cursor-pointer' : // Changed style for occupied
                                                'bg-white border-slate-100 hover:border-amber-300 hover:bg-amber-50 cursor-pointer shadow-sm hover:shadow-md'
                                        }
                                    `}
                                    onClick={() => !isMine && handlePurchase(seat)}
                                >
                                    <div className={`text-[10px] absolute top-1 left-2 font-bold ${isMine ? 'text-blue-100' : 'text-slate-400'}`}>
                                        {r + 1}-{c + 1}
                                    </div>

                                    {isMine ? (
                                        <div className="font-bold text-sm">내 자리</div>
                                    ) : (
                                        <>
                                            {isOccupied && (
                                                <div className="text-xs text-indigo-600 font-bold mb-1">
                                                    {seat.student?.name}
                                                </div>
                                            )}
                                            {seat ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`text-xs font-bold flex items-center gap-0.5 ${isOccupied ? 'text-indigo-500' : 'text-amber-600'}`}>
                                                        <DollarSign className="w-3 h-3" />
                                                        {seat.price?.toLocaleString()}
                                                    </div>
                                                    {!isOccupied && (
                                                        <div className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                                                            구매가능
                                                        </div>
                                                    )}
                                                    {isOccupied && (
                                                        <div className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                                            인수기능
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
                    <li>자리 구매 시 현재 잔액에서 가격만큼 차감됩니다.</li>
                    <li>선생님 설정에 따라 즉시 구매되거나, 승인이 필요할 수 있습니다.</li>
                    <li>한 번 구매한 자리는 다른 사람이 구매할 수 없습니다.</li>
                </ul>
            </div>
        </div>
    );
}
