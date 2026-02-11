# Итерация 006 — Аудит: Верификация кода

> Дата: 2026-02-11
> Фаза: 0 (аудит и верификация)
> Зависимость: audit-report.md, design.md, requirements.md

---

## 1. Верификация competencies-config.js

**Файл:** `js/competencies-config.js` (328 строк)

### Подтверждено
- 26 компетенций в 6 блоках — совпадает с audit-report.md
- Блоки: SHOCK (5), PHARMACOLOGY (9), INFECTIONS (4), TRAUMA (4), EMERGENCY (3), BASICS (1)
- `MODULE_TO_COMPETENCY` — маппинг 20 модулей → 20 компетенций, строго 1:1
- `COMPETENCY_BLOCKS` — группировка для UI, совпадает с design.md раздел 5
- Экспорт: `window.COMPETENCIES_CONFIG`, `window.COMPETENCY_BLOCKS`, `window.MODULE_TO_COMPETENCY`

### Расхождения с audit-report.md
- **Модуль 1 → `PHARMACOLOGY_BASICS`** в `MODULE_TO_COMPETENCY`, но в GSheets компетенция `BASE_PHARMA`. В `COMPETENCIES_CONFIG` ключ — `PHARMACOLOGY_BASICS`. Fallback-data.js использует `competencyId: "BASE_PHARMA"` (строка 19). **Нужна нормализация** при объединении вопросов из двух источников: `BASE_PHARMA` → `PHARMACOLOGY_BASICS`.
- **Модуль 21** упомянут в design.md (Блок II, дополнительный модуль), но в `MODULE_TO_COMPETENCY` его нет (только 1–20). Нужно решить: добавлять ли маппинг для модуля 21 или он остаётся без привязки к компетенции.

### Дублирование COMPETENCIES_CONFIG
- `js/competencies-config.js` — основная версия (26 записей, подробная: id, name, shortName, icon, color, block, description)
- `js/progress-matrix.js` строки 13–51 — дублированная копия внутри IIFE `ProgressMatrix` (26 записей, сокращённая: name, shortName, icon, color, block)
- **Риск:** При добавлении/изменении компетенций нужно обновлять оба файла.

---

## 2. Верификация test-selector.js

**Файл:** `js/test-selector.js` (963 строки) — IIFE, экспорт `TestSelector`

### Текущая архитектура
- Экран выбора теста: DIAGNOSTIC, SECTION_1–4, FINAL, PRACTICE
- Загрузка вопросов: `window.appData.questions` или `FALLBACK_DATA.questions`
- Фильтрация: по `q.competency` через `testConfig.competencies[]`
- Перемешивание + ограничение до `testConfig.questionsCount`
- Таймер: `testConfig.timeLimit` минут
- Результаты: `CadetProgress.saveTestResult()` (в localStorage)
- UI: вопрос → выбор 1 ответа (A/B/C/D) → далее → результаты по компетенциям

### Критическая проблема: `TEST_TYPES` не определён
`TEST_TYPES` используется в test-selector.js (строки 59, 132, 188, 311 и др.) и competency-progress.js (строки 241, 644, 659, 671, 678, 684), но **нигде не определён** в кодовой базе. Аналогично не определены: `ACHIEVEMENTS`, `SPACED_REPETITION_SCHEDULE`, `PROGRESS_THRESHOLDS`.

Это означает:
- `TestSelector.renderTestSelector()` выбросит `ReferenceError` при обращении к `TEST_TYPES.DIAGNOSTIC`
- `CadetProgress.isTestUnlocked()` не работает
- Вероятно, TEST_TYPES и остальные константы были потеряны при одной из итераций или предполагалось что они будут в отдельном файле

**Вывод:** TestSelector и связанный с ним CadetProgress в текущем виде не функциональны. Студенческий фронтенд работает через test-module.js (старый модуль), который НЕ использует TEST_TYPES.

