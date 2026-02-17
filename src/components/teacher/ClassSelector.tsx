
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ChevronDown } from 'lucide-react';

export default function ClassSelector({ onClassChange }: { onClassChange: () => void }) {
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<string>('');
    const supabase = createClient();

    useEffect(() => {
        const fetchClasses = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data } = await supabase
                .from('classes')
                .select('*')
                .eq('teacher_id', user.id)
                .order('name', { ascending: true });

            if (data) {
                setClasses(data);
                const saved = localStorage.getItem('selected_class_id');
                if (saved && data.find(c => c.id === saved)) {
                    setSelectedClassId(saved);
                } else if (data.length > 0) {
                    setSelectedClassId(data[0].id);
                    localStorage.setItem('selected_class_id', data[0].id);
                }
            }
        };
        fetchClasses();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = e.target.value;
        setSelectedClassId(id);
        localStorage.setItem('selected_class_id', id);
        onClassChange();
    };

    if (classes.length === 0) return null;

    return (
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">학급:</span>
            <select
                value={selectedClassId}
                onChange={handleChange}
                className="bg-transparent border-none focus:ring-0 text-sm font-bold text-slate-800 dark:text-white p-0 pr-6"
            >
                {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
        </div>
    );
}
