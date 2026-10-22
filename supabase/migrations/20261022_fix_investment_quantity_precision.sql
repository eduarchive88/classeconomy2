-- ※ 테이블/함수 소유자(supabase_admin) 권한 필요: Supabase Studio SQL Editor에서 실행. (postgres 롤은 economy 스키마 DDL 불가)
-- 투자 보유량 부동소수 오차 근본 수정 (2026-10-22)
-- 문제: quantity(FLOAT8) 연산 오차로 전량 매도 후 2.22e-16주 같은 찌꺼기가 남아 화면에 이상한 수량이 표시되고 매도 불가
-- 해결: 모든 수량을 소수 8자리로 반올림해 저장, 0 이하가 되면 행 삭제, (student_id, symbol) 중복 금지
-- 한글 리터럴은 클라이언트 인코딩 깨짐 방지를 위해 U&'' 유니코드 이스케이프 사용

BEGIN;

-- 0. 백업
CREATE TABLE IF NOT EXISTS economy.investments_backup_20261022 AS SELECT * FROM economy.investments;

-- 1. 같은 학생·같은 종목 중복 행 병합 (가장 먼저 만든 행에 수량 합산, 가중평균 평단가)
WITH g AS (
    SELECT student_id, symbol,
           SUM(quantity) AS q,
           SUM(quantity * average_price) / NULLIF(SUM(quantity), 0) AS a,
           (ARRAY_AGG(id ORDER BY created_at))[1] AS keep_id
    FROM economy.investments
    GROUP BY student_id, symbol
    HAVING COUNT(*) > 1
)
UPDATE economy.investments i
SET quantity = g.q, average_price = COALESCE(g.a, i.average_price), updated_at = NOW()
FROM g WHERE i.id = g.keep_id;

DELETE FROM economy.investments i
USING (
    SELECT student_id, symbol, (ARRAY_AGG(id ORDER BY created_at))[1] AS keep_id
    FROM economy.investments GROUP BY student_id, symbol HAVING COUNT(*) > 1
) g
WHERE i.student_id = g.student_id AND i.symbol = g.symbol AND i.id <> g.keep_id;

-- 2. 찌꺼기(0.000001주 미만) 및 0주 행 삭제
DELETE FROM economy.investments WHERE quantity < 0.000001;

-- 3. 남은 수량 소수 8자리로 정규화
UPDATE economy.investments
SET quantity = ROUND(quantity::numeric, 8)
WHERE quantity <> ROUND(quantity::numeric, 8)::float8;

-- 4. 제약조건: 학생·종목당 1행, 음수 금지
ALTER TABLE economy.investments ADD CONSTRAINT investments_student_symbol_key UNIQUE (student_id, symbol);
ALTER TABLE economy.investments ADD CONSTRAINT investments_quantity_nonneg CHECK (quantity >= 0);

