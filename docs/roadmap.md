# Roadmap — rus-pharma-web-app

> Дедлайн ближайших итераций — **середина марта 2026**

## Completed

### 001 Auth Module
- Supabase Auth для инструкторов (email/password)
- Роль instructor в user_metadata

### 002 Progress Matrix
- Матрица прогресса по компетенциям (26 компетенций, 6 блоков)
- Service Worker для офлайн-режима
- Fallback-данные (81 вопрос, 6 препаратов)

### 003 Multiple Choice (2026-02-08)
- Поддержка нескольких правильных ответов (чекбоксы, 3-уровневая обратная связь)
- Фикс парсинга в Google Apps Script
- Docs: docs/iterations/003_multiple-choice/session-log.md

### 004 Instructor Dashboard (2026-02-08)
- Supabase: PostgreSQL + Auth + Storage
- CRUD вопросов и препаратов с загрузкой иллюстраций
- Синхронизация Supabase → Google Sheets (Apps Script, маркер [SB])
- Docs: docs/iterations/004_instructor-cabinet/session-log.md

### 004.5 User Management (2026-02-08)
- Реестр инструкторов, управление курсантами и группами
- Таблицы Supabase: instructors, cadets, groups
- Docs: docs/iterations/004.5_user-management/session-log.md

### 005 LLM Automation (2026-02-11)
- Загрузка лекций (PDF/DOCX/TXT) → извлечение текста (pdf.js, mammoth.js)
- Edge Function `generate-content` → Claude Sonnet 4 API → генерация 4 типов контента
- Review Cards: approve/reject/edit, bulk-действия, inline-редактирование
- Approve flow: question → `questions`, drug → `drugs`, flashcard → `drugs`, scenario → `questions`
- UX: error cards с retry, статистика токенов/стоимости, intro-шаги, field hints
- Таблицы: `generated_content`, `generation_log`; миграция `drugs.item_type`
- Docs: docs/iterations/005_llm-automation/session-log.md

## In Progress

### 006 Structured Testing
- **006A:** Структурированное тестирование — курсант видит только назначенные тесты
- **006B:** Инструменты инструктора — открытие/закрытие модулей, назначение тестов
- **006C:** Аналитика — отчёты по группам и курсантам
- Docs: docs/iterations/006_structured-testing/requirements.md

## Planned

### 007 Migration
- Полная миграция студенческого фронтенда с Google Sheets на Supabase
- Убрать зависимость от Google Sheets API
- Синхронизация cadets/groups → Google Sheets (если нужна)

### 008 Offline Mode
- Service Worker, offline-first архитектура
- Локальное хранение прогресса с последующей синхронизацией

## Бэклог

- Итерация 004.6: Auth инструкторов из кабинета (Edge Function для создания пользователей)
- Починка sync-module.js: фикс LOCAL_CONFIG, переход на POST, серверный endpoint
- Поля «Категория», «Модуль» в UI вопросов
- Поле «Побочные эффекты» в UI препаратов
- favicon.ico для GitHub Pages
