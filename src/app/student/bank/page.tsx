'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Send, PiggyBank, History, Coins, Lock } from 'lucide-react';
import Link from 'next/link';

export default function StudentBank() {
    const [activeTab, setActiveTab] = useState('overview'); // overview, transfer, savings
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [studentId, setStudentId] = useState<string | null>(null);

    // Transfer State
    const [targetIds, setTargetIds] = useState<string[]>([]);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferLoading, setTransferLoading] = useState(false);

    // Savings State
    const [depositAmount, setDepositAmount] = useState('');
    const [depositLoading, setDepositLoading] = useState(false);
    const [withdrawLoading, setWithdrawLoading] = useState<string | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('student_session');
        if (stored) {
            const parsed = JSON.parse(stored);
            setStudentId(parsed.student.id);
            fetchData(parsed.student.id);
        }
    }, []);

    const fetchData = async (sId: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/student/bank?studentId=${sId}`);
            const json = await res.json();
            if (res.ok) {
                setData(json);
            } else {
                alert(json.error);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferAmount || targetIds.length === 0) return;

        const totalAmount = Number(transferAmount) * targetIds.length;
        if (totalAmount > data.student.balance) {
            return alert(`잔액이 부족합니다. (총 송금액: ${totalAmount.toLocaleString()}원)`);
        }

        setTransferLoading(true);
        try {
            const res = await fetch('/api/student/bank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'transfer',
                    studentId,
                    targetIds,
                    amount: Number(transferAmount)
                })
            });
            const json = await res.json();
            if (res.ok) {
                alert('송금이 완료되었습니다.');
                setTransferAmount('');
                setTargetIds([]);
                fetchData(studentId!); // Refresh
                setActiveTab('overview');
            } else {
                alert(json.error);
            }
        } catch (error) {
            alert('송금 실패');
        } finally {
            setTransferLoading(false);
        }
    };

    const handleDeposit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!depositAmount) return;
        if (Number(depositAmount) > data.student.balance) {
            return alert('잔액이 부족합니다.');
        }

        setDepositLoading(true);
        try {
            const res = await fetch('/api/student/bank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'deposit',
                    studentId,
                    amount: Number(depositAmount)
                })
            });
            const json = await res.json();
            if (res.ok) {
                alert('예금 가입이 완료되었습니다.');
                setDepositAmount('');
                fetchData(studentId!);
                setActiveTab('savings');
            } else {
                alert(json.error);
            }
        } catch (error) {
            alert('예금 실패');
        } finally {
            setDepositLoading(false);
        }
    };

    const handleWithdraw = async (accountId: string) => {
        if (!confirm('정말로 출금하시겠습니까?')) return;

        setWithdrawLoading(accountId);
        try {
            const res = await fetch('/api/student/bank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'withdraw',
                    studentId,
                    accountId
                })
            });
            const json = await res.json();
            if (res.ok) {
                alert('출금이 완료되었습니다.');
                fetchData(studentId!);
            } else {
                alert(json.error);
            }
        } catch (error) {
            alert('출금 실패');
        } finally {
            setWithdrawLoading(null);
        }
    };

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || loading || !data) {
        return <div className="p-8 text-center">Loading...</div>;
    }

    const student = data?.student || { balance: 0 };
    const classmates = data?.classmates || [];
    const accounts = data?.accounts || [];
    const transactions = data?.transactions || [];
    const totalSavings = accounts.reduce((sum: number, acc: any) => sum + acc.amount, 0);

    const sortedClassmates = [...classmates].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));

    return (
        <div className="container mx-auto p-4 max-w-4xl pb-24">
            <div className="flex items-center gap-4 mb-6">
                <Link href="/student" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <h1 className="text-2xl font-bold">은행</h1>
            </div>

            {/* Top Stats Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <Coins className="w-6 h-6 opacity-80" />
                        <span className="font-medium opacity-90">사용 가능 잔액</span>
                    </div>
                    <div className="text-3xl font-bold">
                        {student.balance.toLocaleString()} 원
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-2 text-slate-600 dark:text-slate-400">
                        <PiggyBank className="w-6 h-6" />
                        <span className="font-medium">총 저축액 (이자 제외)</span>
                    </div>
                    <div className="text-3xl font-bold text-slate-800 dark:text-slate-100">
                        {totalSavings.toLocaleString()} 원
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-6 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'overview'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    내역
                </button>
                <button
                    onClick={() => setActiveTab('transfer')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'transfer'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    송금하기
                </button>
                <button
                    onClick={() => setActiveTab('savings')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'savings'
                        ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    저축하기
                </button>
            </div>

            {/* Tab Content */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 min-h-[300px]">

                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="space-y-4">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <History className="w-5 h-5" />
                            최근 거래 내역
                        </h3>
                        {transactions.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">거래 내역이 없습니다.</div>
                        ) : (
                            <div className="space-y-3">
                                {transactions.map((tx: any) => (
                                    <div key={tx.id} className="flex justify-between items-center p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg transition-colors border border-slate-100 dark:border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                                                }`}>
                                                {tx.amount > 0 ? '+' : '-'}
                                            </div>
                                            <div>
                                                <div className="font-medium text-slate-800 dark:text-slate-200">
                                                    {tx.type === 'transfer_sent' ? '송금 보냄' :
                                                        tx.type === 'transfer_received' ? '송금 받음' :
                                                            tx.type === 'deposit' ? '저축 가입' :
                                                                tx.type === 'withdraw' ? '저축 만기 출금' :
                                                                    tx.type === 'allowance' ? '용돈' :
                                                                        tx.type === 'special_allowance' ? '특별 용돈' :
                                                                            tx.type === 'fine' ? '벌금' :
                                                                                tx.type === 'quiz_reward' ? '퀴즈 상금' :
                                                                                    tx.type === 'stock_profit' ? '투자 수익' :
                                                                                        tx.type === 'stock_loss' ? '투자 손실' :
                                                                                            tx.type === 'market_purchase' ? '상품 구입' :
                                                                                                tx.type === 'real_estate_purchase' ? '부동산 구입' :
                                                                                                    tx.type === 'stock_buy' ? '주식 매수' :
                                                                                                        tx.type === 'stock_sell' ? '주식 매도' :
                                                                                                            tx.type === 'investment_buy' ? '주식 매수' :
                                                                                                                tx.type === 'investment_sell' ? '주식 매도' :
                                                                                                                    tx.type === 'real_estate_income' ? '임대/매각 수익' :
                                                                                                                        tx.type === 'real_estate_pending' ? '부동산 구매 승인 대기' :
                                                                                                                            tx.type === 'real_estate_refund' ? '부동산 구매 환불' :
                                                                                                                                tx.type === 'tax' ? '세금' : tx.type}
                                                </div>
                                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                                    {new Date(tx.created_at).toLocaleDateString()} {tx.description && `• ${tx.description}`}
                                                </div>
                                            </div>
                                        </div>
                                        <div className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} 원
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* 2. Transfer Tab */}
                {activeTab === 'transfer' && (
                    <div className="max-w-md mx-auto py-4">
                        <h3 className="font-bold text-lg mb-6 text-center">친구에게 송금하기</h3>
                        <form onSubmit={handleTransfer} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-3 text-slate-600 dark:text-slate-400">받는 친구 선택 (여러 명 동시 선택 가능)</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-1">
                                    {sortedClassmates.map((mate: any) => {
                                        const isSelected = targetIds.includes(mate.id);
                                        return (
                                            <button
                                                key={mate.id}
                                                type="button"
                                                onClick={() => {
                                                    setTargetIds(prev =>
                                                        prev.includes(mate.id) ? prev.filter(id => id !== mate.id) : [...prev, mate.id]
                                                    );
                                                }}
                                                className={`p-3 rounded-xl border text-sm font-bold transition-all ${isSelected
                                                    ? 'bg-blue-500 text-white border-blue-600 shadow-md ring-2 ring-blue-300'
                                                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-700'
                                                    }`}
                                            >
                                                {mate.name}
                                            </button>
                                        );
                                    })}
                                </div>
                                {sortedClassmates.length === 0 && (
                                    <div className="text-center p-4 bg-slate-50 rounded-xl text-slate-500 text-sm">
                                        같은 반 친구가 없습니다.
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">보낼 금액 (1인당)</label>
                                <input
                                    type="number"
                                    value={transferAmount}
                                    onChange={(e) => setTransferAmount(e.target.value)}
                                    className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                    placeholder="금액 입력"
                                    min="1"
                                    required
                                />
                                {targetIds.length > 0 && transferAmount && (
                                    <p className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium">
                                        총 {targetIds.length}명에게 <b>{(Number(transferAmount) * targetIds.length).toLocaleString()} 원</b>을 보냅니다.
                                    </p>
                                )}
                            </div>
                            <button
                                type="submit"
                                disabled={transferLoading}
                                className="w-full btn-primary py-3 rounded-xl font-bold flex justify-center items-center gap-2 mt-4"
                            >
                                {transferLoading ? '송금 중...' : <><Send className="w-5 h-5" /> 보내기</>}
                            </button>
                        </form>
                    </div>
                )}

                {/* 3. Savings Tab */}
                {activeTab === 'savings' && (
                    <div>
                        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2">💰 학생 우대 정기 예금</h4>
                            <p className="text-sm text-blue-700 dark:text-blue-400">
                                지금 가입하면 2주 뒤에 원금 + 1% 이자를 드려요!<br />
                                (중도 해지 불가, 만기 시 자동 지급되지 않으므로 직접 출금해야 합니다)
                            </p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Deposit Form */}
                            <div>
                                <h3 className="font-bold text-lg mb-4">새로 가입하기</h3>
                                <form onSubmit={handleDeposit} className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1 text-slate-600 dark:text-slate-400">저축 금액</label>
                                        <input
                                            type="number"
                                            value={depositAmount}
                                            onChange={(e) => setDepositAmount(e.target.value)}
                                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                                            placeholder="금액 입력"
                                            min="100"
                                            required
                                        />
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        예상 만기일: {new Date(new Date().setDate(new Date().getDate() + 14)).toLocaleDateString()}
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={depositLoading}
                                        className="w-full btn-primary py-3 rounded-xl font-bold flex justify-center items-center gap-2"
                                    >
                                        {depositLoading ? '가입 중...' : <><Lock className="w-5 h-5" /> 가입하기</>}
                                    </button>
                                </form>
                            </div>

                            {/* My Accounts List */}
                            <div>
                                <h3 className="font-bold text-lg mb-4">내 예금 계좌 ({accounts.length})</h3>
                                {accounts.length === 0 ? (
                                    <div className="text-slate-500 text-sm">가입한 상품이 없습니다.</div>
                                ) : (
                                    <div className="space-y-3">
                                        {accounts.map((acc: any) => {
                                            const lockedUntil = new Date(acc.locked_until);
                                            const isMature = new Date() >= lockedUntil;
                                            const interest = Math.floor(acc.amount * acc.interest_rate);

                                            return (
                                                <div key={acc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div>
                                                            <div className="font-bold">{acc.amount.toLocaleString()} 원</div>
                                                            <div className="text-xs text-slate-500">
                                                                {new Date(acc.created_at).toLocaleDateString()} 가입
                                                            </div>
                                                        </div>
                                                        {isMature ? (
                                                            <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full">만기 도래</span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-1 rounded-full">D-{Math.ceil((lockedUntil.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}</span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                                        <div className="text-sm">
                                                            예상 수령액: <span className="font-bold">{(acc.amount + interest).toLocaleString()}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => handleWithdraw(acc.id)}
                                                            disabled={!isMature || withdrawLoading === acc.id}
                                                            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${!isMature
                                                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                                                : 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
                                                                }`}
                                                        >
                                                            {withdrawLoading === acc.id ? '처리 중...' : '출금하기'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <footer className="mt-12 py-8 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
                <p>만든 사람: 경기도 지구과학 교사 뀨짱</p>
                <p className="mt-1">
                    문의: <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">카카오톡 오픈채팅</a>
                    <span className="mx-2">|</span>
                    블로그: <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">뀨짱쌤의 교육자료 아카이브</a>
                </p>
            </footer>
        </div>
    );
}
