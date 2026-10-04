/**
 * WABI SABI - LIVING TASKBAR CAT ENGINE ("MOCHI")
 * Autonomous, physics-grounded, zero-latency walking feline companion.
 * 
 * Engineered for 100% reliability across all deployment environments:
 * - Localhost (Node / Express / Live Server / file://)
 * - GitHub Pages (Subpath repository domains)
 * - Cloud Platforms (Render, Vercel, Netlify, Railway, Custom Domains)
 */

// ======================================================================
// 1. DYNAMIC ASSET PATH RESOLVER & PRELOADER
// ======================================================================
function getBaseAssetPath() {
    if (typeof window === 'undefined') return '../assets/';

    // Check existing DOM image paths to inherit verified relative prefix
    const existingImg = document.querySelector('img[src*="cat_"], img[src*="assets/"]');
    if (existingImg && existingImg.getAttribute('src')) {
        const srcAttr = existingImg.getAttribute('src');
        const match = srcAttr.match(/^(.*\/)?assets\//);
        if (match && match[0]) return match[0];
    }

    // Check script tag source URL
    const catScript = document.querySelector('script[src*="cat-engine"]');
    if (catScript && catScript.src) {
        try {
            const scriptUrl = new URL(catScript.src, window.location.href);
            const basePath = scriptUrl.pathname.replace(/\/js\/[^\/]+$/, '');
            const prefix = basePath === '/' ? '' : basePath;
            return prefix + '/assets/';
        } catch (e) {}
    }

    const path = window.location.pathname || '';
    if (path.includes('/pages/') || path.includes('\\pages\\') || window.location.protocol === 'file:') {
        return '../assets/';
    }

    // GitHub Pages / subfolder deployments
    const pathSegments = path.split('/').filter(Boolean);
    if (pathSegments.length > 0 && !path.endsWith('.html') && !['home', 'dashboard', 'community', 'connect', 'announcements'].includes(pathSegments[0])) {
        return `/${pathSegments[0]}/assets/`;
    }

    return '/assets/';
}

function resolveCatAsset(relativePath) {
    const clean = relativePath.replace(/^(\.\.\/|\.\/|\/)/, '');
    const assetName = clean.replace(/^assets\//, '');
    const base = getBaseAssetPath();
    return base.endsWith('/') ? base + assetName : base + '/' + assetName;
}

// In-memory decoded image cache to prevent network latency stalls
const CatAssetCache = {
    walk1: null,
    walk2: null,
    walk3: null,
    walk4: null,
    look: null,
    sit: null,
    preloadAll() {
        if (typeof window === 'undefined') return;
        const poses = {
            walk1: resolveCatAsset('assets/cat_walk1.png'),
            walk2: resolveCatAsset('assets/cat_walk2.png'),
            walk3: resolveCatAsset('assets/cat_walk3.png'),
            walk4: resolveCatAsset('assets/cat_walk4.png'),
            look: resolveCatAsset('assets/cat_look.png'),
            sit: resolveCatAsset('assets/cat_sit.png')
        };
        Object.keys(poses).forEach(key => {
            const img = new Image();
            img.src = poses[key];
            if (img.decode) {
                img.decode().catch(() => {});
            }
            CatAssetCache[key] = img;
        });
    }
};

if (typeof window !== 'undefined') {
    CatAssetCache.preloadAll();
}

// ======================================================================
// 2. CAT SOUND SYSTEM: USER-UPLOADED MEOW AUDIO WITH FALLBACK SYNTHESIS
// ======================================================================
class CatSoundSystem {
    constructor() {
        this.mp3Url = resolveCatAsset('assets/meow.mp3');
        this.wavUrl = resolveCatAsset('assets/meow.wav');
        this.audioElement = new Audio(this.mp3Url);
        this.audioElement.preload = 'auto';
        this.audioElement.volume = 0.95;
    }

    playMeow() {
        try {
            const audio = new Audio(this.mp3Url);
            audio.volume = 0.95;
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch((err) => {
                    console.warn('MP3 playback failed, trying WAV audio fallback:', err);
                    try {
                        const fallbackAudio = new Audio(this.wavUrl);
                        fallbackAudio.volume = 0.95;
                        const wavPromise = fallbackAudio.play();
                        if (wavPromise !== undefined) {
                            wavPromise.catch(() => {
                                this.synthesizeSlowMeow();
                            });
                        }
                    } catch (e2) {
                        this.synthesizeSlowMeow();
                    }
                });
            }
        } catch (e) {
            this.synthesizeSlowMeow();
        }
    }

    synthesizeSlowMeow() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(430, now);
            osc.frequency.exponentialRampToValueAtTime(740, now + 0.45);
            osc.frequency.exponentialRampToValueAtTime(390, now + 1.4);

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);
            filter.frequency.exponentialRampToValueAtTime(2200, now + 0.45);
            filter.frequency.exponentialRampToValueAtTime(900, now + 1.4);

            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.35, now + 0.2);
            gain.gain.linearRampToValueAtTime(0.30, now + 0.7);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 1.55);
        } catch (e) {
            console.log('Audio ready');
        }
    }
}

