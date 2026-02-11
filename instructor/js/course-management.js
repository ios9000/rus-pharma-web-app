// ============================================
// COURSE MANAGEMENT — управление курсом
// instructor/js/course-management.js
// ============================================

const CourseManagement = (() => {
    // State
    let allGroups = [];
    let allModules = [];
    let courseLevels = [];
    let assignments = {};      // { moduleId: assignment }
    let sessions = [];
    let cadetResults = [];
    let openAnswerStats = {};  // { cadetId: { total, graded } }

    let selectedGroupCode = null;

    // Helpers
    const el = (id) => document.getElementById(id);
    function escapeHtml(s) {
        if (!s) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ============================================
    // INIT
    // ============================================

    async function init() {
        await loadBaseData();
        renderGroupSelector();
        bindEvents();
    }

    async function loadBaseData() {
        const [groupsRes, modulesRes, levelsRes] = await Promise.all([
            supabaseClient.from('groups').select('*').eq('is_active', true).order('name'),
            supabaseClient.from('course_modules').select('*').order('sort_order'),
            supabaseClient.from('course_levels').select('*').order('level_number'),
        ]);

        allGroups = groupsRes.data || [];
        allModules = modulesRes.data || [];
        courseLevels = levelsRes.data || [];
    }

    // ============================================
    // GROUP SELECTOR
    // ============================================

    function renderGroupSelector() {
        const select = el('cm-group-select');
        if (!select) return;

        select.innerHTML = '<option value="">— Выберите группу —</option>';
        allGroups.forEach((g) => {
            const opt = document.createElement('option');
            opt.value = g.code;
            opt.textContent = g.name + ' (' + g.code + ')';
            select.appendChild(opt);
        });

        // Restore previous selection
        if (selectedGroupCode) {
            select.value = selectedGroupCode;
        }

        renderCourseLevelSelector();
    }

    function renderCourseLevelSelector() {
        const select = el('cm-level-select');
        if (!select) return;

        select.innerHTML = '<option value="">— Уровень не выбран —</option>';
        courseLevels.forEach((lv) => {
            const opt = document.createElement('option');
            opt.value = lv.id;
            opt.textContent = lv.level_number + ' — ' + lv.name;
            select.appendChild(opt);
        });
    }

    async function onGroupChange() {
        const code = el('cm-group-select').value;
        selectedGroupCode = code || null;

        if (!code) {
            el('cm-group-details').classList.add('hidden');
            return;
        }

        el('cm-group-details').classList.remove('hidden');

        // Set course level dropdown
        const group = allGroups.find((g) => g.code === code);
        if (group && group.course_level_id) {
            el('cm-level-select').value = group.course_level_id;
        } else {
            el('cm-level-select').value = '';
        }

        await loadGroupData(code);
    }

    async function onLevelChange() {
        if (!selectedGroupCode) return;
        const levelId = el('cm-level-select').value;

        const { error } = await supabaseClient
            .from('groups')
            .update({ course_level_id: levelId ? parseInt(levelId) : null })
            .eq('code', selectedGroupCode);

        if (error) {
            showToast('Ошибка обновления уровня: ' + error.message);
        } else {
            // Update local state
            const g = allGroups.find((x) => x.code === selectedGroupCode);
            if (g) g.course_level_id = levelId ? parseInt(levelId) : null;
            showToast('Уровень курса обновлён');
        }
    }

    // ============================================
    // LOAD GROUP DATA
    // ============================================

    async function loadGroupData(groupCode) {
        el('cm-modules-list').innerHTML = '<p class="loading-text">Загрузка...</p>';
        el('cm-sessions-list').innerHTML = '<p class="loading-text">Загрузка...</p>';
        el('cm-cadets-table').innerHTML = '<p class="loading-text">Загрузка...</p>';

        const [assignRes, sessRes, mcCountRes, oaCountRes, cadetsRes] = await Promise.all([
            supabaseClient.from('course_assignments')
                .select('*')
                .eq('group_code', groupCode),
            supabaseClient.from('test_sessions')
                .select('*, course_modules(module_name, module_number)')
                .eq('group_code', groupCode)
                .order('created_at', { ascending: false }),
            // MC question counts per module
            supabaseClient.from('questions')
                .select('module_id')
                .not('module_id', 'is', null),
            // Open answer question counts per module
            supabaseClient.from('open_answer_questions')
                .select('module_id'),
            // Cadets in group
            supabaseClient.from('cadets')
                .select('id, full_name')
                .eq('group_code', groupCode)
                .eq('is_active', true)
                .order('full_name'),
        ]);

        // Build assignment map: module_id → assignment
        assignments = {};
        (assignRes.data || []).forEach((a) => {
            assignments[a.module_id] = a;
        });

        sessions = sessRes.data || [];

        // Build MC count map: module_id → count
        const mcCounts = {};
        (mcCountRes.data || []).forEach((r) => {
            mcCounts[r.module_id] = (mcCounts[r.module_id] || 0) + 1;
        });

        // Build OA count map: module_id → count
        const oaCounts = {};
        (oaCountRes.data || []).forEach((r) => {
            oaCounts[r.module_id] = (oaCounts[r.module_id] || 0) + 1;
        });

        renderModulesList(mcCounts, oaCounts);
        renderSessionsList();

        // Load cadet results separately (heavier query)
        const cadets = cadetsRes.data || [];
        if (cadets.length > 0) {
            await loadCadetResults(groupCode, cadets);
        } else {
            el('cm-cadets-table').innerHTML = '<p class="empty-text">Нет курсантов в группе.</p>';
        }
    }

    // ============================================
    // MODULES LIST
    // ============================================

    function renderModulesList(mcCounts, oaCounts) {
        const container = el('cm-modules-list');
        if (allModules.length === 0) {
            container.innerHTML = '<p class="empty-text">Модули не загружены.</p>';
            return;
        }

        // Group by block
        const blocks = {};
        allModules.forEach((m) => {
            if (!blocks[m.block_number]) {
                blocks[m.block_number] = {
                    block_number: m.block_number,
                    block_name: m.block_name,
                    modules: []
                };
            }
            blocks[m.block_number].modules.push(m);
        });

        let html = '';
        Object.values(blocks)
            .sort((a, b) => a.block_number - b.block_number)
            .forEach((block) => {
                const allOpen = block.modules.every((m) => {
                    const a = assignments[m.id];
                    return a && a.status === 'open';
                });

                html += `
                    <div class="cm-block">
                        <div class="cm-block-header">
                            <h3>Блок ${block.block_number}: ${escapeHtml(block.block_name)}</h3>
                            <button class="btn-sm btn-outline" data-action="open-block" data-block="${block.block_number}">
                                ${allOpen ? '&#128274; Закрыть блок' : '&#128275; Открыть блок'}
                            </button>
                        </div>
                        <table class="data-table cm-modules-table">
                            <thead>
                                <tr>
                                    <th>№</th>
                                    <th>Модуль</th>
                                    <th>MC</th>
                                    <th>Задания</th>
                                    <th>Статус</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>`;

                block.modules.forEach((m) => {
                    const a = assignments[m.id];
                    const status = a ? a.status : 'closed';
                    const mc = mcCounts[m.id] || 0;
                    const oa = oaCounts[m.id] || 0;

                    const statusBadge = status === 'open'
                        ? '<span class="status-badge status-active">&#9989; Открыт</span>'
                        : status === 'completed'
                            ? '<span class="status-badge status-completed">&#9989; Завершён</span>'
                            : '<span class="status-badge status-inactive">&#128274; Закрыт</span>';

                    const btnText = status === 'open' ? 'Закрыть' : 'Открыть';
                    const btnClass = status === 'open' ? 'btn-sm btn-muted' : 'btn-sm btn-primary';

                    html += `
                        <tr>
                            <td>${m.module_number}</td>
                            <td>${escapeHtml(m.module_name)}</td>
                            <td>${mc}</td>
                            <td>${oa}</td>
                            <td>${statusBadge}</td>
                            <td>
                                <button class="${btnClass}" data-action="toggle-module" data-module-id="${m.id}" data-current="${status}">
                                    ${btnText}
                                </button>
                            </td>
                        </tr>`;
                });

                html += `</tbody></table></div>`;
            });

        container.innerHTML = html;
    }

    // ============================================
    // MODULE ACTIONS
    // ============================================

    async function toggleModule(moduleId, currentStatus) {
        if (!selectedGroupCode) return;

        const newStatus = currentStatus === 'open' ? 'closed' : 'open';

        const { error } = await supabaseClient
            .from('course_assignments')
            .upsert({
                group_code: selectedGroupCode,
                module_id: parseInt(moduleId),
                status: newStatus,
                opened_at: newStatus === 'open' ? new Date().toISOString() : null
            }, { onConflict: 'group_code,module_id' });

        if (error) {
            showToast('Ошибка: ' + error.message);
            return;
        }

        showToast(newStatus === 'open' ? 'Модуль открыт' : 'Модуль закрыт');
        await loadGroupData(selectedGroupCode);
    }

    async function toggleBlock(blockNumber) {
        if (!selectedGroupCode) return;

        const blockModules = allModules.filter((m) => m.block_number === parseInt(blockNumber));
        const allOpen = blockModules.every((m) => {
            const a = assignments[m.id];
            return a && a.status === 'open';
        });
        const newStatus = allOpen ? 'closed' : 'open';

        const rows = blockModules.map((m) => ({
            group_code: selectedGroupCode,
            module_id: m.id,
            status: newStatus,
            opened_at: newStatus === 'open' ? new Date().toISOString() : null
        }));

        const { error } = await supabaseClient
            .from('course_assignments')
            .upsert(rows, { onConflict: 'group_code,module_id' });

        if (error) {
            showToast('Ошибка: ' + error.message);
            return;
        }

        showToast(newStatus === 'open'
            ? 'Блок ' + blockNumber + ' открыт'
            : 'Блок ' + blockNumber + ' закрыт');
        await loadGroupData(selectedGroupCode);
    }

    // ============================================
    // TEST SESSIONS
    // ============================================

    function renderSessionsList() {
        const container = el('cm-sessions-list');

        let html = `
            <div style="margin-bottom: 12px;">
                <button class="btn-primary" data-action="new-session">+ Создать сессию</button>
            </div>`;

        if (sessions.length === 0) {
            html += '<p class="empty-text">Нет сессий.</p>';
            container.innerHTML = html;
            return;
        }

        html += `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Название</th>
                        <th>Тип</th>
                        <th>Модуль</th>
                        <th>Статус</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>`;

        const typeLabels = { entrance: 'Входной', module: 'Модульный', final: 'Финальный' };

        sessions.forEach((s) => {
            const typeBadge = typeLabels[s.session_type] || s.session_type;
            const moduleName = s.course_modules
                ? s.course_modules.module_number + '. ' + escapeHtml(s.course_modules.module_name)
                : '—';

            let statusBadge, actions;
            if (s.status === 'draft') {
                statusBadge = '<span class="status-badge status-inactive">Черновик</span>';
                actions = `
                    <button class="btn-sm btn-primary" data-action="activate-session" data-session-id="${s.id}">Активировать</button>
                    <button class="btn-sm btn-muted" data-action="delete-session" data-session-id="${s.id}">&#128465;</button>`;
            } else if (s.status === 'active') {
                statusBadge = '<span class="status-badge status-active">Активна</span>';
                actions = `<button class="btn-sm btn-muted" data-action="close-session" data-session-id="${s.id}">Закрыть</button>`;
            } else {
                statusBadge = '<span class="status-badge status-completed">Закрыта</span>';
                actions = '';
            }

            html += `
                <tr>
                    <td>${escapeHtml(s.title)}</td>
                    <td>${typeBadge}</td>
                    <td>${moduleName}</td>
                    <td>${statusBadge}</td>
                    <td>${actions}</td>
                </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    }

    function showSessionForm() {
        const modal = el('cm-session-modal');
        if (!modal) return;

        // Populate module dropdown
        const moduleSelect = el('cm-sf-module');
        moduleSelect.innerHTML = '<option value="">— Не привязан —</option>';
        allModules.forEach((m) => {
            moduleSelect.innerHTML += `<option value="${m.id}">${m.module_number}. ${escapeHtml(m.module_name)}</option>`;
        });

        // Populate multi-select module checkboxes for entrance/final
        const multiContainer = el('cm-sf-modules-multi');
        multiContainer.innerHTML = '';
        allModules.forEach((m) => {
            multiContainer.innerHTML += `
                <label class="checkbox-label" style="display: block; margin-bottom: 4px;">
                    <input type="checkbox" name="cm-session-modules" value="${m.id}">
                    ${m.module_number}. ${escapeHtml(m.module_name)}
                </label>`;
        });

        // Reset form
        el('cm-sf-title').value = '';
        el('cm-sf-type').value = 'module';
        onSessionTypeChange();

        modal.classList.add('visible');
        document.body.style.overflow = 'hidden';
    }

    function closeSessionForm() {
        const modal = el('cm-session-modal');
        if (modal) modal.classList.remove('visible');
        document.body.style.overflow = '';
    }

    function onSessionTypeChange() {
        const type = el('cm-sf-type').value;
        // Show single module for 'module' type, multi-select for entrance/final
        el('cm-sf-module-row').style.display = type === 'module' ? 'block' : 'none';
        el('cm-sf-modules-multi-row').style.display = type !== 'module' ? 'block' : 'none';
    }

    async function saveSession() {
        if (!selectedGroupCode) return;

        const title = el('cm-sf-title').value.trim();
        const type = el('cm-sf-type').value;

        if (!title) {
            showToast('Введите название сессии');
            return;
        }

        const row = {
            group_code: selectedGroupCode,
            session_type: type,
            title: title,
            status: 'draft'
        };

        if (type === 'module') {
            const moduleId = el('cm-sf-module').value;
            if (moduleId) row.module_id = parseInt(moduleId);
        }

        const { data, error } = await supabaseClient
            .from('test_sessions')
            .insert(row)
            .select()
            .single();

        if (error) {
            showToast('Ошибка: ' + error.message);
            return;
        }

        // For entrance/final — insert selected modules into test_session_modules
        if (type !== 'module' && data) {
            const checkedModules = document.querySelectorAll('input[name="cm-session-modules"]:checked');
            const moduleRows = [];
            checkedModules.forEach((cb) => {
                moduleRows.push({
                    session_id: data.id,
                    module_id: parseInt(cb.value)
                });
            });
            if (moduleRows.length > 0) {
                await supabaseClient.from('test_session_modules').insert(moduleRows);
            }
        }

        closeSessionForm();
        showToast('Сессия создана');
        await loadGroupData(selectedGroupCode);
    }

    async function activateSession(sessionId) {
        const { error } = await supabaseClient
            .from('test_sessions')
            .update({ status: 'active', activated_at: new Date().toISOString() })
            .eq('id', sessionId);

        if (error) {
            showToast('Ошибка: ' + error.message);
        } else {
            showToast('Сессия активирована');
            await loadGroupData(selectedGroupCode);
        }
    }

    async function closeSession(sessionId) {
        const { error } = await supabaseClient
            .from('test_sessions')
            .update({ status: 'closed', closed_at: new Date().toISOString() })
            .eq('id', sessionId);

        if (error) {
            showToast('Ошибка: ' + error.message);
        } else {
            showToast('Сессия закрыта');
            await loadGroupData(selectedGroupCode);
        }
    }

    async function deleteSession(sessionId) {
        if (!confirm('Удалить сессию? Это действие необратимо.')) return;

        const { error } = await supabaseClient
            .from('test_sessions')
            .delete()
            .eq('id', sessionId);

        if (error) {
            showToast('Ошибка: ' + error.message);
        } else {
            showToast('Сессия удалена');
            await loadGroupData(selectedGroupCode);
        }
    }

    // ============================================
    // CADET STATUS TABLE
    // ============================================

    async function loadCadetResults(groupCode, cadets) {
        const container = el('cm-cadets-table');

        // Load MC results for the group
        const [mcRes, oaRes] = await Promise.all([
            supabaseClient.from('student_test_results')
                .select('cadet_id, question_id, is_correct, questions(module_id)')
                .eq('group_code', groupCode),
            supabaseClient.from('student_open_answers')
                .select('cadet_id, question_id, instructor_grade')
                .eq('group_code', groupCode),
        ]);

        const mcData = mcRes.data || [];
        const oaData = oaRes.data || [];

        // Build MC results: cadet_id → module_id → { correct, total }
        const mcByCadet = {};
        mcData.forEach((r) => {
            const moduleId = r.questions ? r.questions.module_id : null;
            if (!moduleId) return;
            if (!mcByCadet[r.cadet_id]) mcByCadet[r.cadet_id] = {};
            if (!mcByCadet[r.cadet_id][moduleId]) mcByCadet[r.cadet_id][moduleId] = { correct: 0, total: 0 };
            mcByCadet[r.cadet_id][moduleId].total++;
            if (r.is_correct) mcByCadet[r.cadet_id][moduleId].correct++;
        });

        // Build OA stats: cadet_id → { total, graded }
        const oaByCadet = {};
        oaData.forEach((r) => {
            if (!oaByCadet[r.cadet_id]) oaByCadet[r.cadet_id] = { total: 0, graded: 0 };
            oaByCadet[r.cadet_id].total++;
            if (r.instructor_grade) oaByCadet[r.cadet_id].graded++;
        });

        // Get open modules for this group
        const openModuleIds = [];
        Object.entries(assignments).forEach(([modId, a]) => {
            if (a.status === 'open' || a.status === 'completed') {
                openModuleIds.push(parseInt(modId));
            }
        });

        // Find which modules to show (open ones)
        const displayModules = allModules.filter((m) => openModuleIds.includes(m.id));

        if (displayModules.length === 0 && cadets.length > 0) {
            container.innerHTML = '<p class="empty-text">Нет открытых модулей. Откройте модули выше, чтобы увидеть статистику.</p>';
            return;
        }

        let html = `
            <div style="overflow-x: auto;">
            <table class="data-table cm-cadets-status">
                <thead>
                    <tr>
                        <th>Курсант</th>`;

        displayModules.forEach((m) => {
            html += `<th title="${escapeHtml(m.module_name)}">М${m.module_number}</th>`;
        });

        html += `<th>Задания</th><th></th></tr></thead><tbody>`;

        cadets.forEach((cadet) => {
            html += `<tr><td><a href="#" class="cm-cadet-link" data-action="view-answers" data-cadet-id="${escapeHtml(cadet.id)}" data-cadet-name="${escapeHtml(cadet.full_name)}">${escapeHtml(cadet.full_name)}</a></td>`;

            displayModules.forEach((m) => {
                const mcResult = mcByCadet[cadet.id] ? mcByCadet[cadet.id][m.id] : null;
                if (mcResult && mcResult.total > 0) {
                    const pct = Math.round(mcResult.correct / mcResult.total * 100);
                    const color = pct >= 70 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
                    html += `<td style="text-align: center;"><span style="color: ${color}; font-weight: 600;">${pct}%</span></td>`;
                } else {
                    html += '<td style="text-align: center; color: #94a3b8;">—</td>';
                }
            });

            // Open answer stats
            const oa = oaByCadet[cadet.id];
            if (oa) {
                html += `<td style="text-align: center;">${oa.graded}/${oa.total}</td>`;
            } else {
                html += '<td style="text-align: center; color: #94a3b8;">—</td>';
            }

            // Reset button
            html += `<td><button class="btn-sm btn-muted" data-action="reset-cadet" data-cadet-id="${escapeHtml(cadet.id)}" title="Сбросить результаты">&#8634;</button></td>`;

            html += '</tr>';
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
    }

    async function resetCadetResults(cadetId) {
        if (!selectedGroupCode) return;
        if (!confirm('Удалить все результаты MC для курсанта ' + cadetId + '? Это позволит пройти тесты заново.')) return;

        const { error } = await supabaseClient
            .from('student_test_results')
            .delete()
            .eq('cadet_id', cadetId)
            .eq('group_code', selectedGroupCode);

        if (error) {
            showToast('Ошибка: ' + error.message);
        } else {
            showToast('Результаты сброшены');
            await loadGroupData(selectedGroupCode);
        }
    }

    // ============================================
    // OPEN ANSWER REVIEW
    // ============================================

    async function openCadetReview(cadetId, cadetName) {
        if (!selectedGroupCode) return;

        const panel = el('cm-review-panel');
        const listEl = el('cm-review-list');
        const titleEl = el('cm-review-title');
        if (!panel || !listEl) return;

        titleEl.textContent = '\uD83D\uDCC4 Ответы: ' + (cadetName || cadetId);
        listEl.innerHTML = '<p class="loading-text">Загрузка...</p>';
        panel.classList.remove('hidden');
        panel.scrollIntoView({ behavior: 'smooth' });

        // Load this cadet's open answers with question details
        const { data, error } = await supabaseClient
            .from('student_open_answers')
            .select('id, question_id, answers, instructor_grade, instructor_comment, answered_at, open_answer_questions(text, answer_template, reference_answer, question_subtype, module_id)')
            .eq('cadet_id', cadetId)
            .eq('group_code', selectedGroupCode)
            .order('answered_at', { ascending: false });

        if (error) {
            listEl.innerHTML = '<p class="error-text">Ошибка загрузки: ' + escapeHtml(error.message) + '</p>';
            return;
        }

        if (!data || data.length === 0) {
            listEl.innerHTML = '<p class="empty-text">Курсант пока не отправлял развёрнутых ответов.</p>';
            return;
        }

        // Deduplicate: keep only latest answer per question_id
        const seen = {};
        const unique = [];
        data.forEach((row) => {
            if (!seen[row.question_id]) {
                seen[row.question_id] = true;
                unique.push(row);
            }
        });

        const subtypeIcons = {
            explanation: '\uD83D\uDCA1',
            calculation: '\uD83D\uDD22',
            scheme: '\uD83D\uDCCB',
            listing: '\uD83D\uDCDD'
        };

        let html = '';
        unique.forEach((row) => {
            const q = row.open_answer_questions;
            if (!q) return;

            const icon = subtypeIcons[q.question_subtype] || '\uD83D\uDCDD';
            const moduleMeta = allModules.find((m) => m.id === q.module_id);
            const moduleLabel = moduleMeta ? 'Модуль ' + moduleMeta.module_number : '';

            // Parse template
            let template = q.answer_template || [];
            if (typeof template === 'string') {
                try { template = JSON.parse(template); } catch(e) { template = []; }
            }
            if (!Array.isArray(template) || template.length === 0) {
                template = [{ label: 'Ответ', type: 'textarea' }];
            }

            const answers = row.answers || {};

            // Grade badge
            let gradeBadge = '';
            if (row.instructor_grade === 'accepted') {
                gradeBadge = '<span class="status-badge status-active">\u2705 Зачтено</span>';
            } else if (row.instructor_grade === 'needs_work') {
                gradeBadge = '<span class="status-badge cm-grade-needswork">\u270F На доработку</span>';
            } else {
                gradeBadge = '<span class="status-badge status-inactive">Не проверено</span>';
            }

            html += `
                <div class="cm-review-card">
                    <div class="cm-review-card-header">
                        <span>${icon} ${escapeHtml(moduleLabel)}</span>
                        ${gradeBadge}
                    </div>
                    <div class="cm-review-question">${escapeHtml(q.text)}</div>`;

            // Render each field: label + student answer
            template.forEach((field, idx) => {
                const key = 'field_' + idx;
                const val = answers[key] || '';
                const label = field.label || ('Поле ' + (idx + 1));

                html += `
                    <div class="cm-review-field">
                        <div class="cm-review-field-label">${escapeHtml(label)}</div>
                        <div class="cm-review-field-value">${val ? escapeHtml(val) : '<em style="color:#94a3b8;">Не заполнено</em>'}</div>
                    </div>`;
            });

            // Reference answer (instructor only)
            if (q.reference_answer) {
                html += `
                    <details class="cm-review-reference">
                        <summary>Эталонный ответ</summary>
                        <div>${escapeHtml(q.reference_answer)}</div>
                    </details>`;
            }

            // Instructor comment field + grade buttons
            html += `
                    <div class="cm-review-actions">
                        <input type="text" class="cm-comment-input" id="cm-comment-${row.id}"
                            placeholder="Комментарий инструктора..."
                            value="${escapeHtml(row.instructor_comment || '')}">
                        <div class="cm-review-btns">
                            <button class="btn-sm btn-success" data-action="grade-answer" data-answer-id="${row.id}" data-grade="accepted">\u2705 Зачтено</button>
                            <button class="btn-sm btn-warning" data-action="grade-answer" data-answer-id="${row.id}" data-grade="needs_work">\u270F На доработку</button>
                        </div>
                    </div>
                </div>`;
        });

        listEl.innerHTML = html;
    }

    async function gradeAnswer(answerId, grade) {
        const commentInput = el('cm-comment-' + answerId);
        const comment = commentInput ? commentInput.value.trim() : '';

        const updateData = {
            instructor_grade: grade,
            graded_at: new Date().toISOString()
        };
        if (comment) {
            updateData.instructor_comment = comment;
        }

        const { error } = await supabaseClient
            .from('student_open_answers')
            .update(updateData)
            .eq('id', answerId);

        if (error) {
            showToast('Ошибка: ' + error.message);
            return;
        }

        showToast(grade === 'accepted' ? 'Зачтено' : 'На доработку');

        // Re-render the badge for this card inline
        const btn = document.querySelector(`[data-answer-id="${answerId}"][data-grade="${grade}"]`);
        if (btn) {
            const card = btn.closest('.cm-review-card');
            if (card) {
                const header = card.querySelector('.cm-review-card-header');
                if (header) {
                    const oldBadge = header.querySelector('.status-badge');
                    if (oldBadge) {
                        if (grade === 'accepted') {
                            oldBadge.className = 'status-badge status-active';
                            oldBadge.textContent = '\u2705 Зачтено';
                        } else {
                            oldBadge.className = 'status-badge cm-grade-needswork';
                            oldBadge.textContent = '\u270F На доработку';
                        }
                    }
                }
            }
        }
    }

    function closeReview() {
        const panel = el('cm-review-panel');
        if (panel) panel.classList.add('hidden');
    }

    // ============================================
    // EVENT BINDING
    // ============================================

    function bindEvents() {
        // Group selector
        const groupSelect = el('cm-group-select');
        if (groupSelect) groupSelect.addEventListener('change', onGroupChange);

        // Level selector
        const levelSelect = el('cm-level-select');
        if (levelSelect) levelSelect.addEventListener('change', onLevelChange);

        // Delegated clicks on modules/sessions/cadets
        const container = el('section-course-management');
        if (container) {
            container.addEventListener('click', handleAction);
        }

        // Session modal is outside the section — bind separately
        const sessionModal = el('cm-session-modal');
        if (sessionModal) {
            sessionModal.addEventListener('click', handleAction);
        }

        // Session type change
        const typeSelect = el('cm-sf-type');
        if (typeSelect) typeSelect.addEventListener('change', onSessionTypeChange);
    }

    function handleAction(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;

        const action = btn.dataset.action;

        if (action === 'toggle-module') {
            toggleModule(btn.dataset.moduleId, btn.dataset.current);
        }
        if (action === 'open-block') {
            toggleBlock(btn.dataset.block);
        }
        if (action === 'new-session') {
            showSessionForm();
        }
        if (action === 'activate-session') {
            activateSession(btn.dataset.sessionId);
        }
        if (action === 'close-session') {
            closeSession(btn.dataset.sessionId);
        }
        if (action === 'delete-session') {
            deleteSession(btn.dataset.sessionId);
        }
        if (action === 'reset-cadet') {
            resetCadetResults(btn.dataset.cadetId);
        }
        if (action === 'save-session') {
            saveSession();
        }
        if (action === 'cancel-session') {
            closeSessionForm();
        }
        if (action === 'view-answers') {
            e.preventDefault();
            openCadetReview(btn.dataset.cadetId, btn.dataset.cadetName);
        }
        if (action === 'grade-answer') {
            gradeAnswer(btn.dataset.answerId, btn.dataset.grade);
        }
        if (action === 'close-review') {
            closeReview();
        }
    }

    // ============================================
    // TOAST (re-use existing if available)
    // ============================================

    function showToast(msg) {
        const t = el('toast');
        if (!t) { console.log('[CM]', msg); return; }
        t.textContent = msg;
        t.classList.add('visible');
        setTimeout(() => t.classList.remove('visible'), 3000);
    }

    // ============================================
    // EXPORT
    // ============================================

    return { init };
})();
