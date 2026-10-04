const { createMemberNotification } = require('./db');

function cleanDetail(value, fallback, maximum = 100) {
    if (typeof value !== 'string') return fallback;
    const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return clean ? clean.slice(0, maximum) : fallback;
}

function buildChangeNotification(change, details = {}) {
    switch (change) {
        case 'weekly_theme': {
            const theme = cleanDetail(details.theme, 'a new reflection');
            return {
                kind: 'theme',
                title: 'The weekly theme has changed',
                message: `This week’s theme is “${theme}”. Visit Announcements to read the new reflection.`,
                href: '/#announcements'
            };
        }
        case 'reading_selection': {
            const title = cleanDetail(details.title, 'a new selection');
            const author = cleanDetail(details.author, '', 80);
            return {
                kind: 'reading',
                title: 'A new circle reading selection',
                message: author
                    ? `The circle is reading “${title}” by ${author}. The notes and shared link are in Announcements.`
                    : `The circle’s reading selection is now “${title}”. Visit Announcements for the notes and link.`,
                href: '/#announcements'
            };
        }
        case 'gathering': {
            const date = cleanDetail(details.date, 'the next gathering', 120);
            const time = cleanDetail(details.time, 'the posted time', 80);
            const location = cleanDetail(details.location, 'the announced venue', 100);
            return {
                kind: 'gathering',
                title: 'Gathering details were updated',
                message: `The circle will meet ${date} at ${time} at ${location}. Check Announcements for the latest directions.`,
                href: '/#announcements'
            };
        }
        case 'discussion_points': {
            const prompts = Array.isArray(details.prompts)
                ? details.prompts.filter(prompt => typeof prompt === 'string' && prompt.trim()).slice(0, 2)
                : [];
            const firstPrompt = prompts.length ? ` The first prompt is “${cleanDetail(prompts[0], 'a new question', 120)}”.` : '';
            const promptCount = Array.isArray(details.prompts) ? details.prompts.length : 0;
            return {
                kind: 'discussion',
                title: 'New discussion prompts are waiting',
                message: `${promptCount ? `${promptCount} discussion prompt${promptCount === 1 ? '' : 's'} changed.` : 'The discussion prompts changed.'}${firstPrompt} Review them in Announcements.`,
                href: '/#announcements'
            };
        }
        case 'important_notes': {
            const note = cleanDetail(details.note, '', 180);
            return {
                kind: 'circle_note',
                title: 'A new note for the circle',
                message: note
                    ? `The curator’s note now reads: “${note}”. Read the full update in Announcements.`
                    : 'The curator removed the previous important note. Check Announcements for the current details.',
                href: '/#announcements'
            };
        }
        case 'connect_links': {
            const labels = {
                community_chat_url: 'community chat', community_chat_label: 'community lounge button',
                book_drive_url: 'book drive', book_drive_label: 'book drive button',
                meeting_maps_url: 'gathering map', meeting_maps_label: 'map button',
                instagram_url: 'Instagram', instagram_label: 'Instagram button',
                whatsapp_url: 'WhatsApp', whatsapp_label: 'WhatsApp button',
                discord_url: 'Discord', discord_label: 'Discord button',
                goodreads_url: 'Goodreads', goodreads_label: 'Goodreads button',
                custom_btn_1_url: 'custom link one', custom_btn_1_label: 'custom button one', custom_btn_1_enabled: 'custom button one',
                custom_btn_2_url: 'custom link two', custom_btn_2_label: 'custom button two', custom_btn_2_enabled: 'custom button two'
            };
            const changed = Array.isArray(details.changedLinks)
                ? [...new Set(details.changedLinks.map(key => labels[key]).filter(Boolean))]
                : [];
            const summary = changed.length ? changed.join(', ') : 'community';
            const detail = changed.length === 1
                ? `The ${summary} connection was updated.`
                : `These connections changed: ${summary}.`;
            return {
                kind: 'connections',
                title: changed.length === 1 ? `The ${summary} link changed` : 'Community links have changed',
                message: `${detail} Visit Connect to use the current link${changed.length === 1 ? '' : 's'}.`,
                href: '/#connect'
            };
        }
        case 'sticky_notes': {
            const noteLabels = {
                books: 'book notes',
                films: 'film notes',
                discussions: 'discussion notes',
                community: 'community notes'
            };
            const changedNotes = Array.isArray(details.changedNotes)
                ? details.changedNotes.map(key => noteLabels[key]).filter(Boolean)
                : [];
            const changedText = changedNotes.length ? changedNotes.join(', ') : 'reading-desk notes';
            return {
                kind: 'desk',
                title: 'The reading-desk notes were refreshed',
                message: `The curator updated ${changedText}. Open Announcements to read the latest note.`,
                href: '/#announcements'
            };
        }
        case 'paper_plane_enabled': {
            const enabled = details.enabled === true;
            return {
                kind: 'feature',
                title: enabled ? 'The Paper Plane is open' : 'The Paper Plane is resting',
                message: enabled
                    ? 'The Paper Plane feature is now available from the Sanctuary.'
                    : 'The Paper Plane feature has been paused in the Sanctuary.',
                href: '/#connect'
            };
        }
        case 'bulletin_published': {
            const title = cleanDetail(details.title, 'A new circle bulletin');
            return {
                kind: 'bulletin',
                title: 'A new circle bulletin',
                message: `“${title}” has been added to Announcements. Open the Sanctuary to read it.`,
                href: '/#announcements'
            };
        }
        case 'bulletin_updated': {
            const title = cleanDetail(details.title, 'A circle bulletin');
            return {
                kind: 'bulletin',
                title: 'A circle bulletin was refreshed',
                message: `“${title}” has new details in Announcements.`,
                href: '/#announcements'
            };
        }
        case 'bulletin_removed':
            return {
                kind: 'bulletin',
                title: 'An announcement was removed',
                message: 'The public bulletin list has changed. Visit Announcements for the current notices.',
                href: '/#announcements'
            };
        case 'wabi_wall_created': {
            const title = cleanDetail(details.title, 'A new notice');
            return {
                kind: 'wabi_wall',
                title: 'A new notice is pinned to Wabi Wall',
                message: `“${title}” is now on the community board.`,
                href: '/wabi-wall'
            };
        }
        case 'wabi_wall_updated': {
            const title = cleanDetail(details.title, 'A Wabi Wall notice');
            return {
                kind: 'wabi_wall',
                title: 'A Wabi Wall notice was updated',
                message: `“${title}” has new details on the community board.`,
                href: '/wabi-wall'
            };
        }
        case 'wabi_wall_removed':
            return {
                kind: 'wabi_wall',
                title: 'Wabi Wall has been refreshed',
                message: 'A notice was removed from the board. Visit Wabi Wall to see the current collection.',
                href: '/wabi-wall'
            };
        case 'member_added': {
            const name = cleanDetail(details.name, 'A new reader');
            return {
                kind: 'community',
                title: 'A new reader joined the circle',
                message: `Welcome ${name} to our community. Their directory portrait is ready to view.`,
                href: '/#community'
            };
        }
        case 'member_profile_updated': {
            const name = cleanDetail(details.name, 'A member');
            const fieldLabels = {
                display_name: 'display name', role: 'community role', handle: 'public handle',
                avatar_url: 'portrait', bio: 'profile description', display_order: 'directory position'
            };
            const fields = Array.isArray(details.fields)
                ? [...new Set(details.fields.map(field => fieldLabels[field]).filter(Boolean))]
                : [];
            const changedText = fields.length ? fields.join(', ') : 'directory profile';
            return {
                kind: 'community',
                title: fields.length === 1 ? `A member’s ${changedText} changed` : 'A member profile was updated',
                message: `${name} updated their ${changedText} in the Community directory. Visit Community to see the current profile.`,
                href: '/#community'
            };
        }
        case 'member_access_changed': {
            const name = cleanDetail(details.name, 'A member');
            const reactivated = details.status === 'active';
            return {
                kind: 'community',
                title: reactivated ? 'A reader returned to the active circle' : 'The active circle roster changed',
                message: reactivated
                    ? `${name} is active in the circle again. Visit Community to see the current directory.`
                    : `${name} is no longer listed among active circle members. Visit Community for the current roster.`,
                href: '/#community'
            };
        }
        case 'member_removed': {
            const name = cleanDetail(details.name, 'A member');
            return {
                kind: 'community',
                title: 'A reader left the circle',
                message: `${name} is no longer listed in the active directory. Visit Community for the current roster.`,
                href: '/#community'
            };
        }
        default:
            throw new Error('Unknown member notification change type.');
    }
}

function notifyMembersOfChange(change, createdBy, details = {}) {
    return createMemberNotification({
        ...buildChangeNotification(change, details),
        created_by: createdBy || null
    });
}

module.exports = { buildChangeNotification, notifyMembersOfChange };
