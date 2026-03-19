'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ShoppingBag, Plus, Save, Trash2, ArrowLeft, Edit2, Check, X, Copy } from 'lucide-react';
import Link from 'next/link';
import ClassSelector from '@/components/teacher/ClassSelector';

export default function MarketManagement() {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [newItem, setNewItem] = useState({ name: '', price: 0, stock: 1, description: '' });
    // 인라인 편집 상태
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValues, setEditValues] = useState({ price: 0, stock: 0, description: '' });
    // 다른 학급에서 복사 상태
    const [showCopyModal, setShowCopyModal] = useState(false);
    const [otherClasses, setOtherClasses] = useState<any[]>([]);
    const [copyLoading, setCopyLoading] = useState(false);
    const supabase = createClient();

    useEffect(() => {
        fetchItems();
    }, []);

    // 상품 목록 불러오기
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

    // 새 상품 추가
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

    // 상품 수정 (인라인)
    const handleEditItem = async (id: string) => {
        setLoading(true);
        try {
            const { error } = await supabase
                .from('market_items')
                .update({
                    price: editValues.price,
                    stock: editValues.stock,
                    description: editValues.description
                })
                .eq('id', id);

            if (error) throw error;

            setEditingId(null);
            fetchItems();
        } catch (e: any) {
            alert('수정 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    // 상품 삭제
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

    // 편집 모드 진입
    const startEdit = (item: any) => {
        setEditingId(item.id);
        setEditValues({ price: item.price, stock: item.stock, description: item.description || '' });
    };

    // 다른 학급 목록 불러오기 (복사용)
    const openCopyModal = async () => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return alert('반을 먼저 선택해주세요.');

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // 교사의 모든 학급 조회 (현재 선택한 학급 제외)
        const { data: classes } = await supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', user.id)
            .neq('id', selectedClassId)
            .order('name', { ascending: true });

        if (!classes || classes.length === 0) {
            return alert('복사할 수 있는 다른 학급이 없습니다.');
        }

        setOtherClasses(classes);
        setShowCopyModal(true);
    };

    // 선택한 학급의 상품을 현재 학급으로 복사
    const handleCopyFromClass = async (sourceClassId: string, sourceClassName: string) => {
        const selectedClassId = localStorage.getItem('selected_class_id');
        if (!selectedClassId) return;

        if (!confirm(`"${sourceClassName}"의 상품 메뉴를 현재 학급으로 복사하시겠습니까?\n(기존 상품은 그대로 유지되고, 새로 추가됩니다.)`)) return;

        setCopyLoading(true);
        try {
            // 1. 원본 학급의 상품 조회
            const { data: sourceItems, error: fetchError } = await supabase
                .from('market_items')
                .select('name, price, stock, description')
                .eq('class_id', sourceClassId);

            if (fetchError) throw fetchError;
            if (!sourceItems || sourceItems.length === 0) {
                alert('해당 학급에 등록된 상품이 없습니다.');
                return;
            }

            // 2. 현재 학급으로 복사 (class_id만 변경)
            const newItems = sourceItems.map(item => ({
                name: item.name,
                price: item.price,
                stock: item.stock,
                description: item.description,
                class_id: selectedClassId
            }));

            const { error: insertError } = await supabase
                .from('market_items')
                .insert(newItems);

            if (insertError) throw insertError;

            alert(`${sourceItems.length}개의 상품이 성공적으로 복사되었습니다!`);
            setShowCopyModal(false);
            fetchItems();
        } catch (e: any) {
            alert('복사 실패: ' + e.message);
        } finally {
            setCopyLoading(false);
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
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={openCopyModal}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                        title="다른 학급에서 상품 복사"
                    >
                        <Copy className="w-4 h-4" />
                        다른 학급에서 복사
                    </button>
                    <ClassSelector onClassChange={fetchItems} />
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                {/* 새 상품 등록 폼 */}
                <div className="glass-panel p-6 h-fit">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-slate-800 dark:text-white">
                        <Plus className="w-5 h-5 text-blue-600" />
                        새 상품 등록
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">상품명</label>
                            <input
                                type="text"
                                className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                value={newItem.name}
                                onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                placeholder="예: 숙제 면제권"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">가격</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    value={newItem.price}
                                    onChange={e => setNewItem({ ...newItem, price: parseInt(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">재고</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border rounded-lg bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    value={newItem.stock}
                                    onChange={e => setNewItem({ ...newItem, stock: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">설명 (선택)</label>
                            <textarea
                                className="w-full p-2 border rounded-lg h-20 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-white"
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

                {/* 상품 목록 */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">판매 중인 상품 ({items.length}개)</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {items.map((item) => (
                            <div key={item.id} className="p-4 border rounded-xl bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm hover:shadow-md transition flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white">{item.name}</h3>
                                        {editingId === item.id ? (
                                            <input
                                                type="number"
                                                value={editValues.price}
                                                onChange={e => setEditValues({ ...editValues, price: Number(e.target.value) })}
                                                className="w-24 p-1 border rounded text-sm text-right bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                autoFocus
                                            />
                                        ) : (
                                            <span className="bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded text-sm font-bold">
                                                {item.price.toLocaleString()}원
                                            </span>
                                        )}
                                    </div>
                                    {editingId === item.id ? (
                                        <textarea
                                            value={editValues.description}
                                            onChange={e => setEditValues({ ...editValues, description: e.target.value })}
                                            className="w-full p-1 border rounded text-sm mb-2 bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                            rows={2}
                                        />
                                    ) : (
                                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 min-h-[40px]">{item.description || '설명 없음'}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-4">
                                        {editingId === item.id ? (
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-600 dark:text-slate-300">재고:</span>
                                                <input
                                                    type="number"
                                                    value={editValues.stock}
                                                    onChange={e => setEditValues({ ...editValues, stock: Number(e.target.value) })}
                                                    className="w-16 p-1 border rounded text-sm bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                                />
                                            </div>
                                        ) : (
                                            <span className={`px-2 py-0.5 rounded ${item.stock > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>
                                                {item.stock > 0 ? `재고: ${item.stock}개` : '품절'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-end gap-1 pt-4 border-t dark:border-slate-700">
                                    {editingId === item.id ? (
                                        <>
                                            <button
                                                onClick={() => handleEditItem(item.id)}
                                                className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded transition-colors"
                                                title="저장"
                                            >
                                                <Check className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                                                title="취소"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <button
                                                onClick={() => startEdit(item)}
                                                className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                title="수정"
                                            >
                                                <Edit2 className="w-5 h-5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                        {items.length === 0 && (
                            <div className="col-span-2 text-center py-12 text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed dark:border-slate-700">
                                등록된 상품이 없습니다. 상품을 등록해보세요.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 다른 학급에서 복사 모달 */}
            {showCopyModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <Copy className="w-5 h-5 text-purple-600" />
                                다른 학급에서 상품 복사
                            </h3>
                            <button
                                onClick={() => setShowCopyModal(false)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                            복사할 학급을 선택하면 해당 학급의 모든 상품(이름, 가격, 재고, 설명)이 현재 학급에 추가됩니다.
                        </p>
                        <div className="space-y-2">
                            {otherClasses.map((cls) => (
                                <button
                                    key={cls.id}
                                    onClick={() => handleCopyFromClass(cls.id, cls.name)}
                                    disabled={copyLoading}
                                    className="w-full p-3 text-left border rounded-xl hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-all flex items-center justify-between dark:border-slate-700"
                                >
                                    <span className="font-medium text-slate-800 dark:text-white">{cls.name}</span>
                                    <Copy className="w-4 h-4 text-slate-400" />
                                </button>
                            ))}
                        </div>
                        {copyLoading && (
                            <div className="mt-4 text-center text-sm text-purple-600 dark:text-purple-400 font-medium">
                                복사 중...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
