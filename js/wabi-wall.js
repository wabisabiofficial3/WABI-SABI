/**
 * WABI SABI — WABI WALL DIGITAL NOTICE BOARD
 * Official Curator & Community Board Controller
 * Physical depth, corkboard canvas, pushpins, desk shelf & interactive notices
 */

let allNotices = [];
let isCurator = false;
let isEditMode = false;
let activeDraggingCard = null;
const NOTICE_TYPES = new Set(['theme_poster', 'about', 'films_list', 'timeline', 'participation', 'discussion', 'curator_note', 'announcement']);
const NOTICE_PIN_COLORS = new Set(['brass', 'red', 'green', 'purple', 'bronze']);

document.addEventListener('DOMContentLoaded', async () => {
    // Client-side authentication guard
    if (window.WabiSabiStore) {
        const session = await window.WabiSabiStore.requireAuth(['USER', 'CURATOR', 'Reader', 'Curator']);
        if (!session) return;
        window.currentMemberSession = session;
        if (session.role === 'CURATOR') {
            isCurator = true;
            showCuratorControls();
        }
    }

    initTheme();
    checkUserRole();
    loadNotices();
    initModalEvents();
    initCuratorToolbar();
});

/* ==========================================================================
   THEME TOGGLE (Tea Cup / Coffee Cup)
   ========================================================================== */
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('wabisabi_theme') || 
        localStorage.getItem('wabi_sabi_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('wabisabi_theme', next);
            localStorage.setItem('wabi_sabi_theme', next);
        });
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            html.setAttribute('data-theme', 'dark');
        } else {
            html.removeAttribute('data-theme');
        }
    }
}

/* ==========================================================================
   CHECK CURATOR ROLE
   ========================================================================== */
async function checkUserRole() {
    try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.user && data.user.role === 'CURATOR') {
                isCurator = true;
                showCuratorControls();
            }
        }
    } catch (e) {
        // Cached browser state never grants curator UI; only a verified server session does.
    }
}

function showCuratorControls() {
    const editToggle = document.getElementById('curatorEditToggle');
    if (editToggle) {
        editToggle.style.display = 'inline-flex';
    }
    const curatorDeskBtn = document.getElementById('curatorDeskBtn');
    if (curatorDeskBtn) {
        curatorDeskBtn.style.display = 'inline-flex';
    }
}

/* ==========================================================================
   FETCH & RENDER NOTICES
   ========================================================================== */
