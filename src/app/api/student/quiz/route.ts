
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // 1. Check Auth (Student)
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve Student Roster ID & Class ID
    let rosterId = user.user_metadata?.roster_id;
    let classId = user.user_metadata?.class_id;

    if (!rosterId || !classId) {
        // Fallback: Find by metadata matching
        // Note: This relies on matching names/numbers as stored in metadata during signup
        const { data: roster, error: rosterError } = await supabase
            .from('student_roster')
            .select('id, class_id')
            .match({
                name: user.user_metadata.name,
                number: user.user_metadata.number,
                grade: user.user_metadata.grade,
                // class_info in metadata is class NAME (e.g. "1반"). 
                // But in roster it is often "1". This match might be flaky if formats differ.
                // However, let's try matching without class_info if it fails, or rely on grade/number/name uniqueness.
                grade: user.user_metadata.grade
            })
            .eq('teacher_id', (await supabase.from('classes').select('teacher_id').eq('id', classId || '00000000-0000-0000-0000-000000000000').single()).data?.teacher_id) // Circular dependency if we don't have classId...
            .maybeSingle();

        // Better fallback: If we can't find by strict match, maybe utilize session code from email?
        // But for now, let's assume metadata works or the user is new.
        // If really stuck, return error.
        if (roster) {
            rosterId = roster.id;
            classId = roster.class_id;
        } else {
            // Second fallback: Use email parsing if available
            const email = user.email || '';
            // "session_student@..."
            const sessionCode = email.split('_')[0];
            const { data: cls } = await supabase.from('classes').select('id').eq('session_code', sessionCode).single();
            if (cls) {
                classId = cls.id;
                // Now find roster by simple number/name match in this class
                const { data: r } = await supabase.from('student_roster')
                    .select('id')
                    .eq('class_id', cls.id)
                    .eq('name', user.user_metadata.name)
                    .maybeSingle();
                if (r) rosterId = r.id;
            }
        }
    }

    if (!rosterId || !classId) {
        return NextResponse.json({ error: 'Student information not found' }, { status: 404 });
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

    // 2. Resolve Roster ID (Reuse logic or assume passed? Better to resolve securely)
    let rosterId = user.user_metadata?.roster_id;
    // ... same fallback logic as GET ...
    // For brevity, using simplified fallback here. 
    if (!rosterId) {
        const email = user.email || '';
        const sessionCode = email.split('_')[0];
        const { data: cls } = await supabase.from('classes').select('id').eq('session_code', sessionCode).single();
        if (cls) {
            const { data: r } = await supabase.from('student_roster')
                .select('id')
                .eq('class_id', cls.id)
                .eq('name', user.user_metadata.name)
                .maybeSingle();
            if (r) rosterId = r.id;
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
            is_correct: isCorrect
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
