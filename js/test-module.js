// ============================================
// МОДУЛЬ ТЕСТОВ  v3.1 (MULTIPLE CHOICE SUPPORT)
// С кнопкой "Показать пояснение"
// С интеграцией системы компетенций
// Поддержка single-choice (radio) и multiple-choice (checkbox)
// ============================================

let currentTestQuestion = 0;
let testScore = 0;
let testResults = [];
let currentTestType = 'DIAGNOSTIC'; // DIAGNOSTIC, SECTION_1, SECTION_2, SECTION_3, SECTION_4, FINAL

// Результаты по компетенциям
let competencyResults = {};

// Выбранные ответы для multiple-choice
let selectedAnswers = new Set();

// Module test state
let currentModuleNumber = null;
let moduleTestQuestions = [];

// Flag to suppress ModuleSelector during test startup
let _startingTest = false;

// ============================================
// ОПРЕДЕЛЕНИЕ ТИПА ВОПРОСА
// ============================================

/**
 * Проверяет, является ли вопрос multiple-choice.
 * Определение из данных: если correct — массив, это multiple-choice.
 */
function isMultipleChoice(question) {
    return Array.isArray(question.correct);
}

/**
 * Нормализует поле correct в массив.
 * Для single-choice: [2] → массив из одного элемента.
 * Для multiple-choice: [0, 1, 2, 4] → уже массив.
 */
function getCorrectAnswers(question) {
    if (Array.isArray(question.correct)) {
        return question.correct;
    }
    return [question.correct];
}

function initTestModule() {
    console.log("Модуль тестов v3.1 загружен (multiple-choice support)");
    resetTestState();
    renderTestQuestion();
}

// Полный сброс состояния
function resetTestState() {
    currentTestQuestion = 0;
    testScore = 0;
    testResults = [];
    competencyResults = {};
    selectedAnswers = new Set();
    currentModuleNumber = null;
    moduleTestQuestions = [];
}

// Кнопка "В меню" (Сброс + Выход)
function quitTest() {
    resetTestState();
    renderTestQuestion();
    showSection('menu');
}

// ============================================
// РЕНДЕР ВОПРОСА
// ============================================

