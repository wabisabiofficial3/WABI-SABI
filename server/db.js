const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { hashPassword } = require('./crypto');

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
 * Initialize all database tables
 */
function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL COLLATE NOCASE,
            password_hash TEXT NOT NULL,
            display_name TEXT NOT NULL,
            handle TEXT UNIQUE NOT NULL COLLATE NOCASE,
            role TEXT NOT NULL CHECK (role IN ('CURATOR', 'USER')),
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_login_at DATETIME
        );

        CREATE TABLE IF NOT EXISTS membership_applications (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reason TEXT NOT NULL,
            favorite_work TEXT NOT NULL,
            perspective TEXT NOT NULL,
            contribution TEXT NOT NULL,
            conversation TEXT NOT NULL,
            status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
            reviewed_by TEXT REFERENCES users(id),
            reviewed_at DATETIME,
            curator_notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash TEXT UNIQUE NOT NULL,
            expires_at DATETIME NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id TEXT PRIMARY KEY,
            admin_id TEXT NOT NULL REFERENCES users(id),
            action TEXT NOT NULL,
            target_user_id TEXT REFERENCES users(id),
            metadata TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
        CREATE INDEX IF NOT EXISTS idx_applications_user ON membership_applications(user_id);
        CREATE INDEX IF NOT EXISTS idx_applications_status ON membership_applications(status);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);
    `);
}

/**
 * Seed initial accounts:
 * - 3 Curator accounts (Dhanush @curator, Maya @curatormaya, Julian @curatorjulian)
 * - 1 Active demo Reader (Elena Vance @quietreader)
 * - 1 Pending Applicant (Aarav @aarav)
 */
async function seedInitialAccounts() {
    const checkUserStmt = db.prepare('SELECT id FROM users WHERE email = ?');

    // 1. Curators (Likith, Sarvasree, Dhanush)
    const curators = [
        {
            id: 'curator-likith',
            email: process.env.CURATOR_1_EMAIL || 'nrlikith6@gmail.com',
            password: process.env.CURATOR_1_PASSWORD || 'curator123',
            name: 'Likith',
            handle: 'likith'
        },
        {
            id: 'curator-sarvasree',
            email: process.env.CURATOR_2_EMAIL || 'sarvasreeyuvaraj02@gmail.com',
            password: process.env.CURATOR_2_PASSWORD || 'curator123',
            name: 'Sarvasree',
            handle: 'sarvasree'
        },
        {
            id: 'curator-dhanush',
            email: process.env.CURATOR_3_EMAIL || 'ganganidhanush@gmail.com',
            password: process.env.CURATOR_3_PASSWORD || 'curator123',
            name: 'Dhanush',
            handle: 'dhanush'
        }
    ];

    const insertUserStmt = db.prepare(`
        INSERT INTO users (id, email, password_hash, display_name, handle, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of curators) {
        const existing = checkUserStmt.get(c.email);
        if (!existing) {
            const hash = await hashPassword(c.password);
            insertUserStmt.run(c.id, c.email, hash, c.name, c.handle, 'CURATOR', 'ACTIVE');
        }
    }

    // 2. Active Member: Elena Vance
    const elenaEmail = 'reader@wabisabi.club';
    if (!checkUserStmt.get(elenaEmail)) {
        const hash = await hashPassword('reader123');
        insertUserStmt.run('user-reader-01', elenaEmail, hash, 'Elena Vance', 'quietreader', 'USER', 'ACTIVE');
    }

    // 3. Pending Applicant: Aarav (for realistic initial Curator review demonstration)
    const aaravEmail = 'aarav@example.com';
    if (!checkUserStmt.get(aaravEmail)) {
        const hash = await hashPassword('aarav123');
        const userId = 'user-applicant-01';
        insertUserStmt.run(userId, aaravEmail, hash, 'Aarav', 'aarav', 'USER', 'PENDING');

        const insertAppStmt = db.prepare(`
            INSERT INTO membership_applications (id, user_id, reason, favorite_work, perspective, contribution, conversation, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
        `);
        insertAppStmt.run(
            'app-aarav-01',
            userId,
            "I'm looking for a quiet, reflective corner of the internet where literature and human stories take center stage.",
            "Italo Calvino's Invisible Cities — it taught me how language can build worlds that stay in memory forever.",
            "The dogma that every spare minute must be hyper-optimized and productive.",
            "Architectural notes, essay recommendations, and thoughtful listening in weekly discussions.",
            "Listening without rushing to answer, and giving ideas room to breathe."
        );
    }
}

// Initialize tables immediately
initDatabase();

module.exports = {
    db,
    initDatabase,
    seedInitialAccounts
};
