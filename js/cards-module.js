// ============================================
// МОДУЛЬ ФЛЭШ-КАРТ (FINAL FIXED VERSION)
// ============================================

let currentCards = [];
let currentCardIndex = 0;
let isCardFlipped = false;
let cardView = 'single'; 
let cardStats = { know: 0, repeat: 0 };

// Инициализация модуля
function initCardsModule() {
    loadCardStats();
    populateCategories();
    
    // Сброс в начало
    resetCardsState();
    loadCards('all');
}

// Функция полного сброса состояния
function resetCardsState() {
    currentCardIndex = 0;
    isCardFlipped = false;
    cardView = 'single';
    
    // Сбрасываем переворот карты визуально
    const cardEl = document.getElementById('flashcard');
    if (cardEl) cardEl.classList.remove('flipped');
}

// Функция ВЫХОДА (Сброс + Меню)
function quitCardsModule() {
    resetCardsState();
    
    // Сбрасываем фильтр категорий на "Все"
    const catSelect = document.getElementById('categoryFilter');
    if (catSelect) catSelect.value = 'all';
    
    // Возвращаемся в меню
    showSection('menu');
}

// Программное добавление кнопки "В меню" (Агрессивный метод)
function injectExitButton() {
    // 1. Ищем контейнер одиночного просмотра
    const container = document.getElementById('singleCardView');
    if (!container) return;

    // 2. Если кнопка уже есть — удаляем её, чтобы пересоздать внизу
    const existingBtn = document.getElementById('btnExitCards');
    if (existingBtn) existingBtn.remove();

    // 3. Создаем кнопку заново
    const exitBtn = document.createElement('button');
    exitBtn.id = 'btnExitCards';
    exitBtn.innerHTML = '🏠 В меню';
    exitBtn.onclick = quitCardsModule;
    
    // 4. Стили кнопки
    Object.assign(exitBtn.style, {
        display: 'block',
        width: '100%',
        marginTop: '20px',
        marginBottom: '20px',
        padding: '15px',
        background: '#f8f9fa',
        color: '#666',
        border: '1px solid #ddd',
        borderRadius: '10px',
        fontSize: '16px',
        cursor: 'pointer',
        fontWeight: 'bold',
        textAlign: 'center'
    });
    
    // 5. Добавляем в самый конец контейнера
    container.appendChild(exitBtn);
}

