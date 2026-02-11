# Архитектура проекта — rus-pharma-web-app

## 1. Обзор системы

Электронная рабочая тетрадь по курсу **«Фармакология и обработка ран в боевых условиях в отдалённой местности»**.

Целевая аудитория — курсанты и студенты, изучающие тактическую медицину. Приложение включает компетенционную модель прогресса (26 компетенций, 6 блоков), тестирование с множественным выбором, флэш-карточки, RPG-сценарии, матрицу прогресса и офлайн-режим.

---

## 2. Стек технологий

| Компонент | Технология |
|-----------|-----------|
| Frontend | Vanilla HTML / CSS / JavaScript (без фреймворков, без бандлеров) |
| Хостинг | GitHub Pages — `ios9000.github.io/rus-pharma-web-app` |
| БД | Supabase PostgreSQL — `otoxfxwwdbeblwpizlbi.supabase.co` |
| Auth | Supabase Auth (email/password, роль instructor в user_metadata) |
| Storage | Supabase Storage — бакет `content-images` (public) |
| Edge Functions | Supabase Edge Functions (Deno, TypeScript) |
| LLM | Claude Sonnet 4 (`claude-sonnet-4-20250514`) через Edge Function |
| Текстовая обработка | pdf.js 3.11.174 (PDF), mammoth.js 1.6.0 (DOCX) — клиентская |
| Синхронизация | Google Apps Script (SupabaseSync.gs) |
| Данные (legacy) | Google Sheets API (студенческий фронтенд) |

---

## 3. Архитектура данных

```
Google Sheets (primary для существующих данных: 81 вопрос, 6 препаратов)
    ↕ Google Apps Script (Supabase → Sheets, маркер [SB])
Supabase (primary для новых данных, auth, LLM-генерация)
    ↕ Edge Function (generate-content)
Claude API (генерация контента из лекций)
```

### Таблицы Supabase

| Таблица | Ключевые поля | Описание |
|---------|--------------|----------|
| `questions` | id, question_text, options JSONB[], correct_answer, competency_id, competency_block, category, module, difficulty, image_url, item_type | Вопросы с вариантами ответов |
| `drugs` | id, name_ru, name_lat, drug_group, dosage, form, indications, contraindications, side_effects, field_notes, image_url, item_type | Препараты + flash-карточки (item_type: drug/device/instrument/equipment) |
| `competencies` | id, name, block, description | 26 компетенций в 6 блоках |
| `instructors` | id UUID, email, full_name, created_by, is_active | Реестр инструкторов |
| `cadets` | id TEXT, group_code, full_name, pin_code, is_active | Курсанты |
| `groups` | code TEXT PK, name, instructor, max_cadets, is_active | Учебные группы |
| `sync_log` | id, table_name, operation, record_id, created_at | Лог синхронизации (триггеры) |
| `generated_content` | id, generation_id, type, content JSONB, status, competency_id, instructor_id, approved_target_id | Сгенерированный LLM-контент (RLS) |
| `generation_log` | id, generation_id, instructor_id, source_text_length, tokens_input, tokens_output, model, duration_ms, status | Лог запросов к Claude API (RLS) |

### Разделение данных

- **Google Sheets** — оригинальные данные (81 вопрос, 6 препаратов), студенческий фронтенд читает отсюда
- **Supabase** — новые данные из кабинета инструктора + LLM-генерация
- **Маркер `[SB]`** — в колонке ID Google Sheets отличает синхронизированные из Supabase строки от оригинальных. Оригинальные строки без маркера никогда не удаляются

---

## 4. Ключевые модули

### Студенческий фронтенд (корень проекта)

| Файл | Назначение |
|------|-----------|
| `js/competencies-config.js` | Конфигурация 26 компетенций в 6 блоках, маппинг модулей → компетенции |
| `js/competency-progress.js` | Отслеживание прогресса по компетенциям |
| `js/progress-matrix-ui.js` | UI матрицы прогресса (визуализация) |
| `js/test-selector.js` | Выбор тестов: DIAGNOSTIC, SECTION_1–4, FINAL, PRACTICE. Таймер, подсчёт баллов, разбивка по компетенциям |
| `js/auth-*.js` | Авторизация: группы, PIN-коды, офлайн-логин |
| `js/sync-module.js` | Синхронизация прогресса (graceful degradation) |
| `service-worker.js` | Кэширование для офлайн-режима |

### Кабинет инструктора (`instructor/`)