### Что нужно менять для 006
- **test-selector.js** — полная замена. Вместо выбора типа теста (DIAGNOSTIC/SECTION/FINAL) → выбор модуля из назначенных инструктором
- **test-module.js** — текущий рабочий модуль тестирования. Загружает вопросы из `appData.questions`, рендерит MC с поддержкой multiple choice. Нужно расширить: фильтрация по модулю, сохранение в Supabase
- Новый файл: `js/module-selector.js` — замена test-selector.js (design.md раздел 5)

---

## 3. Верификация competency-progress.js

**Файл:** `js/competency-progress.js` (953 строки) — IIFE, экспорт `CadetProgress`

### Текущая архитектура
- Профиль: localStorage ключ `cadet_progress_profile`
- Формат: `{ version, cadetId, name, courseStatus, tests: { diagnostic, sections: {}, final, history: [] }, progressMatrix: {...}, stats, achievements, reminders, settings }`
- `progressMatrix` — по ключу компетенции: `{ diagnostic, sections: {1..4}, final, latest, delta, trend, history }`
- `generateCadetId()` — формат `cadet_<timestamp36>_<random36>` (НЕ совпадает с GSheets формат `CMK...`)
- `saveTestResult()` — записывает в localStorage, обновляет progressMatrix, stats, streak, recommendations

### Расхождения с GSheets
- **CadetId формат**: CadetProgress генерирует `cadet_xxx_xxx`, а GSheets использует `CMK48HI0HC44Q`. Это два разных идентификатора. Для 006 нужно использовать cadet_id из GSheets (как указано в design.md раздел 6).
- **progressMatrix формат**: CadetProgress хранит `sections: {1: score, 2: score, 3: score, 4: score}` (разделы 1–4). Audit-report.md подтверждает тот же формат в GSheets. Но в 006 мы переходим к модулям (1–20), а не разделам (1–4).

### Что нужно менять для 006
- **Расширение формата прогресса**: вместо/в дополнение к `sections: {1..4}` нужен `modules: {1..20}`
- **Идентификация курсанта**: использовать cadet_id из GSheets/auth-module.js, а не генерировать свой
- **Сохранение результатов**: добавить запись в `student_test_results` (Supabase), не только localStorage

---

## 4. Верификация PIN-авторизации

### Текущий flow
1. `app-auth-integration.js` → `DOMContentLoaded` → `AuthModule.init()` → `tryAutoLogin()`
2. Если нет сохранённой сессии → `AuthUI.show()` (показ формы входа/регистрации)
3. **Вход:** `cadet_id` + `pin_code` (4 цифры) → `AuthModule.login()` → Google Apps Script API → проверка → `onAuthSuccess(cadet)`
4. **Регистрация:** `group_code` → проверка группы → `full_name` → `AuthModule.register()` → получает `cadet_id` + `pin_code` → `saveSession()`
5. **Офлайн:** проверка по сохранённому `cadet_id` + хеш PIN в localStorage
6. После входа: `initApp(cadet)` → `initMainApp()` → `loadData()` → `initModules()`

### Данные после авторизации
- `AuthModule.getCurrentCadet()` возвращает: `{ id, fullName, groupCode, groupName }`
- localStorage: `auth_cadet_id` = cadet_id (формат `CMK48HI0HC44Q`)

### Совместимость с 006
- **cadet_id доступен** после авторизации через `AuthModule.getCurrentCadet().id`
- **group_code доступен** через `AuthModule.getCurrentCadet().groupCode`
- Для 006 нужно: после PIN-авторизации → найти group в Supabase (`student_groups`) по `group_code` → загрузить `course_assignments` → показать модули
- **Без изменений в auth flow** — существующая система сохраняется полностью

---

## 5. Верификация кабинета инструктора

### Структура
**Файл:** `instructor/index.html` — SPA с sidebar навигацией

