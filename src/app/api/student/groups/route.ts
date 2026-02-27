import { createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const studentId = request.headers.get('x-student-id');
    const classId = request.headers.get('x-class-id');

    if (!studentId || !classId) {
        return NextResponse.json({ error: 'Missing headers' }, { status: 400 });
    }

    const supabase = createAdminClient();

    try {
        // 1. Get group info
        const { data: memberData, error: memberError } = await supabase
            .from('group_members')
            .select(`
                group_id,
                groups (
                    id,
                    name,
                    leader_id,
                    balance
                )
            `)
            .eq('student_id', studentId)
            .maybeSingle(); // Use maybeSingle to avoid error if student has no group

        let group: any = null;

        if (memberData && memberData.groups) {
            const groupData = memberData.groups as any;

            // Get all members of this group
            const { data: allMembers } = await supabase
                .from('group_members')
                .select('student_id, students(nickname)')
                .eq('group_id', groupData.id);

            group = {
                id: groupData.id,
                name: groupData.name,
                leader_id: groupData.leader_id,
                balance: groupData.balance,
                members: (allMembers || []).map((m: any) => ({
                    student_id: m.student_id,
                    nickname: m.students?.nickname || '알 수 없음'
                }))
            };
        }

        // 2. Get class settings
        const { data: classData } = await supabase
            .from('classes')
            .select('group_rows, group_cols')
            .eq('id', classId)
            .single();

        const settings = {
            group_rows: classData?.group_rows || 4,
            group_cols: classData?.group_cols || 4
        };

        // 3. Get seats
        const { data: seatsData } = await supabase
            .from('group_seats')
            .select('*, groups(name)')
            .eq('class_id', classId);

        const seats = (seatsData || []).map((s: any) => ({
            ...s,
            group_name: s.groups?.name
        }));

        return NextResponse.json({ group, settings, seats });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
