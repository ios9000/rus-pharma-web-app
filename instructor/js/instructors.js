// Instructors registry module
// List and add instructors to the registry table
// NOTE: This does NOT create Supabase Auth users (requires service_role key).
// Adding to the registry is for tracking; Auth user must be created separately.

const Instructors = (() => {
    let allInstructors = [];

    function el(id) { return document.getElementById(id); }

    // =============================================
    // LOAD & RENDER
    // =============================================

    async function loadInstructors() {
        const container = el('instructors-list');
        container.innerHTML = '<p class="loading-text">Загрузка...</p>';

        const { data, error } = await supabaseClient
            .from('instructors')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            container.innerHTML = '<p class="error-text">Ошибка загрузки инструкторов.</p>';
            return;
        }

        allInstructors = data || [];
        updateCount();
        renderList();
    }

    function renderList() {
        const container = el('instructors-list');

        if (allInstructors.length === 0) {
            container.innerHTML = '<p class="empty-text">Нет инструкторов в реестре.</p>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ФИО</th>
                        <th>Email</th>
                        <th>Дата добавления</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${allInstructors.map((i) => {
                        const date = new Date(i.created_at).toLocaleDateString('ru-RU');
                        return `<tr>
                            <td>${escapeHtml(i.full_name)}</td>
                            <td>${escapeHtml(i.email)}</td>
                            <td>${date}</td>
                            <td><span class="status-badge ${i.is_active ? 'status-active' : 'status-inactive'}">${i.is_active ? 'Активен' : 'Неактивен'}</span></td>
                            <td><button class="btn-icon" data-action="edit" data-id="${i.id}" title="Редактировать">&#9997;</button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`;

        container.innerHTML = html;
    }

    function updateCount() {
        el('i-count').textContent = allInstructors.length;
        const statEl = document.getElementById('stat-instructors');
        if (statEl) statEl.textContent = allInstructors.length;
    }

    // =============================================
    // FORM
    // =============================================

    let editingId = null;

    function openForm(instructorId) {
        editingId = instructorId || null;
        resetForm();

        if (editingId) {
            const i = allInstructors.find((x) => x.id === editingId);
            if (!i) return;
            el('if-fullname').value = i.full_name;
            el('if-email').value = i.email;
            el('if-email').disabled = true;
            el('if-active').checked = i.is_active;
            el('instructor-modal-title').textContent = 'Редактировать инструктора';
            el('btn-save-instructor').textContent = 'Сохранить изменения';
        } else {
            el('if-email').disabled = false;
            el('instructor-modal-title').textContent = 'Добавить инструктора';
            el('btn-save-instructor').textContent = 'Добавить';
        }

        el('instructor-modal').classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeForm() {
        el('instructor-modal').classList.remove('visible');
        document.body.style.overflow = '';
        editingId = null;
    }

    function resetForm() {
        el('if-fullname').value = '';
        el('if-email').value = '';
        el('if-active').checked = true;
        el('instructor-form-error').classList.remove('visible');
    }

    async function saveInstructor() {
        hideFormError();

        const fullName = el('if-fullname').value.trim();
        const email = el('if-email').value.trim();
        const isActive = el('if-active').checked;

        if (!fullName) { showFormError('ФИО обязательно.'); return; }
        if (!email) { showFormError('Email обязателен.'); return; }

        el('btn-save-instructor').disabled = true;
        el('btn-save-instructor').textContent = 'Сохранение...';

        try {
            let error;

            if (editingId) {
                ({ error } = await supabaseClient
                    .from('instructors')
                    .update({ full_name: fullName, is_active: isActive })
                    .eq('id', editingId));
            } else {
                const { data: { user } } = await supabaseClient.auth.getUser();
                ({ error } = await supabaseClient
                    .from('instructors')
                    .insert({ email, full_name: fullName, is_active: isActive, created_by: user.id }));
            }

            if (error) throw error;

            closeForm();
            showToast(editingId ? 'Инструктор обновлён' : 'Инструктор добавлен');
            await loadInstructors();

        } catch (err) {
            showFormError('Ошибка: ' + err.message);
        } finally {
            el('btn-save-instructor').disabled = false;
            el('btn-save-instructor').textContent = editingId ? 'Сохранить изменения' : 'Добавить';
        }
    }

    // =============================================
    // HELPERS
    // =============================================

    function showFormError(msg) {
        const e = el('instructor-form-error');
        e.textContent = msg;
        e.classList.add('visible');
    }

    function hideFormError() {
        const e = el('instructor-form-error');
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
        el('instructors-list').addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="edit"]');
            if (btn) openForm(btn.dataset.id);
        });

        el('btn-add-instructor').addEventListener('click', () => openForm(null));
        el('btn-close-instructor-modal').addEventListener('click', closeForm);
        el('instructor-modal-overlay').addEventListener('click', closeForm);
        el('btn-save-instructor').addEventListener('click', saveInstructor);
    }

    function init() {
        bindEvents();
        loadInstructors();
    }

    return { init, refresh: loadInstructors };
})();
