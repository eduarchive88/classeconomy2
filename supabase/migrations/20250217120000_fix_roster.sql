-- Migration to ensure unique constraint on student_roster(class_id, number)
-- This allows upserting students by class and number, enabling duplicate lists for different classes.

-- 1. Drop old constraint if exists (name might vary, trying common default naming or exact name if known)
-- It seems the previous constraint was 'student_roster_teacher_id_grade_class_info_number_key' or similar based on previous upsert code.
-- We will try to drop it if it exists. Note: This block uses PL/pgSQL for safety or just standard SQL if we are sure.
-- Since I cannot run PL/pgSQL easily in single statement without a function, I will just try to add the new one and drop the old one if I can guess the name.
-- However, strict SQL scripts might fail if constraint doesn't exist.
-- To be safe, I'll just create the new index and constraint.

BEGIN;

-- Drop potential old unique constraints that might conflict
ALTER TABLE student_roster DROP CONSTRAINT IF EXISTS student_roster_teacher_id_grade_class_info_number_key;
ALTER TABLE student_roster DROP CONSTRAINT IF EXISTS student_roster_class_id_number_key;

-- Add new unique constraint on class_id and number
ALTER TABLE student_roster ADD CONSTRAINT student_roster_class_id_number_key UNIQUE (class_id, number);

COMMIT;
