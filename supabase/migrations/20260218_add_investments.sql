-- Investments 테이블 생성 (주식/코인 보유 현황)
CREATE TABLE IF NOT EXISTS investments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES student_roster(id) ON DELETE CASCADE,
    symbol VARCHAR NOT NULL, -- AAPL, BTC-USD, etc.
    quantity FLOAT NOT NULL DEFAULT 0,
    average_price FLOAT NOT NULL DEFAULT 0, -- 평단가
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, symbol)
);

ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- RLS 정책
CREATE POLICY "Teachers can view investments of their students" 
ON investments FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_roster 
        WHERE student_roster.id = investments.student_id 
        AND student_roster.teacher_id = auth.uid()
    )
);

-- 학생은 API를 통해 접근하므로 별도 정책 불필요하거나, 
-- 추후 Auth 적용 시 본인 데이터 접근 정책 필요.
-- 현재 구조상 Teacher 위주 RLS만 적용하고 API는 Service Role이나 로직으로 처리 가정.
