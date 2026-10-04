// Hidden curator entrance: five deliberate clicks on the Wabi Sabi brand mark.
// This only navigates to the existing sign-in page; server-side curator auth is unchanged.
(function () {
    const brandLogo = document.querySelector('.brand-logo');
    if (!brandLogo || brandLogo.dataset.adminShortcutBound === 'true') return;

    const STORAGE_KEY = 'wabi_admin_logo_taps';
    const REQUIRED_TAPS = 5;
    const MAX_GAP_MS = 15000;
    brandLogo.dataset.adminShortcutBound = 'true';

    brandLogo.addEventListener('click', (event) => {
        // Keep modified clicks and open-in-new-tab behavior native.
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const now = Date.now();
        let count = 0;
        let previousTapAt = 0;

        try {
            const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
            if (saved && Number.isInteger(saved.count) && Number.isFinite(saved.tappedAt) &&
                now >= saved.tappedAt && now - saved.tappedAt <= MAX_GAP_MS) {
                count = Math.max(0, Math.min(REQUIRED_TAPS - 1, saved.count));
                previousTapAt = saved.tappedAt;
            }
        } catch (error) {
            // The ordinary logo link remains usable when browser storage is unavailable.
        }

        count = previousTapAt ? count + 1 : 1;
        if (count >= REQUIRED_TAPS) {
            event.preventDefault();
            try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (error) {}
            window.location.assign('/sanctuary');
            return;
        }

        try {
            window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ count, tappedAt: now }));
        } catch (error) {
            // Session storage is only used to carry the tap count across normal page loads.
        }
    });
})();
