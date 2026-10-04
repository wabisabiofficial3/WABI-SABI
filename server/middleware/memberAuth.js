const { getMemberBySessionToken, getMemberById, getCuratorBySessionTokenHash } = require('../db');
const { getAuthenticatedCurator } = require('./auth');
const { curatorSessionCookieOptions } = require('../sessionCookies');
const crypto = require('node:crypto');

const MEMBER_PAGE_PATHS = new Map([
    ['/community', '/community'],
    ['/community.html', '/community'],
    ['/pages/community.html', '/community'],
    ['/reader', '/reader'],
    ['/reader.html', '/reader'],
    ['/pages/reader.html', '/reader'],
    ['/table-room', '/table-room'],
    ['/table-room.html', '/table-room'],
    ['/pages/table-room.html', '/table-room'],
    ['/wabi-wall', '/wabi-wall'],
    ['/wabi-wall.html', '/wabi-wall'],
    ['/pages/wabi-wall.html', '/wabi-wall']
]);

function getAuthenticatedMember(req) {
    const memberToken = req.cookies?.wabisabi_member_session;
    if (typeof memberToken !== 'string') return null;
    return getMemberBySessionToken(memberToken);
}

/**
 * Page-level guard for the standalone member spaces. The page shell is served only
 * to a valid active member or curator; member-only API authorization remains separate.
 */
function requireMemberPage(req, res, next) {
    res.setHeader('Cache-Control', 'private, no-store');

    const curator = getAuthenticatedCurator(req);
    if (curator) {
        req.curator = curator;
        req.user = curator;
        return next();
    }

    const member = getAuthenticatedMember(req);
    if (member && member.status === 'active') {
        req.member = member;
        req.isCuratorPreview = false;
        return next();
    }

    if (req.cookies?.wabisabi_member_session && !member) {
        res.clearCookie('wabisabi_member_session', {
            httpOnly: true,
            secure: req.secure || process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });
    }

    if (req.cookies?.wabisabi_curator_session || req.cookies?.wabisabi_session) {
        const cookieOptions = curatorSessionCookieOptions(req);
        res.clearCookie('wabisabi_curator_session', cookieOptions);
        res.clearCookie('wabisabi_session', cookieOptions);
    }

    const pathname = String(req.path || '').replace(/\/+$/, '').toLowerCase() || '/';
    const returnTo = MEMBER_PAGE_PATHS.get(pathname) || '/';
    return res.redirect(`/my-space?returnTo=${encodeURIComponent(returnTo)}`);
}

/**
 * requireMember middleware
 * Authenticates requests via wabisabi_member_session HTTP-only cookie.
 * Also supports Curator Preview mode if an authenticated Curator is viewing a member space.
 */
function requireMember(req, res, next) {
    res.setHeader('Cache-Control', 'private, no-store');
    const cookies = req.cookies || {};

    // 1. Check for Curator Preview mode
    const previewId = req.query?.preview || req.headers['x-curator-preview'];
    const curatorToken = cookies.wabisabi_curator_session;

    if (previewId && typeof curatorToken === 'string' && /^[a-f0-9]{64}$/i.test(curatorToken)) {
        const curatorTokenHash = crypto.createHash('sha256').update(curatorToken).digest('hex');
        const curator = getCuratorBySessionTokenHash(curatorTokenHash);
        if (curator) {
            const targetMember = getMemberById(previewId);
            if (targetMember) {
                req.member = targetMember;
                req.isCuratorPreview = true;
                req.curator = curator;
                if (!['GET', 'HEAD'].includes(String(req.method || '').toUpperCase())) {
                    return res.status(403).json({
                        success: false,
                        error: 'Curator previews are read-only. Member data was not changed.'
                    });
                }
                return next();
            }
        }
    }

    // 2. Check for regular Member Session cookie
    const member = getAuthenticatedMember(req);
    if (member) {
        if (member.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: member.status === 'suspended'
                    ? 'Membership is currently suspended. Please speak with your Curator.'
                    : 'This membership is not currently active. Please speak with your Curator.'
            });
        }
        req.member = member;
        req.isCuratorPreview = false;
        return next();
    }

    // Unauthenticated: API endpoints MUST return 401
    const isApi = /^\/api(?:\/|$)/i.test(req.originalUrl || req.baseUrl || req.path || '');
    if (isApi || req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
            success: false,
            error: 'Valid Wabi Sabi member code required.',
            requiresCode: true
        });
    }

    // For page requests, proceed with null member so the page can render the tranquil access card
    req.member = null;
    req.isCuratorPreview = false;
    next();
}

/**
 * optionalMember middleware
 * Attaches member if cookie is present without blocking unauthenticated requests
 */
function optionalMember(req, res, next) {
    res.setHeader('Cache-Control', 'private, no-store');
    const member = getAuthenticatedMember(req);
    if (member && member.status === 'active') {
        req.member = member;
        req.isCuratorPreview = false;
        return next();
    }
    req.member = null;
    req.isCuratorPreview = false;
    next();
}

module.exports = {
    requireMember,
    requireMemberPage,
    optionalMember,
    getAuthenticatedMember
};
