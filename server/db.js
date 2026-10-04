const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { hashPassword } = require('./crypto');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.WABI_DB_PATH
    ? path.resolve(process.env.WABI_DB_PATH)
    : path.join(DEFAULT_DATA_DIR, 'wabisabi.db');
const DATA_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode, foreign keys and a bounded wait for concurrent connections.
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

/** Restrict the live SQLite database and WAL sidecars to the service owner. */
function restrictDatabaseFilePermissions() {
    if (process.platform === 'win32') return; // POSIX mode bits are not reliable on Windows.

    for (const filePath of [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`, `${DB_PATH}-journal`]) {
        try {
            fs.chmodSync(filePath, 0o600);
            const mode = fs.statSync(filePath).mode & 0o777;
            if (mode & 0o077) {
                throw new Error('SQLite file permissions still allow group or other access.');
            }
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw new Error(`Could not restrict SQLite file permissions: ${error.message}`);
        }
    }
}

function withTransaction(callback) {
    if (typeof callback !== 'function') throw new TypeError('Transaction callback must be a function.');
    db.exec('BEGIN IMMEDIATE;');
    try {
        const result = callback();
        db.exec('COMMIT;');
        return result;
    } catch (error) {
        try { db.exec('ROLLBACK;'); } catch (rollbackError) {}
        throw error;
    }
}

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

        CREATE TABLE IF NOT EXISTS theme_notices (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            type TEXT NOT NULL DEFAULT 'announcement',
            metadata TEXT NOT NULL DEFAULT '{}',
            image TEXT NOT NULL DEFAULT '',
            priority INTEGER NOT NULL DEFAULT 50,
            position_x REAL NOT NULL DEFAULT 100,
            position_y REAL NOT NULL DEFAULT 100,
            rotation REAL NOT NULL DEFAULT 0,
            is_pinned INTEGER NOT NULL DEFAULT 1,
            pin_color TEXT NOT NULL DEFAULT 'brass',
            created_by TEXT REFERENCES curators(id) ON DELETE SET NULL,
            published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            archived_at DATETIME,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_notifications (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            href TEXT NOT NULL,
            created_by TEXT REFERENCES curators(id) ON DELETE SET NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS member_notification_recipients (
            notification_id TEXT NOT NULL REFERENCES member_notifications(id) ON DELETE CASCADE,
            member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
            read_at DATETIME,
            PRIMARY KEY (notification_id, member_id)
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
        CREATE INDEX IF NOT EXISTS idx_theme_notices_active ON theme_notices(archived_at, priority, published_at);
        CREATE INDEX IF NOT EXISTS idx_member_notifications_created ON member_notifications(created_at);
        CREATE INDEX IF NOT EXISTS idx_member_notification_member_unread
            ON member_notification_recipients(member_id, read_at, notification_id);
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

    restrictDatabaseFilePermissions();
}

/**
 * Bootstrap the single curator account without shipping a usable password in source.
 * Set WABI_ADMIN_PASSWORD on first production boot. Local development generates a
 * one-time password in an ignored, owner-readable file under data/.
 */
const COMPROMISED_ADMIN_HASH = '$argon2id$v=19$m=32768,t=2,p=1$yVbG5gRjjuN8wY8f66RpcQ$mddEvCT1DD8iAOyTJuxDUDemwPklaDeSDZ05+mKuUPE';
async function initialAdminPasswordHash() {
    const configuredPassword = process.env.WABI_ADMIN_PASSWORD;
    if (configuredPassword !== undefined) {
        if (configuredPassword.length < 12 || configuredPassword.length > 1024) {
            throw new Error('WABI_ADMIN_PASSWORD must be between 12 and 1024 characters.');
        }
        return hashPassword(configuredPassword);
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('WABI_ADMIN_PASSWORD is required to initialize or rotate the curator account in production.');
    }

    const password = crypto.randomBytes(32).toString('base64url');
    const passwordHash = await hashPassword(password);
    const passwordFile = path.join(DATA_DIR, 'initial-admin-password.txt');
    fs.writeFileSync(passwordFile, `Curator email: ${process.env.WABI_ADMIN_EMAIL || 'wabisabiofficial3@gmail.com'}\nInitial password: ${password}\n`, {
        encoding: 'utf8',
        mode: 0o600
    });
    try {
        fs.chmodSync(passwordFile, 0o600);
    } catch (error) {
        // The platform may not support POSIX file modes; the file remains in ignored data/.
    }
    console.warn(`A one-time local curator password was generated. Read it from ${passwordFile} and change it after signing in.`);
    return passwordHash;
}

/**
 * Ensure exactly one curator account exists and remove superseded sessions/accounts.
 * Old repository versions shipped a known password hash; that hash is rotated once.
 */
async function seedInitialAccounts() {
    initDatabase();

    const existingCanonical = db.prepare('SELECT * FROM curators WHERE id = ?').get('admin-wabisabi');
    const admin = {
        id: 'admin-wabisabi',
        email: (existingCanonical?.email || process.env.WABI_ADMIN_EMAIL || 'wabisabiofficial3@gmail.com').trim().toLowerCase(),
        handle: (existingCanonical?.handle || process.env.WABI_ADMIN_HANDLE || 'admin').trim().replace(/^@/, '').toLowerCase(),
        displayName: (existingCanonical?.display_name || process.env.WABI_ADMIN_NAME || 'Wabi Sabi Admin').trim()
    };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email) || admin.email.length > 254) {
        throw new Error('WABI_ADMIN_EMAIL must be a valid email address.');
    }
    if (!/^[a-z0-9_-]{3,32}$/.test(admin.handle)) {
        throw new Error('WABI_ADMIN_HANDLE must be 3-32 lowercase letters, numbers, underscores or hyphens.');
    }
    if (!admin.displayName || admin.displayName.length > 100) {
        throw new Error('WABI_ADMIN_NAME must be 1-100 characters.');
    }

    const candidates = db.prepare(`
        SELECT * FROM curators
        WHERE id = ? OR email = ? OR handle = ?
    `).all(admin.id, admin.email, admin.handle);
    const canonical = candidates.find(row => row.id === admin.id) || candidates[0] || null;
    const hasCompromisedPassword = !canonical || canonical.password_hash === COMPROMISED_ADMIN_HASH;
    const passwordHash = hasCompromisedPassword
        ? await initialAdminPasswordHash()
        : canonical.password_hash;

    const bootstrapChangedCredential = hasCompromisedPassword;
    withTransaction(() => {
        // Free unique email/handle values held by any legacy curator before creating/updating
        // the canonical record. Existing audit/update references are moved transactionally.
        const conflicts = db.prepare('SELECT id FROM curators WHERE id <> ? AND (email = ? OR handle = ?)').all(
            admin.id,
            admin.email,
            admin.handle
        );
        for (const conflict of conflicts) {
            const legacySuffix = crypto.randomBytes(8).toString('hex');
            db.prepare('UPDATE curators SET email = ?, handle = ? WHERE id = ?').run(
                `legacy-${legacySuffix}@invalid.local`,
                `legacy-${legacySuffix}`,
                conflict.id
            );
        }

        const current = db.prepare('SELECT id FROM curators WHERE id = ?').get(admin.id);
        if (current) {
            db.prepare(`
                UPDATE curators
                SET email = ?, password_hash = ?, display_name = ?, handle = ?
                WHERE id = ?
            `).run(admin.email, passwordHash, admin.displayName, admin.handle, admin.id);
        } else {
            db.prepare(`
                INSERT INTO curators (id, email, password_hash, display_name, handle, created_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run(admin.id, admin.email, passwordHash, admin.displayName, admin.handle);
        }

        db.prepare(`
            UPDATE updates
            SET author_name = ?, created_by = ?
            WHERE created_by IS NOT NULL AND created_by <> ?
        `).run(admin.displayName, admin.id, admin.id);

        db.prepare('DELETE FROM curator_sessions WHERE curator_id <> ?').run(admin.id);
        if (bootstrapChangedCredential) {
            db.prepare('DELETE FROM curator_sessions WHERE curator_id = ?').run(admin.id);
        }
        db.prepare('DELETE FROM curators WHERE id <> ?').run(admin.id);
        db.prepare("DELETE FROM members WHERE id IN ('mem-dhanush', 'mem-likith', 'mem-sarvasree') OR role = 'Curator'").run();

        const checkAdminMem = db.prepare('SELECT id FROM members WHERE id = ?').get('mem-admin');
        if (!checkAdminMem) {
            db.prepare(`
                INSERT INTO members (id, name, role, handle, avatar_url, bio, display_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `).run('mem-admin', admin.displayName, 'Admin', `@${admin.handle}`, '/assets/user_avatar.jpg', 'Sanctuary steward & literary curator', 1);
        }
    });

    // Remove only untouched legacy demo records; keep edited or used member data intact.
    removeLegacySampleContent();

    // Expired records no longer authorize anyone; clean them to keep the database bounded.
    db.prepare("DELETE FROM curator_sessions WHERE datetime(expires_at) <= datetime('now')").run();
    db.prepare("DELETE FROM member_sessions WHERE datetime(expires_at) <= datetime('now')").run();
    db.prepare("DELETE FROM member_claims WHERE datetime(expires_at) <= datetime('now') OR used_at IS NOT NULL").run();

    seedDefaultSettings();
    restrictDatabaseFilePermissions();
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
 * Remove the old demo members, private sample reading/notes, and sample announcements.
 * Fingerprints let us identify the original fixture values without keeping those values
 * in the application source. Any account with changed profile/content or evidence of use
 * is preserved so this migration cannot silently discard real member data.
 */
function contentFingerprint(parts) {
    return crypto.createHash('sha256')
        .update(parts.map(value => String(value ?? '')).join('\0'))
        .digest('hex');
}

function onlyKnownRowsOrEmpty(rows, expectedRows, fingerprintRow) {
    if (rows.length === 0) return true;
    if (rows.length !== expectedRows.length) return false;
    const expected = new Map(expectedRows.map(item => [item.id, item.fingerprint]));
    return rows.every(row => expected.get(row.id) === fingerprintRow(row));
}

function removeLegacySampleContent() {
    const legacyMembers = [
        {
            id: 'mem-akshaya',
            profileFingerprint: 'a0112fce54b62fdc2160ddba6377c10e0263bab6a2d59cdb954135a66d7d5d30',
            readings: [{
                id: 'read-akshaya',
                fingerprint: '998560253b46e446094e1e58e09f163e7b2ec807e800996129c68e7dc926f1df'
            }],
            notes: [
                { id: 'note-ak-1', fingerprint: '01ad86a37daaa95208806ff0e21206feccf6d53db703848ac78d5a7b71f16f23' },
                { id: 'note-ak-2', fingerprint: '6a924f019080e1216061fdab13fbc557e187cc33931240a142f79247f58c8614' }
            ]
        },
        {
            id: 'mem-vaishnavi',
            profileFingerprint: '179300bf7ac35f8dac16ada6e07a3953c87f6251a0019d8a6526fb2c3d4290c1',
            readings: [{
                id: 'read-vaishnavi',
                fingerprint: '5cab13c48432488337bb9c3c8a03ac0d93bf5976a2e0e4591d0cfeed60f809ee'
            }],
            notes: [
                { id: 'note-vn-1', fingerprint: '6160bce0ef9b4ebc2f96437fec2d36f08ed2710464e5f11c0e8743eb767f314e' }
            ]
        }
    ];
    const legacyUpdates = [
        { id: 'update-welcome', fingerprint: 'e0e74b5fb23e42c5b0b47b1d91651c79a8e7532108960a75930c672491a81f8f' },
        { id: 'update-meeting-notice', fingerprint: 'a7f1fd4f2251c5188243a6432610bbc6444cd5abe32286368aff5e035b6828d9' }
    ];

    withTransaction(() => {
        for (const sample of legacyMembers) {
            const member = db.prepare(`
                SELECT id, name, full_name, display_name, role, handle, avatar_url, bio,
                       display_order, gender, date_joined, status
                FROM members WHERE id = ?
            `).get(sample.id);
            if (!member) continue;

            const profileFingerprint = contentFingerprint([
                member.name, member.full_name, member.display_name, member.role, member.handle,
                member.avatar_url, member.bio, member.display_order, member.gender,
                member.date_joined, member.status
            ]);
            if (profileFingerprint !== sample.profileFingerprint) continue;

            const activity = db.prepare(`
                SELECT
                    EXISTS(SELECT 1 FROM member_sessions WHERE member_id = ?) AS has_sessions,
                    EXISTS(SELECT 1 FROM member_claims WHERE member_id = ?) AS has_claims,
                    EXISTS(SELECT 1 FROM member_notification_recipients WHERE member_id = ?) AS has_notifications
            `).get(sample.id, sample.id, sample.id);
            if (activity.has_sessions || activity.has_claims || activity.has_notifications) continue;

            const readings = db.prepare(`
                SELECT id, book_title, book_author, progress, status
                FROM member_reading WHERE member_id = ?
            `).all(sample.id);
            const notes = db.prepare(`
                SELECT id, content FROM member_notes WHERE member_id = ?
            `).all(sample.id);
            const knownReading = onlyKnownRowsOrEmpty(readings, sample.readings, row => contentFingerprint([
                row.id, row.book_title, row.book_author, row.progress, row.status
            ]));
            const knownNotes = onlyKnownRowsOrEmpty(notes, sample.notes, row => contentFingerprint([row.content]));
            if (!knownReading || !knownNotes) continue;

            db.prepare('DELETE FROM members WHERE id = ?').run(sample.id);
        }

        for (const sample of legacyUpdates) {
            const update = db.prepare(`
                SELECT id, title, content, type, is_pinned, created_by, author_name, created_at, updated_at
                FROM updates WHERE id = ?
            `).get(sample.id);
            if (!update || update.type !== 'announcement' || Number(update.is_pinned) !== 1 ||
                update.created_by !== 'admin-wabisabi' || update.author_name !== 'Wabi Sabi Admin' ||
                update.created_at !== update.updated_at ||
                contentFingerprint([update.title, update.content]) !== sample.fingerprint) {
                continue;
            }
            db.prepare('DELETE FROM updates WHERE id = ?').run(sample.id);
        }
    });
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

function updateCuratorLastLogin(id) {
    if (!id) return;
    db.prepare('UPDATE curators SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

function clearInitialAdminPasswordFile() {
    try {
        fs.unlinkSync(path.join(DATA_DIR, 'initial-admin-password.txt'));
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

function revokeOtherCuratorSessions(curatorId, currentSessionId) {
    if (!curatorId) return;
    if (currentSessionId) {
        db.prepare('DELETE FROM curator_sessions WHERE curator_id = ? AND id <> ?').run(curatorId, currentSessionId);
    } else {
        db.prepare('DELETE FROM curator_sessions WHERE curator_id = ?').run(curatorId);
    }
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
    const id = 'sess-' + crypto.randomBytes(16).toString('hex');
    withTransaction(() => {
        db.prepare("DELETE FROM curator_sessions WHERE datetime(expires_at) <= datetime('now')").run();
        db.prepare(`
            INSERT INTO curator_sessions (id, curator_id, token_hash, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(id, curatorId, tokenHash, expiresAt);
        const excess = db.prepare(`
            SELECT id FROM curator_sessions WHERE curator_id = ?
            ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 20
        `).all(curatorId);
        for (const session of excess) db.prepare('DELETE FROM curator_sessions WHERE id = ?').run(session.id);
    });
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

function getPublicUpdates(limit = 250) {
    const pageSize = Math.max(1, Math.min(500, Number(limit) || 250));
    return db.prepare(`
        SELECT id, title, content, type, is_pinned, author_name, created_at, updated_at
        FROM updates
        ORDER BY is_pinned DESC, created_at DESC
        LIMIT ?
    `).all(pageSize);
}

function createUpdate({ title, content, type = 'announcement', is_pinned = 0, created_by = null, author_name = null }) {
    const id = 'upd-' + crypto.randomBytes(12).toString('hex');
    db.prepare(`
        INSERT INTO updates (id, title, content, type, is_pinned, created_by, author_name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, title, content, type, is_pinned ? 1 : 0, created_by, author_name);
    return id;
}

function updateUpdate(id, { title, content, is_pinned }) {
    return db.prepare(`
        UPDATE updates
        SET title = COALESCE(?, title),
            content = COALESCE(?, content),
            is_pinned = COALESCE(?, is_pinned),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(title ?? null, content ?? null, is_pinned !== undefined ? (is_pinned ? 1 : 0) : null, id).changes;
}

function deleteUpdate(id) {
    return db.prepare('DELETE FROM updates WHERE id = ?').run(id).changes;
}

/**
 * Persist one broadcast notification and snapshot its active-member audience.
 * Call inside the same transaction as the admin content change it describes.
 */
function createMemberNotification({ kind, title, message, href, created_by = null }) {
    const cleanKind = typeof kind === 'string' ? kind.trim() : '';
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    const cleanMessage = typeof message === 'string' ? message.trim() : '';
    const cleanHref = typeof href === 'string' ? href.trim() : '';
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(cleanKind)) throw new Error('Notification kind is invalid.');
    if (!cleanTitle || cleanTitle.length > 160) throw new Error('Notification title is invalid.');
    if (!cleanMessage || cleanMessage.length > 500) throw new Error('Notification message is invalid.');
    if (!cleanHref.startsWith('/') || cleanHref.startsWith('//') || cleanHref.includes('\\')) {
        throw new Error('Notification destination must be a same-site path.');
    }

    const id = 'notif-' + crypto.randomBytes(12).toString('hex');
    db.prepare(`
        INSERT INTO member_notifications (id, kind, title, message, href, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(id, cleanKind, cleanTitle, cleanMessage, cleanHref, created_by || null);
    db.prepare(`
        INSERT INTO member_notification_recipients (notification_id, member_id)
        SELECT ?, id FROM members WHERE status = 'active' AND id <> 'mem-admin'
    `).run(id);

    // Keep a bounded history; cascading foreign keys remove its old recipient rows.
    db.prepare(`
        DELETE FROM member_notifications
        WHERE id IN (
            SELECT id FROM member_notifications
            ORDER BY created_at DESC, id DESC
            LIMIT -1 OFFSET 100
        )
    `).run();
    return id;
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
}, afterCreate = null) {
    const finalFullName = (full_name || name || '').trim();
    const finalDisplayName = (display_name || name || full_name || '').trim();
    const id = 'mem-' + crypto.randomBytes(12).toString('hex');
    const secretCode = generateSecretCode();
    const codeHash = hashSecretCode(secretCode);

    let joinDate = date_joined;
    if (!joinDate) {
        joinDate = new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' });
    }

    withTransaction(() => {
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
            (avatar_url || '/assets/user_avatar.jpg').trim(),
            (bio || '').trim(),
            Number(display_order) || 0,
            codeHash,
            status || 'active'
        );
        db.prepare(`
            INSERT INTO member_reading (id, member_id, book_title, book_author, progress, status)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run('read-' + crypto.randomBytes(6).toString('hex'), id, 'The Stranger', 'Albert Camus', 0, 'currently_reading');
        if (typeof afterCreate === 'function') afterCreate({ id, secretCode, member: getMemberById(id) });
    });

    return { id, secretCode, member: getMemberById(id) };
}

function updateMember(id, { name, full_name, display_name, role, handle, gender, date_joined, avatar_url, bio, display_order, status }) {
    const existing = getMemberById(id);
    if (!existing) return;

    const fName = full_name !== undefined ? full_name.trim() : (name !== undefined ? name.trim() : existing.full_name);
    const dName = display_name !== undefined ? display_name.trim() : (name !== undefined ? name.trim() : existing.display_name);

    const result = db.prepare(`
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
    return result.changes;
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
    const result = db.prepare('UPDATE members SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(clean, memberId);
    if (clean === 'suspended') {
        revokeAllMemberSessions(memberId);
    }
    return result.changes;
}

function deleteMember(id, afterDelete = null) {
    if (id === 'mem-admin') throw new Error('The built-in admin directory entry cannot be deleted.');
    return withTransaction(() => {
        const member = getMemberById(id);
        if (!member) return 0;
        revokeAllMemberSessions(id);
        db.prepare('DELETE FROM member_reading WHERE member_id = ?').run(id);
        db.prepare('DELETE FROM member_notes WHERE member_id = ?').run(id);
        db.prepare('DELETE FROM member_claims WHERE member_id = ?').run(id);
        const changes = db.prepare('DELETE FROM members WHERE id = ?').run(id).changes;
        if (changes && typeof afterDelete === 'function') afterDelete(member);
        return changes;
    });
}

// Session Management Helpers
function createMemberSession(memberId, days = 30) {
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Member session duration must be between 1 and 90 days.');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const id = 'msess-' + crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    withTransaction(() => {
        db.prepare("DELETE FROM member_sessions WHERE datetime(expires_at) <= datetime('now')").run();
        db.prepare(`
            INSERT INTO member_sessions (id, member_id, session_token_hash, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(id, memberId, tokenHash, expiresAt);
        const excess = db.prepare(`
            SELECT id FROM member_sessions WHERE member_id = ?
            ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 20
        `).all(memberId);
        for (const session of excess) db.prepare('DELETE FROM member_sessions WHERE id = ?').run(session.id);
    });

    return { token: rawToken, expiresAt };
}

function getMemberBySessionToken(rawToken) {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken)) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    return db.prepare(`
        SELECT m.id, m.name, m.full_name, m.display_name, m.handle, m.gender, m.date_joined,
               m.avatar_url, m.bio, m.role, m.status, s.id as session_id, s.expires_at
        FROM member_sessions s
        JOIN members m ON s.member_id = m.id
        WHERE s.session_token_hash = ? AND datetime(s.expires_at) > datetime('now')
    `).get(tokenHash);
}

function deleteMemberSession(rawToken) {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{64}$/i.test(rawToken)) return;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    db.prepare('DELETE FROM member_sessions WHERE session_token_hash = ?').run(tokenHash);
}

function revokeAllMemberSessions(memberId) {
    if (!memberId) return;
    db.prepare('DELETE FROM member_sessions WHERE member_id = ?').run(memberId);
}

// QR Membership Card Claim Passes
function createMemberClaim(memberId, days = 7) {
    if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Membership claim duration must be between 1 and 30 days.');
    db.prepare("DELETE FROM member_claims WHERE datetime(expires_at) <= datetime('now') OR used_at IS NOT NULL").run();
    db.prepare('DELETE FROM member_claims WHERE member_id = ?').run(memberId);
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
    if (typeof rawToken !== 'string' || rawToken.length > 128) return null;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    // A single conditional UPDATE makes claiming one-time even when multiple server
    // processes receive the same QR scan concurrently.
    const claim = db.prepare(`
        UPDATE member_claims
        SET used_at = CURRENT_TIMESTAMP
        WHERE claim_token_hash = ?
          AND datetime(expires_at) > datetime('now')
          AND used_at IS NULL
          AND member_id IN (SELECT id FROM members WHERE status = 'active')
        RETURNING member_id
    `).get(tokenHash);
    return claim ? claim.member_id : null;
}

function claimMemberPassWithSession(rawToken, days = 30) {
    if (typeof rawToken !== 'string' || !/^[a-f0-9]{48}$/i.test(rawToken)) return null;
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Member session duration must be between 1 and 90 days.');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const memberSessionToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(memberSessionToken).digest('hex');
    const sessionId = 'msess-' + crypto.randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const claim = withTransaction(() => {
        const result = db.prepare(`
            UPDATE member_claims
            SET used_at = CURRENT_TIMESTAMP
            WHERE claim_token_hash = ?
              AND datetime(expires_at) > datetime('now')
              AND used_at IS NULL
              AND member_id IN (SELECT id FROM members WHERE status = 'active')
            RETURNING member_id
        `).get(tokenHash);
        if (!result) return null;

        db.prepare("DELETE FROM member_sessions WHERE datetime(expires_at) <= datetime('now')").run();
        db.prepare(`
            INSERT INTO member_sessions (id, member_id, session_token_hash, expires_at)
            VALUES (?, ?, ?, ?)
        `).run(sessionId, result.member_id, sessionTokenHash, expiresAt);
        const excess = db.prepare(`
            SELECT id FROM member_sessions WHERE member_id = ?
            ORDER BY created_at DESC, id DESC LIMIT -1 OFFSET 20
        `).all(result.member_id);
        for (const session of excess) db.prepare('DELETE FROM member_sessions WHERE id = ?').run(session.id);
        return { memberId: result.member_id, token: memberSessionToken, expiresAt };
    });
    return claim;
}

// Member Reading & Reflection Notes Helpers
function getMemberReading(memberId) {
    return db.prepare(`
        SELECT id, book_title, book_author, progress, status, updated_at
        FROM member_reading
        WHERE member_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
    `).get(memberId) || {
        book_title: 'The Stranger',
        book_author: 'Albert Camus',
        progress: 0,
        status: 'currently_reading'
    };
}

function getMemberBookshelf(memberId, limit = 50) {
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 50));
    return db.prepare(`
        SELECT id, book_title AS title, book_author AS author, progress, status, updated_at
        FROM member_reading
        WHERE member_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT ?
    `).all(memberId, pageSize);
}

function getMemberNotifications(memberId, limit = 30) {
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 30));
    const notifications = db.prepare(`
        SELECT n.id, n.kind, n.title, n.message, n.href, n.created_at, r.read_at
        FROM member_notification_recipients r
        JOIN member_notifications n ON n.id = r.notification_id
        WHERE r.member_id = ?
        ORDER BY n.created_at DESC, n.id DESC
        LIMIT ?
    `).all(memberId, pageSize).map(item => ({
        id: item.id,
        kind: item.kind,
        title: item.title,
        message: item.message,
        href: item.href,
        created_at: item.created_at,
        readAt: item.read_at,
        isRead: Boolean(item.read_at)
    }));
    const unreadCount = db.prepare(`
        SELECT COUNT(*) AS count
        FROM member_notification_recipients
        WHERE member_id = ? AND read_at IS NULL
    `).get(memberId).count;
    return { notifications, unreadCount };
}

function markMemberNotificationRead(memberId, notificationId) {
    return db.prepare(`
        UPDATE member_notification_recipients
        SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
        WHERE member_id = ? AND notification_id = ?
    `).run(memberId, notificationId).changes > 0;
}

function markAllMemberNotificationsRead(memberId) {
    return db.prepare(`
        UPDATE member_notification_recipients
        SET read_at = CURRENT_TIMESTAMP
        WHERE member_id = ? AND read_at IS NULL
    `).run(memberId).changes;
}

function updateMemberReading(memberId, { book_title, book_author, progress }) {
    const existing = db.prepare(`
        SELECT id, progress FROM member_reading
        WHERE member_id = ?
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
    `).get(memberId);
    const requestedProgress = progress === undefined ? (existing?.progress ?? 0) : Number(progress);
    if (!Number.isFinite(requestedProgress)) throw new Error('Reading progress must be a finite number.');
    const prog = Math.max(0, Math.min(100, requestedProgress));
    if (existing) {
        db.prepare(`
            UPDATE member_reading
            SET book_title = COALESCE(?, book_title),
                book_author = COALESCE(?, book_author),
                progress = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(
            typeof book_title === 'string' && book_title.trim() ? book_title.trim() : null,
            typeof book_author === 'string' && book_author.trim() ? book_author.trim() : null,
            prog,
            existing.id
        );
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
        ORDER BY created_at DESC, id DESC
        LIMIT 200
    `).all(memberId);
}

function addMemberNote(memberId, content) {
    if (typeof content !== 'string' || !content.trim()) return null;
    const cleanContent = content.trim();
    if (cleanContent.length > 4000) {
        const error = new Error('A reflection must be 4000 characters or fewer.');
        error.code = 'NOTE_TOO_LONG';
        throw error;
    }
    const count = db.prepare('SELECT COUNT(*) AS count FROM member_notes WHERE member_id = ?').get(memberId).count;
    if (count >= 200) {
        const error = new Error('This desk has reached its 200-note limit. Delete an older note before adding another.');
        error.code = 'NOTE_LIMIT_REACHED';
        throw error;
    }
    const id = 'note-' + crypto.randomBytes(12).toString('hex');
    db.prepare(`
        INSERT INTO member_notes (id, member_id, content, created_at, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(id, memberId, cleanContent);
    return id;
}

function deleteMemberNote(noteId, memberId) {
    return db.prepare('DELETE FROM member_notes WHERE id = ? AND member_id = ?').run(noteId, memberId).changes;
}

// Initialize tables immediately
initDatabase();

module.exports = {
    db,
    withTransaction,
    initDatabase,
    seedInitialAccounts,
    seedDefaultSettings,
    getCuratorByIdentifier,
    getCuratorById,
    getCuratorWithPassword,
    updateCuratorLastLogin,
    clearInitialAdminPasswordFile,
    revokeOtherCuratorSessions,
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
    createMemberNotification,
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
    claimMemberPassWithSession,
    // Reading, notifications & notes
    getMemberReading,
    getMemberBookshelf,
    getMemberNotifications,
    markMemberNotificationRead,
    markAllMemberNotificationsRead,
    updateMemberReading,
    getMemberNotes,
    addMemberNote,
    deleteMemberNote
};
