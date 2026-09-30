/**
 * Wabi Sabi — Curator Dashboard Client Controller (js/curator.js)
 * Clean, lightweight 3-pillar CMS for Likith, Sarvasree, and Dhanush:
 * 1. Announcements (Weekly Theme, Reading, Gathering, Discussion Points, Important Notes, Bulletins)
 * 2. Community (Add/Remove members, roles, DPs)
 * 3. Connect (External platform links)
 */

(function () {
    'use strict';

    let currentCurator = null;

    // Toast helper
    function showToast(message, isError = false) {
        const toast = document.getElementById('curatorToast');
        if (!toast) return;
        toast.textContent = message;
        toast.style.background = isError ? '#c93b2b' : 'var(--wabi-forest-green, #273B2B)';
        toast.style.display = 'block';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 3200);
    }

    // Verify authenticated curator
    async function checkAuth() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            const data = await res.json();
            if (!data.success || !data.curator) {
                window.location.href = 'login.html?redirect=curator.html';
                return false;
            }
            currentCurator = data.curator;
            const nameEl = document.getElementById('curatorIdentityName');
            if (nameEl) {
                nameEl.textContent = `⚜ ${currentCurator.displayName || 'Curator'}`;
            }
            return true;
        } catch (err) {
            console.error('Curator auth check failed:', err);
            window.location.href = 'login.html?redirect=curator.html';
            return false;
        }
    }

    // Tab Switching Controller
    function setupTabs() {
        const tabs = [
            { btn: document.getElementById('curTabAnnouncements'), sec: document.getElementById('curatorSectionAnnouncements') },
            { btn: document.getElementById('curTabCommunity'), sec: document.getElementById('curatorSectionCommunity') },
            { btn: document.getElementById('curTabConnect'), sec: document.getElementById('curatorSectionConnect') }
        ];

        tabs.forEach(t => {
            if (t.btn && t.sec) {
                t.btn.addEventListener('click', () => {
                    tabs.forEach(other => {
                        other.btn.classList.remove('active');
                        other.sec.classList.remove('active');
                    });
                    t.btn.classList.add('active');
                    t.sec.classList.add('active');
                    history.replaceState(null, '', `#${t.btn.getAttribute('data-curator-tab')}`);
                });
            }
        });

        // Activate tab based on URL hash
        const hash = (window.location.hash || '').replace('#', '').toLowerCase();
        if (hash === 'community') {
            document.getElementById('curTabCommunity')?.click();
        } else if (hash === 'connect') {
            document.getElementById('curTabConnect')?.click();
        } else if (hash === 'announcements') {
            document.getElementById('curTabAnnouncements')?.click();
        }
    }

    // Load initial data
    async function loadDashboardData() {
        try {
            const res = await fetch('/api/curator/overview', { credentials: 'include' });
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = 'login.html?redirect=curator.html';
                }
                return;
            }
            const data = await res.json();
            if (!data.success) return;

            const announcements = data.announcements || {};
            const members = data.members || [];
            const connectLinks = (data.connect && data.connect.links) || data.settings?.connect_links || {};

            populateAnnouncements(announcements, data.updates);
            renderMembers(members);
            populateConnectLinks(connectLinks);
        } catch (err) {
            console.error('Error loading curator overview:', err);
        }
    }

    // 1. Populate Announcements forms & lists
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
                    <div class="active-announcement-card" id="card-${u.id}">
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                            <div>
                                <strong style="font-size: 14.5px; color: var(--wabi-ink);">${escapeHtml(u.title)}</strong>
                                ${u.is_pinned ? '<span style="font-size: 10px; text-transform: uppercase; background: var(--wabi-sage-soft); color: var(--wabi-forest-green); padding: 2px 6px; border-radius: 4px; margin-left: 6px; font-weight: 700;">Pinned</span>' : ''}
                                <p style="font-size: 13px; color: var(--wabi-ink-secondary); margin: 6px 0 0; line-height: 1.4;">${escapeHtml(u.content)}</p>
                            </div>
                            <button type="button" class="c-btn c-btn-danger" onclick="window.deleteCuratorUpdate('${u.id}')">
                                Delete
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    // 2. Render Community Members Directory
    function renderMembers(members) {
        const container = document.getElementById('curatorMembersList');
        if (!container) return;

        if (!members || members.length === 0) {
            container.innerHTML = '<p style="font-size: 13px; color: var(--wabi-ink-muted);">No members registered yet.</p>';
            return;
        }

        container.innerHTML = members.map(m => `
            <div class="member-row-item" id="member-row-${m.id}">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${m.avatar_url || '../assets/user_avatar.jpg'}" alt="${escapeHtml(m.name)}" style="width: 42px; height: 42px; border-radius: 50%; object-fit: cover; border: 1px solid var(--wabi-border-medium);" onerror="this.src='../assets/user_avatar.jpg'">
                    <div>
                        <div style="font-size: 14.5px; font-weight: 600; color: var(--wabi-ink);">
                            ${escapeHtml(m.name)}
                            <span style="font-size: 11px; text-transform: uppercase; padding: 2px 8px; border-radius: 999px; background: rgba(39, 59, 43, 0.1); color: var(--wabi-forest-green); margin-left: 6px;">${escapeHtml(m.role || 'Member')}</span>
                        </div>
                        <div style="font-size: 12px; color: var(--wabi-ink-muted); margin-top: 2px;">
                            ${m.handle ? `<span>${escapeHtml(m.handle)}</span> • ` : ''}
                            <span>${escapeHtml(m.bio || 'Wabi Sabi companion')}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <button type="button" class="c-btn c-btn-danger" onclick="window.deleteCuratorMember('${m.id}')">
                        Remove
                    </button>
                </div>
            </div>
        `).join('');
    }

    // 3. Populate Connect Links Form
    function populateConnectLinks(links) {
        if (!links) return;
        const chatInput = document.getElementById('chatUrlInput');
        const driveInput = document.getElementById('globalDriveUrlInput');
        const mapsInput = document.getElementById('globalMapsUrlInput');
        const instaInput = document.getElementById('instagramUrlInput');
        const waInput = document.getElementById('whatsappUrlInput');
        const discInput = document.getElementById('discordUrlInput');

        if (chatInput) chatInput.value = links.community_chat_url || '';
        if (driveInput) driveInput.value = links.book_drive_url || '';
        if (mapsInput) mapsInput.value = links.meeting_maps_url || '';
        if (instaInput) instaInput.value = links.instagram_url || '';
        if (waInput) waInput.value = links.whatsapp_url || '';
        if (discInput) discInput.value = links.discord_url || '';
    }

    // Global hook for deleting an announcement bulletin
    window.deleteCuratorUpdate = async function (id) {
        if (!confirm('Are you sure you want to remove this bulletin from the portal?')) return;
        try {
            const res = await fetch(`/api/curator/updates/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Bulletin removed.');
                loadDashboardData();
            } else {
                showToast(data.error || 'Failed to delete bulletin.', true);
            }
        } catch (err) {
            showToast('Network error deleting bulletin.', true);
        }
    };

    // Global hook for deleting a member
    window.deleteCuratorMember = async function (id) {
        if (!confirm('Are you sure you want to remove this person from the community directory?')) return;
        try {
            const res = await fetch(`/api/curator/members/${id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                showToast('Person removed from community directory.');
                renderMembers(data.members);
            } else {
                showToast(data.error || 'Failed to remove member.', true);
            }
        } catch (err) {
            showToast('Network error removing member.', true);
        }
    };

    // Form Event Listeners
    function setupFormHandlers() {
        // 1. Weekly Theme Form
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
                        showToast('Weekly theme updated!');
                    } else {
                        showToast(data.error || 'Failed to save theme.', true);
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
                        showToast('Reading selection updated!');
                    } else {
                        showToast(data.error || 'Failed to save reading details.', true);
                    }
                } catch (err) {
                    showToast('Network error saving reading details.', true);
                }
            });
        }

        // 3. Meeting Details Form
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
                        showToast('Gathering details updated!');
                    } else {
                        showToast(data.error || 'Failed to save gathering details.', true);
                    }
                } catch (err) {
                    showToast('Network error saving gathering details.', true);
                }
            });
        }

        // 4. Discussion Points & Important Notes Form
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
                        showToast('Discussion points and important notice updated!');
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
                        showToast('✦ Bulletin published to public portal!');
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

        // 6. Add Community Member Form
        const addMemberForm = document.getElementById('addMemberForm');
        if (addMemberForm) {
            addMemberForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('memberNameInput').value.trim();
                const role = document.getElementById('memberRoleSelect').value;
                const handle = document.getElementById('memberHandleInput').value.trim();
                const avatar_url = document.getElementById('memberAvatarInput').value.trim();
                const bio = document.getElementById('memberBioInput').value.trim();
                const display_order = parseInt(document.getElementById('memberOrderInput').value, 10) || 0;

                try {
                    const res = await fetch('/api/curator/members', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({ name, role, handle, avatar_url, bio, display_order })
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast(`✦ ${name} added to the community!`);
                        addMemberForm.reset();
                        document.getElementById('memberAvatarInput').value = '../assets/avatar_aishwarya.jpg';
                        document.getElementById('memberOrderInput').value = '10';
                        renderMembers(data.members);
                    } else {
                        showToast(data.error || 'Failed to add member.', true);
                    }
                } catch (err) {
                    showToast('Network error adding member.', true);
                }
            });
        }

        // 7. Platform External Links Form (Connect)
        const linksForm = document.getElementById('platformLinksForm');
        if (linksForm) {
            linksForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const links = {
                    community_chat_url: document.getElementById('chatUrlInput').value.trim(),
                    book_drive_url: document.getElementById('globalDriveUrlInput').value.trim(),
                    meeting_maps_url: document.getElementById('globalMapsUrlInput').value.trim(),
                    instagram_url: document.getElementById('instagramUrlInput').value.trim(),
                    whatsapp_url: document.getElementById('whatsappUrlInput').value.trim(),
                    discord_url: document.getElementById('discordUrlInput').value.trim()
                };

                try {
                    const res = await fetch('/api/curator/connect', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify(links)
                    });
                    const data = await res.json();
                    if (data.success) {
                        showToast('Connect platform links updated!');
                    } else {
                        showToast(data.error || 'Failed to save connect links.', true);
                    }
                } catch (err) {
                    showToast('Network error saving connect links.', true);
                }
            });
        }

        // 8. Sign Out Button
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

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Theme Restoration & Toggle Controller
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

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', async () => {
        setupThemeToggle();
        const isAuthed = await checkAuth();
        if (isAuthed) {
            setupTabs();
            setupFormHandlers();
            loadDashboardData();
        }
    });

})();
