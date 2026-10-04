const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');

const testSuites = [
    'tests/test_simplified_architecture.js',
    'tests/check_links.js',
    'tests/check_assets.js',
    'tests/test_design_tokens_and_a11y.js',
    'tests/test_hero_ctas.js',
    'tests/e2e_sanctuary_test.js',
    'tests/test_interactive_and_admin_purge.js',
    'tests/test_all_user_requirements.js',
    'tests/test_security_seo_cookies.js',
    'tests/test_user_memory.js',
    'tests/test_member_access_system.js',
    'tests/test_paper_plane_toggle.js',
    'tests/test_sanctuary_music.js',
    'tests/test_unauthenticated_links_gating.js',
    'tests/test_admin_logo_shortcut.js'
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
