# Итерация 005: LLM Automation — Session Log

**Дата:** 2026-02-11
**Статус:** ✅ Завершено

## Фазы

### Фаза 1: Инфраструктура
- SQL-схема: таблицы `generated_content`, `generation_log`, миграция `drugs.item_type`
- Навигация: пункт "Генерация контента" в сайдбаре инструктора
- Edge Function `generate-content` (stub)

### Фаза 2: Извлечение текста + UI генерации
- CDN-библиотеки: pdf.js 3.11.174, mammoth.js 1.6.0
- `text-extractor.js` — извлечение текста из PDF, DOCX, TXT (до 10 МБ)
- `llm-generator.js` — UI: drag & drop загрузка, настройки (типы, компетенция, сложность, количество), вызов Edge Function
- CSS генерации (~330 строк)

### Фаза 3: Edge Function + Claude API
- Полная реализация `generate-content/index.ts` (454 строки)
- Claude Sonnet 4 (`claude-sonnet-4-20250514`), 4096 max tokens
- 4 специализированных промпта: question, drug, flashcard, scenario
- JSON-парсинг из ответа Claude (markdown fences, вложенные массивы)
- AbortController timeout 90 сек, обработка 429 rate limit
- Сохранение в `generated_content`, логирование в `generation_log`

### Фаза 4: Review Cards + Approve Flow
- `review-cards.js` (670 строк) — карточки ревью сгруппированные по типу
- Approve/reject/edit для каждой карточки, bulk-действия
- Inline-редактирование с type-specific формами
- Approve flow:
  - `question` → INSERT в `questions`
  - `drug` → INSERT в `drugs`
  - `flashcard` → INSERT в `drugs` (с `item_type`)
  - `scenario` → INSERT в `questions` (с `category='scenario'`)
- Обновление `generated_content.status` + `approved_target_id`

### Фаза 5: Полировка UX
- `getErrorMessage()` — человекочитаемые ошибки (Claude API 401/429/529, timeout, сеть, сессия)
- Error card с кнопкой "Попробовать снова" (вместо toast)
- Client-side AbortController (95 сек)
- Статистика: время, токены вход/выход, стоимость (Sonnet 4: $3/$15 per 1M)
- Intro-шаги (1-2-3), field hints, предупреждение при тексте >80K символов

## Баг-фиксы

| Баг | Причина | Фикс |
|-----|---------|------|
| 401 Unauthorized при вызове Edge Function | Отсутствовал заголовок `apikey` в fetch | Добавлен `'apikey': SUPABASE_ANON_KEY` в headers |
| 404 model not found от Claude API | Неверный model ID `claude-sonnet-4-5-20250514` | Исправлен на `claude-sonnet-4-20250514` |
| NOT NULL violation на `competency_block` | Claude не генерирует поле block, `getCompetencyBlock()` возвращал null | Fallback: prefix от competency_id или `'basics'` |
| JWT verification на Edge Function | Supabase по умолчанию проверяет JWT | Отключена в конфиге, проверка в коде функции через `auth.getUser()` |

## Файлы

| Файл | Описание |
|------|----------|
| `instructor/js/text-extractor.js` | Извлечение текста из PDF/DOCX/TXT |
| `instructor/js/llm-generator.js` | UI генерации: загрузка, настройки, вызов API, статистика, ошибки |
| `instructor/js/review-cards.js` | Карточки ревью: рендеринг, edit, approve/reject, bulk |
| `supabase/functions/generate-content/index.ts` | Edge Function: auth, Claude API, парсинг, сохранение |
| `instructor/css/instructor.css` | +600 строк CSS (генерация + review cards + полировка) |
| `docs/iterations/005_llm-automation/sql/001_create_tables.sql` | SQL-схема |

## Уроки

1. **Supabase Edge Functions требует `apikey` header** — даже при наличии `Authorization: Bearer <JWT>`, Supabase Gateway требует заголовок `apikey` с anon key для маршрутизации запроса.

2. **Model ID нужно проверять в документации** — Claude model ID не содержит минорную версию в названии (`claude-sonnet-4-20250514`, не `claude-sonnet-4-5-20250514`).

3. **JWT verification лучше отключить и проверять в коде функции** — встроенная проверка JWT в Supabase Edge Functions не даёт гибкости для обработки ошибок. Лучше отключить её и вызывать `supabaseClient.auth.getUser()` в коде.

4. **Claude не всегда следует JSON-схеме** — нужен робастный парсер: убирать markdown fences, искать `[...]` или `{...}` в тексте. Также Claude может не генерировать все поля — нужны fallback-значения при INSERT.
