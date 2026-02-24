import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const classId = user.user_metadata.class_id;
        const supabaseAdmin = createAdminClient();

        // 1. Get student roster info
        const { data: rosterData, error: rosterError } = await supabaseAdmin
            .from('student_roster')
            .select('*')
            .eq('profile_id', user.id)
            .single();

        if (rosterError || !rosterData) {
            return NextResponse.json({ error: 'Student not found in roster' }, { status: 404 });
        }

        // 2. Get seats for this class
        const { data: seatsData, error: seatsError } = await supabaseAdmin
            .from('seats')
            .select(`
                *,
                student:student_id(name, number)
            `)
            .eq('class_id', classId);

        if (seatsError) {
            return NextResponse.json({ error: seatsError.message }, { status: 500 });
        }

        return NextResponse.json({
            roster: rosterData,
            seats: seatsData || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
