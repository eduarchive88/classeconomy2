
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // Vercel Cron Authentication (optional but recommended)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        // Only block if CRON_SECRET is defined and doesn't match
        console.warn('Unauthorized cron invocation attempt');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS since cron has no user context
    const supabase = createAdminClient();

    // 1. Get all classes
    const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id');

    if (classError || !classes) {
        return NextResponse.json({ error: 'Failed to fetch classes' }, { status: 500 });
    }

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 2. 전체 배포 횟수를 루프 밖에서 한 번만 조회 (성능 최적화)
    // 기본 limit(1000) 초과 방지를 위해 충분히 높은 limit 지정
    const { data: allDistributions } = await supabase
        .from('daily_quizzes')
        .select('quiz_id')
        .limit(50000);

    const distCounts: { [key: string]: number } = {};
    allDistributions?.forEach((d: any) => {
        distCounts[d.quiz_id] = (distCounts[d.quiz_id] || 0) + 1;
    });

    const results = [];

    for (const cls of classes) {
        // 3. 현재 해당 학급에 오늘 배포된 퀴즈 확인
        const { data: existingDaily } = await supabase
            .from('daily_quizzes')
            .select('quiz_id')
            .eq('class_id', cls.id)
            .eq('date', today);

        const existingQuizIds = existingDaily ? existingDaily.map((d: any) => d.quiz_id) : [];
        const count = existingQuizIds.length;

        if (count >= 2) {
            results.push({ class_id: cls.id, status: 'already_distributed' });
            continue;
        }

        const needed = 2 - count;

        // 4. 후보 퀴즈 가져오기
        const { data: allQuizzes } = await supabase
            .from('quizzes')
            .select('id')
            .eq('class_id', cls.id);

        if (!allQuizzes || allQuizzes.length === 0) {
            results.push({ class_id: cls.id, status: 'no_quizzes_available' });
            continue;
        }

        // 오늘 이미 배포된 퀴즈 제외 및 배포 횟수 기반 정렬
        // Fisher-Yates 방식으로 먼저 shuffle 후 count 기준 sort (stable sort 보장)
        const shuffled = [...allQuizzes].sort(() => Math.random() - 0.5);
        const candidates = shuffled
            .filter((q: any) => !existingQuizIds.includes(q.id))
            .map((q: any) => ({
                id: q.id,
                count: distCounts[q.id] || 0
            }))
            .sort((a: any, b: any) => a.count - b.count); // 배포 횟수 적은 순

        const selected = candidates.slice(0, needed);

        if (selected.length === 0) {
            results.push({ class_id: cls.id, status: 'no_candidates_available' });
            continue;
        }

        // 5. 배포 처리
        const inserts = selected.map((q: any) => ({
            class_id: cls.id,
            quiz_id: q.id,
            date: today
        }));

        const { error: insertError } = await supabase
            .from('daily_quizzes')
            .insert(inserts);

        if (insertError) {
            console.error(`Error distributing quizzes for class ${cls.id}:`, insertError);
            results.push({ class_id: cls.id, status: 'insert_failed', error: insertError.message });
            continue;
        }

        // 방금 배포한 것도 distCounts에 반영 (같은 cron 실행 내 다음 학급 정확성 유지)
        selected.forEach((q: any) => {
            distCounts[q.id] = (distCounts[q.id] || 0) + 1;
        });

        results.push({ class_id: cls.id, status: 'distributed', distributed: selected.length });
    }

    return NextResponse.json({ success: true, date: today, results });
}
