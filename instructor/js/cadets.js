// Cadets management module
// List, create, edit cadets via Supabase

const Cadets = (() => {
    let allCadets = [];
    let editingId = null;

    function el(id) { return document.getElementById(id); }

    function generateCadetId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 6);
        return ('C' + timestamp + random).toUpperCase();
    }

    function generatePin() {
        return String(Math.floor(1000 + Math.random() * 9000));
    }

    // =============================================
    // LOAD & RENDER
    // =============================================

    async function loadCadets() {
        const container = el('cadets-list');
        container.innerHTML = '<p class="loading-text">Загрузка...</p>';

        const { data, error } = await supabaseClient
            .from('cadets')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error-text">Ошибка загрузки курсантов.</p>';
            return;
        }

        allCadets = data || [];
        updateCount();
        buildGroupFilter();
        renderList();
    }

    function renderList() {
        const search = (el('c-search').value || '').toLowerCase();
        const groupFilter = el('c-filter-group').value;

        const filtered = allCadets.filter((c) => {
            if (search && !c.full_name.toLowerCase().includes(search)) return false;
            if (groupFilter && c.group_code !== groupFilter) return false;
            return true;
        });

        const container = el('cadets-list');

        if (filtered.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет курсантов по заданным фильтрам.</p>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ФИО</th>
                        <th>Группа</th>
                        <th>PIN</th>
                        <th>Последний вход</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map((c) => {
                        const lastLogin = c.last_login ? new Date(c.last_login).toLocaleDateString('ru-RU') : '—';
                        return `<tr>
                            <td>${escapeHtml(c.full_name)}</td>
                            <td><code>${escapeHtml(c.group_code || '—')}</code></td>
                            <td><code>${escapeHtml(c.pin_code)}</code></td>
                            <td>${lastLogin}</td>
                            <td><span class="status-badge ${c.is_active ? 'status-active' : 'status-inactive'}">${c.is_active ? 'Активен' : 'Неактивен'}</span></td>
                            <td class="actions-cell">
                                <button class="btn-icon" data-action="edit" data-id="${c.id}" title="Редактировать">&#9997;</button>
                                <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${c.id}" title="Удалить">&#128465;</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;

        container.innerHTML = html;
    }

    function updateCount() {
        el('c-count').textContent = allCadets.length;
        const statEl = document.getElementById('stat-cadets');
        if (statEl) statEl.textContent = allCadets.length;
    }

    function buildGroupFilter() {
        const groups = [...new Set(allCadets.map((c) => c.group_code).filter(Boolean))].sort();
        const select = el('c-filter-group');
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
    // FORM
    // =============================================

    function openForm(cadetId) {
        editingId = cadetId || null;
        resetForm();
        populateGroupSelect();

        if (editingId) {
            const c = allCadets.find((x) => x.id === editingId);
            if (!c) return;
            el('cf-fullname').value = c.full_name;
            el('cf-group').value = c.group_code || '';
            el('cf-pin').value = c.pin_code;
            el('cf-active').checked = c.is_active;
            el('cadet-modal-title').textContent = 'Редактировать курсанта';
            el('btn-save-cadet').textContent = 'Сохранить изменения';
        } else {
            el('cf-pin').value = generatePin();
            el('cadet-modal-title').textContent = 'Новый курсант';
            el('btn-save-cadet').textContent = 'Добавить курсанта';
        }

        el('cadet-modal').classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeForm() {
        el('cadet-modal').classList.remove('visible');
        document.body.style.overflow = '';
        editingId = null;
    }

    function resetForm() {
        el('cf-fullname').value = '';
        el('cf-group').value = '';
        el('cf-pin').value = '';
        el('cf-active').checked = true;
        el('cadet-form-error').classList.remove('visible');
    }

    function populateGroupSelect() {
        const select = el('cf-group');
        select.innerHTML = '<option value="">— Без группы —</option>';
        const groups = Groups.getAll();
        groups.filter((g) => g.is_active).forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g.code;
            opt.textContent = g.code + ' — ' + g.name;
            select.appendChild(opt);
        });
    }

    async function saveCadet() {
        hideCadetFormError();

        const fullName = el('cf-fullname').value.trim();
        const groupCode = el('cf-group').value;
        const pinCode = el('cf-pin').value.trim();
        const isActive = el('cf-active').checked;

        if (!fullName) { showCadetFormError('ФИО обязательно.'); return; }
        if (!pinCode || pinCode.length !== 4) { showCadetFormError('PIN должен быть 4 цифры.'); return; }

        el('btn-save-cadet').disabled = true;
        el('btn-save-cadet').textContent = 'Сохранение...';

        try {
            const row = {
                full_name: fullName,
                group_code: groupCode || null,
                pin_code: pinCode,
                is_active: isActive,
            };

            let error;

            if (editingId) {
                ({ error } = await supabaseClient
                    .from('cadets')
                    .update(row)
                    .eq('id', editingId));
            } else {
                row.id = generateCadetId();
                ({ error } = await supabaseClient
                    .from('cadets')
                    .insert(row));
            }

            if (error) throw error;

            closeForm();
            showToast(editingId ? 'Курсант обновлён' : 'Курсант добавлен');
            await loadCadets();

        } catch (err) {
            showCadetFormError('Ошибка: ' + err.message);
        } finally {
            el('btn-save-cadet').disabled = false;
            el('btn-save-cadet').textContent = editingId ? 'Сохранить изменения' : 'Добавить курсанта';
        }
    }

    // =============================================
    // DELETE
    // =============================================

    function confirmDelete(cadetId) {
        const c = allCadets.find((x) => x.id === cadetId);
        if (!c) return;
        el('cadet-confirm-text').textContent = c.full_name;
        el('cadet-confirm-modal').classList.add('visible');
        el('cadet-confirm-modal').dataset.targetId = cadetId;
        document.body.style.overflow = 'hidden';
    }

    function closeConfirm() {
        el('cadet-confirm-modal').classList.remove('visible');
        el('cadet-confirm-modal').dataset.targetId = '';
        document.body.style.overflow = '';
    }

    async function executeDelete() {
        const cadetId = el('cadet-confirm-modal').dataset.targetId;
        if (!cadetId) return;

        const { error } = await supabaseClient
            .from('cadets')
            .delete()
            .eq('id', cadetId);

        closeConfirm();

        if (error) {
            showToast('Ошибка удаления: ' + error.message, true);
            return;
        }

        showToast('Курсант удалён');
        await loadCadets();
    }

    // =============================================
    // HELPERS
    // =============================================

    function showCadetFormError(msg) {
        const e = el('cadet-form-error');
        e.textContent = msg;
        e.classList.add('visible');
    }

    function hideCadetFormError() {
        const e = el('cadet-form-error');
        e.textContent = '';
        e.classList.remove('visible');
    }

    function showToast(msg, isError) {
        const toast = el('toast');
        toast.textContent = msg;
        toast.className = 'toast visible' + (isError ? ' toast-error' : '');
        setTimeout(() => { toast.classList.remove('visible'); }, 3000);
    }

    function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // =============================================
    // EVENTS & INIT
    // =============================================

    function bindEvents() {
        el('cadets-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'edit') openForm(btn.dataset.id);
            if (btn.dataset.action === 'delete') confirmDelete(btn.dataset.id);
        });

        el('c-search').addEventListener('input', renderList);
        el('c-filter-group').addEventListener('change', renderList);

        el('btn-add-cadet').addEventListener('click', () => openForm(null));
        el('btn-close-cadet-modal').addEventListener('click', closeForm);
        el('cadet-modal-overlay').addEventListener('click', closeForm);
        el('btn-save-cadet').addEventListener('click', saveCadet);
        el('btn-regen-pin').addEventListener('click', () => {
            el('cf-pin').value = generatePin();
        });

        el('btn-cadet-confirm-yes').addEventListener('click', executeDelete);
        el('btn-cadet-confirm-no').addEventListener('click', closeConfirm);
        el('cadet-confirm-overlay').addEventListener('click', closeConfirm);
    }

    function init() {
        bindEvents();
        loadCadets();
    }

    return { init, refresh: loadCadets };
})();