-- 5. 매수 RPC
CREATE OR REPLACE FUNCTION economy.process_investment_buy(p_student_id uuid, p_symbol text, p_quantity double precision, p_price double precision, p_stock_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
    v_qty numeric := ROUND(p_quantity::numeric, 8);
    v_balance bigint;
    v_cost bigint;
    v_total_qty numeric := 0;
    v_total_cost float8 := 0;
    v_keeper_id uuid;
    v_extra_ids uuid[] := ARRAY[]::uuid[];
    v_new_qty numeric;
    v_new_avg float8;
    v_row record;
BEGIN
    IF v_qty IS NULL OR v_qty <= 0 OR p_price IS NULL OR p_price <= 0 THEN
        RETURN jsonb_build_object('error', U&'\C62C\BC14\B974\C9C0 \C54A\C740 \C218\B7C9\C785\B2C8\B2E4.');
    END IF;
    v_cost := CEIL(p_price * v_qty::float8);

    SELECT balance INTO v_balance FROM economy.student_roster WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', U&'\D559\C0DD\C744 \CC3E\C744 \C218 \C5C6\C2B5\B2C8\B2E4.');
    END IF;
    IF v_balance < v_cost THEN
        RETURN jsonb_build_object('error', U&'\C794\C561\C774 \BD80\C871\D569\B2C8\B2E4.');
    END IF;

    FOR v_row IN
        SELECT id, quantity, average_price FROM economy.investments
        WHERE student_id = p_student_id AND symbol = p_symbol
        ORDER BY created_at ASC FOR UPDATE
    LOOP
        IF v_keeper_id IS NULL THEN v_keeper_id := v_row.id; ELSE v_extra_ids := array_append(v_extra_ids, v_row.id); END IF;
        v_total_qty := v_total_qty + v_row.quantity::numeric;
        v_total_cost := v_total_cost + v_row.average_price * v_row.quantity;
    END LOOP;

    v_new_qty := ROUND(v_total_qty + v_qty, 8);
    v_new_avg := CASE WHEN v_total_qty > 0 THEN (v_total_cost + p_price * v_qty::float8) / v_new_qty::float8 ELSE p_price END;

    UPDATE economy.student_roster SET balance = balance - v_cost WHERE id = p_student_id;

    IF v_keeper_id IS NOT NULL THEN
        IF array_length(v_extra_ids, 1) IS NOT NULL THEN
            DELETE FROM economy.investments WHERE id = ANY(v_extra_ids);
        END IF;
        UPDATE economy.investments SET quantity = v_new_qty, average_price = v_new_avg, updated_at = NOW() WHERE id = v_keeper_id;
    ELSE
        INSERT INTO economy.investments (student_id, symbol, quantity, average_price)
        VALUES (p_student_id, p_symbol, v_qty, p_price);
    END IF;

    INSERT INTO economy.transactions (student_id, type, amount, description)
    VALUES (p_student_id, 'investment_buy', -v_cost,
        p_stock_name || ' ' || RTRIM(RTRIM(v_qty::text, '0'), '.')
        || U&'\AC1C \B9E4\C218 (\B2E8\AC00: '
        || RTRIM(TO_CHAR(p_price::numeric, 'FM999,999,999,999,990.99'), '.') || U&'\C6D0)');

    RETURN jsonb_build_object('success', true);
END;
$function$;

-- 6. 매도 RPC
CREATE OR REPLACE FUNCTION economy.process_investment_sell(p_student_id uuid, p_symbol text, p_quantity double precision, p_price double precision, p_stock_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
    v_qty numeric := ROUND(p_quantity::numeric, 8);
    v_revenue bigint;
    v_total_qty numeric := 0;
    v_total_cost float8 := 0;
    v_keeper_id uuid;
    v_extra_ids uuid[] := ARRAY[]::uuid[];
    v_new_qty numeric;
    v_row record;
BEGIN
    IF v_qty IS NULL OR v_qty <= 0 OR p_price IS NULL OR p_price <= 0 THEN
        RETURN jsonb_build_object('error', U&'\C62C\BC14\B974\C9C0 \C54A\C740 \C218\B7C9\C785\B2C8\B2E4.');
    END IF;

    PERFORM 1 FROM economy.student_roster WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', U&'\D559\C0DD\C744 \CC3E\C744 \C218 \C5C6\C2B5\B2C8\B2E4.');
    END IF;

    FOR v_row IN
        SELECT id, quantity, average_price FROM economy.investments
        WHERE student_id = p_student_id AND symbol = p_symbol
        ORDER BY created_at ASC FOR UPDATE
    LOOP
        IF v_keeper_id IS NULL THEN v_keeper_id := v_row.id; ELSE v_extra_ids := array_append(v_extra_ids, v_row.id); END IF;
        v_total_qty := v_total_qty + v_row.quantity::numeric;
        v_total_cost := v_total_cost + v_row.average_price * v_row.quantity;
    END LOOP;
    v_total_qty := ROUND(v_total_qty, 8);

    IF v_keeper_id IS NULL OR v_total_qty < v_qty THEN
        RETURN jsonb_build_object('error', U&'\BCF4\C720 \C218\B7C9\C774 \BD80\C871\D569\B2C8\B2E4.');
    END IF;

    v_new_qty := v_total_qty - v_qty;
    v_revenue := FLOOR(p_price * v_qty::float8);

    IF array_length(v_extra_ids, 1) IS NOT NULL THEN
        DELETE FROM economy.investments WHERE id = ANY(v_extra_ids);
    END IF;
    IF v_new_qty <= 0 THEN
        DELETE FROM economy.investments WHERE id = v_keeper_id;
    ELSE
        UPDATE economy.investments
        SET quantity = v_new_qty, average_price = v_total_cost / v_total_qty::float8, updated_at = NOW()
        WHERE id = v_keeper_id;
    END IF;

    UPDATE economy.student_roster SET balance = balance + v_revenue WHERE id = p_student_id;

    INSERT INTO economy.transactions (student_id, type, amount, description)
    VALUES (p_student_id, 'investment_sell', v_revenue,
        p_stock_name || ' ' || RTRIM(RTRIM(v_qty::text, '0'), '.')
        || U&'\AC1C \B9E4\B3C4 (\B2E8\AC00: '
        || RTRIM(TO_CHAR(p_price::numeric, 'FM999,999,999,999,990.99'), '.') || U&'\C6D0)');

    RETURN jsonb_build_object('success', true);
END;
$function$;

-- 7. 과거 깨진 거래 설명 복원 (원래 수량은 저장되지 않아 금액÷단가로 추정 → '약' 표기)
UPDATE economy.transactions t
SET description = m[1] || U&' \C57D ' || RTRIM(RTRIM(ROUND(ABS(t.amount)::numeric / m[2]::numeric, 6)::text, '0'), '.')
    || CASE WHEN t.type = 'investment_buy' THEN U&'\AC1C \B9E4\C218 (\B2E8\AC00: ' ELSE U&'\AC1C \B9E4\B3C4 (\B2E8\AC00: ' END
    || RTRIM(TO_CHAR(m[2]::numeric, 'FM999,999,999,999,990.99'), '.') || U&'\C6D0)'
FROM (
    SELECT id, regexp_match(description, '^(.*) [0-9]+\? \?\? \(\?\?: ([0-9.]+)\?\)$') AS m
    FROM economy.transactions
    WHERE type IN ('investment_buy', 'investment_sell') AND description LIKE '%?%'
) x
WHERE t.id = x.id AND x.m IS NOT NULL AND x.m[2]::numeric > 0;

COMMIT;
