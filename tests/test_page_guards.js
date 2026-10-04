require('./test_config');

const assert = require('node:assert/strict');
const http = require('node:http');
const { startServer } = require('../server/index');
const {
    createCuratorSession,
    createMember,
    createMemberSession,
    deleteCuratorSession,
    deleteMember,
    getCuratorByIdentifier
} = require('../server/db');
const { generateSessionToken, hashSessionToken } = require('../server/crypto');

const memberSpacePaths = ['/community', '/reader', '/table-room', '/wabi-wall'];

function request(baseUrl, urlPath, cookie = '') {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, baseUrl);
        const headers = {};
        if (cookie) headers.Cookie = cookie;

        const req = http.request(url, { method: 'GET', headers }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => resolve({
                statusCode: res.statusCode,
                headers: res.headers,
                body
            }));
        });
        req.on('error', reject);
        req.end();
    });
}

async function testPageGuards() {
    let server;
    let memberId;
    let suspendedMemberId;
    let curatorTokenHash;

    try {
        server = await startServer(0);
        const baseUrl = `http://127.0.0.1:${server.address().port}`;

        const memberFixture = createMember({
            name: 'Page Guard Member',
            handle: 'pageguardmember',
            status: 'active'
        });
        memberId = memberFixture.id;
        const memberSession = createMemberSession(memberId, 1);
        const memberCookie = `wabisabi_member_session=${memberSession.token}`;

        const curator = getCuratorByIdentifier('wabisabiofficial3@gmail.com');
        assert(curator, 'Curator fixture should exist after server startup');
        const curatorToken = generateSessionToken();
        curatorTokenHash = hashSessionToken(curatorToken);
        createCuratorSession(curator.id, curatorTokenHash, new Date(Date.now() + 60 * 60 * 1000).toISOString());
        const curatorCookie = `wabisabi_curator_session=${curatorToken}`;

        // The public portal remains public; the curator console remains curator-only.
        const home = await request(baseUrl, '/home.html');
        assert.equal(home.statusCode, 200, 'The public home page should not require authentication');

        const visitorCurator = await request(baseUrl, '/curator');
        assert.equal(visitorCurator.statusCode, 302);
        assert.match(visitorCurator.headers.location, /^\/sanctuary\?/);

        const visitorHome = await request(baseUrl, '/');
        assert.equal(visitorHome.statusCode, 200);

        const sanctuaryGate = await request(baseUrl, '/sanctuary');
        assert.equal(sanctuaryGate.statusCode, 200);
        assert.match(sanctuaryGate.headers['cache-control'] || '', /no-store/i, 'The sign-in shell should always revalidate after authentication updates.');

        // Each member space is independently addressable but requires a verified session.
        for (const pagePath of memberSpacePaths) {
            const visitor = await request(baseUrl, pagePath);
            assert.equal(visitor.statusCode, 302, `${pagePath} should deny a visitor`);
            assert.equal(visitor.headers.location, `/my-space?returnTo=${encodeURIComponent(pagePath)}`);

            const member = await request(baseUrl, pagePath, memberCookie);
            assert.equal(member.statusCode, 200, `${pagePath} should serve an active member`);
            assert.match(member.body, /<!DOCTYPE html>/i);
            assert.match(member.headers['cache-control'] || '', /private, no-store/i);

            const curatorView = await request(baseUrl, pagePath, curatorCookie);
            assert.equal(curatorView.statusCode, 200, `${pagePath} should remain available to a verified curator`);
        }

        // Raw /pages/*.html aliases must not bypass the same server-side guard.
        const visitorAlias = await request(baseUrl, '/pages/reader.html');
        assert.equal(visitorAlias.statusCode, 302);
        assert.equal(visitorAlias.headers.location, '/my-space?returnTo=%2Freader');
        const memberAlias = await request(baseUrl, '/pages/reader.html', memberCookie);
        assert.equal(memberAlias.statusCode, 200);

        const memberCurator = await request(baseUrl, '/curator', memberCookie);
        assert.equal(memberCurator.statusCode, 302, 'A member session must not grant curator access');
        const curatorPage = await request(baseUrl, '/curator', curatorCookie);
        assert.equal(curatorPage.statusCode, 200, 'A verified curator should reach the curator console');

        // Suspended members cannot open these spaces, even when the cookie is otherwise valid.
        const suspendedFixture = createMember({
            name: 'Suspended Guard Member',
            handle: 'suspendedguard',
            status: 'suspended'
        });
        suspendedMemberId = suspendedFixture.id;
        const suspendedSession = createMemberSession(suspendedMemberId, 1);
        const suspended = await request(baseUrl, '/community', `wabisabi_member_session=${suspendedSession.token}`);
        assert.equal(suspended.statusCode, 302);
        assert.equal(suspended.headers.location, '/my-space?returnTo=%2Fcommunity');

        console.log('✓ Public home remains open; curator console and all member spaces enforce server-side access');
        console.log('✓ Member-page aliases, cache headers, suspended access, and return paths are covered');
    } finally {
        if (memberId) deleteMember(memberId);
        if (suspendedMemberId) deleteMember(suspendedMemberId);
        if (curatorTokenHash) deleteCuratorSession(curatorTokenHash);
        if (server) {
            server.closeAllConnections?.();
            await new Promise((resolve) => server.close(resolve));
        }
    }
}

testPageGuards().catch((error) => {
    console.error('Page-guard tests failed:', error);
    process.exitCode = 1;
});
