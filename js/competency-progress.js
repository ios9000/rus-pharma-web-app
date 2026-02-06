/**
 * ═══════════════════════════════════════════════════════════════════════════
 * МОДУЛЬ ПРОГРЕССА КУРСАНТА
 * Управление профилем, матрицей компетенций и историей тестов
 * ═══════════════════════════════════════════════════════════════════════════
 */

const CadetProgress = (function() {
    'use strict';

    // ========================================================================
    // КОНСТАНТЫ
    // ========================================================================
    
    const STORAGE_KEY = 'cadet_progress_profile';
    const VERSION = '1.0.0';

    // ========================================================================
    // ПРИВАТНОЕ СОСТОЯНИЕ
    // ========================================================================
    
    let currentProfile = null;

    // ========================================================================
    // ИНИЦИАЛИЗАЦИЯ ПРОФИЛЯ
    // ========================================================================

    /**
     * Создание нового профиля курсанта
     */
    function createNewProfile(name = null) {
        return {
            version: VERSION,
            cadetId: generateCadetId(),
            name: name,
            createdAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
            
            // Статус курса
            courseStatus: 'NOT_STARTED', // NOT_STARTED, IN_PROGRESS, COMPLETED
            
            // История тестов
            tests: {
                diagnostic: null,
                sections: {},
                final: null,
                history: [] // Все попытки
            },
            
            // Матрица прогресса по компетенциям
            progressMatrix: initializeProgressMatrix(),
            
            // Рекомендации
            recommendations: {
                generated: null,
                items: []
            },
            
            // Статистика
            stats: {
                totalTestsTaken: 0,
                totalQuestionsAnswered: 0,
                totalCorrectAnswers: 0,
                totalTimeSpent: 0, // секунды
                cardsKnown: 0,
                cardsTotal: 0,
                casesCompleted: 0,
                casesTotal: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null
            },
            
            // Достижения
            achievements: [],
            
            // Напоминания (Spaced Repetition)
            reminders: [],
            
            // Настройки
            settings: {
                showHints: true,
                soundEnabled: false,
                notificationsEnabled: false
            }
        };
    }

    /**
     * Инициализация матрицы прогресса для всех компетенций
     */
    function initializeProgressMatrix() {
        const matrix = {};
        
        for (const competencyId of Object.keys(COMPETENCIES)) {
            matrix[competencyId] = {
                diagnostic: null,
                sections: {},
                final: null,
                latest: null,
                delta: 0,
                trend: 'STABLE', // UP, DOWN, STABLE
                history: []
            };
        }
        
        return matrix;
    }

    /**
     * Генерация уникального ID курсанта
     */
    function generateCadetId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 8);
        return `cadet_${timestamp}_${random}`;
    }

    // ========================================================================
    // ЗАГРУЗКА И СОХРАНЕНИЕ
    // ========================================================================

    /**
     * Загрузка профиля из localStorage
     */
    function loadProfile() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            
            if (saved) {
                currentProfile = JSON.parse(saved);
                
                // Миграция старых версий
                currentProfile = migrateProfile(currentProfile);
                
                // Обновляем время активности
                currentProfile.lastActiveAt = new Date().toISOString();
                updateStreak();
                
                console.log('📊 Профиль курсанта загружен:', currentProfile.cadetId);
            } else {
                currentProfile = createNewProfile();
                console.log('📊 Создан новый профиль курсанта');
            }
            
            saveProfile();
            return currentProfile;
            
        } catch (error) {
            console.error('❌ Ошибка загрузки профиля:', error);
            currentProfile = createNewProfile();
            return currentProfile;
        }
    }

    /**
     * Сохранение профиля в localStorage
     */
    function saveProfile() {
        try {
            if (currentProfile) {
                currentProfile.lastActiveAt = new Date().toISOString();
                localStorage.setItem(STORAGE_KEY, JSON.stringify(currentProfile));
            }
        } catch (error) {
            console.error('❌ Ошибка сохранения профиля:', error);
        }
    }

    /**
     * Миграция профиля со старых версий
     */
    function migrateProfile(profile) {
        if (!profile.version) {
            profile.version = '0.9.0';
        }
        
        // Добавляем новые поля если их нет
        if (!profile.progressMatrix) {
            profile.progressMatrix = initializeProgressMatrix();
        }
        
        if (!profile.stats) {
            profile.stats = {
                totalTestsTaken: 0,
                totalQuestionsAnswered: 0,
                totalCorrectAnswers: 0,
                totalTimeSpent: 0,
                cardsKnown: 0,
                cardsTotal: 0,
                casesCompleted: 0,
                casesTotal: 0,
                currentStreak: 0,
                longestStreak: 0,
                lastActivityDate: null
            };
        }
        
        if (!profile.achievements) {
            profile.achievements = [];
        }
        
        if (!profile.reminders) {
            profile.reminders = [];
        }
        
        profile.version = VERSION;
        return profile;
    }

    // ========================================================================
    // ЗАПИСЬ РЕЗУЛЬТАТОВ ТЕСТА
    // ========================================================================

    /**
     * Сохранение результата теста
     * @param {Object} testResult - Результат теста
     */
    function saveTestResult(testResult) {
        if (!currentProfile) loadProfile();
        
        const { testType, sectionId, competencyScores, overallScore, duration } = testResult;
        
        // Генерируем ID теста
        testResult.testId = `test_${Date.now()}_${testType}`;
        testResult.timestamp = new Date().toISOString();
        
        // Сохраняем в соответствующую категорию
        switch (testType) {
            case 'DIAGNOSTIC':
                currentProfile.tests.diagnostic = testResult;
                currentProfile.courseStatus = 'IN_PROGRESS';
                break;
                
            case 'SECTION':
                currentProfile.tests.sections[sectionId] = testResult;
                break;
                
            case 'FINAL':
                currentProfile.tests.final = testResult;
                if (overallScore >= TEST_TYPES.FINAL.passingScore) {
                    currentProfile.courseStatus = 'COMPLETED';
                }
                break;
        }
        
        // Добавляем в историю
        currentProfile.tests.history.push(testResult);
        
        // Обновляем матрицу прогресса
        updateProgressMatrix(testResult);
        
        // Обновляем статистику
        updateStats(testResult);
        
        // Обновляем streak
        updateStreak();
        
        // Генерируем рекомендации
        generateRecommendations();
        
        // Проверяем достижения
        checkAchievements();
        
        // Планируем напоминания
        scheduleReminders(testResult);
        
        saveProfile();
        
        console.log('📝 Результат теста сохранён:', testResult.testId);
        
        return testResult;
    }

    /**
     * Обновление матрицы прогресса на основе результата теста
     */
    function updateProgressMatrix(testResult) {
        const { testType, sectionId, competencyScores } = testResult;
        
        for (const [competencyId, scores] of Object.entries(competencyScores)) {
            const competencyProgress = currentProfile.progressMatrix[competencyId];
            
            if (!competencyProgress) continue;
            
            const score = scores.score;
            
            // Записываем результат по типу теста
            switch (testType) {
                case 'DIAGNOSTIC':
                    competencyProgress.diagnostic = score;
                    break;
                case 'SECTION':
                    competencyProgress.sections[sectionId] = score;
                    break;
                case 'FINAL':
                    competencyProgress.final = score;
                    break;
            }
            
            // Обновляем последний результат
            competencyProgress.latest = score;
            
            // Добавляем в историю
            competencyProgress.history.push({
                score,
                testType,
                sectionId,
                timestamp: testResult.timestamp
            });
            
            // Рассчитываем дельту и тренд
            calculateDeltaAndTrend(competencyProgress);
        }
    }

    /**
     * Расчёт дельты прогресса и тренда
     */
    function calculateDeltaAndTrend(competencyProgress) {
        const diagnostic = competencyProgress.diagnostic;
        const latest = competencyProgress.latest;
        const final = competencyProgress.final;
        
        // Дельта = финальный/последний - диагностический
        if (diagnostic !== null && latest !== null) {
            const compareScore = final !== null ? final : latest;
            competencyProgress.delta = compareScore - diagnostic;
            
            // Определяем тренд
            if (competencyProgress.delta >= PROGRESS_THRESHOLDS.SIGNIFICANT_PROGRESS) {
                competencyProgress.trend = 'UP';
            } else if (competencyProgress.delta < -PROGRESS_THRESHOLDS.MINIMAL_PROGRESS) {
                competencyProgress.trend = 'DOWN';
            } else {
                competencyProgress.trend = 'STABLE';
            }
        }
    }

    /**
     * Обновление общей статистики
     */
    function updateStats(testResult) {
        const stats = currentProfile.stats;
        
        stats.totalTestsTaken++;
        stats.totalQuestionsAnswered += testResult.totalQuestions;
        stats.totalCorrectAnswers += testResult.correctAnswers;
        stats.totalTimeSpent += testResult.duration || 0;
        stats.lastActivityDate = new Date().toISOString().split('T')[0];
    }

    /**
     * Обновление streak (серии занятий)
     */
    function updateStreak() {
        const stats = currentProfile.stats;
        const today = new Date().toISOString().split('T')[0];
        const lastActivity = stats.lastActivityDate;
        
        if (!lastActivity) {
            stats.currentStreak = 1;
        } else {
            const lastDate = new Date(lastActivity);
            const todayDate = new Date(today);
            const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 0) {
                // Тот же день - ничего не меняем
            } else if (diffDays === 1) {
                // Следующий день - увеличиваем streak
                stats.currentStreak++;
            } else {
                // Пропущены дни - сбрасываем
                stats.currentStreak = 1;
            }
        }
        
        // Обновляем рекорд
        if (stats.currentStreak > stats.longestStreak) {
            stats.longestStreak = stats.currentStreak;
        }
        
        stats.lastActivityDate = today;
    }

    // ========================================================================
    // ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
    // ========================================================================

    /**
     * Генерация персональных рекомендаций
     */
    function generateRecommendations() {
        const recommendations = [];
        const matrix = currentProfile.progressMatrix;
        
        for (const [competencyId, progress] of Object.entries(matrix)) {
            const competency = COMPETENCIES[competencyId];
            const diagnostic = progress.diagnostic;
            const latest = progress.latest;
            const delta = progress.delta;
            const currentScore = progress.final || latest;
            
            // Пропускаем если нет данных
            if (diagnostic === null || latest === null) continue;
            
            // Нет прогресса или регресс (Δ < 15%)
            if (delta < PROGRESS_THRESHOLDS.SIGNIFICANT_PROGRESS) {
                const priority = delta < PROGRESS_THRESHOLDS.MINIMAL_PROGRESS ? 'HIGH' : 'MEDIUM';
                
                recommendations.push({
                    type: 'RESTUDY',
                    competency: competencyId,
                    competencyName: competency.name,
                    icon: competency.icon,
                    priority,
                    message: generateRestudyMessage(competency, progress),
                    sections: competency.sections,
                    actionType: 'section',
                    actionData: competency.sections[0]
                });
                
                // Добавляем рекомендацию по флэш-картам
                recommendations.push({
                    type: 'FLASHCARDS',
                    competency: competencyId,
                    competencyName: competency.name,
                    icon: '🎴',
                    priority: 'MEDIUM',
                    message: `Используйте флэш-карты для закрепления: ${competency.name}`,
                    actionType: 'flashcards',
                    actionData: competencyId
                });
            }
            // Есть прогресс (Δ ≥ 15%)
            else {
                // Высокий уровень (≥ 85%) - продвинутые материалы
                if (currentScore >= PROGRESS_THRESHOLDS.MASTERY_LEVEL) {
                    recommendations.push({
                        type: 'ADVANCED',
                        competency: competencyId,
                        competencyName: competency.name,
                        icon: '🚀',
                        priority: 'LOW',
                        message: `Отличный результат! Доступны продвинутые кейсы: ${competency.name}`,
                        actionType: 'cases',
                        actionData: { competency: competencyId, level: 'advanced' }
                    });
                }
                // Средний уровень (70-84%) - практика через кейсы
                else if (currentScore >= PROGRESS_THRESHOLDS.PROFICIENT_LEVEL) {
                    recommendations.push({
                        type: 'CASES',
                        competency: competencyId,
                        competencyName: competency.name,
                        icon: '🎮',
                        priority: 'MEDIUM',
                        message: `Закрепите навыки на практике: ${competency.name}`,
                        actionType: 'cases',
                        actionData: { competency: competencyId, level: 'intermediate' }
                    });
                }
                // Развивающийся уровень (50-69%) - интервальное повторение
                else {
                    recommendations.push({
                        type: 'SPACED_REPETITION',
                        competency: competencyId,
                        competencyName: competency.name,
                        icon: '🔄',
                        priority: 'MEDIUM',
                        message: `Продолжайте интервальное повторение: ${competency.name}`,
                        actionType: 'flashcards',
                        actionData: competencyId
                    });
                }
            }
        }
        
        // Сортируем по приоритету
        const priorityOrder = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
        recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        
        // Ограничиваем количество
        currentProfile.recommendations = {
            generated: new Date().toISOString(),
            items: recommendations.slice(0, 10)
        };
        
        return currentProfile.recommendations;
    }

    /**
     * Генерация сообщения для повторного изучения
     */
    function generateRestudyMessage(competency, progress) {
        const delta = progress.delta;
        const sections = competency.sections.map(s => `Раздел ${s}`).join(', ');
        
        if (delta < 0) {
            return `⚠️ Результаты снизились! Рекомендуется повторить: ${sections}`;
        } else if (delta < PROGRESS_THRESHOLDS.MINIMAL_PROGRESS) {
            return `Минимальный прогресс. Уделите больше внимания: ${sections}`;
        } else {
            return `Для улучшения результатов повторите: ${sections}`;
        }
    }

    // ========================================================================
    // ДОСТИЖЕНИЯ
    // ========================================================================

    /**
     * Проверка и разблокировка достижений
     */
    function checkAchievements() {
        const newAchievements = [];
        
        for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
            // Пропускаем уже полученные
            if (currentProfile.achievements.includes(achievementId)) continue;
            
            // Проверяем условие
            if (achievement.condition(currentProfile)) {
                currentProfile.achievements.push(achievementId);
                newAchievements.push({
                    id: achievementId,
                    ...achievement,
                    unlockedAt: new Date().toISOString()
                });
                
                console.log(`🏆 Достижение разблокировано: ${achievement.name}`);
            }
        }
        
        // Показываем уведомления о новых достижениях
        if (newAchievements.length > 0) {
            showAchievementNotifications(newAchievements);
        }
        
        return newAchievements;
    }

    /**
     * Показ уведомлений о достижениях
     */
    function showAchievementNotifications(achievements) {
        // Можно интегрировать с системой уведомлений приложения
        achievements.forEach(achievement => {
            if (typeof showNotification === 'function') {
                showNotification({
                    type: 'achievement',
                    title: '🏆 Новое достижение!',
                    message: `${achievement.icon} ${achievement.name}: ${achievement.description}`
                });
            }
        });
    }

    // ========================================================================
    // ИНТЕРВАЛЬНОЕ ПОВТОРЕНИЕ
    // ========================================================================

    /**
     * Планирование напоминаний для интервального повторения
     */
    function scheduleReminders(testResult) {
        const { testType, competencyScores } = testResult;
        const now = new Date();
        
        // Планируем напоминания только для пройденных компетенций
        for (const [competencyId, scores] of Object.entries(competencyScores)) {
            if (scores.score >= PROGRESS_THRESHOLDS.DEVELOPING_LEVEL) {
                // Добавляем расписание повторений
                SPACED_REPETITION_SCHEDULE.forEach(schedule => {
                    const reminderDate = new Date(now);
                    reminderDate.setDate(reminderDate.getDate() + schedule.day);
                    
                    currentProfile.reminders.push({
                        id: `reminder_${competencyId}_${schedule.day}_${Date.now()}`,
                        competency: competencyId,
                        activity: schedule.activity,
                        activityName: schedule.name,
                        scheduledDate: reminderDate.toISOString(),
                        completed: false,
                        createdFrom: testResult.testId
                    });
                });
            }
        }
        
        // Удаляем старые выполненные напоминания
        cleanupReminders();
    }

    /**
     * Очистка старых напоминаний
     */
    function cleanupReminders() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
        
        currentProfile.reminders = currentProfile.reminders.filter(reminder => {
            const reminderDate = new Date(reminder.scheduledDate);
            return !reminder.completed || reminderDate > thirtyDaysAgo;
        });
    }

    /**
     * Получение активных напоминаний
     */
    function getActiveReminders() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return currentProfile.reminders.filter(reminder => {
            const reminderDate = new Date(reminder.scheduledDate);
            return !reminder.completed && reminderDate <= tomorrow;
        });
    }

    /**
     * Отметка напоминания как выполненного
     */
    function completeReminder(reminderId) {
        const reminder = currentProfile.reminders.find(r => r.id === reminderId);
        if (reminder) {
            reminder.completed = true;
            reminder.completedAt = new Date().toISOString();
            saveProfile();
        }
    }

    // ========================================================================
    // ПРОВЕРКА ДОСТУПНОСТИ ТЕСТОВ
    // ========================================================================

    /**
     * Проверка доступности теста
     */
    function isTestUnlocked(testTypeKey) {
        const testType = TEST_TYPES[testTypeKey];
        
        if (!testType) return false;
        if (!testType.unlockCondition) return true;
        
        const condition = testType.unlockCondition;
        
        // Проверяем выполнение условия
        if (condition === 'DIAGNOSTIC') {
            return currentProfile.tests.diagnostic !== null;
        }
        
        if (condition.startsWith('SECTION_')) {
            const prevSection = parseInt(condition.replace('SECTION_', ''));
            const prevResult = currentProfile.tests.sections[prevSection];
            return prevResult && prevResult.overallScore >= TEST_TYPES[condition].passingScore;
        }
        
        return false;
    }

    /**
     * Получение следующего доступного теста
     */
    function getNextAvailableTest() {
        // Если не пройден вводный - возвращаем его
        if (!currentProfile.tests.diagnostic) {
            return TEST_TYPES.DIAGNOSTIC;
        }
        
        // Проверяем разделы по порядку
        for (let i = 1; i <= 4; i++) {
            const testKey = `SECTION_${i}`;
            if (!currentProfile.tests.sections[i] && isTestUnlocked(testKey)) {
                return TEST_TYPES[testKey];
            }
        }
        
        // Если все разделы пройдены - финальный тест
        if (isTestUnlocked('FINAL') && !currentProfile.tests.final) {
            return TEST_TYPES.FINAL;
        }
        
        return null;
    }

    // ========================================================================
    // ПОЛУЧЕНИЕ ДАННЫХ
    // ========================================================================

    /**
     * Получение текущего профиля
     */
    function getProfile() {
        if (!currentProfile) loadProfile();
        return currentProfile;
    }

    /**
     * Получение матрицы прогресса
     */
    function getProgressMatrix() {
        if (!currentProfile) loadProfile();
        return currentProfile.progressMatrix;
    }

    /**
     * Получение рекомендаций
     */
    function getRecommendations() {
        if (!currentProfile) loadProfile();
        return currentProfile.recommendations;
    }

    /**
     * Получение статуса курса
     */
    function getCourseStatus() {
        if (!currentProfile) loadProfile();
        
        return {
            status: currentProfile.courseStatus,
            diagnosticPassed: currentProfile.tests.diagnostic !== null,
            sectionsPassed: Object.keys(currentProfile.tests.sections).length,
            totalSections: 4,
            finalPassed: currentProfile.tests.final !== null,
            nextTest: getNextAvailableTest()
        };
    }

    /**
     * Получение статистики
     */
    function getStats() {
        if (!currentProfile) loadProfile();
        return currentProfile.stats;
    }

    /**
     * Получение достижений
     */
    function getAchievements() {
        if (!currentProfile) loadProfile();
        
        return currentProfile.achievements.map(id => ({
            id,
            ...ACHIEVEMENTS[id],
            unlocked: true
        }));
    }

    /**
     * Получение всех достижений (включая незаработанные)
     */
    function getAllAchievements() {
        if (!currentProfile) loadProfile();
        
        return Object.entries(ACHIEVEMENTS).map(([id, achievement]) => ({
            id,
            ...achievement,
            unlocked: currentProfile.achievements.includes(id)
        }));
    }

    // ========================================================================
    // ЭКСПОРТ ДАННЫХ
    // ========================================================================

    /**
     * Экспорт полного отчёта о прогрессе
     */
    function exportProgressReport() {
        if (!currentProfile) loadProfile();
        
        const report = {
            generatedAt: new Date().toISOString(),
            cadetId: currentProfile.cadetId,
            name: currentProfile.name || 'Курсант',
            courseStatus: currentProfile.courseStatus,
            
            // Результаты тестов
            testResults: {
                diagnostic: formatTestResult(currentProfile.tests.diagnostic),
                sections: Object.entries(currentProfile.tests.sections).map(([id, result]) => ({
                    section: id,
                    ...formatTestResult(result)
                })),
                final: formatTestResult(currentProfile.tests.final)
            },
            
            // Матрица компетенций
            competencyMatrix: Object.entries(currentProfile.progressMatrix).map(([id, data]) => ({
                competency: COMPETENCIES[id].name,
                icon: COMPETENCIES[id].icon,
                diagnostic: data.diagnostic,
                final: data.final || data.latest,
                delta: data.delta,
                trend: data.trend
            })),
            
            // Рекомендации
            recommendations: currentProfile.recommendations.items,
            
            // Статистика
            stats: currentProfile.stats,
            
            // Достижения
            achievements: getAchievements()
        };
        
        return report;
    }

    /**
     * Форматирование результата теста для отчёта
     */
    function formatTestResult(result) {
        if (!result) return null;
        
        return {
            date: result.timestamp,
            score: result.overallScore,
            correct: result.correctAnswers,
            total: result.totalQuestions,
            duration: Math.round(result.duration / 60) + ' мин'
        };
    }

    /**
     * Экспорт в JSON
     */
    function exportToJSON() {
        return JSON.stringify(exportProgressReport(), null, 2);
    }

    /**
     * Экспорт матрицы в CSV
     */
    function exportMatrixToCSV() {
        if (!currentProfile) loadProfile();
        
        const headers = ['Компетенция', 'Вводный', 'Раздел 1', 'Раздел 2', 'Раздел 3', 'Раздел 4', 'Финал', 'Δ Прогресс', 'Тренд'];
        const rows = [headers.join(',')];
        
        for (const [id, data] of Object.entries(currentProfile.progressMatrix)) {
            const competency = COMPETENCIES[id];
            const row = [
                competency.name,
                data.diagnostic ?? '-',
                data.sections[1] ?? '-',
                data.sections[2] ?? '-',
                data.sections[3] ?? '-',
                data.sections[4] ?? '-',
                data.final ?? '-',
                data.delta ? `${data.delta > 0 ? '+' : ''}${data.delta}%` : '-',
                data.trend
            ];
            rows.push(row.join(','));
        }
        
        return rows.join('\n');
    }

    // ========================================================================
    // СБРОС И ОЧИСТКА
    // ========================================================================

    /**
     * Сброс прогресса
     */
    function resetProgress(keepProfile = false) {
        if (keepProfile) {
            // Сохраняем ID и имя
            const { cadetId, name, createdAt } = currentProfile;
            currentProfile = createNewProfile(name);
            currentProfile.cadetId = cadetId;
            currentProfile.createdAt = createdAt;
        } else {
            currentProfile = createNewProfile();
        }
        
        saveProfile();
        console.log('🔄 Прогресс сброшен');
        return currentProfile;
    }

    /**
     * Полная очистка данных
     */
    function clearAllData() {
        localStorage.removeItem(STORAGE_KEY);
        currentProfile = null;
        console.log('🗑️ Все данные удалены');
    }

    // ========================================================================
    // ПУБЛИЧНЫЙ API
    // ========================================================================

    return {
        // Инициализация
        init: loadProfile,
        
        // Запись данных
        saveTestResult,
        completeReminder,
        
        // Получение данных
        getProfile,
        getProgressMatrix,
        getRecommendations,
        getCourseStatus,
        getStats,
        getAchievements,
        getAllAchievements,
        getActiveReminders,
        
        // Проверки
        isTestUnlocked,
        getNextAvailableTest,
        
        // Экспорт
        exportProgressReport,
        exportToJSON,
        exportMatrixToCSV,
        
        // Управление
        resetProgress,
        clearAllData,
        saveProfile,
        
        // Утилиты
        generateRecommendations,
        checkAchievements
    };

})();

// Инициализация при загрузке
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function() {
        CadetProgress.init();
    });
}

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CadetProgress;
}
