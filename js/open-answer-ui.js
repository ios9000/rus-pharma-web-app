// ============================================
// OPEN ANSWER UI — задания с развёрнутым ответом
// js/open-answer-ui.js
// ============================================

(function() {
    'use strict';

    // State
    var _questions = [];
    var _savedAnswers = {};  // { questionId: { field_0: "text", ... } }
    var _moduleNumber = null;
    var _loadPromise = null;

    // Subtype icons
    var SUBTYPE_ICONS = {
        explanation: '\uD83D\uDCA1', // 💡
        calculation: '\uD83D\uDD22', // 🔢
        scheme:      '\uD83D\uDCCB', // 📋
        listing:     '\uD83D\uDCDD'  // 📝
    };

    var SUBTYPE_LABELS = {
        explanation: 'Объяснение',
        calculation: 'Расчёт',
        scheme:      'Схема',
        listing:     'Перечисление'
    };

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    /**
     * Load open answer questions for a module (preload-friendly).
     * Can be called early; data will be ready by the time render() is called.
     */
    function loadForModule(moduleNumber) {
        _moduleNumber = moduleNumber;
        _questions = [];
        _savedAnswers = {};

        if (!window.supabaseClient) {
            _loadPromise = Promise.resolve();
            return _loadPromise;
        }

        _loadPromise = _doLoad(moduleNumber);
        return _loadPromise;
    }

    async function _doLoad(moduleNumber) {
        try {
            // 1. Get module PK from module_number
            var modResult = await window.supabaseClient
                .from('course_modules')
                .select('id')
                .eq('module_number', moduleNumber)
                .single();

            if (modResult.error || !modResult.data) {
                console.warn('[OpenAnswerUI] Module not found:', moduleNumber);
                return;
            }

            var moduleId = modResult.data.id;

            // 2. Load questions for this module
            var qResult = await window.supabaseClient
                .from('open_answer_questions')
                .select('*')
                .eq('module_id', moduleId)
                .order('sort_order');

            if (qResult.error || !qResult.data) {
                console.warn('[OpenAnswerUI] Error loading questions:', qResult.error);
                return;
            }

            _questions = qResult.data;

            if (_questions.length === 0) return;

            // 3. Load saved answers (latest per question)
            var cadet = _getCadet();
            if (!cadet) return;

            var questionIds = _questions.map(function(q) { return q.id; });

            var ansResult = await window.supabaseClient
                .from('student_open_answers')
                .select('question_id, answers, answered_at')
                .eq('cadet_id', cadet.id)
                .eq('group_code', cadet.groupCode)
                .in('question_id', questionIds)
                .order('answered_at', { ascending: false });

            if (ansResult.error || !ansResult.data) {
                console.warn('[OpenAnswerUI] Error loading saved answers:', ansResult.error);
                return;
            }

            // Keep only the latest answer per question
            _savedAnswers = {};
            ansResult.data.forEach(function(row) {
                if (!_savedAnswers[row.question_id]) {
                    _savedAnswers[row.question_id] = row.answers || {};
                }
            });

            console.log('[OpenAnswerUI] Loaded ' + _questions.length + ' questions, ' +
                Object.keys(_savedAnswers).length + ' saved answers for module ' + moduleNumber);

        } catch (err) {
            console.warn('[OpenAnswerUI] Load error:', err);
        }
    }

    // ============================================
    // РЕНДЕР СПИСКА ЗАДАНИЙ
    // ============================================

    function render() {
        var container = document.getElementById('test');
        if (!container) return;

        // Wait for load if still in progress
        if (_loadPromise) {
            _loadPromise.then(function() { _renderList(container); });
        } else {
            _renderList(container);
        }
    }

    function _renderList(container) {
        if (_questions.length === 0) {
            container.innerHTML =
                '<div style="text-align: center; padding: 40px 20px;">' +
                    '<div style="font-size: 48px; margin-bottom: 15px;">\uD83D\uDCDD</div>' +
                    '<h3 style="color: #1a3a52; margin-bottom: 10px;">Нет заданий</h3>' +
                    '<p style="color: #888;">Для этого модуля пока нет заданий с развёрнутым ответом.</p>' +
                    '<button onclick="backToModuleSelector()" ' +
                        'style="margin-top: 20px; padding: 14px 30px; background: #17a2b8; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer;">' +
                        '\uD83D\uDCDA К списку модулей</button>' +
                '</div>';
            return;
        }

        var savedCount = getSavedCount();
        var html =
            '<div style="padding: 15px; max-width: 600px; margin: 0 auto;">' +
                '<div style="text-align: center; margin-bottom: 20px;">' +
                    '<h2 style="color: #1a3a52; margin-bottom: 5px;">\uD83D\uDCDD \u0417\u0430\u0434\u0430\u043D\u0438\u044F \u043C\u043E\u0434\u0443\u043B\u044F ' + _moduleNumber + '</h2>' +
                    '<p style="color: #888; font-size: 14px;">' +
                        'Выполнено: ' + savedCount + ' из ' + _questions.length +
                    '</p>' +
                '</div>' +
                '<div style="display: flex; flex-direction: column; gap: 10px;">';

        _questions.forEach(function(q, index) {
            var icon = SUBTYPE_ICONS[q.question_subtype] || '\uD83D\uDCDD';
            var label = SUBTYPE_LABELS[q.question_subtype] || q.question_subtype;
            var hasSaved = !!_savedAnswers[q.id];
            var statusIcon = hasSaved ? '\u2705' : '\u26AA';
            var statusText = hasSaved ? 'Сохранено' : 'Не выполнено';
            var statusColor = hasSaved ? '#28a745' : '#999';
            var bgColor = hasSaved ? '#f0fff4' : '#f8f9fa';

            // Truncate question text for card
            var shortText = q.text.length > 80 ? q.text.substring(0, 80) + '...' : q.text;

            html +=
                '<div onclick="OpenAnswerUI.openQuestion(\'' + q.id + '\')" ' +
                    'style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; ' +
                    'background: ' + bgColor + '; border: 2px solid ' + statusColor + '30; ' +
                    'border-radius: 12px; cursor: pointer; transition: all 0.2s ease;" ' +
                    'onmouseover="this.style.transform=\'translateY(-1px)\'; this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.1)\'" ' +
                    'onmouseout="this.style.transform=\'none\'; this.style.boxShadow=\'none\'">' +
                    '<div style="font-size: 28px; min-width: 40px; text-align: center;">' + icon + '</div>' +
                    '<div style="flex: 1;">' +
                        '<div style="font-weight: 600; color: #1a3a52; font-size: 15px; margin-bottom: 3px;">' +
                            'Задание ' + (index + 1) + ' <span style="font-weight: 400; color: #888; font-size: 13px;">(' + _escapeHtml(label) + ')</span>' +
                        '</div>' +
                        '<div style="color: #555; font-size: 13px; line-height: 1.3;">' + _escapeHtml(shortText) + '</div>' +
                    '</div>' +
                    '<div style="text-align: center; min-width: 36px;">' +
                        '<div style="font-size: 20px;">' + statusIcon + '</div>' +
                        '<div style="font-size: 11px; color: ' + statusColor + ';">' + statusText + '</div>' +
                    '</div>' +
                    '<div style="color: #1a3a52; font-size: 18px;">\u2192</div>' +
                '</div>';
        });

        html += '</div>';

        // Back button
        html +=
            '<button onclick="backToModuleSelector()" ' +
                'style="display: block; width: 100%; margin-top: 20px; padding: 14px; background: transparent; color: #666; border: 2px solid #ddd; border-radius: 12px; font-size: 16px; cursor: pointer;">' +
                '\u2190 К списку модулей</button>' +
            '</div>';

        container.innerHTML = html;
    }

    // ============================================
    // ФОРМА ЗАДАНИЯ
    // ============================================

    function openQuestion(questionId) {
        var container = document.getElementById('test');
        if (!container) return;

        var question = null;
        for (var i = 0; i < _questions.length; i++) {
            if (_questions[i].id === questionId) {
                question = _questions[i];
                break;
            }
        }
        if (!question) return;

        var icon = SUBTYPE_ICONS[question.question_subtype] || '\uD83D\uDCDD';
        var label = SUBTYPE_LABELS[question.question_subtype] || question.question_subtype;
        var saved = _savedAnswers[questionId] || {};
        var template = question.answer_template || [];

        // If template is a string (from JSON), parse it
        if (typeof template === 'string') {
            try { template = JSON.parse(template); } catch(e) { template = []; }
        }

        // If template is empty, create a single default textarea
        if (!Array.isArray(template) || template.length === 0) {
            template = [{ label: 'Ответ', type: 'textarea' }];
        }

        var html =
            '<div style="padding: 15px; max-width: 600px; margin: 0 auto;">' +
                // Header
                '<div style="margin-bottom: 20px;">' +
                    '<button onclick="OpenAnswerUI.render()" ' +
                        'style="background: none; border: none; color: #17a2b8; font-size: 15px; cursor: pointer; padding: 0; margin-bottom: 10px;">' +
                        '\u2190 К списку заданий</button>' +
                    '<div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">' +
                        '<span style="font-size: 32px;">' + icon + '</span>' +
                        '<div>' +
                            '<span style="background: #e3f2fd; color: #1565c0; padding: 3px 10px; border-radius: 10px; font-size: 12px; font-weight: 500;">' +
                                _escapeHtml(label) +
                            '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div style="color: #1a3a52; font-size: 17px; line-height: 1.5; font-weight: 500;">' +
                        _escapeHtml(question.text) +
                    '</div>' +
                '</div>' +
                // Fields
                '<form id="openAnswerForm" onsubmit="return false;" style="display: flex; flex-direction: column; gap: 16px;">';

        template.forEach(function(field, idx) {
            var fieldKey = 'field_' + idx;
            var savedValue = saved[fieldKey] || '';
            var fieldLabel = field.label || ('Поле ' + (idx + 1));

            html +=
                '<div>' +
                    '<label style="display: block; font-weight: 600; color: #1a3a52; margin-bottom: 5px; font-size: 14px;">' +
                        _escapeHtml(fieldLabel) +
                    '</label>' +
                    '<textarea id="oaf_' + fieldKey + '" ' +
                        'style="width: 100%; min-height: 100px; padding: 12px; border: 2px solid #e0e0e0; border-radius: 10px; font-size: 15px; font-family: inherit; resize: vertical; box-sizing: border-box;" ' +
                        'placeholder="Введите ответ...">' + _escapeHtml(savedValue) + '</textarea>' +
                '</div>';
        });

        html +=
                '</form>' +
                // Save button
                '<button id="saveOpenAnswerBtn" onclick="OpenAnswerUI.saveCurrentAnswer(\'' + questionId + '\')" ' +
                    'style="display: block; width: 100%; margin-top: 20px; padding: 16px; background: #1a3a52; color: white; border: none; border-radius: 12px; font-size: 17px; font-weight: bold; cursor: pointer;">' +
                    '\uD83D\uDCBE Сохранить ответ</button>' +
                // Save status
                '<div id="saveStatus" style="text-align: center; margin-top: 10px; font-size: 14px; color: #888;"></div>' +
            '</div>';

        container.innerHTML = html;
    }

    // ============================================
    // СОХРАНЕНИЕ ОТВЕТА
    // ============================================

    async function saveCurrentAnswer(questionId) {
        var question = null;
        for (var i = 0; i < _questions.length; i++) {
            if (_questions[i].id === questionId) {
                question = _questions[i];
                break;
            }
        }
        if (!question) return;

        var template = question.answer_template || [];
        if (typeof template === 'string') {
            try { template = JSON.parse(template); } catch(e) { template = []; }
        }
        if (!Array.isArray(template) || template.length === 0) {
            template = [{ label: 'Ответ', type: 'textarea' }];
        }

        // Collect values
        var answers = {};
        template.forEach(function(field, idx) {
            var fieldKey = 'field_' + idx;
            var el = document.getElementById('oaf_' + fieldKey);
            answers[fieldKey] = el ? el.value.trim() : '';
        });

        // Check if at least one field is filled
        var hasContent = Object.values(answers).some(function(v) { return v.length > 0; });
        if (!hasContent) {
            _showSaveStatus('Заполните хотя бы одно поле', '#dc3545');
            return;
        }

        var btn = document.getElementById('saveOpenAnswerBtn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Сохранение...';
        }

        var cadet = _getCadet();
        if (!cadet || !window.supabaseClient) {
            _showSaveStatus('Ошибка: нет авторизации или Supabase недоступен', '#dc3545');
            if (btn) { btn.disabled = false; btn.textContent = '\uD83D\uDCBE Сохранить ответ'; }
            return;
        }

        try {
            var result = await window.supabaseClient
                .from('student_open_answers')
                .insert({
                    cadet_id: cadet.id,
                    group_code: cadet.groupCode,
                    question_id: questionId,
                    answers: answers
                });

            if (result.error) {
                console.warn('[OpenAnswerUI] Save error:', result.error);
                _showSaveStatus('Ошибка сохранения: ' + result.error.message, '#dc3545');
            } else {
                _savedAnswers[questionId] = answers;
                _showSaveStatus('\u2705 Ответ сохранён!', '#28a745');
            }
        } catch (err) {
            console.warn('[OpenAnswerUI] Save exception:', err);
            _showSaveStatus('Ошибка сети', '#dc3545');
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = '\uD83D\uDCBE Сохранить ответ';
        }
    }

    // ============================================
    // ГЕТТЕРЫ
    // ============================================

    function hasQuestions() {
        return _questions.length > 0;
    }

    function getQuestionCount() {
        return _questions.length;
    }

    function getSavedCount() {
        var count = 0;
        _questions.forEach(function(q) {
            if (_savedAnswers[q.id]) count++;
        });
        return count;
    }

    // ============================================
    // УТИЛИТЫ
    // ============================================

    function _getCadet() {
        if (typeof AuthModule !== 'undefined' && AuthModule.getCurrentCadet) {
            return AuthModule.getCurrentCadet();
        }
        return null;
    }

    function _showSaveStatus(text, color) {
        var el = document.getElementById('saveStatus');
        if (el) {
            el.textContent = text;
            el.style.color = color;
        }
    }

    function _escapeHtml(str) {
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

    window.OpenAnswerUI = {
        loadForModule: loadForModule,
        render: render,
        openQuestion: openQuestion,
        saveCurrentAnswer: saveCurrentAnswer,
        hasQuestions: hasQuestions,
        getQuestionCount: getQuestionCount,
        getSavedCount: getSavedCount
    };

})();