function populateCategories() {
    if (!appData.drugs) return;

    const categories = [...new Set(appData.drugs.map(d => d.category))];
    const select = document.getElementById('categoryFilter');
    
    if (!select) return;

    while (select.options.length > 1) {
        select.remove(1);
    }
    
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function loadCards(category = 'all') {
    if (!appData.drugs || appData.drugs.length === 0) {
        const flashcardEl = document.getElementById('flashcard');
        if (flashcardEl) flashcardEl.innerHTML = '<div style="padding:20px; text-align:center;">Нет данных</div>';
        return;
    }

    if (category === 'all') {
        currentCards = [...appData.drugs];
    } else {
        currentCards = appData.drugs.filter(d => d.category === category);
    }
    
    currentCardIndex = 0;
    isCardFlipped = false;
    updateCardsUI();
}

function filterCards() {
    const category = document.getElementById('categoryFilter').value;
    loadCards(category);
}

function setCardView(view) {
    cardView = view;
    
    const btnSingle = document.getElementById('viewSingle');
    const btnGrid = document.getElementById('viewGrid');
    
    if (btnSingle) btnSingle.classList.toggle('active', view === 'single');
    if (btnGrid) btnGrid.classList.toggle('active', view === 'grid');
    
    updateCardsUI();
}

function updateCardsUI() {
    const totalEl = document.getElementById('totalCards');
    if (totalEl) totalEl.textContent = currentCards.length;
    
    updateCardsProgressBar();

    if (currentCards.length === 0) return;

    const singleView = document.getElementById('singleCardView');
    const gridView = document.getElementById('gridCardView');

    if (cardView === 'single') {
        if (singleView) singleView.style.display = 'block';
        if (gridView) gridView.style.display = 'none';
        
        showCard(currentCardIndex);
        // ВАЖНО: Добавляем кнопку ПОСЛЕ отрисовки карты
        setTimeout(injectExitButton, 50); 
    } else {
        if (singleView) singleView.style.display = 'none';
        if (gridView) gridView.style.display = 'block';
        renderGrid();
    }
}

function updateCardsProgressBar() {
    const total = currentCards.length;
    const progressFill = document.getElementById('cardsProgressFill');
    if (total === 0 || !progressFill) return;
    const percent = ((currentCardIndex + 1) / total) * 100;
    progressFill.style.width = `${percent}%`;
}

// === ОТРИСОВКА ОДНОЙ КАРТЫ ===
function showCard(index) {
    if (index < 0 || index >= currentCards.length) return;
    
    const card = currentCards[index];
    const cardEl = document.getElementById('flashcard');
    
    if (cardEl) cardEl.classList.remove('flipped');
    isCardFlipped = false;
    
    document.getElementById('cardIndex').textContent = index + 1;
    document.getElementById('cardCategory').textContent = card.category;
    document.getElementById('drugName').textContent = card.name;
    
    const innEl = document.getElementById('drugINN_front');
    if (innEl) innEl.textContent = card.inn || '';
    
    // --- КАРТИНКА ---
    let img = document.getElementById('drugImage');
    const placeholder = document.getElementById('imagePlaceholder');
    const imgContainer = img ? img.parentElement : null;

    if (imgContainer) {
        const directUrl = (typeof convertGoogleDriveUrl === 'function') 
            ? convertGoogleDriveUrl(card.image)
            : card.imageUrl;

        if (directUrl && directUrl.length > 5) {
            img.remove();
            img = document.createElement('img');
            img.id = 'drugImage';
            img.alt = card.name;
            
            img.setAttribute('referrerpolicy', 'no-referrer');
            img.referrerPolicy = 'no-referrer';
            img.src = directUrl;
            
            Object.assign(img.style, {
                display: 'block',
                maxWidth: '100%',
                maxHeight: '220px',
                objectFit: 'contain',
                borderRadius: '8px',
                margin: '10px auto'
            });
            
            img.onclick = (e) => {
                e.stopPropagation();
                if (typeof openImageModal === 'function') openImageModal(directUrl);
            };

            img.onerror = function() {
                this.style.display = 'none';
                if (placeholder) {
                    placeholder.style.display = 'flex';
                    placeholder.textContent = '❌'; 
                }
            };

            imgContainer.insertBefore(img, placeholder);
            if (placeholder) placeholder.style.display = 'none';
            
        } else {
            if (img) img.style.display = 'none';
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.textContent = getCategoryIcon(card.category);
            }
        }
    }

    // Обратная сторона
    document.getElementById('drugName_back').textContent = card.name;
    const badgeEl = document.getElementById('drugForm_badge');
    if (badgeEl) badgeEl.textContent = card.form;
    
    document.getElementById('drugDosage').textContent = card.dosage;
    document.getElementById('drugIndications').textContent = card.indications;
    document.getElementById('drugContra').textContent = card.contraindications;
    document.getElementById('drugSideEffects').textContent = card.sideEffects;
    document.getElementById('drugField').textContent = card.fieldNotes;
}

