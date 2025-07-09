// Fichier: firebase-config-improved.js
// Configuration Firebase améliorée avec gestion d'erreurs et fallbacks

// Protection contre la redéclaration
if (typeof window !== 'undefined' && typeof window.firebaseConfig === 'undefined') {
    window.firebaseConfig = {
        apiKey: "AIzaSyBlF0Rv-vaLHlopMYNbs7JnLyiqi-HUnn4",
        authDomain: "blackjack-casino-royal.firebaseapp.com",
        databaseURL: "https://blackjack-casino-royal-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "blackjack-casino-royal",
        storageBucket: "blackjack-casino-royal.firebasestorage.app",
        messagingSenderId: "554706185893",
        appId: "1:554706185893:web:847eefcd131c6a929f674c",
        measurementId: "G-8XTRFPR9VQ"
    };
}

// État de connexion global
window.firebaseState = {
    initialized: false,
    connected: false,
    authReady: false,
    retryCount: 0,
    maxRetries: 3,
    fallbackMode: false
};

const firebaseConfig = window.firebaseConfig;

// Gestionnaire d'erreurs centralisé
class FirebaseErrorHandler {
    static logError(error, context, severity = 'error') {
        const timestamp = new Date().toISOString();
        console[severity](`[Firebase ${context}] ${timestamp}:`, error);
        
        // Stocker les erreurs pour debugging
        if (!window.firebaseErrors) window.firebaseErrors = [];
        window.firebaseErrors.push({
            timestamp,
            context,
            error: error.message || error,
            code: error.code,
            severity
        });
        
        // Limiter le stockage à 50 erreurs
        if (window.firebaseErrors.length > 50) {
            window.firebaseErrors.shift();
        }
    }
    
    static getErrorSummary() {
        return window.firebaseErrors || [];
    }
}

// Gestionnaire de fallback
class FallbackManager {
    static enable() {
        console.warn('🔄 Mode fallback activé - Fonctionnalités limitées');
        window.firebaseState.fallbackMode = true;
        
        // Créer un utilisateur local temporaire
        const fallbackUser = {
            uid: 'fallback_' + Date.now(),
            displayName: 'Utilisateur Local',
            email: 'local@fallback.com',
            balance: 1000,
            isFallback: true,
            createdAt: Date.now()
        };
        
        sessionStorage.setItem('fallbackUser', JSON.stringify(fallbackUser));
        this.setupLocalStorage();
        
        // Notifier l'utilisateur
        this.showFallbackNotification();
    }
    
    static setupLocalStorage() {
        // Simuler les opérations Firebase avec localStorage
        window.fallbackDB = {
            ref: (path) => ({
                set: (data) => {
                    localStorage.setItem(`fb_${path}`, JSON.stringify(data));
                    return Promise.resolve();
                },
                once: (event) => {
                    const data = localStorage.getItem(`fb_${path}`);
                    return Promise.resolve({
                        val: () => data ? JSON.parse(data) : null
                    });
                },
                on: (event, callback) => {
                    // Simuler l'écoute en temps réel
                    const data = localStorage.getItem(`fb_${path}`);
                    callback({
                        val: () => data ? JSON.parse(data) : null
                    });
                }
            })
        };
    }
    
