// МОДУЛЬ ПРОГРЕССА
function updateProgress() {
    // 1. Дни обучения
    const startDate = localStorage.getItem('startDate');
    if (!startDate) {
        localStorage.setItem('startDate', new Date().toISOString());
        document.getElementById('studyDays').textContent = '1';
    } else {
        const days = Math.floor((new Date() - new Date(startDate)) / (1000 * 60 * 60 * 24)) + 1;
        document.getElementById('studyDays').textContent = days;
    }
    
    // 2. Статистика тестов
    const testResults = JSON.parse(localStorage.getItem('testResults') || '[]');
    // Используем правильный ID элемента
    const testsCompleteEl = document.getElementById('testsComplete');
    if (testsCompleteEl) {
        testsCompleteEl.textContent = testResults.length;
    }
    
    if (testResults.length > 0) {
        const avgScore = testResults.reduce((sum, r) => sum + r.score, 0) / testResults.length;
        const bestScore = Math.max(...testResults.map(r => r.score));
        
        const avgEl = document.getElementById('avgScore');
        const bestEl = document.getElementById('bestScore');
        
        if (avgEl) avgEl.textContent = Math.round(avgScore) + '%';
        if (bestEl) bestEl.textContent = bestScore + '%';
    }
    
    // 3. Общий прогресс и категории (ИСПРАВЛЕНО: drugsDB -> appData.drugs)
    // Проверяем, загружены ли препараты, чтобы избежать ошибок
    if (appData.drugs && appData.drugs.length > 0) {
        const overallProgress = calculateOverallProgress();
        const progBar = document.getElementById('overallProgress');
        if (progBar) progBar.style.width = overallProgress + '%';
        
        updateCategoryProgress();
    }
    
    // 4. Достижения
    updateAchievements();
}

function calculateOverallProgress() {
    const testResults = JSON.parse(localStorage.getItem('testResults') || '[]');
    const cardResults = JSON.parse(localStorage.getItem('cardResults') || '[]');
    
    // ИСПРАВЛЕНО: drugsDB -> appData.drugs
    const totalDrugs = appData.drugs ? appData.drugs.length : 0;
    
    const testProgress = Math.min(100, (testResults.length / 20) * 100);
    const cardProgress = totalDrugs > 0 ? Math.min(100, (cardResults.filter(r => r.status === 'know').length / totalDrugs) * 100) : 0;
    
    return Math.round((testProgress + cardProgress) / 2);
}

function updateAchievements() {
    const achievements = [];
    const testResults = JSON.parse(localStorage.getItem('testResults') || '[]');
    const cardResults = JSON.parse(localStorage.getItem('cardResults') || '[]');
    
    if (testResults.length >= 1) achievements.push('🏆 Первый тест');
    if (testResults.some(r => r.score >= 90)) achievements.push('⭐ Отличник');
    if (cardResults.filter(r => r.status === 'know').length >= 5) achievements.push('🎯 Знаток препаратов');
    
    const container = document.getElementById('achievements');
    if (container) {
        // ИСПРАВЛЕНО: убраны inline-стили, чтобы CSS мог управлять отображением
        container.innerHTML = achievements.length 
            ? achievements.map(a => `<div class="achievement-tag">${a}</div>`).join('')
            : '<div class="no-achievements">Пока нет достижений</div>';
    }
}

function updateCategoryProgress() {
    // ИСПРАВЛЕНО: drugsDB -> appData.drugs
    if (!appData.drugs) return;

    const categories = ['Антибиотики', 'Анальгетики', 'Антидоты', 'Экстренные'];
    const cardResults = JSON.parse(localStorage.getItem('cardResults') || '[]');
    
    const html = categories.map(cat => {
        // ИСПРАВЛЕНО: drugsDB -> appData.drugs
        const total = appData.drugs.filter(d => d.category === cat).length;
        const known = cardResults.filter(r => {
            const drug = appData.drugs.find(d => (d.id === r.drugId || d.name === r.drugId)); // Поддержка ID и имени
            return drug && drug.category === cat && r.status === 'know';
        }).length;
        
        const percentage = total > 0 ? Math.round((known / total) * 100) : 0;
        
        return `
            <div class="stat-row" style="margin-bottom: 8px;">
                <div style="display:flex; justify-content:space-between; font-size:14px; margin-bottom:2px;">
                    <span>${cat}</span>
                    <strong>${percentage}%</strong>
                </div>
                <div class="progress-bar" style="height: 6px; background:#eee; border-radius:3px;">
                    <div class="progress-fill" style="width: ${percentage}%; height:100%; background:#4CAF50; border-radius:3px;"></div>
                </div>
            </div>
        `;
    }).join('');
    
    const catContainer = document.getElementById('categoryProgress');
    if (catContainer) catContainer.innerHTML = html;
}
