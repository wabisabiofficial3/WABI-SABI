const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const homeHtml = fs.readFileSync(path.join(root, 'pages/home.html'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'js/cat-engine.js'), 'utf8');
const spriteFrames = ['walk1', 'walk2', 'walk3', 'walk4'];

for (const frame of spriteFrames) {
    const asset = `cat_${frame}.png`;
    const id = `catSprite${frame[0].toUpperCase()}${frame.slice(1)}`;
    assert(homeHtml.includes(`id="${id}"`), `Home page must include the ${frame} sprite.`);
    assert(homeHtml.includes(`../assets/${asset}`), `Home page must preload/render ${asset}.`);

    const png = fs.readFileSync(path.join(root, 'assets', asset));
    assert.equal(png.toString('hex', 0, 8), '89504e470d0a1a0a', `${asset} must be a valid PNG.`);
    assert.equal(png.readUInt32BE(16), 963, `${asset} must use the shared frame width.`);
    assert.equal(png.readUInt32BE(20), 521, `${asset} must use the shared frame height.`);
    assert.equal(png[25], 6, `${asset} must retain an alpha channel.`);
}

const cycle = engine.match(/this\.walkSequence\s*=\s*\[([^\]]+)\]/);
assert(cycle, 'The walking cycle must be explicitly defined.');
const sequence = [...cycle[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
assert.equal(new Set(sequence).size, 4, 'The walking loop must use four distinct poses.');
assert.deepEqual(new Set(sequence), new Set(spriteFrames));
assert.match(engine, /this\.stepTimer\s*%=\s*this\.frameDuration/, 'Frame timing should preserve cadence without abrupt resets.');

for (const stylesheet of ['css/tokens.css', 'css/dashboard.css']) {
    const css = fs.readFileSync(path.join(root, stylesheet), 'utf8');
    const spriteRule = css.match(/\.cat-sprite\s*\{([^}]*)\}/s);
    assert(spriteRule, `${stylesheet} must style the cat sprite frames.`);
    assert.match(
        spriteRule[1],
        /transition:\s*opacity 0\.12s ease-in-out,\s*visibility 0s linear 0\.12s\s*;/,
        `${stylesheet} must keep outgoing frames visible until the fade completes.`
    );
    const activeRule = css.match(/\.cat-sprite\.active,[\s\S]*?\.cat-sprite:only-child\s*\{([^}]*)\}/);
    assert(activeRule, `${stylesheet} must define the active frame transition.`);
    assert.match(activeRule[1], /transition:\s*opacity 0\.12s ease-in-out,\s*visibility 0s\s*;/);

    const liftRule = css.match(/\.living-cat-actor\.step-up\s*\{([^}]*)\}/);
    const landingRule = css.match(/\.living-cat-actor\.step-down\s*\{([^}]*)\}/);
    const liftShadowRule = css.match(/\.living-cat-actor\.step-up\s+\.cat-contact-shadow\s*\{([^}]*)\}/);
    const landingShadowRule = css.match(/\.living-cat-actor\.step-down\s+\.cat-contact-shadow\s*\{([^}]*)\}/);
    assert(liftRule && landingRule && liftShadowRule && landingShadowRule, `${stylesheet} must animate the cat's lift and ground contact.`);
    assert.match(liftRule[1], /translateY\(-3px\)\s+scaleY\(1\.01\)/);
    assert.match(landingRule[1], /translateY\(0\)\s+scaleY\(0\.99\)/);
    assert.match(liftShadowRule[1], /width:\s*66%/);
    assert.match(liftShadowRule[1], /opacity:\s*0\.62/);
    assert.match(liftShadowRule[1], /translateY\(3px\)/, 'The ground shadow should stay anchored while the cat lifts.');
    assert.match(landingShadowRule[1], /width:\s*79%/);
    assert.match(landingShadowRule[1], /opacity:\s*0\.96/);
}

console.log('✓ Cat frames crossfade while body bounce and contact shadow add subtle weight.');