// === КАТАЛОГ (GRID) ===
function renderGrid() {
    const grid = document.getElementById('cardsGrid');
    if (!grid) return;
    
    const results = JSON.parse(localStorage.getItem('cardResults') || '[]');
    const totalLearned = results.filter(r => r.status === 'know').length;
    
    grid.innerHTML = `
        <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin-bottom: 20px; display: flex; justify-content: space-around; text-align: center;">
            <div>
                <div style="font-size: 20px; font-weight: bold; color: #1a3a52;">${appData.drugs.length}</div>
                <div style="font-size: 12px; color: #666;">Всего</div>
            </div>
            <div>
                <div style="font-size: 20px; font-weight: bold; color: #28a745;">${totalLearned}</div>
                <div style="font-size: 12px; color: #666;">Изучено</div>
            </div>
        </div>
        <div id="gridItemsContainer" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;"></div>
    `;
    
    const container = document.getElementById('gridItemsContainer');

    currentCards.forEach((card, index) => {
        const status = results.find(r => r.drugId === card.id || r.drug === card.name);
        let statusIcon = '';
        let borderColor = '#eee';
        
        if (status && status.status === 'know') {
            statusIcon = '<span style="color:#28a745; position:absolute; top:5px; right:5px;">✅</span>';
            borderColor = '#d4edda';
        } else if (status && status.status === 'dontknow') {
            statusIcon = '<span style="color:#dc3545; position:absolute; top:5px; right:5px;">↻</span>';
            borderColor = '#f8d7da';
        }

        const item = document.createElement('div');
        item.className = 'grid-card-item';
        
        Object.assign(item.style, {
            border: `2px solid ${borderColor}`,
            borderRadius: '10px',
            padding: '15px 10px',
            textAlign: 'center',
            background: 'white',
            position: 'relative',
            cursor: 'pointer'
        });
        
        item.innerHTML = `
            ${statusIcon}
            <div style="font-size: 30px; margin-bottom: 5px;">${getCategoryIcon(card.category)}</div>
            <h4 style="margin: 5px 0; font-size: 14px; color: #333;">${card.name}</h4>
        `;
        
        item.onclick = () => {
            currentCardIndex = index;
            setCardView('single');
        };
        
        container.appendChild(item);
    });

    // Кнопка ВЫХОДА в каталоге
    const exitBtn = document.createElement('button');
    exitBtn.innerHTML = "🏠 В меню";
    exitBtn.onclick = quitCardsModule;
    
    Object.assign(exitBtn.style, {
        gridColumn: "1 / -1",
        marginTop: "20px",
        padding: "15px",
        background: "white",
        color: "#666",
        border: "1px solid #ccc",
        borderRadius: "10px",
        cursor: "pointer",
        fontWeight: "bold"
    });
    
    container.appendChild(exitBtn);
}

function flipCard() {
    const card = document.getElementById('flashcard');
    if (card) {
        card.classList.toggle('flipped');
        isCardFlipped = !isCardFlipped;
    }
}

function nextCard() {
    if (currentCardIndex < currentCards.length - 1) {
        currentCardIndex++;
        showCard(currentCardIndex);
        updateCardsProgressBar();
    } else {
        showNotification('🎉 Карты закончились!', 'success');
    }
}

function prevCard() {
    if (currentCardIndex > 0) {
        currentCardIndex--;
        showCard(currentCardIndex);
        updateCardsProgressBar();
    }
}

function markCard(status) {
    const currentDrug = currentCards[currentCardIndex];
    const results = JSON.parse(localStorage.getItem('cardResults') || '[]');
    
    const newResults = results.filter(r => r.drugId !== currentDrug.id && r.drug !== currentDrug.name);
    
    newResults.push({
        drugId: currentDrug.id,
        drug: currentDrug.name,
        status: status,
        timestamp: Date.now()
    });
    
    localStorage.setItem('cardResults', JSON.stringify(newResults));
    loadCardStats();
    
    showNotification(status === 'know' ? '✅ Изучено' : '↻ На повтор', status === 'know' ? 'success' : 'warning');
    
    setTimeout(() => {
        nextCard();
    }, 400);
}

// === КРАСИВЫЕ УВЕДОМЛЕНИЯ ===
function showNotification(message, type = 'info') {
    const old = document.querySelector('.custom-notification');
    if (old) old.remove();

    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    notification.textContent = message;
    
    Object.assign(notification.style, {
        position: 'fixed',
        bottom: '80px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        background: type === 'success' ? 'rgba(40, 167, 69, 0.95)' : 'rgba(255, 193, 7, 0.95)',
        color: type === 'success' ? 'white' : 'black',
        borderRadius: '25px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: '1000',
        fontWeight: 'bold',
        fontSize: '16px',
        opacity: '0',
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none'
    });

    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
        notification.style.opacity = '1';
    });
    
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
    }, 1500);
}

function getCategoryIcon(category) {
    const icons = {
        'Антибиотики': '💊', 'Анальгетики': '💉', 'Антидоты': '🧪',
        'Экстренные': '⚡', 'Антигистаминные': '🌸', 'Инструменты': '✂️',
        'Расходники': '🩹', 'default': '💊'
    };
    return icons[category] || icons['default'];
}

function loadCardStats() {
    const results = JSON.parse(localStorage.getItem('cardResults') || '[]');
    cardStats.know = results.filter(r => r.status === 'know').length;
    cardStats.repeat = results.filter(r => r.status === 'dontknow').length;
    
    const knowEl = document.getElementById('knowCount');
    const repeatEl = document.getElementById('repeatCount');

    if (knowEl) knowEl.textContent = cardStats.know;
    if (repeatEl) repeatEl.textContent = cardStats.repeat;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

