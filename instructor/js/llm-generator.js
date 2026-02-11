// LLM Generation UI module
// Handles file upload, text extraction, generation settings, and Edge Function calls

const LLMGenerator = (() => {
    let initialized = false;
    let extractedText = '';
    let isGenerating = false;

    function el(id) { return document.getElementById(id); }

    function init() {
        if (initialized) return;
        initialized = true;
        renderUI();
        bindEvents();
    }

    // =============================================
    // RENDER UI
    // =============================================

    function renderUI() {
        const container = el('generation-container');
        if (!container) return;

        container.innerHTML = `
            <!-- Upload section -->
            <div class="gen-card">
                <h3 class="gen-card-title">Загрузка материалов</h3>

                <div id="gen-upload-zone" class="gen-upload-zone">
                    <div class="gen-upload-icon">&#128196;</div>
                    <div class="gen-upload-text">Перетащите файл сюда или нажмите для выбора</div>
                    <div class="gen-upload-hint">PDF, DOCX, TXT (до 10 МБ)</div>
                    <input type="file" id="gen-file-input" accept=".pdf,.docx,.doc,.txt" hidden>
                </div>

                <div id="gen-file-info" class="gen-file-info hidden">
                    <span id="gen-file-name" class="gen-file-name"></span>
                    <button type="button" id="gen-file-clear" class="gen-file-clear" title="Очистить">&#10005;</button>
                </div>

                <div class="gen-divider"><span>или</span></div>

                <div class="form-group" style="margin-bottom: 0;">
                    <label for="gen-textarea">Вставьте текст лекции</label>
                    <textarea id="gen-textarea" class="gen-textarea" rows="6"
                        placeholder="Скопируйте и вставьте текст лекции сюда..."></textarea>
                </div>

                <div id="gen-text-stats" class="gen-text-stats hidden">
                    <span id="gen-char-count"></span>
                </div>
            </div>

            <!-- Settings section -->
            <div class="gen-card">
                <h3 class="gen-card-title">Настройки генерации</h3>

                <div class="form-group">
                    <label>Тип контента</label>
                    <div class="gen-type-grid">
                        <label class="gen-type-option">
                            <input type="checkbox" value="question" checked>
                            <span>Тестовые вопросы</span>
                        </label>
                        <label class="gen-type-option">
                            <input type="checkbox" value="drug" checked>
                            <span>Карточки препаратов</span>
                        </label>
                        <label class="gen-type-option">
                            <input type="checkbox" value="flashcard" checked>
                            <span>Flash-карточки</span>
                        </label>
                        <label class="gen-type-option">
                            <input type="checkbox" value="scenario" checked>
                            <span>Сценарии</span>
                        </label>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="gen-competency">Компетенция</label>
                        <select id="gen-competency" class="filter-select">
                            <option value="">-- Не указана --</option>
                            ${buildCompetencyOptions()}
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="gen-block">Блок</label>
                        <select id="gen-block" class="filter-select" disabled>
                            <option value="">Авто (по компетенции)</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="gen-difficulty">Сложность</label>
                        <select id="gen-difficulty" class="filter-select">
                            <option value="1">1 — Базовый</option>
                            <option value="2" selected>2 — Средний</option>
                            <option value="3">3 — Продвинутый</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="gen-count">Количество</label>
                        <input type="number" id="gen-count" value="5" min="1" max="20">
                        <span class="gen-count-hint">элементов каждого типа</span>
                    </div>
                </div>

                <div class="form-group">
                    <label for="gen-instructions">Дополнительные пожелания (опционально)</label>
                    <textarea id="gen-instructions" rows="3"
                        placeholder="Например: &laquo;Фокус на дозировках&raquo;, &laquo;Сложные вопросы про полевые условия&raquo;..."></textarea>
                </div>

                <button type="button" id="gen-submit-btn" class="btn-primary gen-submit-btn" disabled>
                    Сгенерировать контент
                </button>
            </div>

            <!-- Progress -->
            <div id="gen-progress" class="gen-card gen-progress hidden">
                <div class="gen-progress-spinner"></div>
                <div class="gen-progress-text">Claude AI генерирует контент...</div>
                <div class="gen-progress-hint">Это может занять 15–60 секунд</div>
            </div>

            <!-- Results section -->
            <div id="gen-results" class="gen-card hidden">
                <h3 class="gen-card-title">Результаты генерации</h3>
                <div id="gen-results-meta" class="gen-results-meta"></div>
                <div id="gen-results-list"></div>
            </div>
        `;
    }

    function buildCompetencyOptions() {
        if (typeof COMPETENCY_BLOCKS === 'undefined') return '';

        let html = '';
        for (const [blockId, block] of Object.entries(COMPETENCY_BLOCKS)) {
            html += `<optgroup label="${block.icon} ${block.name}">`;
            for (const compId of block.competencies) {
                const comp = COMPETENCIES_CONFIG[compId];
                if (comp) {
                    html += `<option value="${comp.id}">${comp.name}</option>`;
                }
            }
            html += '</optgroup>';
        }
        return html;
    }

    // =============================================
    // BIND EVENTS
    // =============================================

    function bindEvents() {
        const uploadZone = el('gen-upload-zone');
        const fileInput = el('gen-file-input');
        const fileClear = el('gen-file-clear');
        const textarea = el('gen-textarea');
        const submitBtn = el('gen-submit-btn');
        const competencySelect = el('gen-competency');

        // Upload zone click
        uploadZone.addEventListener('click', () => fileInput.click());

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });

        // Drag & drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                handleFileUpload(e.dataTransfer.files[0]);
            }
        });

        // Clear file
        fileClear.addEventListener('click', clearFile);

        // Textarea input
        textarea.addEventListener('input', () => {
            extractedText = textarea.value;
            updateTextStats();
            updateSubmitButton();
        });

        // Competency change updates block
        competencySelect.addEventListener('change', () => {
            const blockSelect = el('gen-block');
            const compId = competencySelect.value;
            if (compId && COMPETENCIES_CONFIG[compId]) {
                const blockId = COMPETENCIES_CONFIG[compId].block;
                const block = COMPETENCY_BLOCKS[blockId];
                blockSelect.innerHTML = `<option value="${blockId}">${block.icon} ${block.name}</option>`;
            } else {
                blockSelect.innerHTML = '<option value="">Авто (по компетенции)</option>';
            }
        });

        // Submit
        submitBtn.addEventListener('click', generateContent);
    }

    // =============================================
    // FILE HANDLING
    // =============================================

    async function handleFileUpload(file) {
        const validation = TextExtractor.validateFile(file);
        if (!validation.valid) {
            showToast(validation.error, true);
            return;
        }

        const uploadZone = el('gen-upload-zone');
        const fileInfo = el('gen-file-info');
        const fileName = el('gen-file-name');
        const textarea = el('gen-textarea');

        // Show loading state on upload zone
        uploadZone.classList.add('extracting');
        const originalText = uploadZone.querySelector('.gen-upload-text');
        const savedText = originalText.textContent;
        originalText.textContent = 'Извлечение текста...';

        try {
            const result = await TextExtractor.extractFromFile(file);
            extractedText = result.text;

            // Show file info
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            fileName.textContent = `${file.name} (${sizeMB} МБ, ${result.pages} стр.)`;
            fileInfo.classList.remove('hidden');

            // Put extracted text into textarea
            textarea.value = extractedText;
            textarea.disabled = true;

            updateTextStats();
            updateSubmitButton();
        } catch (err) {
            showToast('Ошибка извлечения текста: ' + err.message, true);
        } finally {
            uploadZone.classList.remove('extracting');
            originalText.textContent = savedText;
        }
    }

    function clearFile() {
        const fileInput = el('gen-file-input');
        const fileInfo = el('gen-file-info');
        const textarea = el('gen-textarea');

        fileInput.value = '';
        fileInfo.classList.add('hidden');
        textarea.value = '';
        textarea.disabled = false;
        extractedText = '';

        updateTextStats();
        updateSubmitButton();
    }

    // =============================================
    // TEXT STATS & VALIDATION
    // =============================================

    function updateTextStats() {
        const statsEl = el('gen-text-stats');
        const countEl = el('gen-char-count');

        if (!extractedText || extractedText.length === 0) {
            statsEl.classList.add('hidden');
            return;
        }

        const chars = extractedText.length;
        const pages = Math.ceil(chars / 3000);
        const isEnough = chars >= 100;

        countEl.innerHTML = isEnough
            ? `Извлечено: ${chars.toLocaleString('ru')} символов (~${pages} стр.) &#10003;`
            : `Извлечено: ${chars.toLocaleString('ru')} символов (минимум 100)`;

        statsEl.classList.remove('hidden');
        statsEl.className = 'gen-text-stats' + (isEnough ? ' gen-text-ok' : ' gen-text-short');
    }

    function updateSubmitButton() {
        const btn = el('gen-submit-btn');
        const hasText = extractedText && extractedText.length >= 100;
        const hasTypes = getSelectedTypes().length > 0;
        btn.disabled = !hasText || !hasTypes || isGenerating;
    }

    function getSelectedTypes() {
        const checkboxes = document.querySelectorAll('.gen-type-option input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    // =============================================
    // GENERATE CONTENT
    // =============================================

    async function generateContent() {
        if (isGenerating) return;

        const types = getSelectedTypes();
        if (types.length === 0) {
            showToast('Выберите хотя бы один тип контента', true);
            return;
        }
        if (!extractedText || extractedText.length < 100) {
            showToast('Текст слишком короткий (минимум 100 символов)', true);
            return;
        }

        isGenerating = true;
        updateSubmitButton();
        showProgress(true);
        hideResults();

        try {
            const session = await supabaseClient.auth.getSession();
            const token = session.data.session?.access_token;
            if (!token) {
                throw new Error('Сессия истекла. Перезайдите в кабинет.');
            }

            const competencyId = el('gen-competency').value || null;
            const difficulty = parseInt(el('gen-difficulty').value, 10);
            const count = parseInt(el('gen-count').value, 10) || 5;
            const additionalInstructions = el('gen-instructions').value.trim() || null;

            const response = await fetch(
                `${SUPABASE_URL}/functions/v1/generate-content`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        text: extractedText,
                        types: types,
                        params: {
                            competency_id: competencyId,
                            difficulty: difficulty,
                            count: count,
                        },
                        additional_instructions: additionalInstructions,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Ошибка генерации');
            }

            showResults(data);
        } catch (err) {
            showToast('Ошибка: ' + err.message, true);
        } finally {
            isGenerating = false;
            updateSubmitButton();
            showProgress(false);
        }
    }

    // =============================================
    // PROGRESS & RESULTS
    // =============================================

    function showProgress(visible) {
        const progressEl = el('gen-progress');
        if (visible) {
            progressEl.classList.remove('hidden');
        } else {
            progressEl.classList.add('hidden');
        }
    }

    function hideResults() {
        el('gen-results').classList.add('hidden');
    }

    function showResults(data) {
        const resultsEl = el('gen-results');
        const metaEl = el('gen-results-meta');
        const listEl = el('gen-results-list');

        const items = data.items || [];

        // Meta info
        if (data.message) {
            metaEl.innerHTML = `<div class="gen-results-notice">${escapeHtml(data.message)}</div>`;
        } else {
            metaEl.innerHTML = '';
        }

        // Render items
        if (items.length === 0) {
            listEl.innerHTML = '<p class="empty-text">Нет результатов</p>';
        } else {
            listEl.innerHTML = items.map(item => renderResultItem(item)).join('');
        }

        resultsEl.classList.remove('hidden');
    }

    function renderResultItem(item) {
        const typeLabels = {
            question: 'Вопрос',
            drug: 'Препарат',
            flashcard: 'Flash-карточка',
            scenario: 'Сценарий',
        };

        const typeIcons = {
            question: '&#9997;',
            drug: '&#9883;',
            flashcard: '&#128196;',
            scenario: '&#127919;',
        };

        const label = typeLabels[item.type] || item.type;
        const icon = typeIcons[item.type] || '&#9632;';
        const summary = getItemSummary(item);

        return `
            <div class="gen-result-item" data-type="${item.type}">
                <div class="gen-result-header">
                    <span class="gen-result-icon">${icon}</span>
                    <span class="gen-result-type">${label}</span>
                    <span class="gen-result-status status-badge">draft</span>
                </div>
                <div class="gen-result-body">${escapeHtml(summary)}</div>
            </div>
        `;
    }

    function getItemSummary(item) {
        const c = item.content;
        if (!c) return '(пусто)';

        switch (item.type) {
            case 'question':
                return c.text || '(без текста)';
            case 'drug':
                return `${c.name_ru || ''} — ${c.drug_group || ''}`;
            case 'flashcard':
                return `[${c.item_type || ''}] ${c.name_ru || ''}`;
            case 'scenario':
                return c.situation ? c.situation.substring(0, 150) + '...' : '(без описания)';
            default:
                return JSON.stringify(c).substring(0, 100);
        }
    }

    // =============================================
    // HELPERS
    // =============================================

    function showToast(message, isError) {
        const toast = el('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast visible' + (isError ? ' toast-error' : '');
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