| Файл | Назначение |
|------|-----------|
| `js/supabase-config.js` | URL + anon key Supabase |
| `js/supabase-client.js` | Инициализация Supabase клиента |
| `js/auth.js` | Логин/логаут через Supabase Auth |
| `js/app.js` | SPA-роутинг секций (sidebar навигация) |
| `js/questions.js` | CRUD вопросов: карточки, модальная форма, поиск, фильтры |
| `js/drugs.js` | CRUD препаратов: карточки, форма, загрузка иллюстраций |
| `js/image-upload.js` | Загрузка изображений в Supabase Storage |
| `js/instructors.js` | Реестр инструкторов (list + add) |
| `js/cadets.js` | Управление курсантами (list + add + search/filter) |
| `js/groups.js` | Управление группами (list + create с генерацией кода) |
| `js/text-extractor.js` | Извлечение текста из PDF (pdf.js), DOCX (mammoth.js), TXT. До 10 МБ |
| `js/llm-generator.js` | UI генерации: drag & drop загрузка, настройки (типы, компетенция, сложность, количество), вызов Edge Function, статистика токенов/стоимости, error cards с retry |
| `js/review-cards.js` | Карточки ревью: рендеринг по типу, approve/reject/edit, bulk-действия, inline-редактирование, approve flow → INSERT в questions/drugs |

### Edge Function (`supabase/functions/generate-content/`)

| Параметр | Значение |
|----------|---------|
| Runtime | Deno (Supabase Edge Functions) |
| Файл | `index.ts` (454 строки) |
| Модель | `claude-sonnet-4-20250514`, max_tokens 4096 |
| Типы контента | question, drug, flashcard, scenario |
| Timeout | AbortController 90 сек |
| Auth | JWT verification отключена, проверка через `auth.getUser()` |
| Стоимость | Sonnet 4: $3/1M input, $15/1M output tokens |

---

## 5. LLM Pipeline (Итерация 005)

```
Инструктор загружает файл лекции (PDF/DOCX/TXT)
    → text-extractor.js извлекает текст в браузере
    → llm-generator.js отправляет текст + настройки на Edge Function
    → Edge Function (generate-content) вызывает Claude Sonnet 4 API
    → Claude возвращает JSON с вопросами/карточками
    → Робастный парсер: убирает markdown fences, ищет [...] или {...}
    → Результат сохраняется в generated_content, лог — в generation_log
    → review-cards.js показывает карточки для ревью
    → Инструктор редактирует и одобряет/отклоняет (по одной или bulk)
    → Approve flow:
        question → INSERT в questions
        drug     → INSERT в drugs
        flashcard → INSERT в drugs (с item_type)
        scenario  → INSERT в questions (с category='scenario')
    → Apps Script синхронизирует в Google Sheets (маркер [SB])
```

---

## 6. Аутентификация

| Роль | Метод | Статус |
|------|-------|--------|
| Инструктор | Supabase Auth (email/password), роль `instructor` в user_metadata | Работает |
| Курсант | Пока без Supabase Auth (PIN-код + группа, локально) | Планируется в 006 |
| Edge Function | JWT verification отключена в конфиге, проверка через `supabaseClient.auth.getUser()` | Работает |

**Row Level Security (RLS):** включена на таблицах `generated_content`, `generation_log`, `sync_log`. Инструктор видит только свои записи.

---

## 7. Деплой

| Компонент | Процесс |
|-----------|---------|
| Frontend (студент + инструктор) | GitHub Pages — push to `main` → автодеплой |
| Edge Function | `supabase functions deploy generate-content` через Supabase CLI |
| Домен | `ios9000.github.io/rus-pharma-web-app` |

---

## 8. Компетенционная модель

6 блоков, 26 компетенций, 20 модулей:

| Блок | Компетенции |
|------|------------|
| SHOCK (5) | Геморрагический, Анафилактический, Кардиогенный, Обструктивный, Септический шок |
| PHARMACOLOGY (9) | Антибиотики, Антигистаминные, НПВС, ГКС, Антидоты, Анальгезия, Инфузионная терапия, Адреналин, Спазмолитики |
| INFECTIONS (4) | ОРВИ, Глазные/ушные инфекции, Клещевые инфекции, Бешенство |
| TRAUMA (4) | Гемостаз, Обработка ран, Ожоги, Огнестрельные раны |
| EMERGENCY (3) | Инфаркт/Инсульт, Детоксикация, Эвакуация |
| BASICS (1) | Фармакологические основы |

Маппинг модулей → компетенции определён в `js/competencies-config.js` (`MODULE_TO_COMPETENCY`).
