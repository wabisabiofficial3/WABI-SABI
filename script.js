/**
 * WABI SABI — Dashboard Interactions
 * Organic, editorial-style JavaScript interactions
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // ========================================
    // Card Tilt Effect (3D on mouse move) - Orbital Cards
    // ========================================
    const orbitalCards = document.querySelectorAll('.category-cards-orbital .card[data-tilt]');
    
    orbitalCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 8;
            const rotateY = (centerX - x) / 8;
            
            // Get the base rotation from CSS custom property
            const hoverRotation = getComputedStyle(card).getPropertyValue('--hover-rotation').trim() || '0deg';
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px) scale(1.03) rotate(${hoverRotation})`;
        });
        
        card.addEventListener('mouseleave', () => {
            const baseRotation = card.classList.contains('card-books-orbital') ? 'translateX(-50%) rotate(3deg)' :
                                card.classList.contains('card-films-orbital') ? 'rotate(-4deg)' :
                                card.classList.contains('card-discussions-orbital') ? 'rotate(-6deg)' : 
                                card.classList.contains('card-community-orbital') ? 'translateX(-50%) rotate(2deg)' : 'rotate(0deg)';
            
            card.style.transform = `perspective(1000px) ${baseRotation} translateY(0) scale(1)`;
        });
    });
    
    // ========================================
    // Search Field Focus Animation
    // ========================================
    const searchField = document.querySelector('.search-field');
    const searchInput = searchField.querySelector('input');
    
    searchInput.addEventListener('focus', () => {
        searchField.style.transform = 'scale(1.02)';
    });
    
    searchInput.addEventListener('blur', () => {
        searchField.style.transform = 'scale(1)';
    });
    
    // ========================================
    // Progress Bar Animation on View
    // ========================================
    const readingCard = document.querySelector('.reading-card');
    const progressFill = readingCard.querySelector('.progress-fill');
    const initialWidth = progressFill.style.width;
    
    // Reset and animate progress
    progressFill.style.width = '0%';
    setTimeout(() => {
        progressFill.style.width = initialWidth;
    }, 1000);
    
    // ========================================
    // Sidebar Navigation Active State
    // ========================================
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // Update icon background
            const svg = item.querySelector('svg');
            if (!item.classList.contains('active')) return;
            
            if (!item.querySelector('.icon-bg')) {
                const iconBg = document.createElement('div');
                iconBg.className = 'icon-bg';
                iconBg.appendChild(svg.cloneNode(true));
                svg.replaceWith(iconBg);
            }
        });
    });
    
    // ========================================
    // Handwritten Notes Subtle Random Movement
    // ========================================
    const notes = document.querySelectorAll('.handwritten-note');
    
    notes.forEach(note => {
        let isHovered = false;
        
        note.addEventListener('mouseenter', () => {
            isHovered = true;
            const randomRotate = (Math.random() - 0.5) * 6;
            note.style.transform = `rotate(${randomRotate}deg) scale(1.05)`;
        });
        
        note.addEventListener('mouseleave', () => {
            isHovered = false;
            const originalTransform = note.classList.contains('note-left') ? 'rotate(-5deg)' :
                                     note.classList.contains('note-center') ? 'translateX(-50%) rotate(2deg)' :
                                     note.classList.contains('note-right') ? 'rotate(3deg)' : 'rotate(-2deg)';
            note.style.transform = originalTransform;
        });
    });
    
    // ========================================
    // Community Cards Staggered Entrance
    // ========================================
    const commCards = document.querySelectorAll('.comm-card');
    
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const commObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(30px)';
                    
                    setTimeout(() => {
                        entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 50);
                }, index * 100);
                
                commObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    commCards.forEach(card => commObserver.observe(card));
    
    // ========================================
    // Theme Toggle (Sun Icon)
    // ========================================
    const sunIcon = document.querySelector('.sun-icon');
    let isDarkMode = false;
    
    sunIcon.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        
        if (isDarkMode) {
            document.body.style.filter = 'invert(1) hue-rotate(180deg)';
            document.body.style.background = '#1a1a1a';
            sunIcon.style.transform = 'rotate(180deg)';
        } else {
            document.body.style.filter = 'none';
            document.body.style.background = '#F5F3ED';
            sunIcon.style.transform = 'rotate(0deg)';
        }
    });
    
    // ========================================
    // Join Button Click Animation
    // ========================================
    const joinBtn = document.querySelector('.join-btn');
    
    joinBtn.addEventListener('click', () => {
        const ripple = document.createElement('span');
        ripple.style.position = 'absolute';
        ripple.style.borderRadius = '50%';
        ripple.style.background = 'rgba(255, 255, 255, 0.3)';
        ripple.style.transform = 'scale(0)';
        ripple.style.animation = 'ripple 0.6s linear';
        ripple.style.pointerEvents = 'none';
        
        const rect = joinBtn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        
        joinBtn.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    });
    
    // Add ripple keyframes
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
    
    // ========================================
    // Card Arrow Button Spin on Click
    // ========================================
    const cardArrows = document.querySelectorAll('.card-arrow');
    
    cardArrows.forEach(arrow => {
        arrow.addEventListener('click', (e) => {
            e.stopPropagation();
            arrow.style.transform = 'scale(0.9) rotate(45deg)';
            
            setTimeout(() => {
                arrow.style.transform = 'scale(1) rotate(0deg)';
            }, 300);
        });
    });
    
    // ========================================
    // Hero Headline Letter Spacing Animation
    // ========================================
    const headlineLines = document.querySelectorAll('.hero-headline .line');
    
    headlineLines.forEach((line, index) => {
        line.style.opacity = '0';
        line.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            line.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
            line.style.opacity = '1';
            line.style.transform = 'translateX(0)';
        }, 200 + (index * 150));
    });
    
    // ========================================
    // Search Input Typing Effect Placeholder
    // ========================================
    const placeholders = [
        'Search for books, movies, people, ideas...',
        'Find your next perspective...',
        'Discover something new...',
        'Explore stories...'
    ];
    
    let placeholderIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typingSpeed = 100;
    
    function typePlaceholder() {
        const currentPlaceholder = placeholders[placeholderIndex];
        
        if (isDeleting) {
            searchInput.setAttribute('placeholder', currentPlaceholder.substring(0, charIndex - 1));
            charIndex--;
            typingSpeed = 50;
        } else {
            searchInput.setAttribute('placeholder', currentPlaceholder.substring(0, charIndex + 1));
            charIndex++;
            typingSpeed = 100;
        }
        
        if (!isDeleting && charIndex === currentPlaceholder.length) {
            isDeleting = true;
            typingSpeed = 2000; // Pause at end
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            placeholderIndex = (placeholderIndex + 1) % placeholders.length;
            typingSpeed = 500; // Pause before typing new
        }
        
        if (document.visibilityState === 'visible') {
            setTimeout(typePlaceholder, typingSpeed);
        }
    }
    
    // Start typing effect after page load
    setTimeout(typePlaceholder, 3000);
    
    // ========================================
    // Parallax Effect on Scroll
    // ========================================
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;
        const scrollDelta = currentScrollY - lastScrollY;
        
        // Subtle parallax on handwritten notes
        notes.forEach((note, index) => {
            const speed = 0.05 + (index * 0.02);
            const currentTransform = note.style.transform || '';
            const baseRotation = note.classList.contains('note-left') ? 'rotate(-5deg)' :
                                note.classList.contains('note-center') ? 'translateX(-50%) rotate(2deg)' :
                                note.classList.contains('note-right') ? 'rotate(3deg)' : 'rotate(-2deg)';
            
            if (!note.matches(':hover')) {
                const translateY = scrollDelta * speed;
                note.style.transform = `${baseRotation} translateY(${translateY}px)`;
            }
        });
        
        lastScrollY = currentScrollY;
    });
    
    // ========================================
    // Community Explore Button
    // ========================================
    const exploreBtn = document.querySelector('.comm-explore');
    
    exploreBtn.addEventListener('click', () => {
        exploreBtn.style.transform = 'scale(0.9)';
        
        setTimeout(() => {
            exploreBtn.style.transform = 'scale(1.1)';
        }, 150);
        
        setTimeout(() => {
            exploreBtn.style.transform = 'scale(1)';
        }, 300);
    });
    
    // ========================================
    // Logo Click Animation
    // ========================================
    const logo = document.querySelector('.logo');
    
    logo.addEventListener('click', () => {
        logo.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            logo.style.transform = 'scale(1)';
        }, 150);
    });
    
    // ========================================
    // Reading Card Progress Update Simulation
    // ========================================
    const percentageDisplay = document.querySelector('.reading-percentage');
    let currentProgress = 42;
    
    // Simulate reading progress update every 30 seconds
    setInterval(() => {
        if (currentProgress < 100 && Math.random() > 0.7) {
            currentProgress = Math.min(currentProgress + 1, 100);
            progressFill.style.width = `${currentProgress}%`;
            percentageDisplay.textContent = `${currentProgress}%`;
        }
    }, 30000);
    
    // ========================================
    // Interactive Cat Character
    // ========================================
    const cat = document.getElementById('interactiveCat');
    
    if (cat) {
        // Blink animation on random intervals
        function triggerBlink() {
            cat.classList.add('blink');
            setTimeout(() => cat.classList.remove('blink'), 200);
            
            // Schedule next blink (random between 2-6 seconds)
            setTimeout(triggerBlink, 2000 + Math.random() * 4000);
        }
        
        // Start blinking
        setTimeout(triggerBlink, 2000);
        
        // Look at cursor position
        cat.addEventListener('mousemove', (e) => {
            const rect = cat.getBoundingClientRect();
            const catCenterX = rect.left + rect.width / 2;
            const catCenterY = rect.top + rect.height / 2;
            
            const deltaX = e.clientX - catCenterX;
            const deltaY = e.clientY - catCenterY;
            
            // Remove previous look directions
            cat.classList.remove('look-left', 'look-right', 'look-up', 'look-down');
            
            // Determine look direction based on cursor position
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                if (deltaX > 20) {
                    cat.classList.add('look-right');
                } else if (deltaX < -20) {
                    cat.classList.add('look-left');
                }
            } else {
                if (deltaY > 20) {
                    cat.classList.add('look-down');
                } else if (deltaY < -20) {
                    cat.classList.add('look-up');
                }
            }
        });
        
        // Reset eye position when mouse leaves
        cat.addEventListener('mouseleave', () => {
            cat.classList.remove('look-left', 'look-right', 'look-up', 'look-down');
        });
        
        // Purr on click
        cat.addEventListener('click', () => {
            cat.classList.add('purring');
            
            // Add a little jump
            cat.style.transform = 'scale(1.1) translateY(-5px)';
            
            setTimeout(() => {
                cat.classList.remove('purring');
                cat.style.transform = 'scale(1) translateY(0)';
            }, 1000);
        });
        
        // Hover effect already handled in CSS
    }
    
    console.log('Wabi Sabi Dashboard initialized ✨');
});
