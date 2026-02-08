// Drugs CRUD module
// List, create, edit, delete drugs via Supabase

const Drugs = (() => {
    let allDrugs = [];
    let editingId = null;
    let currentImageUrl = null;
    let currentImagePath = null;

    function el(id) { return document.getElementById(id); }

    // =============================================
    // LOAD & RENDER LIST
    // =============================================

    async function loadDrugs() {
        const container = el('drugs-list');
        container.innerHTML = '<p class="loading-text">Загрузка...</p>';

        const { data, error } = await supabaseClient
            .from('drugs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error-text">Ошибка загрузки препаратов.</p>';
            return;
        }

        allDrugs = data || [];
        updateCount();
        renderList();
    }

    function renderList() {
        const search = (el('d-search').value || '').toLowerCase();
        const groupFilter = el('d-filter-group').value;

        const filtered = allDrugs.filter((d) => {
            const haystack = (d.name_ru + ' ' + (d.name_lat || '') + ' ' + (d.drug_group || '')).toLowerCase();
            if (search && !haystack.includes(search)) return false;
            if (groupFilter && d.drug_group !== groupFilter) return false;
            return true;
        });

        const container = el('drugs-list');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет препаратов по заданным фильтрам.</p>';
            return;
        }

        container.innerHTML = filtered.map((d) => {
            const subtitle = [d.name_lat, d.drug_group].filter(Boolean).join(' | ');
            const details = [
                d.form ? 'Форма: ' + d.form : '',
                d.dosage ? 'Доза: ' + d.dosage : '',
            ].filter(Boolean).join(' | ');

            return `
                <div class="q-card" data-id="${d.id}">
                    ${d.image_url ? `<img class="drug-thumb" src="${escapeAttr(d.image_url)}" alt="">` : ''}
                    <div class="q-card-body">
                        <div class="q-card-text">${escapeHtml(d.name_ru)}</div>
                        ${subtitle ? `<div class="q-card-meta"><span>${escapeHtml(subtitle)}</span></div>` : ''}
                        ${details ? `<div class="q-card-meta" style="margin-top:4px"><span>${escapeHtml(details)}</span></div>` : ''}
                    </div>
                    <div class="q-card-actions">
                        <button class="btn-icon" title="Редактировать" data-action="edit" data-id="${d.id}">&#9997;</button>
                        <button class="btn-icon btn-icon-danger" title="Удалить" data-action="delete" data-id="${d.id}">&#128465;</button>
                    </div>
                </div>`;
        }).join('');
    }

    function updateCount() {
        el('d-count').textContent = allDrugs.length;
        const statEl = document.getElementById('stat-drugs');
        if (statEl) statEl.textContent = allDrugs.length;
    }

    function buildGroupFilter() {
        const groups = [...new Set(allDrugs.map((d) => d.drug_group).filter(Boolean))].sort();
        const select = el('d-filter-group');
        const current = select.value;
        select.innerHTML = '<option value="">Все группы</option>';
        groups.forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g;
            opt.textContent = g;
            select.appendChild(opt);
        });
        select.value = current || '';
    }

    // =============================================
    // FORM — OPEN / POPULATE / CLOSE
    // =============================================

    function openForm(drugId) {
        editingId = drugId || null;
        resetForm();

        if (editingId) {
            const d = allDrugs.find((x) => x.id === editingId);
            if (!d) return;
            populateForm(d);
            el('drug-modal-title').textContent = 'Редактировать препарат';
            el('btn-save-drug').textContent = 'Сохранить изменения';
        } else {
            el('drug-modal-title').textContent = 'Новый препарат';
            el('btn-save-drug').textContent = 'Создать препарат';
        }

        el('drug-modal').classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeForm() {
        el('drug-modal').classList.remove('visible');
        document.body.style.overflow = '';
        editingId = null;
        currentImageUrl = null;
        currentImagePath = null;
    }

    function resetForm() {
        el('df-name-ru').value = '';
        el('df-name-lat').value = '';
        el('df-group').value = '';
        el('df-form').value = '';
        el('df-dosage').value = '';
        el('df-indications').value = '';
        el('df-contraindications').value = '';
        el('df-field-notes').value = '';
        el('df-image-input').value = '';
        el('df-image-preview').classList.add('hidden');
        el('df-image-preview').innerHTML = '';
        el('drug-form-error').classList.remove('visible');
        currentImageUrl = null;
        currentImagePath = null;
    }

    function populateForm(d) {
        el('df-name-ru').value = d.name_ru || '';
        el('df-name-lat').value = d.name_lat || '';
        el('df-group').value = d.drug_group || '';
        el('df-form').value = d.form || '';
        el('df-dosage').value = d.dosage || '';
        el('df-indications').value = d.indications || '';
        el('df-contraindications').value = d.contraindications || '';
        el('df-field-notes').value = d.field_notes || '';

        if (d.image_url) {
            currentImageUrl = d.image_url;
            currentImagePath = ImageUpload.pathFromUrl(d.image_url);
            showImagePreview(d.image_url);
        }
    }

    // =============================================
    // IMAGE HANDLING
    // =============================================

    function handleImageSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => showImagePreview(ev.target.result);
        reader.readAsDataURL(file);
    }

    function showImagePreview(src) {
        const preview = el('df-image-preview');
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
        el('df-image-input').value = '';
        el('df-image-preview').classList.add('hidden');
        el('df-image-preview').innerHTML = '';
    }

    // =============================================
    // SAVE (CREATE / UPDATE)
    // =============================================

    async function saveDrug() {
        hideDrugFormError();

        const nameRu = el('df-name-ru').value.trim();
        const nameLat = el('df-name-lat').value.trim();
        const drugGroup = el('df-group').value.trim();
        const form = el('df-form').value.trim();
        const dosage = el('df-dosage').value.trim();
        const indications = el('df-indications').value.trim();
        const contraindications = el('df-contraindications').value.trim();
        const fieldNotes = el('df-field-notes').value.trim();

        if (!nameRu) {
            showDrugFormError('Введите русское название препарата.');
            return;
        }

        setDrugFormLoading(true);

        try {
            const fileInput = el('df-image-input');
            let imageUrl = currentImageUrl;

            if (fileInput.files[0]) {
                if (currentImagePath) {
                    try { await ImageUpload.remove(currentImagePath); } catch (_) { /* ignore */ }
                }
                const result = await ImageUpload.upload(fileInput.files[0], 'drugs');
                imageUrl = result.url;
            }

            const row = {
                name_ru: nameRu,
                name_lat: nameLat || null,
                drug_group: drugGroup || null,
                form: form || null,
                dosage: dosage || null,
                indications: indications || null,
                contraindications: contraindications || null,
                field_notes: fieldNotes || null,
                image_url: imageUrl || null,
                updated_at: new Date().toISOString(),
            };

            let error;

            if (editingId) {
                ({ error } = await supabaseClient
                    .from('drugs')
                    .update(row)
                    .eq('id', editingId));
            } else {
                const { data: { user } } = await supabaseClient.auth.getUser();
                row.created_by = user.id;
                ({ error } = await supabaseClient
                    .from('drugs')
                    .insert(row));
            }

            if (error) throw error;

            closeForm();
            showToast(editingId ? 'Препарат обновлён' : 'Препарат создан');
            await loadDrugs();
            buildGroupFilter();

        } catch (err) {
            showDrugFormError('Ошибка сохранения: ' + err.message);
        } finally {
            setDrugFormLoading(false);
        }
    }

    // =============================================
    // DELETE
    // =============================================

    function confirmDelete(drugId) {
        const d = allDrugs.find((x) => x.id === drugId);
        if (!d) return;

        el('drug-confirm-title').textContent = 'Удалить препарат?';
        el('drug-confirm-text').textContent = d.name_ru;
        el('drug-confirm-modal').classList.add('visible');
        el('drug-confirm-modal').dataset.targetId = drugId;
        document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
        el('drug-confirm-modal').classList.remove('visible');
        el('drug-confirm-modal').dataset.targetId = '';
        document.body.style.overflow = '';
    }

    async function executeDelete() {
        const drugId = el('drug-confirm-modal').dataset.targetId;
        if (!drugId) return;

        const d = allDrugs.find((x) => x.id === drugId);

        if (d && d.image_url) {
            const path = ImageUpload.pathFromUrl(d.image_url);
            if (path) {
                try { await ImageUpload.remove(path); } catch (_) { /* ignore */ }
            }
        }

        const { error } = await supabaseClient
            .from('drugs')
            .delete()
            .eq('id', drugId);

        closeConfirm();

        if (error) {
            showToast('Ошибка удаления: ' + error.message, true);
            return;
        }

        showToast('Препарат удалён');
        await loadDrugs();
        buildGroupFilter();
    }

    // =============================================
    // UI HELPERS
    // =============================================

    function showDrugFormError(msg) {
        const errEl = el('drug-form-error');
        errEl.textContent = msg;
        errEl.classList.add('visible');
    }

    function hideDrugFormError() {
        const errEl = el('drug-form-error');
        errEl.textContent = '';
        errEl.classList.remove('visible');
    }

    function setDrugFormLoading(on) {
        const btn = el('btn-save-drug');
        btn.disabled = on;
        btn.textContent = on ? 'Сохранение...' : (editingId ? 'Сохранить изменения' : 'Создать препарат');
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
        el('drugs-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            if (action === 'edit') openForm(id);
            if (action === 'delete') confirmDelete(id);
        });

        el('d-search').addEventListener('input', renderList);
        el('d-filter-group').addEventListener('change', renderList);

        el('btn-add-drug').addEventListener('click', () => openForm(null));

        el('btn-close-drug-modal').addEventListener('click', closeForm);
        el('drug-modal-overlay').addEventListener('click', closeForm);
        el('btn-save-drug').addEventListener('click', saveDrug);
        el('df-image-input').addEventListener('change', handleImageSelect);

        el('btn-drug-confirm-yes').addEventListener('click', executeDelete);
        el('btn-drug-confirm-no').addEventListener('click', closeConfirm);
        el('drug-confirm-overlay').addEventListener('click', closeConfirm);
    }

    // =============================================
    // INIT
    // =============================================

    function init() {
        bindEvents();
        loadDrugs().then(buildGroupFilter);
    }

    return { init, refresh: loadDrugs };
})();
