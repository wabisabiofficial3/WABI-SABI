/**
 * Wabi Sabi — Community Space Dashboard Controller (js/dashboard.js)
 * Manages:
 * 1. Session verification & Header identity (Reader handle badge vs Curator's Desk pill)
 * 2. Hydration of Featured Book, Salons, and Prompts from WabiSabiStore
 * 3. User-writable handwriting sticky notes with editable headings and localStorage persistence
 * 4. Reader profile popover modal with Sign Out action
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Route guard: ensure reader or curator is signed in
    const session = window.WabiSabiStore ? window.WabiSabiStore.requireAuth() : null;
    if (!session) return; // Will redirect to index.html

    // 2. Hydrate Header with User details & role-specific actions
    const headerHandleBadge = document.getElementById('headerHandleBadge');
    const headerCuratorDeskBtn = document.getElementById('headerCuratorDeskBtn');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const headerUserAvatarImg = document.getElementById('headerUserAvatarImg');

    if (session.avatar && headerUserAvatarImg) {
        headerUserAvatarImg.src = session.avatar;
    }
    if (userProfileBtn) {
        userProfileBtn.title = `Signed in as ${session.name} (@${session.handle})`;
    }

    if (session.role === 'Curator') {
        if (headerHandleBadge) headerHandleBadge.style.display = 'none';
        if (headerCuratorDeskBtn) headerCuratorDeskBtn.style.display = 'flex';
    } else {
        if (headerHandleBadge) {
            headerHandleBadge.textContent = `@${session.handle}`;
            headerHandleBadge.style.display = 'inline-block';
        }
        if (headerCuratorDeskBtn) headerCuratorDeskBtn.style.display = 'none';
    }

    // 3. Hydrate Community Space Content (Featured Book, Salon, Prompts)
    function hydrateCommunitySpace() {
        if (!window.WabiSabiStore) return;
        const content = window.WabiSabiStore.getContent();

        // Featured Book
        if (content.featuredBook) {
            const fb = content.featuredBook;
            const titleEl = document.getElementById('featuredBookTitle');
            const authorEl = document.getElementById('featuredBookAuthor');
            const quoteEl = document.getElementById('featuredBookQuote');
            const readersEl = document.getElementById('readersCount');

            if (titleEl) titleEl.textContent = fb.title;
            if (authorEl) authorEl.textContent = fb.author;
            if (quoteEl) quoteEl.textContent = `"${fb.quote}"`;
            if (readersEl) readersEl.textContent = `+${(fb.readers / 1000).toFixed(1)}K reading together`;
        }

        // Upcoming Event
        if (content.upcomingEvent) {
            const ev = content.upcomingEvent;
            const titleEl = document.getElementById('upcomingEventTitle');
            const detailEl = document.getElementById('upcomingEventDetail');
            const attendeesEl = document.getElementById('eventAttendeesCount');
            const monthEl = document.querySelector('.event-calendar-badge .month');
            const dayEl = document.querySelector('.event-calendar-badge .day');

            if (titleEl) titleEl.textContent = ev.title;
            if (detailEl) detailEl.textContent = ev.detail;
            if (attendeesEl) attendeesEl.textContent = `+${ev.attendees} members attending`;
            if (monthEl && ev.month) monthEl.textContent = ev.month;
            if (dayEl && ev.day) dayEl.textContent = ev.day;
        }

        // Sticky Prompts (if any preset titles exist)
        if (content.stickyTitles) {
            const titles = content.stickyTitles;
            const booksTitle = document.querySelector('.sticky-title-text[data-category="books"]');
            const filmsTitle = document.querySelector('.sticky-title-text[data-category="films"]');
            const discussTitle = document.querySelector('.sticky-title-text[data-category="discuss"]');
            const communityTitle = document.querySelector('.sticky-title-text[data-category="community"]');

            if (booksTitle && titles.books && !localStorage.getItem('wabisabi_sticky_title_books')) {
                booksTitle.textContent = titles.books;
            }
            if (filmsTitle && titles.films && !localStorage.getItem('wabisabi_sticky_title_films')) {
                filmsTitle.textContent = titles.films;
            }
            if (discussTitle && titles.discuss && !localStorage.getItem('wabisabi_sticky_title_discuss')) {
                discussTitle.textContent = titles.discuss;
            }
            if (communityTitle && titles.community && !localStorage.getItem('wabisabi_sticky_title_community')) {
                communityTitle.textContent = titles.community;
            }
        }
    }

    hydrateCommunitySpace();

    // 4. Interactive User-Writable Sticky Notes with LocalStorage Persistence
    function initWritableStickyNotes() {
        const writingPads = document.querySelectorAll('.sticky-handwriting');
        const titlePads = document.querySelectorAll('.sticky-title-text');
        const pencilBtns = document.querySelectorAll('.sticky-pencil-indicator');

        // Sticky Note Body Handwriting
        writingPads.forEach(pad => {
            const category = pad.getAttribute('data-category');
            const storageKey = `wabisabi_sticky_${category}`;
            
            const savedText = localStorage.getItem(storageKey);
            if (savedText && savedText.trim().length > 0) {
                pad.textContent = savedText;
            }

            pad.addEventListener('input', () => {
                localStorage.setItem(storageKey, pad.textContent);
            });

            pad.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        });

        // Sticky Note Headings
        titlePads.forEach(titleEl => {
            const category = titleEl.getAttribute('data-category');
            const storageKey = `wabisabi_sticky_title_${category}`;
            
            const savedTitle = localStorage.getItem(storageKey);
            if (savedTitle && savedTitle.trim().length > 0) {
                titleEl.textContent = savedTitle;
            }

            titleEl.addEventListener('input', () => {
                localStorage.setItem(storageKey, titleEl.textContent);
            });

            titleEl.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            titleEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    titleEl.blur();
                }
            });
        });

        // Pencil click focuses heading for editing
        pencilBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const card = btn.closest('.sticky-note-card');
                if (card) {
                    const titleEl = card.querySelector('.sticky-title-text');
                    if (titleEl) {
                        titleEl.focus();
                        const range = document.createRange();
                        range.selectNodeContents(titleEl);
                        const sel = window.getSelection();
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            });
        });
    }

    initWritableStickyNotes();

    // 5. Reader Profile Popover Modal
    const modalBackdrop = document.getElementById('readerProfileModal');
    const modalCloseBtn = document.getElementById('profileModalCloseBtn');
    const modalSignOutBtn = document.getElementById('modalSignOutBtn');
    const modalCuratorDeskBtn = document.getElementById('modalCuratorDeskBtn');

    function openProfileModal() {
        if (!modalBackdrop) return;
        const nameEl = document.getElementById('modalUserName');
        const handleEl = document.getElementById('modalUserHandle');
        const roleEl = document.getElementById('modalUserRoleBadge');
        const sinceEl = document.getElementById('modalUserSince');
        const avatarEl = document.getElementById('modalUserAvatar');
        const interestsEl = document.getElementById('modalUserInterests');

        if (nameEl) nameEl.textContent = session.name;
        if (handleEl) handleEl.textContent = `@${session.handle}`;
        if (roleEl) {
            roleEl.textContent = session.role === 'Curator' ? '⚜ Curator' : '🌿 Reader';
            roleEl.className = session.role === 'Curator' ? 'profile-modal-role-badge badge-role-curator' : 'profile-modal-role-badge badge-role-reader';
        }
        if (sinceEl) sinceEl.textContent = `Member since: ${session.joinedDate || '2025'}`;
        if (avatarEl && session.avatar) avatarEl.src = session.avatar;

        if (interestsEl) {
            interestsEl.innerHTML = '';
            const list = session.interests && session.interests.length > 0 ? session.interests : ["Books", "Cinema", "Philosophy"];
            list.forEach(item => {
                const chip = document.createElement('span');
                chip.className = 'card-mini-chip';
                chip.textContent = item;
                interestsEl.appendChild(chip);
            });
        }

        if (modalCuratorDeskBtn) {
            modalCuratorDeskBtn.style.display = session.role === 'Curator' ? 'block' : 'none';
            modalCuratorDeskBtn.onclick = () => {
                window.location.href = 'curator.html';
            };
        }

        modalBackdrop.style.display = 'flex';
    }

    function closeProfileModal() {
        if (modalBackdrop) modalBackdrop.style.display = 'none';
    }

    if (userProfileBtn) {
        userProfileBtn.addEventListener('click', openProfileModal);
    }
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeProfileModal);
    }
    if (modalBackdrop) {
        modalBackdrop.addEventListener('click', (e) => {
            if (e.target === modalBackdrop) closeProfileModal();
        });
    }

    if (modalSignOutBtn) {
        modalSignOutBtn.addEventListener('click', () => {
            window.WabiSabiStore.logout();
        });
    }
});
