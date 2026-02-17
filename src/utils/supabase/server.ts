
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Supabase environment variables are missing');
        // throw new Error('Supabase environment variables are missing');
    }

    return createServerClient(
        supabaseUrl || '',
        supabaseKey || '',
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                    }
                },
            },
        }
    )
}

/**
 * RLS 정책을 우회하여 관리자 권한으로 작업을 수행하는 클라이언트
 * 유의: 반드시 서버 측 API 라우트에서만 사용해야 함
 */
export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error('Admin client failed: Service Role Key is missing');
    }

    return createServerClient(
        supabaseUrl || '',
        supabaseServiceKey || '',
        {
            cookies: {
                getAll() { return [] },
                setAll() { },
            },
        }
    );
}
