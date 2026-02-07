// ============================================
// МОДУЛЬ АВТОРИЗАЦИИ КУРСАНТА
// auth-module.js
// ============================================

const AuthModule = (function() {
    'use strict';

    // ========================================
    // КОНФИГУРАЦИЯ
    // ========================================
    
    const FALLBACK_API_URL = 'https://script.google.com/macros/s/AKfycbwB0oYN70vH9sMnQItBL1rSVuVxF2t90Fx5A_9wWZjR3lrfSNPcmDVZuqOC7mfsO87x/exec';

    const CONFIG = {
        // URL берём из глобального CONFIG (config.js), fallback на хардкод
        API_URL: (typeof window.CONFIG !== 'undefined' && window.CONFIG.API_URL) ? window.CONFIG.API_URL : FALLBACK_API_URL,

        // Ключи localStorage
        STORAGE_KEYS: {
            CADET_ID: 'auth_cadet_id',
            CADET_DATA: 'auth_cadet_data',
            PIN_HASH: 'auth_pin_hash',
            LAST_SYNC: 'auth_last_sync',
            OFFLINE_MODE: 'auth_offline_mode'
        },
        
        // Таймауты
        REQUEST_TIMEOUT: 10000, // 10 секунд
        
        // Версия для миграции
        VERSION: '1.0.0'
    };

    // ========================================
    // СОСТОЯНИЕ
    // ========================================
    
    let currentCadet = null;
    let isOnline = navigator.onLine;
    let authCallbacks = {
        onLogin: null,
        onLogout: null,
        onError: null
    };

    // ========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ========================================

    /**
     * Инициализация модуля авторизации
     */
    function init(callbacks = {}) {
        authCallbacks = { ...authCallbacks, ...callbacks };
        
        // Слушаем изменение состояния сети
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        
        // Пробуем автоматический вход
        return tryAutoLogin();
    }

    /**
     * Попытка автоматического входа
     */
    async function tryAutoLogin() {
        const savedCadetId = localStorage.getItem(CONFIG.STORAGE_KEYS.CADET_ID);
        
        if (!savedCadetId) {
            return { success: false, reason: 'no_saved_session' };
        }
        
        // Загружаем сохранённые данные курсанта
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEYS.CADET_DATA);
        if (savedData) {
            currentCadet = JSON.parse(savedData);
        }
        
        // Если онлайн - проверяем на сервере
        if (isOnline) {
            try {
                const result = await quickLogin(savedCadetId);
                if (result.success) {
                    return result;
                }
            } catch (error) {
                console.warn('Автологин онлайн не удался, используем офлайн данные:', error);
            }
        }
        
        // Офлайн режим - используем сохранённые данные
        if (currentCadet) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE, 'true');
            if (authCallbacks.onLogin) {
                authCallbacks.onLogin(currentCadet, true); // true = offline
            }
            return { success: true, cadet: currentCadet, offline: true };
        }
        
        return { success: false, reason: 'no_cached_data' };
    }

    // ========================================
    // ПРОВЕРКА ГРУППЫ
    // ========================================

    /**
     * Проверка существования группы по коду
     */
    async function checkGroup(groupCode) {
        if (!isOnline) {
            return { success: false, error: 'Нет подключения к интернету' };
        }
        
        try {
            const url = `${CONFIG.API_URL}?action=getGroup&code=${encodeURIComponent(groupCode.toUpperCase())}`;
            const response = await fetchWithTimeout(url);
            return response;
        } catch (error) {
            console.error('Ошибка проверки группы:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }

    // ========================================
    // РЕГИСТРАЦИЯ
    // ========================================

    /**
     * Регистрация нового курсанта (GET для обхода CORS)
     */
    async function register(groupCode, fullName) {
        if (!isOnline) {
            return { success: false, error: 'Для регистрации необходимо подключение к интернету' };
        }
        
        // Валидация
        if (!groupCode || groupCode.length < 4) {
            return { success: false, error: 'Введите код группы' };
        }
        
        if (!fullName || fullName.trim().length < 3) {
            return { success: false, error: 'Введите ваше ФИО (минимум 3 символа)' };
        }
        
        try {
            // Используем GET вместо POST для обхода CORS
            const url = `${CONFIG.API_URL}?action=register&groupCode=${encodeURIComponent(groupCode.toUpperCase())}&fullName=${encodeURIComponent(fullName.trim())}`;
            const response = await fetchWithTimeout(url);
            
            if (response.success) {
                // Сохраняем данные курсанта
                currentCadet = {
                    id: response.cadetId,
                    fullName: response.fullName,
                    groupCode: response.groupCode,
                    groupName: response.groupName
                };
                
                saveSession(currentCadet, response.pinCode);
                
                if (authCallbacks.onLogin) {
                    authCallbacks.onLogin(currentCadet, false);
                }
            }
            
            return response;
            
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            return { success: false, error: 'Ошибка соединения с сервером' };
        }
    }

    // ========================================
    // ВХОД
    // ========================================

    /**
     * Вход по ID и PIN (GET для обхода CORS)
     */
    async function login(cadetId, pinCode) {
        if (!isOnline) {
            // Попробуем офлайн вход
            return offlineLogin(cadetId, pinCode);
        }
        
        try {
            // Используем GET вместо POST для обхода CORS
            const url = `${CONFIG.API_URL}?action=login&cadetId=${encodeURIComponent(cadetId.toUpperCase())}&pinCode=${encodeURIComponent(pinCode)}`;
            const response = await fetchWithTimeout(url);
            
            if (response.success) {
                currentCadet = response.cadet;
                saveSession(currentCadet, pinCode);
                
                localStorage.removeItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE);
                
                if (authCallbacks.onLogin) {
                    authCallbacks.onLogin(currentCadet, false);
                }
            }
            
            return response;
            
        } catch (error) {
            console.error('Ошибка входа:', error);
            // Пробуем офлайн
            return offlineLogin(cadetId, pinCode);
        }
    }

    /**
     * Быстрый вход (для автологина)
     */
    async function quickLogin(cadetId) {
        try {
            const url = `${CONFIG.API_URL}?action=quickLogin&cadetId=${encodeURIComponent(cadetId)}`;
            const response = await fetchWithTimeout(url);
            
            if (response.success) {
                currentCadet = response.cadet;
                
                // Обновляем сохранённые данные
                localStorage.setItem(CONFIG.STORAGE_KEYS.CADET_DATA, JSON.stringify(currentCadet));
                localStorage.removeItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE);
                
                if (authCallbacks.onLogin) {
                    authCallbacks.onLogin(currentCadet, false);
                }
            }
            
            return response;
            
        } catch (error) {
            throw error;
        }
    }

    /**
     * Офлайн вход (проверка по сохранённым данным)
     */
    function offlineLogin(cadetId, pinCode) {
        const savedId = localStorage.getItem(CONFIG.STORAGE_KEYS.CADET_ID);
        const savedPinHash = localStorage.getItem(CONFIG.STORAGE_KEYS.PIN_HASH);
        const savedData = localStorage.getItem(CONFIG.STORAGE_KEYS.CADET_DATA);
        
        if (savedId === cadetId.toUpperCase() && savedPinHash === hashPin(pinCode) && savedData) {
            currentCadet = JSON.parse(savedData);
            localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE, 'true');
            
            if (authCallbacks.onLogin) {
                authCallbacks.onLogin(currentCadet, true);
            }
            
            return { 
                success: true, 
                cadet: currentCadet, 
                offline: true,
                message: 'Вход выполнен в офлайн-режиме'
            };
        }
        
        return { success: false, error: 'Неверный ID или PIN-код' };
    }

    // ========================================
    // ВЫХОД
    // ========================================

    /**
     * Выход из аккаунта
     */
    function logout(clearAll = false) {
        currentCadet = null;
        
        if (clearAll) {
            // Полная очистка
            Object.values(CONFIG.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
        } else {
            // Сохраняем ID для быстрого входа
            localStorage.removeItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE);
        }
        
        if (authCallbacks.onLogout) {
            authCallbacks.onLogout();
        }
        
        return { success: true };
    }

    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================

    /**
     * Сохранение сессии
     */
    function saveSession(cadet, pinCode) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.CADET_ID, cadet.id);
        localStorage.setItem(CONFIG.STORAGE_KEYS.CADET_DATA, JSON.stringify(cadet));
        if (pinCode) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.PIN_HASH, hashPin(pinCode));
        }
    }

    /**
     * Простое хеширование PIN (для офлайн проверки)
     */
    function hashPin(pin) {
        let hash = 0;
        const str = pin + 'salt_med_app_2025';
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * Fetch с таймаутом
     */
    async function fetchWithTimeout(url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CONFIG.REQUEST_TIMEOUT);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeout);
            return await response.json();
        } catch (error) {
            clearTimeout(timeout);
            throw error;
        }
    }

    /**
     * Обработка перехода в онлайн
     */
    function handleOnline() {
        isOnline = true;
        console.log('📶 Соединение восстановлено');
        
        // Пробуем синхронизироваться
        if (currentCadet) {
            SyncModule.syncNow().catch(console.error);
        }
    }

    /**
     * Обработка перехода в офлайн
     */
    function handleOffline() {
        isOnline = false;
        console.log('📵 Соединение потеряно');
        localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE, 'true');
    }

    // ========================================
    // ГЕТТЕРЫ
    // ========================================

    function getCurrentCadet() {
        return currentCadet;
    }

    function isLoggedIn() {
        return currentCadet !== null;
    }

    function isOfflineMode() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_MODE) === 'true';
    }

    function getIsOnline() {
        return isOnline;
    }

    function setApiUrl(url) {
        CONFIG.API_URL = url;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        init,
        checkGroup,
        register,
        login,
        logout,
        tryAutoLogin,
        
        // Геттеры
        getCurrentCadet,
        isLoggedIn,
        isOfflineMode,
        isOnline: getIsOnline,
        
        // Конфигурация
        setApiUrl,
        
        // Константы
        STORAGE_KEYS: CONFIG.STORAGE_KEYS
    };

})();

// Экспорт для Node.js (если нужно)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthModule;
}
