// Review Cards module
// Renders generated content as review cards with approve/reject/edit actions

const ReviewCards = (() => {
    function el(id) { return document.getElementById(id); }

    const TYPE_META = {
        question:  { label: 'Тестовый вопрос', icon: '&#9997;',   color: '#2563eb' },
        drug:      { label: 'Препарат',        icon: '&#9883;',   color: '#16a34a' },
        flashcard: { label: 'Flash-карточка',   icon: '&#128196;', color: '#ca8a04' },
        scenario:  { label: 'Сценарий',         icon: '&#127919;', color: '#dc2626' },
    };

    // =============================================
    // RENDER
    // =============================================

    /**
     * Render review cards grouped by type
     * @param {Array} items — from generated_content
     * @param {HTMLElement} container
     */
    function render(items, container) {
        if (!items || items.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет результатов</p>';
            return;
        }

        // Group by type
        const groups = {};
        for (const item of items) {
            if (!groups[item.type]) groups[item.type] = [];
            groups[item.type].push(item);
        }

        // Bulk actions
        let html = `<div class="rc-bulk-actions">
            <button type="button" class="btn-primary btn-sm rc-approve-all">Утвердить все</button>
            <button type="button" class="btn-sm rc-reject-all">Отклонить все</button>
            <span class="rc-bulk-stats" id="rc-stats"></span>
        </div>`;

        // Render groups
        const typeOrder = ['question', 'scenario', 'drug', 'flashcard'];
        for (const type of typeOrder) {
            if (!groups[type]) continue;
            const meta = TYPE_META[type] || { label: type, icon: '', color: '#64748b' };
            html += `<div class="rc-group">
                <h4 class="rc-group-title">
                    <span class="rc-group-icon">${meta.icon}</span>
                    ${meta.label} (${groups[type].length})
                </h4>`;
            for (const item of groups[type]) {
                html += renderCard(item);
            }
            html += `</div>`;
        }

        container.innerHTML = html;
        bindCardEvents(container);
        updateStats(container);
    }

    function renderCard(item) {
        const meta = TYPE_META[item.type] || {};
        const c = item.content || {};
        const statusClass = item.status === 'approved' ? 'rc-status-approved'
            : item.status === 'rejected' ? 'rc-status-rejected'
            : 'rc-status-draft';

        let bodyHtml = '';
        switch (item.type) {
            case 'question': bodyHtml = renderQuestionBody(c); break;
            case 'drug': bodyHtml = renderDrugBody(c); break;
            case 'flashcard': bodyHtml = renderFlashcardBody(c); break;
            case 'scenario': bodyHtml = renderScenarioBody(c); break;
            default: bodyHtml = `<pre>${escapeHtml(JSON.stringify(c, null, 2))}</pre>`;
        }

        const isFinalized = item.status === 'approved' || item.status === 'rejected';

        return `
        <div class="rc-card ${statusClass}" data-item-id="${item.id}" data-item-type="${item.type}" data-status="${item.status}">
            <div class="rc-card-header">
                <span class="rc-card-type" style="color:${meta.color}">${meta.icon} ${meta.label}</span>
                <span class="rc-card-status">${item.status}</span>
            </div>
            <div class="rc-card-body">${bodyHtml}</div>
            ${!isFinalized ? `
            <div class="rc-card-actions">
                <button type="button" class="btn-sm rc-btn-edit" data-id="${item.id}">&#9997; Редактировать</button>
                <button type="button" class="btn-primary btn-sm rc-btn-approve" data-id="${item.id}">&#10003; Утвердить</button>
                <button type="button" class="btn-sm rc-btn-reject" data-id="${item.id}">&#10007; Отклонить</button>
            </div>` : ''}
        </div>`;
    }

    // ── Type-specific body renderers ──

    function renderQuestionBody(c) {
        let optionsHtml = (c.options || []).map(o =>
            `<div class="rc-option ${o.is_correct ? 'rc-option-correct' : ''}">
                <span class="rc-option-marker">${o.is_correct ? '&#10003;' : '&#9675;'}</span>
                ${escapeHtml(o.text)}
            </div>`
        ).join('');

        return `
            <div class="rc-question-text">${escapeHtml(c.text || '')}</div>
            <div class="rc-options">${optionsHtml}</div>
            ${c.explanation ? `<div class="rc-explanation"><strong>Пояснение:</strong> ${escapeHtml(c.explanation)}</div>` : ''}
            <div class="rc-meta-row">
                ${c.difficulty ? `<span>Сложность: ${c.difficulty}</span>` : ''}
                ${c.category ? `<span>Категория: ${escapeHtml(c.category)}</span>` : ''}
                ${c.module ? `<span>Модуль: ${escapeHtml(c.module)}</span>` : ''}
            </div>`;
    }

    function renderDrugBody(c) {
        return `
            <div class="rc-drug-title">${escapeHtml(c.name_ru || '')} ${c.name_lat ? `<span class="rc-drug-lat">(${escapeHtml(c.name_lat)})</span>` : ''}</div>
            ${field('Группа', c.drug_group)}
            ${field('Форма', c.form)}
            ${field('Дозировка', c.dosage)}
            ${field('Показания', c.indications)}
            ${field('Противопоказания', c.contraindications)}
            ${field('Побочные эффекты', c.side_effects)}
            ${c.field_notes ? `<div class="rc-field-notes"><strong>Полевые особенности:</strong> ${escapeHtml(c.field_notes)}</div>` : ''}`;
    }

    function renderFlashcardBody(c) {
        const itemType = c.item_type || 'drug';
        const typeLabel = { drug: 'Препарат', device: 'Прибор', instrument: 'Инструмент', equipment: 'Оборудование' }[itemType] || itemType;

        return `
            <div class="rc-flash-type">${escapeHtml(typeLabel)}</div>
            <div class="rc-drug-title">${escapeHtml(c.name_ru || '')} ${c.name_lat ? `<span class="rc-drug-lat">(${escapeHtml(c.name_lat)})</span>` : ''}</div>
            ${field('Группа', c.drug_group)}
            ${field(itemType === 'drug' ? 'Форма' : 'Конструкция', c.form)}
            ${field(itemType === 'drug' ? 'Дозировка' : 'Применение', c.dosage)}
            ${field('Показания', c.indications)}
            ${field(itemType === 'drug' ? 'Противопоказания' : 'Ограничения', c.contraindications)}
            ${field(itemType === 'drug' ? 'Побочные эффекты' : 'Риски', c.side_effects)}
            ${c.field_notes ? `<div class="rc-field-notes"><strong>Полевые особенности:</strong> ${escapeHtml(c.field_notes)}</div>` : ''}`;
    }

    function renderScenarioBody(c) {
        let optionsHtml = (c.options || []).map(o =>
            `<div class="rc-option ${o.is_correct ? 'rc-option-correct' : ''}">
                <span class="rc-option-marker">${o.is_correct ? '&#10003;' : '&#9675;'}</span>
                ${escapeHtml(o.text)}
            </div>`
        ).join('');

        return `
            <div class="rc-scenario-situation">${escapeHtml(c.situation || '')}</div>
            <div class="rc-scenario-question"><strong>Вопрос:</strong> ${escapeHtml(c.question || '')}</div>
            <div class="rc-options">${optionsHtml}</div>
            ${c.rationale ? `<div class="rc-explanation"><strong>Обоснование:</strong> ${escapeHtml(c.rationale)}</div>` : ''}`;
    }

    function field(label, value) {
        if (!value) return '';
        return `<div class="rc-field"><span class="rc-field-label">${escapeHtml(label)}:</span> ${escapeHtml(value)}</div>`;
    }

    // =============================================
    // EDIT MODE
    // =============================================

    function openEdit(card) {
        const itemId = card.dataset.itemId;
        const itemType = card.dataset.itemType;
        const body = card.querySelector('.rc-card-body');
        const actions = card.querySelector('.rc-card-actions');

        // Find current content from DOM data
        // We store item data as JSON on the card
        let content;
        try {
            content = JSON.parse(card.dataset.content);
        } catch (_) {
            showToast('Ошибка: данные карточки недоступны', true);
            return;
        }

        card.classList.add('rc-editing');

        let editHtml = '';
        switch (itemType) {
            case 'question': editHtml = editQuestionForm(content); break;
            case 'drug': editHtml = editDrugForm(content); break;
            case 'flashcard': editHtml = editFlashcardForm(content); break;
            case 'scenario': editHtml = editScenarioForm(content); break;
        }

        body.innerHTML = editHtml;
        actions.innerHTML = `
            <button type="button" class="btn-primary btn-sm rc-btn-save" data-id="${itemId}">Сохранить</button>
            <button type="button" class="btn-sm rc-btn-cancel" data-id="${itemId}">Отмена</button>
        `;
    }

    function editQuestionForm(c) {
        let optionsHtml = (c.options || []).map((o, i) =>
            `<div class="rc-edit-option">
                <label><input type="checkbox" data-opt-idx="${i}" ${o.is_correct ? 'checked' : ''}></label>
                <input type="text" class="rc-edit-input" data-opt-idx="${i}" value="${escapeAttr(o.text)}">
            </div>`
        ).join('');

        return `
            <div class="form-group"><label>Текст вопроса</label>
                <textarea class="rc-edit-input" data-field="text" rows="3">${escapeHtml(c.text || '')}</textarea></div>
            <div class="form-group"><label>Варианты ответов</label>${optionsHtml}</div>
            <div class="form-group"><label>Пояснение</label>
                <textarea class="rc-edit-input" data-field="explanation" rows="2">${escapeHtml(c.explanation || '')}</textarea></div>
            <div class="form-row">
                <div class="form-group"><label>Сложность</label>
                    <select class="rc-edit-input filter-select" data-field="difficulty">
                        <option value="1" ${c.difficulty == 1 ? 'selected' : ''}>1</option>
                        <option value="2" ${c.difficulty == 2 ? 'selected' : ''}>2</option>
                        <option value="3" ${c.difficulty == 3 ? 'selected' : ''}>3</option>
                    </select></div>
                <div class="form-group"><label>Категория</label>
                    <input type="text" class="rc-edit-input" data-field="category" value="${escapeAttr(c.category || '')}"></div>
            </div>`;
    }

    function editDrugForm(c) {
        return drugFieldsForm(c, false);
    }

    function editFlashcardForm(c) {
        return `
            <div class="form-group"><label>Тип</label>
                <select class="rc-edit-input filter-select" data-field="item_type">
                    <option value="drug" ${c.item_type === 'drug' ? 'selected' : ''}>Препарат</option>
                    <option value="device" ${c.item_type === 'device' ? 'selected' : ''}>Прибор</option>
                    <option value="instrument" ${c.item_type === 'instrument' ? 'selected' : ''}>Инструмент</option>
                    <option value="equipment" ${c.item_type === 'equipment' ? 'selected' : ''}>Оборудование</option>
                </select></div>
            ${drugFieldsForm(c, true)}`;
    }

    function drugFieldsForm(c, isFlashcard) {
        return `
            <div class="form-row">
                <div class="form-group"><label>Название (рус.)</label>
                    <input type="text" class="rc-edit-input" data-field="name_ru" value="${escapeAttr(c.name_ru || '')}"></div>
                <div class="form-group"><label>Название (лат.)</label>
                    <input type="text" class="rc-edit-input" data-field="name_lat" value="${escapeAttr(c.name_lat || '')}"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Группа</label>
                    <input type="text" class="rc-edit-input" data-field="drug_group" value="${escapeAttr(c.drug_group || '')}"></div>
                <div class="form-group"><label>Форма</label>
                    <input type="text" class="rc-edit-input" data-field="form" value="${escapeAttr(c.form || '')}"></div>
            </div>
            <div class="form-group"><label>Дозировка</label>
                <input type="text" class="rc-edit-input" data-field="dosage" value="${escapeAttr(c.dosage || '')}"></div>
            <div class="form-group"><label>Показания</label>
                <textarea class="rc-edit-input" data-field="indications" rows="2">${escapeHtml(c.indications || '')}</textarea></div>
            <div class="form-group"><label>Противопоказания</label>
                <textarea class="rc-edit-input" data-field="contraindications" rows="2">${escapeHtml(c.contraindications || '')}</textarea></div>
            <div class="form-group"><label>Побочные эффекты</label>
                <textarea class="rc-edit-input" data-field="side_effects" rows="2">${escapeHtml(c.side_effects || '')}</textarea></div>
            <div class="form-group"><label>Полевые особенности</label>
                <textarea class="rc-edit-input" data-field="field_notes" rows="2">${escapeHtml(c.field_notes || '')}</textarea></div>`;
    }

    function editScenarioForm(c) {
        let optionsHtml = (c.options || []).map((o, i) =>
            `<div class="rc-edit-option">
                <label><input type="checkbox" data-opt-idx="${i}" ${o.is_correct ? 'checked' : ''}></label>
                <input type="text" class="rc-edit-input" data-opt-idx="${i}" value="${escapeAttr(o.text)}">
            </div>`
        ).join('');

        return `
            <div class="form-group"><label>Ситуация</label>
                <textarea class="rc-edit-input" data-field="situation" rows="4">${escapeHtml(c.situation || '')}</textarea></div>
            <div class="form-group"><label>Вопрос</label>
                <textarea class="rc-edit-input" data-field="question" rows="2">${escapeHtml(c.question || '')}</textarea></div>
            <div class="form-group"><label>Варианты действий</label>${optionsHtml}</div>
            <div class="form-group"><label>Обоснование</label>
                <textarea class="rc-edit-input" data-field="rationale" rows="3">${escapeHtml(c.rationale || '')}</textarea></div>`;
    }

    function collectEditedContent(card) {
        const itemType = card.dataset.itemType;
        const body = card.querySelector('.rc-card-body');
        const content = {};

        // Collect all simple fields
        body.querySelectorAll('[data-field]').forEach(input => {
            const field = input.dataset.field;
            const tag = input.tagName.toLowerCase();
            if (tag === 'select') {
                content[field] = input.value;
            } else if (tag === 'textarea') {
                content[field] = input.value.trim();
            } else {
                content[field] = input.value.trim();
            }
        });

        // Difficulty as number
        if (content.difficulty) content.difficulty = parseInt(content.difficulty, 10);

        // Collect options (for question/scenario)
        if (itemType === 'question' || itemType === 'scenario') {
            const optInputs = body.querySelectorAll('[data-opt-idx]');
            const optionsMap = {};
            optInputs.forEach(inp => {
                const idx = inp.dataset.optIdx;
                if (!optionsMap[idx]) optionsMap[idx] = {};
                if (inp.type === 'checkbox') {
                    optionsMap[idx].is_correct = inp.checked;
                } else {
                    optionsMap[idx].text = inp.value.trim();
                }
            });
            content.options = Object.values(optionsMap).filter(o => o.text);
        }

        return content;
    }

    // =============================================
    // APPROVE / REJECT / SAVE
    // =============================================

    async function approve(card) {
        const itemId = card.dataset.itemId;
        const itemType = card.dataset.itemType;
        let content;
        try {
            content = JSON.parse(card.dataset.content);
        } catch (_) {
            showToast('Ошибка: данные карточки недоступны', true);
            return;
        }

        card.classList.add('rc-loading');

        try {
            const { data: { user } } = await supabaseClient.auth.getUser();
            let targetId = null;

            if (itemType === 'question') {
                const competencyId = content.competency_id || null;
                const competencyBlock = getCompetencyBlock(competencyId);
                const { data, error } = await supabaseClient
                    .from('questions')
                    .insert({
                        text: content.text,
                        options: content.options,
                        explanation: content.explanation || null,
                        competency_id: competencyId,
                        competency_block: competencyBlock || 'basics',
                        difficulty: content.difficulty || 2,
                        category: content.category || null,
                        module: content.module || null,
                        created_by: user.id,
                    })
                    .select()
                    .single();
                if (error) throw error;
                targetId = data.id;

            } else if (itemType === 'drug') {
                const { data, error } = await supabaseClient
                    .from('drugs')
                    .insert({
                        name_ru: content.name_ru,
                        name_lat: content.name_lat || null,
                        drug_group: content.drug_group || null,
                        form: content.form || null,
                        dosage: content.dosage || null,
                        indications: content.indications || null,
                        contraindications: content.contraindications || null,
                        side_effects: content.side_effects || null,
                        field_notes: content.field_notes || null,
                        created_by: user.id,
                    })
                    .select()
                    .single();
                if (error) throw error;
                targetId = data.id;

            } else if (itemType === 'flashcard') {
                const { data, error } = await supabaseClient
                    .from('drugs')
                    .insert({
                        name_ru: content.name_ru,
                        name_lat: content.name_lat || null,
                        drug_group: content.drug_group || null,
                        form: content.form || null,
                        dosage: content.dosage || null,
                        indications: content.indications || null,
                        contraindications: content.contraindications || null,
                        side_effects: content.side_effects || null,
                        field_notes: content.field_notes || null,
                        item_type: content.item_type || 'drug',
                        created_by: user.id,
                    })
                    .select()
                    .single();
                if (error) throw error;
                targetId = data.id;

            } else if (itemType === 'scenario') {
                const competencyId = content.competency_id || null;
                const competencyBlock = getCompetencyBlock(competencyId);
                const { data, error } = await supabaseClient
                    .from('questions')
                    .insert({
                        text: content.situation,
                        options: content.options,
                        explanation: content.rationale || null,
                        competency_id: competencyId,
                        competency_block: competencyBlock || 'basics',
                        difficulty: content.difficulty || 2,
                        category: 'scenario',
                        created_by: user.id,
                    })
                    .select()
                    .single();
                if (error) throw error;
                targetId = data.id;
            }

            // Update generated_content status
            await supabaseClient
                .from('generated_content')
                .update({
                    status: 'approved',
                    approved_target_id: targetId,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);

            // Update card UI
            card.dataset.status = 'approved';
            card.className = card.className.replace(/rc-status-\w+/, 'rc-status-approved');
            card.querySelector('.rc-card-status').textContent = 'approved';
            const actionsEl = card.querySelector('.rc-card-actions');
            if (actionsEl) actionsEl.remove();

            showToast('Утверждено');
            updateStats(card.closest('#gen-results-list'));
        } catch (err) {
            showToast('Ошибка утверждения: ' + err.message, true);
        } finally {
            card.classList.remove('rc-loading');
        }
    }

    async function reject(card) {
        const itemId = card.dataset.itemId;
        card.classList.add('rc-loading');

        try {
            const { error } = await supabaseClient
                .from('generated_content')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);

            if (error) throw error;

            card.dataset.status = 'rejected';
            card.className = card.className.replace(/rc-status-\w+/, 'rc-status-rejected');
            card.querySelector('.rc-card-status').textContent = 'rejected';
            const actionsEl = card.querySelector('.rc-card-actions');
            if (actionsEl) actionsEl.remove();

            showToast('Отклонено');
            updateStats(card.closest('#gen-results-list'));
        } catch (err) {
            showToast('Ошибка: ' + err.message, true);
        } finally {
            card.classList.remove('rc-loading');
        }
    }

    async function saveEdit(card) {
        const itemId = card.dataset.itemId;
        const updatedContent = collectEditedContent(card);

        card.classList.add('rc-loading');

        try {
            const { error } = await supabaseClient
                .from('generated_content')
                .update({
                    content: updatedContent,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', itemId);

            if (error) throw error;

            // Update stored content
            card.dataset.content = JSON.stringify(updatedContent);
            card.classList.remove('rc-editing');

            // Re-render card body
            const body = card.querySelector('.rc-card-body');
            switch (card.dataset.itemType) {
                case 'question': body.innerHTML = renderQuestionBody(updatedContent); break;
                case 'drug': body.innerHTML = renderDrugBody(updatedContent); break;
                case 'flashcard': body.innerHTML = renderFlashcardBody(updatedContent); break;
                case 'scenario': body.innerHTML = renderScenarioBody(updatedContent); break;
            }

            // Restore action buttons
            const actions = card.querySelector('.rc-card-actions');
            actions.innerHTML = `
                <button type="button" class="btn-sm rc-btn-edit" data-id="${itemId}">&#9997; Редактировать</button>
                <button type="button" class="btn-primary btn-sm rc-btn-approve" data-id="${itemId}">&#10003; Утвердить</button>
                <button type="button" class="btn-sm rc-btn-reject" data-id="${itemId}">&#10007; Отклонить</button>
            `;

            showToast('Сохранено');
        } catch (err) {
            showToast('Ошибка сохранения: ' + err.message, true);
        } finally {
            card.classList.remove('rc-loading');
        }
    }

    function cancelEdit(card) {
        let content;
        try {
            content = JSON.parse(card.dataset.content);
        } catch (_) { return; }

        card.classList.remove('rc-editing');

        const body = card.querySelector('.rc-card-body');
        switch (card.dataset.itemType) {
            case 'question': body.innerHTML = renderQuestionBody(content); break;
            case 'drug': body.innerHTML = renderDrugBody(content); break;
            case 'flashcard': body.innerHTML = renderFlashcardBody(content); break;
            case 'scenario': body.innerHTML = renderScenarioBody(content); break;
        }

        const itemId = card.dataset.itemId;
        const actions = card.querySelector('.rc-card-actions');
        actions.innerHTML = `
            <button type="button" class="btn-sm rc-btn-edit" data-id="${itemId}">&#9997; Редактировать</button>
            <button type="button" class="btn-primary btn-sm rc-btn-approve" data-id="${itemId}">&#10003; Утвердить</button>
            <button type="button" class="btn-sm rc-btn-reject" data-id="${itemId}">&#10007; Отклонить</button>
        `;
    }

    // =============================================
    // BULK ACTIONS
    // =============================================

    async function approveAll(container) {
        const draftCards = container.querySelectorAll('.rc-card[data-status="draft"]');
        for (const card of draftCards) {
            await approve(card);
        }
    }

    async function rejectAll(container) {
        const draftCards = container.querySelectorAll('.rc-card[data-status="draft"]');
        for (const card of draftCards) {
            await reject(card);
        }
    }

    // =============================================
    // EVENT BINDING
    // =============================================

    function bindCardEvents(container) {
        // Store content as data attribute on each card
        container.querySelectorAll('.rc-card').forEach(card => {
            // Find the item data from the render. We need to re-parse from the parent.
            // The items were passed to render() but we need them on each card.
            // We'll rely on the caller (LLMGenerator) to set data-content after render.
        });

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;

            const card = btn.closest('.rc-card');

            if (btn.classList.contains('rc-btn-approve') && card) {
                await approve(card);
            } else if (btn.classList.contains('rc-btn-reject') && card) {
                await reject(card);
            } else if (btn.classList.contains('rc-btn-edit') && card) {
                openEdit(card);
            } else if (btn.classList.contains('rc-btn-save') && card) {
                await saveEdit(card);
            } else if (btn.classList.contains('rc-btn-cancel') && card) {
                cancelEdit(card);
            } else if (btn.classList.contains('rc-approve-all')) {
                await approveAll(container);
            } else if (btn.classList.contains('rc-reject-all')) {
                await rejectAll(container);
            }
        });
    }

    /**
     * After render, call this to set data-content on each card
     */
    function setItemData(container, items) {
        for (const item of items) {
            const card = container.querySelector(`.rc-card[data-item-id="${item.id}"]`);
            if (card) {
                card.dataset.content = JSON.stringify(item.content);
            }
        }
    }

    function updateStats(container) {
        if (!container) return;
        const statsEl = container.closest('#gen-results')?.querySelector('#rc-stats');
        if (!statsEl) return;

        const all = container.querySelectorAll('.rc-card');
        const approved = container.querySelectorAll('.rc-card[data-status="approved"]');
        const rejected = container.querySelectorAll('.rc-card[data-status="rejected"]');
        const draft = container.querySelectorAll('.rc-card[data-status="draft"]');

        statsEl.textContent = `Всего: ${all.length} | Черновики: ${draft.length} | Утверждено: ${approved.length} | Отклонено: ${rejected.length}`;
    }

    // =============================================
    // HELPERS
    // =============================================

    function getCompetencyBlock(compId) {
        if (typeof COMPETENCIES_CONFIG !== 'undefined' && compId && COMPETENCIES_CONFIG[compId]) {
            return COMPETENCIES_CONFIG[compId].block;
        }
        // Fallback: первая часть competency_id до дефиса, или дефолт
        if (compId && typeof compId === 'string' && compId.includes('-')) {
            return compId.split('-')[0];
        }
        return 'basics';
    }

    function showToast(message, isError) {
        const toast = el('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'toast visible' + (isError ? ' toast-error' : '');
        setTimeout(() => { toast.className = 'toast'; }, 3000);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str || '';
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    return { render, setItemData };
})();
