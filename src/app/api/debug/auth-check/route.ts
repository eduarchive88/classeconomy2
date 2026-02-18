import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const supabase = createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    const cookieNames = ['sb-access-token', 'sb-refresh-token', 'supabase-auth-token'];
    // Actual cookie names might vary by Supabase version/config

    return NextResponse.json({
        user: user ? {
            id: user.id,
            email: user.email,
            role: user.user_metadata?.role,
            metadata: user.user_metadata
        } : null,
        session: session ? {
            expires_at: session.expires_at,
            user_id: session.user?.id
        } : null,
        errors: {
            user: userError?.message,
            session: sessionError?.message
        },
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'Server'
    });
}
