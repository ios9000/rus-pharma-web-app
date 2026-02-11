# Roadmap — rus-pharma-web-app

> Дедлайн ближайших итераций — **середина марта 2026**

## Завершено

### Sprint 0–2: Стабилизация (январь 2026)
- Подключены 4 отключённых JS-модуля
- Централизация API URL
- Service Worker для офлайн-режима
- Fallback-данные на основе реального контента (81 вопрос, 6 препаратов)

### Итерация 003: Multiple Choice (2026-02-08)
- Поддержка нескольких правильных ответов (чекбоксы, 3-уровневая обратная связь)
- Фикс парсинга в Google Apps Script
- Docs: docs/iterations/003_multiple-choice/session-log.md

### Итерация 004: Кабинет инструктора MVP (2026-02-08)
- Supabase: PostgreSQL + Auth + Storage
- CRUD вопросов и препаратов с загрузкой иллюстраций
- Синхронизация Supabase → Google Sheets (Apps Script, маркер [SB])
- Docs: docs/iterations/004_instructor-cabinet/session-log.md

### Итерация 004.5: Управление пользователями (2026-02-08)
- Реестр инструкторов, управление курсантами и группами
- Таблицы Supabase: instructors, cadets, groups
- Docs: docs/iterations/004.5_user-management/session-log.md

### Итерация 005: LLM Automation (2026-02-11) ✅
- Загрузка лекций (PDF/DOCX/TXT) → извлечение текста (pdf.js, mammoth.js)
- Edge Function `generate-content` → Claude Sonnet 4 API → генерация 4 типов контента (вопросы, препараты, flash-карточки, сценарии)
- Review Cards: карточки ревью с approve/reject/edit, bulk-действия, inline-редактирование
- Approve flow: question → `questions`, drug → `drugs`, flashcard → `drugs` (с `item_type`), scenario → `questions` (с `category='scenario'`)
- UX-полировка: error cards с retry, статистика токенов/стоимости, intro-шаги, field hints, предупреждение о длинном тексте
- Таблицы Supabase: `generated_content`, `generation_log`; миграция `drugs.item_type`

## В работе

_(пусто)_

## Запланировано

### Итерация 004.6: Auth инструкторов из кабинета
- Edge Function для создания Supabase Auth пользователей из интерфейса
- Убрать необходимость ручной работы в Supabase Dashboard

### Итерация 006: Visual Scenario Graph Editor
- Визуальный граф-редактор для RPG-сценариев
- Drag-and-drop узлов, связей, условий

## Бэклог

- Миграция студенческого фронтенда с Google Sheets на Supabase
- Синхронизация cadets/groups → Google Sheets
- Починка sync-module.js: фикс опечатки LOCAL_CONFIG, переход на POST, серверный endpoint (сейчас — graceful degradation)
- Поля «Категория», «Модуль» в UI вопросов
- Поле «Побочные эффекты» в UI препаратов
- favicon.ico для GitHub Pages
