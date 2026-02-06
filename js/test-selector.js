/**
 * ═══════════════════════════════════════════════════════════════════════════
 * МОДУЛЬ ВЫБОРА И ЗАПУСКА ТЕСТОВ
 * Управление типами тестов: вводный, промежуточные, финальный
 * ═══════════════════════════════════════════════════════════════════════════
 */

const TestSelector = (function() {
    'use strict';

    // ========================================================================
    // СОСТОЯНИЕ
    // ========================================================================
    
    let currentTest = null;
    let currentQuestions = [];
    let currentQuestionIndex = 0;
    let answers = [];
    let startTime = null;
    let timerInterval = null;

    // ========================================================================
    // РЕНДЕРИНГ ЭКРАНА ВЫБОРА ТЕСТА
    // ========================================================================

    /**
     * Рендеринг главного экрана выбора теста
     */
    function renderTestSelector(container) {
        const courseStatus = CadetProgress.getCourseStatus();
        const profile = CadetProgress.getProfile();

        container.innerHTML = `
            <div class="test-selector-screen">
                <div class="test-selector-header">
                    <h1>📚 Тестирование</h1>
                    <p class="subtitle">Выберите тип теста для прохождения</p>
                </div>

                <!-- Вводный тест -->
                ${renderDiagnosticCard(profile.tests.diagnostic, courseStatus)}

                <!-- Промежуточные тесты -->
                ${renderSectionTestsCard(profile.tests.sections, courseStatus)}

                <!-- Финальный тест -->
                ${renderFinalTestCard(profile.tests.final, courseStatus)}

                <!-- Быстрая практика -->
                ${renderQuickPracticeCard()}
            </div>
        `;
    }

    /**
     * Карточка вводного теста
     */
    function renderDiagnosticCard(diagnosticResult, courseStatus) {
        const testConfig = TEST_TYPES.DIAGNOSTIC;
        const isPassed = diagnosticResult !== null;
        
        return `
            <div class="test-card ${isPassed ? 'completed' : 'available'}">
                <div class="test-card-header" style="background-color: ${testConfig.color}20; border-left: 4px solid ${testConfig.color}">
                    <div class="test-icon">${testConfig.icon}</div>
                    <div class="test-info">
                        <h3>${testConfig.name}</h3>
                        <p>${testConfig.description}</p>
                    </div>
                    ${isPassed ? `<div class="test-status">✅ Пройден</div>` : ''}
                </div>
                
                <div class="test-card-body">
                    <div class="test-meta">
                        <span>📝 ${testConfig.questionsCount} вопросов</span>
                        <span>⏱️ ${testConfig.timeLimit} минут</span>
                        <span>🎯 Все компетенции</span>
                    </div>
                    
                    ${isPassed ? `
                        <div class="test-result">
                            <div class="result-score">
                                <span class="score-value">${diagnosticResult.overallScore}%</span>
                                <span class="score-label">Результат</span>
                            </div>
                            <div class="result-date">
                                Пройден: ${formatDate(diagnosticResult.timestamp)}
                            </div>
                        </div>
                        <div class="test-actions">
                            <button class="btn btn-secondary" onclick="TestSelector.viewResults('DIAGNOSTIC')">
                                📊 Посмотреть результаты
                            </button>
                        </div>
                    ` : `
                        <div class="test-actions">
                            <button class="btn btn-primary btn-large" onclick="TestSelector.startTest('DIAGNOSTIC')">
                                ▶️ Начать тест
                            </button>
                        </div>
                        <div class="test-notice">
                            <span class="notice-icon">💡</span>
                            <span>Этот тест определит ваш начальный уровень знаний</span>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Карточка промежуточных тестов
     */
    function renderSectionTestsCard(sectionsResults, courseStatus) {
        return `
            <div class="test-card section-tests-card">
                <div class="test-card-header">
                    <div class="test-icon">📚</div>
                    <div class="test-info">
                        <h3>Промежуточные тесты</h3>
                        <p>Проверка знаний по каждому разделу курса</p>
                    </div>
                    <div class="sections-progress">
                        ${Object.keys(sectionsResults).length}/4
                    </div>
                </div>
                
                <div class="test-card-body">
                    <div class="sections-list">
                        ${[1, 2, 3, 4].map(sectionId => {
                            const testKey = `SECTION_${sectionId}`;
                            const testConfig = TEST_TYPES[testKey];
                            const result = sectionsResults[sectionId];
                            const isUnlocked = CadetProgress.isTestUnlocked(testKey);
                            const isPassed = result !== null;
                            
                            let statusClass = 'locked';
                            let statusIcon = '🔒';
                            
                            if (isPassed) {
                                statusClass = result.overallScore >= testConfig.passingScore ? 'passed' : 'failed';
                                statusIcon = result.overallScore >= testConfig.passingScore ? '✅' : '⚠️';
                            } else if (isUnlocked) {
                                statusClass = 'available';
                                statusIcon = '▶️';
                            }
                            
                            return `
                                <div class="section-item ${statusClass}" data-section="${sectionId}">
                                    <div class="section-icon" style="background-color: ${testConfig.color}">
                                        ${testConfig.icon}
                                    </div>
                                    <div class="section-info">
                                        <div class="section-name">${testConfig.fullName}</div>
                                        <div class="section-meta">
                                            ${testConfig.questionsCount} вопросов • ${testConfig.timeLimit} мин
                                        </div>
                                    </div>
                                    <div class="section-status">
                                        ${isPassed ? `
                                            <span class="score">${result.overallScore}%</span>
                                        ` : ''}
                                        <span class="status-icon">${statusIcon}</span>
                                    </div>
                                    ${isUnlocked && !isPassed ? `
                                        <button class="btn btn-small btn-primary" onclick="TestSelector.startTest('${testKey}')">
                                            Начать
                                        </button>
                                    ` : ''}
                                    ${isPassed ? `
                                        <button class="btn btn-small btn-secondary" onclick="TestSelector.startTest('${testKey}')">
                                            Пересдать
                                        </button>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Карточка финального теста
     */
    function renderFinalTestCard(finalResult, courseStatus) {
        const testConfig = TEST_TYPES.FINAL;
        const isUnlocked = CadetProgress.isTestUnlocked('FINAL');
        const isPassed = finalResult !== null && finalResult.overallScore >= testConfig.passingScore;
        
        return `
            <div class="test-card final-test-card ${!isUnlocked ? 'locked' : (isPassed ? 'completed' : 'available')}">
                <div class="test-card-header" style="background: linear-gradient(135deg, ${testConfig.color}40, ${testConfig.color}20)">
                    <div class="test-icon">${testConfig.icon}</div>
                    <div class="test-info">
                        <h3>${testConfig.name}</h3>
                        <p>${testConfig.description}</p>
                    </div>
                    ${isPassed ? `<div class="test-status certified">🎖️ Сертифицирован</div>` : ''}
                </div>
                
                <div class="test-card-body">
                    <div class="test-meta">
                        <span>📝 ${testConfig.questionsCount} вопросов</span>
                        <span>⏱️ ${testConfig.timeLimit} минут</span>
                        <span>🎯 Порог: ${testConfig.passingScore}%</span>
                    </div>
                    
                    ${!isUnlocked ? `
                        <div class="locked-notice">
                            <span class="lock-icon">🔒</span>
                            <span>Доступен после прохождения всех разделов</span>
                        </div>
                    ` : isPassed ? `
                        <div class="test-result success">
                            <div class="result-score">
                                <span class="score-value">${finalResult.overallScore}%</span>
                                <span class="score-label">Финальный результат</span>
                            </div>
                            <div class="certificate-info">
                                🎖️ Курс успешно завершён!
                            </div>
                        </div>
                        <div class="test-actions">
                            <button class="btn btn-secondary" onclick="TestSelector.viewResults('FINAL')">
                                📊 Результаты
                            </button>
                            <button class="btn btn-primary" onclick="TestSelector.downloadCertificate()">
                                📜 Сертификат
                            </button>
                        </div>
                    ` : finalResult ? `
                        <div class="test-result failed">
                            <div class="result-score">
                                <span class="score-value">${finalResult.overallScore}%</span>
                                <span class="score-label">Не сдано (нужно ${testConfig.passingScore}%)</span>
                            </div>
                        </div>
                        <div class="test-actions">
                            <button class="btn btn-primary" onclick="TestSelector.startTest('FINAL')">
                                🔄 Пересдать
                            </button>
                        </div>
                    ` : `
                        <div class="test-actions">
                            <button class="btn btn-primary btn-large" onclick="TestSelector.startTest('FINAL')">
                                ▶️ Начать аттестацию
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    /**
     * Карточка быстрой практики
     */
    function renderQuickPracticeCard() {
        return `
            <div class="test-card quick-practice-card">
                <div class="test-card-header">
                    <div class="test-icon">⚡</div>
                    <div class="test-info">
                        <h3>Быстрая практика</h3>
                        <p>Тренировка по выбранным компетенциям</p>
                    </div>
                </div>
                
                <div class="test-card-body">
                    <div class="competencies-selector">
                        ${Object.entries(COMPETENCIES).map(([id, comp]) => `
                            <label class="competency-checkbox">
                                <input type="checkbox" value="${id}" checked>
                                <span class="checkbox-icon">${comp.icon}</span>
                                <span class="checkbox-label">${comp.shortName}</span>
                            </label>
                        `).join('')}
                    </div>
                    
                    <div class="practice-options">
                        <div class="option-group">
                            <label>Количество вопросов:</label>
                            <select id="practiceQuestionCount">
                                <option value="5">5 вопросов</option>
                                <option value="10" selected>10 вопросов</option>
                                <option value="20">20 вопросов</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="test-actions">
                        <button class="btn btn-primary" onclick="TestSelector.startQuickPractice()">
                            ⚡ Начать практику
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ЗАПУСК ТЕСТА
    // ========================================================================

    /**
     * Запуск теста по типу
     */
    function startTest(testTypeKey) {
        const testConfig = TEST_TYPES[testTypeKey];
        
        if (!testConfig) {
            console.error('Неизвестный тип теста:', testTypeKey);
            return;
        }

        // Проверяем доступность
        if (!CadetProgress.isTestUnlocked(testTypeKey) && testTypeKey !== 'DIAGNOSTIC') {
            showNotification({
                type: 'warning',
                message: 'Этот тест пока заблокирован'
            });
            return;
        }

        // Инициализируем состояние теста
        currentTest = {
            type: testConfig.type,
            typeKey: testTypeKey,
            sectionId: testConfig.sectionId || null,
            config: testConfig
        };

        // Загружаем вопросы
        loadQuestionsForTest(testConfig)
            .then(questions => {
                if (questions.length === 0) {
                    showNotification({
                        type: 'error',
                        message: 'Не удалось загрузить вопросы для теста'
                    });
                    return;
                }

                currentQuestions = shuffleArray(questions).slice(0, testConfig.questionsCount);
                currentQuestionIndex = 0;
                answers = [];
                startTime = Date.now();

                // Запускаем таймер
                if (testConfig.timeLimit) {
                    startTimer(testConfig.timeLimit * 60);
                }

                // Показываем экран теста
                renderTestScreen();
            })
            .catch(error => {
                console.error('Ошибка загрузки вопросов:', error);
                showNotification({
                    type: 'error',
                    message: 'Ошибка загрузки вопросов'
                });
            });
    }

    /**
     * Загрузка вопросов для теста
     */
    async function loadQuestionsForTest(testConfig) {
        // Пытаемся загрузить из appData
        let allQuestions = [];
        
        if (typeof window !== 'undefined' && window.appData && window.appData.questions) {
            allQuestions = window.appData.questions;
        } else if (typeof FALLBACK_DATA !== 'undefined' && FALLBACK_DATA.questions) {
            allQuestions = FALLBACK_DATA.questions;
        }

        // Фильтруем по компетенциям теста
        const filteredQuestions = allQuestions.filter(q => {
            // Если у вопроса указана компетенция, проверяем её
            if (q.competency) {
                return testConfig.competencies.includes(q.competency);
            }
            // Если нет - включаем все вопросы (для обратной совместимости)
            return true;
        });

        return filteredQuestions;
    }

    /**
     * Быстрая практика
     */
    function startQuickPractice() {
        const checkboxes = document.querySelectorAll('.competency-checkbox input:checked');
        const selectedCompetencies = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedCompetencies.length === 0) {
            showNotification({
                type: 'warning',
                message: 'Выберите хотя бы одну компетенцию'
            });
            return;
        }

        const questionCount = parseInt(document.getElementById('practiceQuestionCount').value) || 10;

        // Создаём конфигурацию практики
        const practiceConfig = {
            type: 'PRACTICE',
            name: 'Быстрая практика',
            questionsCount: questionCount,
            timeLimit: null, // Без ограничения времени
            competencies: selectedCompetencies
        };

        currentTest = {
            type: 'PRACTICE',
            typeKey: 'PRACTICE',
            config: practiceConfig
        };

        loadQuestionsForTest(practiceConfig)
            .then(questions => {
                currentQuestions = shuffleArray(questions).slice(0, questionCount);
                currentQuestionIndex = 0;
                answers = [];
                startTime = Date.now();

                renderTestScreen();
            });
    }

    // ========================================================================
    // ЭКРАН ТЕСТА
    // ========================================================================

    /**
     * Рендеринг экрана теста
     */
    function renderTestScreen() {
        const container = document.querySelector('.main-content') || document.body;
        const question = currentQuestions[currentQuestionIndex];
        
        container.innerHTML = `
            <div class="test-screen">
                <!-- Шапка теста -->
                <div class="test-header">
                    <div class="test-title">
                        <span class="test-icon">${currentTest.config.icon || '📝'}</span>
                        <span>${currentTest.config.name}</span>
                    </div>
                    <div class="test-progress">
                        <span>Вопрос ${currentQuestionIndex + 1} из ${currentQuestions.length}</span>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%"></div>
                        </div>
                    </div>
                    ${currentTest.config.timeLimit ? `
                        <div class="test-timer" id="testTimer">
                            ⏱️ <span id="timerDisplay">--:--</span>
                        </div>
                    ` : ''}
                </div>

                <!-- Вопрос -->
                <div class="question-container">
                    ${question.imageUrl ? `
                        <div class="question-image">
                            <img src="${convertGoogleDriveUrl(question.imageUrl)}" alt="Изображение к вопросу" onclick="zoomImage(this.src)">
                        </div>
                    ` : ''}
                    
                    <div class="question-text">
                        <span class="question-number">Вопрос ${currentQuestionIndex + 1}</span>
                        <p>${question.question}</p>
                    </div>

                    <div class="answers-list">
                        ${question.answers.map((answer, index) => `
                            <button class="answer-btn" data-index="${index}" onclick="TestSelector.selectAnswer(${index})">
                                <span class="answer-letter">${['A', 'B', 'C', 'D'][index]}</span>
                                <span class="answer-text">${answer}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Навигация -->
                <div class="test-navigation">
                    <button class="btn btn-secondary" onclick="TestSelector.exitTest()" style="margin-right: auto;">
                        ✕ Выйти
                    </button>
                    ${currentQuestionIndex > 0 ? `
                        <button class="btn btn-secondary" onclick="TestSelector.prevQuestion()">
                            ← Назад
                        </button>
                    ` : ''}
                    <button class="btn btn-primary" onclick="TestSelector.nextQuestion()" id="nextBtn" disabled>
                        ${currentQuestionIndex === currentQuestions.length - 1 ? 'Завершить' : 'Далее →'}
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Выбор ответа
     */
    function selectAnswer(answerIndex) {
        // Убираем предыдущий выбор
        document.querySelectorAll('.answer-btn').forEach(btn => btn.classList.remove('selected'));
        
        // Выбираем новый ответ
        const selectedBtn = document.querySelector(`.answer-btn[data-index="${answerIndex}"]`);
        selectedBtn.classList.add('selected');
        
        // Сохраняем ответ
        answers[currentQuestionIndex] = {
            questionId: currentQuestions[currentQuestionIndex].id,
            competency: currentQuestions[currentQuestionIndex].competency || 'UNKNOWN',
            selectedAnswer: answerIndex,
            correct: answerIndex === currentQuestions[currentQuestionIndex].correct,
            timeSpent: Date.now() - startTime
        };
        
        // Активируем кнопку "Далее"
        document.getElementById('nextBtn').disabled = false;
    }

    /**
     * Следующий вопрос
     */
    function nextQuestion() {
        if (answers[currentQuestionIndex] === undefined) {
            showNotification({
                type: 'warning',
                message: 'Выберите ответ'
            });
            return;
        }

        if (currentQuestionIndex === currentQuestions.length - 1) {
            // Последний вопрос - завершаем тест
            finishTest();
        } else {
            currentQuestionIndex++;
            renderTestScreen();
            
            // Восстанавливаем выбор если есть
            if (answers[currentQuestionIndex]) {
                const btn = document.querySelector(`.answer-btn[data-index="${answers[currentQuestionIndex].selectedAnswer}"]`);
                if (btn) {
                    btn.classList.add('selected');
                    document.getElementById('nextBtn').disabled = false;
                }
            }
        }
    }

    /**
     * Предыдущий вопрос
     */
    function prevQuestion() {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            renderTestScreen();
            
            // Восстанавливаем выбор
            if (answers[currentQuestionIndex]) {
                const btn = document.querySelector(`.answer-btn[data-index="${answers[currentQuestionIndex].selectedAnswer}"]`);
                if (btn) {
                    btn.classList.add('selected');
                    document.getElementById('nextBtn').disabled = false;
                }
            }
        }
    }

    /**
     * Выход из теста
     */
    function exitTest() {
        if (confirm('Вы уверены, что хотите выйти? Прогресс будет потерян.')) {
            stopTimer();
            currentTest = null;
            currentQuestions = [];
            answers = [];
            
            // Возвращаемся к экрану выбора теста
            const container = document.querySelector('.main-content') || document.body;
            renderTestSelector(container);
        }
    }

    // ========================================================================
    // ЗАВЕРШЕНИЕ ТЕСТА
    // ========================================================================

    /**
     * Завершение теста и подсчёт результатов
     */
    function finishTest() {
        stopTimer();
        
        const duration = Math.round((Date.now() - startTime) / 1000);
        
        // Подсчёт результатов по компетенциям
        const competencyScores = calculateCompetencyScores();
        
        // Общие результаты
        const correctAnswers = answers.filter(a => a.correct).length;
        const overallScore = Math.round((correctAnswers / currentQuestions.length) * 100);
        
        // Формируем результат теста
        const testResult = {
            testType: currentTest.type,
            sectionId: currentTest.sectionId,
            timestamp: new Date().toISOString(),
            duration,
            totalQuestions: currentQuestions.length,
            correctAnswers,
            overallScore,
            competencyScores,
            answers
        };
        
        // Сохраняем результат (кроме практики)
        if (currentTest.type !== 'PRACTICE') {
            CadetProgress.saveTestResult(testResult);
        }
        
        // Показываем результаты
        renderTestResults(testResult);
    }

    /**
     * Подсчёт результатов по компетенциям
     */
    function calculateCompetencyScores() {
        const scores = {};
        
        // Группируем ответы по компетенциям
        answers.forEach(answer => {
            const competency = answer.competency || 'UNKNOWN';
            
            if (!scores[competency]) {
                scores[competency] = { correct: 0, total: 0, score: 0 };
            }
            
            scores[competency].total++;
            if (answer.correct) {
                scores[competency].correct++;
            }
        });
        
        // Вычисляем проценты
        Object.keys(scores).forEach(competency => {
            scores[competency].score = Math.round(
                (scores[competency].correct / scores[competency].total) * 100
            );
        });
        
        return scores;
    }

    /**
     * Рендеринг результатов теста
     */
    function renderTestResults(result) {
        const container = document.querySelector('.main-content') || document.body;
        const isPassed = currentTest.config.passingScore ? 
            result.overallScore >= currentTest.config.passingScore : true;
        
        container.innerHTML = `
            <div class="test-results-screen">
                <div class="results-header ${isPassed ? 'success' : 'failed'}">
                    <div class="results-icon">${isPassed ? '🎉' : '📚'}</div>
                    <h1>${isPassed ? 'Отлично!' : 'Тест завершён'}</h1>
                    <p>${isPassed ? 'Вы успешно прошли тест!' : 'Рекомендуем повторить материал'}</p>
                </div>

                <div class="results-score">
                    <div class="score-circle ${isPassed ? 'passed' : 'failed'}">
                        <span class="score-value">${result.overallScore}%</span>
                        <span class="score-label">Результат</span>
                    </div>
                    <div class="score-details">
                        <div class="detail">
                            <span class="detail-value">${result.correctAnswers}/${result.totalQuestions}</span>
                            <span class="detail-label">Правильных ответов</span>
                        </div>
                        <div class="detail">
                            <span class="detail-value">${formatDuration(result.duration)}</span>
                            <span class="detail-label">Время</span>
                        </div>
                        ${currentTest.config.passingScore ? `
                            <div class="detail">
                                <span class="detail-value">${currentTest.config.passingScore}%</span>
                                <span class="detail-label">Проходной балл</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Результаты по компетенциям -->
                <div class="competency-results">
                    <h3>📊 Результаты по компетенциям</h3>
                    <div class="competency-list">
                        ${Object.entries(result.competencyScores).map(([compId, scores]) => {
                            const competency = COMPETENCIES[compId] || { name: compId, icon: '📌', color: '#666' };
                            const scoreClass = scores.score >= 70 ? 'good' : (scores.score >= 50 ? 'medium' : 'low');
                            
                            return `
                                <div class="competency-result ${scoreClass}">
                                    <div class="competency-info">
                                        <span class="icon">${competency.icon}</span>
                                        <span class="name">${competency.name || compId}</span>
                                    </div>
                                    <div class="competency-score">
                                        <div class="score-bar">
                                            <div class="score-fill" style="width: ${scores.score}%; background-color: ${competency.color}"></div>
                                        </div>
                                        <span class="score-text">${scores.score}%</span>
                                    </div>
                                    <span class="score-fraction">${scores.correct}/${scores.total}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Рекомендации -->
                ${renderResultRecommendations(result)}

                <!-- Действия -->
                <div class="results-actions">
                    <button class="btn btn-secondary" onclick="TestSelector.viewAnswers()">
                        📋 Посмотреть ответы
                    </button>
                    <button class="btn btn-primary" onclick="TestSelector.backToSelector()">
                        ← К тестам
                    </button>
                    ${!isPassed && currentTest.config.canRetake ? `
                        <button class="btn btn-primary" onclick="TestSelector.startTest('${currentTest.typeKey}')">
                            🔄 Пересдать
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Рекомендации на основе результатов
     */
    function renderResultRecommendations(result) {
        const weakCompetencies = Object.entries(result.competencyScores)
            .filter(([_, scores]) => scores.score < 60)
            .map(([compId, _]) => COMPETENCIES[compId])
            .filter(Boolean);

        if (weakCompetencies.length === 0) {
            return `
                <div class="result-recommendations success">
                    <h3>💡 Рекомендации</h3>
                    <p>🎉 Отличный результат! Продолжайте практиковаться для закрепления знаний.</p>
                </div>
            `;
        }

        return `
            <div class="result-recommendations warning">
                <h3>💡 Рекомендации</h3>
                <p>Уделите внимание следующим темам:</p>
                <ul class="weak-competencies">
                    ${weakCompetencies.map(comp => `
                        <li>
                            <span class="icon">${comp.icon}</span>
                            <span class="name">${comp.name}</span>
                            <span class="sections">Разделы: ${comp.sections.join(', ')}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }

    // ========================================================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================================================

    /**
     * Таймер теста
     */
    function startTimer(seconds) {
        let remaining = seconds;
        
        const updateDisplay = () => {
            const minutes = Math.floor(remaining / 60);
            const secs = remaining % 60;
            const display = document.getElementById('timerDisplay');
            if (display) {
                display.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;
                
                // Предупреждение при малом времени
                if (remaining <= 60) {
                    display.parentElement.classList.add('warning');
                }
            }
        };
        
        updateDisplay();
        
        timerInterval = setInterval(() => {
            remaining--;
            updateDisplay();
            
            if (remaining <= 0) {
                clearInterval(timerInterval);
                showNotification({
                    type: 'warning',
                    message: 'Время вышло!'
                });
                finishTest();
            }
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    /**
     * Перемешивание массива
     */
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    /**
     * Форматирование даты
     */
    function formatDate(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('ru-RU');
    }

    /**
     * Форматирование длительности
     */
    function formatDuration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * Конвертация URL Google Drive
     */
    function convertGoogleDriveUrl(url) {
        if (!url) return '';
        
        // Если это уже прямая ссылка
        if (url.includes('lh3.googleusercontent.com')) {
            return url;
        }
        
        // Извлекаем ID файла из URL Google Drive
        const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
            return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
        }
        
        return url;
    }

    /**
     * Возврат к селектору тестов
     */
    function backToSelector() {
        const container = document.querySelector('.main-content') || document.body;
        renderTestSelector(container);
    }

    /**
     * Просмотр ответов
     */
    function viewAnswers() {
        // TODO: Реализовать просмотр детальных ответов
        console.log('Просмотр ответов:', answers);
    }

    /**
     * Просмотр результатов теста
     */
    function viewResults(testTypeKey) {
        const profile = CadetProgress.getProfile();
        let result = null;
        
        if (testTypeKey === 'DIAGNOSTIC') {
            result = profile.tests.diagnostic;
        } else if (testTypeKey === 'FINAL') {
            result = profile.tests.final;
        } else if (testTypeKey.startsWith('SECTION_')) {
            const sectionId = parseInt(testTypeKey.replace('SECTION_', ''));
            result = profile.tests.sections[sectionId];
        }
        
        if (result) {
            // Показываем результаты
            currentTest = { config: TEST_TYPES[testTypeKey], type: TEST_TYPES[testTypeKey].type };
            renderTestResults(result);
        }
    }

    /**
     * Скачивание сертификата
     */
    function downloadCertificate() {
        // TODO: Реализовать генерацию сертификата
        showNotification({
            type: 'info',
            message: 'Генерация сертификата в разработке'
        });
    }

    // ========================================================================
    // ПУБЛИЧНЫЙ API
    // ========================================================================

    return {
        renderTestSelector,
        startTest,
        startQuickPractice,
        selectAnswer,
        nextQuestion,
        prevQuestion,
        exitTest,
        backToSelector,
        viewAnswers,
        viewResults,
        downloadCertificate
    };

})();

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestSelector;
}
