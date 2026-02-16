import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    // This is a placeholder for any daily maintenance tasks
    // like clearing old logs or pre-generating data.
    return NextResponse.json({ success: true, message: 'Daily quiz reset triggered' });
}
