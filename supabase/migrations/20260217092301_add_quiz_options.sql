-- 1. Add options column to quizzes table
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS options JSONB;

-- 2. Add real estate settings to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_auto_real_estate BOOLEAN DEFAULT FALSE;

-- 3. Update seats table for ownership and pricing
ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES student_roster(id),
ADD COLUMN IF NOT EXISTS price INTEGER,
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'available';

-- 4. Create seat_trades table for approval flow
CREATE TABLE IF NOT EXISTS seat_trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    seat_id UUID REFERENCES seats(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES student_roster(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES student_roster(id) ON DELETE CASCADE,
    price INTEGER NOT NULL,
    status VARCHAR DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Add RLS for seat_trades
ALTER TABLE seat_trades ENABLE ROW LEVEL SECURITY;

-- If policies already exist, they will fail, so we skip for now or use drop if exists.
-- But since this is a new table, it's fine.
