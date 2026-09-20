/**
 * Wabi Sabi — Authentication Page Controller (js/auth.js)
 * Manages:
 * 1. Guest check & session routing
 * 2. Password visibility toggle
 * 3. Login form validation & credentials check against WabiSabiStore
 * 4. Quick evaluation demo pills
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. If already logged in, seamlessly forward to Community Space
    if (window.WabiSabiStore && window.WabiSabiStore.requireGuest()) {
        return;
    }

    const loginForm = document.getElementById('authLoginForm');
    const emailInput = document.getElementById('authEmailInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const togglePassBtn = document.getElementById('authTogglePasswordBtn');
    const eyeOpen = togglePassBtn ? togglePassBtn.querySelector('.eye-open') : null;
    const eyeClosed = togglePassBtn ? togglePassBtn.querySelector('.eye-closed') : null;
    const errorBanner = document.getElementById('authErrorBanner');
    const demoReaderBtn = document.getElementById('demoReaderBtn');
    const demoCuratorBtn = document.getElementById('demoCuratorBtn');

    // 2. Password visibility toggle
    if (togglePassBtn && passwordInput) {
        togglePassBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const isPassword = passwordInput.getAttribute('type') === 'password';
            passwordInput.setAttribute('type', isPassword ? 'text' : 'password');
            if (eyeOpen) eyeOpen.style.display = isPassword ? 'none' : 'block';
            if (eyeClosed) eyeClosed.style.display = isPassword ? 'block' : 'none';
        });
    }

    // 3. Form submission
    function handleLogin(email, password) {
        if (!email || !password) {
            showError("Please enter both email address and password.");
            return;
        }

        const res = window.WabiSabiStore.login(email, password);
        if (res.success) {
            hideError();
            window.WabiSabiStore.showToast(`Welcome back, ${res.user.name}.`);
            setTimeout(() => {
                window.location.href = 'community.html';
            }, 300);
        } else {
            showError(res.message || "Invalid credentials. Please verify your email and password.");
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            handleLogin(emailInput.value, passwordInput.value);
        });
    }

    function showError(msg) {
        if (errorBanner) {
            errorBanner.textContent = msg;
            errorBanner.style.display = 'flex';
        }
    }

    function hideError() {
        if (errorBanner) {
            errorBanner.style.display = 'none';
            errorBanner.textContent = '';
        }
    }

    // 4. Quick Demo Pills
    if (demoReaderBtn && emailInput && passwordInput) {
        demoReaderBtn.addEventListener('click', () => {
            emailInput.value = 'reader@wabisabi.club';
            passwordInput.value = 'reader123';
            hideError();
            handleLogin('reader@wabisabi.club', 'reader123');
        });
    }

    if (demoCuratorBtn && emailInput && passwordInput) {
        demoCuratorBtn.addEventListener('click', () => {
            emailInput.value = 'curator@wabisabi.club';
            passwordInput.value = 'curator123';
            hideError();
            handleLogin('curator@wabisabi.club', 'curator123');
        });
    }

    // 5. About Us Full Story Reading Modal
    const openAboutBtn = document.getElementById('openAboutStoryBtn');
    const footerTurnBtn = document.getElementById('footerTurnPageBtn');
    const closeAboutBtn = document.getElementById('closeAboutStoryBtn');
    const storyModal = document.getElementById('aboutStoryModal');

    function openStoryModal() {
        if (storyModal) storyModal.style.display = 'flex';
    }

    function closeStoryModal() {
        if (storyModal) storyModal.style.display = 'none';
    }

    if (openAboutBtn) openAboutBtn.addEventListener('click', openStoryModal);
    if (footerTurnBtn) footerTurnBtn.addEventListener('click', openStoryModal);
    if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeStoryModal);
    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) closeStoryModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeStoryModal();
    });
});
