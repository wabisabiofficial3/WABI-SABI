const { argon2id } = require('hash-wasm');
const crypto = require('node:crypto');

/**
 * Hash a password using Argon2id with 16-byte random salt.
 * Uses RFC-standard Argon2 parameters suitable for interactive logins.
 */
async function hashPassword(password) {
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
        throw new Error('Password must be a non-empty string of at most 1024 characters.');
    }
    const salt = crypto.randomBytes(16);
    const encoded = await argon2id({
        password,
        salt: new Uint8Array(salt),
        parallelism: 1,
        memorySize: 32768, // 32 MB
        iterations: 2,
        hashLength: 32,
        outputType: 'encoded'
    });
    return encoded;
}

/**
 * Verify a plaintext password against an Argon2id encoded hash string.
 * Extracts parameters and salt from the encoded string and computes hash for comparison.
 */
async function verifyPassword(password, storedHash) {
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024 ||
        typeof storedHash !== 'string' || storedHash.length > 512) {
        return false;
    }
    try {
        const parts = storedHash.split('$');
        // Standard Argon2 string format: $argon2id$v=19$m=32768,t=2,p=1$salt$hash
        if (parts.length !== 6 || parts[0] !== '' || parts[1] !== 'argon2id' || parts[2] !== 'v=19') {
            return false;
        }

        const parsed = Object.create(null);
        for (const entry of parts[3].split(',')) {
            const match = /^(m|t|p)=(\d+)$/.exec(entry);
            if (!match) return false;
            parsed[match[1]] = Number(match[2]);
        }
        const { m: memorySize, t: iterations, p: parallelism } = parsed;
        if (!Number.isInteger(memorySize) || memorySize < 8192 || memorySize > 131072 ||
            !Number.isInteger(iterations) || iterations < 1 || iterations > 10 ||
            !Number.isInteger(parallelism) || parallelism < 1 || parallelism > 8) {
            return false;
        }

        if (!/^[A-Za-z0-9+/]+$/.test(parts[4]) || !/^[A-Za-z0-9+/]+$/.test(parts[5])) return false;
        const saltBuf = Buffer.from(parts[4], 'base64');
        const expectedHash = Buffer.from(parts[5], 'base64');
        if (saltBuf.length < 8 || saltBuf.length > 64 || expectedHash.length < 16 || expectedHash.length > 64) return false;

        const recomputed = await argon2id({
            password,
            salt: new Uint8Array(saltBuf),
            parallelism,
            memorySize,
            iterations,
            hashLength: expectedHash.length,
            outputType: 'encoded'
        });

        const stored = Buffer.from(storedHash);
        const actual = Buffer.from(recomputed);
        if (stored.length !== actual.length) return false;
        return crypto.timingSafeEqual(stored, actual);
    } catch (err) {
        return false;
    }
}

/**
 * Generate a cryptographically secure session token (32 bytes / 64 hex chars).
 */
function generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Compute SHA-256 hash of a session token for secure database storage.
 */
function hashSessionToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = {
    hashPassword,
    verifyPassword,
    generateSessionToken,
    hashSessionToken
};
