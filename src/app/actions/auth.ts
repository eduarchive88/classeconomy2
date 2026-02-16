
'use server'

import { supabaseAdmin } from '@/lib/supabase-admin'

export async function adminSignUp(formData: { email: string; password: string; name: string }) {
    const { email, password, name } = formData

    try {
        // 1. 관리자 권한으로 사용자 생성 및 자동 인증 처리
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // 이메일 인증 우회 핵심 옵션
            user_metadata: {
                role: 'teacher',
                name: name,
            }
        })

        if (error) {
            return { success: false, error: error.message }
        }

        return {
            success: true,
            message: '회원가입 완료! 이제 바로 로그인하실 수 있습니다.'
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
