/**
 * Wabi Sabi — Onboarding ("Join the Circle") Controller (js/onboarding.js)
 * Manages:
 * 1. 5-step notebook wizard navigation
 * 2. Live immutable handle validation with 4 indicators
 * 3. Interests chips, intentions, contributions selection
 * 4. Stamped Library Membership card celebration & registration
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Data Models & Lists
    const INTERESTS_LIST = [
        "Books & Literature", "Cinema & Films", "Philosophy", "Quiet Living",
        "Architecture", "Psychology", "Art & Aesthetics", "Music & Ambient",
        "Science & Cosmos", "Poetry", "Photography", "Essays & Notes",
        "Solitude & Stillness", "Creativity"
    ];

    const INTENTIONS_LIST = [
        { icon: "📖", title: "Read more deeply without algorithmic rush" },
        { icon: "🎬", title: "Discover films and stories beyond algorithms" },
        { icon: "☕", title: "Have slower, kinder conversations with real depth" },
        { icon: "🌿", title: "Meet fellow quiet thinkers and curious minds" },
        { icon: "✍️", title: "Share my own notes, essays, and marginalia" },
        { icon: "🌙", title: "Find a quiet refuge from the noisy, algorithmic internet" }
    ];

    const CONTRIBUTIONS_LIST = [
        "Writing & Essays", "Book Recommendations", "Film Criticism",
        "Deep Listening", "Philosophical Questions", "Discussion Hosting",
        "Gentle Encouragement", "Research & History", "Artistic Marginalia",
        "Poetic Observations"
    ];

    const state = {
        currentStep: 1,
        name: '',
        email: '',
        password: '',
        handle: '',
        interests: ["Books & Literature", "Cinema & Films"],
        intentions: ["Read more deeply without algorithmic rush"],
        contributions: ["Writing & Essays"]
    };

    // 2. DOM Elements
    const stepIndicator = document.getElementById('obStepIndicator');
    const progressFill = document.getElementById('obProgressFill');

    const steps = [
        document.getElementById('obStep1'),
        document.getElementById('obStep2'),
        document.getElementById('obStep3'),
        document.getElementById('obStep4'),
        document.getElementById('obStep5'),
        document.getElementById('obStep6')
    ];

    function showStep(stepNum) {
        state.currentStep = stepNum;
        steps.forEach((el, idx) => {
            if (el) el.style.display = (idx + 1 === stepNum) ? 'block' : 'none';
        });

        const stepNames = ["Identity", "Permanent Handle", "Interests", "Intentions", "Contributions", "Welcome"];
        if (stepIndicator) {
            stepIndicator.textContent = stepNum <= 5 ? `Step 0${stepNum} / 05 — ${stepNames[stepNum - 1]}` : `Welcome to the Circle`;
        }
        if (progressFill) {
            progressFill.style.width = `${Math.min(100, stepNum * 20)}%`;
        }
    }

    // Step 1: Identity
    const nameInput = document.getElementById('obNameInput');
    const emailInput = document.getElementById('obEmailInput');
    const passwordInput = document.getElementById('obPasswordInput');
    const step1NextBtn = document.getElementById('obStep1NextBtn');

    if (step1NextBtn) {
        step1NextBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const pass = passwordInput.value;

            if (!name) {
                window.WabiSabiStore.showToast("Please enter your name or pen name.");
                nameInput.focus();
                return;
            }
            if (!email || !email.includes('@')) {
                window.WabiSabiStore.showToast("Please enter a valid email address.");
                emailInput.focus();
                return;
            }
            if (!pass || pass.length < 6) {
                window.WabiSabiStore.showToast("Please create a password of at least 6 characters.");
                passwordInput.focus();
                return;
            }

            state.name = name;
            state.email = email;
            state.password = pass;

            // Auto-suggest handle based on name if handle is empty
            if (!state.handle) {
                const suggested = window.WabiSabiStore.normalizeHandle(name);
                handleInput.value = suggested;
                checkHandleLive(suggested);
            }

            showStep(2);
        });
    }

    // Step 2: Handle Validation
    const handleInput = document.getElementById('obHandleInput');
    const ruleLetters = document.getElementById('ruleLetters');
    const ruleLength = document.getElementById('ruleLength');
    const ruleAvailable = document.getElementById('ruleAvailable');
    const step2NextBtn = document.getElementById('obStep2NextBtn');
    const step2BackBtn = document.getElementById('obStep2BackBtn');

    function checkHandleLive(rawVal) {
        const val = window.WabiSabiStore.validateHandle(rawVal);
        state.handle = val.normalized;

        // Rule 1: Letters only
        if (val.lettersOnly && rawVal.trim().length > 0) {
            ruleLetters.className = 'handle-rule-item valid';
            ruleLetters.querySelector('.rule-icon').textContent = '✓';
        } else if (rawVal.trim().length > 0) {
            ruleLetters.className = 'handle-rule-item invalid';
            ruleLetters.querySelector('.rule-icon').textContent = '✗';
        } else {
            ruleLetters.className = 'handle-rule-item';
            ruleLetters.querySelector('.rule-icon').textContent = '○';
        }

        // Rule 2: Valid length (3-20 letters)
        if (val.validLength) {
            ruleLength.className = 'handle-rule-item valid';
            ruleLength.querySelector('.rule-icon').textContent = '✓';
        } else if (rawVal.trim().length > 0) {
            ruleLength.className = 'handle-rule-item invalid';
            ruleLength.querySelector('.rule-icon').textContent = '✗';
        } else {
            ruleLength.className = 'handle-rule-item';
            ruleLength.querySelector('.rule-icon').textContent = '○';
        }

        // Rule 3: Available
        if (val.validLength && val.lettersOnly) {
            if (val.isAvailable) {
                ruleAvailable.className = 'handle-rule-item valid';
                ruleAvailable.querySelector('.rule-icon').textContent = '✓';
            } else {
                ruleAvailable.className = 'handle-rule-item invalid';
                ruleAvailable.querySelector('.rule-icon').textContent = '✗';
            }
        } else {
            ruleAvailable.className = 'handle-rule-item';
            ruleAvailable.querySelector('.rule-icon').textContent = '○';
        }

        if (step2NextBtn) {
            step2NextBtn.disabled = !val.isValid;
        }
    }

    if (handleInput) {
        handleInput.addEventListener('input', () => {
            // Auto clean/normalize two words or spaces in real time
            const raw = handleInput.value;
            checkHandleLive(raw);
        });
    }

    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', () => showStep(1));
    }

    if (step2NextBtn) {
        step2NextBtn.addEventListener('click', () => {
            const val = window.WabiSabiStore.validateHandle(handleInput.value);
            if (!val.isValid) {
                window.WabiSabiStore.showToast("Please choose an available letters-only handle.");
                return;
            }
            state.handle = val.normalized;
            showStep(3);
        });
    }

    // Step 3: Interests
    const interestsGrid = document.getElementById('obInterestsGrid');
    const step3NextBtn = document.getElementById('obStep3NextBtn');
    const step3BackBtn = document.getElementById('obStep3BackBtn');

    if (interestsGrid) {
        interestsGrid.innerHTML = '';
        INTERESTS_LIST.forEach(item => {
            const chip = document.createElement('div');
            chip.className = `interest-chip ${state.interests.includes(item) ? 'selected' : ''}`;
            chip.textContent = item;
            chip.addEventListener('click', () => {
                if (state.interests.includes(item)) {
                    state.interests = state.interests.filter(i => i !== item);
                    chip.classList.remove('selected');
                } else {
                    state.interests.push(item);
                    chip.classList.add('selected');
                }
            });
            interestsGrid.appendChild(chip);
        });
    }

    if (step3BackBtn) step3BackBtn.addEventListener('click', () => showStep(2));
    if (step3NextBtn) {
        step3NextBtn.addEventListener('click', () => {
            if (state.interests.length < 1) {
                window.WabiSabiStore.showToast("Please choose at least one curiosity.");
                return;
            }
            showStep(4);
        });
    }

    // Step 4: Intentions
    const intentionsGrid = document.getElementById('obIntentionsGrid');
    const step4NextBtn = document.getElementById('obStep4NextBtn');
    const step4BackBtn = document.getElementById('obStep4BackBtn');

    if (intentionsGrid) {
        intentionsGrid.innerHTML = '';
        INTENTIONS_LIST.forEach(obj => {
            const card = document.createElement('div');
            const isSel = state.intentions.includes(obj.title);
            card.className = `intention-card ${isSel ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="intention-checkbox">${isSel ? '✓' : ''}</div>
                <div style="font-size: 16px;">${obj.icon}</div>
                <div style="flex: 1;">${obj.title}</div>
            `;
            card.addEventListener('click', () => {
                if (state.intentions.includes(obj.title)) {
                    state.intentions = state.intentions.filter(i => i !== obj.title);
                    card.classList.remove('selected');
                    card.querySelector('.intention-checkbox').textContent = '';
                } else {
                    state.intentions.push(obj.title);
                    card.classList.add('selected');
                    card.querySelector('.intention-checkbox').textContent = '✓';
                }
            });
            intentionsGrid.appendChild(card);
        });
    }

    if (step4BackBtn) step4BackBtn.addEventListener('click', () => showStep(3));
    if (step4NextBtn) {
        step4NextBtn.addEventListener('click', () => showStep(5));
    }

    // Step 5: Contributions & Finalize
    const contributionsGrid = document.getElementById('obContributionsGrid');
    const step5NextBtn = document.getElementById('obStep5NextBtn');
    const step5BackBtn = document.getElementById('obStep5BackBtn');

    if (contributionsGrid) {
        contributionsGrid.innerHTML = '';
        CONTRIBUTIONS_LIST.forEach(item => {
            const chip = document.createElement('div');
            chip.className = `interest-chip ${state.contributions.includes(item) ? 'selected' : ''}`;
            chip.textContent = item;
            chip.addEventListener('click', () => {
                if (state.contributions.includes(item)) {
                    state.contributions = state.contributions.filter(i => i !== item);
                    chip.classList.remove('selected');
                } else {
                    state.contributions.push(item);
                    chip.classList.add('selected');
                }
            });
            contributionsGrid.appendChild(chip);
        });
    }

    if (step5BackBtn) step5BackBtn.addEventListener('click', () => showStep(4));
    if (step5NextBtn) {
        step5NextBtn.addEventListener('click', () => {
            // Register member into store!
            const res = window.WabiSabiStore.register({
                name: state.name,
                email: state.email,
                password: state.password,
                handle: state.handle,
                interests: state.interests,
                intentions: state.intentions,
                contributions: state.contributions
            });

            if (!res.success) {
                window.WabiSabiStore.showToast(res.message);
                return;
            }

            // Populate Celebration Card
            document.getElementById('celebrationHandleText').textContent = `@${state.handle}`;
            document.getElementById('celebrationNameText').textContent = state.name;
            document.getElementById('celebrationHandleBadge').textContent = `@${state.handle}`;

            const sumEl = document.getElementById('celebrationInterestsSummary');
            if (sumEl) {
                sumEl.innerHTML = '';
                state.interests.slice(0, 4).forEach(item => {
                    const tag = document.createElement('span');
                    tag.className = 'card-mini-chip';
                    tag.textContent = item;
                    sumEl.appendChild(tag);
                });
            }

            showStep(6);
        });
    }

    // Step 6: Enter Community
    const celebrationEnterBtn = document.getElementById('celebrationEnterBtn');
    if (celebrationEnterBtn) {
        celebrationEnterBtn.addEventListener('click', () => {
            window.WabiSabiStore.showToast(`Welcome to the circle, @${state.handle}!`);
            setTimeout(() => {
                window.location.href = 'community.html';
            }, 300);
        });
    }

    // Initialize Step 1
    showStep(1);
});
