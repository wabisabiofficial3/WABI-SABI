const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const pagesDir = path.join(rootDir, 'pages');

// Collect all html files from pages/ and rootDir
const htmlFiles = [];
if (fs.existsSync(pagesDir)) {
    fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).forEach(f => {
        htmlFiles.push({ file: f, fullPath: path.join(pagesDir, f) });
    });
}
fs.readdirSync(rootDir).filter(f => f.endsWith('.html')).forEach(f => {
    htmlFiles.push({ file: f, fullPath: path.join(rootDir, f) });
});

// Scan hrefs in HTML files
const linkIssues = [];
for (const { file, fullPath } of htmlFiles) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const fileDir = path.dirname(fullPath);
    
    // Check href
    const hrefRegex = /href=["']([^"']+)["']/g;
    let match;
    while ((match = hrefRegex.exec(content)) !== null) {
        const href = match[1];
        if (href.startsWith('http') || href.startsWith('mailto:') || href.startsWith('data:') || href.startsWith('#')) {
            // Check hash in same file if it starts with #
            if (href.startsWith('#') && href.length > 1) {
                const targetId = href.substring(1);
                if (!content.includes(`id="${targetId}"`) && !content.includes(`id='${targetId}'`)) {
                    linkIssues.push({ file, type: 'hash_not_found_in_page', href });
                }
            }
            continue;
        }
        
        // Split path and hash
        const [cleanPath, hash] = href.split('#');
        if (cleanPath.endsWith('.css') || cleanPath.endsWith('.png') || cleanPath.endsWith('.ico') || cleanPath.endsWith('.webmanifest')) {
            const assetOnDisk = path.resolve(fileDir, cleanPath);
            if (!fs.existsSync(assetOnDisk)) {
                linkIssues.push({ file, type: 'asset_href_missing', href });
            }
            continue;
        }
        
        // Resolve web route paths or file paths
        let targetOnDisk;
        if (cleanPath === '/' || cleanPath === '') {
            targetOnDisk = path.join(pagesDir, 'home.html');
        } else if (cleanPath === '/my-space') {
            targetOnDisk = path.join(pagesDir, 'my-space.html');
        } else if (cleanPath === '/sanctuary') {
            targetOnDisk = path.join(pagesDir, 'sanctuary.html');
        } else if (cleanPath.startsWith('/')) {
            const pageCandidate = path.join(pagesDir, cleanPath.slice(1).endsWith('.html') ? cleanPath.slice(1) : `${cleanPath.slice(1)}.html`);
            if (fs.existsSync(pageCandidate)) {
                targetOnDisk = pageCandidate;
            } else {
                targetOnDisk = path.join(rootDir, cleanPath.slice(1));
            }
        } else {
            targetOnDisk = path.resolve(fileDir, cleanPath);
        }
        
        if (!fs.existsSync(targetOnDisk)) {
            linkIssues.push({ file, type: 'page_missing', href });
        } else if (fs.statSync(targetOnDisk).isDirectory()) {
            const homeCandidate = path.join(targetOnDisk, 'pages', 'home.html');
            const indexCandidate = path.join(targetOnDisk, 'index.html');
            if (fs.existsSync(homeCandidate)) {
                targetOnDisk = homeCandidate;
            } else if (fs.existsSync(indexCandidate)) {
                targetOnDisk = indexCandidate;
            }
        }
        
        if (fs.existsSync(targetOnDisk) && !fs.statSync(targetOnDisk).isDirectory() && hash) {
            // Check if hash exists in target page
            const targetContent = fs.readFileSync(targetOnDisk, 'utf8');
            if (!targetContent.includes(`id="${hash}"`) && !targetContent.includes(`id='${hash}'`)) {
                linkIssues.push({ file, type: 'hash_not_found_in_target', href, target: cleanPath, hash });
            }
        }
    }
}

if (linkIssues.length > 0) {
    console.error('❌ Link issues found:', JSON.stringify(linkIssues, null, 2));
    process.exit(1);
} else {
    console.log('✓ 0 link issues found across all HTML pages');
}
