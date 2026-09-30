const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { seedInitialAccounts } = require('./db');
const { requireCuratorPage } = require('./middleware/auth');

const portalRouter = require('./routes/portal');
const authRouter = require('./routes/auth');
const curatorRouter = require('./routes/curator');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');
const PAGES_DIR = path.join(STATIC_ROOT, 'pages');

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Enable CORS for local development
app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin !== 'null') {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
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
app.get(['/', '/home', '/home.html', '/pages/home.html', '/index.html', '/dashboard', '/dashboard.html', '/announcements', '/connect'], (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'home.html'));
});

// ====================================================================
// CURATOR AUTHENTICATION & DASHBOARD ROUTES (Only 3 Curators log in)
// ====================================================================
app.get(['/login', '/login.html', '/pages/login.html'], (req, res) => {
    res.sendFile(path.join(PAGES_DIR, 'login.html'));
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

// ====================================================================
// API ROUTES
// ====================================================================
app.use('/api/portal', portalRouter);
app.use('/api/auth', authRouter);
app.use('/api/curator', curatorRouter);

// Compatibility route for existing notice queries
app.get('/api/notices', (req, res) => {
    res.redirect(307, '/api/portal');
});

// Static files (Assets, CSS, JS, Pages)
app.use(['/assets', '/pages/assets'], express.static(path.join(STATIC_ROOT, 'assets')));
app.use(['/css', '/pages/css'], express.static(path.join(STATIC_ROOT, 'css')));
app.use(['/js', '/pages/js'], express.static(path.join(STATIC_ROOT, 'js')));
app.use('/pages', express.static(PAGES_DIR));
app.use(express.static(PAGES_DIR));
app.use(express.static(STATIC_ROOT));

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
