/**
 * Curator session cookie policy.
 *
 * Keep ordinary local/production sessions first-party by default (SameSite=Lax).
 * Arena's HTTPS preview may be embedded as a third-party iframe, so its isolated
 * preview process can opt into CHIPS with SameSite=None; Secure; Partitioned. Never
 * enable that option globally in production.
 */
function curatorSessionCookieOptions(req, overrides = {}) {
    const previewCookieMode = process.env.WABI_PREVIEW_PARTITIONED_COOKIES === 'true';
    let configuredPreviewUsesHttps = false;
    if (previewCookieMode && process.env.APP_BASE_URL) {
        try {
            configuredPreviewUsesHttps = new URL(process.env.APP_BASE_URL).protocol === 'https:';
        } catch (error) {
            configuredPreviewUsesHttps = false;
        }
    }
    // A TLS-terminating preview proxy may omit X-Forwarded-Proto. APP_BASE_URL is
    // explicitly configured for the public HTTPS origin in this opt-in preview mode.
    const secure = Boolean(req && req.secure) || process.env.NODE_ENV === 'production' || configuredPreviewUsesHttps;
    const partitionedPreview = previewCookieMode && secure;

    return {
        httpOnly: true,
        secure,
        sameSite: partitionedPreview ? 'none' : 'lax',
        ...(partitionedPreview ? { partitioned: true } : {}),
        path: '/',
        ...overrides
    };
}

module.exports = { curatorSessionCookieOptions };
