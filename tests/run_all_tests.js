const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const rootDir = path.join(__dirname, '..');
const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wabi-sabi-tests-'));
const testDbPath = path.join(testDataDir, 'wabisabi.sqlite');
process.env.WABI_TEST_DB_PATH = testDbPath;
const testConfig = require('./test_config');

const testSuites = [
    'tests/test_security_hardening.js',
    'tests/check_links.js',
    'tests/check_assets.js',
    'tests/test_design_tokens_and_a11y.js',
    'tests/test_hero_ctas.js',
    'tests/test_cat_animation.js',
    'tests/test_js_syntax.js',
    'tests/test_simplified_architecture.js',
    'tests/test_page_guards.js',
    'tests/test_client_guards.js',
    'tests/test_admin_logo_shortcut.js',
    'tests/e2e_sanctuary_test.js',
    'tests/test_interactive_and_admin_purge.js',
    'tests/test_member_access_system.js',
    'tests/test_paper_plane_toggle.js',
    'tests/test_functional_regressions.js'
];

async function runAll() {
    let server;
    let passedCount = 0;
    console.log('================================================================');
    console.log('   WABI SABI FUNCTIONAL & SECURITY REGRESSION SUITE');
    console.log('================================================================\n');

    try {
        const { startServer } = require('../server/index');
        server = await startServer(0);
        const port = server.address().port;
        process.env.WABI_TEST_BASE_URL = `http://127.0.0.1:${port}`;
        console.log(`Test server listening on ${process.env.WABI_TEST_BASE_URL}\n`);

        for (const suite of testSuites) {
            const suiteName = path.basename(suite);
            process.stdout.write(`► Running ${suiteName}... `);
            try {
                const { stdout } = await execFileAsync(process.execPath, [suite], {
                    cwd: rootDir,
                    encoding: 'utf8',
                    env: process.env,
                    timeout: 120000,
                    maxBuffer: 10 * 1024 * 1024
                });
                console.log('✓ PASSED');
                if (stdout.trim()) console.log(stdout.trim().split('\n').map(line => `  ${line}`).join('\n'));
                passedCount += 1;
            } catch (error) {
                console.log('✕ FAILED');
                if (error.stdout) console.error(error.stdout.toString());
                if (error.stderr) console.error(error.stderr.toString());
                throw new Error(`${suiteName} failed with exit code ${error.code ?? 'unknown'}.`);
            }
        }

        console.log('\n================================================================');
        console.log(`   ALL ${passedCount}/${testSuites.length} TEST SUITES PASSED`);
        console.log('================================================================\n');
    } finally {
        if (server) {
            server.closeAllConnections?.();
            await new Promise(resolve => server.close(resolve));
        }
        try { fs.rmSync(testDataDir, { recursive: true, force: true }); } catch (error) {}
    }
}

runAll().catch(error => {
    console.error('\nTEST RUN FAILED:', error.message);
    process.exitCode = 1;
});
