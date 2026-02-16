
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. Check Auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get Daily Quiz (Lazy Init)
    let { data: dailyQuiz, error } = await supabase
        .from('daily_quizzes')
        .select('*, quizzes(*)')
        .eq('date', today)
        .single();

    if (!dailyQuiz) {
        // Lazy Init: Pick a quiz
        // Strategy: Pick one that hasn't been assigned yet (date_assigned is null)
        const { data: availableQuizzes } = await supabase
            .from('quizzes')
            .select('id')
            .is('date_assigned', null)
            .limit(10); // Fetch a few to randomize

        let quizIdToAssign;

        if (availableQuizzes && availableQuizzes.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableQuizzes.length);
            quizIdToAssign = availableQuizzes[randomIndex].id;
        } else {
            // If all assigned, pick any (recycle)
            // Pick randomly from all
            const { data: allQuizzes } = await supabase.from('quizzes').select('id');
            if (allQuizzes && allQuizzes.length > 0) {
                const randomIndex = Math.floor(Math.random() * allQuizzes.length);
                quizIdToAssign = allQuizzes[randomIndex].id;
            }
        }

        if (quizIdToAssign) {
            // Insert into daily_quizzes
            const { error: insertError } = await supabase
                .from('daily_quizzes')
                .insert({ date: today, quiz_id: quizIdToAssign });

            // Update date_assigned
            await supabase.from('quizzes').update({ date_assigned: today }).eq('id', quizIdToAssign);

            // Re-fetch
            const { data: newDaily } = await supabase
                .from('daily_quizzes')
                .select('*, quizzes(*)')
                .eq('date', today)
                .single();

            dailyQuiz = newDaily;
        }
    }

    if (!dailyQuiz || !dailyQuiz.quizzes) {
        return NextResponse.json({ quiz: null });
    }

    const quiz = dailyQuiz.quizzes;

    // 3. Check if user solved it
    const { data: log } = await supabase
        .from('quiz_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('quiz_id', quiz.id)
        .single();

    if (log) {
        // Already solved
        return NextResponse.json({
            solved: true,
            isCorrect: log.is_correct,
            reward: quiz.reward,
            quiz: {
                id: quiz.id,
                question: quiz.question,
                options: quiz.options, // Already parsed if JSONB? Supabase returns object/array.
                reward: quiz.reward,
                answer: quiz.answer // Return answer so they can see? Or hide?
            }
        });
    }

    // Not solved, return quiz without answer
    return NextResponse.json({
        solved: false,
        quiz: {
            id: quiz.id,
            question: quiz.question,
            options: quiz.options,
            reward: quiz.reward
            // HIDE ANSWER
        }
    });
}

export async function POST(request: Request) {
    const { quizId, answer } = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Get Quiz Answer
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
    if (!quiz) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    // 2. Check if already solved
    const { data: existingLog } = await supabase.from('quiz_logs').select('id').eq('user_id', user.id).eq('quiz_id', quizId).single();
    if (existingLog) return NextResponse.json({ error: 'Already submitted' }, { status: 400 });

    // 3. Verify
    const isCorrect = quiz.answer === answer;

    // 4. Log
    await supabase.from('quiz_logs').insert({
        user_id: user.id,
        quiz_id: quizId,
        is_correct: isCorrect
    });

    // 5. Reward if correct
    if (isCorrect) {
        await supabase.from('transactions').insert({
            from_id: null,
            to_id: user.id,
            amount: quiz.reward,
            type: 'quiz_reward',
            description: '퀴즈 정답 보상'
        });
        // Trigger updates balance
    }

    return NextResponse.json({ isCorrect, reward: quiz.reward });
}
