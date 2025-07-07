// ========== CONFIGURATION SIO CASINO ========== //

/**
 * Configuration centralisée pour SIO Casino
 * Modifiez ces valeurs pour personnaliser votre casino
 */

const SIO_CASINO_CONFIG = {
    // ========== IDENTITÉ DU CASINO ========== //
    casino: {
        name: "SIO CASINO",
        emoji: "🎰",
        slogan: "Table de Blackjack Exclusive",
        description: "Rejoignez la plus prestigieuse table de blackjack en ligne. Maximum 5 joueurs par partie."
    },

    // ========== RÈGLES DE JEU ========== //
    game: {
        maxPlayers: 5,              // Nombre maximum de joueurs par table
        playerTimeout: 30,          // Temps limite par joueur (en secondes)
        dealerStandsOn: 17,        // Le croupier s'arrête à ce score
        blackjackPayout: 1.5,     // Multiplicateur pour blackjack (3:2)
        enableSplit: true,         // Autoriser le split
        enableDouble: true,        // Autoriser le double down
        enableSurrender: false,    // Abandon (non implémenté)
        maxSplitHands: 4,         // Nombre maximum de mains après split
        
        // Conditions pour doubler
        doubleAfterSplit: true,    // Peut doubler après un split
        doubleOnAny: false,        // Doubler sur n'importe quel score (false = 9,10,11 seulement)
        
        // Règles spéciales
        dealerHitsOnSoft17: false, // Le croupier tire sur un 17 souple (A,6)
        surrenderAllowed: false,   // Abandon autorisé
        insuranceAllowed: false    // Assurance contre blackjack croupier
    },

    // ========== INTERFACE UTILISATEUR ========== //
    ui: {
        theme: {
            primaryColor: "#FFD700",     // Or
            secondaryColor: "#1B5E20",   // Vert table
            accentColor: "#667eea",      // Bleu accent
            errorColor: "#ff416c",       // Rouge erreur
            successColor: "#11998e",     // Vert succès
            warningColor: "#f093fb"      // Rose warning
        },
        
        animations: {
            cardDealSpeed: 1000,         // Durée animation distribution (ms)
            particleCount: 15,           // Nombre max de particules
            notificationDuration: 3000,  // Durée des notifications (ms)
            timerUpdateInterval: 100     // Fréquence mise à jour timer (ms)
        },
        
        chat: {
            enabled: true,
            maxMessages: 50,             // Historique chat conservé
            maxMessageLength: 120,       // Taille max d'un message
            showTimestamps: true,
            allowEmojis: true
        },
        
        sounds: {
            enabled: false,              // Sons activés (à implémenter)
            cardDeal: "sounds/card.mp3",
            win: "sounds/win.mp3",
            lose: "sounds/lose.mp3",
            notification: "sounds/beep.mp3"
        }
    },

    // ========== FIREBASE CONFIGURATION ========== //
    firebase: {
        // Configuration Firebase (déjà définie dans firebase-manager.js)
        useLocalStorageFallback: true,   // Utiliser localStorage si Firebase indisponible
        pollInterval: 300,               // Fréquence polling localStorage (ms)
        roomPrefix: "sio_rooms",         // Préfixe des rooms dans Firebase
        maxRoomAge: 24 * 60 * 60 * 1000, // Durée de vie des rooms (24h)
        
        // Nettoyage automatique
        autoCleanup: true,
        cleanupInterval: 60 * 60 * 1000  // Nettoyage toutes les heures
    },

    // ========== SÉCURITÉ ========== //
    security: {
        maxNameLength: 12,               // Taille max nom joueur
        roomCodeLength: 6,               // Taille code room
        allowedNameChars: /^[a-zA-Z0-9_-]+$/, // Caractères autorisés nom
        rateLimit: {
            actionsPerMinute: 60,        // Limite actions par minute
            messagesPerMinute: 10        // Limite messages chat par minute
        }
    },

    // ========== DÉVELOPPEMENT ========== //
    dev: {
        debug: false,                    // Mode debug activé
        showConsoleInfo: true,          // Afficher infos console
        enablePerformanceMetrics: false, // Métriques de performance
        testMode: false,                // Mode test (règles assouplies)
        
        // Logs détaillés
        logLevel: "info", // "debug", "info", "warn", "error"
        logCategories: {
            firebase: true,
            gameLogic: true,
            ui: true,
            network: true
        }
    },

    // ========== FONCTIONNALITÉS EXPÉRIMENTALES ========== //
    experimental: {
        enableTournaments: false,        // Système de tournois
        enableBetting: false,           // Système de mises
        enableSpectators: false,        // Mode spectateur
        enableReplay: false,            // Rejouer la partie
        enableStats: false,             // Statistiques détaillées
        enableAchievements: false       // Système de succès
    },

    // ========== TEXTS PERSONNALISABLES ========== //
    texts: {
        fr: {
            lobby: {
                welcome: "Bienvenue au SIO Casino",
                createRoom: "🎯 Ouvrir une table (Croupier)",
                joinRoom: "🎲 Rejoindre une table",
                playerName: "👤 Votre nom de joueur :",
                roomCode: "Code de la table :"
            },
            
            game: {
                hit: "⬆️ Carte",
                stand: "✋ Rester",
                double: "💰 Doubler",
                split: "🃏 Split",
                dealCards: "🎴 Distribuer",
                dealerTurn: "🎲 Tour croupier"
            },
            
            notifications: {
                roomCreated: "🎰 Table SIO Casino créée!",
                playerJoined: "🎉 Bienvenue à SIO Casino!",
                cardDealt: "🃏 Carte tirée!",
                playerStands: "✋ Vous restez",
                doubleDowned: "💰 Mise doublée!",
                handSplit: "🃏 Mains séparées!",
                timeout: "⏰ Temps écoulé - Stand automatique"
            },
            
            results: {
                win: "🎉 Victoire!",
                lose: "💀 Défaite",
                tie: "🤝 Égalité",
                blackjack: "🔥 Blackjack!",
                bust: "💥 Bust"
            }
        }
    }
};