function renderTestQuestion() {
    const questions = currentModuleNumber ? moduleTestQuestions : appData.questions;
    const container = document.getElementById('test') || document.querySelector('.test-container');
    if (!container) return;

    container.innerHTML = '';

    // 1. Проверка наличия данных
    if (!questions || questions.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:20px;">Вопросы не загружены. Обновите данные.</div>';
        return;
    }
    
    // 2. Проверка окончания теста
    if (currentTestQuestion >= questions.length) {
        showTestResult(container);
        return;
    }

    const q = questions[currentTestQuestion];

    // === ИНТЕРФЕЙС ===

    // А. Шапка с прогрессом
    const header = document.createElement('div');
    header.className = 'test-header-info';
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; color: #666;';
    header.innerHTML = `
        <span>Вопрос <strong>${currentTestQuestion + 1}</strong> из <strong>${questions.length}</strong></span>
        <span style="background: #e8f5e9; padding: 4px 10px; border-radius: 12px; font-size: 14px;">
            ✓ ${testScore} правильных
        </span>
    `;
    container.appendChild(header);

    // Прогресс-бар
    const progressBar = document.createElement('div');
    progressBar.style.cssText = 'width: 100%; height: 6px; background: #e0e0e0; border-radius: 3px; margin-bottom: 20px; overflow: hidden;';
    const progressFill = document.createElement('div');
    const progressPercent = ((currentTestQuestion) / questions.length) * 100;
    progressFill.style.cssText = `width: ${progressPercent}%; height: 100%; background: linear-gradient(90deg, #4CAF50, #8BC34A); transition: width 0.3s ease;`;
    progressBar.appendChild(progressFill);
    container.appendChild(progressBar);

    // Б. Компетенция вопроса (если есть)
    if (q.competency) {
        const competencyBadge = document.createElement('div');
        competencyBadge.style.cssText = 'margin-bottom: 12px;';
        const compInfo = getCompetencyInfo(q.competency);
        competencyBadge.innerHTML = `
            <span style="background: ${compInfo.color}20; color: ${compInfo.color}; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                ${compInfo.icon} ${compInfo.name}
            </span>
        `;
        container.appendChild(competencyBadge);
    }

    // В. Текст вопроса
    const qText = document.createElement('h3');
    qText.style.cssText = 'margin-bottom: 15px; font-size: 18px; line-height: 1.4; color: #1a3a52;';
    qText.innerText = q.question;
    container.appendChild(qText);

    // Г. Картинка
    const directUrl = (typeof convertGoogleDriveUrl === 'function') 
        ? convertGoogleDriveUrl(q.imageUrl) 
        : q.imageUrl;

    if (directUrl && directUrl.length > 5) {
        const img = document.createElement('img');
        img.referrerPolicy = "no-referrer";
        img.src = directUrl;
        img.alt = "Иллюстрация";
        
        img.style.cssText = 'display: block; max-width: 100%; max-height: 200px; object-fit: contain; border-radius: 8px; margin: 0 auto 20px auto; cursor: pointer;';
        
        img.onclick = () => {
            if (typeof openImageModal === 'function') openImageModal(directUrl);
        };
        
        container.appendChild(img);
    }

    // Д. Подсказка типа вопроса
    const multiChoice = isMultipleChoice(q);
    const hintDiv = document.createElement('div');
    hintDiv.className = 'question-type-hint';
    if (multiChoice) {
        const correctCount = q.correct.length;
        hintDiv.innerHTML = `<span class="hint-icon">☑</span> Выберите все правильные ответы (${correctCount})`;
        hintDiv.style.cssText = 'padding: 8px 14px; margin-bottom: 12px; background: #e3f2fd; color: #1565c0; border-radius: 8px; font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 6px;';
    } else {
        hintDiv.innerHTML = `<span class="hint-icon">○</span> Выберите один ответ`;
        hintDiv.style.cssText = 'padding: 8px 14px; margin-bottom: 12px; background: #f5f5f5; color: #666; border-radius: 8px; font-size: 14px; display: flex; align-items: center; gap: 6px;';
    }
    container.appendChild(hintDiv);

    // Е. Ответы
    selectedAnswers = new Set();
    const answersDiv = document.createElement('div');
    answersDiv.id = 'answersContainer';
    answersDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
    container.appendChild(answersDiv);

    q.answers.forEach((ans, index) => {
        const btn = document.createElement('button');
        btn.className = 'btn answer-btn';
        btn.dataset.index = index;

        if (multiChoice) {
            btn.innerHTML = `<span class="answer-checkbox">☐</span> ${ans}`;
        } else {
            btn.innerHTML = `<span class="answer-radio">○</span> ${ans}`;
        }

        btn.style.cssText = `
            width: 100%;
            padding: 14px 16px;
            text-align: left;
            border: 2px solid #e0e0e0;
            border-radius: 10px;
            background: white;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 10px;
        `;

        btn.onmouseover = () => {
            if (!btn.disabled) {
                btn.style.borderColor = '#1a3a52';
                btn.style.background = '#f8f9fa';
            }
        };
        btn.onmouseout = () => {
            if (!btn.disabled && !selectedAnswers.has(index)) {
                btn.style.borderColor = '#e0e0e0';
                btn.style.background = 'white';
            }
        };

        if (multiChoice) {
            btn.onclick = () => toggleMultipleAnswer(index, btn, q);
        } else {
            btn.onclick = () => checkTestAnswer(index, q, container);
        }
        answersDiv.appendChild(btn);
    });

    // Ж. Кнопка "Проверить" для multiple-choice (скрыта для single)
    if (multiChoice) {
        const checkBtn = document.createElement('button');
        checkBtn.id = 'checkMultipleBtn';
        checkBtn.innerText = 'Проверить ответ';
        checkBtn.style.cssText = `
            display: block;
            width: 100%;
            margin-top: 15px;
            padding: 14px;
            background: #1565c0;
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 17px;
            font-weight: bold;
            cursor: pointer;
            opacity: 0.5;
            pointer-events: none;
            transition: all 0.2s ease;
        `;
        checkBtn.onclick = () => checkMultipleAnswer(q, container);
        container.appendChild(checkBtn);
    }

    // З. Кнопка "Показать пояснение" (скрыта до ответа)
    const hasExplanation = q.explanation && q.explanation.trim() !== '';
    
    const showExplanationBtn = document.createElement('button');
    showExplanationBtn.id = 'showExplanationBtn';
    showExplanationBtn.innerHTML = '💡 Показать пояснение';
    showExplanationBtn.style.cssText = `
        display: none;
        width: 100%;
        margin-top: 15px;
        padding: 12px;
        background: transparent;
        color: #2196F3;
        border: 2px solid #2196F3;
        border-radius: 10px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
    `;
    showExplanationBtn.dataset.hasExplanation = hasExplanation ? 'true' : 'false';
    showExplanationBtn.onclick = () => toggleExplanation();
    container.appendChild(showExplanationBtn);

    // И. Блок пояснения (скрыт)
    const explanationDiv = document.createElement('div');
    explanationDiv.id = 'explanationBlock';
    explanationDiv.style.cssText = `
        display: none;
        margin-top: 15px;
        padding: 15px;
        background: #e3f2fd;
        border-radius: 8px;
        border-left: 5px solid #2196F3;
        transition: all 0.3s ease;
    `;
    
    if (hasExplanation) {
        explanationDiv.innerHTML = `<strong>💡 Пояснение:</strong><br>${q.explanation}`;
    } else {
        explanationDiv.innerHTML = `<strong>💡 Пояснение:</strong><br><em style="color:#999;">Пояснение для этого вопроса пока не добавлено.</em>`;
    }
    container.appendChild(explanationDiv);

    // К. Кнопка "Далее"
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextQuestionBtn';
    nextBtn.innerText = 'Далее →';
    nextBtn.onclick = nextTestQuestion;
    
    nextBtn.style.cssText = `
        display: none;
        width: 100%;
        margin-top: 15px;
        padding: 15px;
        background: #1a3a52;
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 18px;
        font-weight: bold;
        cursor: pointer;
    `;
    
    container.appendChild(nextBtn);
}

