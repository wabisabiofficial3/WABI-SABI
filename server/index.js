const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cookieParser = require('cookie-parser');
const { seedInitialAccounts } = require('./db');
const { requireCuratorPage } = require('./middleware/auth');
const { requireMemberPage } = require('./middleware/memberAuth');

const portalRouter = require('./routes/portal');
const authRouter = require('./routes/auth');
const curatorRouter = require('./routes/curator');
const userRouter = require('./routes/user');
const memberRouter = require('./routes/member');
const noticesRouter = require('./routes/notices');

const { securityHeaders, blockSensitiveFiles, corsAndCsrf, apiRateLimiter } = require('./middleware/security');

const app = express();
app.disable('x-powered-by');

// This app is deployed behind one reverse proxy by default (Render/Arena). Override
// TRUST_PROXY_HOPS=0 for direct deployments, or set the exact trusted hop count.
const trustProxyHops = process.env.TRUST_PROXY_HOPS === undefined
    ? 1
    : Number(process.env.TRUST_PROXY_HOPS);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 0 || trustProxyHops > 10) {
    throw new Error('TRUST_PROXY_HOPS must be an integer between 0 and 10.');
}
app.set('trust proxy', trustProxyHops);

const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(STATIC_ROOT, 'pages');

// Security Middlewares
app.use(securityHeaders);
app.use(blockSensitiveFiles);
app.use(corsAndCsrf);

// Rate-limit API traffic before parsing request bodies so oversized or malformed
// requests cannot consume parser resources without first using the request quota.
// corsAndCsrf handles OPTIONS requests before they reach this limiter.
app.use('/api', apiRateLimiter);

// Every current JSON write payload is well below 100 KB; keep the parser bound tight.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '1kb' }));
app.use(cookieParser());

// ====================================================================
// PUBLIC PORTAL ROUTE (Zero login required - Visitors enter directly)
// ====================================================================
app.get(['/', '/home', '/home.html', '/pages/home.html', '/index.html', '/dashboard', '/dashboard.html'], (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'home.html'));
});

// ====================================================================
// UNLISTED CURATOR GATEWAY (The Sanctuary)
// Unlisted entrance for Curators only. Real security is server-side auth.
// ====================================================================
app.get([
    '/sanctuary',
    '/sanctuary.html',
    '/pages/sanctuary.html',
    '/home.html/sanctuary',
    '/pages/home.html/sanctuary',
    '/home/sanctuary',
    '/dashboard/sanctuary'
], (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(PAGES_DIR, 'sanctuary.html'));
});

// Obscure /login, /login.html, /admin by redirecting visitors to public portal
app.get(['/login', '/login.html', '/pages/login.html', '/admin', '/admin.html'], (req, res) => {
    res.redirect('/');
});

app.get(['/curator', '/curator.html', '/pages/curator.html'], requireCuratorPage, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'curator.html'));
});

// Standalone Member Spaces: independently addressable and cross-linked destinations.
// Server-side authentication is required even when a page is opened by its /pages/*.html alias.
const memberSpacePages = [
    { routes: ['/community', '/community.html', '/pages/community.html'], file: 'community.html' },
    { routes: ['/reader', '/reader.html', '/pages/reader.html'], file: 'reader.html' },
    { routes: ['/table-room', '/table-room.html', '/pages/table-room.html'], file: 'table-room.html' },
    { routes: ['/wabi-wall', '/wabi-wall.html', '/pages/wabi-wall.html'], file: 'wabi-wall.html' }
];

for (const page of memberSpacePages) {
    app.get(page.routes, requireMemberPage, (req, res) => {
        res.sendFile(path.join(PAGES_DIR, page.file));
    });
}

// Obsolete membership application and theme-week paths still return to the public portal.
app.get(['/join', '/join.html', '/pages/join.html',
         '/application-status', '/application-status.html', '/pages/application-status.html',
         '/theme-weeks', '/theme-weeks.html', '/pages/theme-weeks.html'], (req, res) => {
    res.redirect('/');
});

