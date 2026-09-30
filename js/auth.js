/**
 * Wabi Sabi — Authentication Page Controller (js/auth.js)
 * Manages:
 * 1. Guest check & session routing
 * 2. Password visibility toggle
 * 3. Login form submission to server /api/auth/login with Argon2id verification
 * 4. Automatic server-directed routing (/curator.html, /community.html, /application-status.html)
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. If already logged in, seamlessly forward according to role/status
    if (window.WabiSabiStore && await window.WabiSabiStore.requireGuest()) {
        return;
    }

    const loginForm = document.getElementById('authLoginForm');
    const emailInput = document.getElementById('authEmailInput');
    const passwordInput = document.getElementById('authPasswordInput');
    const submitBtn = document.getElementById('authSubmitBtn');
    const togglePassBtn = document.getElementById('authTogglePasswordBtn');
    const eyeOpen = togglePassBtn ? togglePassBtn.querySelector('.eye-open') : null;
    const eyeClosed = togglePassBtn ? togglePassBtn.querySelector('.eye-closed') : null;
    const errorBanner = document.getElementById('authErrorBanner');

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

    // 3. Form submission to /api/auth/login
    async function handleLogin(email, password) {
        if (!email || !password) {
            showError("Please enter both your email address and password.");
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.7';
        }

        const res = await window.WabiSabiStore.login(email, password);

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }

        if (res.success) {
            hideError();
            const name = res.user.displayName || res.user.name || 'friend';
            window.WabiSabiStore.showToast(`Welcome back, ${name}.`);
            setTimeout(() => {
                window.location.href = res.redirectUrl || 'curator.html';
            }, 350);
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

    // 4. About Us Full Story Reading Modal
    const openAboutBtn = document.getElementById('openAboutStoryBtn');
    const closeAboutBtn = document.getElementById('closeAboutStoryBtn');
    const storyModal = document.getElementById('aboutStoryModal');

    function openStoryModal() {
        if (storyModal) storyModal.style.display = 'flex';
    }

    function closeStoryModal() {
        if (storyModal) storyModal.style.display = 'none';
    }

    if (openAboutBtn) openAboutBtn.addEventListener('click', openStoryModal);
    if (closeAboutBtn) closeAboutBtn.addEventListener('click', closeStoryModal);
    if (storyModal) {
        storyModal.addEventListener('click', (e) => {
            if (e.target === storyModal) closeStoryModal();
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeStoryModal();
    });

    // 5. Responsive Collage Canvas Scale Controller (fits width & height without clipping)
    function updateCollageScale() {
        const wrapper = document.querySelector('.auth-collage-wrapper');
        const canvas = document.querySelector('.auth-collage-canvas');
        const header = document.querySelector('.auth-header');
        const footer = document.querySelector('.auth-footer-bar');
        const stage = document.querySelector('.auth-stage');
        if (!wrapper || !canvas) return;
        
        const availW = wrapper.clientWidth || 640;
        
        // Compute real available vertical height between header and footer
        const vh = window.innerHeight;
        const headerH = header ? header.offsetHeight : 54;
        const footerH = footer ? footer.offsetHeight : 44;
        const stageAvailH = stage ? stage.clientHeight : (vh - headerH - footerH - 24);
        const availH = Math.min(stageAvailH, vh - headerH - footerH - 20);
        
        const scaleW = Math.min(1, availW / 640);
        const scaleH = availH > 200 ? Math.min(1, availH / 540) : 1;
        const scale = Math.max(0.48, Math.min(scaleW, scaleH));

        if (scale < 0.99) {
            canvas.style.setProperty('--canvas-scale', scale.toFixed(4));
        } else {
            canvas.style.removeProperty('--canvas-scale');
        }
    }
    window.addEventListener('resize', updateCollageScale, { passive: true });
    window.addEventListener('orientationchange', updateCollageScale, { passive: true });
    updateCollageScale();
});