// ============================================
// ИНФОРМАЦИЯ О КОМПЕТЕНЦИИ (Расширенная v3.0)
// ============================================

function getCompetencyInfo(competencyId) {
    const competencies = {
        // ШОКИ
        HEMORRHAGIC_SHOCK: { name: 'Гемор.шок', icon: '🩸', color: '#dc3545' },
        ANAPHYLACTIC_SHOCK: { name: 'Анафилакс.', icon: '⚡', color: '#ff6b6b' },
        CARDIOGENIC_SHOCK: { name: 'Кардиоген.', icon: '💔', color: '#e74c3c' },
        OBSTRUCTIVE_SHOCK: { name: 'Обструкт.', icon: '🫁', color: '#c0392b' },
        SEPTIC_SHOCK: { name: 'Сепсис', icon: '🦠', color: '#9b59b6' },
        
        // ФАРМАКОЛОГИЯ
        ANTIBIOTICS: { name: 'Антибиотики', icon: '💊', color: '#3498db' },
        ANTIHISTAMINES: { name: 'Антигист.', icon: '🛡️', color: '#9b59b6' },
        NSAID: { name: 'НПВС', icon: '💉', color: '#e67e22' },
        GLUCOCORTICOIDS: { name: 'ГКС', icon: '💎', color: '#1abc9c' },
        ANTIDOTES: { name: 'Антидоты', icon: '🧪', color: '#2ecc71' },
        ANALGESIA: { name: 'Анальгезия', icon: '💊', color: '#6f42c1' },
        INFUSION_THERAPY: { name: 'Инфузия', icon: '💧', color: '#00bcd4' },
        ADRENALINE: { name: 'Адреналин', icon: '⚡', color: '#ff5722' },
        SPASMOLITICA: { name: 'Спазмолит.', icon: '🔄', color: '#795548' },
        
        // ИНФЕКЦИИ
        VIRAL_INFECTIONS: { name: 'ОРВИ', icon: '🤧', color: '#ff9800' },
        EYE_EAR_INFECTIONS: { name: 'Глаза/Уши', icon: '👁️', color: '#00bcd4' },
        TICK_INFECTIONS: { name: 'Клещи', icon: '🕷️', color: '#4caf50' },
        RABIES: { name: 'Бешенство', icon: '🐕', color: '#f44336' },
        
        // ТРАВМА
        HEMOSTASIS: { name: 'Гемостаз', icon: '🩸', color: '#dc3545' },
        WOUND_CARE: { name: 'Раны', icon: '🩹', color: '#20c997' },
        BURNS: { name: 'Ожоги', icon: '🔥', color: '#ff5722' },
        GUNSHOT_WOUNDS: { name: 'Огнестрел.', icon: '🔫', color: '#607d8b' },
        
        // НЕОТЛОЖНЫЕ
        CARDIAC_STROKE: { name: 'ИМ/Инсульт', icon: '❤️‍🩹', color: '#e91e63' },
        DETOX: { name: 'Детокс', icon: '🧹', color: '#8bc34a' },
        EVACUATION: { name: 'Эвакуация', icon: '🚑', color: '#6c757d' },
        
        // ОСНОВЫ
        PHARMACOLOGY_BASICS: { name: 'Основы', icon: '📚', color: '#607d8b' },
        
        // Обратная совместимость со старыми ID
        SHOCK: { name: 'Шок', icon: '⚡', color: '#fd7e14' },
        AIRWAY: { name: 'Дых. пути', icon: '🫁', color: '#17a2b8' },
        HYPOTHERMIA: { name: 'Гипотермия', icon: '🌡️', color: '#007bff' }
    };
    
    return competencies[competencyId] || { name: competencyId, icon: '📌', color: '#666666' };
}

