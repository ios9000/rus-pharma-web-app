// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    // Инициализация при загрузке страницы
    loadData(); 
    
    // Инициализация навигации (показываем меню)
    showSection('menu');
});

// Переключение разделов меню
function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
        // Если уходим из сценария - сбрасываем его
        if (section.id === 'activeScenario') {
            section.style.display = 'none';
        }
    });

    // Скрываем модальные окна
    const modal = document.getElementById('imageModal');
    if (modal) modal.classList.remove('active');

    // Показываем нужную секцию
    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        activeSection.classList.add('active');
    }

    // Обновляем кнопки навигации
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === sectionId) {
            btn.classList.add('active');
        }
    });

    // Специальная логика для разделов
    if (sectionId === 'menu') {
        // Если вернулись в меню
        document.getElementById('scenarioList').style.display = 'block';
        document.getElementById('activeScenario').style.display = 'none';
        document.getElementById('scenarioResult').style.display = 'none';
    }
    
    // === ИСПРАВЛЕНИЕ: Рендер матрицы прогресса ===
    if (sectionId === 'progress') {
        // Рендерим матрицу компетенций
        const matrixContainer = document.getElementById('competency-matrix-container');
        if (matrixContainer && typeof ProgressMatrix !== 'undefined') {
            ProgressMatrix.render(matrixContainer);
        }
        
        // Обновляем остальную статистику
        if (typeof updateProgress === 'function') {
            updateProgress();
        }
    }
}

// Зум изображений в тестах
function zoomImage() {
    const img = document.getElementById('questionImage');
    if (img && img.src) {
        openImageModal(img.src);
    }
}

// app.js (добавить в самый низ)

// ============================================
// ГЛОБАЛЬНЫЕ УТИЛИТЫ (app.js)
// ============================================

/**
 * Превращает любую ссылку Google Drive в прямую ссылку для картинки
 * Использует домен lh3.googleusercontent.com для обхода защиты от хотлинкинга
 */
function convertGoogleDriveUrl(url) {
    // 1. Защита от пустых значений
    if (!url || typeof url !== 'string') return '';

    // 2. Если это заглушка - возвращаем как есть
    if (url.includes('placehold.co')) return url;

    // 3. Если это уже "волшебная" ссылка lh3 - возвращаем
    if (url.includes('lh3.googleusercontent.com')) return url;

    // 4. Ищем ID файла
    const idMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || 
                    url.match(/id=([a-zA-Z0-9_-]+)/) ||
                    url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                    url.match(/id=([a-zA-Z0-9_-]+)/); // Повтор для надежности

    if (idMatch && idMatch[1]) {
        // !!! ВОТ ГЛАВНОЕ ИЗМЕНЕНИЕ !!!
        // Вместо drive.google.com используем lh3.googleusercontent.com/d/
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }

    return url;
}
