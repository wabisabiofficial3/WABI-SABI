/**
 * WABI SABI — THEME WEEKS DIGITAL NOTICE BOARD
 * Official Curator Notice Board Controller
 */

let allNotices = [];
let isCurator = false;
let isEditMode = false;
let activeDraggingCard = null;
let dragOffset = { x: 0, y: 0 };

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    checkUserRole();
    loadNotices();
    initModalEvents();
    initCuratorToolbar();
});

/* ==========================================================================
   THEME TOGGLE
   ========================================================================== */
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('wabi_sabi_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const current = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
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
        // Fallback or demo check
        const storedRole = localStorage.getItem('wabi_user_role');
        if (storedRole === 'CURATOR') {
            isCurator = true;
            showCuratorControls();
        }
    }
}

function showCuratorControls() {
    const editToggle = document.getElementById('curatorEditToggle');
    if (editToggle) {
        editToggle.style.display = 'inline-flex';
    }
}

/* ==========================================================================
   FETCH & RENDER NOTICES
   ========================================================================== */
async function loadNotices() {
    try {
        const res = await fetch('/api/notices');
        if (!res.ok) throw new Error('Failed to load notices');
        const data = await res.json();
        if (data.success && data.notices) {
            allNotices = data.notices;
            renderBoard(allNotices);
        }
    } catch (err) {
        console.error('Error loading notices:', err);
    }
}

function renderBoard(notices) {
    const canvas = document.getElementById('noticesCanvas');
    if (!canvas) return;
    canvas.innerHTML = '';

    notices.forEach((notice, index) => {
        const el = createNoticeElement(notice, index);
        canvas.appendChild(el);
    });
}

/* ==========================================================================
   CREATE NOTICE CARD ELEMENT
   ========================================================================== */
function createNoticeElement(notice, index) {
    const card = document.createElement('div');
    card.className = `pinned-notice card-${notice.type.replace('_', '-')}`;
    card.setAttribute('data-id', notice.id);
    card.setAttribute('data-type', notice.type);

    // Apply saved coordinates and rotation
    const posX = notice.position_x || (30 + (index % 4) * 220);
    const posY = notice.position_y || (30 + Math.floor(index / 4) * 260);
    const rot = notice.rotation || 0;

    card.style.left = `${posX}px`;
    card.style.top = `${posY}px`;
    card.style.transform = `rotate(${rot}deg)`;
    card.setAttribute('data-rotation', rot);

    // Render 3D Push-Pin(s)
    let pinHtml = '';
    const pinClass = `push-pin pin-${notice.pin_color || 'brass'}`;
    if (notice.type === 'theme_poster') {
        pinHtml = `
            <div class="${pinClass} pin-top-left"></div>
            <div class="${pinClass} pin-top-right"></div>
        `;
    } else {
        pinHtml = `<div class="${pinClass} pin-center"></div>`;
    }

    // Curator Action Overlay (Edit / Archive / Delete)
    const curatorActionsHtml = `
        <div class="card-curator-actions">
            <button class="btn-card-ctrl btn-edit" title="Edit notice" onclick="handleEditNotice('${notice.id}', event)">✎</button>
            <button class="btn-card-ctrl btn-archive" title="Archive notice" onclick="handleArchiveNotice('${notice.id}', event)">📦</button>
        </div>
    `;

    // Inner Card HTML based on Type
    let innerHtml = '';
    const meta = notice.metadata || {};

    switch (notice.type) {
        case 'theme_poster':
            innerHtml = `
                ${pinHtml}
                ${curatorActionsHtml}
                <div class="poster-vol-tag">${meta.vol || 'VOL. 1'}</div>
                <h2 class="poster-title-text">${escapeHtml(notice.title)}</h2>
                <p class="poster-subtitle-text">${escapeHtml(notice.content)}</p>
                <div class="poster-dates-badge">${meta.dates || 'SEPT 22 – OCT 20, 2026'}</div>
                <div class="poster-image-box">
                    <img src="${notice.image || 'assets/cinema_of_solitude.jpg'}" alt="Cinema Still">
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
            const filmsList = meta.films || [
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
            const weeksList = meta.weeks || [
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
            const steps = meta.steps || [
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

    // Card Click: Open modal in normal mode
    card.addEventListener('click', (e) => {
        if (isEditMode) return; // In edit mode, clicking enables drag
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

    card.addEventListener('mousedown', (e) => {
        if (!isEditMode) return;
        if (e.target.closest('.btn-card-ctrl')) return;

        e.preventDefault();
        activeDraggingCard = card;
        card.classList.add('dragging');

        startX = e.clientX;
        startY = e.clientY;
        initialLeft = parseInt(card.style.left, 10) || 0;
        initialTop = parseInt(card.style.top, 10) || 0;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        if (!activeDraggingCard) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newX = Math.max(10, initialLeft + dx);
        let newY = Math.max(10, initialTop + dy);

        card.style.left = `${newX}px`;
        card.style.top = `${newY}px`;
    }

    async function onMouseUp() {
        if (!activeDraggingCard) return;
        activeDraggingCard.classList.remove('dragging');
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        const finalX = parseInt(card.style.left, 10);
        const finalY = parseInt(card.style.top, 10);
        const rot = card.getAttribute('data-rotation') || 0;
        card.style.transform = `rotate(${rot}deg)`;
        activeDraggingCard = null;

        // Auto-save position to backend
        try {
            await fetch(`/api/notices/${notice.id}/position`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    position_x: finalX,
                    position_y: finalY,
                    rotation: Number(rot)
                })
            });
        } catch (err) {
            console.error('Failed to save notice position:', err);
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
            <a href="table-room.html" class="btn-modal-action">
                <span>Enter Table Room Discussion</span>
                <span>→</span>
            </a>
            <a href="reader.html" class="btn-modal-action" style="background:var(--bg-card-solid); color:var(--ink-primary); border:1px solid var(--border-card);">
                <span>Read Literary Essays</span>
            </a>
        `;
    } else if (notice.type === 'discussion') {
        actionButtons = `
            <a href="table-room.html" class="btn-modal-action">
                <span>Join Sunday Salon (7:00 PM)</span>
                <span>→</span>
            </a>
        `;
    } else {
        actionButtons = `
            <button class="btn-modal-action" onclick="closeModal()">
                <span>Close Notice</span>
            </button>
        `;
    }

    actionsEl.innerHTML = actionButtons;
    backdrop.classList.add('show');
}

