
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const supabase = createClient();

    if (!classId) return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 모둠 목록 및 멤버 정보 가져오기
    const { data: groups, error } = await supabase
        .from('groups')
        .select(`
            *,
            group_members (
                student_id
            )
        `)
        .eq('class_id', classId)
        .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ groups });
}

export async function POST(request: Request) {
    const { classId, groups } = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 복잡한 트랜잭션 처리를 위해 순차적으로 처리 (Supabase는 단일 요청 트랜잭션을 지원하지 않으므로 주의)
        for (const group of groups) {
            const { id, name, leader_id, memberIds, group_members } = group;

            // 1. 모둠 생성 또는 업데이트
            const payload: any = {
                class_id: classId,
                name,
                leader_id: leader_id || null
            };
            if (id && !id.startsWith('temp-')) {
                payload.id = id;
            }

            const { data: savedGroup, error: groupError } = await supabase
                .from('groups')
                .upsert(payload)
                .select()
                .single();

            if (groupError) throw groupError;

            // 2. 기존 멤버 삭제 및 새 멤버 추가
            const finalMemberIds = memberIds !== undefined
                ? memberIds
                : (group_members?.map((m: any) => m.student_id) || []);

            await supabase.from('group_members').delete().eq('group_id', savedGroup.id);

            if (finalMemberIds.length > 0) {
                const memberData = finalMemberIds.map((studentId: string) => ({
                    group_id: savedGroup.id,
                    student_id: studentId
                }));
                const { error: memberError } = await supabase.from('group_members').insert(memberData);
                if (memberError) throw memberError;
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

export async function DELETE(request: Request) {
    const { groupId } = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { error } = await supabase
        .from('groups')
        .delete()
        .eq('id', groupId);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
}