// ======================================================================
// 3. STEADY AUTONOMOUS TASKBAR WALKING CAT (Physics-Grounded)
// ======================================================================
class TaskbarCatEngine {
    constructor() {
        this.container = document.getElementById('livingCatActor');
        this.bubble = document.getElementById('catSpeechBubble');
        this.shadow = document.getElementById('catContactShadow');
        this.sound = new CatSoundSystem();

        // Layered pre-rendered frame elements
        this.frames = {
            walk1: document.getElementById('catSpriteWalk1'),
            walk2: document.getElementById('catSpriteWalk2'),
            walk3: document.getElementById('catSpriteWalk3'),
            walk4: document.getElementById('catSpriteWalk4'),
            look: document.getElementById('catSpriteLook'),
            sit: document.getElementById('catSpriteSit')
        };

        // Legacy / fallback single sprite support
        this.sprite = document.getElementById('catSprite') || this.frames.walk1;

        this.poses = {
            walk1: resolveCatAsset('assets/cat_walk1.png'),
            walk2: resolveCatAsset('assets/cat_walk2.png'),
            walk3: resolveCatAsset('assets/cat_walk3.png'),
            walk4: resolveCatAsset('assets/cat_walk4.png'),
            look: resolveCatAsset('assets/cat_look.png'),
            sit: resolveCatAsset('assets/cat_sit.png')
        };

        this.currentPose = 'walk1';
        this.x = 120;
        this.direction = 1; // 1 = right, -1 = left
        this.speed = 1.35;  // steady stride speed
        this.walkSequence = ['walk1', 'walk3', 'walk2', 'walk4'];
        this.walkFrameIndex = 0;
        this.frameDuration = 0.18;
        this.stepTimer = 0;
        this.isInteracting = false;
        this.isTurning = false;

        this.setupAutoAssetFallbacks();
        this.updateBoundaries();

        window.addEventListener('resize', () => {
            this.updateBoundaries();
        });

        this.init();
    }

    setupAutoAssetFallbacks() {
        // Attach resilient error handlers to DOM frames to auto-resolve broken paths
        const allImgs = this.container ? this.container.querySelectorAll('img') : [];
        allImgs.forEach(img => {
            img.onerror = () => {
                const currentSrc = img.src || '';
                const fileName = currentSrc.split('/').pop();
                if (!fileName) return;

                const candidates = [
                    '../assets/' + fileName,
                    '/assets/' + fileName,
                    'assets/' + fileName,
                    './assets/' + fileName
                ];

                const nextCandidate = candidates.find(c => !currentSrc.endsWith(c));
                if (nextCandidate && !img.dataset.failedOnce) {
                    img.dataset.failedOnce = 'true';
                    img.src = nextCandidate;
                }
            };
        });
    }

