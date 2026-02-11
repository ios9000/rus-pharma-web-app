// ============================================
// MODULE SELECTOR — UI выбора модуля
// js/module-selector.js
// ============================================

(function() {
    'use strict';

    // ============================================
    // РЕНДЕР ГЛАВНОГО ЭКРАНА
    // ============================================

    /**
     * Render module selector in #test section
     */
    function render() {
        var container = document.getElementById('test');
        if (!container) return;

        var cadet = (typeof AuthModule !== 'undefined' && AuthModule.getCurrentCadet)
            ? AuthModule.getCurrentCadet()
            : null;

        // If no assignments, show fallback
        if (!CourseData.hasAssignments()) {
            renderFallbackMode(container, cadet);
            return;
        }

        renderModuleList(container, cadet);
    }

    // ============================================
    // FALLBACK MODE (нет назначений)
    // ============================================

    function renderFallbackMode(container, cadet) {
        var totalQuestions = (window.appData && window.appData.questions)
            ? window.appData.questions.length : 0;

        container.innerHTML =
            '<div style="padding: 20px; max-width: 600px; margin: 0 auto;">' +
                '<div style="text-align: center; margin-bottom: 25px;">' +
                    '<div style="font-size: 48px; margin-bottom: 10px;">📝</div>' +
                    '<h2 style="color: #1a3a52; margin-bottom: 8px;">Тестирование</h2>' +
                    (cadet ? '<p style="color: #666;">Курсант: ' + escapeHtml(cadet.fullName) + '</p>' : '') +
                    '<p style="color: #999; font-size: 14px;">Модули не назначены инструктором. Доступен режим практики.</p>' +
                '</div>' +
                '<button onclick="startTest()" ' +
                    'style="display: block; width: 100%; padding: 18px; background: #1a3a52; color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: bold; cursor: pointer; margin-bottom: 15px;">' +
                    'Практика: все вопросы (' + totalQuestions + ')' +
                '</button>' +
                '<button onclick="showSection(\'menu\')" ' +
                    'style="display: block; width: 100%; padding: 14px; background: transparent; color: #666; border: 2px solid #ddd; border-radius: 12px; font-size: 16px; cursor: pointer;">' +
                    '\u2190 В меню' +
                '</button>' +
            '</div>';
    }

    // ============================================
    // СПИСОК МОДУЛЕЙ ПО БЛОКАМ
    // ============================================

    function renderModuleList(container, cadet) {
        var allModules = CourseData.getAllModules();
        var assignments = CourseData.getAllAssignments();
        var progress = loadProgress(cadet ? cadet.id : null);

        // Build assignment status map: moduleNumber → assignment
        var assignmentMap = {};
        assignments.forEach(function(a) {
            var moduleNumber = a.course_modules ? a.course_modules.module_number : null;
            if (moduleNumber) {
                assignmentMap[moduleNumber] = a;
            }
        });

        // Group modules by block
        var blocks = {};
        allModules.forEach(function(m) {
            var bn = m.block_number;
            if (!blocks[bn]) {
                blocks[bn] = {
                    block_number: bn,
                    block_name: m.block_name,
                    modules: []
                };
            }
            blocks[bn].modules.push(m);
        });

        var html =
            '<div style="padding: 15px; max-width: 600px; margin: 0 auto;">' +
                '<div style="text-align: center; margin-bottom: 20px;">' +
                    '<h2 style="color: #1a3a52; margin-bottom: 5px;">📚 Модули курса</h2>' +
                    (cadet ? '<p style="color: #666; font-size: 14px;">Курсант: ' + escapeHtml(cadet.fullName) + '</p>' : '') +
                '</div>';

        // Sort and render each block
        var sortedBlocks = Object.values(blocks).sort(function(a, b) {
            return a.block_number - b.block_number;
        });

        sortedBlocks.forEach(function(block) {
            html +=
                '<div style="margin-bottom: 20px;">' +
                    '<h3 style="color: #1a3a52; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; padding-bottom: 5px; border-bottom: 2px solid #e0e0e0;">' +
                        'Блок ' + block.block_number + ': ' + escapeHtml(block.block_name) +
                    '</h3>' +
                    '<div style="display: flex; flex-direction: column; gap: 8px;">';

            block.modules.forEach(function(mod) {
                html += renderModuleCard(mod, assignmentMap, progress);
            });

            html += '</div></div>';
        });

        // Practice all questions button
        var totalQuestions = (window.appData && window.appData.questions) ? window.appData.questions.length : 0;
        html +=
            '<div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #e0e0e0;">' +
                '<button onclick="startTest()" ' +
                    'style="display: block; width: 100%; padding: 14px; background: #f8f9fa; color: #1a3a52; border: 2px solid #dee2e6; border-radius: 12px; font-size: 15px; cursor: pointer;">' +
                    '\u26A1 Практика: все вопросы (' + totalQuestions + ')' +
                '</button>' +
            '</div>' +
            '</div>';

        container.innerHTML = html;
    }

    // ============================================
    // КАРТОЧКА МОДУЛЯ
    // ============================================

    function renderModuleCard(mod, assignmentMap, progress) {
        var assignment = assignmentMap[mod.module_number];
        var moduleProgress = progress[mod.module_number];
        var status = assignment ? assignment.status : 'closed';
        var questions = CourseData.getModuleQuestions(mod.module_number);
        var questionCount = questions.length;

        var statusIcon, statusColor, clickable, bgColor;

        if (status === 'closed') {
            statusIcon = '\uD83D\uDD12'; // 🔒
            statusColor = '#999';
            clickable = false;
            bgColor = '#f5f5f5';
        } else if (moduleProgress && moduleProgress.completed) {
            statusIcon = '\u2705'; // ✅
            statusColor = '#28a745';
            clickable = true;
            bgColor = '#f0fff4';
        } else if (moduleProgress && moduleProgress.total > 0) {
            statusIcon = '\uD83D\uDFE1'; // 🟡
            statusColor = '#ffc107';
            clickable = true;
            bgColor = '#fffbf0';
        } else {
            statusIcon = '\uD83D\uDD35'; // 🔵
            statusColor = '#007bff';
            clickable = true;
            bgColor = '#f0f7ff';
        }

        var progressText = '';
        if (moduleProgress && moduleProgress.total > 0) {
            var pct = Math.round(moduleProgress.correct / moduleProgress.total * 100);
            progressText = ' \u00B7 Результат: ' + moduleProgress.correct + '/' + moduleProgress.total + ' (' + pct + '%)';
        }

        var onclickAttr = clickable && questionCount > 0
            ? 'onclick="startModuleTest(' + mod.module_number + ')"' : '';
        var hoverAttrs = clickable
            ? 'onmouseover="this.style.transform=\'translateY(-1px)\'; this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.1)\'" ' +
              'onmouseout="this.style.transform=\'none\'; this.style.boxShadow=\'none\'"'
            : '';

        return (
            '<div ' + onclickAttr + ' ' + hoverAttrs + ' ' +
                'style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; ' +
                'background: ' + bgColor + '; border: 2px solid ' + (clickable ? statusColor + '40' : '#e0e0e0') + '; ' +
                'border-radius: 12px; cursor: ' + (clickable ? 'pointer' : 'default') + '; ' +
                'transition: all 0.2s ease;' + (!clickable ? ' opacity: 0.6;' : '') + '">' +
                '<div style="font-size: 24px; min-width: 36px; text-align: center;">' + statusIcon + '</div>' +
                '<div style="flex: 1;">' +
                    '<div style="font-weight: 600; color: #1a3a52; font-size: 15px;">' +
                        mod.module_number + '. ' + escapeHtml(mod.module_name) +
                    '</div>' +
                    '<div style="color: #888; font-size: 13px; margin-top: 2px;">' +
                        (questionCount > 0 ? questionCount + ' вопросов' : 'Нет вопросов') +
                        progressText +
                    '</div>' +
                '</div>' +
                (clickable && questionCount > 0 ? '<div style="color: #1a3a52; font-size: 18px;">\u2192</div>' : '') +
            '</div>'
        );
    }

    // ============================================
    // ПРОГРЕСС (localStorage)
    // ============================================

    /**
     * Save module progress to localStorage
     */
    function saveProgress(cadetId, moduleNumber, correct, total) {
        var key = 'moduleProgress_' + (cadetId || 'guest');
        var progress = JSON.parse(localStorage.getItem(key) || '{}');

        var prev = progress[moduleNumber];
        var currentScore = Math.round(correct / total * 100);

        progress[moduleNumber] = {
            correct: correct,
            total: total,
            completed: true,
            lastAttempt: new Date().toISOString(),
            bestScore: prev ? Math.max(prev.bestScore || 0, currentScore) : currentScore
        };

        localStorage.setItem(key, JSON.stringify(progress));
    }

    /**
     * Load module progress from localStorage
     */
    function loadProgress(cadetId) {
        var key = 'moduleProgress_' + (cadetId || 'guest');
        return JSON.parse(localStorage.getItem(key) || '{}');
    }

    // ============================================
    // УТИЛИТЫ
    // ============================================

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ============================================
    // EXPORT
    // ============================================

    window.ModuleSelector = {
        render: render,
        saveProgress: saveProgress,
        loadProgress: loadProgress
    };

})();
