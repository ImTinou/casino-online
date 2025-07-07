// ========== PAGE D'ACCUEIL SCRIPTS ==========

// Animation des statistiques
function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.dataset.target);
                animateValue(entry.target, 0, target, 2000);
                observer.unobserve(entry.target);
            }
        });
    });

    statNumbers.forEach(stat => observer.observe(stat));
}

function animateValue(element, start, end, duration) {
    const range = end - start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function pour un effet plus naturel
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(start + (range * easedProgress));
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Création des particules d'ambiance
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    // Créer des particules en continu
    setInterval(() => {
        const existingParticles = document.querySelectorAll('.particle');
        if (existingParticles.length < 20) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particlesContainer.appendChild(particle);
            
            // Supprimer la particule après son animation
            setTimeout(() => {
                if (particle && particle.parentNode) {
                    particle.remove();
                }
            }, 8000);
        }
    }, 500);
}

// Navigation avec effet de scroll
function initNavbar() {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(0, 0, 0, 0.95)';
            navbar.style.borderBottom = '1px solid rgba(255, 215, 0, 0.3)';
        } else {
            navbar.style.background = 'rgba(0, 0, 0, 0.9)';
            navbar.style.borderBottom = '1px solid rgba(255, 215, 0, 0.2)';
        }
    });
}

// Smooth scroll pour les liens d'ancrage
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Animation des cartes au survol
function initCardAnimations() {
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            // Ajouter un effet de particules au survol
            createCardSparkles(card);
        });
    });
}

function createCardSparkles(card) {
    const rect = card.getBoundingClientRect();
    const sparkleCount = 5;
    
    for (let i = 0; i < sparkleCount; i++) {
        setTimeout(() => {
            const sparkle = document.createElement('div');
            sparkle.style.position = 'fixed';
            sparkle.style.left = (rect.left + Math.random() * rect.width) + 'px';
            sparkle.style.top = (rect.top + Math.random() * rect.height) + 'px';
            sparkle.style.width = '4px';
            sparkle.style.height = '4px';
            sparkle.style.background = '#FFD700';
            sparkle.style.borderRadius = '50%';
            sparkle.style.pointerEvents = 'none';
            sparkle.style.zIndex = '1000';
            sparkle.style.animation = 'sparkleFloat 1s ease-out forwards';
            
            document.body.appendChild(sparkle);
            
            setTimeout(() => sparkle.remove(), 1000);
        }, i * 100);
    }
}

// Ajouter l'animation sparkle au CSS
const sparkleCSS = `
    @keyframes sparkleFloat {
        0% { 
            transform: translateY(0) scale(0); 
            opacity: 1; 
        }
        50% { 
            transform: translateY(-20px) scale(1); 
            opacity: 1; 
        }
        100% { 
            transform: translateY(-40px) scale(0); 
            opacity: 0; 
        }
    }
`;

function addSparkleCSS() {
    const style = document.createElement('style');
    style.textContent = sparkleCSS;
    document.head.appendChild(style);
}

// Parallax effect pour la section hero
function initParallax() {
    const heroVisual = document.querySelector('.hero-visual');
    if (!heroVisual) return;

    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * -0.5;
        heroVisual.style.transform = `translateY(${rate}px)`;
    });
}

// Animation d'apparition des éléments au scroll
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.feature-card, .step, .cta-content');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, { 
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animatedElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
}

// Gestion de la modale de démo
function showDemo() {
    const modal = document.getElementById('demoModal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        // Animation d'apparition
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
    }
}

function closeDemo() {
    const modal = document.getElementById('demoModal');
    if (modal) {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }, 300);
    }
}

// Fermer la modale en cliquant à l'extérieur
function initModalEvents() {
    const modal = document.getElementById('demoModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeDemo();
            }
        });
    }
    
    // Fermer avec Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDemo();
        }
    });
}

// Animation des chips dans la prévisualisation
function initChipAnimations() {
    const chips = document.querySelectorAll('.chip');
    chips.forEach((chip, index) => {
        chip.addEventListener('mouseenter', () => {
            chip.style.animationPlayState = 'paused';
        });
        
        chip.addEventListener('mouseleave', () => {
            chip.style.animationPlayState = 'running';
        });
    });
}

