
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
        // 1. 주급(allowance)이 설정된 모든 학생 조회
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

        // 2. 학생별로 잔액 업데이트 + 거래 기록 생성
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
        const transactions: any[] = [];
        let successCount = 0;
        let failCount = 0;

        for (const student of students) {
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

        // 3. 거래 기록 일괄 삽입
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
            message: `주급 지급 완료: ${successCount}명 성공${failCount > 0 ? `, ${failCount}명 실패` : ''}`
        });

    } catch (error: any) {
        console.error('주급 자동 지급 크론잡 에러:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
