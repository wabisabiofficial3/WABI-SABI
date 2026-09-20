/**
 * Wabi Sabi — Core DataStore, Session & Identity Layer (js/store.js)
 * Single source of truth shared across:
 * - index.html (Auth)
 * - join.html (Onboarding)
 * - community.html (Community Space)
 * - curator.html (Curator's Desk)
 */

(function () {
    const STORAGE_KEY_SESSION = 'wabisabi_session';
    const STORAGE_KEY_ACCOUNTS = 'wabisabi_accounts_v3';
    const STORAGE_KEY_CONTENT = 'wabisabi_content_v3';
    const STORAGE_KEY_THEME = 'wabisabi_theme';

    // Seed Demo Accounts (Elena Vance as Reader, Dhanush as Curator)
    const DEFAULT_ACCOUNTS = [
        {
            name: "Elena Vance",
            email: "reader@wabisabi.club",
            password: "reader123",
            handle: "quietreader",
            role: "Reader",
            avatar: "assets/user_avatar.jpg",
            joinedDate: "Autumn 2025",
            interests: ["Books", "Cinema & Films", "Philosophy", "Solitude & Stillness"],
            intentions: ["Read more deeply without rush", "Have slower, kinder conversations"],
            contributions: ["Writing", "Book Recommendations"]
        },
        {
            name: "Dhanush",
            email: "curator@wabisabi.club",
            password: "curator123",
            handle: "curator",
            role: "Curator",
            avatar: "assets/user_avatar.jpg",
            joinedDate: "Founding Curator",
            interests: ["Books", "Cinema & Films", "Philosophy", "Art & Aesthetics", "Essays & Notes"],
            intentions: ["Curate a calmer internet", "Foster quiet minds"],
            contributions: ["Curation", "Community Architecture", "Gatherings"]
        }
    ];

    // Seed Content (Featured Pick, Salons, Prompts)
    const DEFAULT_CONTENT = {
        featuredBook: {
            title: "Atomic Habits",
            author: "James Clear",
            quote: "Small habits, quiet evenings, a brighter you.",
            cover: "assets/atomic_habits_cover.jpg",
            readers: 1240
        },
        upcomingEvent: {
            title: "Film & Literature Night",
            detail: "Interstellar & Solitude • 7:00 PM • Live Lounge",
            month: "Sep",
            day: "24",
            attendees: 324
        },
        stickyTitles: {
            books: "Reading Thoughts",
            films: "Cinema Notes",
            discuss: "Quiet Musings",
            community: "Open Letter"
        }
    };

    window.WabiSabiStore = {
        // --- Initialization & Data Access ---
        getAccounts() {
            const raw = localStorage.getItem(STORAGE_KEY_ACCOUNTS);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(DEFAULT_ACCOUNTS));
                return DEFAULT_ACCOUNTS;
            }
            try {
                return JSON.parse(raw);
            } catch (e) {
                return DEFAULT_ACCOUNTS;
            }
        },

        saveAccounts(accounts) {
            localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(accounts));
        },

        getContent() {
            const raw = localStorage.getItem(STORAGE_KEY_CONTENT);
            if (!raw) {
                localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(DEFAULT_CONTENT));
                return DEFAULT_CONTENT;
            }
            try {
                return Object.assign({}, DEFAULT_CONTENT, JSON.parse(raw));
            } catch (e) {
                return DEFAULT_CONTENT;
            }
        },

        saveContent(content) {
            localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(content));
        },

        updateFeaturedBook(bookData) {
            const content = this.getContent();
            content.featuredBook = Object.assign({}, content.featuredBook, bookData);
            this.saveContent(content);
        },

        updateUpcomingEvent(eventData) {
            const content = this.getContent();
            content.upcomingEvent = Object.assign({}, content.upcomingEvent, eventData);
            this.saveContent(content);
        },

        updateStickyTitles(titles) {
            const content = this.getContent();
            content.stickyTitles = Object.assign({}, content.stickyTitles, titles);
            this.saveContent(content);
        },

        // --- Session Management ---
        getSession() {
            const raw = localStorage.getItem(STORAGE_KEY_SESSION);
            if (!raw) return null;
            try {
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        },

        setSession(user) {
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(user));
        },

        clearSession() {
            localStorage.removeItem(STORAGE_KEY_SESSION);
        },

        login(email, password) {
            const accounts = this.getAccounts();
            const normalizedEmail = (email || '').trim().toLowerCase();
            const user = accounts.find(acc => acc.email.toLowerCase() === normalizedEmail && acc.password === password);
            if (user) {
                this.setSession(user);
                return { success: true, user };
            }
            return { success: false, message: "Invalid email or password. Please check your credentials." };
        },

        logout() {
            this.clearSession();
            window.location.href = 'index.html';
        },

        // --- Permanent Handle Rules & Live Validation ---
        // Rules:
        // 1. Letters only (a-z)
        // 2. No numbers, spaces, punctuation or special characters
        // 3. One or two words normalized as a single word (e.g. "quiet reader" -> "quietreader")
        // 4. Unique in community
        // 5. Strictly immutable once claimed
        normalizeHandle(input) {
            if (!input) return '';
            return input
                .toLowerCase()
                .trim()
                .replace(/\s+/g, '')       // merge spaces
                .replace(/[^a-z]/g, '');   // strip non-letters
        },

        validateHandle(rawInput) {
            const normalized = this.normalizeHandle(rawInput);
            // check if rawInput contains characters other than English letters or spaces
            const hasDisallowedChars = /[^a-zA-Z\s]/.test(rawInput);
            const lettersOnly = normalized.length > 0 && !hasDisallowedChars;
            const validLength = normalized.length >= 3 && normalized.length <= 20;

            const accounts = this.getAccounts();
            const isAvailable = !accounts.some(acc => acc.handle.toLowerCase() === normalized);

            return {
                normalized,
                lettersOnly,
                validLength,
                isAvailable,
                isPermanent: true,
                isValid: lettersOnly && validLength && isAvailable
            };
        },

        register(userData) {
            const val = this.validateHandle(userData.handle);
            if (!val.isValid) {
                return { success: false, message: "Handle does not satisfy all permanent handle rules." };
            }

            const accounts = this.getAccounts();
            const existingEmail = accounts.find(acc => acc.email.toLowerCase() === userData.email.trim().toLowerCase());
            if (existingEmail) {
                return { success: false, message: "An account with this email already belongs to the circle." };
            }

            const newUser = {
                name: userData.name.trim(),
                email: userData.email.trim().toLowerCase(),
                password: userData.password,
                handle: val.normalized,
                role: "Reader",
                avatar: "assets/user_avatar.jpg",
                joinedDate: "New Member",
                interests: userData.interests || [],
                intentions: userData.intentions || [],
                contributions: userData.contributions || []
            };

            accounts.push(newUser);
            this.saveAccounts(accounts);
            this.setSession(newUser);
            return { success: true, user: newUser };
        },

        // --- Route Guards ---
        requireAuth(allowedRoles) {
            const session = this.getSession();
            if (!session) {
                window.location.href = 'index.html';
                return null;
            }
            if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
                window.location.href = 'community.html';
                return null;
            }
            return session;
        },

        requireGuest() {
            const session = this.getSession();
            if (session) {
                window.location.href = 'community.html';
                return true;
            }
            return false;
        },

        // --- Theme System ---
        initTheme() {
            const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'light';
            document.documentElement.setAttribute('data-theme', savedTheme);
            return savedTheme;
        },

        toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem(STORAGE_KEY_THEME, next);
            return next;
        },

        bindThemeToggles() {
            const buttons = document.querySelectorAll('.theme-toggle-trigger, #themeToggleBtn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    this.toggleTheme();
                });
            });
        },

        // --- Toast Notifications ---
        showToast(message, duration = 3200) {
            let toast = document.getElementById('wabisabiToast');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'wabisabiToast';
                toast.style.cssText = `
                    position: fixed;
                    bottom: 26px;
                    left: 50%;
                    transform: translateX(-50%) translateY(40px);
                    background: var(--ink-primary, #181916);
                    color: var(--bg-paper, #F6F3EC);
                    padding: 10px 22px;
                    border-radius: 30px;
                    font-size: 13.5px;
                    font-family: var(--font-sans, sans-serif);
                    box-shadow: 0 10px 28px rgba(0,0,0,0.25);
                    z-index: 9999;
                    opacity: 0;
                    pointer-events: none;
                    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                `;
                document.body.appendChild(toast);
            }
            toast.textContent = message;
            requestAnimationFrame(() => {
                toast.style.opacity = '1';
                toast.style.transform = 'translateX(-50%) translateY(0)';
            });
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(-50%) translateY(40px)';
            }, duration);
        }
    };

    // Auto initialize theme on script load
    window.WabiSabiStore.initTheme();

    // Auto bind theme buttons on DOM ready
    window.addEventListener('DOMContentLoaded', () => {
        window.WabiSabiStore.bindThemeToggles();
    });
})();
