// fallback-data.js

// Ссылки-заглушки (работают всегда)
const PLACEHOLDER_IMG = "https://placehold.co/600x400/1a3a52/ffffff?text=Image+Missing";
const ADRENALINE_IMG = "https://placehold.co/400x400/e74c3c/ffffff?text=Adrenaline";

const FALLBACK_QUESTIONS = [
    {
        id: "q1",
        category: "Травмы",
        type: "Клинический_случай",
        question: "Демо-вопрос: Боец с ранением бедра. Ваши действия?",
        imageUrl: PLACEHOLDER_IMG, // Исправлено
        answers: ["Наложить жгут", "Дать воды", "Позвать маму", "Бежать"],
        correct: 0,
        explanation: "При артериальном кровотечении жгут обязателен."
    }
];

const FALLBACK_DRUGS = [
    {
        id: "d1",
        name: "Адреналин",
        category: "Экстренные",
        inn: "Epinephrine",
        form: "Аутоинжектор",
        imageUrl: ADRENALINE_IMG, // Исправлено (было Epinephrine-autoinjectors.jpg)
        dosage: "0.3 мг в/м",
        indications: "Анафилаксия",
        contraindications: "Нет абсолютных",
        sideEffects: "Тахикардия",
        fieldNotes: "Вводить через одежду в бедро"
    }
];

const FALLBACK_SCENARIOS = [
    {
        id: "CASE_001",
        nodes: {
            "START": {
                id: "START",
                title: "Начало миссии",
                description: "Вы видите пострадавшего с ранением ноги.",
                imageUrl: PLACEHOLDER_IMG, // Исправлено
                type: "start",
                patientState: "critical",
                choices: [
                    { text: "Осмотреть", nextNode: "NODE_A" }
                ]
            },
            "NODE_A": {
                id: "NODE_A",
                title: "Осмотр",
                description: "Кровотечение массивное.",
                imageUrl: PLACEHOLDER_IMG,
                type: "decision",
                patientState: "critical",
                choices: [
                    { text: "Наложить жгут", nextNode: "WIN" }
                ]
            },
            "WIN": {
                id: "WIN",
                title: "Победа",
                description: "Кровотечение остановлено.",
                imageUrl: PLACEHOLDER_IMG,
                type: "win",
                patientState: "saved",
                choices: []
            }
        }
    }
];