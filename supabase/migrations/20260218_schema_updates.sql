-- 1. Transactions 테이블 재생성 (오류 해결)
DROP TABLE IF EXISTS transactions;
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES student_roster(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    type VARCHAR NOT NULL, -- 'allowance', 'fine', 'transfer', 'deposit', 'withdraw'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 2. Student Roster에 Password 추가
ALTER TABLE student_roster ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '1234';

-- 3. Bank Accounts 테이블 생성 (저축 기능)
CREATE TABLE IF NOT EXISTS bank_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES student_roster(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL, -- 예금 원금
    interest_rate FLOAT DEFAULT 0.01, -- 이자율 (1%)
    locked_until TIMESTAMP WITH TIME ZONE NOT NULL, -- 출금 가능 시각 (2주 후)
    status VARCHAR DEFAULT 'active', -- active, withdrawn
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    withdrawn_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

-- RLS 정책: Teacher는 모든 데이터를 볼 수 있어야 함.
-- Student는 Auth가 없으므로 API 레벨에서 처리하거나 Public 정책 필요 (일단 Teacher 위주 설정)
CREATE POLICY "Teachers can view transactions of their students" 
ON transactions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_roster 
        WHERE student_roster.id = transactions.student_id 
        AND student_roster.teacher_id = auth.uid()
    )
);

CREATE POLICY "Teachers can view bank accounts of their students" 
ON bank_accounts FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM student_roster 
        WHERE student_roster.id = bank_accounts.student_id 
        AND student_roster.teacher_id = auth.uid()
    )
);

CREATE POLICY "Teachers can insert transactions" 
ON transactions FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM student_roster 
        WHERE student_roster.id = transactions.student_id 
        AND student_roster.teacher_id = auth.uid()
    )
);