async function loadNotices() {
    try {
        const res = await fetch('/api/notices', { credentials: 'include', cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success || !Array.isArray(data.notices)) {
            throw new Error(data.error || 'The Wabi Wall could not be loaded.');
        }
        allNotices = data.notices;
        renderBoard(allNotices);
        return true;
    } catch (err) {
        console.error('Error loading Wabi Wall notices:', err);
        renderBoardMessage('The board could not connect just now. Refresh to try again.', 'error');
        return false;
    }
}

function renderBoard(notices) {
    const canvas = document.getElementById('noticesCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    if (!notices.length) {
        renderBoardMessage('The board is quiet for now. New circle notices will appear here.');
        return;
    }

    notices.forEach((notice, index) => {
        const el = createNoticeElement(notice, index);
        canvas.appendChild(el);
    });
}

function renderBoardMessage(message, state = 'empty') {
    const canvas = document.getElementById('noticesCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';
    const status = document.createElement('p');
    status.className = `notice-board-status${state === 'error' ? ' is-error' : ''}`;
    status.setAttribute('role', state === 'error' ? 'alert' : 'status');
    status.textContent = message;
    canvas.appendChild(status);
}

/* ==========================================================================
   CREATE NOTICE CARD ELEMENT WITH PHYSICAL DEPTH
   ========================================================================== */
function createNoticeElement(input, index) {
    const notice = input && typeof input === 'object' && !Array.isArray(input) ? { ...input } : {};
    notice.type = NOTICE_TYPES.has(notice.type) ? notice.type : 'announcement';
    notice.id = notice.id === undefined || notice.id === null ? '' : String(notice.id);
    const card = document.createElement('div');
    card.className = `pinned-notice card-${notice.type.replace('_', '-')}`;
    card.dataset.id = notice.id;
    card.dataset.type = notice.type;

    // Apply bounded numeric coordinates and natural tilt rotation.
    const posX = safeNumber(notice.position_x, 30 + (index % 4) * 220, 0, 10000);
    const posY = safeNumber(notice.position_y, 30 + Math.floor(index / 4) * 260, 0, 10000);
    const rot = safeNumber(notice.rotation, 0, -20, 20);

    card.style.left = `${posX}px`;
    card.style.top = `${posY}px`;
    card.style.transform = `rotate(${rot}deg)`;
    card.setAttribute('data-rotation', rot);

    // Render Push-Pin(s) using only the board's known color classes.
    let pinHtml = '';
    const pinColor = NOTICE_PIN_COLORS.has(notice.pin_color) ? notice.pin_color : 'brass';
    const pinClass = `push-pin pin-${pinColor}`;
    if (notice.type === 'theme_poster') {
        pinHtml = `
            <div class="${pinClass} pin-top-left"></div>
            <div class="${pinClass} pin-top-right"></div>
        `;
    } else {
        pinHtml = `<div class="${pinClass} pin-center"></div>`;
    }

    // Curator Action Overlay (Edit / Archive)
    const curatorActionsHtml = `
        <div class="card-curator-actions">
            <button type="button" class="btn-card-ctrl btn-edit" data-notice-action="edit" title="Edit notice">✎</button>
            <button type="button" class="btn-card-ctrl btn-archive" data-notice-action="archive" title="Archive notice">📦</button>
        </div>
    `;

    // Inner Card Content based on Notice Type
    let innerHtml = '';
    const meta = notice.metadata && typeof notice.metadata === 'object' && !Array.isArray(notice.metadata)
        ? notice.metadata
        : {};

    switch (notice.type) {
        case 'theme_poster':
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <div class="poster-vol-tag">${escapeHtml(meta.vol || 'VOL. 1')}</div>
                <h2 class="poster-title-text">${escapeHtml(notice.title)}</h2>
                <p class="poster-subtitle-text">${escapeHtml(notice.content)}</p>
                <div class="poster-dates-badge">${escapeHtml(meta.dates || 'SEPT 22 – OCT 20, 2026')}</div>
                <div class="poster-image-box">
                    <img data-notice-image alt="Cinema Still">
                </div>
            `;
            break;

        case 'about':
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <div class="card-dash-sep">—</div>
                <p class="card-body-text">${escapeHtml(notice.content)}</p>
                ${meta.quote ? `<div class="card-quote-italic">“${escapeHtml(meta.quote)}”</div>` : ''}
            `;
            break;

        case 'films_list':
            const filmsList = Array.isArray(meta.films)
                ? meta.films.filter(film => typeof film === 'string').slice(0, 30)
                : [
                    'Interstellar (2014)',
                    'Her (2013)',
                    'The Perks of Being a Wallflower (2012)',
                    'Lost in Translation (2003)',
                    'Into the Wild (2007)'
                ];
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <ul class="films-bullet-list">
                    ${filmsList.map(f => `<li>${escapeHtml(f)}</li>`).join('')}
                </ul>
                <svg class="doodle-projector" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1.6">
                    <circle cx="14" cy="14" r="7"/>
                    <circle cx="28" cy="12" r="5"/>
                    <rect x="10" y="22" width="22" height="12" rx="2"/>
                    <polygon points="32 25 38 22 38 34 32 31"/>
                    <line x1="16" y1="34" x2="12" y2="39"/>
                    <line x1="26" y1="34" x2="30" y2="39"/>
                </svg>
            `;
            break;

        case 'timeline':
            const weeksList = Array.isArray(meta.weeks)
                ? meta.weeks.filter(week => week && typeof week === 'object' && !Array.isArray(week)).slice(0, 30)
                : [
                    { week: 'Week 1', film: 'Interstellar' },
                    { week: 'Week 2', film: 'Her' },
                    { week: 'Week 3', film: 'Perks of Being a Wallflower' },
                    { week: 'Week 4', film: 'Lost in Translation' },
                    { week: 'Week 5', film: 'Into the Wild' }
                ];
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <div class="timeline-stepper">
                    ${weeksList.map(w => `
                        <div class="timeline-row">
                            <span class="timeline-dot"></span>
                            <span class="timeline-week-name">${escapeHtml(w.week)}</span>
                            <span class="timeline-film-name">${escapeHtml(w.film)}</span>
                        </div>
                    `).join('')}
                </div>
                <svg class="doodle-mountains" viewBox="0 0 60 25" fill="none" stroke="currentColor" stroke-width="1.5">
                    <polyline points="2 24 18 8 32 20 45 4 58 24"/>
                    <polyline points="20 18 26 13 32 20"/>
                </svg>
            `;
            break;

        case 'participation':
            const steps = Array.isArray(meta.steps)
                ? meta.steps.filter(step => typeof step === 'string').slice(0, 30)
                : [
                    'Watch the film of the week',
                    'Share your thoughts',
                    'Join the Table Room discussion',
                    'Be open to different perspectives'
                ];
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <div class="steps-list">
                    ${steps.map((s, i) => `
                        <div class="step-item">
                            <span class="step-num-badge">${i + 1}</span>
                            <span>${escapeHtml(s)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="card-handwriting-footer">${escapeHtml(meta.handwriting || 'Same stories. Different people. —')}</div>
            `;
            break;

        case 'discussion':
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <div class="discussion-header-box">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <h3 class="card-heading-serif" style="margin-bottom:0;">${escapeHtml(notice.title)}</h3>
                </div>
                <p class="card-body-text" style="font-size:11px; margin-bottom:4px;">
                    ${escapeHtml(meta.scheduleText || notice.content)}
                </p>
                <div class="discussion-calendar-pill">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                        <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span class="pill-date-text">${escapeHtml(meta.nextDate || 'Sun, Sep 28, 2026 · 7:00 PM')}</span>
                </div>
                <div class="card-handwriting-footer">${escapeHtml(meta.handwriting || 'Pull up a chair. Let’s talk.')}</div>
            `;
            break;

        case 'curator_note':
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <div class="card-dash-sep">—</div>
                <p class="card-quote-italic">${escapeHtml(notice.content)}</p>
            `;
            break;

        default:
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <h3 class="card-heading-serif">${escapeHtml(notice.title)}</h3>
                <p class="card-body-text">${escapeHtml(notice.content)}</p>
            `;
    }

    card.innerHTML = innerHtml;
    const posterImage = card.querySelector('[data-notice-image]');
    if (posterImage) posterImage.src = safeNoticeImageUrl(notice.image);

    // Keep actions bound to this trusted closure instead of embedding IDs in inline HTML.
    card.addEventListener('click', (e) => {
        const actionButton = e.target instanceof Element ? e.target.closest('[data-notice-action]') : null;
        if (actionButton) {
            if (actionButton.dataset.noticeAction === 'edit') handleEditNotice(notice.id, e);
            if (actionButton.dataset.noticeAction === 'archive') handleArchiveNotice(notice.id, e);
            return;
        }
        if (isEditMode) return;
        openNoticeModal(notice);
    });

    // Drag support in Edit Mode
    setupCardDragging(card, notice);

    return card;
}

/* ==========================================================================
   DRAG AND DROP FOR CURATORS
   ========================================================================== */
function setupCardDragging(card, notice) {
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let activePointerId = null;

    card.addEventListener('pointerdown', (e) => {
        if (!isEditMode || !e.isPrimary || e.button !== 0) return;
        if (e.target.closest('.btn-card-ctrl')) return;

        e.preventDefault();
        activeDraggingCard = card;
        activePointerId = e.pointerId;
        card.classList.add('dragging');

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(card.style.left, 10) || 0;
        initialTop = parseInt(card.style.top, 10) || 0;

        try { card.setPointerCapture(e.pointerId); } catch (err) {}
        document.addEventListener('pointermove', onPointerMove, { passive: false });
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerCancel);
    });

    function onPointerMove(e) {
        if (!activeDraggingCard || e.pointerId !== activePointerId) return;
        e.preventDefault();

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const newX = Math.max(10, initialLeft + dx);
        const newY = Math.max(10, initialTop + dy);

        card.style.left = `${newX}px`;
        card.style.top = `${newY}px`;
    }

    function cleanupDrag() {
        card.classList.remove('dragging');
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerCancel);
        activeDraggingCard = null;
        activePointerId = null;
    }

    function onPointerCancel(e) {
        if (!activeDraggingCard || e.pointerId !== activePointerId) return;
        cleanupDrag();
    }

    async function onPointerUp(e) {
        if (!activeDraggingCard || e.pointerId !== activePointerId) return;

        const finalX = parseInt(card.style.left, 10);
        const finalY = parseInt(card.style.top, 10);
        const rot = card.getAttribute('data-rotation') || 0;
        card.style.transform = `rotate(${rot}deg)`;
        cleanupDrag();

        if (!Number.isFinite(finalX) || !Number.isFinite(finalY)) return;

        // Auto-save position to backend for both mouse and touch/pen input.
        try {
            const response = await fetch(`/api/notices/${encodeURIComponent(String(notice.id))}/position`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    position_x: finalX,
                    position_y: finalY,
                    rotation: Number(rot)
                })
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.error || 'Position could not be saved.');
        } catch (err) {
            console.error('Failed to save notice position:', err);
            if (window.WabiSabiStore?.showToast) window.WabiSabiStore.showToast('Board position could not be saved.');
            await loadNotices();
        }
    }
}

/* ==========================================================================
   CURATOR TOOLBAR & EDIT MODE
   ========================================================================== */
function initCuratorToolbar() {
    const editToggle = document.getElementById('curatorEditToggle');
    const toolbar = document.getElementById('curatorToolbar');
    const board = document.getElementById('corkboardStage');

    if (editToggle) {
        editToggle.addEventListener('click', () => {
            isEditMode = !isEditMode;
            if (isEditMode) {
                editToggle.classList.add('active');
                editToggle.innerHTML = '<span>✓ Done Editing</span>';
                if (toolbar) toolbar.classList.add('active');
                if (board) board.classList.add('curator-edit-mode');
            } else {
                editToggle.classList.remove('active');
                editToggle.innerHTML = '<span>✎ Edit Board</span>';
                if (toolbar) toolbar.classList.remove('active');
                if (board) board.classList.remove('curator-edit-mode');
            }
        });
    }

    const btnAddNotice = document.getElementById('btnAddNotice');
    if (btnAddNotice) {
        btnAddNotice.addEventListener('click', () => {
            openCreateNoticeModal();
        });
    }
}

/* ==========================================================================
   FOCUSED NOTICE MODAL
   ========================================================================== */
function initModalEvents() {
    const backdrop = document.getElementById('noticeModalBackdrop');
    const closeBtn = document.getElementById('modalCloseBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (backdrop) {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

function openNoticeModal(notice) {
    const backdrop = document.getElementById('noticeModalBackdrop');
    const titleEl = document.getElementById('modalTitle');
    const contentEl = document.getElementById('modalContent');
    const tagEl = document.getElementById('modalTag');
    const actionsEl = document.getElementById('modalActions');

    if (!backdrop) return;

    tagEl.textContent = notice.type.replace('_', ' ').toUpperCase();
    titleEl.textContent = notice.title;
    contentEl.textContent = notice.content;

    // Generate contextual action buttons
    let actionButtons = '';
    if (notice.type === 'theme_poster' || notice.type === 'films_list') {
        actionButtons = `
            <a href="/table-room" class="btn-modal-action">
                <span>Enter Table Room Discussion</span>
                <span>→</span>
            </a>
            <a href="/reader" class="btn-modal-action" style="background:var(--bg-card-solid); color:var(--ink-primary); border:1px solid var(--border-card);">
                <span>Read Literary Essays</span>
            </a>
        `;
    } else if (notice.type === 'discussion') {
        actionButtons = `
            <a href="/table-room" class="btn-modal-action">
                <span>Join Sunday Salon (7:00 PM)</span>
                <span>→</span>
            </a>
        `;
    } else {
        actionButtons = `
            <button type="button" class="btn-modal-action" data-close-notice>
                <span>Close Notice</span>
            </button>
        `;
    }

    actionsEl.innerHTML = actionButtons;
    const closeNoticeButton = actionsEl.querySelector('[data-close-notice]');
    if (closeNoticeButton) closeNoticeButton.addEventListener('click', closeModal);
    backdrop.classList.add('show');
}

function closeModal() {
    const backdrop = document.getElementById('noticeModalBackdrop');
    if (backdrop) backdrop.classList.remove('show');
}

/* ==========================================================================
   CURATOR ACTIONS (Add / Edit / Archive)
   ========================================================================== */
async function handleEditNotice(noticeId, event) {
    event.stopPropagation();
    const notice = allNotices.find(n => String(n.id) === String(noticeId));
    if (!notice) return;

    const newTitle = prompt('Edit Notice Title:', notice.title);
    if (newTitle === null) return;
    const newContent = prompt('Edit Notice Content:', notice.content);
    if (newContent === null) return;

    try {
        const res = await fetch(`/api/notices/${encodeURIComponent(String(noticeId))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to update notice.');
        showNoticeSaveFeedback(data, 'Wabi Wall was updated.', 'Wabi Wall was already up to date.');
        await loadNotices();
    } catch (err) {
        showNoticeFeedback(err.message || 'Could not connect to save the notice.', true);
    }
}

async function handleArchiveNotice(noticeId, event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to archive this notice from the board?')) return;

    try {
        const res = await fetch(`/api/notices/${encodeURIComponent(String(noticeId))}/archive`, {
            method: 'POST',
            credentials: 'include'
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to archive notice.');
        showNoticeSaveFeedback(data, 'Notice archived.', 'Notice was already archived.');
        await loadNotices();
    } catch (err) {
        showNoticeFeedback(err.message || 'Could not connect to archive the notice.', true);
    }
}

async function openCreateNoticeModal() {
    const title = prompt('New Notice Title:');
    if (!title || !title.trim()) return;
    const content = prompt('New Notice Content / Message:') || '';
    const pinColor = prompt('Pin Color (brass / red / green / purple / bronze):', 'brass') || 'brass';

    try {
        const res = await fetch('/api/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                title: title.trim(),
                content: content.trim(),
                type: 'announcement',
                pin_color: pinColor.toLowerCase(),
                position_x: 200 + Math.random() * 200,
                position_y: 100 + Math.random() * 150,
                rotation: Math.random() * 4 - 2
            })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to create notice.');
        showNoticeSaveFeedback(data, 'Notice added to Wabi Wall.', 'Notice was saved, but no member alert was created.');
        await loadNotices();
    } catch (err) {
        showNoticeFeedback(err.message || 'Could not connect to add the notice.', true);
    }
}

function showNoticeSaveFeedback(data, savedMessage, noNoticeMessage) {
    const hasMemberNotice = Number(data?.notificationsCreated) > 0;
    showNoticeFeedback(hasMemberNotice ? `${savedMessage} Members notified.` : noNoticeMessage);
}

function showNoticeFeedback(message, isError = false) {
    if (window.WabiSabiStore?.showToast) {
        window.WabiSabiStore.showToast(message, isError ? 5000 : 3400);
    } else if (isError) {
        console.error(message);
    }
}

/* ==========================================================================
   HELPERS
   ========================================================================== */
function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function safeNumber(value, fallback, minimum, maximum) {
    if (value === null || value === undefined || value === '') return fallback;
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, number)) : fallback;
}

function safeNoticeImageUrl(value) {
    const fallback = '/assets/cinema_of_solitude.jpg';
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
