// ============================================
// UI АВТОРИЗАЦИИ
// auth-ui.js
// ============================================

const AuthUI = (function() {
    'use strict';

    // ========================================
    // HTML ШАБЛОН
    // ========================================

    const AUTH_HTML = `
    <div id="auth-container" class="auth-container">
        <!-- Логотип -->
        <div class="auth-logo">
            <div class="auth-logo-icon">🏥</div>
            <h1>Полевая медицина</h1>
            <p>Фармакология в полевых условиях</p>
        </div>
        
        <!-- Карточка авторизации -->
        <div class="auth-card">
            <!-- Табы -->
            <div class="auth-tabs">
                <button class="auth-tab active" data-tab="login">Вход</button>
                <button class="auth-tab" data-tab="register">Регистрация</button>
            </div>
            
            <!-- Форма входа -->
            <form id="login-form" class="auth-form active">
                <div class="auth-field">
                    <label for="login-cadet-id">ID курсанта</label>
                    <input type="text" id="login-cadet-id" placeholder="Например: C12AB34CD" autocomplete="username">
                    <div class="field-error" id="login-id-error"></div>
                </div>
                
                <div class="auth-field">
                    <label for="login-pin">PIN-код</label>
                    <input type="password" id="login-pin" placeholder="4 цифры" maxlength="4" inputmode="numeric" autocomplete="current-password">
                    <div class="field-error" id="login-pin-error"></div>
                </div>
                
                <button type="submit" class="auth-button primary" id="login-button">
                    <span class="button-text">Войти</span>
                </button>
            </form>
            
            <!-- Форма регистрации -->
            <form id="register-form" class="auth-form">
                <!-- Шаг 1: Код группы -->
                <div id="register-step-1">
                    <div class="auth-field">
                        <label for="register-group-code">Код группы</label>
                        <input type="text" id="register-group-code" placeholder="Например: PHARMA-0126" maxlength="15" autocomplete="off">
                        <div class="field-hint">Введите код группы от инструктора</div>
                        <div class="field-error" id="group-code-error"></div>
                    </div>
                    
                    <!-- Информация о группе -->
                    <div class="group-info" id="group-info">
                        <div class="group-info-content">
                            <span class="group-info-icon">✅</span>
                            <div class="group-info-text">
                                <h4 id="group-name">—</h4>
                                <p>Инструктор: <span id="group-instructor">—</span></p>
                            </div>
                        </div>
                    </div>
                    
                    <button type="button" class="auth-button primary" id="check-group-button">
                        <span class="button-text">Проверить код</span>
                    </button>
                </div>
                
                <!-- Шаг 2: ФИО -->
                <div id="register-step-2" style="display: none;">
                    <div class="group-info visible">
                        <div class="group-info-content">
                            <span class="group-info-icon">✅</span>
                            <div class="group-info-text">
                                <h4 id="confirmed-group-name">—</h4>
                                <p>Код: <span id="confirmed-group-code">—</span></p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="auth-field">
                        <label for="register-name">Ваше ФИО</label>
                        <input type="text" id="register-name" placeholder="Иванов Иван Иванович" autocomplete="name">
                        <div class="field-error" id="register-name-error"></div>
                    </div>
                    
                    <button type="submit" class="auth-button primary" id="register-button">
                        <span class="button-text">Зарегистрироваться</span>
                    </button>
                    
                    <button type="button" class="auth-button secondary" id="back-to-step-1">
                        ← Изменить группу
                    </button>
                </div>
            </form>
            
            <!-- Успешная регистрация -->
            <div class="auth-success" id="register-success">
                <div class="auth-success-icon">🎉</div>
                <h3>Регистрация успешна!</h3>
                <p>Запомните или сохраните ваши данные для входа:</p>
                
                <div class="credentials-box">
                    <div class="credential">
                        <span class="credential-label">ID курсанта:</span>
                        <span class="credential-value" id="new-cadet-id">—</span>
                    </div>
                    <div class="credential">
                        <span class="credential-label">PIN-код:</span>
                        <span class="credential-value pin-highlight" id="new-cadet-pin">—</span>
                    </div>
                </div>
                
                <div class="credentials-warning">
                    <span class="credentials-warning-icon">⚠️</span>
                    <p>PIN-код показывается только один раз! Запишите его в надёжное место.</p>
                </div>
                
                <button type="button" class="auth-button primary" id="start-learning-button">
                    Начать обучение →
                </button>
            </div>
        </div>
        
        <!-- Статус сети -->
        <div class="network-status">
            <span class="status-dot" id="network-dot"></span>
            <span id="network-text">Онлайн</span>
        </div>
        
        <div class="auth-version">Версия 1.0</div>
    </div>
    `;

    // ========================================
    // СОСТОЯНИЕ
    // ========================================
    
    let currentGroupCode = null;
    let currentGroupData = null;
    let registrationData = null;

    // ========================================
    // ИНИЦИАЛИЗАЦИЯ
    // ========================================

    /**
     * Создание и показ UI авторизации
     */
    function show() {
        // Удаляем если уже есть
        const existing = document.getElementById('auth-container');
        if (existing) existing.remove();
        
        // Добавляем HTML
        document.body.insertAdjacentHTML('beforeend', AUTH_HTML);
        
        // Привязываем обработчики
        bindEvents();
        
        // Обновляем статус сети
        updateNetworkStatus();
    }

    /**
     * Скрытие UI авторизации
     */
    function hide() {
        const container = document.getElementById('auth-container');
        if (container) {
            container.classList.add('hidden');
            setTimeout(() => container.remove(), 300);
        }
    }

    /**
     * Привязка обработчиков событий
     */
    function bindEvents() {
        // Табы
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.tab));
        });
        
        // Форма входа
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        
        // Проверка кода группы
        document.getElementById('check-group-button').addEventListener('click', handleCheckGroup);
        
        // Форма регистрации
        document.getElementById('register-form').addEventListener('submit', handleRegister);
        
        // Кнопка "Назад" на шаге 2
        document.getElementById('back-to-step-1').addEventListener('click', () => {
            document.getElementById('register-step-1').style.display = 'block';
            document.getElementById('register-step-2').style.display = 'none';
        });
        
        // Кнопка "Начать обучение"
        document.getElementById('start-learning-button').addEventListener('click', () => {
            hide();
            // Вызываем колбэк успешного входа
            if (window.onAuthSuccess) {
                window.onAuthSuccess(registrationData);
            }
        });
        
        // Автоформатирование кода группы (uppercase)
        document.getElementById('register-group-code').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // Автоформатирование ID курсанта (uppercase)
        document.getElementById('login-cadet-id').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // Слушаем изменение состояния сети
        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
    }

    // ========================================
    // ПЕРЕКЛЮЧЕНИЕ ТАБОВ
    // ========================================

    function switchTab(tabName) {
        // Обновляем табы
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        
        // Обновляем формы
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        
        document.getElementById(`${tabName}-form`).classList.add('active');
        
        // Скрываем успешную регистрацию при переключении
        document.getElementById('register-success').classList.remove('visible');
    }

    // ========================================
    // ОБРАБОТКА ВХОДА
    // ========================================

    async function handleLogin(e) {
        e.preventDefault();
        
        const cadetId = document.getElementById('login-cadet-id').value.trim();
        const pin = document.getElementById('login-pin').value.trim();
        
        // Валидация
        clearErrors();
        
        if (!cadetId) {
            showFieldError('login-id-error', 'Введите ID курсанта');
            return;
        }
        
        if (!pin || pin.length !== 4) {
            showFieldError('login-pin-error', 'Введите 4-значный PIN-код');
            return;
        }
        
        // Показываем загрузку
        setButtonLoading('login-button', true);
        
        try {
            const result = await AuthModule.login(cadetId, pin);
            
            if (result.success) {
                hide();
                
                if (result.offline) {
                    showToast('Вход выполнен в офлайн-режиме', 'warning');
                }
                
                if (window.onAuthSuccess) {
                    window.onAuthSuccess(result.cadet);
                }
            } else {
                showFieldError('login-pin-error', result.error || 'Ошибка входа');
            }
        } catch (error) {
            showFieldError('login-pin-error', 'Ошибка соединения');
        } finally {
            setButtonLoading('login-button', false);
        }
    }

    // ========================================
    // ОБРАБОТКА ПРОВЕРКИ ГРУППЫ
    // ========================================

    async function handleCheckGroup() {
        const groupCode = document.getElementById('register-group-code').value.trim();
        
        clearErrors();
        
        if (!groupCode || groupCode.length < 4) {
            showFieldError('group-code-error', 'Введите код группы');
            return;
        }
        
        setButtonLoading('check-group-button', true);
        
        try {
            const result = await AuthModule.checkGroup(groupCode);
            
            const groupInfo = document.getElementById('group-info');
            
            if (result.success) {
                currentGroupCode = groupCode.toUpperCase();
                currentGroupData = result.group;
                
                // Показываем информацию о группе
                document.getElementById('group-name').textContent = result.group.name;
                document.getElementById('group-instructor').textContent = result.group.instructor;
                
                groupInfo.classList.remove('error');
                groupInfo.classList.add('visible');
                groupInfo.querySelector('.group-info-icon').textContent = '✅';
                
                // Переходим к шагу 2
                setTimeout(() => {
                    document.getElementById('register-step-1').style.display = 'none';
                    document.getElementById('register-step-2').style.display = 'block';
                    
                    document.getElementById('confirmed-group-name').textContent = result.group.name;
                    document.getElementById('confirmed-group-code').textContent = currentGroupCode;
                    
                    document.getElementById('register-name').focus();
                }, 500);
                
            } else {
                groupInfo.classList.add('error', 'visible');
                groupInfo.querySelector('.group-info-icon').textContent = '❌';
                document.getElementById('group-name').textContent = 'Группа не найдена';
                document.getElementById('group-instructor').textContent = 'Проверьте код';
            }
        } catch (error) {
            showFieldError('group-code-error', 'Ошибка соединения');
        } finally {
            setButtonLoading('check-group-button', false);
        }
    }

    // ========================================
    // ОБРАБОТКА РЕГИСТРАЦИИ
    // ========================================

    async function handleRegister(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('register-name').value.trim();
        
        clearErrors();
        
        if (!fullName || fullName.length < 3) {
            showFieldError('register-name-error', 'Введите ФИО (минимум 3 символа)');
            return;
        }
        
        if (!currentGroupCode) {
            showFieldError('register-name-error', 'Сначала проверьте код группы');
            return;
        }
        
        setButtonLoading('register-button', true);
        
        try {
            const result = await AuthModule.register(currentGroupCode, fullName);
            
            if (result.success) {
                registrationData = {
                    id: result.cadetId,
                    fullName: result.fullName,
                    groupCode: result.groupCode,
                    groupName: result.groupName
                };
                
                // Показываем данные для входа
                document.getElementById('new-cadet-id').textContent = result.cadetId;
                document.getElementById('new-cadet-pin').textContent = result.pinCode;
                
                // Скрываем форму, показываем успех
                document.getElementById('register-step-2').style.display = 'none';
                document.getElementById('register-success').classList.add('visible');
                
            } else {
                showFieldError('register-name-error', result.error || 'Ошибка регистрации');
            }
        } catch (error) {
            showFieldError('register-name-error', 'Ошибка соединения');
        } finally {
            setButtonLoading('register-button', false);
        }
    }

    // ========================================
    // ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ========================================

    function clearErrors() {
        document.querySelectorAll('.field-error').forEach(el => {
            el.textContent = '';
            el.classList.remove('visible');
        });
        document.querySelectorAll('.auth-field input').forEach(el => {
            el.classList.remove('error');
        });
    }

    function showFieldError(elementId, message) {
        const errorEl = document.getElementById(elementId);
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.add('visible');
            
            // Подсвечиваем поле
            const input = errorEl.parentElement.querySelector('input');
            if (input) input.classList.add('error');
        }
    }

    function setButtonLoading(buttonId, loading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        const textSpan = button.querySelector('.button-text');
        
        if (loading) {
            button.disabled = true;
            if (textSpan) textSpan.style.display = 'none';
            button.insertAdjacentHTML('beforeend', '<div class="auth-spinner"></div>');
        } else {
            button.disabled = false;
            if (textSpan) textSpan.style.display = '';
            const spinner = button.querySelector('.auth-spinner');
            if (spinner) spinner.remove();
        }
    }

    function updateNetworkStatus() {
        const dot = document.getElementById('network-dot');
        const text = document.getElementById('network-text');
        
        if (navigator.onLine) {
            dot?.classList.remove('offline');
            if (text) text.textContent = 'Онлайн';
        } else {
            dot?.classList.add('offline');
            if (text) text.textContent = 'Офлайн';
        }
    }

    function showToast(message, type = 'info') {
        // Простой toast (можно заменить на более красивый)
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'warning' ? '#f59e0b' : '#3b82f6'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 10000;
            animation: fadeIn 0.3s;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ========================================
    // PUBLIC API
    // ========================================

    return {
        show,
        hide,
        switchTab,
        showToast
    };

})();

// Экспорт
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthUI;
}
