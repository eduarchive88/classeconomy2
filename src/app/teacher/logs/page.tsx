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
    const supabase = createClient();

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Get current class ID (assuming selected in dashboard or context)
            // For now, fetch all logs for students in teacher's classes
            // Ideally we should filter by selected class, but let's fetch recent 1000 logs first.

            // First get teacher's classes to filter students
            const { data: classes } = await supabase
                .from('classes')
                .select('id')
                .eq('teacher_id', user.id);

            if (!classes?.length) {
                setLogs([]);
                return;
            }

            const classIds = classes.map(c => c.id);

            // Fetch students in these classes
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

            // Fetch transactions
            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .in('student_id', studentIds)
                .order('created_at', { ascending: false })
                .limit(500); // Limit potentially large query

            if (error) throw error;

            const enrichedLogs = transactions.map(t => ({
                ...t,
                student_name: studentMap[t.student_id]?.name || 'Unknown',
                student_number: studentMap[t.student_id]?.number || '',
            }));

            setLogs(enrichedLogs);

        } catch (error) {
            console.error('Error fetching logs:', error);
            alert('로그를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const dataToExport = logs.map(log => ({
            '일시': new Date(log.created_at).toLocaleString(),
            '이름': log.student_name,
            '번호': log.student_number,
            '유형': log.type,
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
                        <div className="flex items-center gap-2 w-full md:w-auto">
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
                                    <th className="p-4 border-b dark:border-slate-700">학생</th>
                                    <th className="p-4 border-b dark:border-slate-700">유형</th>
                                    <th className="p-4 border-b dark:border-slate-700">내용</th>
                                    <th className="p-4 border-b dark:border-slate-700 text-right">금액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">
                                            로그를 불러오는 중...
                                        </td>
                                    </tr>
                                ) : filteredLogs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-500">
                                            기록된 로그가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLogs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="p-4 font-medium text-slate-800 dark:text-slate-200">
                                                {log.student_number} {log.student_name}
                                            </td>
                                            <td className="p-4">
                                                <span className={`
                                                    inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                                                    ${log.type === 'fine' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        (log.type === 'income' || log.type === 'special_allowance') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                            log.type === 'investment' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'}
                                                `}>
                                                    {log.type === 'fine' ? '벌금' :
                                                        log.type === 'income' ? '수입' :
                                                            log.type === 'expense' ? '지출' :
                                                                log.type === 'special_allowance' ? '특별 수당' :
                                                                    log.type === 'investment' ? '투자' : log.type}
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
