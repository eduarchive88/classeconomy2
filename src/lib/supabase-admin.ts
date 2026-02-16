
import { createClient } from '@supabase/supabase-js'

const getSupabaseAdmin = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error('Supabase 설정이 누락되었습니다. (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)')
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}

// 필요할 때만 클라이언트를 생성하도록 변경
export const supabaseAdmin = {
    get auth() {
        return getSupabaseAdmin().auth
    }
}
