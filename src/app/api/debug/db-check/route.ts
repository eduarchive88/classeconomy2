
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createAdminClient();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    // 1. 전체 학급 조회
    const { data: classes } = await supabase.from('classes').select('id, name, session_code');

    // 2. 오늘 날짜의 퀴즈 배포 현황 조회
    const { data: dailyQuizzes, error: dqError } = await supabase
        .from('daily_quizzes')
        .select('id, class_id, date, quiz_id')
        .eq('date', today);

    // 3. 퀴즈 마스터 테이블 확인
    const { data: allQuizzes } = await supabase.from('quizzes').select('id, question, class_id');

    return NextResponse.json({
        today,
        classCount: classes?.length || 0,
        dailyQuizCountToday: dailyQuizzes?.length || 0,
        totalQuizMasterCount: allQuizzes?.length || 0,
        classes: classes?.map(c => ({
            name: c.name,
            sessionCode: c.sessionCode,
            quizCountToday: dailyQuizzes?.filter(dq => dq.class_id === c.id).length || 0
        })),
        error: dqError?.message
    });
}
