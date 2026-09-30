/**
 * Dynamic Asset Path Resolver
 * Ensures assets resolve correctly regardless of whether the page is hosted at root,
 * /pages/ subdirectory, or opened directly via file://.
 */
function resolveCatAsset(relativePath) {
    const clean = relativePath.replace(/^(\.\.\/|\.\/|\/)/, '');
    const assetName = clean.replace(/^assets\//, '');
    if (typeof window !== 'undefined') {
        const path = window.location.pathname || '';
        if (path.includes('/pages/') || path.includes('\\pages\\') || window.location.protocol === 'file:') {
            return '../assets/' + assetName;
        }
        return '/assets/' + assetName;
    }
    return '../assets/' + assetName;
}

// ======================================================================
// 1. CAT SOUND SYSTEM: USER-UPLOADED MEOW AUDIO WITH FALLBACK SYNTHESIS
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
// 2. STEADY AUTONOMOUS TASKBAR WALKING CAT (Zoom-Adaptive)
// ======================================================================
class TaskbarCatEngine {
    constructor() {
        this.container = document.getElementById('livingCatActor');
        this.sprite = document.getElementById('catSprite');
        this.bubble = document.getElementById('catSpeechBubble');
        this.sound = new CatSoundSystem();

        this.poses = {
            walk1: resolveCatAsset('assets/cat_walk1.png'),
            walk2: resolveCatAsset('assets/cat_walk2.png'),
            look: resolveCatAsset('assets/cat_look.png'),
            sit: resolveCatAsset('assets/cat_sit.png')
        };

        this.x = 120;
        this.direction = 1; // 1 = right, -1 = left
        this.speed = 1.35;  // steady stride
        this.walkFrame = 0;
        this.stepTimer = 0;
        this.isInteracting = false;
        this.isTurning = false;

        this.updateBoundaries();

        window.addEventListener('resize', () => {
            this.updateBoundaries();
        });

        this.init();
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

    init() {
        if (!this.container || !this.sprite) return;
        this.sprite.src = this.poses.walk1;
        this.container.style.left = `${this.x}px`;
        this.sprite.style.transform = `scaleX(${this.direction})`;
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
        if (this.sprite) {
            this.sprite.src = this.poses.look;
        }

        if (this.bubbleTimer) clearTimeout(this.bubbleTimer);
        this.bubbleTimer = setTimeout(() => {
            if (this.bubble) this.bubble.classList.remove('active');
            this.isInteracting = false;
        }, 2400);
    }

    turnAround(newDir) {
        this.isTurning = true;
        if (this.sprite) this.sprite.src = this.poses.look;

        setTimeout(() => {
            this.direction = newDir;
            if (this.sprite) this.sprite.style.transform = `scaleX(${this.direction})`;
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

            if (!this.isInteracting && !this.isTurning && this.container && this.sprite) {
                this.x += this.direction * this.speed * (dt * 60);

                this.stepTimer += dt;
                if (this.stepTimer >= 0.18) {
                    this.stepTimer = 0;
                    this.walkFrame = (this.walkFrame + 1) % 2;
                    this.sprite.src = this.walkFrame === 0 ? this.poses.walk1 : this.poses.walk2;
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
// 3. THE HIDDEN MOTIVE ENGINE: SCRAMBLED PAPER -> ORIGAMI ROCKET
// ======================================================================
class HiddenMotiveRocketEngine {
    constructor(catEngine) {
        this.cat = catEngine;
        this.paperBall = document.getElementById('scrambledPaperBall');
        this.rocket = document.getElementById('flyingPaperRocket');
        this.triggerBtn = document.getElementById('launchRocketBtn');
        this.isSequenceActive = false;

        if (this.triggerBtn) {
            this.triggerBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.triggerEvent();
            });
        }

        // Initial launch after 12 seconds
        setTimeout(() => {
            this.triggerEvent();
        }, 12000);

        this.scheduleNextRandomEvent();
    }

    scheduleNextRandomEvent() {
        const nextDelay = 35000 + Math.random() * 25000;
        setTimeout(() => {
            this.triggerEvent();
            this.scheduleNextRandomEvent();
        }, nextDelay);
    }

    triggerEvent() {
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
            this.cat.isInteracting = true;
            if (this.cat.sprite) this.cat.sprite.src = this.cat.poses.look;

            setTimeout(() => {
                this.paperBall.className = 'scrambled-paper-ball unfolding';

                setTimeout(() => {
                    this.launchRocket(targetX, window.innerHeight - 70);
                    this.paperBall.className = 'scrambled-paper-ball';

                    if (this.cat.sprite) this.cat.sprite.src = this.cat.poses.sit;

                    setTimeout(() => {
                        this.cat.isInteracting = false;
                        this.isSequenceActive = false;
                    }, 3200);
                }, 400);

            }, 850);

        }, 900);
    }

    launchRocket(startX, startY) {
        if (!this.rocket) return;
        this.rocket.style.setProperty('--start-x', `${startX}px`);
        this.rocket.style.setProperty('--start-y', `${startY}px`);
        this.rocket.className = 'flying-paper-rocket flying';

        setTimeout(() => {
            this.rocket.className = 'flying-paper-rocket';
        }, 6500);
    }
}

// Auto-initialize Cat & Rocket when on community page
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
