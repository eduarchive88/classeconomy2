
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

    // 2. Insert into quizzes (Question Bank)
    const { data: newQuizzes, error } = await supabase
        .from('quizzes')
        .insert(quizzes.map((q: any) => ({
            teacher_id: user.id,
            class_id: class_id,
            question: q.question,
            options: q.options,
            answer: q.answer,
            reward: q.reward,
            explanation: q.explanation // Add explanation field
        })))
        .select();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 3. Instant Deployment (Add to daily_quizzes for today)
    if (newQuizzes && newQuizzes.length > 0) {
        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

        const dailyInserts = newQuizzes.map((q: any) => ({
            class_id: class_id,
            quiz_id: q.id,
            date: today
        }));

        const { error: dailyError } = await supabase
            .from('daily_quizzes')
            .insert(dailyInserts);

        if (dailyError) {
            console.error('Failed to deploy daily quizzes instantly:', dailyError);
            // We don't fail the request here, as the quiz is created in the bank.
            // But we should probably let the client know or just log it.
        }
    }

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
