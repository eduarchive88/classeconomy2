import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const supabase = createClient();
    // Use KST (Korea Standard Time) for today's date
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 1. Check Auth (Student) & Fallback
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    let rosterId: string | null = null;
    let classId: string | null = null;
    let authMethod = 'cookie';

    if (user) {
        const studentInfo = await getStudentFromAuth(supabase, user);
        rosterId = studentInfo.rosterId;
        classId = studentInfo.classId;
    }

    // Fallback: If cookie auth failed, check for custom header from client (localStorage)
    if (!rosterId || !classId) {
        const headerStudentId = request.headers.get('x-student-id');
        if (headerStudentId) {
            console.log(`GET /api/student/quiz: Auth failed, trying fallback with header x-student-id: ${headerStudentId}`);

            // Verify this ID exists in DB
            // use admin client to bypass RLS if needed for this lookup, or just standard client if public read allowed.
            // Safe to use standard client as we are just checking existence if RLS allows.
            // Actually, we need to know the class_id.
            const { data: roster } = await supabase
                .from('student_roster')
                .select('id, class_id')
                .eq('id', headerStudentId)
                .single();

            if (roster) {
                rosterId = roster.id;
                classId = roster.class_id;
                authMethod = 'header_fallback';
            }
        }
    }

    if (!rosterId || !classId) {
        console.error('GET /api/student/quiz: Unauthorized or Student not found.', { authError: authError?.message });
        return NextResponse.json({
            error: 'Unauthorized',
            debug: {
                hasUser: !!user,
                authErrorMessage: authError?.message,
                message: '인증 세션이 유효하지 않으며, 백업 인증 정보도 없습니다. 다시 로그인해주세요.',
                serverTime: new Date().toISOString()
            }
        }, { status: 401 });
    }

    // 3. Fetch Daily Quizzes for this Class
    // 사용자 요청: 오늘 날짜 퀴즈만 표시
    console.log(`Fetching quizzes for class ${classId} on date: ${today}`);

    // Use Admin Client to bypass RLS on 'quizzes' table
    // Sometimes 'anon' user or partial auth cannot read 'quizzes' depending on strict policies.
    const adminSupabase = createAdminClient();

    const { data: dailyQuizzes, error: dqError } = await adminSupabase
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
        .eq('date', today) // 어제 날짜 제외하고 오늘만 조회
        .order('date', { ascending: false });

    if (dqError || !dailyQuizzes) {
        console.error('GET /api/student/quiz: Database error.', dqError);
        return NextResponse.json({
            quizzes: [],
            debug: {
                resolvedClassId: classId,
                resolvedRosterId: rosterId,
                queryDate: today,
                error: dqError?.message || 'No data returned',
                authMethod,
                serverTime: new Date().toISOString()
            }
        });
    }

    // 4. Fetch Submissions for this Student
    const dailyQuizIds = dailyQuizzes.map((d: any) => d.id);
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
    const results = dailyQuizzes.map((dq: any) => {
        const sub = submissions.find((s: any) => s.daily_quiz_id === dq.id);
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

    return NextResponse.json({
        quizzes: results,
        debug: {
            resolvedClassId: classId,
            resolvedRosterId: rosterId,
            queryDate: today,
            foundQuizzesCount: dailyQuizzes.length,
            userEmail: user?.email,
            authMethod,
            serverTime: new Date().toISOString()
        }
    });
}

export async function POST(request: Request) {
    const { dailyQuizId, answer } = await request.json();
    const supabase = createClient();

    // 1. Auth & Fallback
    const { data: { user } } = await supabase.auth.getUser();

    let rosterId: string | null = null;

    if (user) {
        const studentInfo = await getStudentFromAuth(supabase, user);
        rosterId = studentInfo.rosterId;
    }

    // Fallback: Check header if cookie auth failed
    // If we use fallback, we MUST use admin client to bypass RLS for submission insert
    // because 'anon' user cannot insert into 'quiz_submissions' usually.
    let dbClient = supabase;

    if (!rosterId) {
        const headerStudentId = request.headers.get('x-student-id');
        if (headerStudentId) {
            console.log(`POST /api/student/quiz: Auth failed, trying fallback with header x-student-id: ${headerStudentId}`);

            // Use Admin Client for lookup AND subsequent operations
            const adminSupabase = createAdminClient();

            const { data: roster } = await adminSupabase
                .from('student_roster')
                .select('id')
                .eq('id', headerStudentId)
                .single();

            if (roster) {
                rosterId = roster.id;
                dbClient = adminSupabase; // Use admin client for the rest of the request
            }
        }
    }

    if (!rosterId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Resolve Roster ID - already done above
    // const { rosterId } = await getStudentFromAuth(supabase, user); 
    // if (!rosterId) return NextResponse.json({ error: 'Student info not found' }, { status: 404 });

    // 3. Verify Quiz & Answer
    const { data: dq } = await dbClient
        .from('daily_quizzes')
        .select('*, quizzes(answer, reward)')
        .eq('id', dailyQuizId)
        .single();

    if (!dq || !dq.quizzes) return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });

    const quiz: any = dq.quizzes;
    const correctAnswer = quiz.answer;
    const isCorrect = parseInt(answer) === correctAnswer;

    // 4. Check double submission
    const { data: existing } = await dbClient
        .from('quiz_submissions')
        .select('id')
        .eq('daily_quiz_id', dailyQuizId)
        .eq('student_id', rosterId)
        .maybeSingle();

    if (existing) return NextResponse.json({ error: 'Already submitted' }, { status: 400 });

    // 5. Insert Submission
    const { error: insertError } = await dbClient
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
            await dbClient.from('transactions').insert({
                student_id: rosterId,
                amount: reward,
                type: 'quiz_reward',
                description: '퀴즈 정답 보상'
            });

            const { data: r } = await dbClient.from('student_roster').select('balance').eq('id', rosterId).single();
            if (r) {
                await dbClient.from('student_roster').update({ balance: (r.balance || 0) + reward }).eq('id', rosterId);
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
