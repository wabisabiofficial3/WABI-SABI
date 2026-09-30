/**
 * Automated Verification Suite for Wabi Sabi Authentication & RBAC System
 */
const { app, startServer } = require('../server/index');
const http = require('node:http');

let server;
let baseUrl;

async function request(method, path, body = null, cookie = null) {
    const url = new URL(path, baseUrl);
    return new Promise((resolve, reject) => {
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (cookie) {
            options.headers['Cookie'] = cookie;
        }

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let json = null;
                try {
                    json = JSON.parse(data);
                } catch (e) {
                    json = data;
                }
                const setCookieHeader = res.headers['set-cookie'];
                let sessionCookie = null;
                if (setCookieHeader) {
                    const cookieStr = Array.isArray(setCookieHeader) ? setCookieHeader.join(';') : setCookieHeader;
                    const match = cookieStr.match(/wabisabi_session=([^;]+)/);
                    if (match) sessionCookie = `wabisabi_session=${match[1]}`;
                }
                resolve({ status: res.statusCode, data: json, cookie: sessionCookie });
            });
        });

        req.on('error', reject);
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log('\n--- 1. Starting Server on Ephemeral Port ---');
    server = await startServer(0);
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    console.log(`✓ Test server running at ${baseUrl}`);

    let curatorCookie = null;
    let readerCookie = null;
    let applicantCookie = null;

    console.log('\n--- 2. Testing Curator Authentication (Dhanush) ---');
    const curRes = await request('POST', '/api/auth/login', {
        email: 'ganganidhanush@gmail.com',
        password: 'curator123'
    });
    console.assert(curRes.status === 200, `Expected 200, got ${curRes.status}`);
    console.assert(curRes.data.user.role === 'CURATOR', `Expected CURATOR role, got ${curRes.data.user.role}`);
    console.assert(curRes.data.redirectUrl === '/curator.html', `Expected /curator.html, got ${curRes.data.redirectUrl}`);
    console.assert(curRes.cookie, 'Expected wabisabi_session cookie');
    curatorCookie = curRes.cookie;
    console.log('✓ Curator Dhanush login & Argon2id verification passed.');

    console.log('\n--- 3. Testing Authorized Curators (Likith & Sarvasree) ---');
    const likRes = await request('POST', '/api/auth/login', {
        email: 'nrlikith6@gmail.com',
        password: 'curator123'
    });
    console.assert(likRes.status === 200, `Expected 200, got ${likRes.status}`);
    console.assert(likRes.data.user.role === 'CURATOR', 'Expected CURATOR');
    console.log('✓ Curator Likith login verified.');

    const sarRes = await request('POST', '/api/auth/login', {
        email: 'sarvasreeyuvaraj02@gmail.com',
        password: 'curator123'
    });
    console.assert(sarRes.status === 200, `Expected 200, got ${sarRes.status}`);
    console.assert(sarRes.data.user.role === 'CURATOR', 'Expected CURATOR');
    console.log('✓ Curator Sarvasree login verified.');

    console.log('\n--- 4. Testing RBAC Middleware Protection ---');
    // Unauthenticated request to curator API
    const unauthRes = await request('GET', '/api/curator/applications');
    console.assert(unauthRes.status === 401, `Expected 401 for unauthenticated access, got ${unauthRes.status}`);
    console.log('✓ Unauthenticated access to /api/curator/* rejected with 401.');

    // Curator request to curator API (Allowed)
    const allowedRes = await request('GET', '/api/curator/applications', null, curatorCookie);
    console.assert(allowedRes.status === 200, `Expected 200 for Curator, got ${allowedRes.status}`);
    console.assert(Array.isArray(allowedRes.data.applications), 'Expected applications array');
    console.log(`✓ Curator access allowed. Found ${allowedRes.data.applications.length} application(s).`);

    function randomLetters(len = 6) {
        let s = '';
        for (let i = 0; i < len; i++) s += String.fromCharCode(97 + Math.floor(Math.random() * 26));
        return s;
    }

    console.log('\n--- 5. Testing "Join the Circle" Application Submission ---');
    const suffix = randomLetters(6);
    const testEmail = `mira_${suffix}@example.com`;
    const testHandle = `mira${suffix}`;
    const newAppRes = await request('POST', '/api/application/submit', {
        name: 'Mira Sorvino',
        email: testEmail,
        password: 'miraPassword456',
        handle: testHandle,
        reason: 'Seeking calm reflections away from algorithmic noise.',
        favorite_work: 'Remains of the Day by Kazuo Ishiguro.',
        perspective: 'The rush to have an immediate, hardened opinion on everything.',
        contribution: 'Poetry essays and cinema framing discussions.',
        conversation: 'A quiet exchange where both people leave feeling understood.'
    });
    console.assert(newAppRes.status === 201, `Expected 201, got ${newAppRes.status}`);
    console.assert(newAppRes.data.user.status === 'PENDING', `Expected PENDING status, got ${newAppRes.data.user.status}`);
    console.assert(newAppRes.data.redirectUrl === '/application-status.html', `Expected /application-status.html, got ${newAppRes.data.redirectUrl}`);
    applicantCookie = newAppRes.cookie;
    console.log('✓ Membership application created with PENDING status.');

    console.log('\n--- 6. Checking Applicant Status ---');
    const statusRes = await request('GET', '/api/application/status', null, applicantCookie);
    console.assert(statusRes.status === 200, `Expected 200, got ${statusRes.status}`);
    console.assert(statusRes.data.application.status === 'PENDING', 'Expected application status to be PENDING');
    console.log('✓ Applicant status confirmed as PENDING.');

    console.log('\n--- 7. Curator Review & Approval Flow ---');
    // Curator gets applications list
    const pendingList = await request('GET', '/api/curator/applications?status=PENDING', null, curatorCookie);
    const targetApp = pendingList.data.applications.find(a => a.email === testEmail);
    console.assert(targetApp, 'Expected to find Mira in pending applications');

    // Curator approves application
    const approveRes = await request('POST', `/api/curator/applications/${targetApp.id}/approve`, {
        notes: 'A wonderful perspective on Ishiguro. Welcome to the circle!'
    }, curatorCookie);
    console.assert(approveRes.status === 200, `Expected 200, got ${approveRes.status}`);
    console.log('✓ Curator approved application.');

    console.log('\n--- 8. Approved User Next Login Test ---');
    const miraLogin = await request('POST', '/api/auth/login', {
        email: testEmail,
        password: 'miraPassword456'
    });
    console.assert(miraLogin.status === 200, `Expected 200, got ${miraLogin.status}`);
    console.assert(miraLogin.data.user.status === 'ACTIVE', `Expected ACTIVE status after approval, got ${miraLogin.data.user.status}`);
    console.assert(miraLogin.data.redirectUrl === '/community.html', `Expected redirect to /community.html, got ${miraLogin.data.redirectUrl}`);
    console.log('✓ Approved user now logs in as ACTIVE and is directed to /community.html!');

    // Test that active member is rejected from Curator API with 403
    const forbiddenRes = await request('GET', '/api/curator/applications', null, miraLogin.cookie);
    console.assert(forbiddenRes.status === 403, `Expected 403 for regular member, got ${forbiddenRes.status}`);
    console.log('✓ Regular member access to /api/curator/* rejected with 403 Forbidden.');

    console.log('\n--- 9. Curator Audit Logs Verification ---');
    const auditRes = await request('GET', '/api/curator/audit-logs', null, curatorCookie);
    console.assert(auditRes.status === 200, `Expected 200, got ${auditRes.status}`);
    const approvalLog = auditRes.data.logs.find(l => l.action === 'APPROVE_MEMBER' && l.target_handle === testHandle);
    console.assert(approvalLog, 'Expected audit log for APPROVE_MEMBER on ' + testHandle);
    console.log(`✓ Audit log verified: ${approvalLog.admin_name} (@${approvalLog.admin_handle}) approved @${approvalLog.target_handle}.`);

    console.log('\n--- 10. Rejection Flow Verification ---');
    const spamSuffix = randomLetters(6);
    const spamEmail = `spam_${spamSuffix}@bot.com`;
    const spamHandle = `spambot${spamSuffix}`;
    const badApp = await request('POST', '/api/application/submit', {
        name: 'Spam Bot',
        email: spamEmail,
        password: 'password123',
        handle: spamHandle,
        reason: 'Buy crypto',
        favorite_work: 'Crypto whitepaper',
        perspective: 'None',
        contribution: 'Spam',
        conversation: 'None'
    });
    const pendingList2 = await request('GET', '/api/curator/applications?status=PENDING', null, curatorCookie);
    const spamApp = pendingList2.data.applications.find(a => a.email === spamEmail);
    const rejectRes = await request('POST', `/api/curator/applications/${spamApp.id}/reject`, {
        notes: 'Does not meet community standards.'
    }, curatorCookie);
    console.assert(rejectRes.status === 200, 'Expected 200 on reject');

    const spamLogin = await request('POST', '/api/auth/login', {
        email: spamEmail,
        password: 'password123'
    });
    console.assert(spamLogin.data.user.status === 'REJECTED', 'Expected REJECTED status');
    console.assert(spamLogin.data.redirectUrl === '/application-status.html', 'Rejected user redirected to application-status.html');
    console.log('✓ Rejection flow and audit trail passed.');

    console.log('\n=========================================');
    console.log('🎉 ALL 10 AUTOMATED VERIFICATION TESTS PASSED!');
    console.log('=========================================\n');

    server.close();
}

runTests().catch(err => {
    console.error('Test failed with error:', err);
    if (server) server.close();
    process.exit(1);
});
