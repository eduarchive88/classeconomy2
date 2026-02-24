
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

    const { data: classData } = await supabase.from('classes').select('*').ilike('session_code', 'class1').single();
    let targetRoster: any = null;
    let targetSeat: any = null;

    if (classData) {
        const { data: roster } = await supabase.from('student_roster').select('*').eq('class_id', classData.id);
        if (roster) {
            targetRoster = roster.find((s: any) => s.grade === '2' && s.class_info === '2' && s.number === '1' || s.name === '20201' || s.grade === '20201' || s.profile_id === '20201' || s.number === '20201');

            if (targetRoster) {
                const { data: seats } = await supabase.from('seats').select('*, student:student_id(name, number)').eq('class_id', classData.id);
                targetSeat = seats?.filter((s: any) => s.student_id === targetRoster.id);
            }
        }
    }

    return NextResponse.json({
        today,
        classCount: classes?.length || 0,
        dailyQuizCountToday: dailyQuizzes?.length || 0,
        classes: classes?.map((c: any) => ({
            name: c.name,
            sessionCode: c.sessionCode,
            quizCountToday: dailyQuizzes?.filter((dq: any) => dq.class_id === c.id).length || 0
        })),
        studentInfo: targetRoster,
        studentSeat: targetSeat,
        error: dqError?.message
    });
}