// ============================================
// ПЕРЕКЛЮЧЕНИЕ ПОЯСНЕНИЯ
// ============================================

function toggleExplanation() {
    const explanationBlock = document.getElementById('explanationBlock');
    const showBtn = document.getElementById('showExplanationBtn');
    
    if (!explanationBlock || !showBtn) return;
    
    if (explanationBlock.style.display === 'none') {
        explanationBlock.style.display = 'block';
        explanationBlock.style.opacity = '0';
        setTimeout(() => explanationBlock.style.opacity = '1', 50);
        showBtn.innerHTML = '💡 Скрыть пояснение';
        showBtn.style.background = '#e3f2fd';
    } else {
        explanationBlock.style.display = 'none';
        showBtn.innerHTML = '💡 Показать пояснение';
        showBtn.style.background = 'transparent';
    }
}

// ============================================
// MULTIPLE-CHOICE: ПЕРЕКЛЮЧЕНИЕ ОТВЕТА
// ============================================

function toggleMultipleAnswer(index, btn, question) {
    if (selectedAnswers.has(index)) {
        selectedAnswers.delete(index);
        btn.style.borderColor = '#e0e0e0';
        btn.style.background = 'white';
        btn.querySelector('.answer-checkbox').textContent = '☐';
    } else {
        selectedAnswers.add(index);
        btn.style.borderColor = '#1565c0';
        btn.style.background = '#e3f2fd';
        btn.querySelector('.answer-checkbox').textContent = '☑';
    }

    // Активируем/деактивируем кнопку "Проверить"
    const checkBtn = document.getElementById('checkMultipleBtn');
    if (checkBtn) {
        if (selectedAnswers.size > 0) {
            checkBtn.style.opacity = '1';
            checkBtn.style.pointerEvents = 'auto';
        } else {
            checkBtn.style.opacity = '0.5';
            checkBtn.style.pointerEvents = 'none';
        }
    }
}

// ============================================
// MULTIPLE-CHOICE: ПРОВЕРКА ОТВЕТА
// ============================================

function checkMultipleAnswer(question, container) {
    const correctSet = new Set(question.correct);
    const btns = container.querySelectorAll('.answer-btn');

    // Подсчитываем результат
    let correctSelected = 0;   // Правильные, которые выбраны
    let wrongSelected = 0;     // Неправильные, которые выбраны

    selectedAnswers.forEach(idx => {
        if (correctSet.has(idx)) {
            correctSelected++;
        } else {
            wrongSelected++;
        }
    });

    const totalCorrect = correctSet.size;
    const isFullyCorrect = (correctSelected === totalCorrect && wrongSelected === 0);
    const isPartiallyCorrect = (correctSelected > 0 && wrongSelected === 0 && correctSelected < totalCorrect);

    // Подсветка ответов
    btns.forEach((btn, index) => {
        btn.disabled = true;
        btn.style.cursor = 'default';
        btn.onmouseover = null;
        btn.onmouseout = null;

        if (correctSet.has(index)) {
            // Правильный ответ
            btn.style.background = '#d4edda';
            btn.style.borderColor = '#28a745';
            btn.querySelector('.answer-checkbox').textContent = '✅';
        } else if (selectedAnswers.has(index)) {
            // Неправильный выбранный
            btn.style.background = '#f8d7da';
            btn.style.borderColor = '#dc3545';
            btn.querySelector('.answer-checkbox').textContent = '❌';
        } else {
            // Не выбранный, не правильный
            btn.style.opacity = '0.6';
        }
    });

    // Скрываем кнопку "Проверить"
    const checkBtn = document.getElementById('checkMultipleBtn');
    if (checkBtn) checkBtn.style.display = 'none';

    // Показываем обратную связь
    const feedbackDiv = document.createElement('div');
    feedbackDiv.style.cssText = 'padding: 12px 16px; border-radius: 10px; margin-top: 12px; font-size: 15px; font-weight: 500;';

    if (isFullyCorrect) {
        feedbackDiv.style.background = '#d4edda';
        feedbackDiv.style.color = '#155724';
        feedbackDiv.style.borderLeft = '4px solid #28a745';
        feedbackDiv.textContent = '✅ Верно! Все ответы правильные.';
    } else if (isPartiallyCorrect) {
        feedbackDiv.style.background = '#fff3cd';
        feedbackDiv.style.color = '#856404';
        feedbackDiv.style.borderLeft = '4px solid #ffc107';
        feedbackDiv.textContent = `⚠️ Частично верно. Вы выбрали ${correctSelected} из ${totalCorrect} правильных ответов.`;
    } else {
        feedbackDiv.style.background = '#f8d7da';
        feedbackDiv.style.color = '#721c24';
        feedbackDiv.style.borderLeft = '4px solid #dc3545';
        if (wrongSelected > 0 && correctSelected > 0) {
            feedbackDiv.textContent = `❌ Неверно. Среди выбранных есть ошибочные варианты. Правильных ответов: ${totalCorrect}.`;
        } else if (wrongSelected > 0) {
            feedbackDiv.textContent = `❌ Неверно. Правильных ответов: ${totalCorrect}.`;
        } else {
            feedbackDiv.textContent = `❌ Неверно.`;
        }
    }

    // Вставляем feedback после answersContainer
    const answersContainer = document.getElementById('answersContainer');
    if (answersContainer) {
        answersContainer.parentNode.insertBefore(feedbackDiv, answersContainer.nextSibling);
    }

    // Обновляем счётчик (только полностью правильный ответ засчитывается)
    if (isFullyCorrect) testScore++;

    // Сохраняем результат с компетенцией
    const competency = question.competency || 'UNKNOWN';

    testResults.push({
        questionId: question.id,
        competency: competency,
        isCorrect: isFullyCorrect,
        selectedAnswers: Array.from(selectedAnswers)
    });

    // Обновляем статистику по компетенциям
    if (!competencyResults[competency]) {
        competencyResults[competency] = { correct: 0, total: 0 };
    }
    competencyResults[competency].total++;
    if (isFullyCorrect) {
        competencyResults[competency].correct++;
    }

    // Показываем кнопку пояснения
    const showExplanationBtn = document.getElementById('showExplanationBtn');
    if (showExplanationBtn && showExplanationBtn.dataset.hasExplanation === 'true') {
        showExplanationBtn.style.display = 'block';
    }

    // Показываем кнопку "Далее"
    const nextBtn = document.getElementById('nextQuestionBtn');
    if (nextBtn) {
        nextBtn.style.display = 'block';
    }
}

