# Сессия: 2026-02-08 — Итерация 004: Кабинет инструктора MVP

## Цель
Создать кабинет инструктора для управления вопросами и препаратами. Данные в Supabase, синхронизация с Google Sheets для студенческого фронтенда.

## Фаза 1: Каркас + Авторизация
- SPA-структура /instructor/ с sidebar-навигацией
- Supabase Auth: email+пароль, проверка роли instructor
- Responsive CSS, mobile sidebar

### Баги и фиксы
- Конфликт имён: CDN supabase vs const supabase → переименовано в supabaseClient
- Домен: .supabase.com → .supabase.co
- Email provider выключен → включён, пользователь пересоздан

## Фаза 2: CRUD вопросов
- Карточки с поиском + фильтр по блоку компетенций
- Модальная форма: динамические варианты (2–6), чекбоксы multiple choice
- Загрузка иллюстраций в Supabase Storage
- Удаление с подтверждением + очистка Storage

### Баги и фиксы
- Foreign key: таблица competencies пустая → заполнена 26 записями через SQL
- RLS sync_log: нет INSERT-политики → добавлена
- Фильтр по умолчанию стоял на первом блоке → исправлен

## Фаза 3: CRUD препаратов
- Аналогичный CRUD (name_ru, name_lat, drug_group, dosage, form, indications, contraindications, side_effects, field_notes)
- Экран «Обзор» с живыми счётчиками из Supabase

### Расширение схемы
- questions: +category, +module
- drugs: +side_effects

## Фаза 4: Синхронизация Supabase → Google Sheets
- Google Apps Script (SupabaseSync.gs), вариант A (Apps Script тянет из Supabase REST API)
- Маркер [SB] в ID — отличает синхронизированные строки от оригинальных
- Безопасный режим v2: оригинальные строки (без маркера) НИКОГДА не удаляются

### КРИТИЧЕСКИЙ БАГ: удаление данных
- v1 скрипта удалил 81 вопрос + 6 препаратов
- Восстановлены через историю версий Google Sheets
- v2: удаляет только строки с маркером [SB]

### БАГ: автоконвертация в дату
- Google Sheets конвертировал "0,2,3" → дату 02.01.2000
- Фикс: setNumberFormat('@') — принудительный текстовый формат колонки E

## Принятые решения
- Apps Script (не Edge Functions) для синхронизации — быстрее к дедлайну
- Маркер [SB] для разделения оригинальных и Supabase-данных
- service_role key в Apps Script (серверный контекст)
- Параллельная работа: оригинальные данные + новые из Supabase

## Структура файлов
```
instructor/
├── index.html
├── css/instructor.css
└── js/
    ├── supabase-config.js, supabase-client.js, auth.js
    ├── app.js, questions.js, drugs.js, image-upload.js
```

## Уроки
1. Всегда проверяй деструктивные операции — маркеры [SB] и история версий спасли данные
2. Google Sheets автоконвертация — setNumberFormat('@') для текстовых данных
3. Порядок загрузки скриптов — CDN создают глобальные переменные
4. RLS триггеры — нужны политики на всех таблицах в цепочке
