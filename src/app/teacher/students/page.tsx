
'use client';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import * as XLSX from 'xlsx';
import { Upload, UserPlus, Save, Trash2 } from 'lucide-react';

export default function StudentManagement() {
    const [students, setStudents] = useState<any[]>([]); // 저장된 학생 명단
    const [uploadQueue, setUploadQueue] = useState<any[]>([]); // 업로드 대기 중인 학생 명단
    const [loading, setLoading] = useState(false);
    const [classInfo, setClassInfo] = useState({ grade: '', class: '', sessionCode: '' });
    const supabase = createClient();

    // 기존 학생 명단 불러오기
    const fetchStudents = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
            .from('student_roster')
            .select('*')
            .eq('teacher_id', user.id)
            .order('grade', { ascending: true })
            .order('class_info', { ascending: true })
            .order('number', { ascending: true });

        if (error) {
            console.error('Error fetching students:', error);
        } else {
            setStudents(data || []);
        }
    };

    // 초기 로딩 시 데이터 가져오기
    useState(() => {
        fetchStudents();
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = XLSX.read(bstr, { type: 'binary' });
            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            // Parse Logic based on user requirements:
            // A: Grade, B: Class, C: Number, D: Name, E: Weekly Allowance
            const parsedStudents = data.slice(1).map((row: any) => ({
                grade: row[0],
                class: row[1],
                number: row[2],
                name: row[3],
                allowance: row[4] || 0, // Default 0 if empty
            })).filter((s: any) => s.name); // Filter empty rows

            setUploadQueue(parsedStudents);
        };
        reader.readAsBinaryString(file);
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/teacher/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ students: uploadQueue, sessionCode: classInfo.sessionCode }),
            });

            if (!res.ok) throw new Error((await res.json()).error);

            alert('학생들이 성공적으로 등록되었습니다.');
            setUploadQueue([]);
            fetchStudents(); // 명단 새로고침
        } catch (e: any) {
            alert('오류 발생: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-slate-800 dark:text-white">학생 관리</h1>

            <div className="grid gap-8 md:grid-cols-[1fr_2fr]">
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                            학급 설정
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">접속 세션 코드</label>
                                <input
                                    type="text"
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="예: LOVE2024"
                                    value={classInfo.sessionCode}
                                    onChange={e => setClassInfo({ ...classInfo, sessionCode: e.target.value })}
                                />
                                <p className="text-xs text-slate-500 mt-1">학생들이 접속할 때 사용할 코드입니다.</p>
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <Upload className="w-5 h-5 text-emerald-600" />
                            학생 일괄 등록
                        </h2>
                        <div className="space-y-4">
                            <input
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileUpload}
                                className="block w-full text-sm text-slate-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
                            />
                            <div className="text-xs text-slate-500 space-y-1">
                                <p>엑셀 양식: A열(학년), B열(반), C열(번호), D열(성명), E열(주급)</p>
                                <a href="/sample_student_upload.xlsx" className="text-blue-600 underline">샘플 양식 다운로드</a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">
                            {uploadQueue.length > 0 ? `등록 대기 명단 (${uploadQueue.length}명)` : `현재 학생 명단 (${students.length}명)`}
                        </h2>
                        {uploadQueue.length > 0 && (
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? '저장 중...' : '저장하기'}
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800 uppercase text-slate-500">
                                <tr>
                                    <th className="p-3">학년</th>
                                    <th className="p-3">반</th>
                                    <th className="p-3">번호</th>
                                    <th className="p-3">이름</th>
                                    <th className="p-3">주급</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {(uploadQueue.length > 0 ? uploadQueue : students).map((s, i) => (
                                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                        <td className="p-3">{s.grade}</td>
                                        <td className="p-3">{s.class_info || s.class}</td>
                                        <td className="p-3">{s.number}</td>
                                        <td className="p-3 font-medium">{s.name}</td>
                                        <td className="p-3">{s.allowance.toLocaleString()} 원</td>
                                    </tr>
                                ))}
                                {students.length === 0 && uploadQueue.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400">
                                            등록된 학생이 없습니다. 왼쪽에서 엑셀 파일을 업로드해주세요.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
