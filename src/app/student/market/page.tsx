'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ShoppingBag, Loader2, DollarSign, Package, AlertCircle } from 'lucide-react';

export default function StudentMarket() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [inventory, setInventory] = useState<any[]>([]);
    const [balance, setBalance] = useState<number>(0);
    const [buying, setBuying] = useState<string | null>(null);
    const [tab, setTab] = useState<'market' | 'inventory'>('market');

    const supabase = createClient();

    useEffect(() => {
        fetchMarketData();
    }, []);

    const fetchMarketData = async () => {
        try {
            // 1. Fetch Market Items
            const res = await fetch('/api/student/market');
            const data = await res.json();
            if (data.items) setItems(data.items);

            // 2. Fetch User Inventory (Client-side via RLS, assuming simple policy or user match)
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // We need student_roster_id to filter inventory if RLS allows all.
                // But RLS 'true' returns all. We should filter by user's roster id.
                // How to get roster id client side?
                // We can query student_roster by user metadata if available.
                // Or just rely on API to return inventory.
                // Let's use API for inventory to be safe/clean.
                // Wait, I didn't implement GET inventory in API.
                // I'll fetch it here via a new API call or just filter in client if RLS returns all (not ideal but works for prototype).
                // Better: Fetch from my new API endpoint. I'll add GET inventory support later or just use client query if I can resolve roster ID.
                // Actually, let's just use the API I made for items.

                // Let's update balance display
                // We can get balance from student_roster.
                // I'll fetch roster via API or client.
                const { data: roster } = await supabase.from('student_roster').select('balance, id').eq('id', user.user_metadata?.roster_id).single();
                if (roster) {
                    setBalance(roster.balance || 0);

                    // Now fetch inventory for this student
                    const { data: inv } = await supabase
                        .from('student_inventory')
                        .select('*, market_items(name, image_url, description)')
                        .eq('student_id', roster.id);
                    if (inv) setInventory(inv);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleBuy = async (item: any) => {
        if (balance < item.price) return alert('잔액이 부족합니다.');
        if (item.stock !== -1 && item.stock < 1) return alert('재고가 없습니다.');

        if (!confirm(`${item.name}을(를) ${item.price.toLocaleString()}원에 구매하시겠습니까?`)) return;

        setBuying(item.id);
        try {
            const res = await fetch('/api/student/market', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: item.id, quantity: 1 })
            });
            const data = await res.json();

            if (data.error) throw new Error(data.error);

            alert('구매 완료!');
            setBalance(data.balance); // Update local balance
            fetchMarketData(); // Refresh list/inventory
        } catch (e: any) {
            alert(e.message);
        } finally {
            setBuying(null);
        }
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-purple-600" />
                        학급 마켓
                    </h1>
                    <p className="text-slate-500 text-sm">필요한 물건이나 쿠폰을 구매하세요.</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2">
                    <span className="text-sm text-slate-500">내 지갑</span>
                    <span className="font-bold text-lg text-emerald-600">{balance.toLocaleString()}원</span>
                </div>
            </div>

            <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setTab('market')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'market' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    상품 목록
                </button>
                <button
                    onClick={() => setTab('inventory')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'inventory' ? 'border-purple-600 text-purple-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    내 보관함 ({inventory.length})
                </button>
            </div>

            {tab === 'market' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item) => (
                        <div key={item.id} className="card bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                            {item.image_url && (
                                <div className="h-40 bg-slate-100 relative">
                                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                                </div>
                            )}
                            <div className="p-5 flex flex-col flex-1">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-lg">{item.name}</h3>
                                    <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">
                                        {item.price.toLocaleString()}원
                                    </span>
                                </div>
                                <p className="text-sm text-slate-500 mb-4 flex-1">{item.description || '설명 없음'}</p>
                                <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-50">
                                    <span className={`text-xs font-medium ${item.stock === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                        {item.stock === -1 ? '무제한' : `남은 수량: ${item.stock}개`}
                                    </span>
                                    <button
                                        onClick={() => handleBuy(item)}
                                        disabled={buying === item.id || item.stock === 0 || balance < item.price}
                                        className="btn-primary py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {buying === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : '구매하기'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                            판매 중인 상품이 없습니다.
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    {inventory.map((inv) => (
                        <div key={inv.id} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                                    <Package className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold">{inv.market_items?.name || '알 수 없는 상품'}</h3>
                                    <p className="text-xs text-slate-500">{inv.market_items?.description}</p>
                                    <p className="text-xs text-slate-400 mt-1">구매일: {new Date(inv.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-lg text-purple-700">x{inv.quantity}</span>
                                {inv.is_used ? (
                                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">사용됨</span>
                                ) : (
                                    <button className="text-xs text-blue-600 hover:underline mt-1">사용하기</button>
                                )}
                            </div>
                        </div>
                    ))}
                    {inventory.length === 0 && (
                        <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                            구매한 상품이 없습니다.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
