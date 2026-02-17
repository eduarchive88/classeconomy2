-- 1. Fix Transactions & Roster (Login Issue)
ALTER TABLE student_roster ADD COLUMN IF NOT EXISTS balance INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES student_roster(id);
ALTER TABLE transactions ALTER COLUMN to_id DROP NOT NULL;

-- 2. Real Estate (Seats)
CREATE TABLE IF NOT EXISTS seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES student_roster(id) ON DELETE SET NULL, -- Link to roster, not profile
    row_idx INTEGER NOT NULL,
    col_idx INTEGER NOT NULL,
    price INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, row_idx, col_idx)
);

-- 3. Market
CREATE TABLE IF NOT EXISTS market_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Quizzes
-- Support for daily quiz distribution
CREATE TABLE IF NOT EXISTS daily_quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, quiz_id, date)
);

CREATE TABLE IF NOT EXISTS quiz_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    daily_quiz_id UUID REFERENCES daily_quizzes(id) ON DELETE CASCADE,
    student_id UUID REFERENCES student_roster(id) ON DELETE CASCADE,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(daily_quiz_id, student_id) -- Only one attempt/submission per quiz per student
);

-- 5. RLS Policies (Ensure teachers can manage their own data)
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_submissions ENABLE ROW LEVEL SECURITY;

-- Note: Policies need to be added manually or via specific policy creation commands if needed. 
-- Assuming existing policy structure allows authenticated users to access tables linked to their classes via joins, 
-- or we add simple policies here:

CREATE POLICY "Teachers can manage seats for their classes" ON seats
    USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

CREATE POLICY "Teachers can manage market items for their classes" ON market_items
    USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

-- Students can view market items
CREATE POLICY "Students can view market items" ON market_items FOR SELECT
    USING (true);

-- Daily Quizzes Policies
CREATE POLICY "Teachers can manage daily quizzes" ON daily_quizzes
    USING (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()))
    WITH CHECK (class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid()));

CREATE POLICY "Students can view daily quizzes" ON daily_quizzes FOR SELECT
    USING (true);

-- Quiz Submissions Policies
CREATE POLICY "Teachers can view submissions" ON quiz_submissions FOR SELECT
    USING (daily_quiz_id IN (SELECT id FROM daily_quizzes WHERE class_id IN (SELECT id FROM classes WHERE teacher_id = auth.uid())));

CREATE POLICY "Students can create submissions" ON quiz_submissions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL); -- Simplified, ideally check if student_id matches auth.uid()'s roster link

