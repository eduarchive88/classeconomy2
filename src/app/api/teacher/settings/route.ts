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
        .select('google_ai_api_key, investment_price_mode')
        .eq('teacher_id', user.id)
        .maybeSingle();

    if (error) {
        console.error('Settings fetch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
        google_ai_api_key: settings?.google_ai_api_key || null,
        investment_price_mode: settings?.investment_price_mode || 'realtime'
    });
}

export async function POST(request: Request) {
    const supabase = createClient();
    const { google_ai_api_key, investment_price_mode } = await request.json();

    // 현재 로그인한 사용자 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 설정 저장 객체 (API 키가 제공된 경우에만 업데이트하거나, 빈 문자열이면 지움. 프론트엔드에서 둘 다 보낸다고 가정)
    const updatePayload: any = {
        teacher_id: user.id,
        updated_at: new Date().toISOString()
    };
    if (google_ai_api_key !== undefined) updatePayload.google_ai_api_key = google_ai_api_key;
    if (investment_price_mode !== undefined) updatePayload.investment_price_mode = investment_price_mode;

    // API 키 저장 또는 업데이트 (upsert)
    const { error } = await supabase
        .from('teacher_settings')
        .upsert(updatePayload, {
            onConflict: 'teacher_id'
        });

    if (error) {
        console.error('Settings save error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: '설정이 저장되었습니다.' });
}