// Effet de type machine à écrire pour le titre
function typeWriter(element, text, speed = 50) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Easter egg : Konami Code
function initKonamiCode() {
    const konamiCode = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    let konamiIndex = 0;
    
    document.addEventListener('keydown', (e) => {
        if (e.code === konamiCode[konamiIndex]) {
            konamiIndex++;
            if (konamiIndex === konamiCode.length) {
                activateEasterEgg();
                konamiIndex = 0;
            }
        } else {
            konamiIndex = 0;
        }
    });
}

function activateEasterEgg() {
    // Effet spécial : pluie de cartes
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            createFallingCard();
        }, i * 100);
    }
    
    // Notification spéciale
    showNotification('🎉 Code Konami activé ! Pluie de cartes !', 'success');
}

function createFallingCard() {
    const cards = ['🂡', '🂱', '🃁', '🃑', '🂽', '🂾', '🂿', '🃀'];
    const card = document.createElement('div');
    
    card.style.position = 'fixed';
    card.style.top = '-50px';
    card.style.left = Math.random() * window.innerWidth + 'px';
    card.style.fontSize = '30px';
    card.style.zIndex = '10000';
    card.style.pointerEvents = 'none';
    card.textContent = cards[Math.floor(Math.random() * cards.length)];
    card.style.animation = 'fallDown 3s linear forwards';
    
    document.body.appendChild(card);
    
    setTimeout(() => card.remove(), 3000);
}

// Ajouter l'animation de chute
const fallCSS = `
    @keyframes fallDown {
        to {
            transform: translateY(calc(100vh + 100px)) rotate(360deg);
            opacity: 0;
        }
    }
`;

function addFallCSS() {
    const style = document.createElement('style');
    style.textContent = fallCSS;
    document.head.appendChild(style);
}

// Système de notification (réutilisé du jeu)
function showNotification(message, type = 'info') {
    const existing = document.querySelector('.notification');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 400);
    }, 3000);
}

// Détection du thème sombre/clair du système
function initThemeDetection() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        // L'utilisateur préfère le thème clair, on peut ajuster certains éléments
        console.log('Thème clair détecté');
    }
}

// Performance monitoring
function initPerformanceMonitoring() {
    // Surveiller les performances et ajuster les animations si nécessaire
    let lastFrameTime = performance.now();
    let frameCount = 0;
    
    function checkFPS() {
        const now = performance.now();
        frameCount++;
        
        if (now - lastFrameTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / (now - lastFrameTime));
            
            if (fps < 30) {
                // Réduire les animations si FPS trop bas
                document.body.classList.add('low-performance');
                console.log('Mode performance réduite activé');
            }
            
            frameCount = 0;
            lastFrameTime = now;
        }
        
        requestAnimationFrame(checkFPS);
    }
    
    requestAnimationFrame(checkFPS);
}

// Initialisation principale
function init() {
    // Attendre que le DOM soit complètement chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
        return;
    }
    
    console.log('🎰 Initialisation de Casino Royal Homepage...');
    
    // Initialiser tous les modules
    addSparkleCSS();
    addFallCSS();
    createParticles();
    initNavbar();
    initSmoothScroll();
    initCardAnimations();
    initParallax();
    initScrollAnimations();
    initModalEvents();
    initChipAnimations();
    initKonamiCode();
    initThemeDetection();
    initPerformanceMonitoring();
    
    // Animer les statistiques après un petit délai
    setTimeout(() => {
        animateStats();
    }, 500);
    
    console.log('✅ Homepage initialisée avec succès !');
    
    // Message de bienvenue
    setTimeout(() => {
        showNotification('🎰 Bienvenue chez Casino Royal !', 'success');
    }, 1000);
}

// Exposer les fonctions globalement pour les boutons
window.showDemo = showDemo;
window.closeDemo = closeDemo;

// Démarrer l'initialisation
init();

// Service Worker pour le cache (optionnel)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}