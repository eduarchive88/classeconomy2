
import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const supabase = createClient();

    if (!classId) return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 모둠 자리 정보와 클래스 설정 가져오기
    const { data: classData, error: classError } = await supabase
        .from('classes')
        .select('group_rows, group_cols, is_auto_group_seat')
        .eq('id', classId)
        .single();

    if (classError) return NextResponse.json({ error: classError.message }, { status: 400 });

    const { data: seats, error: seatsError } = await supabase
        .from('group_seats')
        .select('*')
        .eq('class_id', classId);

    if (seatsError) return NextResponse.json({ error: seatsError.message }, { status: 400 });

    return NextResponse.json({
        groupRows: classData.group_rows,
        groupCols: classData.group_cols,
        isAutoGroupSeat: classData.is_auto_group_seat,
        seats
    });
}

export async function POST(request: Request) {
    const { classId, groupRows, groupCols, isAutoGroupSeat, seats } = await request.json();
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        // 1. 클래스 설정 업데이트 (행/열, 자동 승인)
        const classUpdateData: any = {};
        if (groupRows !== undefined) classUpdateData.group_rows = groupRows;
        if (groupCols !== undefined) classUpdateData.group_cols = groupCols;
        if (isAutoGroupSeat !== undefined) classUpdateData.is_auto_group_seat = isAutoGroupSeat;

        if (Object.keys(classUpdateData).length > 0) {
            const { error: classError } = await supabase
                .from('classes')
                .update(classUpdateData)
                .eq('id', classId);
            if (classError) throw classError;
        }

        // 2. 자리 개별 정보 업데이트 (Upsert)
        if (seats && seats.length > 0) {
            const seatData = seats.map((s: any) => {
                const data: any = {
                    class_id: classId,
                    row_idx: s.row_idx,
                    col_idx: s.col_idx
                };
                if (s.price !== undefined) data.price = s.price;
                if (s.group_id !== undefined) data.group_id = s.group_id;
                if (s.is_locked !== undefined) data.is_locked = s.is_locked;
                if (s.id) data.id = s.id;
                return data;
            });
            const { error: seatsError } = await supabase
                .from('group_seats')
                .upsert(seatData, { onConflict: 'class_id, row_idx, col_idx' });
            if (seatsError) throw seatsError;
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
