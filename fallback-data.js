// fallback-data.js
// Сгенерировано автоматически из rus_pharma_field_advanced.xlsx
// Запуск: python tools/generate-fallback.py

const FALLBACK_QUESTIONS = [
    {
        "id": "q1",
        "category": "Фармакологические основы",
        "type": "multiple",
        "question": "При каком пути введения биодоступность препарата составляет 100%?",
        "answers": [
            "Внутримышечно",
            "Подкожно",
            "Внутривенно",
            "Сублингвально"
        ],
        "correct": 2,
        "explanation": "См. материалы Модуля 1: Фармакологические основы",
        "competencyId": "BASE_PHARMA",
        "module": 1,
        "difficulty": 1
    },
    {
        "id": "q5",
        "category": "Антибактериальная терапия",
        "type": "multiple",
        "question": "При проникающем ранении живота какую комбинацию выберете?",
        "answers": [
            "Азитромицин монотерапия",
            "Ципрофлоксацин + Метронидазол",
            "Фурагин + Гентамицин"
        ],
        "correct": 0,
        "explanation": "См. материалы Модуля 2: Антибактериальная терапия",
        "competencyId": "ANTIBIOTICS",
        "module": 2,
        "difficulty": 1
    },
    {
        "id": "q8",
        "category": "Антигистаминные препараты",
        "type": "multiple",
        "question": "Какие препараты вводите при анафилаксии? (выберите ВСЕ)",
        "answers": [
            "Адреналин 0.5мг в/м",
            "Супрастин 40мг в/в",
            "Преднизолон 120мг в/в",
            "Цетиризин 10мг per os",
            "Кристаллоиды 1-2л в/в"
        ],
        "correct": 0,
        "explanation": "См. материалы Модуля 3: Антигистаминные препараты",
        "competencyId": "ANTIHISTAMINES",
        "module": 3,
        "difficulty": 1
    },
    {
        "id": "q11",
        "category": "Глазные и ушные инфекции",
        "type": "multiple",
        "question": "Какие капли НЕЛЬЗЯ при перфорации барабанной перепонки?",
        "answers": [
            "Ципромед",
            "Отипакс",
            "Софрадекс",
            "Нормакс",
            "Полидекса"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 4: Глазные и ушные инфекции",
        "competencyId": "EYE_EAR_INFECTIONS",
        "module": 4,
        "difficulty": 1
    },
    {
        "id": "q14",
        "category": "ОРВИ",
        "type": "multiple",
        "question": "Признаки вирусной инфекции: (выберите ВСЕ правильные)",
        "answers": [
            "Внезапное начало с Т° >39°C",
            "Белые налеты на миндалинах",
            "Боль в глазах при движении",
            "Густые желтые сопли",
            "Водянистые выделения из носа",
            "Ломота в мышцах"
        ],
        "correct": 0,
        "explanation": "См. материалы Модуля 5: ОРВИ",
        "competencyId": "VIRAL_INFECTIONS",
        "module": 5,
        "difficulty": 1
    },
    {
        "id": "q17",
        "category": "НПВС",
        "type": "multiple",
        "question": "Какой НПВС самый сильный анальгетик?",
        "answers": [
            "Ибупрофен",
            "Кеторолак",
            "Мелоксикам □ Г) Целекоксиб"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 6: НПВС",
        "competencyId": "NSAID",
        "module": 6,
        "difficulty": 1
    },
    {
        "id": "q21",
        "category": "Глюкокортикостероиды",
        "type": "multiple",
        "question": "Самый сильный глюкокортикостероид:",
        "answers": [
            "Гидрокортизон",
            "Преднизолон",
            "Дексаметазон",
            "Метилпреднизолон"
        ],
        "correct": 2,
        "explanation": "См. материалы Модуля 7: Глюкокортикостероиды",
        "competencyId": "GLUCOCORTICOIDS",
        "module": 7,
        "difficulty": 1
    },
    {
        "id": "q25",
        "category": "Адреналин",
        "type": "multiple",
        "question": "Доза адреналина при анафилаксии у взрослого:",
        "answers": [
            "0.1 мг в/м",
            "0.3-0.5 мг в/м",
            "1 мг в/м",
            "3 мг в/м"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 8: Адреналин",
        "competencyId": "ADRENALINE",
        "module": 8,
        "difficulty": 1
    },
    {
        "id": "q31.0",
        "category": "Спазмолитики",
        "type": "multiple",
        "question": "Тримедат отличается от Но-шпы тем, что:",
        "answers": [
            "Сильнее снимает спазм",
            "Регулирует моторику ЖКТ",
            "Можно вводить в/м",
            "Действует только на желудок"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 9: Спазмолитики",
        "competencyId": "SPASMOLITICA",
        "module": 9,
        "difficulty": 1
    },
    {
        "id": "q35.0",
        "category": "Шок",
        "type": "multiple",
        "question": "Целевое САД при геморрагическом шоке БЕЗ ЧМТ:",
        "answers": [
            "120-140 мм",
            "100-110 мм",
            "80-90 мм",
            "60-70 мм"
        ],
        "correct": 2,
        "explanation": "См. материалы Модуля 10: Шок",
        "competencyId": "HEMORRHAGIC_SHOCK",
        "module": 10,
        "difficulty": 2
    },
    {
        "id": "q39.0",
        "category": "Инфузионная терапия",
        "type": "multiple",
        "question": "Оптимальный доступ при неудачной в/в попытке за 90 секунд:",
        "answers": [
            "Продолжить попытки в/в",
            "Центральный венозный",
            "Внутрикостный",
            "Подключичный катетер"
        ],
        "correct": 2,
        "explanation": "См. материалы Модуля 11: Инфузионная терапия",
        "competencyId": "INFUSION_THERAPY",
        "module": 11,
        "difficulty": 2
    },
    {
        "id": "q44.0",
        "category": "Антидоты",
        "type": "multiple",
        "question": "Антидот при передозировке морфина:",
        "answers": [
            "Флумазенил",
            "Налоксон",
            "Протамин",
            "Атропин"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 12: Антидоты",
        "competencyId": "ANTIDOTES",
        "module": 12,
        "difficulty": 2
    },
    {
        "id": "q49.0",
        "category": "Анальгезия",
        "type": "multiple",
        "question": "Препарат выбора при травме с геморрагическим шоком:",
        "answers": [
            "Морфин 10 мг в/м",
            "Кетамин 50 мг в/м",
            "Фентанил 100 мкг в/в",
            "Кеторолак 30 мг в/м"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 13: Анальгезия",
        "competencyId": "ANALGESIA",
        "module": 13,
        "difficulty": 2
    },
    {
        "id": "q54.0",
        "category": "Септический шок",
        "type": "multiple",
        "question": "Критерии qSOFA включают (выберите ВСЕ):",
        "answers": [
            "ЧД ≥22/мин",
            "Температура >38°C",
            "Изменение сознания",
            "САД ≤100 мм рт.ст.",
            "ЧСС >90/мин"
        ],
        "correct": 0,
        "explanation": "См. материалы Модуля 14: Септический шок",
        "competencyId": "SEPTIC_SHOCK",
        "module": 14,
        "difficulty": 2
    },
    {
        "id": "q58.0",
        "category": "Клещевые инфекции",
        "type": "multiple",
        "question": "Эффективное время для иммуноглобулина после укуса клеща:",
        "answers": [
            "Первые 24 часа",
            "Первые 72 часа",
            "Первая неделя",
            "Первый месяц"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 15: Клещевые инфекции",
        "competencyId": "TICK_INFECTIONS",
        "module": 15,
        "difficulty": 2
    },
    {
        "id": "q62.0",
        "category": "Бешенство",
        "type": "multiple",
        "question": "Летальность бешенства без профилактики:",
        "answers": [
            "50%",
            "75%",
            "95%",
            "100%"
        ],
        "correct": 3,
        "explanation": "См. материалы Модуля 16: Бешенство",
        "competencyId": "RABIES",
        "module": 16,
        "difficulty": 2
    },
    {
        "id": "q66.0",
        "category": "Инфаркт и инсульт",
        "type": "multiple",
        "question": "Первое действие при подозрении на инфаркт:",
        "answers": [
            "Нитроглицерин под язык",
            "Морфин в/в",
            "Аспирин 300 мг разжевать",
            "Кислород всем пациентам"
        ],
        "correct": 2,
        "explanation": "См. материалы Модуля 17: Инфаркт и инсульт",
        "competencyId": "CARDIAC_STROKE",
        "module": 17,
        "difficulty": 2
    },
    {
        "id": "q72.0",
        "category": "Детоксикация",
        "type": "multiple",
        "question": "Состав препарата Реамберин:",
        "answers": [
            "Глюкоза + витамины",
            "Янтарная кислота + меглюмин",
            "Натрий + калий + хлор",
            "Этанол + глицерин"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 18: Детоксикация",
        "competencyId": "DETOX",
        "module": 18,
        "difficulty": 1
    },
    {
        "id": "q74.0",
        "category": "Огнестрельные раны",
        "type": "multiple",
        "question": "Когда накладывают первичный шов на огнестрельную рану?",
        "answers": [
            "Сразу после ПХО",
            "Через 24 часа",
            "Через 5-7 дней",
            "НИКОГДА"
        ],
        "correct": 3,
        "explanation": "См. материалы Модуля 19: Огнестрельные раны",
        "competencyId": "GUNSHOT_WOUNDS",
        "module": 19,
        "difficulty": 2
    },
    {
        "id": "q78.0",
        "category": "Ожоги",
        "type": "multiple",
        "question": "Критерий ожогового шока у взрослых:",
        "answers": [
            ">10% ТПП",
            ">20% ТПП",
            ">30% ТПП",
            ">40% ТПП"
        ],
        "correct": 1,
        "explanation": "См. материалы Модуля 20: Ожоги",
        "competencyId": "BURNS",
        "module": 20,
        "difficulty": 2
    }
];

const FALLBACK_DRUGS = [
    {
        "id": "d1",
        "name": "Адреналин",
        "category": "Экстренные",
        "inn": "Epinephrine",
        "form": "Ампула 1мг/мл",
        "dosage": "0.5мг в/м",
        "indications": "Анафилаксия",
        "contraindications": "Нет абсолютных",
        "sideEffects": "Тахикардия, тремор",
        "fieldNotes": "Защищать от света"
    },
    {
        "id": "d2",
        "name": "Амоксициллин",
        "category": "Антибиотики",
        "inn": "Амоксициллин",
        "form": "таблетках и капсулах по 250 и 500 мг",
        "dosage": "Для приема внутрь разовая доза для взрослых и детей старше 10 лет (с массой тела более 40 кг) составляет 250-500 мг, при тяжелом течении заболевания - до 1 г. Для детей в возрасте 5-10 лет разовая доза составляет 250 мг; в возрасте от 2 до 5 лет - 125 мг. Интервал между приемами - 8 ч.",
        "indications": "Инфекции верхних дыхательных путей, включая инфекции уха, носа и горла: острый средний отит, острый синусит и бактериальный фарингит;\nинфекции нижних дыхательных путей: обострение хронического бронхита, внебольничная пневмония;\nинфекции нижних отделов мочевыделительных путей: цистит",
        "contraindications": "лимфолейкоз;\nбронхиальная астма;\nинфекционный мононуклеоз;\nдетский возраст до 5 лет (таблетки, капсулы).",
        "sideEffects": "Головокружение",
        "fieldNotes": "Защищать от света, влажности, высоких температур"
    },
    {
        "id": "d3",
        "name": "Кеторолак",
        "category": "Анальгетики",
        "inn": "Ketorolac",
        "form": "",
        "dosage": "",
        "indications": "",
        "contraindications": "",
        "sideEffects": "",
        "fieldNotes": ""
    },
    {
        "id": "d4",
        "name": "Налоксон",
        "category": "Антидоты",
        "inn": "Naloxone",
        "form": "",
        "dosage": "",
        "indications": "",
        "contraindications": "",
        "sideEffects": "",
        "fieldNotes": ""
    },
    {
        "id": "d5",
        "name": "Спец насадка на шприц",
        "category": "Инструменты",
        "inn": "Romed",
        "form": "Насадка на шприц",
        "dosage": "",
        "indications": "",
        "contraindications": "",
        "sideEffects": "",
        "fieldNotes": ""
    },
    {
        "id": "d6",
        "name": "ИПП",
        "category": "Расходные материалы",
        "inn": "ИПП-1",
        "form": "бинт",
        "dosage": "",
        "indications": "",
        "contraindications": "",
        "sideEffects": "",
        "fieldNotes": ""
    }
];

const FALLBACK_SCENARIOS = [
    {
        "id": "CASE_001",
        "title": "Огнестрельное ранение",
        "nodes": {
            "START": {
                "id": "START",
                "title": "Огнестрельное ранение",
                "description": "Боец 25 лет. Осколочное ранение левого бедра 10 минут назад. В сознании, бледный, жалуется на боль. При осмотре: рана 5x3 см на передне-внутренней поверхности бедра, активное пульсирующее кровотечение темной крови. Повязка, наложенная товарищем, промокла.",
                "type": "start",
                "patientState": "critical",
                "choices": [
                    {
                        "text": "Наложить турникет выше раны",
                        "nextNode": "NODE_A",
                        "effect": "+20"
                    },
                    {
                        "text": "Усилить давящую повязку",
                        "nextNode": "NODE_B",
                        "effect": "-10"
                    },
                    {
                        "text": "Сначала обезболить",
                        "nextNode": "NODE_C",
                        "effect": "-30"
                    }
                ]
            },
            "NODE_A": {
                "id": "NODE_A",
                "title": "Турникет наложен",
                "description": "Вы наложили турникет на 10 см выше раны. Кровотечение остановилось. Записали время наложения. Пациент в сознании, но слабый. Что дальше?",
                "type": "treatment",
                "patientState": "improving",
                "choices": [
                    {
                        "text": "Начать инфузию и антибиотикопрофилактику",
                        "nextNode": "NODE_D",
                        "effect": "+15"
                    },
                    {
                        "text": "Немедленно эвакуировать",
                        "nextNode": "NODE_E",
                        "effect": "+10"
                    },
                    {
                        "text": "Ввести морфин для обезболивания",
                        "nextNode": "NODE_F",
                        "effect": "0"
                    }
                ]
            },
            "NODE_B": {
                "id": "NODE_B",
                "title": "Кровотечение продолжается",
                "description": "Давящая повязка не эффективна. Кровь продолжает сочиться. АД падает. Пациент становится заторможенным.",
                "type": "complication",
                "patientState": "worsening",
                "choices": [
                    {
                        "text": "Срочно наложить турникет",
                        "nextNode": "NODE_A2",
                        "effect": "+10"
                    },
                    {
                        "text": "Тампонада раны + давление",
                        "nextNode": "NODE_G",
                        "effect": "-5"
                    },
                    {
                        "text": "Вызвать эвакуацию",
                        "nextNode": "NODE_H",
                        "effect": "-15"
                    }
                ]
            },
            "NODE_D": {
                "id": "NODE_D",
                "title": "Инфузия и антибиотики",
                "description": "Вы установили в/в доступ и начали инфузию кристаллоидов. Ввели цефтриаксон 1г в/м в здоровое бедро. Состояние стабилизируется.",
                "type": "treatment",
                "patientState": "stable",
                "choices": [
                    {
                        "text": "Организовать эвакуацию",
                        "nextNode": "WIN_1",
                        "effect": "+20"
                    },
                    {
                        "text": "Ввести обезболивающее",
                        "nextNode": "NODE_J",
                        "effect": "+5"
                    },
                    {
                        "text": "Ослабить турникет для проверки",
                        "nextNode": "NODE_K",
                        "effect": "-25"
                    }
                ]
            },
            "NODE_F": {
                "id": "NODE_F",
                "title": "Реакция на морфин",
                "description": "После введения морфина пациент успокоился, но вы замечаете урежение дыхания до 8/мин. Зрачки сузились.",
                "type": "event",
                "patientState": "worsening",
                "choices": [
                    {
                        "text": "Ввести налоксон 0.4 мг",
                        "nextNode": "NODE_L",
                        "effect": "+15"
                    },
                    {
                        "text": "Наблюдать и ждать",
                        "nextNode": "NODE_M",
                        "effect": "-20"
                    },
                    {
                        "text": "ИВЛ мешком Амбу",
                        "nextNode": "NODE_N",
                        "effect": "+10"
                    }
                ]
            },
            "NODE_L": {
                "id": "NODE_L",
                "title": "Налоксон введен",
                "description": "После введения налоксона дыхание восстановилось до 14/мин. Пациент проснулся, жалуется на сильную боль.",
                "type": "treatment",
                "patientState": "stable",
                "choices": [
                    {
                        "text": "Ввести кеторолак 30 мг",
                        "nextNode": "NODE_O",
                        "effect": "+10"
                    },
                    {
                        "text": "Повторить малую дозу морфина",
                        "nextNode": "NODE_P",
                        "effect": "0"
                    },
                    {
                        "text": "Готовить к эвакуации как есть",
                        "nextNode": "WIN_2",
                        "effect": "+5"
                    }
                ]
            },
            "WIN_1": {
                "id": "WIN_1",
                "title": "Пациент спасен!",
                "description": "Отличная работа! Вы правильно определили приоритеты, быстро остановили кровотечение и стабилизировали пациента. Эвакуация проведена успешно. В госпитале сохранили конечность.",
                "type": "win",
                "patientState": "saved",
                "choices": []
            },
            "WIN_2": {
                "id": "WIN_2",
                "title": "Успешная стабилизация",
                "description": "Вы справились с осложнением и стабилизировали пациента. Эвакуация проведена. Исход благоприятный.",
                "type": "win",
                "patientState": "saved",
                "choices": []
            },
            "FAIL_1": {
                "id": "FAIL_1",
                "title": "Летальный исход",
                "description": "К сожалению, из-за задержки с остановкой кровотечения развился геморрагический шок. Несмотря на реанимационные мероприятия, пациент погиб. Помните: при артериальном кровотечении счет идет на минуты.",
                "type": "fail",
                "patientState": "dead",
                "choices": []
            }
        }
    }
];
