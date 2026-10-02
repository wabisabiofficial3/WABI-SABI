const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

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
            full_name TEXT,
            display_name TEXT,
            gender TEXT,
            date_joined TEXT,
            secret_code_hash TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_sessions (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            session_token_hash TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_reading (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            book_title TEXT NOT NULL,
            book_author TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            status TEXT DEFAULT 'currently_reading',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_notes (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_claims (
            id TEXT PRIMARY KEY,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            claim_token_hash TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_curators_email ON curators(email);
        CREATE INDEX IF NOT EXISTS idx_curators_handle ON curators(handle);
        CREATE INDEX IF NOT EXISTS idx_curator_sessions_token ON curator_sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_updates_created ON updates(created_at);
        CREATE INDEX IF NOT EXISTS idx_updates_pinned ON updates(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_members_order ON members(display_order, created_at);
        CREATE INDEX IF NOT EXISTS idx_member_sessions_token ON member_sessions(session_token_hash);
        CREATE INDEX IF NOT EXISTS idx_member_claims_token ON member_claims(claim_token_hash);
    `);

    // Ensure columns exist on pre-existing members table
    try {
        const columns = db.prepare("PRAGMA table_info(members)").all().map(c => c.name);
        if (!columns.includes('full_name')) db.exec("ALTER TABLE members ADD COLUMN full_name TEXT;");
        if (!columns.includes('display_name')) db.exec("ALTER TABLE members ADD COLUMN display_name TEXT;");
        if (!columns.includes('gender')) db.exec("ALTER TABLE members ADD COLUMN gender TEXT;");
        if (!columns.includes('date_joined')) db.exec("ALTER TABLE members ADD COLUMN date_joined TEXT;");
        if (!columns.includes('secret_code_hash')) db.exec("ALTER TABLE members ADD COLUMN secret_code_hash TEXT;");
        if (!columns.includes('status')) db.exec("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'active';");
        db.exec("CREATE INDEX IF NOT EXISTS idx_members_code_hash ON members(secret_code_hash);");
    } catch (e) {
        console.warn('Member schema check warning:', e.message);
    }
}

/**
 * Seed single Admin account wabisabiofficial3@gmail.com (password: DsL@678_)
 * and purge any previous curator accounts.
 */
async function seedInitialAccounts() {
    initDatabase();

    const admin = {
        id: 'admin-wabisabi',
        email: 'wabisabiofficial3@gmail.com',
        handle: 'admin',
        displayName: 'Wabi Sabi Admin',
        hash: '$argon2id$v=19$m=32768,t=2,p=1$yVbG5gRjjuN8wY8f66RpcQ$mddEvCT1DD8iAOyTJuxDUDemwPklaDeSDZ05+mKuUPE'
    };

    const checkStmt = db.prepare('SELECT id FROM curators WHERE email = ? OR handle = ?');
    const insertStmt = db.prepare(`
        INSERT INTO curators (id, email, password_hash, display_name, handle, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    const updateStmt = db.prepare(`
        UPDATE curators SET password_hash = ?, display_name = ?, handle = ?, email = ? WHERE id = ?
    `);

    const existing = checkStmt.get(admin.email, admin.handle);
    if (!existing) {
        insertStmt.run(admin.id, admin.email, admin.hash, admin.displayName, admin.handle);
    } else {
        updateStmt.run(admin.hash, admin.displayName, admin.handle, admin.email, existing.id);
    }

    // Now reassign references and purge legacy curator accounts and sessions
    try {
        db.prepare("UPDATE updates SET author_name = 'Wabi Sabi Admin', created_by = 'admin-wabisabi' WHERE created_by != 'admin-wabisabi'").run();
        db.prepare("DELETE FROM curator_sessions WHERE curator_id != 'admin-wabisabi'").run();
        db.prepare("DELETE FROM curators WHERE id != 'admin-wabisabi'").run();
        db.prepare("DELETE FROM members WHERE id IN ('mem-dhanush', 'mem-likith', 'mem-sarvasree') OR role = 'Curator'").run();

        const checkAdminMem = db.prepare('SELECT id FROM members WHERE id = ?').get('mem-admin');
        if (!checkAdminMem) {
            db.prepare(`
                INSERT INTO members (id, name, role, handle, avatar_url, bio, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run('mem-admin', 'Wabi Sabi Admin', 'Admin', '@wabisabi', '../assets/user_avatar.jpg', 'Sanctuary steward & literary curator', 1);
        }
    } catch (e) {
        console.warn('Database cleanup warning:', e.message);
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
        {
            key: 'paper_plane_enabled',
            value: JSON.stringify(false)
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
            key: 'sticky_notes',
            value: JSON.stringify({
                books: '“Ideas that take quiet root, and stay with you for years.”',
                films: '“Quiet frames that open unexpected rooms in the mind.”',
                discussions: 'Conversations held with patience, without judgment.',
                community: '“Kindred souls who feel the quiet rhythm of life.”'
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
    const insertStmt = db.prepare(`
        INSERT INTO members (id, name, role, handle, avatar_url, bio, display_order, full_name, display_name, gender, date_joined, secret_code_hash, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const defaultMembers = [
        {
            id: 'mem-admin',
            name: 'Wabi Sabi Admin',
            role: 'Admin',
            handle: '@wabisabi',
            avatar_url: '../assets/user_avatar.jpg',
            bio: 'Sanctuary steward & literary curator',
            order: 1,
            full_name: 'Wabi Sabi Admin',
            display_name: 'Wabi Sabi Admin',
            gender: '',
            date_joined: '01 September 2026',
            secret_code_hash: null,
            status: 'active'
        },
        {
            id: 'mem-akshaya',
            name: 'Akshaya',
            role: 'Member',
            handle: '@akshaya',
            avatar_url: '../assets/avatar_aishwarya.jpg',
            bio: 'Literature, existential fiction & poetry',
            order: 2,
            full_name: 'Akshaya',
            display_name: 'Akshaya',
            gender: 'Female',
            date_joined: '02 October 2026',
            secret_code_hash: hashSecretCode('WS-7K4M-X92P-LQ8A'),
            status: 'active'
        },
        {
            id: 'mem-vaishnavi',
            name: 'Vaishnavi',
            role: 'Member',
            handle: '@vaishnavi',
            avatar_url: '../assets/avatar_meera.jpg',
            bio: 'Cinema, narratives & quiet thoughts',
            order: 3,
            full_name: 'Vaishnavi',
            display_name: 'Vaishnavi',
            gender: 'Female',
            date_joined: '28 September 2026',
            secret_code_hash: hashSecretCode('WS-3R8B-Y65W-NK2D'),
            status: 'active'
        }
    ];

    for (const m of defaultMembers) {
        const existing = db.prepare('SELECT id, secret_code_hash FROM members WHERE id = ?').get(m.id);
        if (!existing) {
            insertStmt.run(m.id, m.name, m.role, m.handle, m.avatar_url, m.bio, m.order, m.full_name, m.display_name, m.gender, m.date_joined, m.secret_code_hash, m.status);
        } else if (m.secret_code_hash && !existing.secret_code_hash) {
            db.prepare(`
                UPDATE members
                SET full_name = ?, display_name = ?, gender = ?, date_joined = ?, secret_code_hash = ?, status = 'active'
                WHERE id = ?
            `).run(m.full_name, m.display_name, m.gender, m.date_joined, m.secret_code_hash, m.id);
        }
    }

    // Seed sample reading and notes for Akshaya and Vaishnavi
    try {
        const readCheck = db.prepare('SELECT count(*) as count FROM member_reading').get();
        if (!readCheck || readCheck.count === 0) {
            db.prepare(`
                INSERT INTO member_reading (id, member_id, book_title, book_author, progress, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('read-akshaya', 'mem-akshaya', 'The Stranger', 'Albert Camus', 62, 'currently_reading');

            db.prepare(`
                INSERT INTO member_reading (id, member_id, book_title, book_author, progress, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run('read-vaishnavi', 'mem-vaishnavi', 'Norwegian Wood', 'Haruki Murakami', 45, 'currently_reading');
        }

        const notesCheck = db.prepare('SELECT count(*) as count FROM member_notes').get();
        if (!notesCheck || notesCheck.count === 0) {
            db.prepare(`
                INSERT INTO member_notes (id, member_id, content, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run('note-ak-1', 'mem-akshaya', 'Albert Camus presents absurdism not as defeat, but as radical freedom to exist authentically.');

            db.prepare(`
                INSERT INTO member_notes (id, member_id, content, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run('note-ak-2', 'mem-akshaya', 'Reading notes for Saturday salon: In chapter 4, Meursault’s honesty stands in sharp contrast to the societal expectations of remorse.');

            db.prepare(`
                INSERT INTO member_notes (id, member_id, content, created_at)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `).run('note-vn-1', 'mem-vaishnavi', 'The sound of rain in the tea room makes the passages on nostalgia linger longer.');
        }
    } catch (e) {
        console.warn('Member content seed warning:', e.message);
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
            'admin-wabisabi',
            'Wabi Sabi Admin'
        );

        insertStmt.run(
            'update-meeting-notice',
            'Next Discussion Gathering: Saturday, 4 October at 4:00 PM',
            'Our upcoming gathering has been confirmed for 4:00 PM at MRDU. Tap the meeting link to open the location directly in Google Maps.',
            'announcement',
            1,
            'admin-wabisabi',
            'Wabi Sabi Admin'
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

function getCuratorWithPassword(id) {
    if (!id) return null;
    return db.prepare('SELECT * FROM curators WHERE id = ?').get(id);
}

function updateCuratorProfile(id, { email, displayName, handle, passwordHash }) {
    if (!id) return null;
    const current = db.prepare('SELECT * FROM curators WHERE id = ?').get(id);
    if (!current) return null;

    const newEmail = email ? email.trim().toLowerCase() : current.email;
    const newName = displayName ? displayName.trim() : current.display_name;
    const newHandle = handle ? handle.trim().replace(/^@/, '') : current.handle;
    const newHash = passwordHash || current.password_hash;

    db.prepare(`
        UPDATE curators
        SET email = ?, display_name = ?, handle = ?, password_hash = ?
        WHERE id = ?
    `).run(newEmail, newName, newHandle, newHash, id);

    return getCuratorById(id);
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

// ====================================================================
// WABI SABI SECRET CODE & MEMBER SYSTEM HELPERS
// ====================================================================
function generateSecretCode() {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    function randChunk(len) {
        let chunk = '';
        const bytes = crypto.randomBytes(len);
        for (let i = 0; i < len; i++) {
            chunk += chars[bytes[i] % chars.length];
        }
        return chunk;
    }
    return `WS-${randChunk(4)}-${randChunk(4)}-${randChunk(4)}`;
}

function hashSecretCode(code) {
    if (!code) return '';
    const clean = code.trim().toUpperCase();
    return crypto.createHash('sha256').update(clean).digest('hex');
}

// Community Members Directory Helpers
function getAllMembers() {
    // Intentionally sanitized public view: Never exposes secret_code_hash, gender, private notes or internal sensitive fields
    return db.prepare(`
        SELECT id, name, display_name, role, handle, avatar_url, bio, display_order, created_at, updated_at
        FROM members
        WHERE status != 'suspended'
        ORDER BY display_order ASC, created_at ASC
    `).all().map(m => ({
        id: m.id,
        name: m.display_name || m.name,
        role: m.role || 'Member',
        handle: m.handle,
        avatar_url: m.avatar_url,
        bio: m.bio,
        display_order: m.display_order,
        created_at: m.created_at,
        updated_at: m.updated_at
    }));
}

function getAllMembersCurator() {
    // Curator view: Includes status, date_joined, gender, but NEVER secret_code_hash
    return db.prepare(`
        SELECT id, name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status, created_at, updated_at
        FROM members
        ORDER BY display_order ASC, created_at ASC
    `).all();
}

function getMemberById(id) {
    if (!id) return null;
    return db.prepare(`
        SELECT id, name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status, created_at, updated_at
        FROM members
        WHERE id = ?
    `).get(id);
}

function getMemberByCode(rawCode) {
    if (!rawCode) return null;
    const hash = hashSecretCode(rawCode);
    return db.prepare(`
        SELECT id, name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status
        FROM members
        WHERE secret_code_hash = ?
    `).get(hash);
}

function createMember({
    name,
    full_name,
    display_name,
    role = 'Member',
    handle = '',
    gender = '',
    date_joined = '',
    avatar_url = '',
    bio = '',
    display_order = 0,
    status = 'active'
}) {
    const finalFullName = (full_name || name || '').trim();
    const finalDisplayName = (display_name || name || full_name || '').trim();
    const id = 'mem-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const secretCode = generateSecretCode();
    const codeHash = hashSecretCode(secretCode);

    let joinDate = date_joined;
    if (!joinDate) {
        joinDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    db.prepare(`
        INSERT INTO members (
            id, name, full_name, display_name, role, handle, gender, date_joined,
            avatar_url, bio, display_order, secret_code_hash, status, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
        id,
        finalDisplayName,
        finalFullName,
        finalDisplayName,
        (role || 'Member').trim(),
        (handle || '').trim(),
        (gender || '').trim(),
        joinDate,
        (avatar_url || '../assets/user_avatar.jpg').trim(),
        (bio || '').trim(),
        Number(display_order) || 0,
        codeHash,
        status || 'active'
    );

    // Seed default member reading item
    try {
        db.prepare(`
            INSERT INTO member_reading (id, member_id, book_title, book_author, progress, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('read-' + crypto.randomBytes(6).toString('hex'), id, 'The Stranger', 'Albert Camus', 0, 'currently_reading');
    } catch (e) {}

    return { id, secretCode, member: getMemberById(id) };
}

function updateMember(id, { name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status }) {
    const existing = getMemberById(id);
    if (!existing) return;

    const fName = full_name !== undefined ? full_name.trim() : (name !== undefined ? name.trim() : existing.full_name);
    const dName = display_name !== undefined ? display_name.trim() : (name !== undefined ? name.trim() : existing.display_name);

    db.prepare(`
        UPDATE members
        SET name = COALESCE(?, name),
            full_name = COALESCE(?, full_name),
            display_name = COALESCE(?, display_name),
            role = COALESCE(?, role),
            handle = COALESCE(?, handle),
            gender = COALESCE(?, gender),
            date_joined = COALESCE(?, date_joined),
            avatar_url = COALESCE(?, avatar_url),
            bio = COALESCE(?, bio),
            display_order = COALESCE(?, display_order),
            status = COALESCE(?, status),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        dName,
        fName,
        dName,
        role !== undefined ? role.trim() : null,
        handle !== undefined ? handle.trim() : null,
        gender !== undefined ? gender.trim() : null,
        date_joined !== undefined ? date_joined.trim() : null,
        avatar_url !== undefined ? avatar_url.trim() : null,
        bio !== undefined ? bio.trim() : null,
        display_order !== undefined ? Number(display_order) : null,
        status !== undefined ? status.trim() : null,
        id
    );

    if (status === 'suspended') {
        revokeAllMemberSessions(id);
    }
}

function regenerateMemberCode(memberId) {
    const member = db.prepare('SELECT id, name FROM members WHERE id = ?').get(memberId);
    if (!member) throw new Error('Member not found');
    const newCode = generateSecretCode();
    const newHash = hashSecretCode(newCode);
    db.prepare('UPDATE members SET secret_code_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, memberId);
    revokeAllMemberSessions(memberId);
    return newCode;
}

function setMemberStatus(memberId, status) {
    const clean = status === 'suspended' ? 'suspended' : 'active';
    db.prepare('UPDATE members SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(clean, memberId);
    if (clean === 'suspended') {
        revokeAllMemberSessions(memberId);
    }
}

function deleteMember(id) {
    revokeAllMemberSessions(id);
    db.prepare('DELETE FROM member_reading WHERE member_id = ?').run(id);
    db.prepare('DELETE FROM member_notes WHERE member_id = ?').run(id);
    db.prepare('DELETE FROM member_claims WHERE member_id = ?').run(id);
    db.prepare('DELETE FROM members WHERE id = ?').run(id);
}

// Session Management Helpers
function createMemberSession(memberId, days = 30) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const id = 'msess-' + crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO member_sessions (id, member_id, session_token_hash, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(id, memberId, tokenHash, expiresAt);

    return { token: rawToken, expiresAt };
}

function getMemberBySessionToken(rawToken) {
    if (!rawToken) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return db.prepare(`
        SELECT m.id, m.name, m.full_name, m.display_name, m.handle, m.gender, m.date_joined,
               m.avatar_url, m.bio, m.role, m.status, s.id as session_id, s.expires_at
        FROM member_sessions s
        JOIN members m ON s.member_id = m.id
        WHERE s.session_token_hash = ? AND datetime(s.expires_at) > datetime('now') AND m.status = 'active'
    `).get(tokenHash);
}

function deleteMemberSession(rawToken) {
    if (!rawToken) return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.prepare('DELETE FROM member_sessions WHERE session_token_hash = ?').run(tokenHash);
}

function revokeAllMemberSessions(memberId) {
    if (!memberId) return;
    db.prepare('DELETE FROM member_sessions WHERE member_id = ?').run(memberId);
}

// QR Membership Card Claim Passes
function createMemberClaim(memberId, days = 7) {
    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const id = 'claim-' + crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO member_claims (id, member_id, claim_token_hash, expires_at)
        VALUES (?, ?, ?, ?)
    `).run(id, memberId, tokenHash, expiresAt);

    return rawToken;
}

function claimMemberPass(rawToken) {
    if (!rawToken) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const claim = db.prepare(`
        SELECT c.id, c.member_id, m.status
        FROM member_claims c
        JOIN members m ON c.member_id = m.id
        WHERE c.claim_token_hash = ? AND datetime(c.expires_at) > datetime('now') AND c.used_at IS NULL AND m.status = 'active'
    `).get(tokenHash);

    if (!claim) return null;

    db.prepare('UPDATE member_claims SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(claim.id);
    return claim.member_id;
}

// Member Reading & Reflection Notes Helpers
function getMemberReading(memberId) {
    return db.prepare(`
        SELECT id, book_title, book_author, progress, status, updated_at
        FROM member_reading
        WHERE member_id = ?
        ORDER BY updated_at DESC
        LIMIT 1
    `).get(memberId) || {
        book_title: 'The Stranger',
        book_author: 'Albert Camus',
        progress: 0,
        status: 'currently_reading'
    };
}

function updateMemberReading(memberId, { book_title, book_author, progress }) {
    const existing = db.prepare('SELECT id FROM member_reading WHERE member_id = ?').get(memberId);
    const prog = Math.max(0, Math.min(100, Number(progress) || 0));
    if (existing) {
        db.prepare(`
            UPDATE member_reading
            SET book_title = COALESCE(?, book_title),
                book_author = COALESCE(?, book_author),
                progress = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(book_title ? book_title.trim() : null, book_author ? book_author.trim() : null, prog, existing.id);
    } else {
        const id = 'read-' + crypto.randomBytes(6).toString('hex');
        db.prepare(`
            INSERT INTO member_reading (id, member_id, book_title, book_author, progress, status)
            VALUES (?, ?, ?, ?, ?, 'currently_reading')
        `).run(id, memberId, book_title || 'The Stranger', book_author || 'Albert Camus', prog);
    }
}

function getMemberNotes(memberId) {
    return db.prepare(`
        SELECT id, content, created_at, updated_at
        FROM member_notes
        WHERE member_id = ?
        ORDER BY created_at DESC
    `).all(memberId);
}

function addMemberNote(memberId, content) {
    if (!content || !content.trim()) return null;
    const id = 'note-' + crypto.randomBytes(6).toString('hex');
    db.prepare(`
        INSERT INTO member_notes (id, member_id, content, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, memberId, content.trim());
    return id;
}

function deleteMemberNote(noteId, memberId) {
    db.prepare('DELETE FROM member_notes WHERE id = ? AND member_id = ?').run(noteId, memberId);
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
    getCuratorWithPassword,
    updateCuratorProfile,
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
    // Members & Secret Code Helpers
    generateSecretCode,
    hashSecretCode,
    getAllMembers,
    getAllMembersCurator,
    getMemberById,
    getMemberByCode,
    createMember,
    updateMember,
    regenerateMemberCode,
    setMemberStatus,
    deleteMember,
    // Member Session Helpers
    createMemberSession,
    getMemberBySessionToken,
    deleteMemberSession,
    revokeAllMemberSessions,
    createMemberClaim,
    claimMemberPass,
    // Reading & Notes
    getMemberReading,
    updateMemberReading,
    getMemberNotes,
    addMemberNote,
    deleteMemberNote
};
