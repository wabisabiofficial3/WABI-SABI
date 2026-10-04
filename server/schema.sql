-- ==============================================================================
-- WABI SABI OPTIONAL SUPABASE POSTGRESQL SCHEMA
-- Safe to apply repeatedly: this script never drops existing data.
-- The active application currently uses SQLite (server/db.js); no credentials are seeded here.
-- ==============================================================================

-- 1. CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    handle TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('CURATOR', 'USER')),
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 3. CREATE MEMBERSHIP APPLICATIONS TABLE
CREATE TABLE IF NOT EXISTS membership_applications (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    favorite_work TEXT NOT NULL,
    perspective TEXT NOT NULL,
    contribution TEXT NOT NULL,
    conversation TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    curator_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CREATE SESSIONS TABLE
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CREATE ADMIN AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    admin_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    target_user_id TEXT REFERENCES users(id),
    metadata TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. CREATE PERFORMANCE & SEARCH INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(LOWER(handle));
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_applications_user ON membership_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON membership_applications(status);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_logs(created_at);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) FOR DEFENSE IN DEPTH
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 8. Curator account provisioning is performed by the application bootstrap flow.
-- Never commit passwords, even hashed defaults with a published password.
