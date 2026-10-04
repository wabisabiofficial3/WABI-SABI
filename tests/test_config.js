const os = require('node:os');
const path = require('node:path');

// Test-only bootstrap data. This fixture is never imported by production code.
const ADMIN_PASSWORD = process.env.WABI_TEST_ADMIN_PASSWORD || 'WabiSabi-Test-Admin-2026!';
process.env.NODE_ENV = 'test';
process.env.WABI_ADMIN_PASSWORD = ADMIN_PASSWORD;
process.env.WABI_ADMIN_EMAIL = 'wabisabiofficial3@gmail.com';
process.env.WABI_ADMIN_HANDLE = 'admin';
process.env.TRUST_PROXY_HOPS = '0';
process.env.APP_BASE_URL = process.env.WABI_TEST_APP_BASE_URL || '';
delete process.env.CORS_ALLOWED_ORIGINS;
process.env.WABI_DB_PATH = process.env.WABI_TEST_DB_PATH || path.join(os.tmpdir(), `wabi-sabi-test-${process.pid}.sqlite`);

module.exports = {
    ADMIN_PASSWORD,
    get baseUrl() {
        return process.env.WABI_TEST_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3000';
    }
};
