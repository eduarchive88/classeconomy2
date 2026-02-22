
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

    const results = [];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    for (const cls of classes) {
        // 2. 현재 해당 학급에 오늘 배포된 퀴즈 확인
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

        // 3. 후보 퀴즈 가져오기 (배포 횟수 계산 포함)
        const { data: allQuizzes } = await supabase
            .from('quizzes')
            .select('id')
            .eq('class_id', cls.id);

        if (!allQuizzes || allQuizzes.length === 0) {
            results.push({ class_id: cls.id, status: 'no_quizzes_available' });
            continue;
        }

        // 전체 배포 횟수 정보 가져오기
        const { data: allDistributions } = await supabase
            .from('daily_quizzes')
            .select('quiz_id');

        const distCounts: { [key: string]: number } = {};
        allDistributions?.forEach((d: any) => {
            distCounts[d.quiz_id] = (distCounts[d.quiz_id] || 0) + 1;
        });

        // 오늘 이미 배포된 퀴즈 제외 및 배포 횟수 기반 정렬
        const candidates = allQuizzes
            .filter((q: any) => !existingQuizIds.includes(q.id))
            .map((q: any) => ({
                id: q.id,
                count: distCounts[q.id] || 0
            }))
            .sort((a: any, b: any) => {
                // 배포 횟수가 적은 순, 횟수가 같으면 랜덤
                if (a.count !== b.count) return a.count - b.count;
                return 0.5 - Math.random();
            });

        const selected = candidates.slice(0, needed);

        // 4. 배포 처리
        if (selected.length > 0) {
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
            }
        }

        results.push({ class_id: cls.id, distributed: selected.length });
    }

    return NextResponse.json({ success: true, results });
}
