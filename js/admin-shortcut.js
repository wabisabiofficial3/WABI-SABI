// Hidden curator entrance: five deliberate clicks on the Wabi Sabi brand mark.
// This only navigates to the existing sign-in page; server-side curator auth is unchanged.
(function () {
    const brandLogo = document.querySelector('.brand-logo');
    if (!brandLogo || brandLogo.dataset.adminShortcutBound === 'true') return;

    const STORAGE_KEY = 'wabi_admin_logo_taps';
    const REQUIRED_TAPS = 5;
    const MAX_GAP_MS = 15000;
    const HOME_PATHS = new Set([
        '/', '/home', '/home.html', '/index.html', '/dashboard', '/dashboard.html', '/pages/home.html'
    ]);
    let inMemoryTap = { count: 0, tappedAt: 0 };

    brandLogo.dataset.adminShortcutBound = 'true';

    function readTapState(now) {
        let state = { count: 0, tappedAt: 0 };
        if (inMemoryTap.tappedAt > 0 && now >= inMemoryTap.tappedAt &&
            now - inMemoryTap.tappedAt <= MAX_GAP_MS) {
            state = inMemoryTap;
        }

        try {
            const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
            if (saved && Number.isInteger(saved.count) && saved.count > 0 && saved.count < REQUIRED_TAPS &&
                Number.isFinite(saved.tappedAt) && saved.tappedAt > 0 && now >= saved.tappedAt &&
                now - saved.tappedAt <= MAX_GAP_MS &&
                (saved.tappedAt > state.tappedAt || (saved.tappedAt === state.tappedAt && saved.count > state.count))) {
                state = { count: saved.count, tappedAt: saved.tappedAt };
            }
        } catch (error) {
            // In-memory counting still works on the home page when storage is unavailable.
        }

        return state;
    }

    function clearTapState() {
        inMemoryTap = { count: 0, tappedAt: 0 };
        try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (error) {}
    }

    brandLogo.addEventListener('click', (event) => {
        // Keep modified clicks and open-in-new-tab behavior native.
        if ((typeof event.button === 'number' && event.button !== 0) ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const now = Date.now();
        const previous = readTapState(now);
        const count = previous.tappedAt > 0 && now - previous.tappedAt <= MAX_GAP_MS
            ? previous.count + 1
            : 1;
        inMemoryTap = { count, tappedAt: now };

        if (count >= REQUIRED_TAPS) {
            event.preventDefault();
            clearTapState();
            window.location.assign('/sanctuary');
            return;
        }

        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count, tappedAt: now }));
        } catch (error) {
            // Session storage carries taps across the initial home navigation when available.
        }

        // On a home route the logo already points to the current page. Avoid reloading it
        // between taps so the five-click shortcut also works when browser storage is blocked.
        if (HOME_PATHS.has(window.location.pathname)) event.preventDefault();
    });
})();
