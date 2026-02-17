
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
    const supabase = createClient();

    // 1. Get Classes Schema/Data
    const { data: classes, error: classesError } = await supabase
        .from('classes')
        .select('*')
        .limit(5);

    // 2. Get Student Roster Schema/Data
    const { data: roster, error: rosterError } = await supabase
        .from('student_roster')
        .select('*')
        .limit(5);

    // 3. Check for specific session code issues (whitespace)
    const { data: sessionCodeCheck } = await supabase.rpc('check_session_code_whitespace');
    // Creating RPC might be too much, just select raw

    return NextResponse.json({
        classes: { data: classes, error: classesError },
        roster: { data: roster, error: rosterError },
        timestamp: new Date().toISOString()
    });
}
