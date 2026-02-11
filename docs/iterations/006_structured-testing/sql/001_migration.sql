-- ============================================================
-- Итерация 006: Структурированное тестирование — SQL миграция
-- Дата: 2026-02-11
-- ============================================================

-- ---------------------------------------------------------------
-- 0. Вспомогательная функция updated_at (если ещё не существует)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------
-- 1. Уровни курсов
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_levels (
  id SERIAL PRIMARY KEY,
  level_number INT NOT NULL UNIQUE CHECK (level_number BETWEEN 1 AND 3),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE course_levels IS 'Три уровня курсов: базовый, боец-спасатель, фармакология';

INSERT INTO course_levels (level_number, name, description) VALUES
  (1, 'Базовый курс тактической медицины', 'TCCC (MARCH + PAWS). Уровень 1.'),
  (2, 'Боец-спасатель', 'Тактический акцент. Уровень 2.'),
  (3, 'Фармакология и обработка ран', 'Углублённый курс. Уровень 3.')
ON CONFLICT (level_number) DO NOTHING;


-- ---------------------------------------------------------------
-- 2. Справочник модулей курса (20 модулей в 4 блоках)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_modules (
  id SERIAL PRIMARY KEY,
  module_number INT NOT NULL UNIQUE,
  block_number INT NOT NULL CHECK (block_number BETWEEN 1 AND 4),
  block_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE course_modules IS 'Справочник модулей: 20 модулей в 4 блоках';

INSERT INTO course_modules (module_number, block_number, block_name, module_name, description, sort_order) VALUES
  (1,  1, 'Фармакологические основы', 'Фармакологические основы', 'Базовые понятия, ADME, дозировки', 1),
  (2,  1, 'Фармакологические основы', 'Антибактериальная терапия', 'Выбор антибиотиков в поле', 2),
  (3,  1, 'Фармакологические основы', 'Антигистаминные препараты', 'От крапивницы до анафилаксии', 3),
  (4,  1, 'Фармакологические основы', 'Глазные и ушные инфекции', 'Протоколы лечения', 4),
  (5,  1, 'Фармакологические основы', 'Вирусные инфекции (ОРВИ)', 'Диагностика и терапия', 5),
  (6,  1, 'Фармакологические основы', 'НПВС', 'Управление болью и воспалением', 6),
  (7,  2, 'Специальные препараты и критические состояния', 'Глюкокортикостероиды', 'От аллергии до шока', 7),
  (8,  2, 'Специальные препараты и критические состояния', 'Адреналин', 'Препарат №1 в экстренной медицине', 8),
  (9,  2, 'Специальные препараты и критические состояния', 'Спазмолитики', 'Острый живот и колики', 9),
  (10, 2, 'Специальные препараты и критические состояния', 'Шок', 'Классификация и протоколы', 10),
  (11, 2, 'Специальные препараты и критические состояния', 'Инфузионная терапия', 'Управление объёмом', 11),
  (12, 2, 'Специальные препараты и критические состояния', 'Антидоты', 'Специфическая терапия отравлений', 12),
  (13, 2, 'Специальные препараты и критические состояния', 'Анальгезия', 'Лестница обезболивания ВОЗ', 13),
  (14, 3, 'Неотложные состояния', 'Септический шок', 'Ранняя диагностика и терапия', 14),
  (15, 3, 'Неотложные состояния', 'Клещевые инфекции', 'Профилактика и лечение', 15),
  (16, 3, 'Неотложные состояния', 'Бешенство', 'Протокол постэкспозиционной профилактики', 16),
  (17, 3, 'Неотложные состояния', 'Инфаркт и инсульт', 'FAST и первая помощь', 17),
  (18, 3, 'Неотложные состояния', 'Детоксикация', 'Методы и препараты', 18),
  (19, 4, 'Боевая травма', 'Огнестрельные раны', 'Особенности фармакотерапии', 19),
  (20, 4, 'Боевая травма', 'Ожоги', 'Расчёт инфузии, анальгезия, местное лечение', 20)
ON CONFLICT (module_number) DO NOTHING;


-- ---------------------------------------------------------------
-- 3. Расширение таблицы groups: добавляем course_level_id
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'groups' AND column_name = 'course_level_id'
  ) THEN
    ALTER TABLE groups ADD COLUMN course_level_id INT REFERENCES course_levels(id);
  END IF;
END $$;

COMMENT ON COLUMN groups.course_level_id IS 'FK на course_levels — уровень курса группы';


-- ---------------------------------------------------------------
-- 4. Назначения модулей группам (какие модули открыты)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES course_modules(id),
  status TEXT NOT NULL DEFAULT 'closed' CHECK (status IN ('closed', 'open', 'completed')),
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  opened_by UUID REFERENCES auth.users(id),
  UNIQUE(group_code, module_id)
);