// ============================================
// ПРОВЕРКА ОТВЕТА (SINGLE-CHOICE)
// ============================================

function checkTestAnswer(selectedIndex, question, container) {
    const btns = container.querySelectorAll('.answer-btn');
    const isCorrect = (selectedIndex === question.correct);

    // Подсветка ответов
    btns.forEach((btn, index) => {
        btn.disabled = true;
        btn.style.cursor = 'default';
        btn.onmouseover = null;
        btn.onmouseout = null;

        const radio = btn.querySelector('.answer-radio');
        if (index === question.correct) {
            btn.style.background = '#d4edda';
            btn.style.borderColor = '#28a745';
            if (radio) radio.textContent = '✅';
        } else if (index === selectedIndex && !isCorrect) {
            btn.style.background = '#f8d7da';
            btn.style.borderColor = '#dc3545';
            if (radio) radio.textContent = '❌';
        } else {
            btn.style.opacity = '0.6';
        }
    });

    // Обновляем счётчик
    if (isCorrect) testScore++;

    // Сохраняем результат с компетенцией
    const competency = question.competency || 'UNKNOWN';

    testResults.push({
        questionId: question.id,
        competency: competency,
        isCorrect: isCorrect,
        selectedIndex: selectedIndex
    });

    // Обновляем статистику по компетенциям
    if (!competencyResults[competency]) {
        competencyResults[competency] = { correct: 0, total: 0 };
    }
    competencyResults[competency].total++;
    if (isCorrect) {
        competencyResults[competency].correct++;
    }

    // Показываем кнопку пояснения
    const showExplanationBtn = document.getElementById('showExplanationBtn');
    if (showExplanationBtn && showExplanationBtn.dataset.hasExplanation === 'true') {
        showExplanationBtn.style.display = 'block';
    }

    // Показываем кнопку "Далее"
    const nextBtn = document.getElementById('nextQuestionBtn');
    if (nextBtn) {
        nextBtn.style.display = 'block';
    }
}

// ============================================
// СЛЕДУЮЩИЙ ВОПРОС
// ============================================

function nextTestQuestion() {
    currentTestQuestion++;
    renderTestQuestion();
}

// ============================================
// РЕЗУЛЬТАТЫ ТЕСТА
// ============================================

