/**
 * WABI SABI — COMMUNITY SPACE INTERACTION CONTROLLER
 * Poll → Vote → Thread Structured Interaction Loop
 */

document.addEventListener('DOMContentLoaded', async () => {
    // Client-side authentication guard
    if (window.WabiSabiStore) {
        const session = await window.WabiSabiStore.requireAuth(['USER', 'CURATOR', 'Reader', 'Curator']);
        if (!session) return;
        window.currentMemberSession = session;
    }

    initTheme();
    initPollVoting();
    initDiscussionInteractions();
    initSubtabs();
});

/* ==========================================================================
   THEME MANAGER (Day / Night with Tea Glass & Coffee Cup)
   ========================================================================== */
function initTheme() {
    const themeBtn = document.getElementById('themeToggleBtn');
    const html = document.documentElement;
    
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('wabisabi_theme') || 
        localStorage.getItem('wabi_sabi_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    applyTheme(savedTheme);

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const currentTheme = html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
            localStorage.setItem('wabisabi_theme', newTheme);
            localStorage.setItem('wabi_sabi_theme', newTheme);
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
   POLL VOTING CONTROLLER (Server-Backed Persistence)
   ========================================================================== */
function initPollVoting() {
    const optionLabels = document.querySelectorAll('.poll-option-label');
    const castVoteBtn = document.getElementById('btnCastVote');
    const resultsNotice = document.getElementById('votePrivacyNotice');
    const resultsVotecount = document.querySelector('.results-votecount');
    const resultBarItems = document.querySelectorAll('.result-bar-item');

    const OPTION_INDEX_MAP = {
        'yes': 0,
        'no': 1,
        'complicated': 2,
        'unsure': 3
    };

    // Option selection click handlers
    optionLabels.forEach(label => {
        label.addEventListener('click', (e) => {
            if (castVoteBtn && castVoteBtn.classList.contains('voted')) return;
            
            optionLabels.forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');
            const radio = label.querySelector('input[type="radio"]');
            if (radio) radio.checked = true;
        });
    });

    // Update results bar display with given poll data
    function renderPollResults(data, animate = true) {
        if (!data || !Array.isArray(data.choices)) return;

        if (resultsVotecount) {
            resultsVotecount.textContent = `${data.totalVotes} people voted`;
        }

        data.choices.forEach((choice, index) => {
            const barItem = resultBarItems[index];
            if (barItem) {
                const percentSpan = barItem.querySelector('.bar-percent');
                const fillEl = barItem.querySelector('.bar-fill');
                const percentageValue = Number(choice.percentage);
                const percentage = Number.isFinite(percentageValue)
                    ? Math.max(0, Math.min(100, percentageValue))
                    : 0;
                if (percentSpan) percentSpan.textContent = `${percentage}%`;
                if (fillEl) {
                    fillEl.style.transition = animate ? 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
                    fillEl.style.width = `${percentage}%`;
                }
            }
        });

        if (data.hasVoted) {
            markVotedState(true);
            if (typeof data.userVotedIndex === 'number') {
                const optKey = Object.keys(OPTION_INDEX_MAP).find(k => OPTION_INDEX_MAP[k] === data.userVotedIndex);
                if (optKey) {
                    const chosenLabel = document.querySelector(`.poll-option-label[data-option="${optKey}"]`);
                    if (chosenLabel) {
                        chosenLabel.classList.add('selected');
                        const r = chosenLabel.querySelector('input[type="radio"]');
                        if (r) r.checked = true;
                    }
                }
            }
        }
    }

    // Load current poll state from server
    async function loadPollState() {
        try {
            const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
            const res = await api('/api/community/poll?pollId=poll-week-04');
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    renderPollResults(data, false);
                }
            }
        } catch (err) {
            console.warn('Failed to load live poll state:', err);
        }
    }

    // Cast vote event
    if (castVoteBtn) {
        castVoteBtn.addEventListener('click', async () => {
            if (castVoteBtn.classList.contains('voted')) return;

            const selected = document.querySelector('.poll-option-label.selected');
            if (!selected) {
                showToast('Please select a perspective to cast your vote.');
                shakeElement(castVoteBtn);
                return;
            }

            const chosenValue = selected.getAttribute('data-option') || 'yes';
            const choiceIndex = OPTION_INDEX_MAP[chosenValue] ?? 0;

            try {
                const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
                const res = await api('/api/community/poll/vote', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pollId: 'poll-week-04', choiceIndex })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        renderPollResults(data, true);
                        showToast('Your perspective has been shared with the community.');
                    }
                } else if (res.status === 401) {
                    showToast('Please sign in to cast your vote.');
                }
            } catch (err) {
                console.error('Failed to submit poll vote:', err);
                markVotedState(false);
            }
        });
    }

    function markVotedState(immediate) {
        if (castVoteBtn) {
            castVoteBtn.classList.add('voted');
            castVoteBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Vote Cast — Results Unlocked</span>
            `;
        }

        if (resultsNotice) {
            resultsNotice.innerHTML = `
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 14 14"></polyline>
                </svg>
                <span>You voted! Results update live as other members respond.</span>
            `;
            resultsNotice.style.color = 'var(--accent-sage)';
        }
    }

    loadPollState();
}

/* ==========================================================================
   DISCUSSION THREAD & INTERACTIONS (Server-Backed Persistence)
   ========================================================================== */
function initDiscussionInteractions() {
    const commentInput = document.getElementById('commentInput');
    const sendBtn = document.getElementById('sendCommentBtn');
    const thoughtsContainer = document.getElementById('recentThoughtsContainer');
    const threadCallout = document.getElementById('discussionThreadCallout');
    const talkingCount = document.getElementById('talkingCount');

    // Likes on comments
    document.addEventListener('click', async (e) => {
        const likeBtn = e.target.closest('.stat-item.like-stat');
        if (!likeBtn) return;

        const thoughtId = likeBtn.dataset.thoughtId;
        const countSpan = likeBtn.querySelector('.like-count');
        let currentCount = parseInt(countSpan.textContent, 10) || 0;

        if (likeBtn.classList.contains('liked')) {
            likeBtn.classList.remove('liked');
            countSpan.textContent = Math.max(0, currentCount - 1);
        } else {
            likeBtn.classList.add('liked');
            countSpan.textContent = currentCount + 1;
            likeBtn.style.transform = 'scale(1.2)';
            setTimeout(() => { likeBtn.style.transform = 'scale(1)'; }, 200);

            if (thoughtId) {
                try {
                    const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
                    await api(`/api/community/thoughts/${encodeURIComponent(thoughtId)}/like`, { method: 'POST' });
                } catch (err) {
                    console.warn('Failed to sync thought like with server:', err);
                }
            }
        }
    });

    // Discussion banner click scrolls/focuses input
    if (threadCallout && commentInput) {
        threadCallout.addEventListener('click', () => {
            commentInput.focus();
            commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // Delegated actions: Comment Replies (💬), Read More Toggle, Previous Discussion
    document.addEventListener('click', (e) => {
        // Comment Reply Action (💬)
        const replyItem = e.target.closest('.stat-item:not(.like-stat)');
        if (replyItem) {
            const card = replyItem.closest('.comment-card');
            const authorSpan = card ? card.querySelector('.comment-author-name') : null;
            const author = authorSpan ? authorSpan.textContent.trim() : '';
            if (commentInput) {
                commentInput.value = author ? `@${author} ` : '';
                commentInput.focus();
                commentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Read More Toggle (.read-more-link)
        const readMoreBtn = e.target.closest('.read-more-link');
        if (readMoreBtn) {
            const parentP = readMoreBtn.closest('.comment-text');
            if (parentP) {
                const isExpanded = parentP.classList.toggle('expanded');
                readMoreBtn.textContent = isExpanded ? ' Show less' : 'Read more';
            }
            return;
        }

        // Previous Discussion Link
        const prevDiscLink = e.target.closest('#previous-discussion .btn-book-action');
        if (prevDiscLink) {
            e.preventDefault();
            showToast('✦ Viewing Previous Salon Archive: "Is nostalgia actually a good thing?" (212 votes)');
        }
    });

    // Render thought element into DOM
    function renderThoughtCard(t, prepend = false) {
        if (!thoughtsContainer || !t || typeof t !== 'object') return;
        const card = document.createElement('div');
        const thoughtId = String(t.id ?? '');
        const likesCount = safeCount(t.likesCount);
        card.className = 'comment-card';
        card.dataset.thoughtId = thoughtId;
        const timeAgo = formatTimeAgo(t.createdAt);

        card.innerHTML = `
            <div class="comment-avatar">
                <img src="${escapeHtml(safeAvatarUrl(t.avatar))}" alt="${escapeHtml(t.name)}">
            </div>
            <div class="comment-body">
                <div class="comment-top-row">
                    <div class="comment-author-info">
                        <span class="comment-author-name">${escapeHtml(t.name)}</span>
                        ${t.isCurator ? '<span class="curator-chat-badge" style="margin-left: 6px;">Curator</span>' : ''}
                        <span class="comment-time">${escapeHtml(timeAgo)}</span>
                    </div>
                    <div class="comment-stats">
                        <span class="stat-item like-stat" data-thought-id="${escapeHtml(thoughtId)}" title="Like comment">
                            <span>❤️</span> <span class="like-count">${likesCount}</span>
                        </span>
                        <span class="stat-item" title="Replies">
                            <span>💬</span> <span>0</span>
                        </span>
                    </div>
                </div>
                <p class="comment-text">${escapeHtml(t.content)}</p>
            </div>
        `;

        if (prepend) {
            card.style.opacity = '0';
            card.style.transform = 'translateY(-8px)';
            thoughtsContainer.insertBefore(card, thoughtsContainer.firstChild);
            requestAnimationFrame(() => {
                card.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            });
        } else {
            thoughtsContainer.appendChild(card);
        }
    }

    function formatTimeAgo(dateStr) {
        if (!dateStr) return 'Just now';
        const ms = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(ms / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    // Load server-persisted thoughts
    async function loadThoughts() {
        try {
            const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
            const res = await api('/api/community/thoughts?topicId=week-04-lost-in-translation');
            if (res.ok) {
                const data = await res.json();
                if (data.success && Array.isArray(data.thoughts) && data.thoughts.length > 0) {
                    thoughtsContainer.innerHTML = '';
                    data.thoughts.forEach(t => renderThoughtCard(t, false));
                    if (talkingCount) {
                        talkingCount.textContent = data.thoughts.length;
                    }
                }
            }
        } catch (err) {
            console.warn('Failed to load community thoughts from server:', err);
        }
    }

    // Submit comment to server
    async function submitComment() {
        if (!commentInput) return;
        const text = commentInput.value.trim();
        if (!text) {
            commentInput.focus();
            return;
        }

        commentInput.value = '';

        try {
            const api = window.WabiSabiStore ? window.WabiSabiStore.apiFetch : fetch;
            const res = await api('/api/community/thoughts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    topicId: 'week-04-lost-in-translation',
                    content: text
                })
            });

            if (res.ok) {
                const data = await res.json();
                if (data.success && data.thought) {
                    renderThoughtCard(data.thought, true);
                    showToast('Your thought has been shared in the thread.');
                    if (talkingCount) {
                        const current = parseInt(talkingCount.textContent, 10) || 0;
                        talkingCount.textContent = (current + 1);
                    }
                }
            } else if (res.status === 401) {
                showToast('Please sign in to share your thoughts.');
            }
        } catch (err) {
            console.error('Failed to post community thought:', err);
        }
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', submitComment);
    }

    if (commentInput) {
        commentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitComment();
            }
        });
    }

    loadThoughts();
}

/* ==========================================================================
   SUBTABS MANAGER
   ========================================================================== */
function initSubtabs() {
    const subtabs = document.querySelectorAll('.subtab-link');
    subtabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            subtabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabName = tab.getAttribute('data-subtab');
            if (tabName === 'past') {
                showToast('Viewing archive: 3 past weekly polls available.');
            } else if (tabName === 'threads') {
                showToast('Filtering for open member discussions.');
            }
        });
    });
}

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
function showToast(message) {
    let toast = document.getElementById('communityToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'communityToast';
        toast.className = 'wabi-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 3200);
}

function shakeElement(el) {
    el.style.animation = 'none';
    el.offsetHeight; // Trigger reflow
    el.style.animation = 'shake 0.4s ease';
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

function safeCount(value) {
    const count = Number(value);
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}
