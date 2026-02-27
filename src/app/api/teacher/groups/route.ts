
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
        // 1. 모든 모둠의 멤버 정보 업데이트를 위해 먼저 학급 내 모든 모둠 멤버십 초기화 고려
        // (단, 여기서는 요청된 groups 배열에 있는 모둠들에 대해서만 처리하므로, 
        // 학생이 다른 모둠에 중복 배정되는 것을 방지하기 위해 각 학생을 다른 모든 모둠에서 제거함)

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

            // 2. 입력된 멤버 목록 정리
            const finalMemberIds = memberIds !== undefined
                ? memberIds
                : (group_members?.map((m: any) => m.student_id) || []);

            // 3. 중복 배정 방지: 이 학생들을 학급 내 다른 모둠에서 제거
            if (finalMemberIds.length > 0) {
                // 이 학급의 모든 모둠 ID 가져오기
                const { data: classGroups } = await supabase
                    .from('groups')
                    .select('id')
                    .eq('class_id', classId);

                const classGroupIds = classGroups?.map((g: { id: string }) => g.id) || [];

                if (classGroupIds.length > 0) {
                    await supabase
                        .from('group_members')
                        .delete()
                        .in('group_id', classGroupIds)
                        .in('student_id', finalMemberIds);
                }
            }

            // 4. 현재 모둠의 기존 멤버 정보 삭제 (위에서 이미 처리되었을 수 있지만 안전을 위해)
            await supabase.from('group_members').delete().eq('group_id', savedGroup.id);

            // 5. 새 멤버 추가
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