// ========== FONCTIONS UTILITAIRES ========== //

/**
 * Récupère une valeur de configuration
 * @param {string} path - Chemin vers la configuration (ex: "game.maxPlayers")
 * @param {*} defaultValue - Valeur par défaut si non trouvée
 * @returns {*} La valeur de configuration
 */
function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let current = SIO_CASINO_CONFIG;
    
    for (const key of keys) {
        if (current && typeof current === 'object' && key in current) {
            current = current[key];
        } else {
            return defaultValue;
        }
    }
    
    return current;
}

/**
 * Modifie une valeur de configuration
 * @param {string} path - Chemin vers la configuration
 * @param {*} value - Nouvelle valeur
 */
function setConfig(path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = SIO_CASINO_CONFIG;
    
    for (const key of keys) {
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }
    
    current[lastKey] = value;
}

/**
 * Applique un thème personnalisé
 * @param {Object} themeConfig - Configuration du thème
 */
function applyTheme(themeConfig) {
    const root = document.documentElement;
    
    if (themeConfig.primaryColor) {
        root.style.setProperty('--primary-color', themeConfig.primaryColor);
    }
    if (themeConfig.secondaryColor) {
        root.style.setProperty('--secondary-color', themeConfig.secondaryColor);
    }
    if (themeConfig.accentColor) {
        root.style.setProperty('--accent-color', themeConfig.accentColor);
    }
}

/**
 * Validation de la configuration
 * @returns {Object} Résultat de la validation
 */
function validateConfig() {
    const errors = [];
    const warnings = [];
    
    // Vérifications critiques
    if (getConfig('game.maxPlayers') < 1 || getConfig('game.maxPlayers') > 10) {
        errors.push('game.maxPlayers doit être entre 1 et 10');
    }
    
    if (getConfig('game.playerTimeout') < 5 || getConfig('game.playerTimeout') > 300) {
        warnings.push('game.playerTimeout recommandé entre 5 et 300 secondes');
    }
    
    if (getConfig('game.dealerStandsOn') < 16 || getConfig('game.dealerStandsOn') > 21) {
        errors.push('game.dealerStandsOn doit être entre 16 et 21');
    }
    
    // Vérifications Firebase
    if (!getConfig('firebase.useLocalStorageFallback') && !window.firebase) {
        warnings.push('Firebase non disponible et fallback localStorage désactivé');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        warnings: warnings
    };
}

/**
 * Initialise la configuration au démarrage
 */
function initializeConfig() {
    const validation = validateConfig();
    
    if (!validation.valid) {
        console.error('❌ Erreurs de configuration SIO Casino:', validation.errors);
        return false;
    }
    
    if (validation.warnings.length > 0) {
        console.warn('⚠️ Avertissements configuration SIO Casino:', validation.warnings);
    }
    
    // Appliquer le thème
    applyTheme(getConfig('ui.theme'));
    
    // Logger la configuration en mode debug
    if (getConfig('dev.debug')) {
        console.log('🔧 Configuration SIO Casino chargée:', SIO_CASINO_CONFIG);
    }
    
    console.log('✅ Configuration SIO Casino initialisée');
    return true;
}

// ========== PRESETS DE CONFIGURATION ========== //

const CONFIG_PRESETS = {
    // Configuration débutant (règles assouplies)
    beginner: {
        game: {
            playerTimeout: 60,
            enableSplit: true,
            enableDouble: true,
            doubleOnAny: true
        },
        ui: {
            chat: { enabled: true },
            animations: { cardDealSpeed: 1500 }
        }
    },
    
    // Configuration tournoi (règles strictes)
    tournament: {
        game: {
            playerTimeout: 20,
            enableSplit: true,
            enableDouble: false,
            doubleOnAny: false,
            dealerHitsOnSoft17: true
        },
        ui: {
            chat: { enabled: false },
            animations: { cardDealSpeed: 800 }
        }
    },
    
    // Configuration rapide (parties courtes)
    quick: {
        game: {
            playerTimeout: 15,
            maxPlayers: 3,
            enableSplit: false,
            enableDouble: true
        },
        ui: {
            animations: { cardDealSpeed: 600 }
        }
    }
};

/**
 * Applique un preset de configuration
 * @param {string} presetName - Nom du preset à appliquer
 */
function applyConfigPreset(presetName) {
    if (!(presetName in CONFIG_PRESETS)) {
        console.error(`❌ Preset "${presetName}" non trouvé`);
        return false;
    }
    
    const preset = CONFIG_PRESETS[presetName];
    
    // Fusionner le preset avec la configuration actuelle
    function deepMerge(target, source) {
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = target[key] || {};
                deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }
    
    deepMerge(SIO_CASINO_CONFIG, preset);
    
    console.log(`✅ Preset "${presetName}" appliqué`);
    return true;
}

// Export global de la configuration
window.SIO_CASINO_CONFIG = SIO_CASINO_CONFIG;
window.getConfig = getConfig;
window.setConfig = setConfig;
window.applyTheme = applyTheme;
window.validateConfig = validateConfig;
window.initializeConfig = initializeConfig;
window.applyConfigPreset = applyConfigPreset;

// Auto-initialisation
document.addEventListener('DOMContentLoaded', () => {
    initializeConfig();
});