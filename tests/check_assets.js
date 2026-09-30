const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const filesToScan = [];

function walk(dir) {
    const list = fs.readdirSync(dir);
    for (const item of list) {
        if (item === 'node_modules' || item === '.git' || item === 'scratch') continue;
        const full = path.join(dir, item);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            walk(full);
        } else if (item.endsWith('.html') || item.endsWith('.css') || item.endsWith('.js')) {
            filesToScan.push(full);
        }
    }
}

walk(rootDir);

const missingAssets = [];
const imageRegex = /(?:src=["']|url\(["']?)([^"')]+\.(?:png|jpg|jpeg|svg|gif|webp|ico|mp3|wav))["']?/gi;

for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = imageRegex.exec(content)) !== null) {
        const assetPath = match[1];
        if (assetPath.startsWith('http') || assetPath.startsWith('data:') || assetPath.startsWith('//')) continue;
        
        // Resolve relative to file or relative to Wabi Sabi root
        const fileDir = path.dirname(file);
        const resolved1 = path.resolve(fileDir, assetPath);
        const resolved2 = path.resolve(rootDir, assetPath);
        const resolved3 = path.resolve(rootDir, 'assets', path.basename(assetPath));

        if (!fs.existsSync(resolved1) && !fs.existsSync(resolved2) && !fs.existsSync(resolved3)) {
            missingAssets.push({ file: path.relative(rootDir, file), asset: assetPath });
        }
    }
}

console.log('Missing assets found:', JSON.stringify(missingAssets, null, 2));
