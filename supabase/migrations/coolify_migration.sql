-- 1. 신규 스키마 생성
CREATE SCHEMA IF NOT EXISTS economy;

-- 2. 검색 경로 설정 (앞으로 생성될 객체들은 economy 스키마에 생성됨)
SET search_path TO economy, public;

-- 3. 기존 테이블 및 구조 이전을 위한 테이블 목록 (이전 프로그램에서 추출된 목록 기반)
-- 주의: 이 스크립트는 Coolify PostgreSQL에서 실행되어야 합니다.

-- 예시: 테이블 이동 (만약 기존 public에 이미 테이블이 있는 경우)
/*
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' SET SCHEMA economy;';
    END LOOP;
END $$;
*/

-- 프로젝트 필수 테이블 생성 (Supabase 스키마 기반)
-- (실제 Supabase 가동 시에는 관리도구에서 직접 SQL을 실행하거나 pg_dump를 권장합니다.)

COMMENT ON SCHEMA economy IS 'Student Economy 프로젝트 전용 스키마';

-- RLS 정책 및 함수 이전 시 스키마 경로 주의 필요
-- 예: auth.uid() 함수 등은 public이나 auth 스키마에 이미 존재하므로 그대로 사용 가능.
