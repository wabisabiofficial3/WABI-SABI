/**
 * Wabi Sabi — Public Coordination Portal Client Engine (js/portal.js)
 * Clean, lightweight, zero-auth data hydration from /api/portal.
 */

(function () {
    'use strict';

    // Theme toggle handling
    function initTheme() {
        const savedTheme = localStorage.getItem('wabi_theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }

        const themeBtn = document.getElementById('themeToggleBtn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-theme') || 'light';
                const next = current === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                if (next === 'dark') {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
                localStorage.setItem('wabi_theme', next);
            });
        }
    }

    // Format date string nicely
    function formatDate(isoString) {
        if (!isoString) return '';
        try {
            const date = new Date(isoString);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return isoString;
        }
    }

    // Hydrate portal content
    async function loadPortalData() {
        try {
            const res = await fetch('/api/portal');
            const data = await res.json();

            if (!data.success || !data.portal) {
                console.error('Failed to load portal data:', data);
                return;
            }

            const { updates, current_book, next_meeting, platform_links } = data.portal;

            // 1. Quick Access Links
            const quickChat = document.getElementById('quickChatBtn');
            const quickBooks = document.getElementById('quickBooksBtn');
            const quickMeeting = document.getElementById('quickMeetingBtn');

            if (quickChat && platform_links.community_chat_url) {
                quickChat.href = platform_links.community_chat_url;
            }
            if (quickBooks && (platform_links.book_drive_url || current_book.drive_url)) {
                quickBooks.href = platform_links.book_drive_url || current_book.drive_url;
            }
            if (quickMeeting && (platform_links.meeting_maps_url || next_meeting.maps_url)) {
                quickMeeting.href = platform_links.meeting_maps_url || next_meeting.maps_url;
            }

            // 2. Announcements / Updates List
            const updatesContainer = document.getElementById('updatesListContainer');
            if (updatesContainer) {
                if (!updates || updates.length === 0) {
                    updatesContainer.innerHTML = `
                        <div class="update-card" style="text-align: center; color: var(--wabi-ink-muted); padding: 32px;">
                            <p style="margin: 0;">No announcements posted yet. Check back soon.</p>
                        </div>
                    `;
                } else {
                    updatesContainer.innerHTML = updates.map(u => `
                        <article class="update-card ${u.is_pinned ? 'pinned' : ''}">
                            <div class="update-header-row">
                                <h3 class="update-title">${escapeHtml(u.title)}</h3>
                                ${u.is_pinned ? '<span class="update-meta-badge">📌 Notice</span>' : ''}
                            </div>
                            <div class="update-content">${escapeHtml(u.content)}</div>
                            <div class="update-footer">
                                <span>${formatDate(u.created_at)}</span>
                                <span class="update-author">— ${escapeHtml(u.author_name || 'Curators')}</span>
                            </div>
                        </article>
                    `).join('');
                }
            }

            // 3. Current Reading Section
            if (current_book) {
                const bookTitleEl = document.getElementById('featuredBookTitle');
                const bookAuthorEl = document.getElementById('featuredBookAuthor');
                const bookNotesEl = document.getElementById('featuredBookNotes');
                const bookDriveBtn = document.getElementById('bookDriveBtn');

                if (bookTitleEl) bookTitleEl.textContent = current_book.title || 'Untitled Selection';
                if (bookAuthorEl) bookAuthorEl.textContent = current_book.author ? `by ${current_book.author}` : '';
                if (bookNotesEl) bookNotesEl.textContent = `“${current_book.notes || 'A quiet read for contemplative minds.'}”`;
                if (bookDriveBtn && (current_book.drive_url || platform_links.book_drive_url)) {
                    bookDriveBtn.href = current_book.drive_url || platform_links.book_drive_url;
                }
            }

            // 4. Next Meeting Section
            if (next_meeting) {
                const meetingDateEl = document.getElementById('meetingDateVal');
                const meetingTimeEl = document.getElementById('meetingTimeVal');
                const meetingLocEl = document.getElementById('meetingLocVal');
                const meetingMapsBtn = document.getElementById('meetingMapsBtn');

                if (meetingDateEl) meetingDateEl.textContent = next_meeting.date || 'TBA';
                if (meetingTimeEl) meetingTimeEl.textContent = next_meeting.time || 'TBA';
                if (meetingLocEl) meetingLocEl.textContent = next_meeting.location || 'TBA';
                if (meetingMapsBtn && (next_meeting.maps_url || platform_links.meeting_maps_url)) {
                    meetingMapsBtn.href = next_meeting.maps_url || platform_links.meeting_maps_url;
                }
            }

            // 5. Community Chat Card
            const communityChatBtn = document.getElementById('communityChatBtn');
            if (communityChatBtn && platform_links.community_chat_url) {
                communityChatBtn.href = platform_links.community_chat_url;
            }

        } catch (err) {
            console.error('Error fetching portal data:', err);
        }
    }

    // Helper to prevent XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // DOM Ready execution
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initTheme();
            loadPortalData();
        });
    } else {
        initTheme();
        loadPortalData();
    }

})();