// Member Space route (The Member's Personal Literary Desk)
app.get(['/my-space', '/my-space.html', '/pages/my-space.html'], (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.sendFile(path.join(PAGES_DIR, 'my-space.html'));
});

// ====================================================================
// API ROUTES
// ====================================================================
app.use('/api/portal', portalRouter);
app.use('/api/auth', authRouter);
app.use('/api/curator', curatorRouter);
app.use('/api/user', userRouter);
app.use('/api/member', memberRouter);
app.use('/api/notices', noticesRouter);

// ====================================================================
// SEO & ROOT WEB ASSETS
// ====================================================================
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').sendFile(path.join(STATIC_ROOT, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').sendFile(path.join(STATIC_ROOT, 'sitemap.xml'));
});

app.get('/favicon.ico', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'favicon.ico'));
});

app.get('/favicon.png', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'favicon.png'));
});

app.get('/site.webmanifest', (req, res) => {
    res.type('application/manifest+json').sendFile(path.join(STATIC_ROOT, 'site.webmanifest'));
});

// Static files (Assets, CSS, JS, Pages)
app.use(['/assets', '/pages/assets'], express.static(path.join(STATIC_ROOT, 'assets'), { maxAge: '1d' }));
app.use(['/css', '/pages/css'], express.static(path.join(STATIC_ROOT, 'css'), { maxAge: '1d' }));
app.use(['/js', '/pages/js'], express.static(path.join(STATIC_ROOT, 'js'), { maxAge: '1d' }));
app.use('/pages', express.static(PAGES_DIR));

// ====================================================================
// HEALTH & RENDER ANTI-SLEEP KEEP-ALIVE
// ====================================================================
app.get(['/health', '/api/health'], (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'wabi-sabi-coordination-portal',
        uptime: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

// 404 Fallback for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// Do not let Express' development error page disclose parser or filesystem stacks.
app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);

    const requestedStatus = Number(error.statusCode || error.status);
    const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
        ? requestedStatus
        : 500;
    const message = status === 400
        ? 'Invalid request.'
        : status === 413
            ? 'Request body exceeds the allowed size.'
            : status >= 500
                ? 'An internal server error occurred.'
                : 'The request could not be completed.';

    if (status >= 500) console.error('Unhandled request error:', error);
    res.setHeader('Cache-Control', 'no-store');
    if (/^\/api(?:\/|$)/i.test(req.path)) {
        return res.status(status).json({ success: false, error: message });
    }
    return res.status(status).type('text/plain').send(message);
});

// Start server function
async function startServer(port = (process.env.PORT || 3000)) {
    await seedInitialAccounts();
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            const actualPort = server.address() ? server.address().port : port;
            console.log(`✦ Wabi Sabi Coordination Portal running on http://localhost:${actualPort}`);

            // Render Anti-Sleep Self-Ping (Render free tier spins down after 15m of zero requests)
            const pingHost = process.env.RENDER_EXTERNAL_URL || process.env.SELF_PING_URL;
            if (pingHost) {
                const target = `${pingHost.replace(/\/$/, '')}/health`;
                setInterval(async () => {
                    try {
                        const pingRes = await fetch(target, { headers: { 'User-Agent': 'WabiSabi-KeepAlive/1.0' } });
                        if (pingRes.ok) {
                            console.log(`[Keep-Alive] Self-ping successful: ${target}`);
                        }
                    } catch (err) {
                        console.warn(`[Keep-Alive] Self-ping notice:`, err.message);
                    }
                }, 13 * 60 * 1000); // Pulse every 13 minutes (Render sleeps at 15m)
                console.log(`✦ Render Anti-Sleep self-ping active: ${target}`);
            }

            resolve(server);
        });
        server.on('error', reject);
    });
}

if (require.main === module) {
    startServer().catch(err => {
        console.error('Failed to start Wabi Sabi server:', err);
        process.exit(1);
    });
}

module.exports = { app, startServer };
