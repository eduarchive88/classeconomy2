import { createAdminClient } from '@/utils/supabase/server';

/**
 * 특정 학급의 오늘의 퀴즈가 아직 배포되지 않은 경우 지연 배포(Lazy Trigger)를 수행합니다.
 * @param classId 학급 ID
 */
export async function triggerDailyQuizDistribution(classId: string) {
    const supabase = createAdminClient();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

    try {
        // 1. 오늘 이미 이 학급에 배포된 퀴즈가 있는지 검사
        const { data: existingDaily } = await supabase
            .from('daily_quizzes')
            .select('quiz_id')
            .eq('class_id', classId)
            .eq('date', today);

        const existingQuizIds = existingDaily ? existingDaily.map((d: any) => d.quiz_id) : [];
        const count = existingQuizIds.length;

        // 매일 2개씩 배포하는 정책이므로 이미 2개 이상 배포되어 있다면 패스
        if (count >= 2) {
            return { status: 'already_distributed' };
        }

        const needed = 2 - count;

        // 2. 후보 퀴즈 가져오기
        const { data: allQuizzes } = await supabase
            .from('quizzes')
            .select('id')
            .eq('class_id', classId);

        if (!allQuizzes || allQuizzes.length === 0) {
            return { status: 'no_quizzes_available' };
        }

        // 3. 전체 배포 횟수를 조회하여 가중치(배포 횟수 적은 순) 산출
        const { data: allDistributions } = await supabase
            .from('daily_quizzes')
            .select('quiz_id')
            .limit(5000);

        const distCounts: { [key: string]: number } = {};
        allDistributions?.forEach((d: any) => {
            distCounts[d.quiz_id] = (distCounts[d.quiz_id] || 0) + 1;
        });

        // Fisher-Yates 방식으로 shuffle 후 누적 배포 횟수가 적은 순으로 정렬
        const shuffled = [...allQuizzes].sort(() => Math.random() - 0.5);
        const candidates = shuffled
            .filter((q: any) => !existingQuizIds.includes(q.id))
            .map((q: any) => ({
                id: q.id,
                count: distCounts[q.id] || 0
            }))
            .sort((a: any, b: any) => a.count - b.count);

        const selected = candidates.slice(0, needed);

        if (selected.length === 0) {
            return { status: 'no_candidates_available' };
        }

        // 4. 배포 처리
        const inserts = selected.map((q: any) => ({
            class_id: classId,
            quiz_id: q.id,
            date: today
        }));

        const { error: insertError } = await supabase
            .from('daily_quizzes')
            .insert(inserts);

        if (insertError) {
            console.error(`[lazy-cron] 퀴즈 지연 배포 실패 (학급: ${classId}):`, insertError);
            return { status: 'error', message: insertError.message };
        }

        console.log(`[lazy-cron] 퀴즈 ${selected.length}개 지연 배포 완료 (학급: ${classId})`);
        return { status: 'distributed', count: selected.length };
    } catch (e: any) {
        console.error('[lazy-cron] 퀴즈 지연 배포 예외 발생:', e);
        return { status: 'error', message: e.message };
    }
}

/**
 * 특정 학급의 이번 주 주급이 아직 지급되지 않은 경우 지연 지급(Lazy Trigger)을 수행합니다.
 * @param classId 학급 ID
 */
export async function triggerWeeklySalaryDistribution(classId: string) {
    const supabase = createAdminClient();

    try {
        // 1. 이번 주 월요일 08:00 KST 기준 시점 계산
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        
        const day = kstNow.getUTCDay(); // 0: 일요일, 1: 월요일, ...
        // 이번 주 월요일 날짜 계산 (일요일의 경우 지난 주 월요일이 되도록 처리)
        const diff = kstNow.getUTCDate() - day + (day === 0 ? -6 : 1);
        
        const lastMondayKST = new Date(kstNow);
        lastMondayKST.setUTCDate(diff);
        lastMondayKST.setUTCHours(8, 0, 0, 0); // 월요일 오전 8시 KST

        // UTC 시간으로 변환
        const lastMondayUTC = new Date(lastMondayKST.getTime() - kstOffset);

        // 2. 이 학급의 주급이 설정된 학생 목록 조회
        const { data: students, error: rosterError } = await supabase
            .from('student_roster')
            .select('id, name, number, balance, allowance')
            .eq('class_id', classId)
            .gt('allowance', 0);

        if (rosterError || !students || students.length === 0) {
            return { status: 'no_students' };
        }

        // 3. 해당 학급 학생 중 최근에 주급을 지급받은 내역이 있는지 확인 (이번 주 월요일 08:00 KST 이후)
        const studentIds = students.map(s => s.id);
        const { data: existingTx, error: txError } = await supabase
            .from('transactions')
            .select('id')
            .in('student_id', studentIds)
            .eq('type', 'allowance')
            .gt('created_at', lastMondayUTC.toISOString())
            .limit(1);

        if (txError) {
            console.error('[lazy-cron] 주급 지급 내역 조회 실패:', txError);
            return { status: 'error', message: txError.message };
        }

        // 이미 이번 주 주급 지급 내역이 존재하면 패스
        if (existingTx && existingTx.length > 0) {
            return { status: 'already_distributed' };
        }

        // 4. 주급 미지급 상태이므로 일괄 지급 처리
        const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const transactionsList: any[] = [];
        let successCount = 0;

        for (const student of students) {
            const currentBalance = student.balance || 0;
            const newBalance = currentBalance + student.allowance;

            // 잔고 업데이트
            const { error: updateError } = await supabase
                .from('student_roster')
                .update({ balance: newBalance })
                .eq('id', student.id);

            if (updateError) {
                console.error(`[lazy-cron] 주급 잔고 업데이트 실패 (${student.name}):`, updateError);
                continue;
            }

            transactionsList.push({
                student_id: student.id,
                amount: student.allowance,
                type: 'allowance',
                description: `주급 지급 (${dateStr})`
            });
            successCount++;
        }

        // 거래 기록 일괄 삽입
        if (transactionsList.length > 0) {
            const { error: insertError } = await supabase
                .from('transactions')
                .insert(transactionsList);
            if (insertError) {
                console.error('[lazy-cron] 주급 거래 로그 기록 실패:', insertError);
            }
        }

        console.log(`[lazy-cron] 주급 지연 지급 완료 (학급: ${classId}, 대상: ${successCount}명)`);
        return { status: 'distributed', count: successCount };

    } catch (e: any) {
        console.error('[lazy-cron] 주급 지연 지급 예외 발생:', e);
        return { status: 'error', message: e.message };
    }
}
