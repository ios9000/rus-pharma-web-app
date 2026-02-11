-- ============================================================
-- Итерация 005 — LLM Automation: Фаза 1
-- Создание таблиц generated_content, generation_log
-- Миграция drugs: добавление item_type
-- ============================================================

-- 1.1. Таблица generated_content
CREATE TABLE generated_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('question', 'drug', 'flashcard', 'scenario')),
  content JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'rejected')),
  source_text_hash TEXT,
  competency_id TEXT,
  instructor_id UUID REFERENCES auth.users(id),
  approved_target_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_generated_content_status ON generated_content(status);
CREATE INDEX idx_generated_content_generation ON generated_content(generation_id);
CREATE INDEX idx_generated_content_instructor ON generated_content(instructor_id);

ALTER TABLE generated_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors see own generated content"
  ON generated_content FOR ALL
  USING (auth.uid() = instructor_id);

-- 1.2. Таблица generation_log
CREATE TABLE generation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  generation_id UUID NOT NULL,
  instructor_id UUID REFERENCES auth.users(id),
  source_text_length INTEGER,
  source_text_hash TEXT,
  types_requested TEXT[],
  params JSONB,
  additional_instructions TEXT,
  tokens_input INTEGER,
  tokens_output INTEGER,
  model TEXT,
  duration_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'error')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE generation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors see own generation logs"
  ON generation_log FOR ALL
  USING (auth.uid() = instructor_id);

-- 1.3. Миграция drugs: добавление item_type
ALTER TABLE drugs ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'drug'
  CHECK (item_type IN ('drug', 'device', 'instrument', 'equipment'));

CREATE INDEX IF NOT EXISTS idx_drugs_item_type ON drugs(item_type);
