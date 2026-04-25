-- VoiceForm MVP Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Forms table
CREATE TABLE forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Untitled Form',
  header_video_url TEXT,
  header_image_url TEXT,
  notification_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Questions table
CREATE TABLE questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  audio_url TEXT,
  text TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT true,
  max_duration INTEGER DEFAULT 300,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Responses table
CREATE TABLE responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Answers table
CREATE TABLE answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID REFERENCES responses(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  audio_url TEXT,
  text TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. Create indexes for common queries
CREATE INDEX idx_questions_form_id ON questions(form_id);
CREATE INDEX idx_questions_order ON questions(form_id, order_index);
CREATE INDEX idx_responses_form_id ON responses(form_id);
CREATE INDEX idx_answers_response_id ON answers(response_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);

-- 6. Create storage buckets (run these separately if the SQL editor doesn't support them)
-- Go to Storage > New Bucket:
--   Bucket: voice-questions  (Public)
--   Bucket: voice-answers    (Public)

-- 7. Storage policies (allow public uploads/reads for MVP)
-- After creating buckets, run these:

INSERT INTO storage.buckets (id, name, public) VALUES ('voice-questions', 'voice-questions', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('voice-answers', 'voice-answers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public uploads to voice-questions
CREATE POLICY "Allow public uploads to voice-questions"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'voice-questions');

-- Allow public reads from voice-questions
CREATE POLICY "Allow public reads from voice-questions"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'voice-questions');

-- Allow public uploads to voice-answers
CREATE POLICY "Allow public uploads to voice-answers"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'voice-answers');

-- Allow public reads from voice-answers
CREATE POLICY "Allow public reads from voice-answers"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'voice-answers');

-- 8. Updates for existing databases
-- Run this if you already have the tables created:
-- ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT true;
-- ALTER TABLE questions ADD COLUMN IF NOT EXISTS max_duration INTEGER;
