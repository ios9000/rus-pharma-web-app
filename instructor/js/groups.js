// Groups management module
// List, create, edit groups via Supabase

const Groups = (() => {
    let allGroups = [];

    function el(id) { return document.getElementById(id); }

    // Characters for code generation (no 0/O, 1/I/l)
    const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    function generateCode() {
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        }
        return code;
    }

    // =============================================
    // LOAD & RENDER
    // =============================================

    async function loadGroups() {
        const container = el('groups-list');
        container.innerHTML = '<p class="loading-text">Загрузка...</p>';

        const [groupsRes, cadetsRes] = await Promise.all([
            supabaseClient.from('groups').select('*').order('created_at', { ascending: false }),
            supabaseClient.from('cadets').select('group_code'),
        ]);

        if (groupsRes.error) {
            container.innerHTML = '<p class="error-text">Ошибка загрузки групп.</p>';
            return;
        }

        allGroups = groupsRes.data || [];

        // Count cadets per group
        const counts = {};
        (cadetsRes.data || []).forEach((c) => {
            counts[c.group_code] = (counts[c.group_code] || 0) + 1;
        });

        renderList(counts);
        updateCount();
    }

    function renderList(cadetCounts) {
        const container = el('groups-list');

        if (allGroups.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет групп.</p>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Код</th>
                        <th>Название</th>
                        <th>Инструктор</th>
                        <th>Курсантов</th>
                        <th>Макс.</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${allGroups.map((g) => {
                        const count = cadetCounts[g.code] || 0;
                        return `<tr>
                            <td><code>${escapeHtml(g.code)}</code></td>
                            <td>${escapeHtml(g.name)}</td>
                            <td>${escapeHtml(g.instructor || '—')}</td>
                            <td>${count}</td>
                            <td>${g.max_cadets}</td>
                            <td><span class="status-badge ${g.is_active ? 'status-active' : 'status-inactive'}">${g.is_active ? 'Активна' : 'Неактивна'}</span></td>
                            <td><button class="btn-icon" data-action="edit" data-code="${escapeAttr(g.code)}" title="Редактировать">&#9997;</button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;

        container.innerHTML = html;
    }

    function updateCount() {
        el('g-count').textContent = allGroups.length;
        const statEl = document.getElementById('stat-groups');
        if (statEl) statEl.textContent = allGroups.length;
    }

    // =============================================
    // FORM
    // =============================================

    let editingCode = null;

    function openForm(code) {
        editingCode = code || null;
        resetForm();

        if (editingCode) {
            const g = allGroups.find((x) => x.code === editingCode);
            if (!g) return;
            el('gf-code').value = g.code;
            el('gf-code').disabled = true;
            el('gf-name').value = g.name;
            el('gf-instructor').value = g.instructor || '';
            el('gf-max-cadets').value = g.max_cadets;
            el('gf-active').checked = g.is_active;
            el('group-modal-title').textContent = 'Редактировать группу';
            el('btn-save-group').textContent = 'Сохранить изменения';
        } else {
            el('gf-code').value = generateCode();
            el('gf-code').disabled = false;
            el('group-modal-title').textContent = 'Новая группа';
            el('btn-save-group').textContent = 'Создать группу';
        }

        el('group-modal').classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeForm() {
        el('group-modal').classList.remove('visible');
        document.body.style.overflow = '';
        editingCode = null;
    }

    function resetForm() {
        el('gf-code').value = '';
        el('gf-name').value = '';
        el('gf-instructor').value = '';
        el('gf-max-cadets').value = '30';
        el('gf-active').checked = true;
        el('group-form-error').classList.remove('visible');
    }

    async function saveGroup() {
        hideFormError();

        const code = el('gf-code').value.trim().toUpperCase();
        const name = el('gf-name').value.trim();
        const instructor = el('gf-instructor').value.trim();
        const maxCadets = parseInt(el('gf-max-cadets').value, 10) || 30;
        const isActive = el('gf-active').checked;

        if (!code) { showFormError('Код группы обязателен.'); return; }
        if (!name) { showFormError('Название группы обязательно.'); return; }

        el('btn-save-group').disabled = true;
        el('btn-save-group').textContent = 'Сохранение...';

        try {
            let error;

            if (editingCode) {
                ({ error } = await supabaseClient
                    .from('groups')
                    .update({ name, instructor: instructor || null, max_cadets: maxCadets, is_active: isActive })
                    .eq('code', editingCode));
            } else {
                ({ error } = await supabaseClient
                    .from('groups')
                    .insert({ code, name, instructor: instructor || null, max_cadets: maxCadets, is_active: isActive }));
            }

            if (error) throw error;

            closeForm();
            showToast(editingCode ? 'Группа обновлена' : 'Группа создана');
            await loadGroups();

        } catch (err) {
            showFormError('Ошибка: ' + err.message);
        } finally {
            el('btn-save-group').disabled = false;
            el('btn-save-group').textContent = editingCode ? 'Сохранить изменения' : 'Создать группу';
        }
    }

    // =============================================
    // HELPERS
    // =============================================

    function showFormError(msg) {
        const e = el('group-form-error');
        e.textContent = msg;
        e.classList.add('visible');
    }

    function hideFormError() {
        const e = el('group-form-error');
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
    function escapeAttr(s) { return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); }

    // Get all group codes for external use (cadets dropdown)
    function getAll() { return allGroups; }

    // =============================================
    // EVENTS & INIT
    // =============================================

    function bindEvents() {
        el('groups-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit"]');
            if (btn) openForm(btn.dataset.code);
        });

        el('btn-add-group').addEventListener('click', () => openForm(null));
        el('btn-close-group-modal').addEventListener('click', closeForm);
        el('group-modal-overlay').addEventListener('click', closeForm);
        el('btn-save-group').addEventListener('click', saveGroup);
        el('btn-regen-code').addEventListener('click', () => {
            if (!el('gf-code').disabled) el('gf-code').value = generateCode();
        });
    }

    function init() {
        bindEvents();
        loadGroups();
    }

    return { init, refresh: loadGroups, getAll };
})();
