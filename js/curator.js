/**
 * Wabi Sabi — Curator's Desk Controller (js/curator.js)
 * Manages:
 * 1. Curator role authorization check
 * 2. Tab switching (Library, Salons, Prompts, Permissions)
 * 3. Editing Today's Bookclub Pick with real-time preview & persistence
 * 4. Editing Salons / Gatherings with real-time preview & persistence
 * 5. Editing Sticky Note prompt headings
 * 6. Member Registry Table rendering
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Authorization: Only Curators may enter
    const session = window.WabiSabiStore ? window.WabiSabiStore.requireAuth(['Curator']) : null;
    if (!session) return; // Will redirect if not curator

    const curatorLabel = document.getElementById('cdCuratorNameLabel');
    if (curatorLabel) {
        curatorLabel.textContent = `${session.name} (@${session.handle})`;
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
        });
    });

    const content = window.WabiSabiStore.getContent();

    // 3. Tab 1: Library & Today's Pick
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

    // 4. Tab 2: Salons & Gatherings
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

    // 5. Tab 3: Community Prompts
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

    // 6. Tab 4: Member Registry Table
    const tableBody = document.getElementById('cdMembersTableBody');
    if (tableBody) {
        const accounts = window.WabiSabiStore.getAccounts();
        tableBody.innerHTML = '';

        accounts.forEach(acc => {
            const tr = document.createElement('tr');
            const roleClass = acc.role === 'Curator' ? 'badge-role-curator' : 'badge-role-reader';
            tr.innerHTML = `
                <td><strong>${acc.name}</strong></td>
                <td><span style="font-family: var(--font-sans); font-weight: 600; color: var(--forest-green);">@${acc.handle}</span> <span style="font-size: 10px; color: var(--ink-muted);">🔒</span></td>
                <td>${acc.email}</td>
                <td><span class="${roleClass}">${acc.role === 'Curator' ? '⚜ Curator' : '🌿 Reader'}</span></td>
                <td>${acc.joinedDate || 'Member'}</td>
            `;
            tableBody.appendChild(tr);
        });
    }
});