    static showFallbackNotification() {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 170, 0, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">⚠️</span>
                <div>
                    <div style="font-weight: bold;">Mode Hors Ligne</div>
                    <div style="font-size: 0.9em; opacity: 0.9;">Fonctionnalités limitées</div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; font-size: 1.2em; cursor: pointer;">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove après 10 secondes
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
    
    static isActive() {
        return window.firebaseState.fallbackMode;
    }
}

// Gestionnaire de retry intelligent
class RetryManager {
    static async executeWithRetry(operation, context, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await operation();
                if (attempt > 1) {
                    console.log(`✅ ${context} réussi après ${attempt} tentatives`);
                }
                return result;
            } catch (error) {
                FirebaseErrorHandler.logError(error, `${context} (tentative ${attempt}/${maxRetries})`);
                
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Délai exponentiel
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                console.log(`🔄 Retry ${context} dans ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
}

// Initialisation Firebase avec gestion d'erreurs avancée
async function initializeFirebaseAdvanced() {
    if (window.firebaseState.initialized) {
        console.log('ℹ️ Firebase déjà initialisé');
        return;
    }
    
    try {
        // Vérifier que Firebase SDK est chargé
        if (typeof firebase === 'undefined') {
            throw new Error('Firebase SDK non chargé');
        }
        
        // Initialiser Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialisé avec succès');
        }
        
        // Configuration Auth avec gestion d'erreurs
        await setupAuthentication();
        
        // Configuration Database avec retry
        await setupDatabase();
        
        window.firebaseState.initialized = true;
        
        // Nettoyer les rooms inactives
        setupRoomCleanup();
        
    } catch (error) {
        FirebaseErrorHandler.logError(error, 'Initialisation');
        
        // Si échec critique, activer le mode fallback
        if (window.firebaseState.retryCount >= window.firebaseState.maxRetries) {
            FallbackManager.enable();
        } else {
            window.firebaseState.retryCount++;
            const delay = 3000 * window.firebaseState.retryCount;
            console.log(`🔄 Retry initialisation dans ${delay}ms...`);
            setTimeout(initializeFirebaseAdvanced, delay);
        }
    }
}

// Configuration de l'authentification
async function setupAuthentication() {
    return RetryManager.executeWithRetry(async () => {
        const auth = firebase.auth();
        
        // Configuration de la persistance
        await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        
        // Gestion des changements d'état auth
        auth.onAuthStateChanged((user) => {
            window.firebaseState.authReady = true;
            
            if (user) {
                console.log('✅ Utilisateur connecté:', user.displayName || user.email);
                // Mettre à jour l'activité utilisateur
                updateUserActivity(user.uid);
            } else {
                console.log('ℹ️ Aucun utilisateur connecté');
            }
            
            // Émettre événement personnalisé
            window.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { user, isReady: true } 
            }));
        });
        
        console.log('✅ Authentication configurée');
    }, 'Configuration Auth');
}

// Configuration de la base de données
async function setupDatabase() {
    return RetryManager.executeWithRetry(async () => {
        const database = firebase.database();
        
        // Surveillance de la connexion
        database.ref('.info/connected').on('value', (snapshot) => {
            const connected = snapshot.val();
            window.firebaseState.connected = connected;
            
            if (connected) {
                console.log('✅ Database connectée');
                window.firebaseState.retryCount = 0; // Reset sur succès
                
                // Événement personnalisé
                window.dispatchEvent(new CustomEvent('databaseConnected'));
            } else {
                console.log('❌ Database déconnectée');
                window.dispatchEvent(new CustomEvent('databaseDisconnected'));
            }
            
            updateConnectionStatus(connected);
        });
        
        // Gestion des erreurs de permissions
        database.ref('.info/connected').on('value', () => {}, (error) => {
            if (error.code === 'PERMISSION_DENIED') {
                FirebaseErrorHandler.logError(error, 'Permissions Database');
                console.warn('⚠️ Permissions limitées - Certaines fonctionnalités peuvent être indisponibles');
            }
        });
        
        console.log('✅ Database configurée');
    }, 'Configuration Database');
}

// Mettre à jour l'activité utilisateur
async function updateUserActivity(uid) {
    if (!window.firebaseState.connected) return;
    
    try {
        await firebase.database()
            .ref(`users/${uid}/lastActivity`)
            .set(firebase.database.ServerValue.TIMESTAMP);
    } catch (error) {
        FirebaseErrorHandler.logError(error, 'Mise à jour activité', 'warn');
    }
}

// Mettre à jour le statut de connexion dans l'UI
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (connected && !FallbackManager.isActive()) {
            statusElement.className = 'connection-status status-connected';
            statusElement.textContent = '🟢 Connecté';
        } else if (FallbackManager.isActive()) {
            statusElement.className = 'connection-status status-fallback';
            statusElement.textContent = '🟡 Mode Local';
        } else {
            statusElement.className = 'connection-status status-disconnected';
            statusElement.textContent = '🔴 Déconnecté';
        }
    }
    
    // Mettre à jour tous les éléments avec classe connection-indicator
    document.querySelectorAll('.connection-indicator').forEach(el => {
        el.textContent = connected ? 'En ligne' : 'Hors ligne';
        el.className = `connection-indicator ${connected ? 'online' : 'offline'}`;
    });
}

// Nettoyage automatique des rooms
function setupRoomCleanup() {
    if (!window.firebaseState.connected) return;
    
    const cleanupInterval = 30 * 60 * 1000; // 30 minutes
    const roomMaxAge = 2 * 60 * 60 * 1000; // 2 heures
    
    setInterval(async () => {
        try {
            const database = firebase.database();
            const cutoff = Date.now() - roomMaxAge;
            
            const snapshot = await database.ref('rooms')
                .orderByChild('lastActivity')
                .endAt(cutoff)
                .once('value');
                
            const oldRooms = snapshot.val();
            if (oldRooms) {
                const roomIds = Object.keys(oldRooms);
                await Promise.all(
                    roomIds.map(roomId => database.ref(`rooms/${roomId}`).remove())
                );
                console.log(`🧹 ${roomIds.length} rooms inactives supprimées`);
            }
        } catch (error) {
            FirebaseErrorHandler.logError(error, 'Nettoyage rooms', 'warn');
        }
    }, cleanupInterval);
}

// Utilitaires pour les pages
window.FirebaseUtils = {
    // Vérifier si Firebase est prêt
    isReady() {
        return window.firebaseState.initialized && window.firebaseState.authReady;
    },
    
    // Attendre que Firebase soit prêt
    waitForReady() {
        return new Promise((resolve) => {
            if (this.isReady()) {
                resolve();
                return;
            }
            
            const checkReady = () => {
                if (this.isReady()) {
                    resolve();
                } else {
                    setTimeout(checkReady, 100);
                }
            };
            
            checkReady();
        });
    },
    
    // Opération sécurisée avec fallback
    async safeOperation(operation, fallback = null) {
        if (FallbackManager.isActive() && fallback) {
            return fallback();
        }
        
        try {
            return await operation();
        } catch (error) {
            FirebaseErrorHandler.logError(error, 'Opération sécurisée');
            if (fallback) {
                return fallback();
            }
            throw error;
        }
    },
    
    // Obtenir l'état de connexion
    getConnectionState() {
        return {
            ...window.firebaseState,
            errors: FirebaseErrorHandler.getErrorSummary()
        };
    }
};

// Initialiser Firebase quand le DOM est prêt
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeFirebaseAdvanced);
    } else {
        initializeFirebaseAdvanced();
    }
    
    // Gérer la perte de connexion internet
    window.addEventListener('offline', () => {
        console.warn('📱 Connexion internet perdue');
        if (!FallbackManager.isActive()) {
            FallbackManager.enable();
        }
    });
    
    window.addEventListener('online', () => {
        console.log('📱 Connexion internet rétablie');
        // Réinitialiser Firebase si nécessaire
        if (FallbackManager.isActive()) {
            location.reload();
        }
    });
}

console.log('🎰 SIO Casino - Firebase Config Amélioré chargé');