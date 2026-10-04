const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const scanDirs = ['server', 'js', 'tests'];
const files = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (fullPath.includes(`${path.sep}vendor${path.sep}`)) continue;
            walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }
}

for (const dir of scanDirs) walk(path.join(root, dir));
for (const file of files) execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
console.log(`Syntax check passed for ${files.length} first-party JavaScript files.`);