COMMENT ON TABLE course_assignments IS 'Какие модули открыты/закрыты для какой группы';


-- ---------------------------------------------------------------
-- 5. Тестовые сессии
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_code TEXT NOT NULL REFERENCES groups(code) ON DELETE CASCADE,
  session_type TEXT NOT NULL CHECK (session_type IN ('entrance', 'module', 'final')),
  title TEXT NOT NULL,
  module_id INT REFERENCES course_modules(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  activated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

COMMENT ON TABLE test_sessions IS 'Сессии тестирования: входной/модульный/финальный';
COMMENT ON COLUMN test_sessions.module_id IS 'Для модульных тестов — конкретный модуль. NULL для входного/финального.';


-- ---------------------------------------------------------------
-- 6. Привязка модулей к тестовой сессии (для входного/финального)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_session_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
  module_id INT NOT NULL REFERENCES course_modules(id),
  UNIQUE(session_id, module_id)
);

COMMENT ON TABLE test_session_modules IS 'Какие модули включены в тестовую сессию';


-- ---------------------------------------------------------------
-- 7. Задания с развёрнутым ответом
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS open_answer_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id INT REFERENCES course_modules(id),
  text TEXT NOT NULL,
  answer_template JSONB DEFAULT '[]',
  reference_answer TEXT,
  difficulty INT DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  question_subtype TEXT DEFAULT 'explanation'
    CHECK (question_subtype IN ('explanation', 'calculation', 'scheme', 'listing')),
  sort_order INT DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE open_answer_questions IS 'Задания с развёрнутым ответом';
COMMENT ON COLUMN open_answer_questions.answer_template IS
  'Структура ответа: [{label: "Причина 1", type: "textarea"}, ...]';
COMMENT ON COLUMN open_answer_questions.reference_answer IS 'Эталонный ответ (только для инструктора)';
COMMENT ON COLUMN open_answer_questions.question_subtype IS
  'explanation=объяснение, calculation=расчёт, scheme=схема отмены, listing=перечисление';


-- ---------------------------------------------------------------
-- 8. Результаты прохождения тестов (multiple choice)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES test_sessions(id),
  cadet_id TEXT NOT NULL,
  group_code TEXT NOT NULL REFERENCES groups(code),
  question_id UUID NOT NULL REFERENCES questions(id),
  selected_option INT,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE student_test_results IS 'Ответы курсантов на MC вопросы. cadet_id совместим с GSheets (формат CMK...)';


-- ---------------------------------------------------------------
-- 9. Результаты развёрнутых ответов
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_open_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES test_sessions(id),
  cadet_id TEXT NOT NULL,
  group_code TEXT NOT NULL REFERENCES groups(code),
  question_id UUID NOT NULL REFERENCES open_answer_questions(id),
  answers JSONB DEFAULT '{}',
  instructor_grade TEXT CHECK (instructor_grade IN ('accepted', 'needs_work')),
  instructor_comment TEXT,
  answered_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ
);

COMMENT ON TABLE student_open_answers IS 'Ответы курсантов на развёрнутые вопросы';
COMMENT ON COLUMN student_open_answers.answers IS 'JSON с ответами: {field_0: "текст", field_1: "расчёт", ...}';


-- ---------------------------------------------------------------
-- 10. Расширение таблицы questions: добавляем module_id
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'module_id'
  ) THEN
    ALTER TABLE questions ADD COLUMN module_id INT REFERENCES course_modules(id);
  END IF;
END $$;

COMMENT ON COLUMN questions.module_id IS 'FK на course_modules — привязка вопроса к модулю';


-- ---------------------------------------------------------------
-- 11. Триггер updated_at для open_answer_questions
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS open_answer_questions_updated_at ON open_answer_questions;
CREATE TRIGGER open_answer_questions_updated_at
  BEFORE UPDATE ON open_answer_questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ---------------------------------------------------------------
