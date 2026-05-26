/**
 * 공통 교사 인증 유틸리티
 * user_metadata.role 대신 DB의 classes 테이블 teacher_id 기반으로 교사 여부를 판별합니다.
 * 일부 교사 계정에서 user_metadata가 누락되는 버그를 방지합니다.
 */

import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';

export interface TeacherAuthResult {
    ok: boolean;
    user?: any;
    errorResponse?: ReturnType<typeof NextResponse.json>;
}

/**
 * 현재 로그인한 사용자가 교사인지 DB 기반으로 검증합니다.
 * @param supabase 세션이 담긴 Supabase 클라이언트 (createClient()로 생성)
 * @returns TeacherAuthResult - ok: true 시 user 포함
 */
export async function verifyTeacher(supabase: SupabaseClient): Promise<TeacherAuthResult> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return {
            ok: false,
            errorResponse: NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
        };
    }

    const adminSupabase = createAdminClient();

    // DB 기반 교사 여부 확인: classes 테이블에서 teacher_id로 검색
    const { data: teacherClass, error: classCheckError } = await adminSupabase
        .from('classes')
        .select('id')
        .eq('teacher_id', user.id)
        .limit(1)
        .maybeSingle();

    if (classCheckError || !teacherClass) {
        console.warn(`[verifyTeacher] Not a teacher or no class: user=${user.id} (${user.email})`);
        return {
            ok: false,
            errorResponse: NextResponse.json(
                { error: 'Unauthorized: 교사 계정이 아니거나 담당 학급이 없습니다.' },
                { status: 401 }
            )
        };
    }

    return { ok: true, user };
}
