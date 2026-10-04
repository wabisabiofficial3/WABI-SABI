const { getMemberBySessionToken, getMemberById, getCuratorBySessionTokenHash } = require('../db');
const crypto = require('node:crypto');

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
                return next();
            }
        }
    }

    // 2. Check for regular Member Session cookie
    const memberToken = cookies.wabisabi_member_session;
    if (memberToken) {
        const member = getMemberBySessionToken(memberToken);
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
    res.setHeader('Cache-Control', 'private, no-store');
    const memberToken = req.cookies?.wabisabi_member_session;
    if (memberToken) {
        const member = getMemberBySessionToken(memberToken);
        if (member && member.status === 'active') {
            req.member = member;
            req.isCuratorPreview = false;
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
