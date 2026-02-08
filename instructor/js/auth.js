// Instructor authentication module
// Login / logout / session check via Supabase Auth

const Auth = (() => {
    // DOM references (resolved after DOMContentLoaded)
    let els = {};

    function cacheElements() {
        els = {
            loginScreen: document.getElementById('login-screen'),
            dashboard: document.getElementById('dashboard'),
            loginForm: document.getElementById('login-form'),
            emailInput: document.getElementById('login-email'),
            passwordInput: document.getElementById('login-password'),
            loginBtn: document.getElementById('btn-login'),
            loginSpinner: document.getElementById('login-spinner'),
            loginBtnText: document.getElementById('login-btn-text'),
            loginError: document.getElementById('login-error'),
            userEmail: document.getElementById('user-email'),
            userInitial: document.getElementById('user-initial'),
        };
    }

    // --- Login ---
    async function login(email, password) {
        setLoading(true);
        hideError();

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            showError(mapAuthError(error.message));
            setLoading(false);
            return;
        }

        // Verify instructor role
        const role = data.user?.user_metadata?.role;
        if (role !== 'instructor') {
            await supabase.auth.signOut();
            showError('Access denied: instructor role required.');
            setLoading(false);
            return;
        }

        setLoading(false);
        showDashboard(data.user);
    }

    // --- Logout ---
    async function logout() {
        await supabase.auth.signOut();
        showLogin();
    }

    // --- Session check on page load ---
    async function checkSession() {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            showLogin();
            return;
        }

        const role = session.user?.user_metadata?.role;
        if (role !== 'instructor') {
            await supabase.auth.signOut();
            showLogin();
            return;
        }

        showDashboard(session.user);
    }

    // --- UI helpers ---
    function showDashboard(user) {
        els.loginScreen.classList.add('hidden');
        els.dashboard.classList.add('visible');

        const email = user.email || '';
        els.userEmail.textContent = email;
        els.userInitial.textContent = email.charAt(0).toUpperCase();

        App.init();
    }

    function showLogin() {
        els.dashboard.classList.remove('visible');
        els.loginScreen.classList.remove('hidden');
        els.emailInput.value = '';
        els.passwordInput.value = '';
        hideError();
    }

    function setLoading(on) {
        els.loginBtn.disabled = on;
        els.loginSpinner.style.display = on ? 'inline-block' : 'none';
        els.loginBtnText.textContent = on ? 'Вход...' : 'Войти';
    }

    function showError(msg) {
        els.loginError.textContent = msg;
        els.loginError.classList.add('visible');
    }

    function hideError() {
        els.loginError.textContent = '';
        els.loginError.classList.remove('visible');
    }

    function mapAuthError(msg) {
        if (msg.includes('Invalid login credentials')) {
            return 'Неверный email или пароль.';
        }
        if (msg.includes('Email not confirmed')) {
            return 'Email не подтверждён.';
        }
        return 'Ошибка входа. Попробуйте ещё раз.';
    }

    // --- Bootstrap ---
    function bindEvents() {
        els.loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = els.emailInput.value.trim();
            const password = els.passwordInput.value;
            if (email && password) {
                login(email, password);
            }
        });

        document.getElementById('btn-logout').addEventListener('click', logout);
    }

    function initAuth() {
        cacheElements();
        bindEvents();
        checkSession();
    }

    return { init: initAuth, logout };
})();