function closeModal() {
    const backdrop = document.getElementById('noticeModalBackdrop');
    if (backdrop) backdrop.classList.remove('show');
}

/* ==========================================================================
   CURATOR ACTIONS (Add / Edit / Archive)
   ========================================================================== */
function handleEditNotice(noticeId, event) {
    event.stopPropagation();
    const notice = allNotices.find(n => n.id === noticeId);
    if (!notice) return;

    const newTitle = prompt('Edit Notice Title:', notice.title);
    if (newTitle === null) return;
    const newContent = prompt('Edit Notice Content:', notice.content);
    if (newContent === null) return;

    fetch(`/api/notices/${noticeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            title: newTitle.trim(),
            content: newContent.trim()
        })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            loadNotices();
        } else {
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(data.error || 'Failed to update notice');
            }
        }
    });
}

function handleArchiveNotice(noticeId, event) {
    event.stopPropagation();
    if (!confirm('Are you sure you want to archive this notice from the board?')) return;

    fetch(`/api/notices/${noticeId}/archive`, {
        method: 'POST',
        credentials: 'include'
    }).then(res => res.json()).then(data => {
        if (data.success) {
            loadNotices();
        } else {
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(data.error || 'Failed to archive notice');
            }
        }
    });
}

function openCreateNoticeModal() {
    const title = prompt('New Notice Title:');
    if (!title || !title.trim()) return;
    const content = prompt('New Notice Content / Message:') || '';
    const pinColor = prompt('Pin Color (brass / red / green / purple / bronze):', 'brass') || 'brass';

    fetch('/api/notices', {
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
            rotation: (Math.random() * 4 - 2)
        })
    }).then(res => res.json()).then(data => {
        if (data.success) {
            loadNotices();
        } else {
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(data.error || 'Failed to create notice');
            }
        }
    });
}

/* ==========================================================================
   HELPERS
   ========================================================================== */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}
