/**
 * Wabi Sabi — Community Space Dashboard Controller (js/dashboard.js)
 * Manages:
 * 1. Session verification & Header identity (Reader handle badge vs Curator's Desk pill)
 * 2. Hydration of Featured Book, Salons, and Prompts from WabiSabiStore
 * 3. User-writable handwriting sticky notes with editable headings and localStorage persistence
 * 4. Reader profile popover modal with Sign Out action
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Route guard: ensure member or curator is signed in and active
    const session = window.WabiSabiStore ? await window.WabiSabiStore.requireAuth(['USER', 'CURATOR', 'Reader', 'Curator']) : null;
    if (!session) return; // Will redirect to login.html or application-status.html

    const isCurator = session.role === 'CURATOR' || session.role === 'Curator';
    const memberName = session.displayName || session.name || 'Member';

    function safeAvatarUrl(value) {
        const fallback = '/assets/user_avatar.jpg';
        if (typeof value !== 'string' || !value.trim()) return fallback;
        try {
            const parsed = new URL(value.trim(), window.location.href);
            if (parsed.username || parsed.password) return fallback;
            const isLocalAsset = parsed.origin === window.location.origin
                && parsed.pathname.startsWith('/assets/')
                && !parsed.pathname.split('/').includes('..');
            if (isLocalAsset) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
            if (parsed.protocol === 'https:') return parsed.href;
        } catch (error) {
            return fallback;
        }
        return fallback;
    }

    // 2. Hydrate Header with User details & role-specific actions
    const headerHandleBadge = document.getElementById('headerHandleBadge');
    const headerCuratorDeskBtn = document.getElementById('headerCuratorDeskBtn');
    const userProfileBtn = document.getElementById('userProfileBtn');
    const headerUserAvatarImg = document.getElementById('headerUserAvatarImg');

    if (session.avatar && headerUserAvatarImg) {
        headerUserAvatarImg.src = safeAvatarUrl(session.avatar);
    }
    if (userProfileBtn) {
        userProfileBtn.title = `Signed in as ${memberName} (@${session.handle})`;
    }

    if (isCurator) {
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

    // 3b. Interactive Side Cards (Bookclub Pick -> reader.html, Gathering -> table-room.html)
    const todaysPickCard = document.getElementById('todaysPickCard');
    if (todaysPickCard) {
        todaysPickCard.style.cursor = 'pointer';
        todaysPickCard.addEventListener('click', () => {
            window.location.href = 'reader.html';
        });
    }

    const happeningSoonCard = document.getElementById('happeningSoonCard');
    if (happeningSoonCard) {
        happeningSoonCard.addEventListener('click', () => {
            window.location.href = 'table-room.html';
        });
    }

    // 3c. Global Desk Search Bar
    const deskSearchInput = document.querySelector('.search-pill');
    if (deskSearchInput) {
        deskSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && deskSearchInput.value.trim().length > 0) {
                const query = deskSearchInput.value.trim().toLowerCase();
                const stickyNotes = document.querySelectorAll('.sticky-note-card');
                let foundCount = 0;
                stickyNotes.forEach(note => {
                    const text = (note.textContent || '').toLowerCase();
                    if (text.includes(query)) {
                        foundCount++;
                        note.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
                        note.style.boxShadow = '0 0 0 3px var(--accent-sage, #2C4837), 0 12px 28px rgba(0,0,0,0.18)';
                        note.style.transform = 'scale(1.05)';
                        setTimeout(() => {
                            note.style.boxShadow = '';
                            note.style.transform = '';
                        }, 3000);
                    }
                });
                if (foundCount > 0) {
                    if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                        window.WabiSabiStore.showToast(`Found ${foundCount} highlighted reflection${foundCount > 1 ? 's' : ''} on your desk.`);
                    }
                } else {
                    window.location.href = `community.html?search=${encodeURIComponent(query)}`;
                }
            }
        });
    }

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

        if (nameEl) nameEl.textContent = memberName;
        if (handleEl) handleEl.textContent = `@${session.handle}`;
        if (roleEl) {
            roleEl.textContent = isCurator ? '⚜ Curator' : '🌿 Reader';
            roleEl.className = isCurator ? 'profile-modal-role-badge badge-role-curator' : 'profile-modal-role-badge badge-role-reader';
        }
        if (sinceEl) sinceEl.textContent = `Member since: ${session.joinedDate || '2025'}`;
        if (avatarEl && session.avatar) avatarEl.src = safeAvatarUrl(session.avatar);

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
            modalCuratorDeskBtn.style.display = isCurator ? 'block' : 'none';
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

    // =========================================================================
    // 6. DYNAMIC DOCK NAVIGATION & SECTION CONTROLLER
    // Makes Home, Community, Reading, Table Room, Theme Weeks, Wabi Wall,
    // Events, and Library fully functional and reactive.
    // =========================================================================
    const SECTIONS = {
        'home': {
            label: 'Home',
            eyebrow: 'The Wabi Sabi Bookclub • Vol. 1 • Same Stories, Different People',
            headline: 'Read<br>Watch<br>Discuss<br><span class="word-grow">Grow —</span>',
            tagline: 'Books, films, conversations and people who see the world a little differently.',
            toast: '✦ Welcome Home to Wabi Sabi',
            focusNotes: ['books', 'films', 'discussions', 'community'],
            focusCards: []
        },
        'reading': {
            label: 'Reading',
            eyebrow: 'Curated Reading • Chapter & Verse',
            headline: 'Slow Down.<br>Turn the<br><span class="word-grow">Page —</span>',
            tagline: 'Immerse in timeless words, handwritten reflections, and perspectives that take root and linger.',
            toast: '✦ Reading Space Active',
            focusNotes: ['books'],
            focusCards: ['todaysPickCard']
        },
        'table-room': {
            label: 'Table Room',
            eyebrow: 'The Table Room • Intimate Dialogue & Salons',
            headline: 'Pull Up<br>A Chair.<br><span class="word-grow">Listen —</span>',
            tagline: 'Conversations held with patience, without judgment. We gather to share how stories touched us.',
            toast: '✦ Table Room Open',
            focusNotes: ['discussions'],
            focusCards: ['happeningSoonCard']
        },
        'community': {
            label: 'Community',
            eyebrow: 'The Circle • Readers & Kindred Souls',
            headline: 'Kindred Souls.<br>Quiet Minds.<br><span class="word-grow">Belong —</span>',
            tagline: 'Kindred souls who feel the quiet rhythm of life. A peaceful haven free from noise and algorithmic distraction.',
            toast: '✦ Community Circle Focused',
            focusNotes: ['community'],
            focusCards: []
        },
        'theme-weeks': {
            label: 'Theme Weeks',
            eyebrow: 'Theme Weeks • Vol. 1: Cinema of Solitude',
            headline: 'Solitude.<br>Silence.<br><span class="word-grow">Cinema —</span>',
            tagline: 'Quiet frames that open unexpected rooms in the mind. Exploring solitude, memory, and cinematic reflection.',
            toast: '✦ Theme Week: Cinema & Solitude',
            focusNotes: ['films'],
            focusCards: ['happeningSoonCard']
        },
        'wabi-wall': {
            label: 'Wabi Wall',
            eyebrow: 'The Wabi Wall • Living Mosaic & Community Gatherings',
            headline: 'Leaves of<br>Thought &<br><span class="word-grow">Gatherings —</span>',
            tagline: 'Shared reflections and handwritten thoughts pinned by members, alongside intimate upcoming evening salons under warm amber light.',
            toast: '✦ Wabi Wall & Gatherings Focused',
            focusNotes: ['books', 'films', 'discussions', 'community'],
            focusCards: ['happeningSoonCard']
        },
        'events': {
            label: 'Wabi Wall',
            eyebrow: 'The Wabi Wall • Living Mosaic & Community Gatherings',
            headline: 'Leaves of<br>Thought &<br><span class="word-grow">Gatherings —</span>',
            tagline: 'Shared reflections and handwritten thoughts pinned by members, alongside intimate upcoming evening salons under warm amber light.',
            toast: '✦ Wabi Wall & Gatherings Focused',
            focusNotes: ['books', 'films', 'discussions', 'community'],
            focusCards: ['happeningSoonCard']
        },
        'library': {
            label: 'Library',
            eyebrow: 'The Wabi Sabi Library • Curated Shelf',
            headline: 'Read.<br>Reflect.<br><span class="word-grow">Return —</span>',
            tagline: 'Books, films, conversations and people who see the world a little differently.',
            toast: '✦ Library Selections Active',
            focusNotes: ['books'],
            focusCards: ['todaysPickCard']
        }
    };

    const heroStatement = document.querySelector('.hero-statement');
    const heroEyebrow = document.querySelector('.hero-eyebrow');
    const heroHeadline = document.querySelector('.hero-headline');
    const heroTagline = document.getElementById('heroTagline');
    const stickyNotes = document.querySelectorAll('.sticky-note-card');
    const sideCards = document.querySelectorAll('.side-card');
    const dockItems = document.querySelectorAll('.dock-item');

    function switchSection(tabKey, showToastNotification = true) {
        const sec = SECTIONS[tabKey] || SECTIONS['home'];

        // 1. Update Active Dock Item
        dockItems.forEach(d => {
            const itemKey = d.getAttribute('data-tab');
            if (itemKey === tabKey) {
                d.classList.add('active');
            } else {
                d.classList.remove('active');
            }
        });

        // 2. Smoothly Update Hero Statement
        if (heroStatement) {
            heroStatement.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
            heroStatement.style.opacity = '0';
            heroStatement.style.transform = 'translateY(4px)';

            setTimeout(() => {
                if (heroEyebrow) heroEyebrow.textContent = sec.eyebrow;
                if (heroHeadline) heroHeadline.innerHTML = sec.headline;
                if (heroTagline) heroTagline.textContent = sec.tagline;

                heroStatement.style.opacity = '1';
                heroStatement.style.transform = 'translateY(0)';
            }, 180);
        }

        // 3. Emphasize / Spotlight Sticky Notes
        stickyNotes.forEach(note => {
            const noteId = note.getAttribute('data-note-id');
            note.classList.remove('dock-focused', 'dock-dimmed');

            if (tabKey === 'home' || tabKey === 'wabi-wall') {
                // All notes are equally balanced
            } else if (sec.focusNotes.includes(noteId)) {
                note.classList.add('dock-focused');
            } else {
                note.classList.add('dock-dimmed');
            }
        });

        // 4. Spotlight Relevant Side Cards
        sideCards.forEach(card => {
            card.classList.remove('dock-focused');
            if (sec.focusCards.includes(card.id)) {
                card.classList.add('dock-focused');
            }
        });

        // 5. Toast Feedback
        if (showToastNotification && window.WabiSabiStore && window.WabiSabiStore.showToast) {
            window.WabiSabiStore.showToast(sec.toast);
        }

        // 6. Update URL Hash seamlessly without scrolling
        if (history.replaceState) {
            history.replaceState(null, null, `#${tabKey}`);
        }
    }

    // Attach click listeners to dock items
    dockItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const tabKey = item.getAttribute('data-tab') || 'home';
            if (tabKey === 'reading') {
                // Navigate directly to reader.html in the same tab
                window.location.href = 'reader.html';
                return;
            }
            if (tabKey === 'table-room') {
                // Navigate directly to table-room.html in the same tab
                window.location.href = 'table-room.html';
                return;
            }
            if (tabKey === 'community') {
                // Navigate directly to community.html in the same tab
                window.location.href = 'community.html';
                return;
            }
            if (tabKey === 'theme-weeks') {
                // Navigate directly to wabi-wall.html
                window.location.href = 'wabi-wall.html';
                return;
            }
            if (tabKey === 'wabi-wall') {
                // Navigate directly to wabi-wall.html in the same tab
                window.location.href = 'wabi-wall.html';
                return;
            }
            e.preventDefault();
            switchSection(tabKey, true);
        });
    });

    // Handle initial hash routing if present
    const initialHash = window.location.hash ? window.location.hash.replace('#', '') : 'home';
    if (SECTIONS[initialHash]) {
        switchSection(initialHash, false);
    } else {
        switchSection('home', false);
    }

    // CTAs interaction & Intro Sanctuary Modal
    const getStartedBtn = document.getElementById('getStartedBtn');
    const watchIntroBtn = document.getElementById('watchIntroBtn');
    const introStoryModal = document.getElementById('introStoryModal');
    const introModalCloseBtn = document.getElementById('introModalCloseBtn');
    const introModalDismissBtn = document.getElementById('introModalDismissBtn');

    function openIntroModal() {
        if (introStoryModal) introStoryModal.style.display = 'flex';
    }

    function closeIntroModal() {
        if (introStoryModal) introStoryModal.style.display = 'none';
    }

    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('✦ Entering Reading Sanctuary...');
            }
            setTimeout(() => {
                window.location.href = 'reader.html';
            }, 300);
        });
    }

    if (watchIntroBtn) {
        watchIntroBtn.addEventListener('click', openIntroModal);
    }
    if (introModalCloseBtn) introModalCloseBtn.addEventListener('click', closeIntroModal);
    if (introModalDismissBtn) introModalDismissBtn.addEventListener('click', closeIntroModal);
    if (introStoryModal) {
        introStoryModal.addEventListener('click', (e) => {
            if (e.target === introStoryModal) closeIntroModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && introStoryModal && introStoryModal.style.display !== 'none') {
            closeIntroModal();
        }
    });

    // =========================================================================
    // 7. RESPONSIVE VIEWPORT COHESION (WCAG 2.1 Compliant)
    // Allows natural user magnification and responsive clamp adjustments
    // without hijacking browser trackpad gestures or browser zoom.
    // =========================================================================

    // =========================================================================
    // 8. INTERACTIVE DESK DOODLE CANVAS ENGINE
    // Freehand organic sumi ink drawing directly across desk paper
    // - Smooth bezier curve interpolation
    // - 4 Japanese botanical ink colors (Sumi, Sage, Terracotta, Lavender)
    // - LocalStorage persistence of hand doodles
    // =========================================================================
    const doodleCanvas = document.getElementById('deskDoodleCanvas');
    if (doodleCanvas) {
        let currentColor = '#231E19';
        let currentStroke = [];
        let allStrokes = [];

        // Resize canvas with devicePixelRatio for ultra-crisp ink
        function resizeDoodleCanvas() {
            const dpr = window.devicePixelRatio || 1;
            const w = window.innerWidth;
            const h = window.innerHeight;
            doodleCanvas.width = w * dpr;
            doodleCanvas.height = h * dpr;
            doodleCanvas.style.width = w + 'px';
            doodleCanvas.style.height = h + 'px';
            ctx.scale(dpr, dpr);
            redrawAllStrokes();
        }

        function setDoodleMode(active) {
            isDoodleActive = active;
            if (active) {
                doodleCanvas.classList.add('drawing-active');
                if (doodleToggleBtn) doodleToggleBtn.classList.add('active');
            } else {
                doodleCanvas.classList.remove('drawing-active');
                if (doodleToggleBtn) doodleToggleBtn.classList.remove('active');
            }
        }

        // Draw a smooth bezier stroke
        function drawCurve(stroke) {
            if (!stroke.points || stroke.points.length < 2) return;
            ctx.save();
            ctx.strokeStyle = stroke.color || '#231E19';
            ctx.lineWidth = stroke.width || 2.4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

            for (let i = 1; i < stroke.points.length - 1; i++) {
                const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
            }
            const last = stroke.points[stroke.points.length - 1];
            ctx.lineTo(last.x, last.y);
            ctx.stroke();
            ctx.restore();
        }

        function redrawAllStrokes() {
            ctx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
            allStrokes.forEach(s => drawCurve(s));
        }

        function saveStrokes() {
            try {
                localStorage.setItem('wabisabi_desk_doodles', JSON.stringify(allStrokes));
            } catch (err) {}
        }

        function loadStrokes() {
            try {
                const saved = localStorage.getItem('wabisabi_desk_doodles');
                if (saved) {
                    allStrokes = JSON.parse(saved);
                    redrawAllStrokes();
                } else {
                    // Delightful initial starter doodle: subtle tea leaf / sprout in bottom-left
                    createStarterDoodle();
                }
            } catch (err) {
                createStarterDoodle();
            }
        }

        function createStarterDoodle() {
            const startX = 140;
            const startY = window.innerHeight - 110;
            if (startX > 0 && startY > 200) {
                const stem = {
                    color: '#2B4533',
                    width: 2.2,
                    points: [
                        { x: startX, y: startY },
                        { x: startX + 12, y: startY - 24 },
                        { x: startX + 32, y: startY - 42 }
                    ]
                };
                const leaf1 = {
                    color: '#2B4533',
                    width: 2,
                    points: [
                        { x: startX + 12, y: startY - 24 },
                        { x: startX + 4, y: startY - 36 },
                        { x: startX + 16, y: startY - 44 },
                        { x: startX + 18, y: startY - 30 }
                    ]
                };
                const leaf2 = {
                    color: '#2B4533',
                    width: 2,
                    points: [
                        { x: startX + 32, y: startY - 42 },
                        { x: startX + 46, y: startY - 48 },
                        { x: startX + 48, y: startY - 36 },
                        { x: startX + 34, y: startY - 38 }
                    ]
                };
                allStrokes = [stem, leaf1, leaf2];
                redrawAllStrokes();
                saveStrokes();
            }
        }

        function getCanvasPos(e) {
            const rect = doodleCanvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }

        // Pointer event listeners for seamless drawing
        doodleCanvas.addEventListener('mousedown', (e) => {
            if (!isDoodleActive) return;
            isDrawing = true;
            const pos = getCanvasPos(e);
            currentStroke = { color: currentColor, width: 2.4, points: [pos] };
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDrawing || !isDoodleActive) return;
            const pos = getCanvasPos(e);
            currentStroke.points.push(pos);
            drawCurve(currentStroke);
        });

        window.addEventListener('mouseup', () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentStroke.points && currentStroke.points.length > 1) {
                allStrokes.push(currentStroke);
                saveStrokes();
            }
            currentStroke = [];
        });

        // Touch support for tablets/touch laptops
        doodleCanvas.addEventListener('touchstart', (e) => {
            if (!isDoodleActive) return;
            isDrawing = true;
            const pos = getCanvasPos(e);
            currentStroke = { color: currentColor, width: 2.4, points: [pos] };
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (!isDrawing || !isDoodleActive) return;
            const pos = getCanvasPos(e);
            currentStroke.points.push(pos);
            drawCurve(currentStroke);
        }, { passive: true });

        window.addEventListener('touchend', () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentStroke.points && currentStroke.points.length > 1) {
                allStrokes.push(currentStroke);
                saveStrokes();
            }
            currentStroke = [];
        });

        // Toolbar buttons
        if (doodleToggleBtn) {
            doodleToggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                setDoodleMode(!isDoodleActive);
                if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                    window.WabiSabiStore.showToast(isDoodleActive ? '✎ Desk Doodle Mode Active' : '✦ Desk Doodle Mode Paused');
                }
            });
        }

        doodleColorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                doodleColorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentColor = btn.getAttribute('data-color') || '#231E19';
                setDoodleMode(true);
            });
        });

        if (doodleClearBtn) {
            doodleClearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                allStrokes = [];
                ctx.clearRect(0, 0, doodleCanvas.width, doodleCanvas.height);
                localStorage.removeItem('wabisabi_desk_doodles');
                if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                    window.WabiSabiStore.showToast('✦ Desk Paper Cleared');
                }
            });
        }

        window.addEventListener('resize', resizeDoodleCanvas);
        resizeDoodleCanvas();
        loadStrokes();
        setDoodleMode(true);
    }
});
