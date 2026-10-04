/**
 * WABI SABI — DEDICATED READING SANCTUARY CONTROLLER (js/reader.js)
 * Standalone engine for:
 * 1. 100% Screen Viewport & Full Screen Immersion (Fill Whole Screen)
 * 2. Left / Right Navigation Keys (ArrowLeft, ArrowRight, PageUp, PageDown, Space)
 * 3. Screen Gestures (Touch Swipe Left/Right & Clickable Edge Turn Zones)
 * 4. Interactive Page Spreads with Smooth Turn Animations
 * 5. Marginalia Discussion, Likes, and Adding Thoughts
 */

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Session verification & Header Identity
    const session = window.WabiSabiStore ? await window.WabiSabiStore.requireAuth(['USER', 'CURATOR', 'Reader', 'Curator']) : null;
    if (!session) return;
    window.currentMemberSession = session;

    const headerHandleBadge = document.getElementById('headerHandleBadge');
    const headerUserAvatarImg = document.getElementById('headerUserAvatarImg');

    if (session) {
        if (headerHandleBadge && session.handle) {
            headerHandleBadge.textContent = `@${session.handle}`;
        }
        if (headerUserAvatarImg && session.avatar) {
            headerUserAvatarImg.src = safeAvatarUrl(session.avatar);
        }
    }

    // 2. Books Catalog & Multi-spread Page Data Model
    const BOOKS_CATALOG = {
        'atomic-habits': {
            id: 'atomic-habits',
            title: 'Atomic Habits',
            author: 'James Clear',
            year: '2018',
            totalPages: 320,
            defaultSpread: 12,
            availableSpreads: [10, 12, 14, 16],
            description: "An indispensable guide to how small changes can compound into remarkable results. Focus on systems rather than goals to create lasting personal and collective transformation.",
            format: "Hardcover Two-Page Spread",
            edition: "Vol. 1 · Sanctuary Pick",
            companionTitle: "Media Companion & Discussions",
            companionText: "Weekly Table Room gatherings explore systems vs goals every Sunday evening.",
            spreads: {
                10: {
                    leftNum: 10,
                    rightNum: 11,
                    leftHeader: "ATOMIC HABITS",
                    rightHeader: "THE FUNDAMENTALS",
                    leftTag: "Intro",
                    leftTitle: "The Fundamentals<br>of Habit Formation",
                    leftSubtitle: "Why tiny changes make a big difference",
                    leftP1: "A slight change in your daily habits can guide your life to a very different destination. Making a choice that is 1 percent better or 1 percent worse seems insignificant in the moment, but over the span of moments that make up a lifetime, these choices determine the difference between who you are and who you could be.",
                    leftP2: '<span class="sage-washi-highlight">Success is the product of daily habits — not once-in-a-lifetime transformations.</span>',
                    leftP2Id: "hl-intro",
                    leftP3: "It does not matter how successful or unsuccessful you are right now. What matters is whether your habits are putting you on the path toward success. You should be far more concerned with your current trajectory than with your current results.",
                    hasIllustration: true,
                    rightP1: "If you want to predict where you'll end up in life, all you have to do is follow the curve of tiny gains or tiny losses, and see how your daily choices will compound ten or twenty years down the line.",
                    rightP2: "Are you spending less than you earn each month? Are you making it into the gym each week? Are you reading books and learning something new each day? Tiny battles like these are the ones that will define your future self.",
                    rightP3: '<span class="sage-washi-highlight">Time magnifies the margin between success and failure. It will multiply whatever you feed it.</span>',
                    rightP3Id: "hl-time",
                    rightP4: "Good habits make time your ally. Bad habits make time your enemy. The slow pace of transformation makes it easy to let a bad habit slide.",
                    rightP5: "When we repeat 1 percent errors day after day, our small choices compound into toxic results. It's the accumulation of many missteps that leads to a problem.",
                    footnote: "Trajectory matters infinitely more than position."
                },
                12: {
                    leftNum: 12,
                    rightNum: 13,
                    leftHeader: "ATOMIC HABITS",
                    rightHeader: "THE SURPRISING POWER OF ATOMIC HABITS",
                    leftTag: "1",
                    leftTitle: "The Surprising<br>Power of Atomic Habits",
                    leftSubtitle: "Tiny Changes, Remarkable Results",
                    leftP1: "Every remarkable result is the product of hundreds of small decisions — the compound effect of atomic habits. It's easy to overestimate the importance of one defining moment and underestimate the value of making small improvements on a daily basis. But the truth is that small habits don't add up. They compound.",
                    leftP2: '<span class="sage-washi-highlight">If you can get 1 percent better each day for one year, you\'ll end up 37 times better by the end of the year.</span>',
                    leftP2Id: "hl-1",
                    leftP3: "Habits are the compound interest of self-improvement. The same way that money multiplies through compound interest, the effects of your habits multiply as you repeat them over time.",
                    hasIllustration: true,
                    rightP1: "You don't rise to the level of your goals. You fall to the level of your systems. Goals are good for setting a direction, but systems are best for making progress.",
                    rightP2: "Here's an example. Let's say your goal is to write a book. A goal gives you a desired result, but it doesn't tell you what to do. A system, on the other hand, is a set of habits that can get you there.",
                    rightP3: '<span class="sage-washi-highlight">You do not rise to the level of your goals. You fall to the level of your systems.</span>',
                    rightP3Id: "hl-2",
                    rightP4: "If you want better results, then forget about setting goals. Focus on your system instead.<sup>1</sup>",
                    rightP5: "The actual behavior is the system. Reading for thirty minutes each day is a system. It's a small habit, but it compounds over time. Many people think they need to make a massive change to see big results. In reality, it's the small changes that create the most powerful outcomes.",
                    footnote: "1 A system is a set of habits, not a single habit."
                },
                14: {
                    leftNum: 14,
                    rightNum: 15,
                    leftHeader: "ATOMIC HABITS",
                    rightHeader: "HOW HABITS SHAPE IDENTITY",
                    leftTag: "2",
                    leftTitle: "How Your Habits<br>Shape Your Identity",
                    leftSubtitle: "The two-step process to true change",
                    leftP1: "Changing your habits is challenging for two reasons: (1) we try to change the wrong thing and (2) we try to change our habits in the wrong way. True behavioral change is identity change. You might start a habit because of motivation, but the only reason you'll stick with one is that it becomes part of your identity.",
                    leftP2: '<span class="sage-washi-highlight">The ultimate form of intrinsic motivation is when a habit becomes part of your identity.</span>',
                    leftP2Id: "hl-identity",
                    leftP3: "It's one thing to say I'm the type of person who wants this. It's something very different to say I'm the type of person who is this. The more pride you have in a particular aspect of your identity, the more motivated you will be to maintain the habits associated with it.",
                    hasIllustration: false,
                    rightP1: "Behavior that is incongruent with the self will not last. You may want more money, but if your identity is someone who spends rather than creates, then you'll continue to be pulled toward spending.",
                    rightP2: "Your behaviors are usually a reflection of your identity. What you do is an indication of the type of person you believe that you are — either consciously or nonconsciously.",
                    rightP3: '<span class="sage-washi-highlight">Every action you take is a vote for the type of person you wish to become.</span>',
                    rightP3Id: "hl-vote",
                    rightP4: "No single instance will transform your beliefs, but as the votes build up, so does the evidence of your new identity. This is one reason why meaningful change does not require radical change.",
                    rightP5: "Small habits can make a meaningful difference by providing evidence of a new identity. And if a change is meaningful, it is actually huge.",
                    footnote: "You decide who you want to be, then prove it to yourself with small wins."
                },
                16: {
                    leftNum: 16,
                    rightNum: 17,
                    leftHeader: "ATOMIC HABITS",
                    rightHeader: "THE FOUR LAWS OF BEHAVIOR CHANGE",
                    leftTag: "3",
                    leftTitle: "How to Build<br>Better Habits in 4 Steps",
                    leftSubtitle: "The architecture of human behavior",
                    leftP1: "A habit is a behavior that has been repeated enough times to become automatic. The ultimate purpose of habits is to solve the problems of life with as little energy and effort as possible.",
                    leftP2: '<span class="sage-washi-highlight">Habits do not restrict freedom. They create it. In fact, the people who don’t have their habits handled are often the ones with the least amount of freedom.</span>',
                    leftP2Id: "hl-freedom",
                    leftP3: "If you don't have good financial habits, you will always be struggling for the next dollar. If you don't have good health habits, you will always seem to be short on energy.",
                    hasIllustration: true,
                    rightP1: "The process of building a habit can be divided into four simple steps: cue, craving, response, and reward. Breaking it down into these fundamental parts helps us understand what a habit is, how it works, and how to improve it.",
                    rightP2: "The cue triggers a craving, which motivates a response, which provides a reward, which satisfies the craving and, ultimately, becomes associated with the cue.",
                    rightP3: '<span class="sage-washi-highlight">Make it obvious. Make it attractive. Make it easy. Make it satisfying.</span>',
                    rightP3Id: "hl-laws",
                    rightP4: "Together, these four steps form a neurological feedback loop — cue, craving, response, reward — that allows you to create automatic habits. This cycle is known as the habit loop.",
                    rightP5: "If a behavior is insufficient in any of the four stages, it will not become a habit. Invert the laws to break bad habits: Make it invisible, make it unattractive, make it difficult, make it unsatisfying.",
                    footnote: "The Four Laws: Obvious, Attractive, Easy, Satisfying."
                }
            }
        },
        'feminists': {
            id: 'feminists',
            title: 'We Should All Be Feminists',
            author: 'Chimamanda Ngozi Adichie',
            year: '2014',
            totalPages: 20,
            defaultSpread: 6,
            availableSpreads: [6, 10, 14],
            description: "A personal, eloquently argued essay adapted from the celebrated TEDx talk of the same name, offering a nuanced and humane definition of equality in the modern century.",
            format: "Pocket Folio Edition",
            edition: "Vol. 1 · Spotlight Essay",
            companionTitle: "TEDxEuston 2012 Keynote",
            companionText: "Pair this text with Chimamanda's spoken address on gender constructs and quiet courage.",
            spreads: {
                6: {
                    leftNum: 6,
                    rightNum: 7,
                    leftHeader: "WE SHOULD ALL BE FEMINISTS",
                    rightHeader: "FIRST ENCOUNTERS",
                    leftTag: "Essay",
                    leftTitle: "The Meaning<br>of a Word",
                    leftSubtitle: "First Encounters with Feminism",
                    leftP1: "Okoloma was a person you could argue with, laugh with, and genuinely talk to. He was also the first person to call me a feminist. I was about fourteen. We were in his house, arguing, both of us bristling with half-baked knowledge from the books we had read.",
                    leftP2: '<span class="sage-washi-highlight">I did not know what the word meant. But I did not want Okoloma to know that I did not know.</span>',
                    leftP2Id: "hl-okoloma",
                    leftP3: "So I brushed it aside and continued to argue. And the first thing I planned to do when I got home was to look up the word feminist in the dictionary.",
                    hasIllustration: true,
                    rightP1: "Years later, when I published Purple Hibiscus, a journalist told me that my novel was feminist, and his advice was that I should never call myself a feminist, since feminists are women who are unhappy because they cannot find husbands.",
                    rightP2: "So I decided to call myself a Happy Feminist. Then an academic woman told me that feminism was not our culture, that feminism was un-African, and that I was calling myself a feminist because I had been corrupted by Western books.",
                    rightP3: '<span class="sage-washi-highlight">So then I decided I was now a Happy African Feminist Who Does Not Hate Men.</span>',
                    rightP3Id: "hl-african-feminist",
                    rightP4: "At some point I was a Happy African Feminist Who Does Not Hate Men And Who Likes To Wear Lip Gloss And High Heels For Herself And Not For Men.",
                    rightP5: "Of course much of this was tongue-in-cheek, but it shows how that word feminist is so heavy with baggage, negative baggage: you hate men, you hate bras, you hate African culture.",
                    footnote: "Chimamanda Ngozi Adichie, TEDxEuston Keynote & Essay."
                },
                10: {
                    leftNum: 10,
                    rightNum: 11,
                    leftHeader: "WE SHOULD ALL BE FEMINISTS",
                    rightHeader: "CONSTRUCTS OF GENDER",
                    leftTag: "Essay",
                    leftTitle: "The Hard Cage<br>of Masculinity",
                    leftSubtitle: "Rethinking expectations for boys",
                    leftP1: "We do a great disservice to boys in how we raise them. We stifle the humanity of boys. We define masculinity in a very narrow way. Masculinity is a hard, small cage, and we put boys inside this cage.",
                    leftP2: '<span class="sage-washi-highlight">We teach boys to be afraid of fear, of weakness, of vulnerability.</span>',
                    leftP2Id: "hl-masculinity",
                    leftP3: "We teach them to mask their true selves, because they have to be, in Nigerian-speak, a tough man. In secondary school, a boy and a girl go out, both teenagers with meager pocket money, yet the boy is expected to pay, to prove his masculinity.",
                    hasIllustration: false,
                    rightP1: "And then we do a much greater disservice to girls, because we raise them to cater to the fragile egos of males. We teach girls to shrink themselves, to make themselves smaller.",
                    rightP2: "We say to girls: You can have ambition, but not too much. You should aim to be successful but not too successful, otherwise you will threaten the man.",
                    rightP3: '<span class="sage-washi-highlight">Culture does not make people. People make culture.</span>',
                    rightP3Id: "hl-culture",
                    rightP4: "If it is true that the full humanity of women is not our culture, then we can and must make it our culture.",
                    rightP5: "What if, in raising children, we focus on ability instead of gender? What if we focus on interest instead of gender?",
                    footnote: "Page 11 · Rethinking our shared humanity."
                },
                14: {
                    leftNum: 14,
                    rightNum: 15,
                    leftHeader: "WE SHOULD ALL BE FEMINISTS",
                    rightHeader: "A HUMANE FUTURE",
                    leftTag: "Closing",
                    leftTitle: "A Calmer,<br>Equal Horizon",
                    leftSubtitle: "Reclaiming the word with grace",
                    leftP1: "My own definition is that a feminist is a man or a woman who says, yes, there’s a problem with gender as it is today and we must fix it, we must do better. All of us, women and men, must do better.",
                    leftP2: '<span class="sage-washi-highlight">All of us, women and men, must do better.</span>',
                    leftP2Id: "hl-better",
                    leftP3: "Gender matters everywhere in the world. And I would like today to ask that we begin to dream about and plan for a different world. A fairer world. A world of happier men and happier women who are truer to themselves.",
                    hasIllustration: true,
                    rightP1: "I have chosen to no longer be apologetic for my femaleness. And I would like to be respected in all of my femaleness. Because I deserve to be.",
                    rightP2: "And this is how to start: We must raise our daughters differently. We must also raise our sons differently.",
                    rightP3: '<span class="sage-washi-highlight">A feminist is someone who believes in the social, political, and economic equality of the sexes.</span>',
                    rightP3Id: "hl-def",
                    rightP4: "It is as simple and as urgent as that.",
                    rightP5: "When we return to quiet reflection, the truth becomes unmistakable.",
                    footnote: "Page 15 · Closing reflections."
                }
            }
        },
        'catcher': {
            id: 'catcher',
            title: 'The Catcher in the Rye',
            author: 'J.D. Salinger',
            year: '1951',
            totalPages: 214,
            defaultSpread: 2,
            availableSpreads: [2, 6],
            description: "J.D. Salinger's iconic portrait of teenage alienation, searching for sincerity, and the quiet yearning for authentic human connection in a bustling, phony world.",
            format: "Classic Paper Edition",
            edition: "Vol. 1 · Week 4 Companion",
            companionTitle: "Week 4 Film Pairing: Lost in Translation",
            companionText: "Pair Holden Caulfield's reflections on New York with Bob & Charlotte's Tokyo loneliness in the Table Room.",
            spreads: {
                2: {
                    leftNum: 2,
                    rightNum: 3,
                    leftHeader: "THE CATCHER IN THE RYE",
                    rightHeader: "CHAPTER ONE",
                    leftTag: "1",
                    leftTitle: "If You Really<br>Want to Hear About It",
                    leftSubtitle: "The first thing you'll probably want to know",
                    leftP1: "If you really want to hear about it, the first thing you'll probably want to know is where I was born, and what my lousy childhood was like, and how my parents were occupied and all before they had me, and all that David Copperfield kind of crap, but I don't feel like going into it, if you want to know the truth.",
                    leftP2: '<span class="sage-washi-highlight">Where I want to start telling is the day I left Pencey Prep.</span>',
                    leftP2Id: "hl-catcher-1",
                    leftP3: "Pencey Prep is this school that's in Agerstown, Pennsylvania. You probably heard of it. You've probably seen the ads, anyway. They advertise in about a thousand magazines, always showing some hot-shot guy on a horse jumping over a fence.",
                    hasIllustration: true,
                    rightP1: "The reason I was standing way up on Thomsen Hill, instead of down at the game, was because I was on my way to say good-by to old Spencer, my history teacher. He had the grippe, and I figured I probably wouldn't see him again till Christmas vacation.",
                    rightP2: "He really cared about history and ancient Egyptians, even if nobody else in the class did. I wanted to tell him that I was sorry for flunking.",
                    rightP3: '<span class="sage-washi-highlight">I was trying to feel some kind of a good-by. I mean I’ve left schools and places I didn’t even know I was leaving them. I hate that.</span>',
                    rightP3Id: "hl-catcher-2",
                    rightP4: "I don’t care if the good-by is sad or tough or anything, but when I leave a place I want to know I’m leaving it. If you don’t, you feel even worse.",
                    rightP5: "So I stood up there in the December cold, without an overcoat, looking down at the stadium and trying to feel some kind of farewell.",
                    footnote: "J.D. Salinger, Chapter 1 · Pencey Prep."
                },
                6: {
                    leftNum: 6,
                    rightNum: 7,
                    leftHeader: "THE CATCHER IN THE RYE",
                    rightHeader: "NEW YORK REFLECTIONS",
                    leftTag: "2",
                    leftTitle: "The Ducks in<br>Central Park",
                    leftSubtitle: "Where do they go when the ice freezes over?",
                    leftP1: "I live in New York, and I was thinking about the Central Park South lagoon near the south entrance. I was wondering if it would be frozen over when I got home, and if it was, where did the ducks go?",
                    leftP2: '<span class="sage-washi-highlight">I was wondering where the ducks went when the lagoon got all icy and frozen over.</span>',
                    leftP2Id: "hl-catcher-3",
                    leftP3: "I wondered if some guy came in a truck and took them away to a zoo or something. Or if they just flew off to the south, somewhere warm.",
                    hasIllustration: true,
                    rightP1: "It’s funny how you can live in the middle of eight million people and still feel like the only one looking out the cab window at the rain.",
                    rightP2: "People were hurrying everywhere with their umbrellas, heading into theaters and cafes, not looking at anyone else.",
                    rightP3: '<span class="sage-washi-highlight">What really knocks me out is a book that, when you\'re all done reading it, you wish the author that wrote it was a terrific friend of yours.</span>',
                    rightP3Id: "hl-catcher-4",
                    rightP4: "That way you could call him up on the phone whenever you felt like it. That doesn't happen much, though.",
                    rightP5: "You read quietly, and you keep company with the words.",
                    footnote: "Chapter 3 · Central Park South Reflections."
                }
            }
        }
    };

    let currentBookKey = 'atomic-habits';
    let activeBook = BOOKS_CATALOG[currentBookKey];
    let currentSpreadPage = activeBook.defaultSpread;

    // DOM Elements
    const readingViewport = document.getElementById('readingViewport');
    const bookPagesSpread = document.getElementById('bookPagesSpread');
    const openBookCasing = document.getElementById('openBookCasing');

    const pageLeftNum = document.getElementById('pageLeftNum');
    const pageRightNum = document.getElementById('pageRightNum');
    const pageLeftBookTitle = document.getElementById('pageLeftBookTitle');
    const pageRightBookTitle = document.getElementById('pageRightBookTitle');
    const pageChapterTag = document.getElementById('pageChapterTag');
    const pageChapterTitle = document.getElementById('pageChapterTitle');
    const pageChapterSubtitle = document.getElementById('pageChapterSubtitle');
    const pageLeftP1 = document.getElementById('pageLeftP1');
    const pageLeftP2 = document.getElementById('pageLeftP2');
    const pageLeftP3 = document.getElementById('pageLeftP3');
    const pageLeftIllustration = document.getElementById('pageLeftIllustration');

    const pageRightP1 = document.getElementById('pageRightP1');
    const pageRightP2 = document.getElementById('pageRightP2');
    const pageRightP3 = document.getElementById('pageRightP3');
    const pageRightP4 = document.getElementById('pageRightP4');
    const pageRightP5 = document.getElementById('pageRightP5');
    const pageRightFootnote = document.getElementById('pageRightFootnote');

    const readerScrubSlider = document.getElementById('readerScrubSlider');
    const readerProgressCount = document.getElementById('readerProgressCount');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const turnZoneLeft = document.getElementById('turnZoneLeft');
    const turnZoneRight = document.getElementById('turnZoneRight');

    const readerCurrentTitle = document.getElementById('readerCurrentTitle');
    const readerCurrentAuthor = document.getElementById('readerCurrentAuthor');

    const headerFullscreenBtn = document.getElementById('headerFullscreenBtn');
    const toolFullscreen = document.getElementById('toolFullscreen');
    const exitFullscreenFloatingBtn = document.getElementById('exitFullscreenFloatingBtn');
    const fullscreenToolText = document.getElementById('fullscreenToolText');

    // 3. Render Page Spread Content
    function renderSpread(pageStart, animationDirection = null) {
        // Nearest available spread in active book
        const spreads = activeBook.spreads;
        let spreadKey = spreads[pageStart] ? pageStart : activeBook.defaultSpread;

        const data = spreads[spreadKey] || spreads[activeBook.defaultSpread];
        if (!data) return;

        if (animationDirection && bookPagesSpread) {
            bookPagesSpread.classList.remove('page-flip-forward', 'page-flip-backward');
            void bookPagesSpread.offsetWidth; // Force reflow
            bookPagesSpread.classList.add(animationDirection === 'forward' ? 'page-flip-forward' : 'page-flip-backward');
        }

        currentSpreadPage = data.leftNum;

        // Left Page
        if (pageLeftNum) pageLeftNum.textContent = data.leftNum;
        if (pageLeftBookTitle) pageLeftBookTitle.textContent = data.leftHeader;
        if (pageChapterTag) pageChapterTag.textContent = data.leftTag;
        if (pageChapterTitle) pageChapterTitle.innerHTML = data.leftTitle;
        if (pageChapterSubtitle) pageChapterSubtitle.textContent = data.leftSubtitle;
        if (pageLeftP1) pageLeftP1.textContent = data.leftP1;
        if (pageLeftP2) {
            pageLeftP2.innerHTML = data.leftP2;
            pageLeftP2.setAttribute('data-passage-id', data.leftP2Id);
        }
        if (pageLeftP3) pageLeftP3.textContent = data.leftP3;
        if (pageLeftIllustration) {
            pageLeftIllustration.style.display = data.hasIllustration ? 'flex' : 'none';
        }

        // Right Page
        if (pageRightNum) pageRightNum.textContent = data.rightNum;
        if (pageRightBookTitle) pageRightBookTitle.textContent = data.rightHeader;
        if (pageRightP1) pageRightP1.textContent = data.rightP1;
        if (pageRightP2) pageRightP2.textContent = data.rightP2;
        if (pageRightP3) {
            pageRightP3.innerHTML = data.rightP3;
            pageRightP3.setAttribute('data-passage-id', data.rightP3Id);
        }
        if (pageRightP4) pageRightP4.innerHTML = data.rightP4;
        if (pageRightP5) pageRightP5.textContent = data.rightP5;
        if (pageRightFootnote) {
            pageRightFootnote.innerHTML = `<span class="footnote-index">1</span><span class="footnote-text">${data.footnote}</span>`;
        }

        // Controls
        if (readerScrubSlider) {
            readerScrubSlider.max = activeBook.totalPages;
            readerScrubSlider.value = currentSpreadPage;
        }
        if (readerProgressCount) {
            readerProgressCount.textContent = `${currentSpreadPage} / ${activeBook.totalPages}`;
        }

        // Re-attach highlight click listener
        attachHighlightListeners();
    }

    // 4. Page Turn Navigation Functions
    function turnPage(direction) {
        const available = activeBook.availableSpreads;
        const currentIndex = available.indexOf(currentSpreadPage);

        if (direction === 'next') {
            if (currentIndex !== -1 && currentIndex < available.length - 1) {
                renderSpread(available[currentIndex + 1], 'forward');
            } else if (currentSpreadPage + 2 <= activeBook.totalPages) {
                currentSpreadPage += 2;
                renderSpread(available[0], 'forward');
                if (readerScrubSlider) readerScrubSlider.value = currentSpreadPage;
                if (readerProgressCount) readerProgressCount.textContent = `${currentSpreadPage} / ${activeBook.totalPages}`;
            }
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(`✦ Pages ${currentSpreadPage}–${currentSpreadPage + 1}`);
            }
        } else if (direction === 'prev') {
            if (currentIndex > 0) {
                renderSpread(available[currentIndex - 1], 'backward');
            } else if (currentSpreadPage - 2 >= 2) {
                currentSpreadPage -= 2;
                renderSpread(available[0], 'backward');
                if (readerScrubSlider) readerScrubSlider.value = currentSpreadPage;
                if (readerProgressCount) readerProgressCount.textContent = `${currentSpreadPage} / ${activeBook.totalPages}`;
            }
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(`✦ Pages ${currentSpreadPage}–${currentSpreadPage + 1}`);
            }
        }
    }

    // Button Listeners
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => turnPage('prev'));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => turnPage('next'));
    if (turnZoneLeft) turnZoneLeft.addEventListener('click', () => turnPage('prev'));
    if (turnZoneRight) turnZoneRight.addEventListener('click', () => turnPage('next'));

    if (readerScrubSlider) {
        readerScrubSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            const evenVal = val % 2 === 0 ? val : val - 1;
            renderSpread(evenVal);
            if (readerProgressCount) readerProgressCount.textContent = `${evenVal} / ${activeBook.totalPages}`;
        });
    }

    // 5. Left & Right Navigation Keys
    window.addEventListener('keydown', (e) => {
        // Ignore key navigation when typing in inputs/textareas
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
            return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            e.preventDefault();
            turnPage('prev');
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            e.preventDefault();
            turnPage('next');
        } else if (e.key === ' ') {
            e.preventDefault();
            if (e.shiftKey) {
                turnPage('prev');
            } else {
                turnPage('next');
            }
        } else if (e.key === 'f' || e.key === 'F') {
            e.preventDefault();
            toggleFullscreen();
        } else if (e.key === 'Escape') {
            if (readingViewport && readingViewport.classList.contains('fullscreen-book-active')) {
                toggleFullscreen(false);
            }
        }
    });

    // 6. Touch & Swipe Screen Gestures
    if (openBookCasing) {
        let touchStartX = 0;
        let touchStartY = 0;
        let touchEndX = 0;
        let touchEndY = 0;

        openBookCasing.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches[0]) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
            }
        }, { passive: true });

        openBookCasing.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
                touchEndX = e.changedTouches[0].clientX;
                touchEndY = e.changedTouches[0].clientY;
                handleSwipeGesture();
            }
        }, { passive: true });

        function handleSwipeGesture() {
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;

            // Only trigger if horizontal movement is dominant and > 45px
            if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
                if (deltaX < 0) {
                    // Swiped Left -> Turn Next
                    turnPage('next');
                } else {
                    // Swiped Right -> Turn Previous
                    turnPage('prev');
                }
            }
        }
    }

    // 7. Full Screen Option (Fill Whole Screen With Book)
    function toggleFullscreen(forceState = null) {
        if (!readingViewport) return;

        const isCurrentlyFullscreen = readingViewport.classList.contains('fullscreen-book-active');
        const nextState = forceState !== null ? forceState : !isCurrentlyFullscreen;

        if (nextState) {
            readingViewport.classList.add('fullscreen-book-active');
            if (fullscreenToolText) fullscreenToolText.textContent = 'Exit Screen';
            updateFullscreenIcons(true);

            // Native Fullscreen API request
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(() => {});
            }

            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('⛶ Fullscreen Reading Active (Press ESC or F to exit)');
            }
        } else {
            readingViewport.classList.remove('fullscreen-book-active');
            if (fullscreenToolText) fullscreenToolText.textContent = 'Full Screen';
            updateFullscreenIcons(false);

            // Exit native fullscreen if active
            if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            }

            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('✦ Exited Fullscreen Mode');
            }
        }
    }

    function updateFullscreenIcons(isFullscreen) {
        const expandIcons = document.querySelectorAll('.icon-expand');
        const compressIcons = document.querySelectorAll('.icon-compress');

        expandIcons.forEach(icon => {
            icon.style.display = isFullscreen ? 'none' : 'block';
        });
        compressIcons.forEach(icon => {
            icon.style.display = isFullscreen ? 'block' : 'none';
        });
    }

    if (headerFullscreenBtn) {
        headerFullscreenBtn.addEventListener('click', () => toggleFullscreen());
    }
    if (toolFullscreen) {
        toolFullscreen.addEventListener('click', () => toggleFullscreen());
    }
    if (exitFullscreenFloatingBtn) {
        exitFullscreenFloatingBtn.addEventListener('click', () => toggleFullscreen(false));
    }

    document.addEventListener('fullscreenchange', () => {
        if (!document.fullscreenElement && readingViewport && readingViewport.classList.contains('fullscreen-book-active')) {
            toggleFullscreen(false);
        }
    });

    // Theme initialization and toggle are consolidated near the page-end controls.

    // 9. Book Switcher Dropdown & Dynamic Model Switching
    const bookTitleDropdownBtn = document.getElementById('bookTitleDropdownBtn');
    const bookSwitcherMenu = document.getElementById('bookSwitcherMenu');
    const bookSwitchItems = document.querySelectorAll('.book-switch-item');

    function switchActiveBook(bookKey) {
        if (!BOOKS_CATALOG[bookKey]) return;
        currentBookKey = bookKey;
        activeBook = BOOKS_CATALOG[bookKey];

        // Update titles and authors
        if (readerCurrentTitle) readerCurrentTitle.textContent = activeBook.title;
        if (readerCurrentAuthor) readerCurrentAuthor.textContent = activeBook.author;

        // Update menu active class
        bookSwitchItems.forEach(item => {
            item.classList.toggle('active', item.dataset.book === bookKey);
        });

        // Update Scrubber
        if (readerScrubSlider) {
            readerScrubSlider.min = 2;
            readerScrubSlider.max = activeBook.totalPages;
            readerScrubSlider.value = activeBook.defaultSpread;
        }

        // Render Spread
        renderSpread(activeBook.defaultSpread);

        // Update About Modal Content
        updateAboutModalContent(activeBook);

        if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
            window.WabiSabiStore.showToast(`✦ Opened "${activeBook.title}" by ${activeBook.author}`);
        }
    }

    if (bookTitleDropdownBtn && bookSwitcherMenu) {
        bookTitleDropdownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = bookSwitcherMenu.style.display === 'block';
            bookSwitcherMenu.style.display = isOpen ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            bookSwitcherMenu.style.display = 'none';
        });

        bookSwitchItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const bookKey = item.getAttribute('data-book');
                if (bookKey) {
                    switchActiveBook(bookKey);
                    bookSwitcherMenu.style.display = 'none';
                }
            });
        });
    }

    // 10. Reading Sub-navigation Tabs (Read, About, Notes, Discussions) & About Modal
    const subtabs = document.querySelectorAll('.subtab-item');
    const readerAboutModal = document.getElementById('readerAboutModal');
    const readerAboutCloseBtn = document.getElementById('readerAboutCloseBtn');
    const aboutReturnToReadBtn = document.getElementById('aboutReturnToReadBtn');

    function updateAboutModalContent(book) {
        const titleEl = document.getElementById('aboutModalTitle');
        const authorEl = document.getElementById('aboutModalAuthor');
        const descEl = document.getElementById('aboutModalDesc');
        const formatEl = document.getElementById('aboutModalFormat');
        const pagesEl = document.getElementById('aboutModalPages');
        const editionEl = document.getElementById('aboutModalEdition');
        const companionTitleEl = document.getElementById('aboutModalCompanionTitle');
        const companionTextEl = document.getElementById('aboutModalCompanionText');

        if (titleEl) titleEl.textContent = book.title;
        if (authorEl) authorEl.textContent = `${book.author} • ${book.year}`;
        if (descEl) descEl.textContent = book.description;
        if (formatEl) formatEl.textContent = book.format;
        if (pagesEl) pagesEl.textContent = `${book.totalPages} Pages`;
        if (editionEl) editionEl.textContent = book.edition;
        if (companionTitleEl) companionTitleEl.textContent = book.companionTitle;
        if (companionTextEl) companionTextEl.textContent = book.companionText;
    }

    function openAboutModal() {
        if (!readerAboutModal) return;
        updateAboutModalContent(activeBook);
        readerAboutModal.style.display = 'flex';
        subtabs.forEach(t => t.classList.toggle('active', t.dataset.subtab === 'about'));
    }

    function closeAboutModal() {
        if (!readerAboutModal) return;
        readerAboutModal.style.display = 'none';
        subtabs.forEach(t => t.classList.toggle('active', t.dataset.subtab === 'read'));
    }

    if (readerAboutCloseBtn) readerAboutCloseBtn.addEventListener('click', closeAboutModal);
    if (aboutReturnToReadBtn) aboutReturnToReadBtn.addEventListener('click', closeAboutModal);
    if (readerAboutModal) {
        readerAboutModal.addEventListener('click', (e) => {
            if (e.target === readerAboutModal) closeAboutModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && readerAboutModal && readerAboutModal.style.display !== 'none') {
            closeAboutModal();
        }
    });

    subtabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const subtabType = tab.getAttribute('data-subtab');
            if (subtabType === 'about') {
                openAboutModal();
            } else if (subtabType === 'read') {
                closeAboutModal();
            } else if (subtabType === 'notes') {
                closeAboutModal();
                subtabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const notesPill = document.querySelector('.marginalia-pill-btn[data-tab-filter="notes"]');
                if (notesPill) notesPill.click();
            } else if (subtabType === 'discussions') {
                closeAboutModal();
                subtabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const discussPill = document.querySelector('.marginalia-pill-btn[data-tab-filter="discuss"]');
                if (discussPill) discussPill.click();
            }
        });
    });

    const subtabMoreBtn = document.querySelector('.subtab-more-btn');
    if (subtabMoreBtn) {
        subtabMoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(`✦ Reading Settings: Serif Typeface, Wabi Paper Warm, ${activeBook.format}`);
            }
        });
    }

    // 11. Marginalia Filter Pills (Highlights, Notes, Discuss)
    const filterPills = document.querySelectorAll('.marginalia-pill-btn');
    const marginaliaCards = document.querySelectorAll('.marginalia-card');

    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            filterPills.forEach(p => {
                p.classList.remove('active');
                p.setAttribute('aria-selected', 'false');
            });
            pill.classList.add('active');
            pill.setAttribute('aria-selected', 'true');

            const filter = pill.getAttribute('data-tab-filter');
            marginaliaCards.forEach(card => {
                const category = card.getAttribute('data-category');
                if (filter === 'highlights' || category === filter) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // 12. Interactive Highlight Selection & Card Focus
    function attachHighlightListeners() {
        const highlightedPassages = document.querySelectorAll('.highlighted-passage');
        highlightedPassages.forEach(passage => {
            passage.addEventListener('click', (e) => {
                e.stopPropagation();
                const passageId = passage.getAttribute('data-passage-id');
                marginaliaCards.forEach(c => c.classList.remove('active-card'));

                const targetCard = document.querySelector(`.marginalia-card[data-target-passage="${passageId}"]`);
                if (targetCard) {
                    targetCard.classList.add('active-card');
                    targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            });
        });
    }

    attachHighlightListeners();

    // 13. Reader Bottom Tools (Fit Width, Table of Contents)

    const toolFitWidth = document.getElementById('toolFitWidth');
    let isFitWidth = false;
    if (toolFitWidth) {
        toolFitWidth.addEventListener('click', () => {
            isFitWidth = !isFitWidth;
            const spread = document.querySelector('.reader-spread-container');
            const pages = document.querySelectorAll('.book-page');
            if (spread) {
                if (isFitWidth) {
                    spread.style.maxWidth = '100%';
                    pages.forEach(p => p.style.maxWidth = 'none');
                    toolFitWidth.classList.add('active');
                    const label = toolFitWidth.querySelector('span');
                    if (label) label.textContent = 'Default Spread';
                    if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                        window.WabiSabiStore.showToast('↔ Fit-to-Width mode enabled');
                    }
                } else {
                    spread.style.maxWidth = '';
                    pages.forEach(p => p.style.maxWidth = '');
                    toolFitWidth.classList.remove('active');
                    const label = toolFitWidth.querySelector('span');
                    if (label) label.textContent = 'Fit Width';
                    if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                        window.WabiSabiStore.showToast('📖 Standard book spread restored');
                    }
                }
            }
        });
    }

    const toolContents = document.getElementById('toolContents');
    if (toolContents) {
        toolContents.addEventListener('click', (e) => {
            e.stopPropagation();
            let tocModal = document.getElementById('readerTocModal');
            if (!tocModal) {
                tocModal = document.createElement('div');
                tocModal.id = 'readerTocModal';
                tocModal.style.cssText = `
                    position: fixed;
                    bottom: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: var(--paper-warm, #FAF6EE);
                    border: 1px solid var(--border-stone, #E2DAD0);
                    border-radius: 12px;
                    box-shadow: 0 16px 40px rgba(0,0,0,0.18);
                    padding: 20px;
                    width: 320px;
                    max-width: 90vw;
                    z-index: 1000;
                    color: var(--ink-primary, #231E19);
                `;
                tocModal.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid var(--border-stone, #E2DAD0); padding-bottom: 8px;">
                        <strong style="font-family: var(--font-serif); font-size: 16px;">Table of Contents</strong>
                        <button id="closeTocBtn" style="background: none; border: none; font-size: 16px; cursor: pointer; color: var(--ink-muted);">✕</button>
                    </div>
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; display: flex; flex-direction: column; gap: 8px;">
                        <li class="toc-jump" data-page="2" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; display: flex; justify-content: space-between;">
                            <span>The Fundamentals</span><span style="color: var(--ink-muted);">p. 2</span>
                        </li>
                        <li class="toc-jump" data-page="12" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; display: flex; justify-content: space-between; font-weight: 600; color: var(--accent-sage, #2C4837);">
                            <span>1. The Surprising Power of Habits</span><span>p. 12</span>
                        </li>
                        <li class="toc-jump" data-page="20" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; display: flex; justify-content: space-between;">
                            <span>2. How Your Habits Shape Identity</span><span style="color: var(--ink-muted);">p. 20</span>
                        </li>
                        <li class="toc-jump" data-page="34" style="cursor: pointer; padding: 6px 8px; border-radius: 6px; display: flex; justify-content: space-between;">
                            <span>3. How to Build Better Habits</span><span style="color: var(--ink-muted);">p. 34</span>
                        </li>
                    </ul>
                `;
                document.body.appendChild(tocModal);

                tocModal.querySelector('#closeTocBtn').addEventListener('click', () => {
                    tocModal.style.display = 'none';
                });

                tocModal.querySelectorAll('.toc-jump').forEach(item => {
                    item.addEventListener('mouseenter', () => item.style.background = 'rgba(0,0,0,0.04)');
                    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
                    item.addEventListener('click', () => {
                        const targetP = parseInt(item.getAttribute('data-page'), 10);
                        if (typeof updatePageSpread === 'function') {
                            updatePageSpread(targetP);
                        } else {
                            const slider = document.getElementById('readerScrubSlider');
                            if (slider) {
                                slider.value = targetP;
                                slider.dispatchEvent(new Event('input'));
                            }
                        }
                        tocModal.style.display = 'none';
                        if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                            window.WabiSabiStore.showToast(`Jumped to page ${targetP}`);
                        }
                    });
                });

                document.addEventListener('click', (ev) => {
                    if (tocModal && !tocModal.contains(ev.target) && ev.target !== toolContents) {
                        tocModal.style.display = 'none';
                    }
                });
            } else {
                tocModal.style.display = tocModal.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    // 14. Delegated Comments Interaction (Reply Pre-fill & Likes for all comments)
    const addThoughtInput = document.getElementById('addThoughtInput');
    const cardThread1 = document.getElementById('cardThread1');

    document.addEventListener('click', (e) => {
        // Reply Button
        const replyBtn = e.target.closest('.comment-action-reply');
        if (replyBtn) {
            const commentItem = replyBtn.closest('.thread-comment-item');
            const authorSpan = commentItem ? commentItem.querySelector('.comment-author-handle') : null;
            const author = authorSpan ? authorSpan.textContent.trim() : '';
            if (addThoughtInput) {
                addThoughtInput.value = author ? `${author} ` : '';
                addThoughtInput.focus();
            }
            return;
        }

        // Like Button
        const likeBtn = e.target.closest('.comment-action-like');
        if (likeBtn) {
            const countSpan = likeBtn.querySelector('.like-number');
            let count = parseInt(likeBtn.getAttribute('data-count') || '0', 10);
            const isLiked = likeBtn.classList.toggle('liked');
            count = isLiked ? count + 1 : Math.max(0, count - 1);
            likeBtn.setAttribute('data-count', count);
            if (countSpan) countSpan.textContent = count;
            return;
        }

        // Passage More Options Button (Copy passage quote)
        const moreBtn = e.target.closest('.card-more-menu-btn');
        if (moreBtn) {
            const card = moreBtn.closest('.marginalia-card');
            const quoteEl = card ? card.querySelector('.card-quote-text') : null;
            const quote = quoteEl ? quoteEl.textContent.trim() : '';
            if (quote && navigator.clipboard) {
                navigator.clipboard.writeText(quote).catch(() => {});
            }
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast('✦ Quote copied to clipboard');
            }
        }
    });

    // 15. Add a Thought Input
    if (addThoughtInput && cardThread1) {
        addThoughtInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && addThoughtInput.value.trim().length > 0) {
                const text = addThoughtInput.value.trim();
                const userHandle = session && typeof session.handle === 'string' && session.handle
                    ? `@${session.handle}`
                    : '@reader';
                const userAvatar = safeAvatarUrl(session && session.avatar ? session.avatar : '../assets/user_avatar.jpg');

                const newComment = document.createElement('div');
                newComment.className = 'thread-comment-item';
                newComment.innerHTML = `
                    <img src="${escapeHtmlAttribute(userAvatar)}" alt="Member avatar" class="comment-author-avatar">
                    <div class="comment-body">
                        <div class="comment-header-line">
                            <span class="comment-author-handle">${escapeHtml(userHandle)}</span>
                            <span class="comment-you-pill">(You)</span>
                        </div>
                        <p class="comment-message">${escapeHtml(text)}</p>
                        <div class="comment-actions-bar">
                            <button class="comment-action-reply">Reply</button>
                            <button class="comment-action-like liked" data-count="1">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                </svg>
                                <span class="like-number">1</span>
                            </button>
                        </div>
                    </div>
                `;

                cardThread1.appendChild(newComment);
                addThoughtInput.value = '';

                if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                    window.WabiSabiStore.showToast('✦ Thought saved to marginalia');
                }
            }
        });
    }

    // --------------------------------------------------------------------------
    // Theme Toggle (Tea Glass Light / Coffee Cup Dark)
    // --------------------------------------------------------------------------
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const savedTheme = localStorage.getItem('wabisabi_theme') || 
        localStorage.getItem('wabi_sabi_theme') || 
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            document.body.classList.add('dark-mode');
        } else {
            document.documentElement.removeAttribute('data-theme');
            document.body.classList.remove('dark-mode');
        }
    }

    applyTheme(savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.body.classList.contains('dark-mode');
            const next = isDark ? 'light' : 'dark';
            applyTheme(next);
            localStorage.setItem('wabisabi_theme', next);
            localStorage.setItem('wabi_sabi_theme', next);
            if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                window.WabiSabiStore.showToast(next === 'dark' ? '☕ Nocturne Quiet Mode' : '🍵 Morning Linen Mode');
            }
        });
    }

    // Reader Page Text Search
    const readerSearchInput = document.querySelector('.search-pill');
    if (readerSearchInput) {
        readerSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && readerSearchInput.value.trim().length > 0) {
                const q = readerSearchInput.value.trim().toLowerCase();
                const contentText = (document.getElementById('readingViewport') ? document.getElementById('readingViewport').textContent : '').toLowerCase();
                if (contentText.includes(q)) {
                    if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                        window.WabiSabiStore.showToast(`✦ Found occurrence of "${q}" in this reading spread`);
                    }
                } else {
                    if (window.WabiSabiStore && window.WabiSabiStore.showToast) {
                        window.WabiSabiStore.showToast(`✦ No occurrences of "${q}" on active pages`);
                    }
                }
            }
        });
    }

    function escapeHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function escapeHtmlAttribute(str) {
        return escapeHtml(str);
    }

    function safeAvatarUrl(value) {
        const fallback = '/assets/user_avatar.jpg';
        if (typeof value !== 'string' || !value.trim()) return fallback;
        try {
            const parsed = new URL(value.trim(), window.location.href);
            if (parsed.username || parsed.password) return fallback;
            const isLocalAsset = parsed.origin === window.location.origin
                && parsed.pathname.startsWith('/assets/')
                && !parsed.pathname.split('/').includes('..');
            if (isLocalAsset) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
            if (parsed.protocol === 'https:') return parsed.href;
        } catch (error) {
            return fallback;
        }
        return fallback;
    }
});
