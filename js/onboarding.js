/**
 * Wabi Sabi — Membership Application ("Join the Circle") Controller (js/onboarding.js)
 * Manages:
 * 1. Step 1: Account credentials (Name, Email, Password, Confirm Password)
 * 2. Step 2: Permanent handle claiming with live validation checklist
 * 3. Step 3: The 5 curated Wabi Sabi questions
 * 4. Step 4: Submission to /api/application/submit & pending review presentation
 */

document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentStep: 1,
        name: '',
        email: '',
        password: '',
        handle: '',
        reason: '',
        favorite_work: '',
        perspective: '',
        contribution: '',
        conversation: ''
    };

    const stepIndicator = document.getElementById('obStepIndicator');
    const progressFill = document.getElementById('obProgressFill');

    const steps = [
        document.getElementById('obStep1'),
        document.getElementById('obStep2'),
        document.getElementById('obStep3'),
        document.getElementById('obStep4')
    ];

    function showStep(stepNum) {
        state.currentStep = stepNum;
        steps.forEach((el, idx) => {
            if (el) el.style.display = (idx + 1 === stepNum) ? 'block' : 'none';
        });

        const stepNames = ["Account", "Permanent Handle", "Questions", "Pending Review"];
        if (stepIndicator) {
            stepIndicator.textContent = stepNum <= 3 
                ? `Step 0${stepNum} / 03 — ${stepNames[stepNum - 1]}`
                : `Application Received`;
        }
        if (progressFill) {
            const pct = stepNum === 1 ? 33 : stepNum === 2 ? 66 : 100;
            progressFill.style.width = `${pct}%`;
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- Step 1: Account Credentials ---
    const nameInput = document.getElementById('obNameInput');
    const emailInput = document.getElementById('obEmailInput');
    const passwordInput = document.getElementById('obPasswordInput');
    const passwordConfirmInput = document.getElementById('obPasswordConfirmInput');
    const step1NextBtn = document.getElementById('obStep1NextBtn');

    if (step1NextBtn) {
        step1NextBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const pass = passwordInput.value;
            const confirmPass = passwordConfirmInput ? passwordConfirmInput.value : pass;

            if (!name) {
                window.WabiSabiStore.showToast("Please share your name or pen name.");
                nameInput.focus();
                return;
            }
            if (!email || !email.includes('@')) {
                window.WabiSabiStore.showToast("Please enter a valid email address.");
                emailInput.focus();
                return;
            }
            if (!pass || pass.length < 6) {
                window.WabiSabiStore.showToast("Password must be at least 6 characters.");
                passwordInput.focus();
                return;
            }
            if (pass !== confirmPass) {
                window.WabiSabiStore.showToast("Passwords do not match. Please verify.");
                passwordConfirmInput.focus();
                return;
            }

            state.name = name;
            state.email = email;
            state.password = pass;

            // Auto-suggest handle if not yet filled
            if (!state.handle) {
                const suggested = window.WabiSabiStore.normalizeHandle(name);
                if (handleInput) {
                    handleInput.value = suggested;
                    checkHandleLive(suggested);
                }
            }

            showStep(2);
        });
    }

    // --- Step 2: Permanent Handle Validation ---
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
            ruleAvailable.className = 'handle-rule-item valid';
            ruleAvailable.querySelector('.rule-icon').textContent = '✓';
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
            checkHandleLive(handleInput.value);
        });
    }

    if (step2BackBtn) {
        step2BackBtn.addEventListener('click', () => showStep(1));
    }

    if (step2NextBtn) {
        step2NextBtn.addEventListener('click', () => {
            const val = window.WabiSabiStore.validateHandle(handleInput.value);
            if (!val.isValid) {
                window.WabiSabiStore.showToast("Please choose an available letters-only handle (3-20 letters).");
                return;
            }
            state.handle = val.normalized;
            showStep(3);
        });
    }

    // --- Step 3: The 5 Wabi Sabi Questions & Server Submission ---
    const qReason = document.getElementById('obQReason');
    const qFavoriteWork = document.getElementById('obQFavoriteWork');
    const qPerspective = document.getElementById('obQPerspective');
    const qContribution = document.getElementById('obQContribution');
    const qConversation = document.getElementById('obQConversation');
    const step3SubmitBtn = document.getElementById('obStep3SubmitBtn');
    const step3BackBtn = document.getElementById('obStep3BackBtn');

    if (step3BackBtn) {
        step3BackBtn.addEventListener('click', () => showStep(2));
    }

    if (step3SubmitBtn) {
        step3SubmitBtn.addEventListener('click', async () => {
            const reason = qReason.value.trim();
            const favorite_work = qFavoriteWork.value.trim();
            const perspective = qPerspective.value.trim();
            const contribution = qContribution.value.trim();
            const conversation = qConversation.value.trim();

            if (!reason || !favorite_work || !perspective || !contribution || !conversation) {
                window.WabiSabiStore.showToast("Please answer all 5 questions so the Curators can review your application.");
                return;
            }

            step3SubmitBtn.disabled = true;
            step3SubmitBtn.style.opacity = '0.7';

            try {
                const response = await (window.WabiSabiStore ? window.WabiSabiStore.apiFetch('/api/application/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: state.name,
                        email: state.email,
                        password: state.password,
                        handle: state.handle,
                        reason,
                        favorite_work,
                        perspective,
                        contribution,
                        conversation
                    })
                }) : fetch('/api/application/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: state.name,
                        email: state.email,
                        password: state.password,
                        handle: state.handle,
                        reason,
                        favorite_work,
                        perspective,
                        contribution,
                        conversation
                    })
                }));

                const result = await response.json();
                step3SubmitBtn.disabled = false;
                step3SubmitBtn.style.opacity = '1';

                if (response.ok && result.success) {
                    // Update confirmation card
                    const nameEl = document.getElementById('confirmApplicantName');
                    const handleEl = document.getElementById('confirmApplicantHandle');
                    if (nameEl) nameEl.textContent = state.name;
                    if (handleEl) handleEl.textContent = `@${state.handle}`;

                    window.WabiSabiStore.showToast("✦ Application received. Pending review by Curators.");
                    showStep(4);
                } else {
                    window.WabiSabiStore.showToast(result.error || "Failed to submit application.");
                }
            } catch (err) {
                step3SubmitBtn.disabled = false;
                step3SubmitBtn.style.opacity = '1';
                console.error('Submission error:', err);
                window.WabiSabiStore.showToast("Could not reach the server. Please try again.");
            }
        });
    }

    // Initialize on step 1
    showStep(1);
});
