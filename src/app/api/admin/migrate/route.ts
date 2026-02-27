import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const supabase = createAdminClient();

        // 1. teacher_settings 에 investment_price_mode 컬럼 추가
        // 존재하지 않을 경우 에러를 반환하는 방식으로 체크 후 추가할 수 있지만 
        // Supabase Postgres 에서는 RPC 또는 SQL 로 추가해야 합니다.
        // 임시로 RPC가 없다면, 다른 방식으로 처리해야 할 수 있습니다. 
        // 일단 market_data 테이블에 데이터 삽입 시도로 테이블 확인을 해보겠습니다.

        const { error: mdError } = await supabase.from('market_data').select('*').limit(1);

        const { error: tsError } = await supabase.from('teacher_settings').select('investment_price_mode').limit(1);

        return NextResponse.json({
            mdError: mdError ? mdError.message : 'success',
            tsError: tsError ? tsError.message : 'success'
        });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
