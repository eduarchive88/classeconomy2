-- 방학 모드: classes 테이블에 is_on_vacation 컬럼 추가
-- 방학 중이면 주급 지급 및 데일리 퀴즈 배포가 중단됩니다.

ALTER TABLE classes
  ADD COLUMN IF NOT EXISTS is_on_vacation BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN classes.is_on_vacation IS '방학 여부: true이면 주급 지급 및 데일리 퀴즈 배포가 중단됩니다.';
