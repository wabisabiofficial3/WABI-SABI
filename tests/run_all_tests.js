const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const testSuites = [
    'tests/test_simplified_architecture.js',
    'tests/check_links.js',
    'tests/check_assets.js',
    'tests/test_design_tokens_and_a11y.js'
];

console.log('================================================================');
console.log('   WABI SABI COORDINATION PORTAL AUDIT & TEST RUNNER');
console.log('================================================================\n');

let passedCount = 0;

for (const suite of testSuites) {
    const suiteName = path.basename(suite);
    process.stdout.write(`► Running ${suiteName}... `);
    try {
        const output = execSync(`node ${suite}`, { cwd: rootDir, encoding: 'utf8' });
        console.log('✓ PASSED');
        passedCount++;
    } catch (err) {
        console.log('✕ FAILED');
        console.error(err.stdout || err.message);
        process.exit(1);
    }
}

console.log('\n================================================================');
console.log(`   ALL ${passedCount}/${testSuites.length} MASTER TEST SUITES PASSED CLEANLY!`);
console.log('================================================================\n');