**Секции:**
| Секция | data-section | JS файл | Описание |
|--------|-------------|---------|----------|
| Обзор | overview | app.js | Счётчики: вопросы, препараты, компетенции, группы, курсанты, инструкторы |
| Вопросы | questions | questions.js | CRUD, поиск, фильтр по блоку, модальная форма |
| Препараты | drugs | drugs.js | CRUD, поиск, фильтр по группе, модальная форма |
| Генерация | generation | llm-generator.js + text-extractor.js + review-cards.js | LLM-генерация контента |
| Группы | groups | groups.js | CRUD групп (code, name, instructor, max_cadets) |
| Курсанты | cadets | cadets.js | CRUD курсантов (fullname, group, pin) |
| Инструкторы | instructors | instructors.js | Реестр (email, fullname) |

### Что нужно добавить для 006B
- Новая секция **"Управление курсом"** (`course-management`) в sidebar
- Или отдельная страница `instructor/course-management.html` (как в design.md раздел 5)
- Управление модулями: открыть/закрыть для группы
- Создание тестовых сессий
- Статус прохождения курсантов

### Существующие группы в Supabase vs design.md
- Текущая таблица `groups` (code TEXT PK, name, instructor, max_cadets, is_active) — **НЕ имеет `course_level_id`**
- Design.md предлагает новую таблицу `student_groups` (UUID PK, group_code, name, course_level_id, instructor_name, ...) — **дублирует** существующую `groups`
- **Решение нужно:** мигрировать `groups` → `student_groups`, или добавить `course_level_id` в существующую `groups`, или использовать обе параллельно

---

## 6. Верификация данных в Supabase

### Вопросы в Supabase (из CLAUDE.md)
Таблица `questions`: 7 записей [SB] (из итерации 005 LLM-генерации).
Поля: id, question_text, options JSONB[], correct_answer, competency_id, competency_block, category, module, difficulty, image_url, item_type.

**Поле `module`** — для [SB] вопросов содержит либо NULL, либо текстовое значение (`'ФАРМАКОЛОГИЧЕСКИЕ ОСНОВЫ'`), не числовое. Design.md предлагает добавить `module_id INT REFERENCES course_modules(id)` — это правильный подход.

**Поле `module_id`** — в текущей схеме отсутствует, будет добавлено в Фазе 1.

### Примечание
Прямой SELECT из Supabase невозможен из CLI — нужен SQL через Supabase Dashboard или API. Верификация основана на анализе кода (review-cards.js approve flow) и документации (session-log 005, audit-report.md).

---

## 7. Список файлов для создания/изменения

### Новые файлы

| Файл | Фаза | Описание |
|------|------|----------|
| `docs/iterations/006_structured-testing/sql/001_migration.sql` | 1 | SQL миграция: новые таблицы, RLS, индексы |
| `js/course-data.js` | 2 | Загрузка модулей, назначений, объединение вопросов |
| `js/module-selector.js` | 2 | UI выбора модуля (замена test-selector.js) |
| `js/open-answer-ui.js` | 3 | UI заданий с развёрнутым ответом |
| `instructor/js/course-management.js` | 4 | Управление курсом (инструктор) |

### Модифицируемые файлы

| Файл | Фаза | Изменения |
|------|------|----------|
| `js/test-module.js` | 2 | Фильтрация по модулю, сохранение в Supabase |
| `js/competency-progress.js` | 2 | Расширение: прогресс по модулям, cadet_id из auth |
| `js/data-loader.js` | 2 | Загрузка из Supabase (course_modules, assignments) |
| `index.html` | 2 | Подключение новых JS файлов |
| `instructor/index.html` | 4 | Секция/ссылка на управление курсом |
| `CLAUDE.md` | 1 | Новые таблицы Supabase |