    setPose(poseName) {
        if (!this.poses[poseName]) return;
        this.currentPose = poseName;
        if (poseName === 'look' || poseName === 'sit') {
            this.container?.classList.remove('step-up', 'step-down');
        }

        // 1. If layered DOM frames exist, toggle active class instantaneously (0ms lag)
        let hasLayeredFrames = false;
        Object.keys(this.frames).forEach(key => {
            const frameEl = this.frames[key];
            if (frameEl) {
                hasLayeredFrames = true;
                if (key === poseName) {
                    frameEl.classList.add('active');
                } else {
                    frameEl.classList.remove('active');
                }
            }
        });

        // 2. If fallback single sprite is in use, update its src
        if (!hasLayeredFrames && this.sprite) {
            this.sprite.src = this.poses[poseName];
        }

        // 3. Keep legacy #catSprite src in sync for test assertions
        const legacySprite = document.getElementById('catSprite');
        if (legacySprite && legacySprite !== this.sprite) {
            legacySprite.src = this.poses[poseName];
        }
    }

    updateBoundaries() {
        this.minX = Math.max(60, window.innerWidth * 0.04);
        const catWidth = this.container ? (this.container.offsetWidth || 175) : 175;
        this.maxX = Math.max(this.minX + 150, window.innerWidth - catWidth - 30);
        if (this.x > this.maxX) {
            this.x = this.maxX;
            if (this.container) this.container.style.left = `${this.x}px`;
        }
        if (this.x < this.minX) {
            this.x = this.minX;
            if (this.container) this.container.style.left = `${this.x}px`;
        }
    }

    applyDirectionTransform() {
        // Apply directional flip to both container frames and individual sprites
        const transformValue = `scaleX(${this.direction})`;
        Object.values(this.frames).forEach(frameEl => {
            if (frameEl) frameEl.style.transform = transformValue;
        });
        if (this.sprite) {
            this.sprite.style.transform = transformValue;
        }
    }

    init() {
        if (!this.container) return;
        this.setPose('walk1');
        this.container.style.left = `${this.x}px`;
        this.applyDirectionTransform();
        this.setupTouchMeow();
        this.startWalkLoop();
    }

    setupTouchMeow() {
        const onTouch = (e) => {
            e.stopPropagation();
            this.triggerMeow();
        };

        this.container.addEventListener('click', onTouch);
        this.container.addEventListener('touchstart', onTouch, { passive: true });
    }

    triggerMeow() {
        this.sound.playMeow();
        this.isInteracting = true;

        if (this.bubble) {
            this.bubble.classList.add('active');
        }
        this.setPose('look');

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
        this.bubbleTimer = setTimeout(() => {
            if (this.bubble) this.bubble.classList.remove('active');
            this.isInteracting = false;
        }, 2400);
    }

    turnAround(newDir) {
        this.isTurning = true;
        this.setPose('look');

        setTimeout(() => {
            this.direction = newDir;
            this.applyDirectionTransform();
            setTimeout(() => {
                this.isTurning = false;
            }, 400);
        }, 800);
    }

