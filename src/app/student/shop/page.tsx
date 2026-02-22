'use client';
import { useState, useEffect } from 'react';
import { ShoppingBag, ArrowLeft, Loader2, DollarSign } from 'lucide-react';
import Link from 'next/link';

export default function StudentShop() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [roster, setRoster] = useState<any>(null);
    const [purchasing, setPurchasing] = useState<string | null>(null);

    useEffect(() => {
        fetchShopData();
    }, []);

    const fetchShopData = async () => {
        try {
            const sessionStr = localStorage.getItem('student_session');
            if (!sessionStr) return;
            const session = JSON.parse(sessionStr);
            const studentId = session.student?.id;

            if (studentId) {
                const res = await fetch(`/api/student/shop?studentId=${studentId}`);
                if (res.ok) {
                    const data = await res.json();
                    setRoster(data.roster);
                    setItems(data.items || []);
                } else {
                    console.error('Failed to fetch shop data');
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (item: any) => {
        if (!roster) return;
        if (roster.balance < item.price) {
            alert('잔액이 부족합니다.');
            return;
        }
        if (!confirm(`${item.name}을(를) ${item.price.toLocaleString()}원에 구매하시겠습니까?`)) return;

        setPurchasing(item.id);
        try {
            const sessionStr = localStorage.getItem('student_session');
            const session = sessionStr ? JSON.parse(sessionStr) : null;
            const studentId = session?.student?.id;

            if (!studentId) throw new Error('학생 정보를 찾을 수 없습니다.');

            const res = await fetch('/api/student/shop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId,
                    itemId: item.id
                })
            });

            const json = await res.json();
            if (res.ok) {
                alert('구매가 완료되었습니다!');
                fetchShopData(); // Refresh data
            } else {
                throw new Error(json.error || '구매 실패');
            }
        } catch (e: any) {
            alert('구매 실패: ' + e.message);
        } finally {
            setPurchasing(null);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-8">
                <Link
                    href="/student"
                    className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-slate-600" />
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="w-8 h-8 text-purple-500" />
                    상점
                </h1>
                <div className="ml-auto bg-slate-100 px-4 py-2 rounded-lg font-bold text-slate-700">
                    내 잔액: {roster?.balance.toLocaleString()} 원
                </div>
            </div>

            {items.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-500">현재 판매 중인 상품이 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">
                        (선생님이 상품을 등록했는지, 재고가 있는지 확인해주세요)
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <div key={item.id} className="card bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-slate-100">
                            <div>
                                <h3 className="font-bold text-lg text-slate-800 mb-2">{item.name}</h3>
                                <p className="text-sm text-slate-500 mb-4 min-h-[40px]">{item.description || '설명 없음'}</p>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold text-lg text-purple-600">
                                        {item.price.toLocaleString()} 원
                                    </span>
                                    <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500">
                                        재고: {item.stock}
                                    </span>
                                </div>
                                <button
                                    onClick={() => handleBuy(item)}
                                    disabled={purchasing === item.id || roster.balance < item.price}
                                    className="w-full btn-primary bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed py-2 rounded-lg font-bold flex justify-center items-center gap-2"
                                >
                                    {purchasing === item.id ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <ShoppingBag className="w-4 h-4" />
                                            구매하기
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
