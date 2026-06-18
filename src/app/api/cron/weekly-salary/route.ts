
import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

// 매주 월요일 오전 8시(KST) = UTC 일요일 23시에 Vercel Cron에 의해 호출됨
export async function GET(request: Request) {
    // Vercel Cron 인증 (CRON_SECRET이 설정된 경우에만 검사)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        console.warn('Unauthorized cron invocation attempt - weekly salary');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin 클라이언트 사용 (크론잡은 인증 컨텍스트가 없으므로 RLS 우회 필요)
    const supabase = createAdminClient();

    try {
        // 1. 이중 실행 방지: 이번 주 월요일 08:00 KST 이후 allowance 트랜잭션이 이미 있으면 중단
        const nowForCheck = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(nowForCheck.getTime() + kstOffset);
        const dayOfWeek = kstNow.getUTCDay(); // 0=일, 1=월
        const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const thisMonday = new Date(kstNow);
        thisMonday.setUTCDate(kstNow.getUTCDate() + diffToMonday);
        thisMonday.setUTCHours(8, 0, 0, 0); // 월요일 08:00 KST
        const thisMondayUTC = new Date(thisMonday.getTime() - kstOffset);

        const { data: existingTx } = await supabase
            .from('transactions')
            .select('id')
            .eq('type', 'allowance')
            .gt('created_at', thisMondayUTC.toISOString())
            .limit(1);

        if (existingTx && existingTx.length > 0) {
            console.log('[weekly-salary] 이미 이번 주 주급 지급 완료 - 중복 실행 차단');
            return NextResponse.json({ success: true, message: '이미 이번 주 주급이 지급되었습니다.', skipped: true });
        }

        // 2. 방학 중인 학급 ID 목록 조회
        const { data: vacationClasses } = await supabase
            .from('classes')
            .select('id')
            .eq('is_on_vacation', true);
        const vacationClassIds = new Set((vacationClasses || []).map((c: any) => c.id));

        // 3. 주급(allowance)이 설정된 모든 학생 조회
        const { data: students, error: rosterError } = await supabase
            .from('student_roster')
            .select('id, name, number, balance, allowance, class_id')
            .gt('allowance', 0);

        if (rosterError) throw rosterError;

        if (!students || students.length === 0) {
            return NextResponse.json({
                success: true,
                message: '주급이 설정된 학생이 없습니다.',
                distributed_to: 0
            });
        }

        // 4. 학생별로 잔액 업데이트 + 거래 기록 생성
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const transactions: any[] = [];
        let successCount = 0;
        let failCount = 0;
        let skippedVacation = 0;

        for (const student of students) {
            // 방학 중인 학급은 주급 지급 건너뜀
            if (vacationClassIds.has(student.class_id)) {
                skippedVacation++;
                continue;
            }
            try {
                const currentBalance = student.balance || 0;
                const newBalance = currentBalance + student.allowance;

                // 잔액 업데이트
                const { error: updateError } = await supabase
                    .from('student_roster')
                    .update({ balance: newBalance })
                    .eq('id', student.id);

                if (updateError) {
                    console.error(`주급 지급 실패 - ${student.name}(${student.number}번):`, updateError);
                    failCount++;
                    continue;
                }

                // 거래 기록 준비
                transactions.push({
                    student_id: student.id,
                    amount: student.allowance,
                    type: 'allowance',
                    description: `주급 지급 (${dateStr})`
                });

                successCount++;
                console.log(`주급 지급 완료: ${student.name}(${student.number}번) - ${student.allowance}원 (${currentBalance} → ${newBalance})`);
            } catch (err: any) {
                console.error(`주급 처리 에러 - ${student.name}:`, err);
                failCount++;
            }
        }

        // 5. 거래 기록 일괄 삽입
        if (transactions.length > 0) {
            const { error: insertError } = await supabase
                .from('transactions')
                .insert(transactions);

            if (insertError) {
                console.error('주급 거래 기록 삽입 실패:', insertError);
                // 잔액은 이미 업데이트했으므로 로그 실패만 기록
            }
        }

        return NextResponse.json({
            success: true,
            distributed_to: successCount,
            failed: failCount,
            skipped_vacation: skippedVacation,
            message: `주급 지급 완료: ${successCount}명 성공${failCount > 0 ? `, ${failCount}명 실패` : ''}${skippedVacation > 0 ? `, ${skippedVacation}명 방학으로 건너뜀` : ''}`
        });

    } catch (error: any) {
        console.error('주급 자동 지급 크론잡 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
