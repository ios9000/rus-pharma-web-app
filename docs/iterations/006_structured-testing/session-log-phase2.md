# Итерация 006 — Фаза 2: Session Log

**Дата**: 2026-02-11

## Что сделано

### Новые файлы
1. **`js/course-data.js`** (~190 строк) — IIFE `window.CourseData`
   - `loadCourseData(groupCode)` — параллельный запрос `course_modules` + `course_assignments` из Supabase
   - `buildQuestionMapFromAppData()` — группировка вопросов по `q.module` (1-20)
   - `loadSupabaseQuestions()` — загрузка вопросов с `module_id`, нормализация, мерж без дупликатов
   - Нормализация competencyId (`BASE_PHARMA → PHARMACOLOGY_BASICS`)
   - Fallback: если Supabase недоступен → работает только с appData
   - Экспорт: `loadCourseData`, `getOpenModules`, `getAllAssignments`, `getModuleQuestions`, `getAllModules`, `hasAssignments`, `isLoaded`

2. **`js/module-selector.js`** (~220 строк) — IIFE `window.ModuleSelector`
   - `render()` — рендер в `#test`, группировка по блокам, статусы модулей
   - `renderFallbackMode()` — кнопка "Практика: все вопросы" если нет assignments
   - `renderModuleList()` — карточки модулей со статусами (🔒/🔵/🟡/✅)
   - `saveProgress(cadetId, moduleNumber, correct, total)` — localStorage
   - `loadProgress(cadetId)` — localStorage
   - XSS-защита через `escapeHtml()`

### Изменённые файлы
3. **`js/test-module.js`**
   - State: `currentModuleNumber`, `moduleTestQuestions`, `_startingTest`
   - `startModuleTest(moduleNumber)` — фильтрация, перемешивание, запуск
   - `backToModuleSelector()` — сброс state → ModuleSelector.render()
   - `saveResultsToSupabase(results)` — фильтр по UUID, insert в `student_test_results`
   - `renderTestQuestion()` — использует moduleTestQuestions если в модульном тесте
   - `showTestResult()` — кнопка "К списку модулей", сохранение прогресса
   - `checkTestAnswer()` — добавлен `selectedIndex` в testResults
   - `checkMultipleAnswer()` — добавлен `selectedAnswers` в testResults
   - Экспорт: `window.startModuleTest`, `window.backToModuleSelector`

4. **`js/data-loader.js`**
   - `initModules()` — async вызов `CourseData.loadCourseData(groupCode)` после инициализации модулей

5. **`js/app.js`**
   - `showSection('test')` — рендер ModuleSelector если CourseData загружен, fallback на renderTestQuestion
   - Флаг `_startingTest` предотвращает двойной рендер при запуске теста

6. **`index.html`**
   - `<section id="test">` упрощена (динамический контент)
   - Добавлены `<script>` для `course-data.js` и `module-selector.js`

7. **`sw.js`**
   - `CACHE_NAME` → `'pharma-v2.1.0'`
   - ASSETS_TO_CACHE: добавлены `course-data.js`, `module-selector.js`, `supabase-client.js`
   - Fetch handler: Supabase domain → network-first strategy

## Что НЕ менялось
- `js/auth-module.js`, `js/auth-ui.js` — PIN-авторизация
- `js/cards-module.js`, `js/cases-module.js` — flashcards/сценарии
- `js/competencies-config.js` — MODULE_TO_COMPETENCY
- `js/test-selector.js` — остаётся, не вызывается

## Верификация (чеклист)
- [ ] Без assignments: меню → тесты → fallback "Практика: все вопросы" → тест работает
- [ ] С assignments: меню → тесты → список модулей → клик → тест по модулю → результат → назад
- [ ] Flashcards, препараты, сценарии — без изменений
- [ ] Offline: Supabase недоступен → fallback, тест работает
- [ ] UUID вопросы сохраняются в student_test_results
- [ ] GSheets вопросы (id: "q1") — пропускаются при сохранении в Supabase
