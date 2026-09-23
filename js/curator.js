/**
 * Wabi Sabi — Curator's Desk Controller (js/curator.js)
 * Manages:
 * 1. Curator role authorization check with server
 * 2. Membership application review, approve & reject actions with audit trail
 * 3. Curator audit logs viewer
 * 4. Member registry viewer
 * 5. Bookclub selections, salons, and prompt editing
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Authorization: Only Curators may enter (strictly checked on server)
    const session = window.WabiSabiStore ? await window.WabiSabiStore.requireAuth(['CURATOR']) : null;
    if (!session) return; // Directed away if not an active Curator

    const curatorLabel = document.getElementById('cdCuratorNameLabel');
    if (curatorLabel) {
        curatorLabel.textContent = `${session.displayName} (@${session.handle})`;
    }

    // Sign out button
    const signOutBtn = document.getElementById('cdSignOutBtn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', () => {
            window.WabiSabiStore.logout();
        });
    }

    // 2. Tab Switching
    const tabButtons = document.querySelectorAll('.curator-tab-btn');
    const tabPanes = document.querySelectorAll('.curator-tab-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const activePane = document.getElementById(target);
            if (activePane) activePane.classList.add('active');

            // Trigger data load if needed
            if (target === 'tab-applications') loadApplications(currentFilter);
            if (target === 'tab-audit') loadAuditLogs();
            if (target === 'tab-permissions') loadMembers();
        });
    });

    // 3. Applications Tab Logic
    let currentFilter = 'PENDING';
    let currentActiveApp = null;
    const applicationsGrid = document.getElementById('cdApplicationsGrid');
    const pendingBadge = document.getElementById('cdPendingBadge');
    const filterButtons = document.querySelectorAll('.app-filter-btn');

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            loadApplications(currentFilter);
        });
    });

    async function loadApplications(filter = 'PENDING') {
        if (!applicationsGrid) return;
        applicationsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--ink-muted);">
                Fetching applications from database...
            </div>
        `;

        try {
            const url = filter === 'ALL' ? '/api/curator/applications' : `/api/curator/applications?status=${filter}`;
            const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch(url) : fetch(url));
            if (!res.ok) throw new Error('Failed to fetch applications');
            const data = await res.json();

            const apps = data.applications || [];

            // Also check total pending for badge
            if (filter === 'PENDING') {
                if (pendingBadge) pendingBadge.textContent = apps.length;
            } else {
                fetchPendingCount();
            }

            if (apps.length === 0) {
                applicationsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 50px 20px; background: var(--bg-paper-alt); border-radius: 8px; border: 1px dashed rgba(140,135,125,0.3);">
                        <div style="font-family: var(--font-serif); font-size: 20px; color: var(--ink-primary); margin-bottom: 6px;">No applications found</div>
                        <p style="font-size: 13.5px; color: var(--ink-muted); margin: 0;">There are currently no applications under the <strong>${filter}</strong> filter.</p>
                    </div>
                `;
                return;
            }

            applicationsGrid.innerHTML = '';
            apps.forEach(app => {
                const card = document.createElement('div');
                card.className = 'app-review-card';

                const statusPillClass = app.status === 'APPROVED' ? 'status-approved' : app.status === 'REJECTED' ? 'status-rejected' : 'status-pending';
                const statusPillIcon = app.status === 'APPROVED' ? '✓' : app.status === 'REJECTED' ? '✕' : '⏳';
                const statusLabel = app.status === 'APPROVED' ? 'Approved' : app.status === 'REJECTED' ? 'Rejected' : 'Pending Review';

                const formattedDate = new Date(app.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                card.innerHTML = `
                    <div>
                        <div class="app-card-top">
                            <div>
                                <div class="app-applicant-name">${app.display_name}</div>
                                <div class="app-applicant-handle">@${app.handle}</div>
                            </div>
                            <span class="app-status-badge ${statusPillClass}" style="font-size: 11px; padding: 3px 10px;">
                                <span>${statusPillIcon}</span>
                                <span>${statusLabel}</span>
                            </span>
                        </div>
                        <div class="app-submitted-time">Submitted on ${formattedDate} • ${app.email}</div>
                        <div class="app-card-snippet">
                            "${escapeHtml(app.reason)}"
                        </div>
                    </div>
                    <div class="app-card-actions">
                        <button type="button" class="btn-review-open" data-app-id="${app.id}">
                            Review Application →
                        </button>
                    </div>
                `;

                const openBtn = card.querySelector('.btn-review-open');
                openBtn.addEventListener('click', () => {
                    openReviewModal(app);
                });

                applicationsGrid.appendChild(card);
            });
        } catch (err) {
            console.error('Error loading applications:', err);
            applicationsGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: #9C3322;">
                    Failed to load applications. Please verify server connection.
                </div>
            `;
        }
    }

    async function fetchPendingCount() {
        try {
            const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch('/api/curator/applications?status=PENDING') : fetch('/api/curator/applications?status=PENDING'));
            if (res.ok) {
                const data = await res.json();
                if (pendingBadge) pendingBadge.textContent = (data.applications || []).length;
            }
        } catch (e) {}
    }

    // 4. Review Modal Sheet Logic
    const reviewModal = document.getElementById('appReviewModal');
    const closeReviewModalBtn = document.getElementById('closeReviewModalBtn');
    const modalApplicantName = document.getElementById('modalApplicantName');
    const modalApplicantHandle = document.getElementById('modalApplicantHandle');
    const modalApplicantEmail = document.getElementById('modalApplicantEmail');
    const modalApplicantDate = document.getElementById('modalApplicantDate');
    const modalAnsReason = document.getElementById('modalAnsReason');
    const modalAnsFavoriteWork = document.getElementById('modalAnsFavoriteWork');
    const modalAnsPerspective = document.getElementById('modalAnsPerspective');
    const modalAnsContribution = document.getElementById('modalAnsContribution');
    const modalAnsConversation = document.getElementById('modalAnsConversation');
    const appReviewNotesInput = document.getElementById('appReviewNotesInput');
    const modalApproveBtn = document.getElementById('modalApproveBtn');
    const modalRejectBtn = document.getElementById('modalRejectBtn');

    function openReviewModal(app) {
        currentActiveApp = app;
        modalApplicantName.textContent = app.display_name;
        modalApplicantHandle.textContent = `@${app.handle}`;
        modalApplicantEmail.textContent = app.email;
        modalApplicantDate.textContent = `Submitted ${new Date(app.created_at).toLocaleDateString()}`;

        modalAnsReason.textContent = app.reason || '—';
        modalAnsFavoriteWork.textContent = app.favorite_work || '—';
        modalAnsPerspective.textContent = app.perspective || '—';
        modalAnsContribution.textContent = app.contribution || '—';
        modalAnsConversation.textContent = app.conversation || '—';

        if (appReviewNotesInput) {
            appReviewNotesInput.value = app.curator_notes || '';
        }

        // Adjust buttons if already approved or rejected
        if (app.status === 'APPROVED') {
            modalApproveBtn.textContent = 'Already Approved ✓';
            modalApproveBtn.disabled = true;
            modalRejectBtn.disabled = false;
        } else if (app.status === 'REJECTED') {
            modalRejectBtn.textContent = 'Already Rejected ✕';
            modalRejectBtn.disabled = true;
            modalApproveBtn.disabled = false;
        } else {
            modalApproveBtn.textContent = 'Approve Member for Circle ✓';
            modalApproveBtn.disabled = false;
            modalRejectBtn.textContent = 'Reject Application ✕';
            modalRejectBtn.disabled = false;
        }

        reviewModal.style.display = 'flex';
    }

    function closeReviewModal() {
        reviewModal.style.display = 'none';
        currentActiveApp = null;
    }

    if (closeReviewModalBtn) closeReviewModalBtn.addEventListener('click', closeReviewModal);
    if (reviewModal) {
        reviewModal.addEventListener('click', (e) => {
            if (e.target === reviewModal) closeReviewModal();
        });
    }

    // Modal Approve Action
    if (modalApproveBtn) {
        modalApproveBtn.addEventListener('click', async () => {
            if (!currentActiveApp) return;
            const notes = appReviewNotesInput ? appReviewNotesInput.value.trim() : '';

            modalApproveBtn.disabled = true;
            modalApproveBtn.textContent = 'Approving...';

            try {
                const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch(`/api/curator/applications/${currentActiveApp.id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes })
                }) : fetch(`/api/curator/applications/${currentActiveApp.id}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes })
                }));
                const data = await res.json();

                if (res.ok && data.success) {
                    window.WabiSabiStore.showToast(`✦ Approved @${currentActiveApp.handle} for the Circle.`);
                    closeReviewModal();
                    loadApplications(currentFilter);
                    fetchPendingCount();
                } else {
                    window.WabiSabiStore.showToast(data.error || 'Failed to approve application.');
                    modalApproveBtn.disabled = false;
                    modalApproveBtn.textContent = 'Approve Member for Circle ✓';
                }
            } catch (err) {
                console.error('Approve error:', err);
                window.WabiSabiStore.showToast('Server error while approving application.');
                modalApproveBtn.disabled = false;
            }
        });
    }

    // Modal Reject Action
    if (modalRejectBtn) {
        modalRejectBtn.addEventListener('click', async () => {
            if (!currentActiveApp) return;
            const notes = appReviewNotesInput ? appReviewNotesInput.value.trim() : '';

            modalRejectBtn.disabled = true;
            modalRejectBtn.textContent = 'Rejecting...';

            try {
                const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch(`/api/curator/applications/${currentActiveApp.id}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes })
                }) : fetch(`/api/curator/applications/${currentActiveApp.id}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes })
                }));
                const data = await res.json();

                if (res.ok && data.success) {
                    window.WabiSabiStore.showToast(`Application for @${currentActiveApp.handle} marked as rejected.`);
                    closeReviewModal();
                    loadApplications(currentFilter);
                    fetchPendingCount();
                } else {
                    window.WabiSabiStore.showToast(data.error || 'Failed to reject application.');
                    modalRejectBtn.disabled = false;
                    modalRejectBtn.textContent = 'Reject Application ✕';
                }
            } catch (err) {
                console.error('Reject error:', err);
                window.WabiSabiStore.showToast('Server error while rejecting application.');
                modalRejectBtn.disabled = false;
            }
        });
    }

    // 5. Curator Audit Logs
    const auditTableBody = document.getElementById('cdAuditLogsTableBody');
    async function loadAuditLogs() {
        if (!auditTableBody) return;
        auditTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 24px; color: var(--ink-muted);">Loading audit history...</td></tr>`;

        try {
            const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch('/api/curator/audit-logs') : fetch('/api/curator/audit-logs'));
            const data = await res.json();
            const logs = data.logs || [];

            if (logs.length === 0) {
                auditTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: var(--ink-muted);">No administrative audit actions recorded yet.</td></tr>`;
                return;
            }

            auditTableBody.innerHTML = '';
            logs.forEach(l => {
                const tr = document.createElement('tr');
                const isApprove = l.action === 'APPROVE_MEMBER';
                const tagClass = isApprove ? 'audit-tag-approve' : 'audit-tag-reject';
                const tagLabel = isApprove ? 'APPROVED MEMBER' : 'REJECTED APPLICATION';

                let notes = '—';
                try {
                    const parsed = JSON.parse(l.metadata || '{}');
                    notes = parsed.notes || '—';
                } catch (e) {}

                const dateStr = new Date(l.created_at).toLocaleString();

                tr.innerHTML = `
                    <td><span class="${tagClass}">${tagLabel}</span></td>
                    <td><strong>${escapeHtml(l.admin_name || 'Curator')}</strong> <span style="font-size: 11px; color: var(--forest-green);">(@${escapeHtml(l.admin_handle || 'curator')})</span></td>
                    <td>${l.target_name ? `<strong>${escapeHtml(l.target_name)}</strong> <span style="font-size: 11px; color: var(--ink-muted);">(@${escapeHtml(l.target_handle)})</span>` : '—'}</td>
                    <td style="font-size: 12.5px; color: var(--ink-secondary); font-style: italic;">"${escapeHtml(notes)}"</td>
                    <td style="font-size: 12px; color: var(--ink-muted);">${dateStr}</td>
                `;
                auditTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Audit load error:', err);
            auditTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #9C3322;">Failed to load audit logs.</td></tr>`;
        }
    }

    // 6. Member Registry
    const membersTableBody = document.getElementById('cdMembersTableBody');
    async function loadMembers() {
        if (!membersTableBody) return;
        membersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 24px; color: var(--ink-muted);">Loading member registry...</td></tr>`;

        try {
            const res = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch('/api/curator/members') : fetch('/api/curator/members'));
            const data = await res.json();
            const members = data.members || [];

            membersTableBody.innerHTML = '';
            members.forEach(m => {
                const tr = document.createElement('tr');
                const roleBadge = m.role === 'CURATOR' ? '<span class="badge-role-curator">⚜ Curator</span>' : '<span class="badge-role-reader">🌿 Reader</span>';
                const statusBadge = m.status === 'ACTIVE' ? '<span class="app-status-badge status-approved" style="font-size: 10.5px; padding: 2px 8px;">Active</span>' : m.status === 'PENDING' ? '<span class="app-status-badge status-pending" style="font-size: 10.5px; padding: 2px 8px;">Pending</span>' : '<span class="app-status-badge status-rejected" style="font-size: 10.5px; padding: 2px 8px;">Rejected</span>';
                const joinDate = new Date(m.created_at).toLocaleDateString();

                tr.innerHTML = `
                    <td><strong>${escapeHtml(m.display_name)}</strong></td>
                    <td><span style="color: var(--forest-green); font-weight: 600;">@${escapeHtml(m.handle)}</span> 🔒</td>
                    <td style="color: var(--ink-secondary); font-size: 13px;">${escapeHtml(m.email)}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td style="color: var(--ink-muted); font-size: 12.5px;">${joinDate}</td>
                `;
                membersTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error('Members load error:', err);
            membersTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #9C3322;">Failed to load members.</td></tr>`;
        }
    }

    // 7. CMS Content: Today's Pick, Salons, Prompts
    const content = window.WabiSabiStore.getContent();

    const bookTitleInput = document.getElementById('cdBookTitle');
    const bookAuthorInput = document.getElementById('cdBookAuthor');
    const bookQuoteInput = document.getElementById('cdBookQuote');
    const bookReadersInput = document.getElementById('cdBookReaders');
    const saveBookBtn = document.getElementById('cdSaveBookBtn');

    const previewTitle = document.getElementById('cdPreviewTitle');
    const previewAuthor = document.getElementById('cdPreviewAuthor');
    const previewQuote = document.getElementById('cdPreviewQuote');
    const previewReaders = document.getElementById('cdPreviewReaders');

    if (content.featuredBook) {
        const fb = content.featuredBook;
        if (bookTitleInput) bookTitleInput.value = fb.title || '';
        if (bookAuthorInput) bookAuthorInput.value = fb.author || '';
        if (bookQuoteInput) bookQuoteInput.value = fb.quote || '';
        if (bookReadersInput) bookReadersInput.value = fb.readers || 1240;
        updateBookPreview();
    }

    function updateBookPreview() {
        if (previewTitle && bookTitleInput) previewTitle.textContent = bookTitleInput.value || "Untitled";
        if (previewAuthor && bookAuthorInput) previewAuthor.textContent = bookAuthorInput.value || "Unknown Author";
        if (previewQuote && bookQuoteInput) previewQuote.textContent = `"${bookQuoteInput.value || ''}"`;
        if (previewReaders && bookReadersInput) {
            const num = parseFloat(bookReadersInput.value) || 0;
            previewReaders.textContent = `+${(num / 1000).toFixed(1)}K reading together`;
        }
    }

    [bookTitleInput, bookAuthorInput, bookQuoteInput, bookReadersInput].forEach(inp => {
        if (inp) inp.addEventListener('input', updateBookPreview);
    });

    if (saveBookBtn) {
        saveBookBtn.addEventListener('click', () => {
            window.WabiSabiStore.updateFeaturedBook({
                title: bookTitleInput.value.trim(),
                author: bookAuthorInput.value.trim(),
                quote: bookQuoteInput.value.trim(),
                readers: parseInt(bookReadersInput.value, 10) || 1240
            });
            window.WabiSabiStore.showToast("✦ Today's Bookclub Pick updated live across Wabi Sabi.");
        });
    }

    // Salons & Gatherings
    const eventTitleInput = document.getElementById('cdEventTitle');
    const eventDetailInput = document.getElementById('cdEventDetail');
    const eventMonthInput = document.getElementById('cdEventMonth');
    const eventDayInput = document.getElementById('cdEventDay');
    const eventAttendeesInput = document.getElementById('cdEventAttendees');
    const saveEventBtn = document.getElementById('cdSaveEventBtn');

    const previewMonth = document.getElementById('cdPreviewMonth');
    const previewDay = document.getElementById('cdPreviewDay');
    const previewEventTitle = document.getElementById('cdPreviewEventTitle');
    const previewEventDetail = document.getElementById('cdPreviewEventDetail');
    const previewEventAttendees = document.getElementById('cdPreviewEventAttendees');

    if (content.upcomingEvent) {
        const ev = content.upcomingEvent;
        if (eventTitleInput) eventTitleInput.value = ev.title || '';
        if (eventDetailInput) eventDetailInput.value = ev.detail || '';
        if (eventMonthInput) eventMonthInput.value = ev.month || 'Sep';
        if (eventDayInput) eventDayInput.value = ev.day || '24';
        if (eventAttendeesInput) eventAttendeesInput.value = ev.attendees || 324;
        updateEventPreview();
    }

    function updateEventPreview() {
        if (previewEventTitle && eventTitleInput) previewEventTitle.textContent = eventTitleInput.value || "Untitled Salon";
        if (previewEventDetail && eventDetailInput) previewEventDetail.textContent = eventDetailInput.value || "";
        if (previewMonth && eventMonthInput) previewMonth.textContent = eventMonthInput.value || "Sep";
        if (previewDay && eventDayInput) previewDay.textContent = eventDayInput.value || "24";
        if (previewEventAttendees && eventAttendeesInput) {
            previewEventAttendees.textContent = `+${eventAttendeesInput.value || 0} members attending`;
        }
    }

    [eventTitleInput, eventDetailInput, eventMonthInput, eventDayInput, eventAttendeesInput].forEach(inp => {
        if (inp) inp.addEventListener('input', updateEventPreview);
    });

    if (saveEventBtn) {
        saveEventBtn.addEventListener('click', () => {
            window.WabiSabiStore.updateUpcomingEvent({
                title: eventTitleInput.value.trim(),
                detail: eventDetailInput.value.trim(),
                month: eventMonthInput.value.trim(),
                day: eventDayInput.value.trim(),
                attendees: parseInt(eventAttendeesInput.value, 10) || 324
            });
            window.WabiSabiStore.showToast("✦ Upcoming Salon details saved and synced live.");
        });
    }

    // Sticky Note Prompts
    const promptBooks = document.getElementById('cdPromptBooks');
    const promptFilms = document.getElementById('cdPromptFilms');
    const promptDiscuss = document.getElementById('cdPromptDiscuss');
    const promptCommunity = document.getElementById('cdPromptCommunity');
    const savePromptsBtn = document.getElementById('cdSavePromptsBtn');

    if (content.stickyTitles) {
        const t = content.stickyTitles;
        if (promptBooks) promptBooks.value = t.books || 'Reading Thoughts';
        if (promptFilms) promptFilms.value = t.films || 'Cinema Notes';
        if (promptDiscuss) promptDiscuss.value = t.discuss || 'Quiet Musings';
        if (promptCommunity) promptCommunity.value = t.community || 'Open Letter';
    }

    if (savePromptsBtn) {
        savePromptsBtn.addEventListener('click', () => {
            window.WabiSabiStore.updateStickyTitles({
                books: promptBooks.value.trim(),
                films: promptFilms.value.trim(),
                discuss: promptDiscuss.value.trim(),
                community: promptCommunity.value.trim()
            });
            window.WabiSabiStore.showToast("✦ Sticky note prompt headings updated for community.");
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Initial load: Applications Tab
    loadApplications('PENDING');
});
