const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('node:path');
const { seedInitialAccounts } = require('./db');
const authRouter = require('./routes/auth');
const applicationRouter = require('./routes/application');
const curatorRouter = require('./routes/curator');

const app = express();
const PORT = process.env.PORT || 3000;
const STATIC_ROOT = path.join(__dirname, '..');

// Middlewares
app.use(express.json());
app.use(cookieParser());

// Logging middleware to trace requests
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} (Origin: ${req.headers.origin || 'none'})`);
    next();
});

// Enable CORS for local development (Live Server, file://, custom ports)
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

// Clean route rewrites for root navigation
app.get('/', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'login.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'login.html'));
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'join.html'));
});

app.get('/curator', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'curator.html'));
});

app.get('/community', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'community.html'));
});

app.get('/application-status', (req, res) => {
    res.sendFile(path.join(STATIC_ROOT, 'application-status.html'));
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/application', applicationRouter);
app.use('/api/curator', curatorRouter);

// Static files (HTML, CSS, JS, Assets)
app.use(express.static(STATIC_ROOT));

// 404 Fallback for unknown API routes
app.use('/api', (req, res) => {
    res.status(404).json({ success: false, error: 'API endpoint not found.' });
});

// Start server function
async function startServer() {
    await seedInitialAccounts();
    return new Promise((resolve) => {
        const server = app.listen(PORT, () => {
            console.log(`✦ Wabi Sabi Server running with Argon2id + SQLite on http://localhost:${PORT}`);
            resolve(server);
        });
    });
}

if (require.main === module) {
    startServer().catch(err => {
        console.error('Failed to start Wabi Sabi server:', err);
        process.exit(1);
    });
}

module.exports = { app, startServer };
