/**
 * Wabi Sabi — Curator Atelier Client Controller (js/curator.js)
 * Super-Advanced 5-Pillar Command Center:
 * 1. Announcements & Editorial (Theme, Reading, Gathering, Discussion Inquiries, Bulletins)
 * 2. Community Directory (Member portraits, Secret Codes, physical QR cards, suspend/restore)
 * 3. Buttons & Links Command Center (Full button URL & label customization with live test previews)
 * 4. Tactile Desk Sticky Notes (Books, Films, Discussions, Community musings)
 * 5. Admin Profile & Security Sanctuary (Profile details, handle, email, Argon2id password encryption)
 */

(function () {
    'use strict';

    let currentCurator = null;
    let currentMembersList = [];
    let memberSearchQuery = '';
    let latestCreatedMember = null;

    // Toast Notification Helper
    function showToast(message, isError = false) {
        const toast = document.getElementById('curatorToast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.background = isError ? '#A23434' : 'var(--moss-dark, #273B2B)';
        toast.style.display = 'block';
        toast.style.animation = 'fadeInToast 0.25s ease';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3400);
    }

    function showSaveToast(message, data) {
        const hasMemberNotice = Number(data?.notificationsCreated) > 0;
        showToast(`${message}${hasMemberNotice ? ' • Members notified.' : ''}`);
    }

    // Verify Authenticated Curator
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (!data.success || !data.curator) {
                window.location.href = '/sanctuary?redirect=/curator.html';
                return false;
            }
            currentCurator = data.curator;
            const nameEl = document.getElementById('curatorIdentityName');
            if (nameEl) {
                nameEl.textContent = currentCurator.displayName || 'Wabi Sabi Admin';
            }
            return true;
        } catch (err) {
            console.error('Curator auth check failed:', err);
            window.location.href = '/sanctuary?redirect=/curator.html';
            return false;
        }
    }

    // Tab Switching Controller (5 Pillars)
    function setupTabs() {
        const tabs = [
            { btn: document.getElementById('curTabAnnouncements'), sec: document.getElementById('curatorSectionAnnouncements'), key: 'announcements' },
            { btn: document.getElementById('curTabCommunity'), sec: document.getElementById('curatorSectionCommunity'), key: 'community' },
            { btn: document.getElementById('curTabButtons'), sec: document.getElementById('curatorSectionButtons'), key: 'buttons' },
            { btn: document.getElementById('curTabStickies'), sec: document.getElementById('curatorSectionStickies'), key: 'stickies' },
            { btn: document.getElementById('curTabProfile'), sec: document.getElementById('curatorSectionProfile'), key: 'profile' }
        ];

        tabs.forEach(t => {
            if (t.btn && t.sec) {
                t.btn.addEventListener('click', () => {
                    tabs.forEach(other => {
                        if (other.btn) other.btn.classList.remove('active');
                        if (other.sec) other.sec.classList.remove('active');
                    });
                    t.btn.classList.add('active');
                    t.sec.classList.add('active');
                    history.replaceState(null, '', `#${t.key}`);
                });
            }
        });

        // Activate Tab Based on URL Hash
        const hash = (window.location.hash || '').replace('#', '').toLowerCase();
        if (hash === 'community' || hash === 'members') {
            document.getElementById('curTabCommunity')?.click();
        } else if (hash === 'buttons' || hash === 'connect' || hash === 'links') {
            document.getElementById('curTabButtons')?.click();
        } else if (hash === 'stickies' || hash === 'notes') {
            document.getElementById('curTabStickies')?.click();
        } else if (hash === 'profile' || hash === 'security') {
            document.getElementById('curTabProfile')?.click();
        } else {
            document.getElementById('curTabAnnouncements')?.click();
        }
    }

    // Load Initial Overview Data
    async function loadDashboardData() {
        try {
            const res = await fetch('/api/curator/overview', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/sanctuary?redirect=/curator.html';
                }
                return;
            }
            const data = await res.json();
            if (!data.success) return;

            const announcements = data.announcements || {};
            const members = data.members || [];
            const connectLinks = data.connect?.links || data.settings?.connect_links || data.settings?.button_links || {};
            const stickyNotes = data.settings?.sticky_notes || {};

            // 1. Populate Metrics Bar
            populateStatsDeck(announcements, members);

            // 2. Populate Announcements & Bulletins
            populateAnnouncements(announcements, data.updates);

            // 3. Populate Members Directory
            renderMembers(members);

            // 4. Populate Buttons & Links Manager
            populateButtonManager(connectLinks);

            // 5. Populate Sticky Notes
            populateStickyNotes(stickyNotes);

            // 6. Populate Admin Profile Form
            populateAdminProfile(data.curator || currentCurator);

            // 7. Populate Sanctuary Feature Controls (Paper Airplane Default Off)
            populateFeatureControls(data.settings || {});

        } catch (err) {
            console.error('Error loading curator overview:', err);
        }
    }

    // Populate Top Quick Stats Deck
    function populateStatsDeck(announcements, members) {
        const activeCount = members.filter(m => m.status !== 'suspended').length;
        const totalCount = members.length;

        const statMembersCount = document.getElementById('statMembersCount');
        const statMembersTotal = document.getElementById('statMembersTotal');
        if (statMembersCount) statMembersCount.textContent = `${activeCount} Soul${activeCount === 1 ? '' : 's'}`;
        if (statMembersTotal) statMembersTotal.textContent = `${totalCount} Registered in Circle`;

        const r = announcements.this_weeks_reading || {};
        const statBookTitle = document.getElementById('statBookTitle');
        const statBookAuthor = document.getElementById('statBookAuthor');
        if (statBookTitle) statBookTitle.textContent = r.title || 'The Stranger';
        if (statBookAuthor) statBookAuthor.textContent = r.author ? `by ${r.author}` : 'by Albert Camus';

        const g = announcements.gathering || {};
        const statMeetingDate = document.getElementById('statMeetingDate');
        const statMeetingLoc = document.getElementById('statMeetingLoc');
        if (statMeetingDate) statMeetingDate.textContent = g.date || 'Saturday, 4 Oct';
        if (statMeetingLoc) statMeetingLoc.textContent = `${g.location || 'MRDU Campus'} • ${g.time || '4:00 PM'}`;
    }

    // 1. Populate Announcements Forms & Active Bulletins List
    function populateAnnouncements(announcements, bulletins) {
        // Theme
        const theme = announcements.weekly_theme || {};
        const themeTitleInput = document.getElementById('weeklyThemeTitleInput');
        const themeSubtitleInput = document.getElementById('weeklyThemeSubtitleInput');
        if (themeTitleInput) themeTitleInput.value = theme.theme || '';
        if (themeSubtitleInput) themeSubtitleInput.value = theme.subtitle || theme.quote || '';

        // Reading
        const book = announcements.this_weeks_reading || {};
        const bookTitleInput = document.getElementById('bookTitleInput');
        const bookAuthorInput = document.getElementById('bookAuthorInput');
        const bookNotesInput = document.getElementById('bookNotesInput');
        const bookDriveUrlInput = document.getElementById('bookDriveUrlInput');
        if (bookTitleInput) bookTitleInput.value = book.title || '';
        if (bookAuthorInput) bookAuthorInput.value = book.author || '';
        if (bookNotesInput) bookNotesInput.value = book.notes || '';
        if (bookDriveUrlInput) bookDriveUrlInput.value = book.drive_url || '';

        // Gathering
        const meeting = announcements.gathering || {};
        const meetingDateInput = document.getElementById('meetingDateInput');
        const meetingTimeInput = document.getElementById('meetingTimeInput');
        const meetingLocationInput = document.getElementById('meetingLocationInput');
        const meetingMapsUrlInput = document.getElementById('meetingMapsUrlInput');
        if (meetingDateInput) meetingDateInput.value = meeting.date || '';
        if (meetingTimeInput) meetingTimeInput.value = meeting.time || '';
        if (meetingLocationInput) meetingLocationInput.value = meeting.location || '';
        if (meetingMapsUrlInput) meetingMapsUrlInput.value = meeting.maps_url || '';

        // Discussion Points & Important Notes
        const dpInput = document.getElementById('discussionPointsInput');
        const impInput = document.getElementById('importantNotesInput');
        if (dpInput) {
            const pts = announcements.discussion_points;
            if (Array.isArray(pts)) {
                dpInput.value = pts.join('\n');
            } else if (typeof pts === 'string') {
                dpInput.value = pts;
            }
        }
        if (impInput) {
            impInput.value = announcements.important_notes || '';
        }

        // Active Bulletins List
        const listEl = document.getElementById('curatorUpdatesList');
        if (listEl) {
            const list = bulletins || announcements.bulletins || [];
            if (list.length === 0) {
                listEl.innerHTML = '<p style="font-size: 13px; color: var(--wabi-ink-muted); margin: 0;">No notices published yet.</p>';
            } else {
                listEl.innerHTML = list.map(u => `
                    <div style="border: 1px solid var(--wabi-border-subtle); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--wabi-card-subtle);">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div>
                                <strong style="font-size: 14px; color: var(--wabi-ink);">${escapeHtml(u.title)}</strong>
                                ${u.is_pinned ? '<span style="font-size: 9px; text-transform: uppercase; background: rgba(39, 59, 43, 0.12); color: var(--moss-dark); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">Pinned</span>' : ''}
                                <p style="font-size: 12.5px; color: var(--wabi-ink-secondary); margin: 5px 0 0; line-height: 1.4;">${escapeHtml(u.content)}</p>
                            </div>
                            <button type="button" class="c-btn-action" style="color: #A23434; border-color: rgba(180, 50, 50, 0.3);" onclick="window.deleteCuratorUpdate('${u.id}')" title="Delete Notice">
                                <span>✕</span>
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    // 2. Render Members Directory
    function renderMembers(members) {
        if (members) currentMembersList = members;
        const container = document.getElementById('curatorMembersList');
        const countBadge = document.getElementById('curatorPeopleCountBadge');

        const activeCount = currentMembersList.filter(m => m.status !== 'suspended').length;
        const totalCount = currentMembersList.length;

        if (countBadge) {
            countBadge.textContent = `${activeCount} soul${activeCount === 1 ? '' : 's'} active · ${totalCount} total`;
        }

        if (!container) return;

        let displayList = currentMembersList;
        if (memberSearchQuery) {
            const q = memberSearchQuery.toLowerCase();
            displayList = displayList.filter(m => {
                const name = (m.full_name || m.name || '').toLowerCase();
                const dName = (m.display_name || '').toLowerCase();
                const handle = (m.handle || '').toLowerCase();
                const role = (m.role || '').toLowerCase();
                const status = (m.status || 'active').toLowerCase();
                return name.includes(q) || dName.includes(q) || handle.includes(q) || role.includes(q) || status.includes(q);
            });
        }

        if (!displayList || displayList.length === 0) {
            container.innerHTML = `<p style="font-size: 13.5px; color: var(--wabi-ink-muted); text-align: center; padding: 28px 0;">No circle members match "${escapeHtml(memberSearchQuery)}".</p>`;
            return;
        }

        container.innerHTML = displayList.map(m => {
            const memberId = String(m.id || '');
            if (!/^[A-Za-z0-9_-]{1,80}$/.test(memberId)) return '';
            const isSuspended = m.status === 'suspended';
            const avatarUrl = safeHttpUrl(m.avatar_url || '/assets/user_avatar.jpg') || '/assets/user_avatar.jpg';
            const displayName = escapeHtml(m.display_name || m.full_name || m.name);
            const handleText = m.handle ? escapeHtml(m.handle) : `@${escapeHtml((m.name || 'member').toLowerCase().replace(/\s+/g, ''))}`;
            const dateJoined = escapeHtml(m.date_joined || 'Autumn 2026');

            return `
            <div class="curator-member-card" id="member-card-${memberId}">
                <div class="curator-member-info">
                    <img src="${escapeHtml(avatarUrl)}" alt="${displayName}" class="curator-member-avatar" onerror="this.src='/assets/user_avatar.jpg'">
                    <div class="curator-member-meta">
                        <div class="curator-member-name-row">
                            <span class="curator-member-name">${displayName}</span>
                            <span class="member-status-badge ${isSuspended ? 'member-status-suspended' : 'member-status-active'}">
                                ${isSuspended ? 'Suspended' : 'Active'}
                            </span>
                            <span style="font-size: 9px; font-weight: 600; text-transform: uppercase; padding: 1px 6px; border-radius: 999px; background: rgba(39, 59, 43, 0.08); color: var(--wabi-ink);">
                                ${escapeHtml(m.role || 'Member')}
                            </span>
                        </div>
                        <div class="curator-member-handle">${handleText}</div>
                        <div class="curator-member-since">Member since ${dateJoined}</div>
                    </div>
                </div>
                <div class="curator-member-actions">
                    <a href="/my-space?preview=${encodeURIComponent(memberId)}" target="_blank" rel="noopener noreferrer" class="c-btn-action" title="Preview member desk">
                        <span>↗ Space</span>
                    </a>
                    <button type="button" class="c-btn-action" onclick="window.openEditMemberModal('${memberId}')" title="Edit member portrait">
                        <span>✎ Edit</span>
                    </button>
                    <button type="button" class="c-btn-action" onclick="window.regenerateMemberCode('${memberId}')" title="Regenerate secret code">
                        <span>🔑</span>
                    </button>
                    <button type="button" class="c-btn-action" onclick="window.openMemberQrModal('${memberId}')" title="Generate QR card">
                        <span>🪪</span>
                    </button>
                    <button type="button" class="c-btn-action" onclick="window.toggleMemberStatus('${memberId}', '${isSuspended ? 'active' : 'suspended'}')" title="${isSuspended ? 'Restore access' : 'Suspend access'}">
                        <span>${isSuspended ? '✓' : '⏸'}</span>
                    </button>
                    <button type="button" class="c-btn-action" style="color: #A23434;" onclick="window.deleteCuratorMember('${memberId}')" title="Remove member">
                        <span>✕</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }

    // 3. Populate Button & Link Command Center
    function populateButtonManager(links) {
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        setVal('btnUrlChat', links.community_chat_url);
        setVal('btnLabelChat', links.community_chat_label);

        setVal('btnUrlDrive', links.book_drive_url);
        setVal('btnLabelDrive', links.book_drive_label);

        setVal('btnUrlMaps', links.meeting_maps_url);
        setVal('btnLabelMaps', links.meeting_maps_label);

        setVal('btnUrlWa', links.whatsapp_url);
        setVal('btnLabelWa', links.whatsapp_label);

        setVal('btnUrlDisc', links.discord_url);
        setVal('btnLabelDisc', links.discord_label);

        setVal('btnUrlInsta', links.instagram_url);
        setVal('btnLabelInsta', links.instagram_label);

        setVal('btnUrlGoodreads', links.goodreads_url);
        setVal('btnLabelGoodreads', links.goodreads_label);

        setVal('btnUrlCustom1', links.custom_btn_1_url);
        setVal('btnLabelCustom1', links.custom_btn_1_label);

        const customCheck = document.getElementById('btnCustom1Enabled');
        if (customCheck) customCheck.checked = Boolean(links.custom_btn_1_enabled);

        // Update live test button hrefs
        updateTestLinks();
    }

    function updateTestLinks() {
        const linkMap = [
            { input: 'btnUrlChat', btn: 'testChatLinkBtn' },
            { input: 'btnUrlDrive', btn: 'testDriveLinkBtn' },
            { input: 'btnUrlMaps', btn: 'testMapsLinkBtn' },
            { input: 'btnUrlWa', btn: 'testWaLinkBtn' },
            { input: 'btnUrlDisc', btn: 'testDiscLinkBtn' },
            { input: 'btnUrlInsta', btn: 'testInstaLinkBtn' },
            { input: 'btnUrlGoodreads', btn: 'testGoodreadsLinkBtn' }
        ];

        linkMap.forEach(item => {
            const inputEl = document.getElementById(item.input);
            const btnEl = document.getElementById(item.btn);
            if (inputEl && btnEl) {
                const update = () => {
                    const url = safeHttpUrl((inputEl.value || '').trim());
                    btnEl.href = url || '#';
                    btnEl.style.opacity = url ? '1' : '0.4';
                    btnEl.style.pointerEvents = url ? 'auto' : 'none';
                };
                if (!inputEl._testLinkBound) {
                    inputEl.addEventListener('input', update);
                    inputEl._testLinkBound = true;
                }
                update();
            }
        });
    }

    // 4. Populate Sticky Notes
    function populateStickyNotes(notes) {
        const booksEl = document.getElementById('stickyNoteBooks');
        const filmsEl = document.getElementById('stickyNoteFilms');
        const discussEl = document.getElementById('stickyNoteDiscuss');
        const commEl = document.getElementById('stickyNoteCommunity');

        if (booksEl) booksEl.value = notes.books || '“Ideas that take quiet root, and stay with you for years.”';
        if (filmsEl) filmsEl.value = notes.films || '“Quiet frames that open unexpected rooms in the mind.”';
        if (discussEl) discussEl.value = notes.discussions || 'Conversations held with patience, without judgment.';
        if (commEl) commEl.value = notes.community || '“Kindred souls who feel the quiet rhythm of life.”';
    }

    // 5. Populate Admin Profile
    function populateAdminProfile(curator) {
        if (!curator) return;
        const nameInput = document.getElementById('adminDisplayNameInput');
        const handleInput = document.getElementById('adminHandleInput');
        const emailInput = document.getElementById('adminEmailInput');

        if (nameInput) nameInput.value = curator.displayName || curator.display_name || 'Wabi Sabi Admin';
        if (handleInput) handleInput.value = (curator.handle || 'admin').replace(/^@/, '');
        if (emailInput) emailInput.value = curator.email || 'wabisabiofficial3@gmail.com';
    }

    // 6. Populate Sanctuary Feature Controls (Paper Airplane Option)
    function populateFeatureControls(settings) {
        const isPaperPlaneEnabled = Boolean(settings && (settings.paper_plane_enabled === true || settings.paper_plane_enabled === 'true'));
        const checkbox = document.getElementById('paperPlaneToggleCheckbox');
        const statusBadge = document.getElementById('paperPlaneStatusBadge');
        const statusText = document.getElementById('paperPlaneToggleText');

        if (checkbox) {
            checkbox.checked = isPaperPlaneEnabled;
        }
        if (statusBadge) {
            statusBadge.textContent = isPaperPlaneEnabled ? 'ON (Active)' : 'OFF (Default)';
            statusBadge.style.background = isPaperPlaneEnabled ? 'rgba(39, 59, 43, 0.15)' : 'rgba(120, 115, 105, 0.15)';
            statusBadge.style.color = isPaperPlaneEnabled ? 'var(--moss-dark, #273B2B)' : 'var(--wabi-ink-muted, #7A7264)';
        }
        if (statusText) {
            statusText.textContent = isPaperPlaneEnabled ? 'ON' : 'OFF';
            statusText.style.color = isPaperPlaneEnabled ? 'var(--moss-dark, #273B2B)' : 'var(--wabi-ink-muted, #7A7264)';
        }
    }

    // Form Event Listeners & Actions
    function setupFormHandlers() {
        // 1. Weekly Theme
        const themeForm = document.getElementById('themeForm');
        if (themeForm) {
            themeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const weekly_theme = {
                    theme: document.getElementById('weeklyThemeTitleInput').value.trim(),
                    subtitle: document.getElementById('weeklyThemeSubtitleInput').value.trim()
                };

                try {
                    const res = await fetch('/api/curator/announcements', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ weekly_theme })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Weekly Theme updated!', data);
                    } else {
                        showToast(data.error || 'Failed to update theme.', true);
                    }
                } catch (err) {
                    showToast('Network error saving weekly theme.', true);
                }
            });
        }

        // 2. Reading Details Form
        const readingForm = document.getElementById('readingDetailsForm');
        if (readingForm) {
            readingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const this_weeks_reading = {
                    title: document.getElementById('bookTitleInput').value.trim(),
                    author: document.getElementById('bookAuthorInput').value.trim(),
                    notes: document.getElementById('bookNotesInput').value.trim(),
                    drive_url: document.getElementById('bookDriveUrlInput').value.trim()
                };

                try {
                    const res = await fetch('/api/curator/announcements', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ this_weeks_reading })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Reading selection updated!', data);
                        const statBookTitle = document.getElementById('statBookTitle');
                        const statBookAuthor = document.getElementById('statBookAuthor');
                        if (statBookTitle) statBookTitle.textContent = this_weeks_reading.title;
                        if (statBookAuthor) statBookAuthor.textContent = `by ${this_weeks_reading.author}`;
                    } else {
                        showToast(data.error || 'Failed to save reading details.', true);
                    }
                } catch (err) {
                    showToast('Network error saving reading details.', true);
                }
            });
        }

        // 3. Meeting Gathering Details Form
        const meetingForm = document.getElementById('meetingDetailsForm');
        if (meetingForm) {
            meetingForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const gathering = {
                    date: document.getElementById('meetingDateInput').value.trim(),
                    time: document.getElementById('meetingTimeInput').value.trim(),
                    location: document.getElementById('meetingLocationInput').value.trim(),
                    maps_url: document.getElementById('meetingMapsUrlInput').value.trim()
                };

                try {
                    const res = await fetch('/api/curator/announcements', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ gathering })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Gathering salon details updated!', data);
                        const statMeetingDate = document.getElementById('statMeetingDate');
                        const statMeetingLoc = document.getElementById('statMeetingLoc');
                        if (statMeetingDate) statMeetingDate.textContent = gathering.date;
                        if (statMeetingLoc) statMeetingLoc.textContent = `${gathering.location} • ${gathering.time}`;
                    } else {
                        showToast(data.error || 'Failed to save gathering details.', true);
                    }
                } catch (err) {
                    showToast('Network error saving gathering details.', true);
                }
            });
        }

        // 4. Discussion Inquiries & Notice Banner Form
        const dpForm = document.getElementById('discussionPointsForm');
        if (dpForm) {
            dpForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const rawPoints = document.getElementById('discussionPointsInput').value;
                const important_notes = document.getElementById('importantNotesInput').value.trim();

                try {
                    const res = await fetch('/api/curator/announcements', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            discussion_points: rawPoints,
                            important_notes
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Discussion inquiries and notice updated!', data);
                    } else {
                        showToast(data.error || 'Failed to save notes.', true);
                    }
                } catch (err) {
                    showToast('Network error saving discussion points.', true);
                }
            });
        }

        // 5. Publish Bulletin Form
        const noticeForm = document.getElementById('newAnnouncementForm');
        if (noticeForm) {
            noticeForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = document.getElementById('announcementTitle').value;
                const content = document.getElementById('announcementContent').value;
                const isPinned = document.getElementById('announcementPinned').checked;

                try {
                    const res = await fetch('/api/curator/updates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ title, content, is_pinned: isPinned })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Bulletin published to public wall!', data);
                        noticeForm.reset();
                        document.getElementById('announcementPinned').checked = true;
                        loadDashboardData();
                    } else {
                        showToast(data.error || 'Failed to publish bulletin.', true);
                    }
                } catch (err) {
                    showToast('Network error while publishing bulletin.', true);
                }
            });
        }

        // 6. Buttons & Links Command Form (User-requested feature)
        const btnForm = document.getElementById('buttonManagerForm');
        if (btnForm) {
            btnForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    community_chat_url: document.getElementById('btnUrlChat')?.value.trim() || '',
                    community_chat_label: document.getElementById('btnLabelChat')?.value.trim() || 'Join Community Lounge',
                    book_drive_url: document.getElementById('btnUrlDrive')?.value.trim() || '',
                    book_drive_label: document.getElementById('btnLabelDrive')?.value.trim() || 'Open Book Drive',
                    meeting_maps_url: document.getElementById('btnUrlMaps')?.value.trim() || '',
                    meeting_maps_label: document.getElementById('btnLabelMaps')?.value.trim() || 'Open in Google Maps',
                    whatsapp_url: document.getElementById('btnUrlWa')?.value.trim() || '',
                    whatsapp_label: document.getElementById('btnLabelWa')?.value.trim() || 'WhatsApp Channel',
                    discord_url: document.getElementById('btnUrlDisc')?.value.trim() || '',
                    discord_label: document.getElementById('btnLabelDisc')?.value.trim() || 'Discord Lounge',
                    instagram_url: document.getElementById('btnUrlInsta')?.value.trim() || '',
                    instagram_label: document.getElementById('btnLabelInsta')?.value.trim() || 'Instagram',
                    goodreads_url: document.getElementById('btnUrlGoodreads')?.value.trim() || '',
                    goodreads_label: document.getElementById('btnLabelGoodreads')?.value.trim() || 'Goodreads Circle',
                    custom_btn_1_url: document.getElementById('btnUrlCustom1')?.value.trim() || '',
                    custom_btn_1_label: document.getElementById('btnLabelCustom1')?.value.trim() || '',
                    custom_btn_1_enabled: document.getElementById('btnCustom1Enabled')?.checked || false
                };

                try {
                    const res = await fetch('/api/curator/buttons', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(payload)
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ All Button Links & Labels updated live!', data);
                        updateTestLinks();
                    } else {
                        showToast(data.error || 'Failed to save button links.', true);
                    }
                } catch (err) {
                    showToast('Network error saving button links.', true);
                }
            });
        }

        // 7. Sticky Notes Form
        const stickyForm = document.getElementById('stickyNotesForm');
        if (stickyForm) {
            stickyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const notes = {
                    books: document.getElementById('stickyNoteBooks')?.value || '',
                    films: document.getElementById('stickyNoteFilms')?.value || '',
                    discussions: document.getElementById('stickyNoteDiscuss')?.value || '',
                    community: document.getElementById('stickyNoteCommunity')?.value || ''
                };

                try {
                    const res = await fetch('/api/curator/sticky-notes', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(notes)
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Desk sticky notes updated!', data);
                    } else {
                        showToast(data.error || 'Failed to save notes.', true);
                    }
                } catch (err) {
                    showToast('Network error saving sticky notes.', true);
                }
            });
        }

        // 8. Admin Profile & Security Form
        const profileForm = document.getElementById('adminProfileForm');
        if (profileForm) {
            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const displayName = document.getElementById('adminDisplayNameInput')?.value.trim() || '';
                const handle = document.getElementById('adminHandleInput')?.value.trim() || '';
                const email = document.getElementById('adminEmailInput')?.value.trim() || '';
                const currentPassword = document.getElementById('adminCurrentPasswordInput')?.value || '';
                const newPassword = document.getElementById('adminNewPasswordInput')?.value || '';
                const confirmPassword = document.getElementById('adminConfirmPasswordInput')?.value || '';

                if (newPassword && newPassword !== confirmPassword) {
                    showToast('New passwords do not match.', true);
                    return;
                }

                try {
                    const res = await fetch('/api/curator/profile', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            displayName,
                            handle,
                            email,
                            currentPassword,
                            newPassword
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast('✦ Admin Profile updated successfully!', data);
                        const nameEl = document.getElementById('curatorIdentityName');
                        if (nameEl) nameEl.textContent = displayName || 'Wabi Sabi Admin';
                        document.getElementById('adminCurrentPasswordInput').value = '';
                        document.getElementById('adminNewPasswordInput').value = '';
                        document.getElementById('adminConfirmPasswordInput').value = '';
                    } else {
                        showToast(data.error || 'Failed to update admin profile.', true);
                    }
                } catch (err) {
                    showToast('Network error saving admin profile.', true);
                }
            });
        }

        // 9. Sanctuary Feature Controls (Paper Airplane On/Off Toggle)
        const paperPlaneToggle = document.getElementById('paperPlaneToggleCheckbox');
        if (paperPlaneToggle) {
            paperPlaneToggle.addEventListener('change', async (e) => {
                const isEnabled = e.target.checked;
                populateFeatureControls({ paper_plane_enabled: isEnabled });

                try {
                    const res = await fetch('/api/curator/features', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ paper_plane_enabled: isEnabled })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast(isEnabled ? '✈️ Paper Airplane feature enabled on portal!' : '✦ Paper Airplane feature turned off (Default)', data);
                    } else {
                        showToast(data.error || 'Failed to update feature setting.', true);
                        e.target.checked = !isEnabled;
                        populateFeatureControls({ paper_plane_enabled: !isEnabled });
                    }
                } catch (err) {
                    showToast('Network error updating feature setting.', true);
                    e.target.checked = !isEnabled;
                    populateFeatureControls({ paper_plane_enabled: !isEnabled });
                }
            });
        }

        // 10. Member Directory Search
        const searchInput = document.getElementById('curatorMemberSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                memberSearchQuery = (e.target.value || '').trim();
                renderMembers();
            });
        }

        // 10. Create Member Modal Handlers
        const openCreateBtn = document.getElementById('openCreateMemberModalBtn');
        const closeCreateBtn = document.getElementById('closeCreateMemberModalBtn');
        const createForm = document.getElementById('createMemberForm');

        if (openCreateBtn) openCreateBtn.addEventListener('click', window.openCreateMemberModal);
        if (closeCreateBtn) closeCreateBtn.addEventListener('click', window.closeCreateMemberModal);

        if (createForm) {
            createForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const fullName = document.getElementById('newMemberFullName').value.trim();
                const displayName = (document.getElementById('newMemberDisplayName').value || '').trim();
                const handle = (document.getElementById('newMemberHandle').value || '').trim();
                const gender = document.getElementById('newMemberGender').value;
                const dateJoined = document.getElementById('newMemberDateJoined').value;
                const avatarUrl = (document.getElementById('newMemberAvatar').value || '').trim();
                const role = document.getElementById('newMemberRole').value || 'Member';
                const bio = (document.getElementById('newMemberBio').value || '').trim();

                const submitBtn = document.getElementById('btnSubmitCreateMember');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<span>Forging Secret Key...</span>';
                }

                try {
                    const res = await fetch('/api/curator/members', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            name: fullName,
                            full_name: fullName,
                            display_name: displayName || fullName,
                            handle: handle,
                            gender: gender,
                            date_joined: dateJoined,
                            avatar_url: avatarUrl || '/assets/user_avatar.jpg',
                            role: role,
                            bio: bio
                        })
                    });
                    const data = await res.json();
                    if (data.success && data.member && data.secretCode) {
                        window.closeCreateMemberModal();
                        latestCreatedMember = data.member;

                        // Populate Success Modal
                        document.getElementById('createdMemberNameDisplay').textContent = data.member.displayName || data.member.name;
                        document.getElementById('createdMemberHandleDisplay').textContent = data.member.handle ? data.member.handle : `@${(data.member.name || 'member').toLowerCase().replace(/\s+/g, '')}`;
                        document.getElementById('createdMemberSinceDisplay').textContent = data.member.dateJoined || data.member.date_joined || 'Autumn 2026';
                        document.getElementById('createdMemberCodeDisplay').textContent = data.secretCode;

                        const successModal = document.getElementById('memberCreatedModal');
                        if (successModal) successModal.style.display = 'flex';

                        showSaveToast(`✦ Secret Code created for ${data.member.displayName || data.member.name}!`, data);
                        if (data.members) renderMembers(data.members);
                    } else {
                        showToast(data.error || 'Failed to create member.', true);
                    }
                } catch (err) {
                    console.error('Error creating member:', err);
                    showToast('Network error creating member.', true);
                } finally {
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<span>Generate Secret Code & Register ✦</span>';
                    }
                }
            });
        }

        // 11. Member Created Modal Actions
        const closeCreatedBtn = document.getElementById('closeCreatedModalBtn');
        const copyCreatedCodeBtn = document.getElementById('btnCopyCreatedCode');
        const genCreatedQrBtn = document.getElementById('btnGenerateCreatedQr');
        const openCreatedSpaceBtn = document.getElementById('btnOpenCreatedSpace');

        if (closeCreatedBtn) closeCreatedBtn.addEventListener('click', window.closeMemberCreatedModal);

        if (copyCreatedCodeBtn) {
            copyCreatedCodeBtn.addEventListener('click', async () => {
                const code = document.getElementById('createdMemberCodeDisplay')?.textContent?.trim() || '';
                try {
                    await navigator.clipboard.writeText(code);
                    copyCreatedCodeBtn.innerHTML = '<span>Copied! ✓</span>';
                    setTimeout(() => { copyCreatedCodeBtn.innerHTML = '<span>📋 Copy Code</span>'; }, 2200);
                } catch (e) {
                    showToast('Code: ' + code);
                }
            });
        }

        if (genCreatedQrBtn) {
            genCreatedQrBtn.addEventListener('click', () => {
                if (latestCreatedMember && latestCreatedMember.id) {
                    window.closeMemberCreatedModal();
                    window.openMemberQrModal(latestCreatedMember.id);
                }
            });
        }

        if (openCreatedSpaceBtn) {
            openCreatedSpaceBtn.addEventListener('click', () => {
                if (latestCreatedMember && latestCreatedMember.id) {
                    window.open(`/my-space?preview=${latestCreatedMember.id}`, '_blank');
                }
            });
        }

        // 12. Edit Member Modal Form
        const closeEditBtn = document.getElementById('closeEditMemberModalBtn');
        const editForm = document.getElementById('editMemberForm');

        if (closeEditBtn) closeEditBtn.addEventListener('click', window.closeEditMemberModal);

        if (editForm) {
            editForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const id = document.getElementById('editMemberId').value;
                const fullName = document.getElementById('editMemberFullName').value.trim();
                const displayName = (document.getElementById('editMemberDisplayName').value || '').trim();
                const handle = (document.getElementById('editMemberHandle').value || '').trim();
                const gender = document.getElementById('editMemberGender').value;
                const dateJoined = document.getElementById('editMemberDateJoined').value;
                const role = document.getElementById('editMemberRole').value;
                const status = document.getElementById('editMemberStatus').value;
                const avatarUrl = (document.getElementById('editMemberAvatar').value || '').trim();
                const bio = (document.getElementById('editMemberBio').value || '').trim();

                try {
                    const res = await fetch(`/api/curator/members/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                            name: fullName,
                            full_name: fullName,
                            display_name: displayName || fullName,
                            handle,
                            gender,
                            date_joined: dateJoined,
                            role,
                            status,
                            avatar_url: avatarUrl,
                            bio
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showSaveToast(`✦ Portrait updated for ${displayName || fullName}!`, data);
                        window.closeEditMemberModal();
                        if (data.members) renderMembers(data.members);
                    } else {
                        showToast(data.error || 'Failed to update member.', true);
                    }
                } catch (err) {
                    showToast('Network error saving member details.', true);
                }
            });
        }

        // 13. Member Card & QR Modal Handlers
        const closeCardBtn = document.getElementById('closeCardModalBtn');
        const closeCardBottomBtn = document.getElementById('btnCloseCardModalBottom');
        const copyClaimUrlBtn = document.getElementById('btnCopyClaimUrl');
        const printCardBtn = document.getElementById('btnPrintCard');

        if (closeCardBtn) closeCardBtn.addEventListener('click', window.closeMemberCardModal);
        if (closeCardBottomBtn) closeCardBottomBtn.addEventListener('click', window.closeMemberCardModal);

        if (copyClaimUrlBtn) {
            copyClaimUrlBtn.addEventListener('click', async () => {
                const url = document.getElementById('cardClaimUrlInput')?.value || '';
                try {
                    await navigator.clipboard.writeText(url);
                    copyClaimUrlBtn.textContent = 'Copied! ✓';
                    setTimeout(() => { copyClaimUrlBtn.textContent = 'Copy'; }, 2000);
                } catch (e) {
                    showToast('Pass URL: ' + url);
                }
            });
        }

        if (printCardBtn) {
            printCardBtn.addEventListener('click', () => {
                window.print();
            });
        }

        // 14. Regenerated Code Modal Handlers
        const closeRegenBtn = document.getElementById('closeRegenModalBtn');
        const closeRegenBottomBtn = document.getElementById('btnCloseRegenBottom');
        const copyRegenCodeBtn = document.getElementById('btnCopyRegenCode');

        const closeRegenModal = () => {
            const modal = document.getElementById('codeRegeneratedModal');
            if (modal) modal.style.display = 'none';
        };

        if (closeRegenBtn) closeRegenBtn.addEventListener('click', closeRegenModal);
        if (closeRegenBottomBtn) closeRegenBottomBtn.addEventListener('click', closeRegenModal);

        if (copyRegenCodeBtn) {
            copyRegenCodeBtn.addEventListener('click', async () => {
                const code = document.getElementById('regenCodeDisplay')?.textContent?.trim() || '';
                try {
                    await navigator.clipboard.writeText(code);
                    copyRegenCodeBtn.innerHTML = '<span>Copied! ✓</span>';
                    setTimeout(() => { copyRegenCodeBtn.innerHTML = '<span>📋 Copy New Code</span>'; }, 2000);
                } catch (e) {
                    showToast('Code: ' + code);
                }
            });
        }

        // 15. Sign Out
        const signOutBtn = document.getElementById('curatorSignOutBtn');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                } catch (e) {}
                window.location.href = 'home.html';
            });
        }
    }

    // Modal Helpers Exposed to Global Scope
    window.openCreateMemberModal = function () {
        const modal = document.getElementById('createMemberModal');
        const form = document.getElementById('createMemberForm');
        if (form) form.reset();
        const dateInput = document.getElementById('newMemberDateJoined');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        const avatarInput = document.getElementById('newMemberAvatar');
        if (avatarInput) avatarInput.value = '/assets/user_avatar.jpg';
        if (modal) modal.style.display = 'flex';
        setTimeout(() => document.getElementById('newMemberFullName')?.focus(), 100);
    };

    window.closeCreateMemberModal = function () {
        const modal = document.getElementById('createMemberModal');
        if (modal) modal.style.display = 'none';
    };

    window.closeMemberCreatedModal = function () {
        const modal = document.getElementById('memberCreatedModal');
        if (modal) modal.style.display = 'none';
    };

    window.openEditMemberModal = function (id) {
        const m = currentMembersList.find(item => item.id === id);
        if (!m) return;

        document.getElementById('editMemberId').value = m.id;
        document.getElementById('editMemberFullName').value = m.full_name || m.name || '';
        document.getElementById('editMemberDisplayName').value = m.display_name || m.name || '';
        document.getElementById('editMemberHandle').value = m.handle || '';
        document.getElementById('editMemberGender').value = m.gender || '';
        document.getElementById('editMemberDateJoined').value = m.date_joined || '';
        document.getElementById('editMemberRole').value = m.role || 'Member';
        document.getElementById('editMemberStatus').value = m.status || 'active';
        document.getElementById('editMemberAvatar').value = m.avatar_url || '/assets/user_avatar.jpg';
        document.getElementById('editMemberBio').value = m.bio || '';

        const modal = document.getElementById('editMemberModal');
        if (modal) modal.style.display = 'flex';
    };

    window.closeEditMemberModal = function () {
        const modal = document.getElementById('editMemberModal');
        if (modal) modal.style.display = 'none';
    };

    window.regenerateMemberCode = async function (id) {
        const m = currentMembersList.find(item => item.id === id);
        const name = m ? (m.display_name || m.name) : 'Member';

        if (!confirm(`Are you sure you want to regenerate the Secret Code for ${name}?\n\nThe existing Secret Code will immediately stop working.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/curator/members/${id}/regenerate-code`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success && data.secretCode) {
                document.getElementById('regenMemberName').textContent = name;
                document.getElementById('regenCodeDisplay').textContent = data.secretCode;

                const modal = document.getElementById('codeRegeneratedModal');
                if (modal) modal.style.display = 'flex';

                showToast(`✦ New Secret Code generated for ${name}!`);
            } else {
                showToast(data.error || 'Failed to regenerate code.', true);
            }
        } catch (err) {
            showToast('Network error regenerating code.', true);
        }
    };

    window.openMemberQrModal = async function (id) {
        try {
            const res = await fetch(`/api/curator/members/${id}/generate-qr`, {
                method: 'POST',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                const member = data.member;
                document.getElementById('cardMemberNameDisplay').textContent = (member.name || 'Member').toUpperCase();
                document.getElementById('cardMemberRoleDisplay').textContent = (member.role || 'Member').toUpperCase();
                document.getElementById('cardMemberSinceDisplay').textContent = `Member since ${member.date_joined || 'Autumn 2026'}`;
                document.getElementById('cardQrImage').src = data.qrDataUrl;
                document.getElementById('cardClaimUrlInput').value = data.claimUrl;

                const modal = document.getElementById('memberCardModal');
                if (modal) modal.style.display = 'flex';
            } else {
                showToast(data.error || 'Failed to generate pass.', true);
            }
        } catch (err) {
            showToast('Network error generating membership pass.', true);
        }
    };

    window.closeMemberCardModal = function () {
        const modal = document.getElementById('memberCardModal');
        if (modal) modal.style.display = 'none';
    };

    window.toggleMemberStatus = async function (id, nextStatus) {
        try {
            const res = await fetch(`/api/curator/members/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ status: nextStatus })
            });
            const data = await res.json();
            if (data.success) {
                showSaveToast(`✦ Membership status updated to ${nextStatus}.`, data);
                if (data.members) renderMembers(data.members);
            } else {
                showToast(data.error || 'Failed to update status.', true);
            }
        } catch (err) {
            showToast('Network error updating member status.', true);
        }
    };

    window.deleteCuratorMember = async function (id) {
        const m = currentMembersList.find(item => item.id === id);
        const name = m ? (m.display_name || m.name) : 'Member';

        if (!confirm(`Are you sure you want to remove ${name} from the sanctuary directory?\n\nThis will revoke their access code and delete their reading space.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/curator/members/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showSaveToast(`✦ ${name} removed from circle.`, data);
                if (data.members) renderMembers(data.members);
            } else {
                showToast(data.error || 'Failed to delete member.', true);
            }
        } catch (err) {
            showToast('Network error deleting member.', true);
        }
    };

    window.deleteCuratorUpdate = async function (id) {
        if (!confirm('Are you sure you want to delete this bulletin notice from the public portal?')) {
            return;
        }

        try {
            const res = await fetch(`/api/curator/updates/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showSaveToast('✦ Notice deleted from board.', data);
                loadDashboardData();
            } else {
                showToast(data.error || 'Failed to delete notice.', true);
            }
        } catch (err) {
            showToast('Network error deleting notice.', true);
        }
    };

    // Render Anti-Sleep Heartbeat (Zero Downtime Keep-Alive)
    function initAdminKeepAliveHeartbeat() {
        const pingHealth = async () => {
            try {
                await fetch('/api/health', { method: 'GET', cache: 'no-store' });
            } catch (e) {}
        };

        pingHealth();
        setInterval(pingHealth, 7 * 60 * 1000);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') pingHealth();
        });
        window.addEventListener('focus', pingHealth);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeHttpUrl(value) {
        if (typeof value !== 'string' || !value.trim()) return '';
        try {
            const parsed = new URL(value.trim(), window.location.origin);
            if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return '';
            return parsed.href;
        } catch (e) {
            return '';
        }
    }

    // Theme Controller
    function setupThemeToggle() {
        const savedTheme = localStorage.getItem('wabi_sabi_theme') || 'light';
        if (savedTheme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }

        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                if (next === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                localStorage.setItem('wabi_sabi_theme', next);
            });
        }
    }

    // Initialize on DOM Ready
    document.addEventListener('DOMContentLoaded', async () => {
        setupThemeToggle();
        const isAuthed = await checkAuth();
        if (isAuthed) {
            setupTabs();
            setupFormHandlers();
            loadDashboardData();
            initAdminKeepAliveHeartbeat();
        }
    });

})();
