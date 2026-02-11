# Итерация 006 — Фаза 1: БД + миграция — Session Log

> Дата: 2026-02-11
> Фаза: 1 (БД + миграция)

---

## Выполненные задачи

### 1. SQL миграция (`sql/001_migration.sql`)

**Новые таблицы (8 шт):**

| Таблица | Назначение | PK |
|---------|------------|-----|
| `course_levels` | 3 уровня курсов (базовый, боец-спасатель, фармакология) | SERIAL |
| `course_modules` | 20 модулей в 4 блоках | SERIAL |
| `course_assignments` | Назначения модулей группам (open/closed/completed) | UUID |
| `test_sessions` | Сессии тестирования (entrance/module/final) | UUID |
| `test_session_modules` | Модули в сессии (M:N) | UUID |
| `open_answer_questions` | Задания с развёрнутым ответом | UUID |
| `student_test_results` | Ответы курсантов на MC вопросы | UUID |
| `student_open_answers` | Ответы на развёрнутые вопросы | UUID |

**Расширенные таблицы (2):**
- `groups` — добавлена колонка `course_level_id INT FK→course_levels`
- `questions` — добавлена колонка `module_id INT FK→course_modules`

**RLS политики:**
- `course_levels`, `course_modules` — все читают
- `course_assignments`, `test_sessions`, `test_session_modules`, `open_answer_questions` — все читают, инструктор управляет
- `student_test_results` — все вставляют и читают
- `student_open_answers` — все вставляют/читают, инструктор обновляет (grading)

**Индексы (6):**
- `idx_course_assignments_group`, `idx_test_sessions_group`, `idx_student_results_session`, `idx_student_results_student`, `idx_student_open_answers_session`, `idx_questions_module`

**Триггер:**
- `open_answer_questions_updated_at` — автообновление `updated_at`

**Seed data:**
- 3 уровня курсов (INSERT ON CONFLICT DO NOTHING)
- 20 модулей в 4 блоках (INSERT ON CONFLICT DO NOTHING)

### 2. Маппинг вопросов [SB] → Модуль 1

Включён в `001_migration.sql` (последний блок):
```sql
UPDATE questions SET module_id = (SELECT id FROM course_modules WHERE module_number = 1)
WHERE module_id IS NULL
  AND (module IS NULL OR module = '' OR module = 'ФАРМАКОЛОГИЧЕСКИЕ ОСНОВЫ')
  AND (competency_id = 'PHARMACOLOGY_BASICS' OR competency_block ILIKE '%basics%');
```
Затрагивает 7 вопросов [SB] из Supabase.

### 3. Supabase клиент для студенческого фронтенда

**Новый файл:** `js/supabase-client.js`
- IIFE, инициализирует `window.supabaseClient`
- URL и anon key — те же, что в `instructor/js/supabase-config.js`
- Graceful fallback: если SDK не загружен → `window.supabaseClient = null` + console.warn

**Изменён:** `index.html`
- Добавлен `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`
- Добавлен `<script src="js/supabase-client.js"></script>`
- Оба скрипта подключены перед `config.js` (до остальных модулей)

### 4. Исправление supabase-config.js

`instructor/js/supabase-config.js` — URL исправлен с `.supabase.com` на `.supabase.co` (выполнено до начала Фазы 1).

### 5. Обновление CLAUDE.md

- Добавлены 8 новых таблиц + 2 расширенные колонки в секцию Supabase
- Добавлен `js/supabase-client.js` в дерево файлов
- Обновлён статус текущей итерации

---

## Решения

| Вопрос | Решение |
|--------|---------|
| `student_groups` vs `groups` | Используем существующую `groups` (code TEXT PK) + ALTER ADD course_level_id. НЕ создаём student_groups |
| Модуль 21 | Убран — только 20 модулей (1–20) |
| FK на группы | Все FK: `group_code TEXT REFERENCES groups(code)` |
| Идемпотентность SQL | CREATE TABLE IF NOT EXISTS, ON CONFLICT DO NOTHING, DROP POLICY IF EXISTS |
| `update_updated_at()` | CREATE OR REPLACE FUNCTION — безопасно создаётся если не существует |

---

## Что НЕ выполнено (ожидает ручного запуска)

SQL миграция создана как файл `sql/001_migration.sql`. Для применения:
1. Открыть Supabase Dashboard → SQL Editor
2. Скопировать содержимое `001_migration.sql`
3. Выполнить

---

## Файлы

| Файл | Действие |
|------|----------|
| `docs/iterations/006_structured-testing/sql/001_migration.sql` | Создан |
| `js/supabase-client.js` | Создан |
| `index.html` | Изменён (добавлены 2 script) |
| `instructor/js/supabase-config.js` | Изменён (.com → .co) |
| `CLAUDE.md` | Изменён (новые таблицы, файл, статус) |
| `docs/iterations/006_structured-testing/session-log-phase1.md` | Создан |
