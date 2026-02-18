
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    // Use KST (Korea Standard Time) for today's date
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 1. Check Auth (Student)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve Student Roster ID & Class ID
    let rosterId = user.user_metadata?.roster_id;
    let classId = user.user_metadata?.class_id;

    if (!rosterId || !classId) {
        // Fallback: Resolve using email and metadata name
        const email = user.email || '';
        const sessionCode = email.split('@')[0].split('_')[0]; // Handle session_student@ or similar

        // 1. Try to find class by session_code
        const { data: cls } = await supabase
            .from('classes')
            .select('id')
            .eq('session_code', sessionCode)
            .maybeSingle();

        if (cls) {
            classId = cls.id;
            // 2. Find roster by name and class_id
            const { data: roster } = await supabase
                .from('student_roster')
                .select('id')
                .eq('class_id', classId)
                .eq('name', user.user_metadata.name)
                .maybeSingle();

            if (roster) rosterId = roster.id;
        }
    }

    if (!rosterId || !classId) {
        // Log for debugging if needed, but return structured error
        console.error('Failed to resolve student info:', { email: user.email, metadata: user.user_metadata });
        return NextResponse.json({ error: '학생 정보를 찾을 수 없습니다. (학급 코드 또는 이름 불일치)' }, { status: 404 });
    }

    // 3. Fetch Daily Quizzes for this Class & Date
    const { data: dailyQuizzes, error: dqError } = await supabase
        .from('daily_quizzes')
        .select(`
            id,
            date,
            quiz_id,
            quizzes (
                id,
                question,
                options,
                answer,
                explanation,
                reward
            )
        `)
        .eq('class_id', classId)
        .eq('date', today);

    if (dqError || !dailyQuizzes) {
        return NextResponse.json({ quizzes: [] });
    }

    // 4. Fetch Submissions for this Student
    const dailyQuizIds = dailyQuizzes.map(d => d.id);
    let submissions: any[] = [];

    if (dailyQuizIds.length > 0) {
        const { data: subs } = await supabase
            .from('quiz_submissions')
            .select('daily_quiz_id, is_correct, created_at')
            .in('daily_quiz_id', dailyQuizIds)
            .eq('student_id', rosterId);

        if (subs) submissions = subs;
    }

    // 5. Merge & Format
    const results = dailyQuizzes.map(dq => {
        const sub = submissions.find(s => s.daily_quiz_id === dq.id);
        const quiz = dq.quizzes; // Should be object

        const isSubmitted = !!sub;

        return {
            daily_quiz_id: dq.id,
            quiz_id: quiz?.id,
            question: quiz?.question,
            options: quiz?.options, // JSONB?
            reward: quiz?.reward,
            status: isSubmitted ? (sub.is_correct ? 'correct' : 'incorrect') : 'pending',
            // Only show answer/explanation if submitted
            answer: isSubmitted ? quiz?.answer : null,
            explanation: isSubmitted ? quiz?.explanation : null,
        };
    });

    return NextResponse.json({ quizzes: results });
}

export async function POST(request: Request) {
    const { dailyQuizId, answer } = await request.json(); // answer is index (1-based usually)
    const supabase = createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Resolve Roster ID
    let rosterId = user.user_metadata?.roster_id;
    if (!rosterId) {
        const email = user.email || '';
        const sessionCode = email.split('@')[0].split('_')[0];
        const { data: cls } = await supabase
            .from('classes')
            .select('id')
            .eq('session_code', sessionCode)
            .maybeSingle();

        if (cls) {
            const { data: roster } = await supabase
                .from('student_roster')
                .select('id')
                .eq('class_id', cls.id)
                .eq('name', user.user_metadata.name)
                .maybeSingle();
            if (roster) rosterId = roster.id;
        }
    }

    if (!rosterId) return NextResponse.json({ error: 'Student not found' }, { status: 404 });

    // 3. Verify Quiz & Answer
    // Get daily quiz + quiz answer
    const { data: dq } = await supabase
        .from('daily_quizzes')
        .select('*, quizzes(answer, reward)')
        .eq('id', dailyQuizId)
        .single();

    if (!dq || !dq.quizzes) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    const correctAnswer = dq.quizzes.answer; // 1-based index usually
    const isCorrect = parseInt(answer) === correctAnswer;

    // 4. Check double submission
    const { data: existing } = await supabase
        .from('quiz_submissions')
        .select('id')
        .eq('daily_quiz_id', dailyQuizId)
        .eq('student_id', rosterId)
        .single();

    if (existing) return NextResponse.json({ error: 'Already submitted' }, { status: 400 });

    // 5. Insert Submission
    const { error: insertError } = await supabase
        .from('quiz_submissions')
        .insert({
            daily_quiz_id: dailyQuizId,
            student_id: rosterId,
            is_correct: isCorrect,
            choice: parseInt(answer)
        });

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

    // 6. Reward if correct
    if (isCorrect) {
        const reward = dq.quizzes.reward || 0;
        if (reward > 0) {
            // Update roster balance
            // We use RPC or direct update? 
            // My finance API uses direct update + transaction.

            // 6.1 Transaction
            await supabase.from('transactions').insert({
                student_id: rosterId,
                amount: reward,
                type: 'quiz_reward',
                description: '퀴즈 정답 보상'
            });

            // 6.2 Balance Update
            // Fetch current first
            const { data: r } = await supabase.from('student_roster').select('balance').eq('id', rosterId).single();
            if (r) {
                await supabase.from('student_roster').update({ balance: (r.balance || 0) + reward }).eq('id', rosterId);
            }
        }
    }

    return NextResponse.json({
        success: true,
        isCorrect,
        correctAnswer: correctAnswer,
        reward: isCorrect ? dq.quizzes.reward : 0
    });
}
