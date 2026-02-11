# Итерация 006 — Фаза 4: Инструктор — управление курсом

## Дата: 2026-02-11

## Что реализовано

### Новые файлы
- `instructor/js/course-management.js` — IIFE модуль `CourseManagement` (~600 строк)

### Изменённые файлы
- `instructor/index.html` — новый пункт sidebar, секция course-management, модал сессий, review panel, script tag
- `instructor/js/app.js` — lazy-init для CourseManagement
- `instructor/css/instructor.css` — стили для cm-panel, cm-block, review cards, кнопки

### Файлы без изменений
- `sw.js` — инструктор не является PWA, новые файлы только в instructor/

## Архитектура

```
CourseManagement (instructor/js/course-management.js)
├── init() → loadBaseData() + renderGroupSelector() + bindEvents()
│
├── Панель модулей:
│   ├── Выбор группы (dropdown groups WHERE is_active)
│   ├── Уровень курса (dropdown course_levels → UPDATE groups)
│   ├── Список модулей по блокам (course_modules)
│   │   ├── Каждый модуль: статус, MC count, OA count, кнопка Open/Close
│   │   └── "Открыть/Закрыть блок" → bulk UPSERT course_assignments
│   └── toggleModule() → UPSERT course_assignments
│
├── Тестовые сессии:
│   ├── Список (test_sessions с статусами)
│   ├── Создание: тип (module/entrance/final), название, модуль
│   │   └── entrance/final: multi-select модулей → INSERT test_session_modules
│   ├── activateSession() → UPDATE status='active'
│   └── closeSession() → UPDATE status='closed'
│
├── Статус курсантов:
│   ├── Таблица: курсант × модули → % MC
│   ├── student_test_results GROUP BY cadet_id, module_id
│   ├── student_open_answers: total / graded
│   ├── Имя курсанта — кликабельная ссылка → открывает review panel
│   └── resetCadetResults() → DELETE student_test_results
│
└── Просмотр развёрнутых ответов:
    ├── openCadetReview(cadetId, name) → загрузка student_open_answers + open_answer_questions
    ├── Карточки: текст задания + ответ курсанта по полям + эталон (details)
    ├── Поле комментария инструктора
    ├── Кнопки: "✅ Зачтено" / "✏ На доработку"
    ├── gradeAnswer(answerId, grade) → UPDATE student_open_answers SET instructor_grade, graded_at
    └── Мгновенное обновление badge без перезагрузки
```

## Навигация
1. Sidebar: "Управление курсом" → section-course-management
2. Выбор группы → загрузка модулей + сессий + статусов
3. Открыть/закрыть модуль → UPSERT → перезагрузка
4. Создать сессию → модал → INSERT → перезагрузка
5. Клик на имя курсанта → review panel с ответами → оценка

## Верификация
- [ ] Выбор группы загружает модули с правильными статусами
- [ ] Открытие/закрытие модуля → UPSERT в course_assignments
- [ ] Открытие блока → массовый UPSERT
- [ ] Установка уровня курса → UPDATE groups
- [ ] Создание модульной сессии → INSERT test_sessions
- [ ] Создание входной сессии → INSERT + test_session_modules
- [ ] Активация/закрытие/удаление сессии
- [ ] Таблица курсантов: % по модулям из student_test_results
- [ ] Сброс результатов курсанта → DELETE
- [ ] Клик на курсанта → загрузка развёрнутых ответов
- [ ] Текст задания + поля ответа + эталон отображаются
- [ ] "Зачтено" → UPDATE instructor_grade = 'accepted', badge обновляется
- [ ] "На доработку" → UPDATE instructor_grade = 'needs_work', badge обновляется
- [ ] Комментарий инструктора сохраняется вместе с оценкой
