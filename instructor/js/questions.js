// Questions CRUD module
// List, create, edit, delete questions via Supabase

const Questions = (() => {
    let allQuestions = [];
    let editingId = null;
    let currentImageUrl = null;
    let currentImagePath = null;

    const MIN_OPTIONS = 2;
    const MAX_OPTIONS = 6;

    // --- DOM cache (resolved lazily) ---
    function el(id) { return document.getElementById(id); }

    // =============================================
    // LOAD & RENDER LIST
    // =============================================

    async function loadQuestions() {
        const container = el('questions-list');
        container.innerHTML = '<p class="loading-text">Загрузка...</p>';

        const { data, error } = await supabaseClient
            .from('questions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error-text">Ошибка загрузки вопросов.</p>';
            return;
        }

        allQuestions = data || [];
        updateCount();
        renderList();
    }

    function renderList() {
        const search = (el('q-search').value || '').toLowerCase();
        const blockFilter = el('q-filter-block').value;

        const filtered = allQuestions.filter((q) => {
            if (search && !q.text.toLowerCase().includes(search)) return false;
            if (blockFilter && q.competency_block !== blockFilter) return false;
            return true;
        });

        const container = el('questions-list');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет вопросов по заданным фильтрам.</p>';
            return;
        }

        container.innerHTML = filtered.map((q) => {
            const opts = q.options || [];
            const correctCount = opts.filter((o) => o.is_correct).length;
            const comp = getCompetencyLabel(q.competency_id);
            const blockName = getBlockLabel(q.competency_block);

            return `
                <div class="q-card" data-id="${q.id}">
                    <div class="q-card-body">
                        <div class="q-card-text">${escapeHtml(q.text)}</div>
                        <div class="q-card-meta">
                            <span>${comp}</span>
                            <span>${blockName}</span>
                            <span>Ответов: ${opts.length}</span>
                            <span>Правильных: ${correctCount}</span>
                        </div>
                    </div>
                    <div class="q-card-actions">
                        <button class="btn-icon" title="Редактировать" data-action="edit" data-id="${q.id}">&#9997;</button>
                        <button class="btn-icon btn-icon-danger" title="Удалить" data-action="delete" data-id="${q.id}">&#128465;</button>
                    </div>
                </div>`;
        }).join('');
    }

    function updateCount() {
        el('q-count').textContent = allQuestions.length;
        const statEl = document.getElementById('stat-questions');
        if (statEl) statEl.textContent = allQuestions.length;
    }

    // =============================================
    // FORM — OPEN / POPULATE / CLOSE
    // =============================================

    function openForm(questionId) {
        editingId = questionId || null;
        resetForm();

        if (editingId) {
            const q = allQuestions.find((x) => x.id === editingId);
            if (!q) return;
            populateForm(q);
            el('modal-title').textContent = 'Редактировать вопрос';
            el('btn-save-question').textContent = 'Сохранить изменения';
        } else {
            el('modal-title').textContent = 'Новый вопрос';
            el('btn-save-question').textContent = 'Создать вопрос';
            addOptionRow('', false);
            addOptionRow('', false);
        }

        el('question-modal').classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeForm() {
        el('question-modal').classList.remove('visible');
        document.body.style.overflow = '';
        editingId = null;
        currentImageUrl = null;
        currentImagePath = null;
    }

    function resetForm() {
        el('qf-text').value = '';
        el('qf-competency').value = '';
        el('qf-difficulty').value = '1';
        el('qf-explanation').value = '';
        el('qf-options-list').innerHTML = '';
        el('qf-image-preview').classList.add('hidden');
        el('qf-image-preview').innerHTML = '';
        el('qf-image-input').value = '';
        el('form-error').classList.remove('visible');
        currentImageUrl = null;
        currentImagePath = null;
    }

    function populateForm(q) {
        el('qf-text').value = q.text || '';
        el('qf-competency').value = q.competency_id || '';
        el('qf-difficulty').value = String(q.difficulty || 1);
        el('qf-explanation').value = q.explanation || '';

        (q.options || []).forEach((opt) => {
            addOptionRow(opt.text, opt.is_correct);
        });

        if (q.image_url) {
            currentImageUrl = q.image_url;
            currentImagePath = ImageUpload.pathFromUrl(q.image_url);
            showImagePreview(q.image_url);
        }
    }

    // =============================================
    // DYNAMIC OPTIONS
    // =============================================

    function addOptionRow(text, isCorrect) {
        const list = el('qf-options-list');
        if (list.children.length >= MAX_OPTIONS) return;

        const row = document.createElement('div');
        row.className = 'option-row';
        row.innerHTML = `
            <label class="option-checkbox">
                <input type="checkbox" ${isCorrect ? 'checked' : ''}>
            </label>
            <input type="text" class="option-text" value="${escapeAttr(text)}" placeholder="Текст варианта...">
            <button type="button" class="btn-icon btn-icon-danger option-remove" title="Удалить вариант">&#10005;</button>
        `;

        row.querySelector('.option-remove').addEventListener('click', () => {
            if (list.children.length <= MIN_OPTIONS) {
                showFormError('Минимум ' + MIN_OPTIONS + ' варианта ответа.');
                return;
            }
            row.remove();
        });

        list.appendChild(row);
        updateAddOptionBtn();
    }

    function updateAddOptionBtn() {
        const list = el('qf-options-list');
        const btn = el('btn-add-option');
        btn.disabled = list.children.length >= MAX_OPTIONS;
    }

    function collectOptions() {
        const rows = el('qf-options-list').querySelectorAll('.option-row');
        return Array.from(rows).map((row) => ({
            text: row.querySelector('.option-text').value.trim(),
            is_correct: row.querySelector('input[type="checkbox"]').checked,
        }));
    }

    // =============================================
    // IMAGE HANDLING
    // =============================================

    async function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Preview immediately from local file
        const reader = new FileReader();
        reader.onload = (ev) => showImagePreview(ev.target.result);
        reader.readAsDataURL(file);
    }

    function showImagePreview(src) {
        const preview = el('qf-image-preview');
        preview.innerHTML = `
            <img src="${src}" alt="Preview">
            <button type="button" class="btn-remove-image" title="Удалить изображение">&#10005;</button>
        `;
        preview.classList.remove('hidden');
        preview.querySelector('.btn-remove-image').addEventListener('click', removeImage);
    }

    function removeImage() {
        currentImageUrl = null;
        currentImagePath = null;
        el('qf-image-input').value = '';
        el('qf-image-preview').classList.add('hidden');
        el('qf-image-preview').innerHTML = '';
    }

    // =============================================
    // SAVE (CREATE / UPDATE)
    // =============================================

    async function saveQuestion() {
        hideFormError();

        // Gather values
        const text = el('qf-text').value.trim();
        const competencyId = el('qf-competency').value;
        const difficulty = parseInt(el('qf-difficulty').value, 10);
        const explanation = el('qf-explanation').value.trim();
        const options = collectOptions();

        // --- Validation ---
        if (!text) { showFormError('Введите текст вопроса.'); return; }
        if (!competencyId) { showFormError('Выберите компетенцию.'); return; }
        if (options.length < MIN_OPTIONS) { showFormError('Минимум ' + MIN_OPTIONS + ' варианта ответа.'); return; }
        if (options.some((o) => !o.text)) { showFormError('Заполните все варианты ответов.'); return; }
        if (!options.some((o) => o.is_correct)) { showFormError('Отметьте хотя бы один правильный ответ.'); return; }

        const competencyBlock = getCompetencyBlock(competencyId);
        if (!competencyBlock) { showFormError('Некорректная компетенция.'); return; }

        setFormLoading(true);

        try {
            // Upload new image if file selected
            const fileInput = el('qf-image-input');
            let imageUrl = currentImageUrl;

            if (fileInput.files[0]) {
                // Delete old image if replacing
                if (currentImagePath) {
                    try { await ImageUpload.remove(currentImagePath); } catch (_) { /* ignore */ }
                }
                const result = await ImageUpload.upload(fileInput.files[0], 'questions');
                imageUrl = result.url;
            }

            const row = {
                text,
                options,
                explanation: explanation || null,
                image_url: imageUrl || null,
                competency_id: competencyId,
                competency_block: competencyBlock,
                difficulty,
                updated_at: new Date().toISOString(),
            };

            let error;

            if (editingId) {
                ({ error } = await supabaseClient
                    .from('questions')
                    .update(row)
                    .eq('id', editingId));
            } else {
                const { data: { user } } = await supabaseClient.auth.getUser();
                row.created_by = user.id;
                ({ error } = await supabaseClient
                    .from('questions')
                    .insert(row));
            }

            if (error) throw error;

            closeForm();
            showToast(editingId ? 'Вопрос обновлён' : 'Вопрос создан');
            await loadQuestions();

        } catch (err) {
            showFormError('Ошибка сохранения: ' + err.message);
        } finally {
            setFormLoading(false);
        }
    }

    // =============================================
    // DELETE
    // =============================================

    function confirmDelete(questionId) {
        const q = allQuestions.find((x) => x.id === questionId);
        if (!q) return;

        const preview = q.text.length > 80 ? q.text.substring(0, 80) + '...' : q.text;
        el('confirm-text').textContent = preview;
        el('confirm-modal').classList.add('visible');
        el('confirm-modal').dataset.targetId = questionId;
        document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
        el('confirm-modal').classList.remove('visible');
        el('confirm-modal').dataset.targetId = '';
        document.body.style.overflow = '';
    }

    async function executeDelete() {
        const questionId = el('confirm-modal').dataset.targetId;
        if (!questionId) return;

        const q = allQuestions.find((x) => x.id === questionId);

        // Delete image from storage if exists
        if (q && q.image_url) {
            const path = ImageUpload.pathFromUrl(q.image_url);
            if (path) {
                try { await ImageUpload.remove(path); } catch (_) { /* ignore */ }
            }
        }

        const { error } = await supabaseClient
            .from('questions')
            .delete()
            .eq('id', questionId);

        closeConfirm();

        if (error) {
            showToast('Ошибка удаления: ' + error.message, true);
            return;
        }

        showToast('Вопрос удалён');
        await loadQuestions();
    }

    // =============================================
    // COMPETENCY HELPERS
    // =============================================

    function buildCompetencySelect() {
        const select = el('qf-competency');
        select.innerHTML = '<option value="">— Выберите компетенцию —</option>';

        if (typeof COMPETENCY_BLOCKS === 'undefined') return;

        for (const [blockId, block] of Object.entries(COMPETENCY_BLOCKS)) {
            const group = document.createElement('optgroup');
            group.label = block.name;

            block.competencies.forEach((compId) => {
                const c = COMPETENCIES_CONFIG[compId];
                if (!c) return;
                const opt = document.createElement('option');
                opt.value = compId;
                opt.textContent = c.name;
                group.appendChild(opt);
            });

            select.appendChild(group);
        }

        select.value = '';
    }

    function buildBlockFilter() {
        const select = el('q-filter-block');
        select.innerHTML = '<option value="">Все блоки</option>';

        if (typeof COMPETENCY_BLOCKS === 'undefined') return;

        for (const [blockId, block] of Object.entries(COMPETENCY_BLOCKS)) {
            const opt = document.createElement('option');
            opt.value = blockId;
            opt.textContent = block.name;
            select.appendChild(opt);
        }

        select.value = '';
    }

    function getCompetencyLabel(id) {
        if (typeof COMPETENCIES_CONFIG !== 'undefined' && COMPETENCIES_CONFIG[id]) {
            return COMPETENCIES_CONFIG[id].shortName || COMPETENCIES_CONFIG[id].name;
        }
        return id || '—';
    }

    function getBlockLabel(blockId) {
        if (typeof COMPETENCY_BLOCKS !== 'undefined' && COMPETENCY_BLOCKS[blockId]) {
            return COMPETENCY_BLOCKS[blockId].name;
        }
        return blockId || '—';
    }

    function getCompetencyBlock(compId) {
        if (typeof COMPETENCIES_CONFIG !== 'undefined' && COMPETENCIES_CONFIG[compId]) {
            return COMPETENCIES_CONFIG[compId].block;
        }
        return null;
    }

    // =============================================
    // UI HELPERS
    // =============================================

    function showFormError(msg) {
        const errEl = el('form-error');
        errEl.textContent = msg;
        errEl.classList.add('visible');
    }

    function hideFormError() {
        const errEl = el('form-error');
        errEl.textContent = '';
        errEl.classList.remove('visible');
    }

    function setFormLoading(on) {
        const btn = el('btn-save-question');
        btn.disabled = on;
        btn.textContent = on ? 'Сохранение...' : (editingId ? 'Сохранить изменения' : 'Создать вопрос');
    }

    function showToast(msg, isError) {
        const toast = el('toast');
        toast.textContent = msg;
        toast.className = 'toast visible' + (isError ? ' toast-error' : '');
        setTimeout(() => { toast.classList.remove('visible'); }, 3000);
    }

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // =============================================
    // EVENT DELEGATION
    // =============================================

    function bindEvents() {
        // List actions (edit / delete)
        el('questions-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'edit') openForm(id);
            if (action === 'delete') confirmDelete(id);
        });

        // Search & filter
        el('q-search').addEventListener('input', renderList);
        el('q-filter-block').addEventListener('change', renderList);

        // Add question button
        el('btn-add-question').addEventListener('click', () => openForm(null));

        // Modal: close
        el('btn-close-modal').addEventListener('click', closeForm);
        el('question-modal-overlay').addEventListener('click', closeForm);

        // Modal: save
        el('btn-save-question').addEventListener('click', saveQuestion);

        // Modal: add option
        el('btn-add-option').addEventListener('click', () => {
            addOptionRow('', false);
            updateAddOptionBtn();
        });

        // Modal: image input
        el('qf-image-input').addEventListener('change', handleImageSelect);

        // Confirm modal
        el('btn-confirm-yes').addEventListener('click', executeDelete);
        el('btn-confirm-no').addEventListener('click', closeConfirm);
        el('confirm-modal-overlay').addEventListener('click', closeConfirm);
    }

    // =============================================
    // INIT
    // =============================================

    function init() {
        buildCompetencySelect();
        buildBlockFilter();
        bindEvents();
        loadQuestions();
    }

    return { init, refresh: loadQuestions };
})();
