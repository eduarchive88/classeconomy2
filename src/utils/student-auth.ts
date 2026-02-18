
import { SupabaseClient } from '@supabase/supabase-js';

export async function getStudentFromAuth(supabase: SupabaseClient, user: any) {
    // 0. If teacher, don't try to be a student
    if (user.user_metadata?.role === 'teacher') {
        return { rosterId: null, classId: null };
    }

    // 1. Try metadata first (fastest) - Support both snake_case and camelCase for compatibility
    let rosterId = user.user_metadata?.roster_id || user.user_metadata?.rosterId;
    let classId = user.user_metadata?.class_id || user.user_metadata?.classId;

    if (rosterId && classId) return { rosterId, classId };

    // Fallback logic
    const email = user.email || '';
    // Extract session code: handle formats like "class1_student@..." or just "class1@..."
    const sessionCode = email.split('@')[0].split('_')[0];
    const { data: cls } = await supabase.from('classes').select('id').ilike('session_code', sessionCode).maybeSingle();

    if (cls) {
        classId = cls.id;
        const { data: r } = await supabase.from('student_roster')
            .select('id')
            .eq('class_id', cls.id)
            .eq('name', user.user_metadata.name)
            .maybeSingle(); // Use maybeSingle to avoid error if not found

        if (r) rosterId = r.id;
    }

    return { rosterId, classId };
}
