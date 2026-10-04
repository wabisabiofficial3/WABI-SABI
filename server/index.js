const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { seedInitialAccounts } = require('./db');
const { requireCuratorPage } = require('./middleware/auth');

const portalRouter = require('./routes/portal');
const authRouter = require('./routes/auth');
const curatorRouter = require('./routes/curator');
const userRouter = require('./routes/user');
const memberRouter = require('./routes/member');

const { securityHeaders, blockSensitiveFiles, apiRateLimiter } = require('./middleware/security');

const app = express();
app.disable('x-powered-by');

const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(STATIC_ROOT, 'pages');

// Security Middlewares
app.use(securityHeaders);
app.use(blockSensitiveFiles);

// Body and Cookie Parsers (50mb to support MP3/audio track uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Rate limit API routes
app.use('/api', apiRateLimiter);

// Safe CORS
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = !origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('render.com') || 
        origin.includes('wabi-sabi');

    if (isAllowed && origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

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
    res.sendFile(path.join(PAGES_DIR, 'sanctuary.html'));
});

// Obscure /login, /login.html, /admin by redirecting visitors to public portal
app.get(['/login', '/login.html', '/pages/login.html', '/admin', '/admin.html'], (req, res) => {
    res.redirect('/');
});

app.get(['/curator', '/curator.html', '/pages/curator.html'], requireCuratorPage, (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'curator.html'));
});

// Redirect legacy membership/community pages to the public home portal
app.get(['/join', '/join.html', '/pages/join.html',
         '/application-status', '/application-status.html', '/pages/application-status.html',
         '/community', '/community.html', '/pages/community.html',
         '/reader', '/reader.html', '/pages/reader.html',
         '/table-room', '/table-room.html', '/pages/table-room.html',
         '/wabi-wall', '/wabi-wall.html', '/pages/wabi-wall.html',
         '/theme-weeks', '/theme-weeks.html', '/pages/theme-weeks.html'], (req, res) => {
    res.redirect('/');
});

// Member Space route (The Member's Personal Literary Desk)
app.get(['/my-space', '/my-space.html', '/pages/my-space.html'], (req, res) => {
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

// Compatibility route for existing notice queries
app.get('/api/notices', (req, res) => {
    res.redirect(307, '/api/portal');
});

// ====================================================================
// SEO & ROOT WEB ASSETS
// ====================================================================
app.get('/robots.txt', (req, res) => {
    res.type('text/plain').sendFile(path.join(STATIC_ROOT, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').sendFile(path.join(STATIC_ROOT, 'sitemap.xml'));
});

app.get(['/favicon.ico', '/favicon.png'], (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'favicon.ico'));
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
