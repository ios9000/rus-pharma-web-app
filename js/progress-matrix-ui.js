/**
 * ═══════════════════════════════════════════════════════════════════════════
 * МОДУЛЬ ВИЗУАЛИЗАЦИИ МАТРИЦЫ ПРОГРЕССА
 * UI компоненты для отображения прогресса курсанта
 * ═══════════════════════════════════════════════════════════════════════════
 */

const ProgressMatrixUI = (function() {
    'use strict';

    // ========================================================================
    // ШАБЛОНЫ HTML
    // ========================================================================

    /**
     * Рендеринг главного экрана прогресса
     */
    function renderProgressScreen(container) {
        const profile = CadetProgress.getProfile();
        const courseStatus = CadetProgress.getCourseStatus();
        const matrix = CadetProgress.getProgressMatrix();
        const recommendations = CadetProgress.getRecommendations();
        const stats = CadetProgress.getStats();

        container.innerHTML = `
            <div class="progress-screen">
                <!-- Заголовок -->
                <div class="progress-header">
                    <h1>📊 Мой прогресс</h1>
                    <div class="header-actions">
                        <button class="btn-icon" onclick="ProgressMatrixUI.exportReport()" title="Экспорт отчёта">
                            📥
                        </button>
                        <button class="btn-icon" onclick="ProgressMatrixUI.showSettings()" title="Настройки">
                            ⚙️
                        </button>
                    </div>
                </div>

                <!-- Статус курса -->
                ${renderCourseStatus(courseStatus)}

                <!-- Путь обучения -->
                ${renderLearningPath(courseStatus)}

                <!-- Матрица компетенций -->
                ${renderCompetencyMatrix(matrix)}

                <!-- Рекомендации -->
                ${renderRecommendations(recommendations)}

                <!-- Статистика -->
                ${renderStatistics(stats)}

                <!-- Достижения -->
                ${renderAchievementsPreview()}

                <!-- Напоминания -->
                ${renderReminders()}

                <!-- Действия -->
                <div class="progress-actions">
                    <button class="btn btn-primary" onclick="ProgressMatrixUI.goToNextTest()">
                        ${courseStatus.nextTest ? `▶️ ${courseStatus.nextTest.name}` : '✅ Курс пройден'}
                    </button>
                    <button class="btn btn-secondary" onclick="ProgressMatrixUI.exportReport()">
                        📥 Экспорт отчёта
                    </button>
                </div>
            </div>
        `;

        // Добавляем обработчики событий
        attachEventHandlers(container);
    }

    // ========================================================================
    // КОМПОНЕНТЫ
    // ========================================================================

    /**
     * Статус курса
     */
    function renderCourseStatus(status) {
        const statusIcons = {
            'NOT_STARTED': '🔘',
            'IN_PROGRESS': '🔄',
            'COMPLETED': '✅'
        };

        const statusNames = {
            'NOT_STARTED': 'Не начат',
            'IN_PROGRESS': 'В процессе',
            'COMPLETED': 'Завершён'
        };

        return `
            <div class="course-status-card">
                <div class="status-icon">${statusIcons[status.status]}</div>
                <div class="status-info">
                    <div class="status-label">${statusNames[status.status]}</div>
                    <div class="status-details">
                        Пройдено ${status.sectionsPassed} из ${status.totalSections} разделов
                    </div>
                </div>
                <div class="status-progress">
                    <div class="circular-progress" data-progress="${(status.sectionsPassed / status.totalSections) * 100}">
                        <span>${Math.round((status.sectionsPassed / status.totalSections) * 100)}%</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Путь обучения (Learning Path)
     */
    function renderLearningPath(status) {
        const tests = CadetProgress.getProfile().tests;
        
        const steps = [
            { key: 'DIAGNOSTIC', name: 'Вводный', icon: '🎯', result: tests.diagnostic },
            { key: 'SECTION_1', name: 'Разд. 1', icon: '📕', result: tests.sections[1] },
            { key: 'SECTION_2', name: 'Разд. 2', icon: '📗', result: tests.sections[2] },
            { key: 'SECTION_3', name: 'Разд. 3', icon: '📘', result: tests.sections[3] },
            { key: 'SECTION_4', name: 'Разд. 4', icon: '📙', result: tests.sections[4] },
            { key: 'FINAL', name: 'Финал', icon: '🏆', result: tests.final }
        ];

        return `
            <div class="learning-path-card">
                <h3>📋 Путь обучения</h3>
                <div class="learning-path">
                    ${steps.map((step, index) => {
                        const isCompleted = step.result !== null;
                        const isUnlocked = CadetProgress.isTestUnlocked(step.key);
                        const isCurrent = !isCompleted && isUnlocked;
                        
                        let stepClass = 'path-step';
                        if (isCompleted) stepClass += ' completed';
                        else if (isCurrent) stepClass += ' current';
                        else stepClass += ' locked';
                        
                        return `
                            <div class="${stepClass}" data-test="${step.key}">
                                <div class="step-icon">
                                    ${isCompleted ? '✅' : (isCurrent ? '▶️' : '🔒')}
                                </div>
                                <div class="step-name">${step.name}</div>
                                ${isCompleted ? `<div class="step-score">${step.result.overallScore}%</div>` : ''}
                            </div>
                            ${index < steps.length - 1 ? '<div class="path-connector"></div>' : ''}
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Матрица компетенций
     */
    function renderCompetencyMatrix(matrix) {
        const competencies = Object.entries(matrix);
        
        // Фильтруем только те, где есть данные
        const hasData = competencies.some(([id, data]) => data.diagnostic !== null);
        
        if (!hasData) {
            return `
                <div class="competency-matrix-card">
                    <h3>📈 Матрица компетенций</h3>
                    <div class="empty-state">
                        <div class="empty-icon">📊</div>
                        <div class="empty-text">Пройдите вводный тест для формирования матрицы</div>
                        <button class="btn btn-primary" onclick="ProgressMatrixUI.goToTest('DIAGNOSTIC')">
                            🎯 Пройти вводный тест
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="competency-matrix-card">
                <h3>📈 Матрица компетенций</h3>
                <div class="matrix-toggle">
                    <button class="toggle-btn active" data-view="bars">📊 Шкалы</button>
                    <button class="toggle-btn" data-view="table">📋 Таблица</button>
                </div>
                
                <!-- Вид: Шкалы -->
                <div class="matrix-view matrix-bars active">
                    ${competencies.map(([id, data]) => renderCompetencyBar(id, data)).join('')}
                </div>
                
                <!-- Вид: Таблица -->
                <div class="matrix-view matrix-table">
                    ${renderCompetencyTable(matrix)}
                </div>
            </div>
        `;
    }

    /**
     * Шкала компетенции
     */
    function renderCompetencyBar(competencyId, data) {
        const competency = COMPETENCIES[competencyId];
        const currentScore = data.final || data.latest || 0;
        const delta = data.delta || 0;
        
        const trendIcons = {
            'UP': '📈',
            'DOWN': '📉',
            'STABLE': '➡️'
        };
        
        const deltaClass = delta >= 15 ? 'delta-positive' : (delta < 5 ? 'delta-negative' : 'delta-neutral');
        
        return `
            <div class="competency-bar" data-competency="${competencyId}">
                <div class="competency-info">
                    <span class="competency-icon">${competency.icon}</span>
                    <span class="competency-name">${competency.shortName}</span>
                </div>
                <div class="competency-progress">
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${currentScore}%; background-color: ${competency.color}"></div>
                        ${data.diagnostic !== null ? `
                            <div class="progress-marker diagnostic" style="left: ${data.diagnostic}%" title="Вводный: ${data.diagnostic}%"></div>
                        ` : ''}
                    </div>
                    <span class="progress-value">${currentScore}%</span>
                </div>
                <div class="competency-delta ${deltaClass}">
                    ${delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}%` : '-'}
                    ${trendIcons[data.trend] || ''}
                </div>
            </div>
        `;
    }

    /**
     * Таблица компетенций (как на изображении)
     */
    function renderCompetencyTable(matrix) {
        const headers = ['Компетенция', 'Вводный', 'Разд.1', 'Разд.2', 'Разд.3', 'Разд.4', 'Финал', 'Δ Прогресс'];
        
        return `
            <table class="competency-table">
                <thead>
                    <tr>
                        ${headers.map(h => `<th>${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(matrix).map(([id, data]) => {
                        const competency = COMPETENCIES[id];
                        const delta = data.delta || 0;
                        const deltaClass = delta >= 15 ? 'positive' : (delta < 5 ? 'negative' : 'neutral');
                        const deltaIcon = delta >= 15 ? '✅' : (delta < 5 ? '🔴' : '⚠️');
                        
                        return `
                            <tr>
                                <td class="competency-cell">
                                    <span class="icon">${competency.icon}</span>
                                    ${competency.shortName}
                                </td>
                                <td class="score-cell">${formatScore(data.diagnostic)}</td>
                                <td class="score-cell">${formatScore(data.sections[1])}</td>
                                <td class="score-cell">${formatScore(data.sections[2])}</td>
                                <td class="score-cell">${formatScore(data.sections[3])}</td>
                                <td class="score-cell">${formatScore(data.sections[4])}</td>
                                <td class="score-cell">${formatScore(data.final)}</td>
                                <td class="delta-cell ${deltaClass}">
                                    ${delta !== 0 ? `${delta > 0 ? '+' : ''}${delta}%` : '-'} ${deltaIcon}
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    /**
     * Форматирование оценки
     */
    function formatScore(score) {
        if (score === null || score === undefined) return '-';
        return `${score}%`;
    }

    /**
     * Рекомендации
     */
    function renderRecommendations(recommendations) {
        if (!recommendations || !recommendations.items || recommendations.items.length === 0) {
            return `
                <div class="recommendations-card">
                    <h3>💡 Рекомендации</h3>
                    <div class="empty-state">
                        <div class="empty-icon">📝</div>
                        <div class="empty-text">Рекомендации появятся после прохождения тестов</div>
                    </div>
                </div>
            `;
        }

        const priorityClasses = {
            'CRITICAL': 'priority-critical',
            'HIGH': 'priority-high',
            'MEDIUM': 'priority-medium',
            'LOW': 'priority-low'
        };

        return `
            <div class="recommendations-card">
                <h3>💡 Рекомендации</h3>
                <div class="recommendations-list">
                    ${recommendations.items.slice(0, 5).map(rec => `
                        <div class="recommendation-item ${priorityClasses[rec.priority]}">
                            <div class="rec-icon">${rec.icon || RECOMMENDATION_TYPES[rec.type]?.icon || '📌'}</div>
                            <div class="rec-content">
                                <div class="rec-message">${rec.message}</div>
                                <button class="rec-action" onclick="ProgressMatrixUI.handleRecommendation('${rec.type}', '${rec.actionType}', '${JSON.stringify(rec.actionData).replace(/"/g, '&quot;')}')">
                                    ${RECOMMENDATION_TYPES[rec.type]?.actionText || 'Перейти'} →
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Статистика
     */
    function renderStatistics(stats) {
        return `
            <div class="statistics-card">
                <h3>📊 Статистика</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalTestsTaken}</div>
                        <div class="stat-label">Тестов пройдено</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.totalCorrectAnswers}/${stats.totalQuestionsAnswered}</div>
                        <div class="stat-label">Правильных ответов</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${formatTime(stats.totalTimeSpent)}</div>
                        <div class="stat-label">Время обучения</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">🔥 ${stats.currentStreak}</div>
                        <div class="stat-label">Дней подряд</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Форматирование времени
     */
    function formatTime(seconds) {
        if (!seconds) return '0 мин';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours}ч ${minutes}м`;
        }
        return `${minutes} мин`;
    }

    /**
     * Превью достижений
     */
    function renderAchievementsPreview() {
        const achievements = CadetProgress.getAchievements();
        const allAchievements = CadetProgress.getAllAchievements();
        
        return `
            <div class="achievements-card">
                <div class="achievements-header">
                    <h3>🏆 Достижения</h3>
                    <span class="achievements-count">${achievements.length}/${allAchievements.length}</span>
                </div>
                <div class="achievements-preview">
                    ${allAchievements.slice(0, 6).map(ach => `
                        <div class="achievement-badge ${ach.unlocked ? 'unlocked' : 'locked'}" title="${ach.name}: ${ach.description}">
                            ${ach.icon}
                        </div>
                    `).join('')}
                    ${allAchievements.length > 6 ? `
                        <button class="achievement-more" onclick="ProgressMatrixUI.showAllAchievements()">
                            +${allAchievements.length - 6}
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Напоминания
     */
    function renderReminders() {
        const reminders = CadetProgress.getActiveReminders();
        
        if (reminders.length === 0) return '';
        
        return `
            <div class="reminders-card">
                <h3>🔔 Напоминания</h3>
                <div class="reminders-list">
                    ${reminders.slice(0, 3).map(reminder => {
                        const competency = COMPETENCIES[reminder.competency];
                        return `
                            <div class="reminder-item">
                                <div class="reminder-icon">${competency?.icon || '📌'}</div>
                                <div class="reminder-content">
                                    <div class="reminder-activity">${reminder.activityName}</div>
                                    <div class="reminder-competency">${competency?.name || reminder.competency}</div>
                                </div>
                                <button class="reminder-action" onclick="ProgressMatrixUI.handleReminder('${reminder.id}', '${reminder.activity}', '${reminder.competency}')">
                                    Начать
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ОБРАБОТЧИКИ СОБЫТИЙ
    // ========================================================================

    function attachEventHandlers(container) {
        // Переключение вида матрицы
        container.querySelectorAll('.matrix-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const view = this.dataset.view;
                
                // Переключаем активную кнопку
                container.querySelectorAll('.matrix-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Переключаем вид
                container.querySelectorAll('.matrix-view').forEach(v => v.classList.remove('active'));
                container.querySelector(`.matrix-${view}`).classList.add('active');
            });
        });

        // Клик на шаг пути обучения
        container.querySelectorAll('.path-step:not(.locked)').forEach(step => {
            step.addEventListener('click', function() {
                const testKey = this.dataset.test;
                goToTest(testKey);
            });
        });

        // Клик на компетенцию
        container.querySelectorAll('.competency-bar').forEach(bar => {
            bar.addEventListener('click', function() {
                const competencyId = this.dataset.competency;
                showCompetencyDetails(competencyId);
            });
        });
    }

    // ========================================================================
    // ДЕЙСТВИЯ
    // ========================================================================

    /**
     * Переход к тесту
     */
    function goToTest(testKey) {
        if (!CadetProgress.isTestUnlocked(testKey)) {
            showNotification({
                type: 'warning',
                message: 'Этот тест пока заблокирован'
            });
            return;
        }

        // Переход к экрану теста
        if (typeof TestSelector !== 'undefined') {
            TestSelector.startTest(testKey);
        } else {
            console.log('Переход к тесту:', testKey);
            // Можно использовать навигацию приложения
            if (typeof navigateToSection === 'function') {
                navigateToSection('test', { testType: testKey });
            }
        }
    }

    /**
     * Переход к следующему тесту
     */
    function goToNextTest() {
        const nextTest = CadetProgress.getNextAvailableTest();
        if (nextTest) {
            goToTest(nextTest.type === 'SECTION' ? `SECTION_${nextTest.sectionId}` : nextTest.type);
        }
    }

    /**
     * Обработка рекомендации
     */
    function handleRecommendation(type, actionType, actionDataStr) {
        const actionData = JSON.parse(actionDataStr.replace(/&quot;/g, '"'));
        
        switch (actionType) {
            case 'section':
                // Переход к разделу
                if (typeof navigateToSection === 'function') {
                    navigateToSection('test', { section: actionData });
                }
                break;
                
            case 'flashcards':
                // Переход к флэш-картам
                if (typeof navigateToSection === 'function') {
                    navigateToSection('cards', { category: actionData });
                }
                break;
                
            case 'cases':
                // Переход к кейсам
                if (typeof navigateToSection === 'function') {
                    navigateToSection('cases', actionData);
                }
                break;
        }
    }

    /**
     * Обработка напоминания
     */
    function handleReminder(reminderId, activity, competency) {
        // Отмечаем как выполненное
        CadetProgress.completeReminder(reminderId);
        
        // Переходим к соответствующей активности
        switch (activity) {
            case 'flashcards':
                if (typeof navigateToSection === 'function') {
                    navigateToSection('cards', { category: competency });
                }
                break;
                
            case 'mini_test':
            case 'review_test':
                if (typeof navigateToSection === 'function') {
                    navigateToSection('test', { competency: competency });
                }
                break;
                
            case 'case':
                if (typeof navigateToSection === 'function') {
                    navigateToSection('cases', { competency: competency });
                }
                break;
        }
        
        // Обновляем UI
        refreshProgressScreen();
    }

    /**
     * Показать детали компетенции
     */
    function showCompetencyDetails(competencyId) {
        const competency = COMPETENCIES[competencyId];
        const matrix = CadetProgress.getProgressMatrix();
        const data = matrix[competencyId];
        
        // Создаём модальное окно с графиком прогресса
        const modal = document.createElement('div');
        modal.className = 'modal competency-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${competency.icon} ${competency.name}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <p class="competency-description">${competency.description}</p>
                    
                    <div class="progress-chart">
                        <h4>📈 История прогресса</h4>
                        <div class="chart-container" id="competency-chart-${competencyId}">
                            ${renderProgressChart(data)}
                        </div>
                    </div>
                    
                    <div class="competency-stats">
                        <div class="stat">
                            <span class="label">Начальный уровень:</span>
                            <span class="value">${data.diagnostic ?? '-'}%</span>
                        </div>
                        <div class="stat">
                            <span class="label">Текущий уровень:</span>
                            <span class="value">${data.final || data.latest || '-'}%</span>
                        </div>
                        <div class="stat">
                            <span class="label">Прогресс:</span>
                            <span class="value ${data.delta >= 15 ? 'positive' : 'negative'}">
                                ${data.delta > 0 ? '+' : ''}${data.delta}%
                            </span>
                        </div>
                    </div>
                    
                    <div class="competency-actions">
                        <button class="btn btn-primary" onclick="ProgressMatrixUI.practiceCompetency('${competencyId}')">
                            🎴 Флэш-карты
                        </button>
                        <button class="btn btn-secondary" onclick="ProgressMatrixUI.testCompetency('${competencyId}')">
                            📝 Тест
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Рендеринг простого графика прогресса
     */
    function renderProgressChart(data) {
        const history = data.history || [];
        
        if (history.length < 2) {
            return '<div class="no-chart">Недостаточно данных для графика</div>';
        }
        
        const maxScore = 100;
        const chartHeight = 150;
        const chartWidth = 300;
        const points = history.map((item, index) => {
            const x = (index / (history.length - 1)) * chartWidth;
            const y = chartHeight - (item.score / maxScore) * chartHeight;
            return `${x},${y}`;
        });
        
        return `
            <svg class="progress-svg" viewBox="0 0 ${chartWidth} ${chartHeight}" preserveAspectRatio="none">
                <polyline 
                    points="${points.join(' ')}" 
                    fill="none" 
                    stroke="var(--primary-color)" 
                    stroke-width="2"
                />
                ${history.map((item, index) => {
                    const x = (index / (history.length - 1)) * chartWidth;
                    const y = chartHeight - (item.score / maxScore) * chartHeight;
                    return `<circle cx="${x}" cy="${y}" r="4" fill="var(--primary-color)" />`;
                }).join('')}
            </svg>
            <div class="chart-labels">
                ${history.map((item, index) => `
                    <span class="chart-label" style="left: ${(index / (history.length - 1)) * 100}%">
                        ${item.score}%
                    </span>
                `).join('')}
            </div>
        `;
    }

    /**
     * Экспорт отчёта
     */
    function exportReport() {
        const report = CadetProgress.exportProgressReport();
        const json = JSON.stringify(report, null, 2);
        
        // Создаём blob и скачиваем
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `progress_report_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification({
            type: 'success',
            message: 'Отчёт успешно экспортирован'
        });
    }

    /**
     * Показать все достижения
     */
    function showAllAchievements() {
        const achievements = CadetProgress.getAllAchievements();
        
        const modal = document.createElement('div');
        modal.className = 'modal achievements-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🏆 Все достижения</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="achievements-grid">
                        ${achievements.map(ach => `
                            <div class="achievement-card ${ach.unlocked ? 'unlocked' : 'locked'}">
                                <div class="achievement-icon">${ach.icon}</div>
                                <div class="achievement-name">${ach.name}</div>
                                <div class="achievement-desc">${ach.description}</div>
                                ${ach.unlocked ? '<div class="achievement-status">✅ Получено</div>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    /**
     * Показать настройки
     */
    function showSettings() {
        // TODO: Реализовать модальное окно настроек
        console.log('Показать настройки');
    }

    /**
     * Обновление экрана прогресса
     */
    function refreshProgressScreen() {
        const container = document.querySelector('.progress-screen')?.parentElement;
        if (container) {
            renderProgressScreen(container);
        }
    }

    /**
     * Практика компетенции (флэш-карты)
     */
    function practiceCompetency(competencyId) {
        if (typeof navigateToSection === 'function') {
            navigateToSection('cards', { category: competencyId });
        }
        
        // Закрываем модальное окно
        document.querySelector('.competency-modal')?.remove();
    }

    /**
     * Тест компетенции
     */
    function testCompetency(competencyId) {
        if (typeof navigateToSection === 'function') {
            navigateToSection('test', { competency: competencyId });
        }
        
        // Закрываем модальное окно
        document.querySelector('.competency-modal')?.remove();
    }

    // ========================================================================
    // ПУБЛИЧНЫЙ API
    // ========================================================================

    return {
        // Рендеринг
        renderProgressScreen,
        renderCompetencyMatrix,
        renderLearningPath,
        renderRecommendations,
        refreshProgressScreen,
        
        // Действия
        goToTest,
        goToNextTest,
        handleRecommendation,
        handleReminder,
        showCompetencyDetails,
        exportReport,
        showAllAchievements,
        showSettings,
        practiceCompetency,
        testCompetency
    };

})();

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressMatrixUI;
}