-- 12. Индексы
-- ---------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_course_assignments_group ON course_assignments(group_code);
CREATE INDEX IF NOT EXISTS idx_test_sessions_group ON test_sessions(group_code);
CREATE INDEX IF NOT EXISTS idx_student_results_session ON student_test_results(session_id);
CREATE INDEX IF NOT EXISTS idx_student_results_student ON student_test_results(cadet_id, group_code);
CREATE INDEX IF NOT EXISTS idx_student_open_answers_session ON student_open_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_questions_module ON questions(module_id);


-- ============================================================
-- RLS политики
-- ============================================================

-- course_levels: все могут читать
ALTER TABLE course_levels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course_levels_read" ON course_levels;
CREATE POLICY "course_levels_read" ON course_levels FOR SELECT USING (true);

-- course_modules: все могут читать
ALTER TABLE course_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course_modules_read" ON course_modules;
CREATE POLICY "course_modules_read" ON course_modules FOR SELECT USING (true);

-- course_assignments: инструктор управляет, все читают
ALTER TABLE course_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "course_assignments_read" ON course_assignments;
CREATE POLICY "course_assignments_read" ON course_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "course_assignments_manage" ON course_assignments;
CREATE POLICY "course_assignments_manage" ON course_assignments FOR ALL USING (
  auth.jwt() ->> 'role' = 'instructor'
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'instructor'
);

-- test_sessions: инструктор управляет, все читают
ALTER TABLE test_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "test_sessions_read" ON test_sessions;
CREATE POLICY "test_sessions_read" ON test_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "test_sessions_manage" ON test_sessions;
CREATE POLICY "test_sessions_manage" ON test_sessions FOR ALL USING (
  auth.jwt() ->> 'role' = 'instructor'
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'instructor'
);

-- test_session_modules: инструктор управляет, все читают
ALTER TABLE test_session_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "test_session_modules_read" ON test_session_modules;
CREATE POLICY "test_session_modules_read" ON test_session_modules FOR SELECT USING (true);
DROP POLICY IF EXISTS "test_session_modules_manage" ON test_session_modules;
CREATE POLICY "test_session_modules_manage" ON test_session_modules FOR ALL USING (
  auth.jwt() ->> 'role' = 'instructor'
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'instructor'
);

-- open_answer_questions: инструктор управляет, все читают
ALTER TABLE open_answer_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_answer_questions_read" ON open_answer_questions;
CREATE POLICY "open_answer_questions_read" ON open_answer_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "open_answer_questions_manage" ON open_answer_questions;
CREATE POLICY "open_answer_questions_manage" ON open_answer_questions FOR ALL USING (
  auth.jwt() ->> 'role' = 'instructor'
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'instructor'
);

-- student_test_results: все могут вставлять и читать
ALTER TABLE student_test_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_results_insert" ON student_test_results;
CREATE POLICY "student_results_insert" ON student_test_results FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "student_results_read" ON student_test_results;
CREATE POLICY "student_results_read" ON student_test_results FOR SELECT USING (true);

-- student_open_answers: все могут вставлять и читать, инструктор может обновлять (grading)
ALTER TABLE student_open_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "student_open_answers_insert" ON student_open_answers;
CREATE POLICY "student_open_answers_insert" ON student_open_answers FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "student_open_answers_read" ON student_open_answers;
CREATE POLICY "student_open_answers_read" ON student_open_answers FOR SELECT USING (true);
DROP POLICY IF EXISTS "student_open_answers_grade" ON student_open_answers;
CREATE POLICY "student_open_answers_grade" ON student_open_answers FOR UPDATE USING (
  auth.jwt() ->> 'role' = 'instructor'
  OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'instructor'
);


-- ============================================================
-- Маппинг 7 вопросов [SB] → Модуль 1
-- ============================================================
UPDATE questions
SET module_id = (SELECT id FROM course_modules WHERE module_number = 1)
WHERE module_id IS NULL
  AND (module IS NULL OR module = '' OR module = 'ФАРМАКОЛОГИЧЕСКИЕ ОСНОВЫ')
  AND (competency_id = 'PHARMACOLOGY_BASICS' OR competency_block ILIKE '%basics%');
