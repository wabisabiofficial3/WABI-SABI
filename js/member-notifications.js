(() => {
    'use strict';

    const root = document.getElementById('memberNotificationRoot');
    if (!root) return;
    root.hidden = true;
    root.innerHTML = `
        <button type="button" class="member-notification-trigger" aria-haspopup="dialog" aria-expanded="false" aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path>
                <path d="M10 21h4"></path>
            </svg>
            <span class="member-notification-count" hidden></span>
        </button>
        <section class="member-notification-panel" role="dialog" aria-label="Member notifications" hidden>
            <header class="member-notification-header">
                <div>
                    <h2>Circle updates</h2>
                    <p class="member-notification-summary">Updates from your Curator</p>
                </div>
                <button type="button" class="member-notification-close" aria-label="Close notifications">×</button>
            </header>
            <div class="member-notification-preview-note" hidden>Read-only preview · these are this member’s notifications.</div>
            <div class="member-notification-actions">
                <button type="button" class="member-notification-mark-all" hidden>Mark all as read</button>
            </div>
            <div class="member-notification-list" aria-live="polite"></div>
        </section>
    `;

    const trigger = root.querySelector('.member-notification-trigger');
    const panel = root.querySelector('.member-notification-panel');
    const closeButton = root.querySelector('.member-notification-close');
    const list = root.querySelector('.member-notification-list');
    const countBadge = root.querySelector('.member-notification-count');
    const summary = root.querySelector('.member-notification-summary');
    const markAllButton = root.querySelector('.member-notification-mark-all');
    const previewNote = root.querySelector('.member-notification-preview-note');
    const params = new URLSearchParams(window.location.search);
    const previewId = params.get('preview');
    const isMemberDesk = /^\/my-space(?:\.html)?$/.test(window.location.pathname);
    const previewQuery = isMemberDesk && previewId ? `?preview=${encodeURIComponent(previewId)}` : '';

    let notifications = [];
    let unreadCount = 0;
    let readOnlyPreview = false;
    let requestPending = false;

    function setOpen(open) {
        panel.hidden = !open;
        trigger.setAttribute('aria-expanded', String(open));
        if (open) {
            refresh();
            closeButton.focus();
        }
    }

    function safeHref(value) {
        if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/';
        return value;
    }

    function displayTime(value) {
        if (typeof value !== 'string' || !value) return '';
        const date = new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'));
        if (Number.isNaN(date.getTime())) return '';
        return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
    }

    function render() {
        countBadge.hidden = unreadCount < 1;
        countBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
        countBadge.setAttribute('aria-label', `${unreadCount} unread`);
        trigger.setAttribute('aria-label', unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications');
        summary.textContent = unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'Updates from your Curator';
        previewNote.hidden = !readOnlyPreview;
        markAllButton.hidden = readOnlyPreview || unreadCount < 1;
        list.replaceChildren();

        if (!notifications.length) {
            const empty = document.createElement('p');
            empty.className = 'member-notification-empty';
            empty.textContent = 'No circle updates yet. New notices from your Curator will appear here.';
            list.appendChild(empty);
            return;
        }

        for (const notification of notifications) {
            const item = document.createElement(readOnlyPreview ? 'article' : 'button');
            item.className = `member-notification-item${notification.isRead ? '' : ' is-unread'}`;
            if (!readOnlyPreview) {
                item.type = 'button';
                item.setAttribute('aria-label', `${notification.title || 'Circle update'}. ${notification.message || ''}`);
            }
            const content = document.createElement('div');
            content.className = 'member-notification-copy';
            const title = document.createElement('h3');
            title.textContent = notification.title || 'Circle update';
            const message = document.createElement('p');
            message.textContent = notification.message || '';
            const time = document.createElement('time');
            time.textContent = displayTime(notification.created_at);
            if (notification.created_at) time.dateTime = notification.created_at.replace(' ', 'T') + 'Z';
            content.append(title, message, time);

            const marker = document.createElement('span');
            marker.className = 'member-notification-unread-dot';
            marker.setAttribute('aria-hidden', 'true');
            marker.hidden = Boolean(notification.isRead);
            item.append(marker, content);

            if (!readOnlyPreview) item.addEventListener('click', () => openNotification(notification));
            list.appendChild(item);
        }
    }

    async function refresh() {
        if (requestPending) return;
        requestPending = true;
        try {
            const response = await fetch(`/api/member/notifications${previewQuery}`, {
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            if (response.status === 401 || response.status === 403) {
                root.hidden = true;
                return;
            }
            const data = await response.json();
            if (!response.ok || !data.success || !Array.isArray(data.notifications)) return;
            notifications = data.notifications;
            unreadCount = Number.isFinite(Number(data.unreadCount)) ? Number(data.unreadCount) : 0;
            readOnlyPreview = Boolean(data.isCuratorPreview);
            root.hidden = false;
            render();
        } catch (error) {
            // A member should still be able to use the space when the optional feed is offline.
            console.warn('Member notifications are temporarily unavailable.');
        } finally {
            requestPending = false;
        }
    }

    async function updateReadState(url) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                credentials: 'same-origin',
                cache: 'no-store',
                headers: { Accept: 'application/json' }
            });
            const data = await response.json();
            if (response.ok && data.success) {
                notifications = data.notifications || notifications;
                unreadCount = Number(data.unreadCount) || 0;
                render();
                return true;
            }
        } catch (error) {
            console.warn('Could not update notification read state.');
        }
        return false;
    }

    async function openNotification(notification) {
        if (readOnlyPreview) return;
        if (!notification.isRead) {
            await updateReadState(`/api/member/notifications/${encodeURIComponent(notification.id)}/read`);
        }
        window.location.assign(safeHref(notification.href));
    }

    trigger.addEventListener('click', () => setOpen(panel.hidden));
    closeButton.addEventListener('click', () => {
        setOpen(false);
        trigger.focus();
    });
    markAllButton.addEventListener('click', () => updateReadState('/api/member/notifications/read-all'));
    document.addEventListener('click', event => {
        if (!panel.hidden && !root.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !panel.hidden) {
            setOpen(false);
            trigger.focus();
        }
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh();
    });

    refresh();
    window.setInterval(() => {
        if (document.visibilityState === 'visible') refresh();
    }, 60000);
})();
