
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { quizzes } = await request.json();
    const supabase = createClient();

    // 1. Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Prepare Data
    const quizData = quizzes.map((q: any) => ({
        teacher_id: user.id,
        question: q.question,
        options: JSON.stringify(q.options), // Store as JSON string or JSONB handles array? JSONB handles array.
        // However, Supabase Node client might expect array if column is JSONB. 
        // Let's pass array directly if column is JSONB.
        answer: q.answer,
        reward: q.reward,
    }));

    // 3. Insert
    // Note: 'options' in schema is JSONB. Suapbase JS client handles array -> JSONB automatically.
    const { error } = await supabase.from('quizzes').insert(quizzes.map((q: any) => ({
        teacher_id: user.id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        reward: q.reward,
    })));

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
