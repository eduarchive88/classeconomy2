-- teacher_settings 테이블 생성
CREATE TABLE IF NOT EXISTS teacher_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_ai_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(teacher_id)
);

-- RLS 정책 설정
ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;

-- 교사는 자신의 설정만 읽기 가능
CREATE POLICY "Teachers can read own settings"
  ON teacher_settings
  FOR SELECT
  USING (auth.uid() = teacher_id);

-- 교사는 자신의 설정만 삽입 가능
CREATE POLICY "Teachers can insert own settings"
  ON teacher_settings
  FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

-- 교사는 자신의 설정만 업데이트 가능
CREATE POLICY "Teachers can update own settings"
  ON teacher_settings
  FOR UPDATE
  USING (auth.uid() = teacher_id);
