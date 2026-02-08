// Instructor dashboard application routing
// Handles navigation between sections (questions, drugs, etc.)

const App = (() => {
    let initialized = false;

    let questionsReady = false;
    let drugsReady = false;
    let groupsReady = false;
    let cadetsReady = false;
    let instructorsReady = false;

    function init() {
        if (initialized) return;
        initialized = true;

        bindNavigation();
        bindMobileMenu();
        navigate('overview');
    }

    // --- Section navigation ---
    function navigate(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach((s) => {
            s.classList.remove('active');
        });

        // Deactivate all nav items
        document.querySelectorAll('.nav-item[data-section]').forEach((n) => {
            n.classList.remove('active');
        });

        // Show target section
        const target = document.getElementById('section-' + sectionId);
        if (target) {
            target.classList.add('active');
        }

        // Highlight nav item
        const navItem = document.querySelector(`.nav-item[data-section="${sectionId}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        // Lazy-init section modules
        if (sectionId === 'overview') {
            loadOverviewStats();
        }
        if (sectionId === 'questions' && !questionsReady) {
            questionsReady = true;
            Questions.init();
        }
        if (sectionId === 'drugs' && !drugsReady) {
            drugsReady = true;
            Drugs.init();
        }
        if (sectionId === 'groups' && !groupsReady) {
            groupsReady = true;
            Groups.init();
        }
        if (sectionId === 'cadets') {
            if (!groupsReady) { groupsReady = true; Groups.init(); }
            if (!cadetsReady) { cadetsReady = true; Cadets.init(); }
        }
        if (sectionId === 'instructors' && !instructorsReady) {
            instructorsReady = true;
            Instructors.init();
        }

        // Close mobile sidebar on navigation
        closeMobileMenu();
    }

    function bindNavigation() {
        document.querySelectorAll('.nav-item[data-section]').forEach((item) => {
            item.addEventListener('click', () => {
                navigate(item.dataset.section);
            });
        });
    }

    // --- Mobile menu ---
    function bindMobileMenu() {
        const toggleBtn = document.getElementById('btn-menu-toggle');
        const overlay = document.getElementById('sidebar-overlay');

        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleMobileMenu);
        }
        if (overlay) {
            overlay.addEventListener('click', closeMobileMenu);
        }
    }

    function toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.toggle('open');
        overlay.classList.toggle('visible');
    }

    function closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        sidebar.classList.remove('open');
        overlay.classList.remove('visible');
    }

    // --- Overview stats ---
    async function loadOverviewStats() {
        const [qRes, dRes, cRes, gRes, cadRes, iRes] = await Promise.all([
            supabaseClient.from('questions').select('id', { count: 'exact', head: true }),
            supabaseClient.from('drugs').select('id', { count: 'exact', head: true }),
            supabaseClient.from('competencies').select('id', { count: 'exact', head: true }),
            supabaseClient.from('groups').select('code', { count: 'exact', head: true }),
            supabaseClient.from('cadets').select('id', { count: 'exact', head: true }),
            supabaseClient.from('instructors').select('id', { count: 'exact', head: true }),
        ]);

        const stats = {
            'stat-questions': qRes.count,
            'stat-drugs': dRes.count,
            'stat-competencies': cRes.count,
            'stat-groups': gRes.count,
            'stat-cadets': cadRes.count,
            'stat-instructors': iRes.count,
        };

        for (const [id, val] of Object.entries(stats)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val ?? '—';
        }
    }

    return { init, navigate };
})();

// --- Bootstrap on DOM ready ---
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
