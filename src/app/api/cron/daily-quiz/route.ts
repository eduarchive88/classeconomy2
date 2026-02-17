
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();

    // 1. Get all classes
    const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id');

    if (classError || !classes) {
        return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
    }

    const results = [];
    const today = new Date().toISOString().split('T')[0];

    for (const cls of classes) {
        // 2. Check existing daily quizzes
        const { data: existingDaily } = await supabase
            .from('daily_quizzes')
            .select('quiz_id')
            .eq('class_id', cls.id)
            .eq('date', today);

        const existingQuizIds = existingDaily ? existingDaily.map(d => d.quiz_id) : [];
        const count = existingQuizIds.length;

        if (count >= 2) {
            results.push({ class_id: cls.id, status: 'already_distributed' });
            continue;
        }

        const needed = 2 - count;

        // 3. Fetch candidate quizzes
        const { data: allQuizzes } = await supabase
            .from('quizzes')
            .select('id')
            .eq('class_id', cls.id);

        if (!allQuizzes || allQuizzes.length === 0) {
            results.push({ class_id: cls.id, status: 'no_quizzes_available' });
            continue;
        }

        // Filter out existing
        const candidates = allQuizzes.filter(q => !existingQuizIds.includes(q.id));

        if (candidates.length === 0) {
            results.push({ class_id: cls.id, status: 'no_more_unique_quizzes' });
            continue;
        }

        // Pick random
        const shuffled = candidates.sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, needed);

        // 4. Insert
        if (selected.length > 0) {
            const inserts = selected.map(q => ({
                class_id: cls.id,
                quiz_id: q.id,
                date: today
            }));

            const { error: insertError } = await supabase
                .from('daily_quizzes')
                .insert(inserts);

            if (insertError) {
                console.error(`Error distributing quizzes for class ${cls.id}:`, insertError);
            }
        }

        results.push({ class_id: cls.id, distributed: selected.length });
    }

    return NextResponse.json({ success: true, results });
}