### Файлы, которые НЕ нужно менять
- `js/competencies-config.js` — используется как есть (маппинг MODULE_TO_COMPETENCY готов)
- `js/cards-module.js` — flashcards не затронуты
- `js/cases-module.js` — сценарии не затронуты (привязка к модулям — отложена)
- `js/auth-module.js` — PIN-авторизация сохраняется без изменений
- `js/auth-ui.js` — UI авторизации не меняется
- `instructor/js/llm-generator.js` — LLM-генерация не затронута
- `instructor/js/review-cards.js` — ревью не затронуто
- `service-worker.js` — кэширование не затронуто (обновится в итерации 008)

---

## 8. Затронутые функции

| Функция | Файл | Влияние |
|---------|------|---------|
| `TestSelector.renderTestSelector()` | test-selector.js | **Заменяется** на module-selector.js |
| `TestSelector.startTest()` | test-selector.js | **Заменяется** — тест по модулю вместо типа |
| `TestSelector.loadQuestionsForTest()` | test-selector.js | **Заменяется** — фильтрация по module, не по competency |
| `CadetProgress.saveTestResult()` | competency-progress.js | **Расширяется** — добавить запись в Supabase |
| `CadetProgress.getProgressMatrix()` | competency-progress.js | **Расширяется** — прогресс по модулям |
| `CadetProgress.isTestUnlocked()` | competency-progress.js | **Заменяется** — доступность определяется course_assignments |
| `loadData()` | data-loader.js | **Расширяется** — дополнительная загрузка из Supabase |
| `initModules()` | data-loader.js | **Расширяется** — инициализация module-selector |
| `renderTestQuestion()` | test-module.js | **Расширяется** — фильтрация по текущему модулю |
| `showSection('test')` | app.js | **Расширяется** — перенаправление на module-selector |

---

## 9. Рекомендации перед Фазой 1

### Критические
1. **Определить стратегию с таблицей `groups` vs `student_groups`**: design.md создаёт новую `student_groups`, но уже есть `groups`. Рекомендация: использовать **новую `student_groups`** (она имеет `course_level_id` и `created_by`), а `groups` оставить для обратной совместимости. При создании группы из нового UI — дублировать в обе таблицы или мигрировать.

2. **Нормализация competencyId**: `BASE_PHARMA` в GSheets ≠ `PHARMACOLOGY_BASICS` в config. При загрузке вопросов на клиенте нужен маппинг `BASE_PHARMA → PHARMACOLOGY_BASICS`.

3. **TEST_TYPES и связанные константы не определены** — test-selector.js и CadetProgress сломаны. Для 006 это не блокер (заменяем test-selector.js), но нужно учитывать: CadetProgress.saveTestResult() зависит от TEST_TYPES.FINAL.passingScore (строка 241).

### Важные
4. **Supabase клиент для студенческого фронтенда**: Сейчас `@supabase/supabase-js` подключён только в `instructor/index.html`. Для 006 нужно подключить его и в `index.html` для записи результатов в `student_test_results`. Или использовать REST API напрямую.

5. **Двойной источник вопросов**: 81 вопрос из GSheets (`appData.questions`) + 7 из Supabase. `course-data.js` должен объединять оба набора и фильтровать по `module`. Поле `module` в GSheets — числовое (1–20), в Supabase — пустое/текстовое для [SB], или `module_id` FK после миграции.

6. **Модуль 21**: Упомянут в design.md (Блок II), отсутствует в `MODULE_TO_COMPETENCY`. Если он нужен — добавить маппинг. Если нет — убрать из `course_modules` INSERT.

### Желательные
7. **Дублирование COMPETENCIES_CONFIG**: Есть в `competencies-config.js` и `progress-matrix.js`. При изменениях нужно обновлять оба. В идеале — убрать дублирование в progress-matrix.js, импортировать из глобального.

8. **Service Worker cache**: При добавлении новых JS файлов (course-data.js, module-selector.js, open-answer-ui.js) нужно обновить список кэшируемых ресурсов в service-worker.js (или sw.js).
