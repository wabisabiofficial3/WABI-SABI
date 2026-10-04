/**
 * ==============================================================================
 * WABI SABI — TABLE ROOM LIVE CHAT INTERACTION SCRIPT (js/table-room.js)
 * Dedicated interactivity for The Table Room discussion space:
 * - Real-time Member Chat Stream & Message Dispatch
 * - Simulated Responsive Bookclub Dialogue
 * - Reaction (Heart) Toggle & Like Counts
 * - In-line Reply Mention Generator
 * - "At the Table Now" Expandable Members Roster
 * - Book Info vs. Adaptation Tab Toggle
 * - Theme Synchronizer (Tea Glass / Coffee Cup)
 * ==============================================================================
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Client-side authentication guard
    if (window.WabiSabiStore) {
        const session = await window.WabiSabiStore.requireAuth(['USER', 'CURATOR', 'Reader', 'Curator']);
        if (!session) return;
        window.currentMemberSession = session;
    }

    // --------------------------------------------------------------------------
    // 1. Theme State Initialization & Synchronization
    // --------------------------------------------------------------------------
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('wabisabi_theme') || 
        localStorage.getItem('wabi_sabi_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-mode');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.remove('dark-mode');
        }
    }

    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-mode');
            const next = isDark ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('wabisabi_theme', next);
            localStorage.setItem('wabi_sabi_theme', next);
        });
    }

    // --------------------------------------------------------------------------
    // 2. Week Dropdown Selector (Interactive Discussion Week Switcher)
    // --------------------------------------------------------------------------
    let currentWeek = 4;
    const weekDropdownBtn = document.getElementById('weekDropdownBtn');
    const weekMenuDropdown = document.getElementById('weekMenuDropdown');
    const currentWeekLabel = document.getElementById('currentWeekLabel');

    if (weekDropdownBtn && weekMenuDropdown) {
        weekDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = weekMenuDropdown.style.display === 'flex';
            weekMenuDropdown.style.display = isOpen ? 'none' : 'flex';
            weekDropdownBtn.setAttribute('aria-expanded', String(!isOpen));
        });

        document.addEventListener('click', () => {
            weekMenuDropdown.style.display = 'none';
            weekDropdownBtn.setAttribute('aria-expanded', 'false');
        });

        const weekItems = weekMenuDropdown.querySelectorAll('.week-menu-item');
        weekItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const weekNum = parseInt(item.dataset.week, 10);
                if (weekNum) {
                    currentWeek = weekNum;
                    if (currentWeekLabel) currentWeekLabel.textContent = `Week ${weekNum}`;
                    weekItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    weekMenuDropdown.style.display = 'none';
                    weekDropdownBtn.setAttribute('aria-expanded', 'false');
                    loadChatMessages(weekNum);
                }
            });
        });
    }

    // --------------------------------------------------------------------------
    // 3. Chat Elements & Stream Scrolling
    // --------------------------------------------------------------------------
    const chatMessagesStream = document.getElementById('chatMessagesStream');
    const chatTextInput = document.getElementById('chatTextInput');
    const chatSendBtn = document.getElementById('chatSendBtn');
    const chatPlusBtn = document.getElementById('chatPlusBtn');
    const chatEmojiBtn = document.getElementById('chatEmojiBtn');
    const chatImgBtn = document.getElementById('chatImgBtn');

    // Auto-scroll stream to bottom smoothly
    function scrollChatToBottom(smooth = true) {
        if (!chatMessagesStream) return;
        chatMessagesStream.scrollTo({
            top: chatMessagesStream.scrollHeight,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }

    // Format current time as e.g. "7:24 PM"
    function formatTime(date = new Date()) {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const minutesStr = minutes < 10 ? '0' + minutes : minutes;
        return `${hours}:${minutesStr} ${ampm}`;
    }

    // Safe HTML escaping
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Render individual message card
    function renderMessageRow(msg, append = true) {
        if (!chatMessagesStream) return;
        const isOwn = window.currentMemberSession && (window.currentMemberSession.id === msg.userId || window.currentMemberSession.handle === msg.handle);
        const timeStr = msg.createdAt ? formatTime(new Date(msg.createdAt)) : formatTime();

        const row = document.createElement('div');
        row.className = `chat-message-row ${isOwn ? 'user-own-message' : ''}`;
        row.dataset.msgId = msg.id;

        let quoteHtml = '';
        if (msg.quoteRef) {
            quoteHtml = `
                <div class="msg-quote-ref">
                    <span class="quote-bar"></span>
                    <span class="quote-text">${escapeHtml(msg.quoteRef)}</span>
                </div>
            `;
        }

        const curatorBadge = msg.isCurator ? `<span class="curator-chat-badge">Curator</span>` : '';

        row.innerHTML = `
            <img src="${msg.avatar || 'assets/user_avatar.jpg'}" alt="${escapeHtml(msg.name)}" class="msg-avatar">
            <div class="msg-content-column">
                <div class="msg-header-line">
                    <span class="msg-author-name">${isOwn ? 'You' : escapeHtml(msg.name)}</span>
                    ${curatorBadge}
                    <span class="msg-timestamp">${timeStr}</span>
                </div>
                ${quoteHtml}
                <div class="msg-bubble">
                    ${escapeHtml(msg.content)}
                </div>
                <div class="msg-actions-row">
                    <button class="msg-react-btn msg-btn-like" data-likes="${msg.likesCount || 0}" data-msg-id="${msg.id}" title="Like reflection">
                        <span class="heart-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none" style="vertical-align: -1px; color: #C25E5E;" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></span>
                        <span class="likes-count">${msg.likesCount || 0}</span>
                    </button>
                    <button class="msg-react-btn msg-btn-reply" title="Reply to ${escapeHtml(msg.name)}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <button class="msg-more-btn" title="More options">···</button>
        `;

        if (append) {
            chatMessagesStream.appendChild(row);
            bindMessageEvents(row);
        } else {
            chatMessagesStream.appendChild(row);
        }
    }

    // Load server-persisted messages for the selected week
    async function loadChatMessages(week = 4) {
        currentWeek = week;
        if (!chatMessagesStream) return;

        try {
            const apiRes = await (window.WabiSabiStore
                ? window.WabiSabiStore.apiFetch(`/api/chat/messages?week=${week}`)
                : fetch(`/api/chat/messages?week=${week}`));

            if (apiRes.ok) {
                const data = await apiRes.json();
                if (data.success && Array.isArray(data.messages)) {
                    chatMessagesStream.innerHTML = '';
                    if (data.messages.length === 0) {
                        const emptyEl = document.createElement('div');
                        emptyEl.className = 'empty-chat-state';
                        emptyEl.style.cssText = 'text-align: center; padding: 40px 20px; color: var(--ink-muted); font-style: italic; font-family: var(--font-serif);';
                        emptyEl.innerHTML = `No thoughts have been shared for Week ${week} yet.<br><span style="font-size: 13px;">Pull up a chair and be the first to speak.</span>`;
                        chatMessagesStream.appendChild(emptyEl);
                    } else {
                        data.messages.forEach(msg => {
                            renderMessageRow(msg, false);
                        });
                    }
                    bindMessageEvents(chatMessagesStream);
                    scrollChatToBottom(false);
                    return;
                }
            }
        } catch (err) {
            console.warn('Failed to load chat messages from server, keeping default stream:', err);
        }
    }

    // Initial load from SQLite database
    loadChatMessages(currentWeek);

    // --------------------------------------------------------------------------
    // 4. Send Message Functionality (Server-Persisted)
    // --------------------------------------------------------------------------
    async function sendMessage() {
        if (!chatTextInput) return;
        const text = chatTextInput.value.trim();
        if (!text) return;

        chatTextInput.value = '';

        try {
            const payload = {
                content: text,
                week: currentWeek
            };

            const res = await (window.WabiSabiStore
                ? window.WabiSabiStore.apiFetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
                : fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }));

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.message) {
                    const emptyEl = chatMessagesStream.querySelector('.empty-chat-state');
                    if (emptyEl) emptyEl.remove();

                    renderMessageRow(data.message, true);
                    scrollChatToBottom(true);
                }
            } else {
                console.error('Failed to post message, server responded with error');
            }
        } catch (err) {
            console.error('Failed to post message to server:', err);
        }
    }

    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', sendMessage);
    }

    if (chatTextInput) {
        chatTextInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // --------------------------------------------------------------------------
    // 4. Simulated Live Member Interaction
    // --------------------------------------------------------------------------
    const simulatedResponses = [
        {
            author: "Aarav",
            avatar: "assets/avatar_aarav.jpg",
            text: "That touches on something crucial. Holden's defense mechanism is irony, but it leaves him isolated.",
            tint: false
        },
        {
            author: "Saanvi",
            avatar: "assets/avatar_aishwarya.jpg",
            text: "Exactly. The metaphor of the 'catcher in the rye' itself reveals his desire to freeze time before innocence is lost.",
            tint: false
        },
        {
            author: "Karthik",
            avatar: "assets/space_quiet_readers.jpg",
            text: "Well said! It reminds me of the museum scene where he wishes things could stay in glass cases forever.",
            tint: true
        }
    ];

    let replyIndex = 0;
    function triggerCommunityReply(triggerText) {
        const typingMemberEl = document.querySelector('.member-status.status-typing');
        const candidate = simulatedResponses[replyIndex % simulatedResponses.length];
        replyIndex++;

        // Simulate typing indication after a short delay
        setTimeout(() => {
            const timeStr = formatTime();
            const msgEl = document.createElement('div');
            msgEl.className = 'chat-message-row';
            msgEl.innerHTML = `
                <img src="${candidate.avatar}" alt="${candidate.author}" class="msg-avatar">
                <div class="msg-content-column">
                    <div class="msg-header-line">
                        <span class="msg-author-name">${candidate.author}</span>
                        <span class="msg-timestamp">${timeStr}</span>
                    </div>
                    <div class="msg-bubble ${candidate.tint ? 'bubble-tinted-sage' : ''}">
                        ${candidate.text}
                    </div>
                    <div class="msg-actions-row">
                        <button class="msg-react-btn msg-btn-like" data-likes="1" title="Like reflection">
                            <span class="heart-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none" style="vertical-align: -1px; color: #C25E5E;" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></span>
                            <span class="likes-count">1</span>
                        </button>
                        <button class="msg-react-btn msg-btn-reply" title="Reply to ${candidate.author}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                <button class="msg-more-btn" title="More options">···</button>
            `;
            chatMessagesStream.appendChild(msgEl);
            bindMessageEvents(msgEl);
            scrollChatToBottom(true);
        }, 3200);
    }

    // --------------------------------------------------------------------------
    // 5. Message Reactions & Reply Buttons
    // --------------------------------------------------------------------------
    function bindMessageEvents(container) {
        // Like buttons
        const likeBtns = container.querySelectorAll('.msg-btn-like');
        likeBtns.forEach(btn => {
            if (btn._hasBound) return;
            btn._hasBound = true;
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const msgId = btn.dataset.msgId;
                let count = parseInt(btn.dataset.likes || '0', 10);
                const isLiked = btn.classList.contains('liked');

                if (isLiked) {
                    btn.classList.remove('liked');
                    count = Math.max(0, count - 1);
                } else {
                    btn.classList.add('liked');
                    count += 1;
                    // Gentle micro-bounce animation
                    btn.style.transform = 'scale(1.2)';
                    setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);

                    if (msgId) {
                        try {
                            const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
                            await api(`/api/chat/messages/${encodeURIComponent(msgId)}/like`, { method: 'POST' });
                        } catch (err) {
                            console.warn('Failed to sync like with server:', err);
                        }
                    }
                }

                btn.dataset.likes = count;
                const countSpan = btn.querySelector('.likes-count');
                if (countSpan) countSpan.textContent = count;
            });
        });

        // Reply buttons
        const replyBtns = container.querySelectorAll('.msg-btn-reply');
        replyBtns.forEach(btn => {
            if (btn._hasBound) return;
            btn._hasBound = true;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const parentRow = btn.closest('.chat-message-row');
                const authorEl = parentRow ? parentRow.querySelector('.msg-author-name') : null;
                const author = authorEl ? authorEl.textContent.trim() : 'table';
                
                if (chatTextInput) {
                    chatTextInput.value = `@${author} `;
                    chatTextInput.focus();
                }
            });
        });
    }

    // Bind existing messages in DOM
    if (chatMessagesStream) {
        bindMessageEvents(chatMessagesStream);
    }

    // --------------------------------------------------------------------------
    // 6. Action Bar Extra Tools (Plus, Emoji, Image)
    // --------------------------------------------------------------------------
    if (chatPlusBtn && chatTextInput) {
        chatPlusBtn.addEventListener('click', () => {
            const promptOptions = [
                '“Certain things, they should stay the way they are.” — Ch. 16\n',
                '“Don\'t ever tell anybody anything. If you do, you start missing everybody.” — ',
                'Regarding chapter 7, what stood out to you most about Holden\'s reaction? '
            ];
            const choice = promptOptions[Math.floor(Math.random() * promptOptions.length)];
            chatTextInput.value = choice;
            chatTextInput.focus();
        });
    }

    if (chatEmojiBtn && chatTextInput) {
        chatEmojiBtn.addEventListener('click', () => {
            const emojis = ['🍵', '📖', '✨', '💭', '🌿', '💡', '🍂'];
            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
            chatTextInput.value += (chatTextInput.value.length && !chatTextInput.value.endsWith(' ') ? ' ' : '') + randomEmoji + ' ';
            chatTextInput.focus();
        });
    }

    if (chatImgBtn) {
        chatImgBtn.addEventListener('click', () => {
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('Passage capture & margin photo attachments are enabled for verified Bookclub members.');
            }
        });
    }

    // Message More Actions (Quote message into chat box)
    document.addEventListener('click', (e) => {
        const moreBtn = e.target.closest('.msg-more-btn');
        if (moreBtn) {
            e.stopPropagation();
            const bubble = moreBtn.closest('.msg-bubble');
            const textEl = bubble ? bubble.querySelector('.msg-text') : null;
            const text = textEl ? textEl.textContent.trim() : '';
            if (chatTextInput && text) {
                chatTextInput.value = `> "${text}"\n`;
                chatTextInput.focus();
            }
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('✦ Quoted message into reply input');
            }
        }
    });

    // --------------------------------------------------------------------------
    // 7. Expandable "+ 15 more" Members Roster
    // --------------------------------------------------------------------------
    const moreMembersBtn = document.getElementById('moreMembersBtn');
    const membersListScroll = document.getElementById('membersListScroll');

    const additionalMembers = [
        { name: "Maya", status: "online", dot: "dot-online", img: "assets/avatar_aishwarya.jpg" },
        { name: "Kabir", status: "reading", dot: "dot-reading", img: "assets/space_quiet_readers.jpg" },
        { name: "Dev", status: "online", dot: "dot-online", img: "assets/space_creative_vinyl.jpg" },
        { name: "Ananya", status: "reading", dot: "dot-reading", img: "assets/book_stack_corner.jpg" },
        { name: "Vikram", status: "online", dot: "dot-online", img: "assets/avatar_aarav.jpg" },
        { name: "Neha", status: "offline", dot: "dot-offline", img: "assets/avatar_meera.jpg" },
        { name: "Rohit", status: "reading", dot: "dot-reading", img: "assets/user_avatar.jpg" }
    ];

    let expanded = false;
    let extraNodes = [];

    if (moreMembersBtn && membersListScroll) {
        moreMembersBtn.addEventListener('click', () => {
            if (!expanded) {
                additionalMembers.forEach(mem => {
                    const item = document.createElement('div');
                    item.className = 'member-item member-item-extra';
                    item.innerHTML = `
                        <img src="${mem.img}" alt="${mem.name}" class="member-avatar">
                        <div class="member-info">
                            <span class="member-name">${mem.name}</span>
                            <span class="member-status status-${mem.status}">
                                <span class="status-dot ${mem.dot}"></span> ${mem.status}
                            </span>
                        </div>
                    `;
                    membersListScroll.insertBefore(item, moreMembersBtn);
                    extraNodes.push(item);
                });
                moreMembersBtn.textContent = 'Show less';
                expanded = true;
            } else {
                extraNodes.forEach(node => node.remove());
                extraNodes = [];
                moreMembersBtn.textContent = '+ 15 more';
                expanded = false;
            }
        });
    }

    // --------------------------------------------------------------------------
    // 8. Book Info vs. Adaptation Tab Switcher
    // --------------------------------------------------------------------------
    const infoPills = document.querySelectorAll('.info-pill-btn');
    const quoteEl = document.querySelector('.book-info-quote');

    const tabContents = {
        info: `"A story about innocence, disillusionment, and the search for a place to belong."`,
        adaptation: `"Salinger famously refused Hollywood adaptations, believing Holden’s internal monologue belongs strictly to the page."`
    };

    infoPills.forEach(pill => {
        pill.addEventListener('click', () => {
            infoPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            const tab = pill.dataset.tab;
            if (quoteEl && tabContents[tab]) {
                quoteEl.style.opacity = '0';
                setTimeout(() => {
                    quoteEl.textContent = tabContents[tab];
                    quoteEl.style.opacity = '1';
                }, 150);
            }
        });
    });

});
