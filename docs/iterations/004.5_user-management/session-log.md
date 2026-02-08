# Сессия: 2026-02-08 — Итерация 004.5: Управление пользователями

## Цель
Дать инструктору возможность управлять инструкторами, курсантами и группами из кабинета.

## Реализовано
- Раздел «Инструкторы»: реестр (list + add), таблица instructors в Supabase
- Раздел «Курсанты»: list + add + search/filter, таблица cadets
- Раздел «Группы»: list + create с генерацией 6-символьного кода, таблица groups
- Счётчики на экране «Обзор»

## Supabase таблицы
- instructors (id UUID, email, full_name, created_by, is_active)
- cadets (id TEXT, group_code, full_name, pin_code, is_active)
- groups (code TEXT PK, name, instructor, max_cadets, is_active)

## Баги
- Cadet ID не генерировался перед INSERT → fix: generateCadetId() — C + timestamp(base36) + random

## Ограничения (→ итерация 004.6)
- Реестр инструкторов — только учёт, не создаёт Auth-пользователей
- Для входа нового инструктора: Supabase Dashboard → Add user + SQL для роли