    startWalkLoop() {
        let lastTime = performance.now();

        const loop = (currentTime) => {
            const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
            lastTime = currentTime;

            if (!this.isInteracting && !this.isTurning && this.container) {
                this.x += this.direction * this.speed * (dt * 60);

                this.stepTimer += dt;
                if (this.stepTimer >= this.frameDuration) {
                    this.stepTimer %= this.frameDuration;
                    this.walkFrameIndex = (this.walkFrameIndex + 1) % this.walkSequence.length;
                    this.setPose(this.walkSequence[this.walkFrameIndex]);

                    const isLiftPhase = this.walkFrameIndex % 2 === 1;
                    this.container.classList.toggle('step-up', isLiftPhase);
                    this.container.classList.toggle('step-down', !isLiftPhase);
                }

                if (this.direction === 1 && this.x >= this.maxX) {
                    this.x = this.maxX;
                    this.turnAround(-1);
                } else if (this.direction === -1 && this.x <= this.minX) {
                    this.x = this.minX;
                    this.turnAround(1);
                }

                this.container.style.left = `${this.x}px`;
            }

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }
}

// ======================================================================
// 4. THE HIDDEN MOTIVE ENGINE: SCRAMBLED PAPER -> ORIGAMI ROCKET (DEFAULT OFF)
// ======================================================================
class HiddenMotiveRocketEngine {
    constructor(catEngine) {
        this.cat = catEngine;
        this.paperBall = document.getElementById('scrambledPaperBall');
        this.rocket = document.getElementById('flyingPaperRocket');
        this.triggerBtn = document.getElementById('launchRocketBtn');
        this.isSequenceActive = false;
        this.enabled = false; // Default: OFF as requested by Admin

        if (this.triggerBtn) {
            this.triggerBtn.style.display = 'none'; // Hidden by default
            this.triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.enabled) this.triggerEvent();
            });
        }
    }

    enable() {
        this.enabled = true;
        if (this.triggerBtn) {
            this.triggerBtn.style.display = 'inline-flex';
        }
        if (!this.timerStarted) {
            this.timerStarted = true;
            this.initialTimer = setTimeout(() => {
                if (this.enabled) this.triggerEvent();
            }, 12000);
            this.scheduleNextRandomEvent();
        }
    }

    disable() {
        this.enabled = false;
        if (this.triggerBtn) {
            this.triggerBtn.style.display = 'none';
        }
        if (this.initialTimer) clearTimeout(this.initialTimer);
        if (this.randomTimer) clearTimeout(this.randomTimer);
        this.timerStarted = false;
    }

    scheduleNextRandomEvent() {
        if (!this.enabled) return;
        const nextDelay = 35000 + Math.random() * 25000;
        this.randomTimer = setTimeout(() => {
            if (this.enabled) {
                this.triggerEvent();
                this.scheduleNextRandomEvent();
            }
        }, nextDelay);
    }

    triggerEvent() {
        if (!this.enabled) return;
        if (!this.paperBall || !this.rocket || !this.cat) return;
        if (this.isSequenceActive || this.cat.isInteracting) return;
        this.isSequenceActive = true;

        const catX = this.cat.x;
        const dir = this.cat.direction;
        const tossDistance = dir === 1 ? 95 : -70;
        const targetX = Math.max(90, Math.min(window.innerWidth - 220, catX + tossDistance));

        this.paperBall.style.left = `${targetX}px`;
        this.paperBall.className = 'scrambled-paper-ball tossed';

        setTimeout(() => {
            if (!this.enabled) {
                this.isSequenceActive = false;
                return;
            }
            this.cat.isInteracting = true;
            this.cat.setPose('look');

            setTimeout(() => {
                if (!this.enabled) {
                    this.isSequenceActive = false;
                    this.cat.isInteracting = false;
                    return;
                }
                this.paperBall.className = 'scrambled-paper-ball unfolding';

                setTimeout(() => {
                    this.launchRocket(targetX, window.innerHeight - 70);
                    this.paperBall.className = 'scrambled-paper-ball';

                    this.cat.setPose('sit');

                    setTimeout(() => {
                        this.cat.isInteracting = false;
                        this.isSequenceActive = false;
                    }, 3200);
                }, 400);

            }, 850);

        }, 900);
    }

    launchRocket(startX, startY) {
        if (!this.rocket || !this.enabled) return;
        this.rocket.style.setProperty('--start-x', `${startX}px`);
        this.rocket.style.setProperty('--start-y', `${startY}px`);
        this.rocket.className = 'flying-paper-rocket flying';

        setTimeout(() => {
            this.rocket.className = 'flying-paper-rocket';
        }, 6500);
    }
}

// Global hook to toggle paper plane feature dynamically
window.setPaperPlaneFeature = function(enabled) {
    if (window.wabiSabiRocket) {
        if (enabled) {
            window.wabiSabiRocket.enable();
        } else {
            window.wabiSabiRocket.disable();
        }
    }
};

// Auto-initialize Cat & Rocket when on community/portal page
function bootCatEngine() {
    if (document.getElementById('livingCatActor') && !window.wabiSabiCat) {
        window.wabiSabiCat = new TaskbarCatEngine();
        window.wabiSabiRocket = new HiddenMotiveRocketEngine(window.wabiSabiCat);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootCatEngine);
} else {
    bootCatEngine();
}
