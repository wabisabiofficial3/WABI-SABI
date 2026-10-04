const express = require('express');
const router = express.Router();
const { getPublicUpdates, getAllSettings, getAllMembers } = require('../db');

/**
 * GET /api/portal
 * Public endpoint: Returns data for the 3 pillars:
 * 1. Announcements (Weekly Theme, This Week's Reading, Gathering, Discussion Points, Important notes, Bulletins)
 * 2. Community (Members directory)
 * 3. Connect (External links: Community Chat, Book Drive, Meeting Location, Socials)
 * Zero authentication required.
 */
router.get('/', (req, res) => {
    try {
        const updates = getPublicUpdates();
        const settings = getAllSettings();
        const members = getAllMembers();

        const weeklyTheme = settings.weekly_theme || {
            theme: 'Identity & Belonging',
            subtitle: 'Exploring who we are beyond our social mirrors.'
        };

        const reading = settings.this_weeks_reading || settings.current_book || {
            title: 'The Stranger',
            author: 'Albert Camus',
            drive_url: 'https://drive.google.com',
            notes: 'Finish chapters 1–4 before our Saturday gathering.'
        };

        const gathering = settings.gathering || settings.next_meeting || {
            date: 'Saturday, 4 October',
            time: '4:00 PM',
            location: 'MRDU Campus',
            maps_url: 'https://maps.google.com',
            note: 'Quiet courtyard reading circle'
        };

        const discussionPoints = settings.discussion_points || [
            'What does belonging mean?',
            'Is identity created or inherited?',
            'What did you think about the protagonist?'
        ];

        const importantNotes = settings.important_notes || 'Bring your notes / finish chapters 1–4 before the gathering.';

        const stickyNotes = settings.sticky_notes || {
            books: '“Ideas that take quiet root, and stay with you for years.”',
            films: '“Quiet frames that open unexpected rooms in the mind.”',
            discussions: 'Conversations held with patience, without judgment.',
            community: '“Kindred souls who feel the quiet rhythm of life.”'
        };

        const connectLinks = settings.connect_links || settings.platform_links || {
            community_chat_url: 'https://chat.whatsapp.com',
            book_drive_url: 'https://drive.google.com',
            meeting_maps_url: 'https://maps.google.com',
            instagram_url: 'https://instagram.com',
            whatsapp_url: 'https://chat.whatsapp.com',
            discord_url: 'https://discord.gg'
        };

        const paperPlaneEnabled = settings.paper_plane_enabled === true || settings.paper_plane_enabled === 'true';
        const catEnabled = settings.cat_enabled === true || settings.cat_enabled === 'true';

        const flatSettings = {
            current_book: typeof reading === 'string' ? reading : (reading.title || 'The Stranger'),
            current_book_author: reading.author || 'Albert Camus',
            current_book_notes: reading.notes || 'Identity & Belonging',
            book_drive_url: connectLinks.book_drive_url || reading.drive_url || 'https://drive.google.com',
            meeting_date: gathering.date || 'Saturday, 4 October',
            meeting_time: gathering.time || '4:00 PM',
            meeting_location: gathering.location || 'MRDU Campus',
            meeting_url: connectLinks.meeting_maps_url || gathering.maps_url || 'https://maps.google.com',
            community_url: connectLinks.community_chat_url || 'https://chat.whatsapp.com',
            paper_plane_enabled: paperPlaneEnabled,
            cat_enabled: catEnabled
        };

        return res.json({
            success: true,
            portal: {
                club: 'Wabi Sabi Bookclub',
                volume: 'VOL. 1',
                motto: 'Same stories. Different people.',
                announcements: {
                    weekly_theme: weeklyTheme,
                    reading,
                    gathering,
                    discussion_points: discussionPoints,
                    important_notes: importantNotes,
                    bulletins: updates
                },
                community: {
                    members
                },
                connect: {
                    links: connectLinks
                },
                buttons: connectLinks,
                button_links: connectLinks,
                sticky_notes: stickyNotes,
                features: {
                    paper_plane_enabled: paperPlaneEnabled,
                    cat_enabled: catEnabled
                },
                paper_plane_enabled: paperPlaneEnabled,
                cat_enabled: catEnabled,
                updates,
                current_book: reading,
                next_meeting: gathering,
                platform_links: connectLinks,
                settings: flatSettings
            },
            announcements: {
                weekly_theme: weeklyTheme,
                reading,
                gathering,
                discussion_points: discussionPoints,
                important_notes: importantNotes,
                bulletins: updates
            },
            community: {
                members
            },
            connect: {
                links: connectLinks
            },
            features: {
                paper_plane_enabled: paperPlaneEnabled,
                cat_enabled: catEnabled
            },
            paper_plane_enabled: paperPlaneEnabled,
            cat_enabled: catEnabled,
            sticky_notes: stickyNotes,
            updates,
            current_book: reading,
            next_meeting: gathering,
            platform_links: connectLinks,
            settings: flatSettings
        });
    } catch (err) {
        console.error('Error fetching public portal data:', err);
        return res.status(500).json({ success: false, error: 'Failed to retrieve portal data.' });
    }
});

module.exports = router;
