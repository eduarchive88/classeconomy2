import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';
import { getStudentFromAuth } from '@/utils/student-auth';

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const requestStudentId = url.searchParams.get('studentId');

        // 인증 확인
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        let rosterId = requestStudentId;

        // 쿠키 로그인이 있는 경우 검증
        if (user) {
            try {
                const studentInfo = await getStudentFromAuth(supabase, user);
                // 요청한 studentId와 현재 로그인된 studentId가 다르면 본인 데이터만 조회하도록 강제 (보안)
                if (rosterId && rosterId !== studentInfo.rosterId) {
                    rosterId = studentInfo.rosterId;
                } else if (!rosterId) {
                    rosterId = studentInfo.rosterId;
                }
            } catch (e) {
                // 쿠키 기반 인증 실패 시, 헤더/쿼리로 넘어온 studentId를 신뢰 (Fallback)
                console.log('Cookie auth failed in dashboard summary, using param:', rosterId);
            }
        }

        // x-student-id 헤더로 넘어온 경우
        const headerStudentId = request.headers.get('x-student-id');
        if (!rosterId && headerStudentId) {
            rosterId = headerStudentId;
        }

        if (!rosterId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const adminSupabase = createAdminClient();

        // 저축 총액 조회 (RLS 우회)
        const { data: accounts, error } = await adminSupabase
            .from('bank_accounts')
            .select('amount')
            .eq('student_id', rosterId)
            .eq('type', 'savings')
            .eq('status', 'active');

        if (error) {
            throw error;
        }

        const totalSavings = accounts?.reduce((sum: number, acc: any) => sum + (acc.amount || 0), 0) || 0;

        return NextResponse.json({ totalSavings });
    } catch (error: any) {
        console.error('Dashboard summary fetch error:', error);
        return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
    }
}
