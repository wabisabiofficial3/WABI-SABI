const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const serverDir = path.join(rootDir, 'server');
const routesDir = path.join(serverDir, 'routes');

const findings = [];

function addFinding(category, severity, file, issue, details) {
    findings.push({ category, severity, file, issue, details });
}

// -------------------------------------------------------------
// 1. Audit API Endpoints (Frontend fetch calls vs Backend routes)
// -------------------------------------------------------------
const backendRoutes = new Set();
// server/index.js
backendRoutes.add('GET /');
backendRoutes.add('GET /login');
backendRoutes.add('GET /join');
backendRoutes.add('GET /curator');
backendRoutes.add('GET /community');
backendRoutes.add('GET /application-status');
backendRoutes.add('GET /reader');
backendRoutes.add('GET /table-room');
backendRoutes.add('GET /home');
backendRoutes.add('GET /wabi-wall');
backendRoutes.add('GET /theme-weeks');

// Read route files
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const rf of routeFiles) {
    const content = fs.readFileSync(path.join(routesDir, rf), 'utf8');
    const prefix = rf === 'auth.js' ? '/api/auth' :
                   rf === 'application.js' ? '/api/application' :
                   rf === 'curator.js' ? '/api/curator' :
                   rf === 'notices.js' ? '/api/notices' : '';
    
    const routerRegex = /router\.(get|post|put|patch|delete)\(['"]([^'"]+)['"]/g;
    let m;
    while ((m = routerRegex.exec(content)) !== null) {
        const method = m[1].toUpperCase();
        let sub = m[2];
        if (sub === '/') sub = '';
        backendRoutes.add(`${method} ${prefix}${sub}`);
    }
}

// Scan frontend JS and HTML for fetch calls
const allFiles = [];
function gather(dir) {
    for (const item of fs.readdirSync(dir)) {
        if (item === 'node_modules' || item === '.git' || item === 'scratch') continue;
        const p = path.join(dir, item);
        if (fs.statSync(p).isDirectory()) gather(p);
        else if (item.endsWith('.js') || item.endsWith('.html')) allFiles.push(p);
    }
}
gather(rootDir);

for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (rel.startsWith('server')) continue;
    const content = fs.readFileSync(f, 'utf8');
    
    const fetchRegex = /fetch\(\s*[`'"](\/api\/[^`'"?]+)/g;
    let m;
    while ((m = fetchRegex.exec(content)) !== null) {
        const url = m[1];
        // Check if matching route exists (simplistic param match)
        let exists = false;
        for (const br of backendRoutes) {
            const [method, bUrl] = br.split(' ');
            const pattern = bUrl.replace(/:[^\/]+/g, '[^/]+');
            if (new RegExp(`^${pattern}$`).test(url)) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            addFinding('API Integrity', 'High', rel, `Frontend calls unknown API route: ${url}`, `Route not found in Express routes.`);
        }
    }
}

// -------------------------------------------------------------
// 2. Audit Duplicate IDs & HTML Tag Health
// -------------------------------------------------------------
const htmlFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.html'));
for (const hf of htmlFiles) {
    const content = fs.readFileSync(path.join(rootDir, hf), 'utf8');
    const idRegex = /id=["']([^"']+)["']/g;
    const ids = new Map();
    let m;
    while ((m = idRegex.exec(content)) !== null) {
        const id = m[1];
        ids.set(id, (ids.get(id) || 0) + 1);
    }
    for (const [id, count] of ids.entries()) {
        if (count > 1) {
            addFinding('HTML / DOM', 'Medium', hf, `Duplicate element ID: #${id} (occurs ${count} times)`, `IDs must be document-unique.`);
        }
    }
    
    // Check missing alt attributes on images
    const imgRegex = /<img\b([^>]*)>/gi;
    while ((m = imgRegex.exec(content)) !== null) {
        const attrs = m[1];
        if (!attrs.includes('alt=')) {
            addFinding('Accessibility', 'Low', hf, `Image missing alt attribute: ${m[0].substring(0, 60)}...`, `WCAG accessibility guideline.`);
        }
    }

    // Check title tag
    if (!content.includes('<title>')) {
        addFinding('SEO & Standards', 'Medium', hf, `Page missing <title> tag`, `SEO requirement`);
    }

    // Check favicon
    if (!content.includes('rel="icon"') && !content.includes("rel='icon'")) {
        addFinding('UX / Branding', 'Low', hf, `Page missing favicon link`, `Branding consistency`);
    }
}

// -------------------------------------------------------------
// 3. Audit Navigation Dock consistency across all pages
// -------------------------------------------------------------
const expectedDocks = ['home', 'reading', 'table-room', 'community', 'wabi-wall'];
for (const hf of ['home.html', 'reader.html', 'table-room.html', 'community.html', 'wabi-wall.html']) {
    const content = fs.readFileSync(path.join(rootDir, hf), 'utf8');
    for (const tab of expectedDocks) {
        if (!content.includes(`data-tab="${tab}"`)) {
            addFinding('Navigation', 'Medium', hf, `Dock missing standard item data-tab="${tab}"`, `Nav dock inconsistency.`);
        }
    }
}

// -------------------------------------------------------------
// 4. Dead Anchor Targets & Inactive Hash Links
// -------------------------------------------------------------
for (const hf of htmlFiles) {
    const content = fs.readFileSync(path.join(rootDir, hf), 'utf8');
    const hashRegex = /href=["'](#[^"']+)["']/g;
    let m;
    while ((m = hashRegex.exec(content)) !== null) {
        const hash = m[1];
        if (hash === '#' || hash === '#!') {
            addFinding('Dead Links', 'Low', hf, `Generic empty anchor link href="${hash}"`, `Should have an explicit target or button type.`);
        } else {
            const targetId = hash.substring(1);
            if (!content.includes(`id="${targetId}"`) && !content.includes(`id='${targetId}'`)) {
                addFinding('Dead Links', 'Low', hf, `Anchor target href="${hash}" has no matching element id in page`, `Broken in-page anchor.`);
            }
        }
    }
}

// -------------------------------------------------------------
// 5. Script & Style Tags Health
// -------------------------------------------------------------
for (const hf of htmlFiles) {
    const content = fs.readFileSync(path.join(rootDir, hf), 'utf8');
    const srcRegex = /<script\b[^>]*src=["']([^"']+)["']/gi;
    let m;
    while ((m = srcRegex.exec(content)) !== null) {
        const src = m[1];
        if (!src.startsWith('http') && !src.startsWith('//')) {
            const scriptPath = path.resolve(rootDir, src);
            if (!fs.existsSync(scriptPath)) {
                addFinding('Script Health', 'High', hf, `Script tag refers to missing file: ${src}`, `Missing JS bundle.`);
            }
        }
    }
    const cssRegex = /<link\b[^>]*href=["']([^"']+\.css)["']/gi;
    while ((m = cssRegex.exec(content)) !== null) {
        const href = m[1];
        if (!href.startsWith('http') && !href.startsWith('//')) {
            const cssPath = path.resolve(rootDir, href);
            if (!fs.existsSync(cssPath)) {
                addFinding('CSS Health', 'High', hf, `Link tag refers to missing CSS file: ${href}`, `Missing stylesheet.`);
            }
        }
    }
}

console.log(`Audit complete. Found ${findings.length} findings.`);
fs.writeFileSync(path.join(rootDir, 'scratch', 'findings.json'), JSON.stringify(findings, null, 2));
