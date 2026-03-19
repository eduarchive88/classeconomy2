'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
import { ArrowLeft, Download, FileSpreadsheet, Search, Filter } from 'lucide-react';
import Link from 'next/link';

export default function TeacherLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    // 학급 필터 상태
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassFilter, setSelectedClassFilter] = useState('all');
    const [studentClassMap, setStudentClassMap] = useState<Record<string, string>>({});
    const supabase = createClient();

    useEffect(() => {
        fetchClasses();
    }, []);

    useEffect(() => {
        if (classes.length > 0) {
            fetchLogs();
        }
    }, [classes, selectedClassFilter]);

    // 교사의 학급 목록 불러오기
    const fetchClasses = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('classes')
            .select('id, name')
            .eq('teacher_id', user.id)
            .order('name', { ascending: true });

        if (data) {
            setClasses(data);
            // localStorage에 저장된 선택 학급이 있으면 기본값으로 설정
            const saved = localStorage.getItem('selected_class_id');
            if (saved && data.find(c => c.id === saved)) {
                setSelectedClassFilter(saved);
            }
        }
    };

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 필터에 따라 학급 ID 결정
            let classIds: string[];
            if (selectedClassFilter === 'all') {
                classIds = classes.map(c => c.id);
            } else {
                classIds = [selectedClassFilter];
            }

            if (classIds.length === 0) {
                setLogs([]);
                return;
            }

            // 해당 학급의 학생 조회
            const { data: students } = await supabase
                .from('student_roster')
                .select('id, name, number, class_id')
                .in('class_id', classIds);

            if (!students?.length) {
                setLogs([]);
                return;
            }

            const studentIds = students.map(s => s.id);
            const studentMap = students.reduce((acc: any, s) => {
                acc[s.id] = s;
                return acc;
            }, {});

            // 학생 -> 학급 매핑 저장
            const classMap: Record<string, string> = {};
            students.forEach(s => {
                const cls = classes.find(c => c.id === s.class_id);
                classMap[s.id] = cls?.name || '';
            });
            setStudentClassMap(classMap);

            // 거래 내역 조회
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .in('student_id', studentIds)
                .order('created_at', { ascending: false })
                .limit(500);

            if (error) throw error;

            const enrichedLogs = transactions.map(t => ({
                ...t,
                student_name: studentMap[t.student_id]?.name || 'Unknown',
                student_number: studentMap[t.student_id]?.number || '',
                class_name: classMap[t.student_id] || '',
            }));

            setLogs(enrichedLogs);

        } catch (error) {
            console.error('Error fetching logs:', error);
            alert('로그를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'allowance': return '용돈';
            case 'special_allowance': return '특별 보너스';
            case 'fine': return '벌금';
            case 'quiz_reward': return '퀴즈 상금';
            case 'stock_buy': return '주식 매수';
            case 'stock_sell': return '주식 매도';
            case 'investment_buy': return '주식 매수';
            case 'investment_sell': return '주식 매도';
            case 'stock_profit': return '투자 수익';
            case 'stock_loss': return '투자 손실';
            case 'real_estate_income': return '임대/매각 수익';
            case 'market_purchase': return '상점 구매';
            case 'real_estate_purchase': return '부동산 구매';
            case 'real_estate_pending': return '부동산 (승인 대기)';
            case 'real_estate_refund': return '부동산 (환불)';
            case 'tax': return '세금';
            case 'transfer_sent': return '송금 보냄';
            case 'transfer_received': return '송금 받음';
            case 'transfer': return '송금';
            case 'deposit': return '저축 가입';
            case 'withdraw': return '저축 만기 출금';
            case 'group_donation': return '모둠 기부';
            default: return type;
        }
    };

    const handleExport = () => {
        const dataToExport = filteredLogs.map(log => ({
            '일시': new Date(log.created_at).toLocaleString(),
            '학급': log.class_name,
            '이름': log.student_name,
            '번호': log.student_number,
            '유형': getTypeLabel(log.type),
            '금액': log.amount,
            '내용': log.description
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "활동로그");
        XLSX.writeFile(wb, `경제활동_로그_${new Date().toLocaleDateString()}.xlsx`);
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch =
            log.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.student_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'all' || log.type === filterType;
        return matchesSearch && matchesFilter;
    });

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/teacher" className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </Link>
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet className="w-8 h-8 text-green-600" />
                        활동 로그 조회
                    </h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* 학급 필터 */}
                            <select
                                value={selectedClassFilter}
                                onChange={(e) => setSelectedClassFilter(e.target.value)}
                                className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm font-medium"
                            >
                                <option value="all">전체 학급</option>
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <div className="relative">
                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="이름 또는 내용 검색"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-slate-700 w-full md:w-64"
                                />
                            </div>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700"
                            >
                                <option value="all">모든 유형</option>
                                <option value="income">수입</option>
                                <option value="expense">지출</option>
                                <option value="fine">벌금</option>
                                <option value="investment">투자</option>
                            </select>
                        </div>

                        <button
                            onClick={handleExport}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm w-full md:w-auto justify-center"
                        >
                            <Download className="w-5 h-5" />
                            Excel 다운로드
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 text-sm">
                                    <th className="p-4 border-b dark:border-slate-700">일시</th>
                                    {selectedClassFilter === 'all' && (
                                        <th className="p-4 border-b dark:border-slate-700">학급</th>
                                    )}
                                    <th className="p-4 border-b dark:border-slate-700">학생</th>
                                    <th className="p-4 border-b dark:border-slate-700">유형</th>
                                    <th className="p-4 border-b dark:border-slate-700">내용</th>
                                    <th className="p-4 border-b dark:border-slate-700 text-right">금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={selectedClassFilter === 'all' ? 6 : 5} className="p-8 text-center text-slate-500">
                                            로그를 불러오는 중...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={selectedClassFilter === 'all' ? 6 : 5} className="p-8 text-center text-slate-500">
                                            기록된 로그가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            {selectedClassFilter === 'all' && (
                                                <td className="p-4 text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                    {log.class_name}
                                                </td>
                                            )}
                                            <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                                                {log.student_number} {log.student_name}
                                            </td>
                                            <td className="p-4">
                                                <span className={`
                                                    inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                                    ${log.type === 'fine' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        (log.type === 'income' || log.type === 'special_allowance' || log.type === 'allowance' || log.type === 'quiz_reward' || log.type === 'transfer_received') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            (log.type === 'expense' || log.type === 'market_purchase' || log.type === 'tax' || log.type === 'withdrawal' || log.type === 'transfer_sent') ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                                                (log.type === 'investment' || log.type === 'stock_buy' || log.type === 'stock_sell') ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                                    (log.type === 'group_donation') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}
                                                `}>
                                                    {getTypeLabel(log.type)}
                                                </span>
                                            </td>
                                            <td className="p-4 text-slate-600 dark:text-slate-300">
                                                {log.description}
                                            </td>
                                            <td className={`p-4 text-right font-bold ${log.type === 'fine' ? 'text-red-600 dark:text-red-400' :
                                                log.amount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-black dark:text-white'
                                                }`}>
                                                {log.type === 'fine' ? '-' : (log.amount > 0 ? '+' : '')}{Math.abs(log.amount).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <footer className="mt-12 py-8 text-center text-slate-400 text-sm border-t border-slate-200 dark:border-slate-800">
                    <p>만든 사람: 경기도 지구과학 교사 뀨짱</p>
                    <div className="flex justify-center gap-4 mt-2">
                        <a href="https://open.kakao.com/o/s7hVU65h" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition-colors">
                            문의: 카카오톡 오픈채팅
                        </a>
                        <span className="text-slate-300">|</span>
                        <a href="https://eduarchive.tistory.com/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500 transition-colors">
                            블로그: 뀨짱쌤의 교육자료 아카이브
                        </a>
                    </div>
                </footer>
            </div>
        </div>
    );
}
