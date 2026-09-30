const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'wabisabi.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for better concurrency and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize simplified Wabi Sabi database tables:
 * 1. curators (only the 3 curators)
 * 2. curator_sessions (authenticated curator sessions)
 * 3. updates (public announcements / notices)
 * 4. settings (key-value store for current_book, next_meeting, platform_links)
 */
function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS curators (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            handle TEXT UNIQUE NOT NULL COLLATE NOCASE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS curator_sessions (
            id TEXT PRIMARY KEY,
            curator_id TEXT NOT NULL REFERENCES curators(id) ON DELETE CASCADE,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS updates (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'announcement',
            is_pinned INTEGER DEFAULT 0,
            created_by TEXT REFERENCES curators(id),
            author_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS members (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT DEFAULT 'Member',
            handle TEXT,
            avatar_url TEXT,
            bio TEXT,
            display_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_curators_email ON curators(email);
        CREATE INDEX IF NOT EXISTS idx_curators_handle ON curators(handle);
        CREATE INDEX IF NOT EXISTS idx_curator_sessions_token ON curator_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_updates_created ON updates(created_at);
        CREATE INDEX IF NOT EXISTS idx_updates_pinned ON updates(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_members_order ON members(display_order, created_at);
    `);
}

/**
 * Seed the exact 3 Curator accounts with initial Argon2id hashes (password: curator123)
 */
async function seedInitialAccounts() {
    initDatabase();

    const curators = [
        {
            id: 'curator-likith',
            email: 'nrlikith6@gmail.com',
            handle: 'likith',
            displayName: 'Likith',
            hash: '$argon2id$v=19$m=32768,t=2,p=1$Ky+TTn2TgpE6FwJ8MeXr8Q$6u/nHzoPQ8KrLp4c0BYXoKmXLFGEN5O03g9LomjJ77Y'
        },
        {
            id: 'curator-sarvasree',
            email: 'sarvasreeyuvaraj02@gmail.com',
            handle: 'sarvasree',
            displayName: 'Sarvasree',
            hash: '$argon2id$v=19$m=32768,t=2,p=1$O/buRkL3NuNAVRi1VJOW0w$Au7gDZ7CUHdSI3SUPbXdXH/Ai0b54XdAmlaAhA4DkiM'
        },
        {
            id: 'curator-dhanush',
            email: 'ganganidhanush@gmail.com',
            handle: 'dhanush',
            displayName: 'Dhanush',
            hash: '$argon2id$v=19$m=32768,t=2,p=1$9Ir2p2OBOfwIILBQtGIswA$r2rZecJ44vuLwDjqofF1DHjXQSI5gTnqX2PrrIe9yMo'
        }
    ];

    const checkStmt = db.prepare('SELECT id FROM curators WHERE email = ? OR handle = ?');
    const insertStmt = db.prepare(`
        INSERT INTO curators (id, email, password_hash, display_name, handle, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const updateStmt = db.prepare(`
        UPDATE curators SET password_hash = ?, display_name = ? WHERE id = ?
    `);

    for (const c of curators) {
        const existing = checkStmt.get(c.email, c.handle);
        if (!existing) {
            insertStmt.run(c.id, c.email, c.hash, c.displayName, c.handle);
        } else {
            updateStmt.run(c.hash, c.displayName, existing.id);
        }
    }

    seedDefaultSettings();
    seedDefaultUpdates();
    seedDefaultMembers();
}

/**
 * Seed default core settings for Announcements (Theme, Reading, Gathering, Discussion, Important)
 * and Connect external platform links.
 */
function seedDefaultSettings() {
    const defaultSettings = [
        {
            key: 'weekly_theme',
            value: JSON.stringify({
                theme: 'Identity & Belonging',
                subtitle: 'Exploring who we are beyond our social mirrors.'
            })
        },
        {
            key: 'this_weeks_reading',
            value: JSON.stringify({
                title: 'The Stranger',
                author: 'Albert Camus',
                drive_url: 'https://drive.google.com',
                notes: 'Finish chapters 1–4 before our Saturday gathering.'
            })
        },
        {
            key: 'gathering',
            value: JSON.stringify({
                date: 'Saturday, 4 October',
                time: '4:00 PM',
                location: 'MRDU Campus',
                maps_url: 'https://maps.google.com',
                note: 'Quiet courtyard reading circle'
            })
        },
        {
            key: 'discussion_points',
            value: JSON.stringify([
                'What does belonging mean?',
                'Is identity created or inherited?',
                'What did you think about the protagonist?'
            ])
        },
        {
            key: 'important_notes',
            value: JSON.stringify('Bring your notes / finish chapters 1–4 before the gathering.')
        },
        {
            key: 'connect_links',
            value: JSON.stringify({
                community_chat_url: 'https://chat.whatsapp.com',
                book_drive_url: 'https://drive.google.com',
                meeting_maps_url: 'https://maps.google.com',
                instagram_url: 'https://instagram.com',
                whatsapp_url: 'https://chat.whatsapp.com',
                discord_url: 'https://discord.gg'
            })
        },
        // Backwards compatibility keys
        {
            key: 'current_book',
            value: JSON.stringify({
                title: 'The Stranger',
                author: 'Albert Camus',
                notes: 'Identity & Belonging — finish chapters 1–4.',
                drive_url: 'https://drive.google.com'
            })
        },
        {
            key: 'next_meeting',
            value: JSON.stringify({
                date: 'Saturday, 4 October',
                time: '4:00 PM',
                location: 'MRDU Campus',
                maps_url: 'https://maps.google.com'
            })
        },
        {
            key: 'platform_links',
            value: JSON.stringify({
                community_chat_url: 'https://chat.whatsapp.com',
                book_drive_url: 'https://drive.google.com',
                meeting_maps_url: 'https://maps.google.com'
            })
        }
    ];

    const getStmt = db.prepare('SELECT key FROM settings WHERE key = ?');
    const setStmt = db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    for (const item of defaultSettings) {
        const row = getStmt.get(item.key);
        if (!row) {
            setStmt.run(item.key, item.value);
        }
    }
}

/**
 * Seed initial community members directory
 */
function seedDefaultMembers() {
    const countRow = db.prepare('SELECT count(*) as count FROM members').get();
    if (!countRow || countRow.count === 0) {
        const insertStmt = db.prepare(`
            INSERT INTO members (id, name, role, handle, avatar_url, bio, display_order, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        const defaultMembers = [
            {
                id: 'mem-dhanush',
                name: 'Dhanush',
                role: 'Curator',
                handle: '@dhanush',
                avatar_url: '../assets/user_avatar.jpg',
                bio: 'Founding curator • Reader & Architect',
                order: 1
            },
            {
                id: 'mem-akshaya',
                name: 'Akshaya',
                role: 'Member',
                handle: '@akshaya',
                avatar_url: '../assets/avatar_aishwarya.jpg',
                bio: 'Literature, existential fiction & poetry',
                order: 2
            },
            {
                id: 'mem-vaishnavi',
                name: 'Vaishnavi',
                role: 'Member',
                handle: '@vaishnavi',
                avatar_url: '../assets/avatar_meera.jpg',
                bio: 'Cinema, narratives & quiet thoughts',
                order: 3
            },
            {
                id: 'mem-likith',
                name: 'Likith',
                role: 'Curator',
                handle: '@likith',
                avatar_url: '../assets/avatar_aarav.jpg',
                bio: 'Curator • Book selections & gatherings',
                order: 4
            },
            {
                id: 'mem-sarvasree',
                name: 'Sarvasree',
                role: 'Curator',
                handle: '@sarvasree',
                avatar_url: '../assets/avatar_ishita.jpg',
                bio: 'Curator • Discussions & literary archives',
                order: 5
            }
        ];

        for (const m of defaultMembers) {
            insertStmt.run(m.id, m.name, m.role, m.handle, m.avatar_url, m.bio, m.order);
        }
    }
}

/**
 * Seed initial sample announcements/updates
 */
function seedDefaultUpdates() {
    const countRow = db.prepare('SELECT count(*) as count FROM updates').get();
    if (!countRow || countRow.count === 0) {
        const insertStmt = db.prepare(`
            INSERT INTO updates (id, title, content, type, is_pinned, created_by, author_name, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        insertStmt.run(
            'update-welcome',
            'Welcome to Wabi Sabi Bookclub • Vol. 1',
            'A quiet coordination sanctuary for curious minds. No accounts or applications required—everyone can explore the book drive, find our next meeting location, and join our discussions.',
            'announcement',
            1,
            'curator-dhanush',
            'Dhanush'
        );

        insertStmt.run(
            'update-meeting-notice',
            'Next Discussion Gathering: Saturday, 4 October at 4:00 PM',
            'Our upcoming gathering has been confirmed for 4:00 PM at MRDU. Tap the meeting link to open the location directly in Google Maps.',
            'announcement',
            1,
            'curator-likith',
            'Likith'
        );
    }
}

// Helper query functions
function getCuratorByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    return db.prepare('SELECT * FROM curators WHERE LOWER(email) = ? OR LOWER(handle) = ?').get(clean, clean);
}

function getCuratorById(id) {
    if (!id) return null;
    return db.prepare('SELECT id, email, display_name, handle, created_at, last_login_at FROM curators WHERE id = ?').get(id);
}

function createCuratorSession(curatorId, tokenHash, expiresAt) {
    const id = 'sess-' + Math.random().toString(36).substring(2, 10);
    db.prepare(`
        INSERT INTO curator_sessions (id, curator_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(id, curatorId, tokenHash, expiresAt);
    return id;
}

function getCuratorBySessionTokenHash(tokenHash) {
    if (!tokenHash) return null;
    return db.prepare(`
        SELECT s.id as session_id, s.expires_at, c.id, c.email, c.display_name, c.handle
        FROM curator_sessions s
        JOIN curators c ON s.curator_id = c.id
        WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
    `).get(tokenHash);
}

function deleteCuratorSession(tokenHash) {
    if (!tokenHash) return;
    db.prepare('DELETE FROM curator_sessions WHERE token_hash = ?').run(tokenHash);
}

function getSetting(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return defaultValue;
    try {
        return JSON.parse(row.value);
    } catch (e) {
        return row.value;
    }
}

function getAllSettings() {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const result = {};
    for (const r of rows) {
        try {
            result[r.key] = JSON.parse(r.value);
        } catch (e) {
            result[r.key] = r.value;
        }
    }
    return result;
}

function setSetting(key, value) {
    const strVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
    db.prepare(`
        INSERT INTO settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, strVal);
}

function getPublicUpdates() {
    return db.prepare(`
        SELECT id, title, content, type, is_pinned, author_name, created_at, updated_at
        FROM updates
        ORDER BY is_pinned DESC, created_at DESC
    `).all();
}

function createUpdate({ title, content, type = 'announcement', is_pinned = 0, created_by = null, author_name = null }) {
    const id = 'upd-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
        INSERT INTO updates (id, title, content, type, is_pinned, created_by, author_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, title, content, type, is_pinned ? 1 : 0, created_by, author_name);
    return id;
}

function updateUpdate(id, { title, content, is_pinned }) {
    db.prepare(`
        UPDATE updates
        SET title = COALESCE(?, title),
            content = COALESCE(?, content),
            is_pinned = COALESCE(?, is_pinned),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(title, content, is_pinned !== undefined ? (is_pinned ? 1 : 0) : null, id);
}

function deleteUpdate(id) {
    db.prepare('DELETE FROM updates WHERE id = ?').run(id);
}

// Community Members Directory Helpers
function getAllMembers() {
    return db.prepare(`
        SELECT id, name, role, handle, avatar_url, bio, display_order, created_at, updated_at
        FROM members
        ORDER BY display_order ASC, created_at ASC
    `).all();
}

function getMemberById(id) {
    if (!id) return null;
    return db.prepare('SELECT * FROM members WHERE id = ?').get(id);
}

function createMember({ name, role = 'Member', handle = '', avatar_url = '', bio = '', display_order = 0 }) {
    const id = 'mem-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    db.prepare(`
        INSERT INTO members (id, name, role, handle, avatar_url, bio, display_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, name.trim(), (role || 'Member').trim(), (handle || '').trim(), (avatar_url || '').trim(), (bio || '').trim(), Number(display_order) || 0);
    return id;
}

function updateMember(id, { name, role, handle, avatar_url, bio, display_order }) {
    db.prepare(`
        UPDATE members
        SET name = COALESCE(?, name),
            role = COALESCE(?, role),
            handle = COALESCE(?, handle),
            avatar_url = COALESCE(?, avatar_url),
            bio = COALESCE(?, bio),
            display_order = COALESCE(?, display_order),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        name !== undefined ? name.trim() : null,
        role !== undefined ? role.trim() : null,
        handle !== undefined ? handle.trim() : null,
        avatar_url !== undefined ? avatar_url.trim() : null,
        bio !== undefined ? bio.trim() : null,
        display_order !== undefined ? Number(display_order) : null,
        id
    );
}

function deleteMember(id) {
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
}

// Initialize tables immediately
initDatabase();

module.exports = {
    db,
    initDatabase,
    seedInitialAccounts,
    seedDefaultSettings,
    seedDefaultUpdates,
    seedDefaultMembers,
    getCuratorByIdentifier,
    getCuratorById,
    createCuratorSession,
    getCuratorBySessionTokenHash,
    deleteCuratorSession,
    getSetting,
    getAllSettings,
    setSetting,
    getPublicUpdates,
    createUpdate,
    updateUpdate,
    deleteUpdate,
    getAllMembers,
    getMemberById,
    createMember,
    updateMember,
    deleteMember
};
