
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // 구체적인 누락 항목을 알려주도록 변경
    if (!supabaseUrl) {
        throw new Error('환경 변수 NEXT_PUBLIC_SUPABASE_URL이 누락되었습니다.')
    }
    if (!supabaseServiceRoleKey) {
        throw new Error('환경 변수 SUPABASE_SERVICE_ROLE_KEY가 누락되었습니다.')
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        },
        db: {
            schema: 'economy'
        }
    })
}

// 필요할 때만 클라이언트를 생성하도록 변경
export const supabaseAdmin = {
    get auth() {
        return getSupabaseAdmin().auth
    },
    // DB 테이블 접근을 위한 from 메서드 노출 (교사 데이터 매핑에 사용)
    from(table: string) {
        return getSupabaseAdmin().from(table)
    }
}