function showTestResult(container) {
    const questions = currentModuleNumber ? moduleTestQuestions : appData.questions;
    const finalScorePercent = Math.round((testScore / questions.length) * 100);
    
    // Рассчитываем проценты по компетенциям
    const competencyScores = {};
    for (const [compId, data] of Object.entries(competencyResults)) {
        competencyScores[compId] = Math.round((data.correct / data.total) * 100);
    }

    // === СОХРАНЕНИЕ РЕЗУЛЬТАТОВ ===
    
    // 1. Общая история тестов (старый формат для совместимости)
    const history = JSON.parse(localStorage.getItem('testResults') || '[]');
    history.push({
        date: new Date().toISOString(),
        score: finalScorePercent,
        total: questions.length,
        correct: testScore,
        type: currentTestType,
        competencyScores: competencyScores
    });
    localStorage.setItem('testResults', JSON.stringify(history));

    // 2. Матрица прогресса компетенций (новый формат)
    saveToProgressMatrix(competencyScores, currentTestType);

    // 3. Синхронизация с сервером (если авторизован)
    if (typeof SyncModule !== 'undefined') {
        // Сохраняем общий результат теста
        SyncModule.saveTestResult(currentTestType, 'OVERALL', finalScorePercent, {
            total: questions.length,
            correct: testScore,
            competencyScores: competencyScores
        });
        
        // Сохраняем результаты по каждой компетенции
        for (const [compId, score] of Object.entries(competencyScores)) {
            SyncModule.saveTestResult(currentTestType, compId, score, {
                questionsCount: competencyResults[compId]?.total || 0
            });
        }
        
        // Запускаем синхронизацию
        SyncModule.syncNow().catch(err => console.warn('Ошибка синхронизации:', err));
    }

    // Обновляем прогресс
    if (typeof updateProgress === 'function') updateProgress();

    // Save module progress if this was a module test
    if (currentModuleNumber && typeof ModuleSelector !== 'undefined') {
        var cadet = (typeof AuthModule !== 'undefined' && AuthModule.getCurrentCadet)
            ? AuthModule.getCurrentCadet() : null;
        ModuleSelector.saveProgress(cadet ? cadet.id : null, currentModuleNumber, testScore, questions.length);
    }

    // Save results to Supabase (async, non-blocking)
    saveResultsToSupabase(testResults);

    // === ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ ===

    const emoji = finalScorePercent >= 80 ? '🏆' : (finalScorePercent >= 50 ? '🙂' : '📚');
    const message = finalScorePercent >= 80
        ? 'Отличный результат!'
        : (finalScorePercent >= 50 ? 'Хороший результат!' : 'Нужно подтянуть знания');

    const moduleTitle = currentModuleNumber ? ('Модуль ' + currentModuleNumber) : '';
    const backToModulesBtn = (typeof CourseData !== 'undefined' && CourseData.isLoaded())
        ? '<button onclick="backToModuleSelector()" style="padding: 15px; background: #17a2b8; color: white; border: none; border-radius: 10px; font-size: 16px; width: 100%; cursor: pointer; margin-bottom: 10px;">📚 К списку модулей</button>'
        : '';

    // Open answer button (if questions exist for this module)
    var openAnswerBtn = '';
    if (currentModuleNumber && typeof OpenAnswerUI !== 'undefined' && OpenAnswerUI.hasQuestions()) {
        var oaCount = OpenAnswerUI.getQuestionCount();
        openAnswerBtn =
            '<button onclick="OpenAnswerUI.render()" ' +
                'style="padding: 15px; background: #6f42c1; color: white; border: none; border-radius: 10px; font-size: 16px; width: 100%; cursor: pointer; margin-bottom: 10px;">' +
                '\uD83D\uDCDD \u0417\u0430\u0434\u0430\u043D\u0438\u044F \u0441 \u0440\u0430\u0437\u0432\u0451\u0440\u043D\u0443\u0442\u044B\u043C \u043E\u0442\u0432\u0435\u0442\u043E\u043C (' + oaCount + ')' +
            '</button>';
    }

    container.innerHTML = `
        <div style="text-align: center; padding: 20px 10px;">
            <div style="font-size: 60px; margin-bottom: 15px;">${emoji}</div>

            <h2 style="color: #1a3a52; margin-bottom: 10px;">Тест завершен!${moduleTitle ? ' (' + moduleTitle + ')' : ''}</h2>
            <p style="color: #666; margin-bottom: 20px;">${message}</p>

            <!-- Общий результат -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 15px; margin-bottom: 20px;">
                <div style="font-size: 42px; font-weight: bold; color: ${finalScorePercent >= 70 ? '#28a745' : '#dc3545'};">
                    ${finalScorePercent}%
                </div>
                <p style="margin-top: 10px; color: #666;">${testScore} из ${questions.length} правильных ответов</p>
            </div>

            <!-- Результаты по компетенциям -->
            <div style="background: #1e2a38; border-radius: 12px; padding: 15px; margin-bottom: 20px; text-align: left;">
                <h4 style="color: #fff; margin-bottom: 15px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">
                    📊 Результаты по компетенциям
                </h4>
                ${renderCompetencyResults(competencyScores)}
            </div>

            <!-- Кнопки -->
            ${backToModulesBtn}
            ${openAnswerBtn}

            <button onclick="${currentModuleNumber ? 'startModuleTest(' + currentModuleNumber + ')' : 'initTestModule()'}"
                    style="padding: 15px 30px; background: #0056b3; color: white; border: none; border-radius: 10px; font-size: 18px; width: 100%; cursor: pointer; margin-bottom: 10px;">
                Пройти заново ↻
            </button>

            <button onclick="showSection('progress')"
                    style="padding: 15px; background: #28a745; color: white; border: none; border-radius: 10px; font-size: 16px; width: 100%; cursor: pointer; margin-bottom: 10px;">
                📊 Посмотреть матрицу прогресса
            </button>

            <button onclick="quitTest()"
                    style="padding: 15px; background: transparent; color: #666; border: 2px solid #ddd; border-radius: 10px; font-size: 16px; width: 100%; cursor: pointer;">
                В меню
            </button>
        </div>
    `;
}

