// ============================================
// ЗАГРУЗЧИК ДАННЫХ
// ============================================

let appData = {
    questions: [],
    drugs: [],
    scenarios: [],
    settings: {}
};

// Загрузка данных из API
async function loadData() {
    showLoading(true);
    
    try {
        // Пробуем загрузить из кэша
        const cached = loadFromCache();
        if (cached) {
            appData = cached;
            updateSyncStatus('✓ Из кэша');
            showLoading(false);
            initModules();
            
            // Фоновое обновление
            fetchFreshData();
            return;
        }
        
        // Загрузка с сервера
        await fetchFreshData();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        updateSyncStatus('⚠️ Офлайн');
        
        // Пробуем загрузить встроенные данные
        loadFallbackData();
    }
    
    showLoading(false);
    initModules();
}

// Загрузка свежих данных с сервера
async function fetchFreshData() {
    updateSyncStatus('🔄 Загрузка...');
    
    const response = await fetch(`${CONFIG.API_URL}?action=getAll`);
    const data = await response.json();
    
    if (data.error) {
        throw new Error(data.error);
    }
    
    appData = data;
    saveToCache(data);
    updateSyncStatus('✓ Обновлено');
    document.getElementById('lastUpdate').textContent = new Date().toLocaleString('ru');
}

// Кэширование
function saveToCache(data) {
    const cacheData = {
        data: data,
        timestamp: Date.now()
    };
    localStorage.setItem(CONFIG.CACHE_KEY, JSON.stringify(cacheData));
}

function loadFromCache() {
    const cached = localStorage.getItem(CONFIG.CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    
    // Проверка срока годности кэша
    if (Date.now() - timestamp > CONFIG.CACHE_EXPIRY) {
        return null;
    }
    
    return data;
}

// Резервные данные (встроенные в приложение)
function loadFallbackData() {
    appData = {
        questions: FALLBACK_QUESTIONS,
        drugs: FALLBACK_DRUGS,
        scenarios: FALLBACK_SCENARIOS,
        settings: {}
    };
}

// UI функции
function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function updateSyncStatus(status) {
    document.getElementById('syncStatus').textContent = status;
}

// Ручная синхронизация
async function syncData() {
    localStorage.removeItem(CONFIG.CACHE_KEY);
    await loadData();
    alert('Данные обновлены!');
}

// Инициализация модулей после загрузки данных
function initModules() {
    initTestModule();
    initCardsModule();
    initCasesModule();
    updateProgress();
}
