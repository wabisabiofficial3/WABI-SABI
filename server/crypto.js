const { argon2id } = require('hash-wasm');
const crypto = require('node:crypto');

/**
 * Hash a password using Argon2id with 16-byte random salt.
 * Uses RFC-standard Argon2 parameters suitable for interactive logins.
 */
async function hashPassword(password) {
    if (typeof password !== 'string' || password.length === 0) {
        throw new Error('Password must be a non-empty string');
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
    if (!password || !storedHash || typeof storedHash !== 'string') {
        return false;
    }
    try {
        const parts = storedHash.split('$');
        // Standard Argon2 string format: $argon2id$v=19$m=32768,t=2,p=1$salt$hash
        if (parts.length !== 6 || parts[1] !== 'argon2id') {
            return false;
        }

        const params = parts[3].split(',').reduce((acc, p) => {
            const [k, v] = p.split('=');
            acc[k] = parseInt(v, 10);
            return acc;
        }, {});

        const saltB64 = parts[4];
        const saltBuf = Buffer.from(saltB64, 'base64');

        const recomputed = await argon2id({
            password,
            salt: new Uint8Array(saltBuf),
            parallelism: params.p || 1,
            memorySize: params.m || 32768,
            iterations: params.t || 2,
            hashLength: 32,
            outputType: 'encoded'
        });

        const bufA = Buffer.from(storedHash);
        const bufB = Buffer.from(recomputed);
        if (bufA.length !== bufB.length) {
            return false;
        }
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (err) {
        console.error('Password verification error:', err);
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
