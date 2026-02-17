
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { quizzes, class_id } = await request.json();
    const supabase = createClient();

    // 1. Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user || user.user_metadata.role !== 'teacher') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Insert
    const { error } = await supabase.from('quizzes').insert(quizzes.map((q: any) => ({
        teacher_id: user.id,
        class_id: class_id,
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
