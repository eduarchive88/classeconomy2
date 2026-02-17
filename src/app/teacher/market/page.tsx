'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ShoppingBag, Plus, Save, Trash2, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function MarketManagement() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: 0, stock: 1, description: '' });
    const supabase = createClient();

    useEffect(() => {
        fetchItems();
    }, []);

    const fetchItems = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        const { data, error } = await supabase
            .from('market_items')
            .select('*')
            .eq('class_id', selectedClassId)
            .order('created_at', { ascending: false });

        if (data) setItems(data);
    };

    const handleAddItem = async () => {
        if (!newItem.name || newItem.price <= 0) return alert('상품명과 가격을 올바르게 입력해주세요.');

        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return alert('반을 선택해주세요.');

        setLoading(true);
        try {
            const { error } = await supabase
                .from('market_items')
                .insert({
                    ...newItem,
                    class_id: selectedClassId
                });

            if (error) throw error;

            setNewItem({ name: '', price: 0, stock: 1, description: '' });
            fetchItems();
            alert('상품이 등록되었습니다.');
        } catch (e: any) {
            alert('등록 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;

        const { error } = await supabase
            .from('market_items')
            .delete()
            .eq('id', id);

        if (error) {
            alert('삭제 실패: ' + error.message);
        } else {
            fetchItems();
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
                    <ShoppingBag className="w-8 h-8 text-purple-600" />
                    학급 마켓 관리
                </h1>
                <div className="ml-auto">
                    <ClassSelector onClassChange={fetchItems} />
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                {/* Add Item Form */}
                <div className="glass-panel p-6 h-fit">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-blue-600" />
                        새 상품 등록
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">상품명</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded-lg"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder="예: 숙제 면제권"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium mb-1">가격</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg"
                                    value={newItem.price}
                                    onChange={e => setNewItem({ ...newItem, price: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">재고</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg"
                                    value={newItem.stock}
                                    onChange={e => setNewItem({ ...newItem, stock: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">설명 (선택)</label>
                            <textarea
                                className="w-full p-2 border rounded-lg h-20"
                                value={newItem.description}
                                onChange={e => setNewItem({ ...newItem, description: e.target.value })}
                                placeholder="상품에 대한 설명..."
                            />
                        </div>
                        <button
                            onClick={handleAddItem}
                            disabled={loading}
                            className="btn-primary w-full flex justify-center items-center gap-2 bg-purple-600 hover:bg-purple-700"
                        >
                            <Save className="w-4 h-4" />
                            {loading ? '등록 중...' : '상품 등록'}
                        </button>
                    </div>
                </div>

                {/* Item List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold mb-4">판매 중인 상품 ({items.length}개)</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {items.map((item) => (
                            <div key={item.id} className="p-4 border rounded-xl bg-white shadow-sm hover:shadow-md transition flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-slate-800">{item.name}</h3>
                                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm font-bold">
                                            {item.price.toLocaleString()}원
                                        </span>
                                    </div>
                                    <p className="text-slate-500 text-sm mb-4 min-h-[40px]">{item.description || '셜명 없음'}</p>
                                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                                        <span className={`px-2 py-0.5 rounded ${item.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.stock > 0 ? `재고: ${item.stock}개` : '품절'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex justify-end pt-4 border-t">
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="text-slate-400 hover:text-red-600 transition-colors p-2"
                                        title="삭제"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="col-span-2 text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed">
                                등록된 상품이 없습니다. 상품을 등록해보세요.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
