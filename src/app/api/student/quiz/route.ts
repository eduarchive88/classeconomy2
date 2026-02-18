import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export async function GET(request: Request) {
    const supabase = createClient();
    // Use KST (Korea Standard Time) for today's date
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 1. Check Auth (Student)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        console.error('GET /api/student/quiz: Unauthorized access attempt.', { authError: authError?.message });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve Student ID & Class ID using shared utility
    const { rosterId, classId } = await getStudentFromAuth(supabase, user);

    if (!rosterId || !classId) {
        console.error('GET /api/student/quiz: Failed to resolve student info.', {
            email: user.email,
            metadata: user.user_metadata,
            rosterId,
            classId
        });
        return NextResponse.json({
            error: '학생 정보를 찾을 수 없습니다.',
            debug: { email: user.email, metadata: user.user_metadata, foundClass: !!classId, foundRoster: !!rosterId }
        }, { status: 404 });
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
        const quiz: any = dq.quizzes; // Cast to any for easier access

        const isSubmitted = !!sub;

        return {
            daily_quiz_id: dq.id,
            quiz_id: quiz?.id,
            question: quiz?.question,
            options: quiz?.options,
            reward: quiz?.reward,
            status: isSubmitted ? (sub.is_correct ? 'correct' : 'incorrect') : 'pending',
            answer: isSubmitted ? quiz?.answer : null,
            explanation: isSubmitted ? quiz?.explanation : null,
        };
    });

    return NextResponse.json({ quizzes: results });
}

export async function POST(request: Request) {
    const { dailyQuizId, answer } = await request.json();
    const supabase = createClient();

    // 1. Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Resolve Roster ID
    const { rosterId } = await getStudentFromAuth(supabase, user);

    if (!rosterId) return NextResponse.json({ error: 'Student info not found' }, { status: 404 });

    // 3. Verify Quiz & Answer
    const { data: dq } = await supabase
        .from('daily_quizzes')
        .select('*, quizzes(answer, reward)')
        .eq('id', dailyQuizId)
        .single();

    if (!dq || !dq.quizzes) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    const quiz: any = dq.quizzes;
    const correctAnswer = quiz.answer;
    const isCorrect = parseInt(answer) === correctAnswer;

    // 4. Check double submission
    const { data: existing } = await supabase
        .from('quiz_submissions')
        .select('id')
        .eq('daily_quiz_id', dailyQuizId)
        .eq('student_id', rosterId)
        .maybeSingle();

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
        const reward = quiz.reward || 0;
        if (reward > 0) {
            await supabase.from('transactions').insert({
                student_id: rosterId,
                amount: reward,
                type: 'quiz_reward',
                description: '퀴즈 정답 보상'
            });

            const { data: r } = await supabase.from('student_roster').select('balance').eq('id', rosterId).single();
            if (r) {
                await supabase.from('student_roster').update({ balance: (r.balance || 0) + reward }).eq('id', rosterId);
            }
        }
    }

    return NextResponse.json({
        success: true,
        isCorrect,
        correctAnswer,
        reward: isCorrect ? quiz.reward : 0
    });
}