// ============================================
// РЕНДЕР РЕЗУЛЬТАТОВ ПО КОМПЕТЕНЦИЯМ
// ============================================

function renderCompetencyResults(competencyScores) {
    const entries = Object.entries(competencyScores);
    
    if (entries.length === 0) {
        return '<p style="color: #888; text-align: center;">Нет данных</p>';
    }
    
    return entries.map(([compId, score]) => {
        const info = getCompetencyInfo(compId);
        const barColor = score >= 70 ? '#4ade80' : (score >= 50 ? '#fbbf24' : '#f87171');
        
        return `
            <div style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="color: #e2e8f0; font-size: 14px;">
                        ${info.icon} ${info.name}
                    </span>
                    <span style="color: ${barColor}; font-weight: bold; font-size: 14px;">
                        ${score}%
                    </span>
                </div>
                <div style="height: 8px; background: #374151; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${score}%; height: 100%; background: ${barColor}; border-radius: 4px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// СОХРАНЕНИЕ В МАТРИЦУ ПРОГРЕССА
// ============================================

function saveToProgressMatrix(competencyScores, testType) {
    // Получаем текущую матрицу или создаём новую
    let matrix = JSON.parse(localStorage.getItem('progressMatrix') || '{}');
    
    // Расширенный список компетенций v3.0
    const competencyIds = [
        // Шоки
        'HEMORRHAGIC_SHOCK', 'ANAPHYLACTIC_SHOCK', 'CARDIOGENIC_SHOCK', 
        'OBSTRUCTIVE_SHOCK', 'SEPTIC_SHOCK',
        // Фармакология
        'ANTIBIOTICS', 'ANTIHISTAMINES', 'NSAID', 'GLUCOCORTICOIDS', 
        'ANTIDOTES', 'ANALGESIA', 'INFUSION_THERAPY', 'ADRENALINE', 'SPASMOLITICA',
        // Инфекции
        'VIRAL_INFECTIONS', 'EYE_EAR_INFECTIONS', 'TICK_INFECTIONS', 'RABIES',
        // Травма
        'HEMOSTASIS', 'WOUND_CARE', 'BURNS', 'GUNSHOT_WOUNDS',
        // Неотложные
        'CARDIAC_STROKE', 'DETOX', 'EVACUATION',
        // Основы
        'PHARMACOLOGY_BASICS',
        // Обратная совместимость
        'SHOCK', 'AIRWAY', 'HYPOTHERMIA'
    ];
    
    competencyIds.forEach(id => {
        if (!matrix[id]) {
            matrix[id] = {
                diagnostic: null,
                sections: { 1: null, 2: null, 3: null, 4: null },
                final: null
            };
        }
    });
    
    // Записываем результаты в зависимости от типа теста
    for (const [compId, score] of Object.entries(competencyScores)) {
        if (!matrix[compId]) {
            matrix[compId] = {
                diagnostic: null,
                sections: { 1: null, 2: null, 3: null, 4: null },
                final: null
            };
        }
        
        switch (testType) {
            case 'DIAGNOSTIC':
                matrix[compId].diagnostic = score;
                break;
            case 'SECTION_1':
                matrix[compId].sections[1] = score;
                break;
            case 'SECTION_2':
                matrix[compId].sections[2] = score;
                break;
            case 'SECTION_3':
                matrix[compId].sections[3] = score;
                break;
            case 'SECTION_4':
                matrix[compId].sections[4] = score;
                break;
            case 'FINAL':
                matrix[compId].final = score;
                break;
        }
    }
    
    // Сохраняем обновлённую матрицу
    localStorage.setItem('progressMatrix', JSON.stringify(matrix));
    
    // Синхронизация матрицы с сервером
    if (typeof SyncModule !== 'undefined') {
        SyncModule.saveProgressMatrix(matrix);
    }
    
    console.log('📊 Матрица прогресса обновлена:', matrix);
}

// ============================================
// ЗАПУСК ТЕСТА ОПРЕДЕЛЁННОГО ТИПА
// ============================================

function startTest(testType) {
    currentTestType = testType || 'DIAGNOSTIC';
    resetTestState();

    console.log(`🎯 Запуск теста: ${currentTestType}`);

    _startingTest = true;
    showSection('test');
    _startingTest = false;
    renderTestQuestion();
}

// ============================================
// ЗАПУСК ТЕСТА ПО МОДУЛЮ
// ============================================

function startModuleTest(moduleNumber) {
    if (typeof CourseData === 'undefined') {
        console.error('[startModuleTest] CourseData not available');
        return;
    }

    // Preload open answer questions
    if (typeof OpenAnswerUI !== 'undefined') {
        OpenAnswerUI.loadForModule(moduleNumber);
    }

    var questions = CourseData.getModuleQuestions(moduleNumber);
    if (!questions || questions.length === 0) {
        // No MC questions — check if open answers exist
        if (typeof OpenAnswerUI !== 'undefined' && CourseData.getOpenAnswerCount(moduleNumber) > 0) {
            OpenAnswerUI.loadForModule(moduleNumber).then(function() {
                OpenAnswerUI.render();
            });
            return;
        }
        alert('Нет вопросов для модуля ' + moduleNumber);
        return;
    }

    // Shuffle questions
    moduleTestQuestions = shuffleModuleQuestions(questions.slice());
    currentModuleNumber = moduleNumber;
    currentTestType = 'MODULE_' + moduleNumber;
    currentTestQuestion = 0;
    testScore = 0;
    testResults = [];
    competencyResults = {};
    selectedAnswers = new Set();

    console.log('📚 Запуск теста модуля ' + moduleNumber + ': ' + moduleTestQuestions.length + ' вопросов');

    _startingTest = true;
    showSection('test');
    _startingTest = false;
    renderTestQuestion();
}

function shuffleModuleQuestions(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}

// ============================================
// ВОЗВРАТ К СПИСКУ МОДУЛЕЙ
// ============================================

function backToModuleSelector() {
    currentModuleNumber = null;
    moduleTestQuestions = [];
    if (typeof ModuleSelector !== 'undefined') {
        ModuleSelector.render();
    }
}

// ============================================
// СОХРАНЕНИЕ РЕЗУЛЬТАТОВ В SUPABASE
// ============================================

/**
 * UUID pattern regex for filtering saveable questions
 */
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function saveResultsToSupabase(results) {
    if (!window.supabaseClient) return;

    var cadet = (typeof AuthModule !== 'undefined' && AuthModule.getCurrentCadet)
        ? AuthModule.getCurrentCadet() : null;
    if (!cadet || !cadet.id || !cadet.groupCode) return;

    // Filter: only save questions with UUID id (Supabase questions)
    var saveable = results.filter(function(r) {
        return r.questionId && UUID_PATTERN.test(r.questionId);
    });

    if (saveable.length === 0) return;

    var rows = saveable.map(function(r) {
        return {
            cadet_id: cadet.id,
            group_code: cadet.groupCode,
            question_id: r.questionId,
            selected_option: r.selectedIndex !== undefined ? r.selectedIndex : null,
            is_correct: r.isCorrect
        };
    });

    window.supabaseClient
        .from('student_test_results')
        .insert(rows)
        .then(function(res) {
            if (res.error) {
                console.warn('[saveResultsToSupabase] Error:', res.error);
            } else {
                console.log('[saveResultsToSupabase] Saved ' + rows.length + ' results');
            }
        })
        .catch(function(err) {
            console.warn('[saveResultsToSupabase] Failed:', err);
        });
}

// Экспорт для глобального доступа
if (typeof window !== 'undefined') {
    window.startTest = startTest;
    window.startModuleTest = startModuleTest;
    window.backToModuleSelector = backToModuleSelector;
}
