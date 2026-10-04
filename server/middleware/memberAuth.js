const { getMemberBySessionToken, getMemberById, getCuratorBySessionTokenHash } = require('../db');
const crypto = require('node:crypto');

/**
 * requireMember middleware
 * Authenticates requests via wabisabi_member_session HTTP-only cookie.
 * Also supports Curator Preview mode if an authenticated Curator is viewing a member space.
 */
function requireMember(req, res, next) {
    // 1. Check for Curator Preview mode
    const previewId = req.query.preview || req.headers['x-curator-preview'];
    const curatorToken = req.cookies.wabisabi_curator_session;

    if (previewId && curatorToken) {
        const curatorTokenHash = crypto.createHash('sha256').update(curatorToken).digest('hex');
        const curator = getCuratorBySessionTokenHash(curatorTokenHash);
        if (curator) {
            const targetMember = getMemberById(previewId);
            if (targetMember) {
                req.member = targetMember;
                req.isCuratorPreview = true;
                req.curator = curator;
                return next();
            }
        }
    }

    // 2. Check for regular Member Session cookie
    const memberToken = req.cookies?.wabisabi_member_session;
    if (memberToken) {
        const member = getMemberBySessionToken(memberToken);
        if (member) {
            if (member.status === 'suspended') {
                return res.status(403).json({
                    success: false,
                    error: 'Membership is currently suspended. Please speak with your Curator.'
                });
            }
            req.member = member;
            req.isCuratorPreview = false;
            return next();
        }
    }

    // Unauthenticated: API endpoints MUST return 401
    const isApi = (req.originalUrl || req.baseUrl || req.path || '').startsWith('/api/');
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
    const memberToken = req.cookies?.wabisabi_member_session;
    if (memberToken) {
        const member = getMemberBySessionToken(memberToken);
        if (member && member.status === 'active') {
            req.member = member;
            req.isCuratorPreview = false;
            return next();
        }
    }

    const curatorToken = req.cookies?.wabisabi_curator_session;
    if (curatorToken) {
        const curatorTokenHash = crypto.createHash('sha256').update(curatorToken).digest('hex');
        const curator = getCuratorBySessionTokenHash(curatorTokenHash);
        if (curator) {
            req.member = {
                id: curator.id,
                name: curator.displayName || curator.name || 'Curator Admin',
                display_name: curator.displayName || curator.name || 'Curator Admin',
                handle: curator.handle || '@curator',
                role: 'Curator'
            };
            req.isCurator = true;
            return next();
        }
    }

    req.member = null;
    req.isCuratorPreview = false;
    next();
}

module.exports = {
    requireMember,
    optionalMember
};
