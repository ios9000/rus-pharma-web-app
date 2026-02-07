// ============================================
// МОДУЛЬ СИНХРОНИЗАЦИИ ПРОГРЕССА
// sync-module.js
// ============================================

const SyncModule = (function() {
    'use strict';

    // ========================================
    // КОНФИГУРАЦИЯ
    // ========================================
    
    const CONFIG = {
        // Ключи localStorage для очереди синхронизации
        STORAGE_KEYS: {
            SYNC_QUEUE: 'sync_queue',
            LAST_SYNC: 'sync_last_time',
            DEVICE_ID: 'sync_device_id'
        },
        
        // Типы данных для синхронизации
        DATA_TYPES: {
            TEST_RESULT: 'TEST_RESULT',
            CARD_RESULT: 'CARD_RESULT',
            PROGRESS_MATRIX: 'PROGRESS_MATRIX',
            ACHIEVEMENT: 'ACHIEVEMENT',
            SETTINGS: 'SETTINGS'
        },
        
        // Интервал автосинхронизации (5 минут)
        AUTO_SYNC_INTERVAL: 5 * 60 * 1000,
        
        // Максимум записей в очереди
        MAX_QUEUE_SIZE: 1000
    };

    // ========================================
    // СОСТОЯНИЕ
    // ========================================
    
    let syncQueue = [];
    let isSyncing = false;
    let autoSyncTimer = null;
    let syncCallbacks = {
        onSyncStart: null,
        onSyncComplete: null,
        onSyncError: null,
        onDataReceived: null
    };

    // ========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ========================================

    /**
     * Инициализация модуля синхронизации
     */
    function init(callbacks = {}) {
        syncCallbacks = { ...syncCallbacks, ...callbacks };
        
        // Загружаем очередь из localStorage
        loadQueue();
        
        // Генерируем ID устройства если нет
        if (!getDeviceId()) {
            generateDeviceId();
        }
        
        // Запускаем автосинхронизацию
        startAutoSync();
        
        console.log('🔄 Модуль синхронизации инициализирован');
        
        return {
            queueSize: syncQueue.length,
            deviceId: getDeviceId(),
            lastSync: getLastSyncTime()
        };
    }

    // ========================================
    // ДОБАВЛЕНИЕ ДАННЫХ В ОЧЕРЕДЬ
    // ========================================

    /**
     * Добавить данные в очередь синхронизации
     * @param {string} dataType - Тип данных (из DATA_TYPES)
     * @param {string} dataKey - Уникальный ключ записи
     * @param {any} dataValue - Значение (будет сериализовано в JSON)
     */
    function addToQueue(dataType, dataKey, dataValue) {
        const item = {
            id: generateItemId(),
            dataType: dataType,
            dataKey: dataKey,
            dataValue: typeof dataValue === 'string' ? dataValue : JSON.stringify(dataValue),
            timestamp: new Date().toISOString(),
            deviceId: getDeviceId(),
            version: Date.now(),
            synced: false
        };
        
        // Проверяем, есть ли уже такой элемент в очереди
        const existingIndex = syncQueue.findIndex(
            q => q.dataType === dataType && q.dataKey === dataKey && !q.synced
        );
        
        if (existingIndex >= 0) {
            // Обновляем существующий
            syncQueue[existingIndex] = item;
        } else {
            // Добавляем новый
            syncQueue.push(item);
        }
        
        // Ограничиваем размер очереди
        if (syncQueue.length > CONFIG.MAX_QUEUE_SIZE) {
            // Удаляем старые синхронизированные записи
            syncQueue = syncQueue.filter(q => !q.synced);
            // Если всё ещё много - удаляем самые старые
            if (syncQueue.length > CONFIG.MAX_QUEUE_SIZE) {
                syncQueue = syncQueue.slice(-CONFIG.MAX_QUEUE_SIZE);
            }
        }
        
        saveQueue();
        
        return item;
    }

    /**
     * Хелпер: сохранить результат теста
     */
    function saveTestResult(testType, competencyId, score, details = {}) {
        const key = `${testType}_${competencyId}_${Date.now()}`;
        return addToQueue(CONFIG.DATA_TYPES.TEST_RESULT, key, {
            testType,
            competencyId,
            score,
            ...details
        });
    }

    /**
     * Хелпер: сохранить результат флэш-карты
     */
    function saveCardResult(drugId, status) {
        return addToQueue(CONFIG.DATA_TYPES.CARD_RESULT, `card_${drugId}`, {
            drugId,
            status,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Хелпер: сохранить матрицу прогресса
     */
    function saveProgressMatrix(matrix) {
        return addToQueue(CONFIG.DATA_TYPES.PROGRESS_MATRIX, 'progress_matrix', matrix);
    }

    /**
     * Хелпер: сохранить достижение
     */
    function saveAchievement(achievementId) {
        return addToQueue(CONFIG.DATA_TYPES.ACHIEVEMENT, `ach_${achievementId}`, {
            achievementId,
            unlockedAt: new Date().toISOString()
        });
    }

    // ========================================
    // СИНХРОНИЗАЦИЯ
    // ========================================

    /**
     * Выполнить синхронизацию сейчас
     */
    async function syncNow() {
        if (isSyncing) {
            console.log('⏳ Синхронизация уже выполняется');
            return { success: false, reason: 'already_syncing' };
        }
        
        if (!AuthModule.isLoggedIn()) {
            console.log('❌ Синхронизация невозможна: не авторизован');
            return { success: false, reason: 'not_logged_in' };
        }
        
        if (!AuthModule.isOnline()) {
            console.log('📵 Синхронизация невозможна: нет соединения');
            return { success: false, reason: 'offline' };
        }
        
        isSyncing = true;
        
        if (syncCallbacks.onSyncStart) {
            syncCallbacks.onSyncStart();
        }
        
        try {
            const cadet = AuthModule.getCurrentCadet();
            const unsyncedItems = syncQueue.filter(q => !q.synced);
            
            console.log(`🔄 Синхронизация: ${unsyncedItems.length} записей для отправки`);
            
            // Используем GET вместо POST для обхода CORS
            const params = new URLSearchParams({
                action: 'fullSync',
                cadetId: cadet.id,
                localProgress: JSON.stringify(unsyncedItems),
                lastSyncTime: getLastSyncTime() || ''
            });
            
            const response = await fetch(`${getApiUrl()}?${params.toString()}`);
            const result = await response.json();
            
            if (result.success) {
                // Помечаем отправленные как синхронизированные
                unsyncedItems.forEach(item => {
                    item.synced = true;
                });
                
                // Применяем полученные с сервера данные
                if (result.serverProgress && result.serverProgress.length > 0) {
                    applyServerData(result.serverProgress);
                }
                
                // Обновляем время последней синхронизации
                setLastSyncTime(result.syncTime);
                
                // Очищаем синхронизированные записи из очереди
                cleanupQueue();
                
                saveQueue();
                
                console.log(`✅ Синхронизация завершена: отправлено ${result.saved}, получено ${result.loaded}`);
                
                if (syncCallbacks.onSyncComplete) {
                    syncCallbacks.onSyncComplete(result);
                }
                
                return {
                    success: true,
                    sent: result.saved,
                    received: result.loaded,
                    syncTime: result.syncTime
                };
            } else {
                throw new Error(result.error || 'Ошибка синхронизации');
            }
            
        } catch (error) {
            console.error('❌ Ошибка синхронизации:', error);
            
            if (syncCallbacks.onSyncError) {
                syncCallbacks.onSyncError(error);
            }
            
            return { success: false, error: error.message };
            
        } finally {
            isSyncing = false;
        }
    }

    /**
     * Применить данные полученные с сервера
     */
    function applyServerData(serverProgress) {
        console.log(`📥 Применение ${serverProgress.length} записей с сервера`);
        
        for (const item of serverProgress) {
            try {
                const value = typeof item.dataValue === 'string' 
                    ? JSON.parse(item.dataValue) 
                    : item.dataValue;
                
                switch (item.dataType) {
                    case CONFIG.DATA_TYPES.TEST_RESULT:
                        applyTestResult(value);
                        break;
                        
                    case CONFIG.DATA_TYPES.CARD_RESULT:
                        applyCardResult(value);
                        break;
                        
                    case CONFIG.DATA_TYPES.PROGRESS_MATRIX:
                        applyProgressMatrix(value);
                        break;
                        
                    case CONFIG.DATA_TYPES.ACHIEVEMENT:
                        applyAchievement(value);
                        break;
                }
                
            } catch (e) {
                console.error('Ошибка применения данных:', item, e);
            }
        }
        
        if (syncCallbacks.onDataReceived) {
            syncCallbacks.onDataReceived(serverProgress);
        }
    }

    /**
     * Применить результат теста
     */
    function applyTestResult(data) {
        const testResults = JSON.parse(localStorage.getItem('testResults') || '[]');
        
        // Проверяем, нет ли уже такого результата
        const exists = testResults.some(r => 
            r.testType === data.testType && 
            r.competencyId === data.competencyId &&
            r.timestamp === data.timestamp
        );
        
        if (!exists) {
            testResults.push(data);
            localStorage.setItem('testResults', JSON.stringify(testResults));
        }
    }

    /**
     * Применить результат карточки
     */
    function applyCardResult(data) {
        const cardResults = JSON.parse(localStorage.getItem('cardResults') || '[]');
        
        const existingIndex = cardResults.findIndex(r => r.drugId === data.drugId);
        
        if (existingIndex >= 0) {
            // Обновляем если новее
            if (new Date(data.timestamp) > new Date(cardResults[existingIndex].timestamp || 0)) {
                cardResults[existingIndex] = data;
            }
        } else {
            cardResults.push(data);
        }
        
        localStorage.setItem('cardResults', JSON.stringify(cardResults));
    }

    /**
     * Применить матрицу прогресса
     */
    function applyProgressMatrix(data) {
        const currentMatrix = JSON.parse(localStorage.getItem('progressMatrix') || '{}');
        
        // Мержим данные (серверные имеют приоритет)
        const merged = { ...currentMatrix, ...data };
        
        localStorage.setItem('progressMatrix', JSON.stringify(merged));
    }

    /**
     * Применить достижение
     */
    function applyAchievement(data) {
        const achievements = JSON.parse(localStorage.getItem('unlockedAchievements') || '[]');
        
        if (!achievements.includes(data.achievementId)) {
            achievements.push(data.achievementId);
            localStorage.setItem('unlockedAchievements', JSON.stringify(achievements));
        }
    }

    // ========================================
    // АВТОСИНХРОНИЗАЦИЯ
    // ========================================

    /**
     * Запустить автоматическую синхронизацию
     */
    function startAutoSync() {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
        }
        
        autoSyncTimer = setInterval(() => {
            if (AuthModule.isLoggedIn() && AuthModule.isOnline() && syncQueue.some(q => !q.synced)) {
                syncNow().catch(console.error);
            }
        }, CONFIG.AUTO_SYNC_INTERVAL);
    }

    /**
     * Остановить автоматическую синхронизацию
     */
    function stopAutoSync() {
        if (autoSyncTimer) {
            clearInterval(autoSyncTimer);
            autoSyncTimer = null;
        }
    }

    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================

    function loadQueue() {
        try {
            const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE);
            syncQueue = saved ? JSON.parse(saved) : [];
        } catch (e) {
            syncQueue = [];
        }
    }

    function saveQueue() {
        localStorage.setItem(CONFIG.STORAGE_KEYS.SYNC_QUEUE, JSON.stringify(syncQueue));
    }

    function cleanupQueue() {
        // Удаляем синхронизированные записи старше 1 дня
        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
        syncQueue = syncQueue.filter(q => 
            !q.synced || new Date(q.timestamp).getTime() > oneDayAgo
        );
    }

    function generateItemId() {
        return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    function generateDeviceId() {
        const id = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem(CONFIG.STORAGE_KEYS.DEVICE_ID, id);
        return id;
    }

    function getDeviceId() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.DEVICE_ID);
    }

    function getLastSyncTime() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.LAST_SYNC);
    }

    function setLastSyncTime(time) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_SYNC, time);
    }

    function getApiUrl() {
        // Единый источник — глобальный CONFIG (config.js), fallback на хардкод
        if (typeof window.CONFIG !== 'undefined' && window.CONFIG.API_URL) {
            return window.CONFIG.API_URL;
        }
        return 'https://script.google.com/macros/s/AKfycbwB0oYN70vH9sMnQItBL1rSVuVxF2t90Fx5A_9wWZjR3lrfSNPcmDVZuqOC7mfsO87x/exec';
    }

    // ========================================
    // СТАТУС И СТАТИСТИКА
    // ========================================

    function getStatus() {
        return {
            isSyncing,
            queueSize: syncQueue.length,
            unsyncedCount: syncQueue.filter(q => !q.synced).length,
            lastSync: getLastSyncTime(),
            deviceId: getDeviceId(),
            isOnline: AuthModule.isOnline()
        };
    }

    function getQueueItems() {
        return [...syncQueue];
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        
        // Добавление данных
        addToQueue,
        saveTestResult,
        saveCardResult,
        saveProgressMatrix,
        saveAchievement,
        
        // Синхронизация
        syncNow,
        startAutoSync,
        stopAutoSync,
        
        // Статус
        getStatus,
        getQueueItems,
        
        // Константы
        DATA_TYPES: CONFIG.DATA_TYPES
    };

})();

// Экспорт для Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SyncModule;
}
