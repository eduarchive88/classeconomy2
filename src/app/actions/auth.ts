
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

        // 2. 기존 교사 데이터 자동 매핑 (DB 마이그레이션 후 auth 재생성 대응)
        // economy.profiles 테이블에서 동일 이메일의 기존 교사 ID(UUID)를 찾아서
        // classes, teacher_settings 등의 teacher_id를 새 UUID로 업데이트
        if (data?.user) {
            const newUserId = data.user.id
            try {
                // profiles 테이블에서 동일 이메일의 이전 교사 정보 조회
                const { data: oldProfile } = await supabaseAdmin
                    .from('profiles')
                    .select('id, email')
                    .eq('email', email)
                    .single()

                if (oldProfile && oldProfile.id !== newUserId) {
                    const oldUserId = oldProfile.id
                    console.log(`교사 계정 매핑: ${email} | 이전 ID: ${oldUserId} → 새 ID: ${newUserId}`)

                    // classes 테이블의 teacher_id 업데이트
                    await supabaseAdmin
                        .from('classes')
                        .update({ teacher_id: newUserId })
                        .eq('teacher_id', oldUserId)

                    // teacher_settings 테이블의 teacher_id 업데이트
                    await supabaseAdmin
                        .from('teacher_settings')
                        .update({ teacher_id: newUserId })
                        .eq('teacher_id', oldUserId)

                    // profiles 테이블의 id를 새 UUID로 업데이트
                    await supabaseAdmin
                        .from('profiles')
                        .update({ id: newUserId })
                        .eq('id', oldUserId)

                    console.log(`교사 데이터 매핑 완료: ${email}`)
                } else if (!oldProfile) {
                    // 프로필이 없으면 새로 생성
                    await supabaseAdmin
                        .from('profiles')
                        .upsert({
                            id: newUserId,
                            email: email,
                            name: name,
                            role: 'teacher'
                        })
                    console.log(`새 교사 프로필 생성: ${email}`)
                }
            } catch (mappingErr: any) {
                // 매핑 실패해도 회원가입 자체는 성공으로 처리
                console.error('교사 데이터 매핑 오류 (무시됨):', mappingErr.message)
            }
        }

        return {
            success: true,
            message: '회원가입 완료! 이제 바로 로그인하실 수 있습니다.'
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
