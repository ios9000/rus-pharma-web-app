// ============================================
// COURSE DATA — загрузка модулей и назначений
// js/course-data.js
// ============================================

(function() {
    'use strict';

    // State
    let modules = [];           // course_modules from Supabase
    let assignments = [];       // course_assignments for the current group
    let moduleQuestionMap = {}; // { moduleNumber: [question, ...] }
    let openAnswerCounts = {};  // { moduleNumber: count }
    let loaded = false;
    let _groupCode = null;

    // Competency ID normalization (old → new)
    const COMPETENCY_NORMALIZE = {
        'BASE_PHARMA': 'PHARMACOLOGY_BASICS'
    };

    function normalizeCompetencyId(id) {
        return COMPETENCY_NORMALIZE[id] || id;
    }

    // ============================================
    // ЗАГРУЗКА ДАННЫХ
    // ============================================

    /**
     * Load course data from Supabase + build question map from appData
     */
    async function loadCourseData(groupCode) {
        _groupCode = groupCode;

        // Build question map from existing appData first (always available)
        buildQuestionMapFromAppData();

        // Try loading from Supabase
        if (!window.supabaseClient) {
            console.warn('[CourseData] Supabase client not available, using appData only');
            loaded = true;
            return;
        }

        try {
            // Parallel requests
            const [modulesResult, assignmentsResult] = await Promise.all([
                window.supabaseClient
                    .from('course_modules')
                    .select('*')
                    .order('sort_order'),
                groupCode
                    ? window.supabaseClient
                        .from('course_assignments')
                        .select('*, course_modules(*)')
                        .eq('group_code', groupCode)
                    : Promise.resolve({ data: [], error: null })
            ]);

            if (modulesResult.error) {
                console.warn('[CourseData] Error loading modules:', modulesResult.error);
            } else {
                modules = modulesResult.data || [];
            }

            if (assignmentsResult.error) {
                console.warn('[CourseData] Error loading assignments:', assignmentsResult.error);
            } else {
                assignments = assignmentsResult.data || [];
            }

            // Load Supabase questions and merge + open answer counts
            await Promise.all([
                loadSupabaseQuestions(),
                loadOpenAnswerCounts()
            ]);

        } catch (err) {
            console.warn('[CourseData] Supabase unavailable, fallback to appData:', err);
        }

        loaded = true;
        console.log('[CourseData] Loaded:', {
            modules: modules.length,
            assignments: assignments.length,
            questionModules: Object.keys(moduleQuestionMap).length
        });
    }

    // ============================================
    // ПОСТРОЕНИЕ КАРТЫ ВОПРОСОВ
    // ============================================

    /**
     * Build question map from appData.questions grouped by q.module (1-20)
     */
    function buildQuestionMapFromAppData() {
        moduleQuestionMap = {};

        if (!window.appData || !window.appData.questions) return;

        window.appData.questions.forEach(function(q) {
            var mod = q.module;
            if (!mod || mod < 1 || mod > 20) return;

            // Normalize competency IDs
            if (q.competencyId) {
                q.competencyId = normalizeCompetencyId(q.competencyId);
            }
            if (q.competency) {
                q.competency = normalizeCompetencyId(q.competency);
            }

            if (!moduleQuestionMap[mod]) {
                moduleQuestionMap[mod] = [];
            }
            moduleQuestionMap[mod].push(q);
        });
    }

    /**
     * Load questions from Supabase questions table (with module_id set)
     * Normalize to appData format and merge without duplicates
     */
    async function loadSupabaseQuestions() {
        if (!window.supabaseClient) return;

        try {
            var result = await window.supabaseClient
                .from('questions')
                .select('*')
                .not('module_id', 'is', null);

            if (result.error || !result.data) {
                console.warn('[CourseData] Error loading Supabase questions:', result.error);
                return;
            }

            // Build a set of existing question IDs to avoid duplicates
            var existingIds = new Set();
            Object.values(moduleQuestionMap).forEach(function(questions) {
                questions.forEach(function(q) { existingIds.add(q.id); });
            });

            // Map module PK id → module_number
            var moduleIdToNumber = {};
            modules.forEach(function(m) {
                moduleIdToNumber[m.id] = m.module_number;
            });

            result.data.forEach(function(row) {
                if (existingIds.has(row.id)) return;

                var moduleNumber = moduleIdToNumber[row.module_id];
                if (!moduleNumber) return;

                // Normalize to appData question format
                var q = {
                    id: row.id,
                    question: row.question || row.text || '',
                    answers: row.answers || row.options || [],
                    correct: row.correct_answer !== undefined ? row.correct_answer : row.correct,
                    explanation: row.explanation || '',
                    imageUrl: row.image_url || '',
                    competency: normalizeCompetencyId(row.competency_id || ''),
                    competencyId: normalizeCompetencyId(row.competency_id || ''),
                    module: moduleNumber,
                    difficulty: row.difficulty || 1,
                    category: row.category || ''
                };

                if (!moduleQuestionMap[moduleNumber]) {
                    moduleQuestionMap[moduleNumber] = [];
                }
                moduleQuestionMap[moduleNumber].push(q);
                existingIds.add(q.id);
            });

        } catch (err) {
            console.warn('[CourseData] Error loading Supabase questions:', err);
        }
    }

    // ============================================
    // ЗАГРУЗКА КОЛИЧЕСТВА ЗАДАНИЙ С РАЗВЁРНУТЫМ ОТВЕТОМ
    // ============================================

    async function loadOpenAnswerCounts() {
        if (!window.supabaseClient) return;

        try {
            var result = await window.supabaseClient
                .from('open_answer_questions')
                .select('module_id');

            if (result.error || !result.data) {
                console.warn('[CourseData] Error loading open answer counts:', result.error);
                return;
            }

            // Map module PK id → module_number
            var moduleIdToNumber = {};
            modules.forEach(function(m) {
                moduleIdToNumber[m.id] = m.module_number;
            });

            // Count per module_number
            openAnswerCounts = {};
            result.data.forEach(function(row) {
                var moduleNumber = moduleIdToNumber[row.module_id];
                if (moduleNumber) {
                    openAnswerCounts[moduleNumber] = (openAnswerCounts[moduleNumber] || 0) + 1;
                }
            });
        } catch (err) {
            console.warn('[CourseData] Error loading open answer counts:', err);
        }
    }

    // ============================================
    // PUBLIC API
    // ============================================

    /**
     * Get open modules (assignments with status 'open')
     */
    function getOpenModules() {
        return assignments.filter(function(a) { return a.status === 'open'; });
    }

    /**
     * Get all assignments for the current group
     */
    function getAllAssignments() {
        return assignments;
    }

    /**
     * Get questions for a specific module number (1-20)
     */
    function getModuleQuestions(moduleNumber) {
        return moduleQuestionMap[moduleNumber] || [];
    }

    /**
     * Get all modules from Supabase, or fallback to MODULE_TO_COMPETENCY
     */
    function getAllModules() {
        if (modules.length > 0) return modules;

        // Fallback: build from MODULE_TO_COMPETENCY
        if (typeof MODULE_TO_COMPETENCY !== 'undefined') {
            return Object.keys(MODULE_TO_COMPETENCY).map(function(num) {
                var n = Number(num);
                var blockNum = n <= 6 ? 1 : n <= 13 ? 2 : n <= 18 ? 3 : 4;
                var blockNames = {
                    1: 'Фармакологические основы',
                    2: 'Специальные препараты и критические состояния',
                    3: 'Неотложные состояния',
                    4: 'Боевая травма'
                };
                var compId = MODULE_TO_COMPETENCY[num];
                var compConfig = (typeof COMPETENCIES_CONFIG !== 'undefined') ? COMPETENCIES_CONFIG[compId] : null;
                return {
                    id: n,
                    module_number: n,
                    block_number: blockNum,
                    block_name: blockNames[blockNum],
                    module_name: compConfig ? compConfig.name : ('Модуль ' + n),
                    sort_order: n
                };
            });
        }

        return [];
    }

    /**
     * Check if there are any open assignments for the current group
     */
    function hasAssignments() {
        return assignments.length > 0 && assignments.some(function(a) {
            return a.status === 'open';
        });
    }

    /**
     * Check if course data is loaded
     */
    function isLoaded() {
        return loaded;
    }

    /**
     * Get open answer question count for a module number
     */
    function getOpenAnswerCount(moduleNumber) {
        return openAnswerCounts[moduleNumber] || 0;
    }

    // Export
    window.CourseData = {
        loadCourseData: loadCourseData,
        getOpenModules: getOpenModules,
        getAllAssignments: getAllAssignments,
        getModuleQuestions: getModuleQuestions,
        getAllModules: getAllModules,
        hasAssignments: hasAssignments,
        isLoaded: isLoaded,
        getOpenAnswerCount: getOpenAnswerCount
    };

})();
