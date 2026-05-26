import { createClient, createAdminClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
    const body = await request.json();
    const sessionCode = body.sessionCode?.trim();
    const studentId = body.studentId;
    const password = body.password;
    const supabase = createClient();

    // 1. 세션코드로 학급 찾기 (유연한 비교를 위해 전체 조회 후 정규화 매칭)
    const { data: allClasses, error: classError } = await supabase
        .from('classes')
        .select('id, name, session_code');

    if (classError || !allClasses) {
        return NextResponse.json({ error: '학급 정보를 불러올 수 없습니다.' }, { status: 500 });
    }

    // 공백, 하이픈, 언더바 등 제거 후 소문자로 비교
    const normalizeCode = (code: string) => code ? code.replace(/[\s\-_\W]/g, '').toLowerCase() : '';
    const targetSessionCode = normalizeCode(sessionCode);

    const classData = allClasses.find((c: any) => normalizeCode(c.session_code) === targetSessionCode);

    if (!classData) {
        console.warn(`Login failed: Invalid session code '${sessionCode}'`);
        return NextResponse.json({ error: '유효하지 않은 세션코드입니다.' }, { status: 400 });
    }

    // 2. 학번 파싱 (형식: 5자리 숫자 GCCNN, 예: 20201 = 2학년 02반 01번)
    if (!/^\d{5}$/.test(studentId)) {
        return NextResponse.json({ error: '학번은 5자리 숫자여야 합니다. (예: 20201 = 2학년 2반 1번)' }, { status: 400 });
    }

    // DB 컬럼이 text 타입이므로 문자열로 비교 (앞자리 0 제거)
    const grade = String(parseInt(studentId.charAt(0))); // "2"
    const classInfo = String(parseInt(studentId.substring(1, 3))); // "2" (02 → 2)
    const number = String(parseInt(studentId.substring(3, 5))); // "1" (01 → 1)

    console.log(`Student login attempt: grade=${grade}, class_info=${classInfo}, number=${number}, class_id=${classData.id}`);

    // 3. 학생 찾기 (로스터 전체 조회 후 필터링 - "02" vs "2" 등의 포맷 불일치 해결을 위해)
    const { data: roster, error: rosterError } = await supabase
        .from('student_roster')
        .select('id, name, grade, class_info, number, balance, password')
        .eq('class_id', classData.id);

    if (rosterError || !roster) {
        console.error('Login Error: Failed to fetch roster', rosterError);
        return NextResponse.json({ error: '학급 명단을 불러올 수 없습니다.' }, { status: 500 });
    }

    // JS에서 유연하게 비교 (모두 문자열로 변환하여 앞자리 0 제거 후 비교)
    const normalize = (val: any) => String(val).replace(/^0+/, '');

    const targetGrade = normalize(grade);
    const targetClassInfo = normalize(classInfo);
    const targetNumber = normalize(number);

    const student = roster.find((s: any) =>
        normalize(s.grade) === targetGrade &&
        normalize(s.class_info) === targetClassInfo &&
        normalize(s.number) === targetNumber
    );

    if (!student) {
        console.log(`Student not found in roster. Parsed: ${targetGrade}-${targetClassInfo}-${targetNumber}, ClassId: ${classData.id}`);
        return NextResponse.json({ error: '해당 학번의 학생 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 비밀번호 검증
    // DB에 비밀번호가 없으면(null/empty) 초기 비밀번호 '1234'로 간주
    const dbPassword = student.password || '1234';
    if (String(dbPassword) !== String(password)) { // Ensure string comparison
        return NextResponse.json({ error: '비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 4. Supabase Auth 세션 생성 (다른 API와의 호환성을 위해)
    const fakeEmail = `${sessionCode}_${studentId}@student.local`.toLowerCase();
    const authPassword = `pwd_${sessionCode}_${studentId}`; // 가상 계정용 고정 비밀번호

    // 먼저 로그인 시도 (기존 계정 존재 시 빠르게 처리)
    let authData: any = null;
    const { data: signInFirst, error: signInFirstError } = await supabase.auth.signInWithPassword({
        email: fakeEmail,
        password: authPassword,
    });

    if (!signInFirstError && signInFirst?.session) {
        // 기존 계정 로그인 성공 → 메타데이터 최신화만 비동기로 수행 (응답 속도 영향 없음)
        authData = signInFirst;
        // 메타데이터가 오래된 경우 백그라운드에서 갱신
        createAdminClient().auth.admin.updateUserById(signInFirst.user!.id, {
            user_metadata: {
                role: 'student',
                roster_id: student.id,
                class_id: classData.id,
                name: student.name,
                student_id: studentId
            }
        }).catch(e => console.warn('[login] metadata update failed (non-critical):', e.message));
    } else {
        // 계정이 없는 경우: admin.createUser로 한 번에 계정 생성 + 이메일 확인 우회
        const adminSupabase = createAdminClient();
        const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
            email: fakeEmail,
            password: authPassword,
            email_confirm: true, // 이메일 확인 우회 - 즐시 로그인 가능
            user_metadata: {
                role: 'student',
                roster_id: student.id,
                class_id: classData.id,
                name: student.name,
                student_id: studentId
            }
        });

        if (createError) {
            console.error('[login] createUser failed:', createError.message);
            // 생성 실패 시 fallback: 기존 signUp 방식 시도
            await supabase.auth.signUp({
                email: fakeEmail,
                password: authPassword,
                options: { data: { role: 'student', roster_id: student.id, class_id: classData.id, name: student.name, student_id: studentId } }
            });
        }

        // 생성 후 로그인 1회만 수행
        const { data: finalSignIn, error: finalSignInError } = await supabase.auth.signInWithPassword({
            email: fakeEmail,
            password: authPassword,
        });

        if (finalSignInError || !finalSignIn?.session) {
            console.error('[login] signIn after createUser failed:', finalSignInError?.message);
            // 로그인 실패해도 학생 정보는 반환 (제한적 서비스 가능)
            return NextResponse.json({
                success: true,
                session: null,
                student: {
                    id: student.id,
                    name: student.name,
                    grade: student.grade,
                    class_info: student.class_info,
                    number: student.number,
                    balance: student.balance || 0,
                    class_id: classData.id,
                    class_name: classData.name,
                },
                message: '로그인 성공 (세션 제한적)'
            });
        }

        authData = finalSignIn;
    }

    // 5. 세션 정보를 로컬스토리지에 저장하도록 클라이언트에 반환
    return NextResponse.json({
        success: true,
        session: authData.session, // 세션 객체 직접 전달
        student: {
            id: student.id,
            name: student.name,
            grade: student.grade,
            class_info: student.class_info,
            number: student.number,
            balance: student.balance || 0,
            class_id: classData.id,
            class_name: classData.name,
        },
        message: '로그인 성공'
    });
}
