import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient();

    // 현재 로그인한 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 교사 설정 조회
    const { data: settings, error } = await supabase
        .from('teacher_settings')
        .select('google_ai_api_key')
        .eq('teacher_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Settings fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        google_ai_api_key: settings?.google_ai_api_key || null
    });
}

export async function POST(request: Request) {
    const supabase = createClient();
    const { google_ai_api_key } = await request.json();

    // 현재 로그인한 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // API 키 저장 또는 업데이트 (upsert)
    const { error } = await supabase
        .from('teacher_settings')
        .upsert({
            teacher_id: user.id,
            google_ai_api_key,
            updated_at: new Date().toISOString()
        }, {
            onConflict: 'teacher_id'
        });

    if (error) {
        console.error('Settings save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'API 키가 저장되었습니다.' });
}
