const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

// 1. 기존 Vercel 배포용 Supabase 환경 변수 (원본)
const SOURCE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; // 기존 wahsim... URL
const SOURCE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서비스 롤 키 또는 Anon 키
const sourceSupabase = createClient(SOURCE_URL, SOURCE_KEY);

// 2. 새로운 Coolify 배포용 PostgreSQL 환경 변수 (대상)
// 대상 DB 접속 URL (사용자가 직접 입력해야 함)
const DESTINATION_DB_URL = process.env.DESTINATION_DB_URL || 'postgresql://postgres:user_password@db_ip:54322/postgres';

const destPgClient = new Client({
    connectionString: DESTINATION_DB_URL,
});

async function migrate() {
    console.log('--- 마이그레이션 스크립트 시작 ---');
    console.log('원본 DB:', SOURCE_URL);
    console.log('대상 DB:', DESTINATION_DB_URL);

    if (DESTINATION_DB_URL.includes('user_password')) {
        console.error('ERROR: DESTINATION_DB_URL 환경 변수가 올바르게 설정되지 않았습니다.');
        console.error('Coolify DB 접속 정보를 확인 후 다시 실행해주세요.');
        process.exit(1);
    }

    try {
        await destPgClient.connect();
        console.log('대상 DB 연결 성공!');

        // 1. 스키마 생성 및 설정
        await destPgClient.query('CREATE SCHEMA IF NOT EXISTS economy;');
        await destPgClient.query('SET search_path TO economy, public;');
        console.log('economy 스키마 설정 완료.');

        // 테이블 목록 (마이그레이션이 필요한 테이블 명시)
        const tablesToMigrate = [
            'profiles',
            'classes',
            'student_roster',
            'seats',
            'teacher_settings',
            'quizzes',
            'daily_quizzes',
            'quiz_submissions',
            'products',
            'market_items',
            'bank_accounts',
            'transactions',
            'investments',
            'assets',
            'groups',
            'group_members'
        ];

        for (const tableName of tablesToMigrate) {
            console.log(`\n[테이블 처리 중]: ${tableName}`);
            
            // 기존 Supabase에서 데이터 가져오기 (전체 데이터)
            // 주의: 데이터가 매우 많을 경우 페이지네이션이 필요할 수 있습니다.
            const { data, error } = await sourceSupabase.from(tableName).select('*');
            
            if (error) {
                console.error(`테이블 ${tableName} 데이터 로드 실패:`, error.message);
                continue;
            }

            if (!data || data.length === 0) {
                console.log(`- 데이터 없음. 스킵.`);
                continue;
            }

            console.log(`- ${data.length} 건의 레코드 발견. 이전 준비 중...`);

            // 데이터 입력을 위한 동적 쿼리 생성
            const keys = Object.keys(data[0]);
            
            // 테이블이 대상 DB에 없을 경우 자동 생성 (간단한 버전 - 실제로는 정확한 타입의 DDL이 필요함)
            // *이 스크립트를 실행하기 전에 대상 DB에 미리 DDL 쿼리가 실행되어 있어야 가장 안전합니다.*
            
            // 레코드 하나씩 삽입 (효율성을 위해 트랜잭션 또는 BULK INSERT 필요할 수 있음)
            for (const row of data) {
                const values = keys.map(k => row[k]);
                const params = keys.map((_, i) => `$${i + 1}`).join(', ');
                const columns = keys.map(k => `"${k}"`).join(', ');

                const query = `
                    INSERT INTO economy."${tableName}" (${columns}) 
                    VALUES (${params})
                    ON CONFLICT DO NOTHING
                `;

                try {
                    await destPgClient.query(query, values);
                } catch (insertError) {
                    console.error(`- 데이터 삽입 오류 [${tableName}]:`, insertError.message);
                }
            }
            console.log(`- [완료] ${tableName} 데이터 복사됨.`);
        }

        console.log('\n--- 마이그레이션 스크립트 완료 ---');

    } catch (err) {
        console.error('마이그레이션 도중 에러 발생:', err);
    } finally {
        await destPgClient.end();
        console.log('데이터베이스 연결 종료.');
    }
}

migrate();
