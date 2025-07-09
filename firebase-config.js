// Fichier: firebase-config.js
// Configuration Firebase centralisée pour SIO Casino
// Version complète avec gestion d'erreurs et fallbacks

console.log('🔥 Chargement firebase-config.js...');

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

// Configuration Firebase
const firebaseConfig = window.firebaseConfig;

// État global Firebase
window.firebaseState = {
    initialized: false,
    connected: false,
    authReady: false,
    retryCount: 0,
    maxRetries: 3,
    fallbackMode: false,
    lastError: null
};

// Gestionnaire d'erreurs Firebase
class FirebaseManager {
    static logError(error, context = 'Firebase') {
        const timestamp = new Date().toISOString();
        const errorMsg = `[${context}] ${timestamp}: ${error.message || error}`;
        
        console.error(errorMsg);
        
        // Stocker l'erreur
        window.firebaseState.lastError = {
            timestamp,
            context,
            message: error.message || error,
            code: error.code
        };
        
        // Notifier l'interface si possible
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('firebaseError', { 
                detail: { error, context } 
            }));
        }
    }
    
    static async waitForFirebaseSDK(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkFirebase = () => {
                if (typeof firebase !== 'undefined') {
                    resolve(true);
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout: Firebase SDK non chargé'));
                    return;
                }
                
                setTimeout(checkFirebase, 100);
            };
            
            checkFirebase();
        });
    }
    
    static enableFallbackMode() {
        console.warn('🔄 Mode fallback Firebase activé');
        window.firebaseState.fallbackMode = true;
        
        // Créer un simulateur Firebase simple
        window.firebase = {
            apps: [{ name: 'fallback-app' }],
            database: () => ({
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
                        const data = localStorage.getItem(`fb_${path}`);
                        setTimeout(() => callback({ val: () => data ? JSON.parse(data) : null }), 100);
                        return { off: () => {} };
                    },
                    off: () => {},
                    update: (data) => {
                        const current = JSON.parse(localStorage.getItem(`fb_${path}`) || '{}');
                        localStorage.setItem(`fb_${path}`, JSON.stringify({ ...current, ...data }));
                        return Promise.resolve();
                    },
                    remove: () => {
                        localStorage.removeItem(`fb_${path}`);
                        return Promise.resolve();
                    }
                }),
                ServerValue: { TIMESTAMP: Date.now() }
            }),
            auth: () => ({
                currentUser: JSON.parse(sessionStorage.getItem('fallbackUser') || 'null'),
                onAuthStateChanged: (callback) => {
                    const user = JSON.parse(sessionStorage.getItem('fallbackUser') || 'null');
                    setTimeout(() => callback(user), 100);
                },
                signInWithEmailAndPassword: (email, password) => {
                    const user = {
                        uid: 'fallback_' + Date.now(),
                        email: email,
                        displayName: email.split('@')[0]
                    };
                    sessionStorage.setItem('fallbackUser', JSON.stringify(user));
                    return Promise.resolve({ user });
                },
                createUserWithEmailAndPassword: (email, password) => {
                    const user = {
                        uid: 'fallback_' + Date.now(),
                        email: email,
                        displayName: email.split('@')[0]
                    };
                    sessionStorage.setItem('fallbackUser', JSON.stringify(user));
                    return Promise.resolve({ user });
                },
                signOut: () => {
                    sessionStorage.removeItem('fallbackUser');
                    return Promise.resolve();
                },
                setPersistence: () => Promise.resolve(),
                Auth: {
                    Persistence: {
                        LOCAL: 'local',
                        SESSION: 'session'
                    }
                }
            })
        };
        
        // Créer un utilisateur de base
        if (!sessionStorage.getItem('fallbackUser')) {
            const fallbackUser = {
                uid: 'fallback_' + Date.now(),
                email: 'local@fallback.com',
                displayName: 'Utilisateur Local'
            };
            sessionStorage.setItem('fallbackUser', JSON.stringify(fallbackUser));
        }
        
        window.firebaseState.initialized = true;
        window.firebaseState.connected = true;
        window.firebaseState.authReady = true;
        
        this.showFallbackNotification();
    }
    
    static showFallbackNotification() {
        if (typeof document === 'undefined') return;
        
        const notification = document.createElement('div');
        notification.id = 'fallback-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(255, 170, 0, 0.95);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">⚠️</span>
                <div>
                    <div style="font-weight: bold; margin-bottom: 5px;">Mode Hors Ligne</div>
                    <div style="opacity: 0.9; font-size: 12px;">
                        Connexion Firebase limitée.<br>
                        Fonctionnalités réduites.
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0 5px;">×</button>
            </div>
        `;
        
        // Ajouter le CSS de l'animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Auto-suppression après 10 secondes
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 10000);
    }
}

// Initialisation Firebase sécurisée avec retry
async function initializeFirebaseSecure() {
    console.log('🔥 Initialisation Firebase...');
    
    try {
        // Attendre que Firebase SDK soit chargé
        await FirebaseManager.waitForFirebaseSDK();
        
        // Vérifier si Firebase est déjà initialisé
        if (firebase.apps.length > 0) {
            console.log('ℹ️ Firebase déjà initialisé');
            window.firebaseState.initialized = true;
            setupFirebaseListeners();
            return;
        }
        
        // Initialiser Firebase
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialisé avec succès');
        
        window.firebaseState.initialized = true;
        window.firebaseState.retryCount = 0;
        
        // Configurer les écouteurs
        setupFirebaseListeners();
        
        // Configurer l'authentification
        setupAuthListeners();
        
        // Nettoyage automatique des rooms
        setupRoomCleanup();
        
        // Événement personnalisé
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('firebaseInitialized'));
        }
        
    } catch (error) {
        FirebaseManager.logError(error, 'Initialisation');
        
        // Retry avec délai exponentiel
        if (window.firebaseState.retryCount < window.firebaseState.maxRetries) {
            window.firebaseState.retryCount++;
            const delay = Math.pow(2, window.firebaseState.retryCount) * 1000;
            console.log(`🔄 Retry initialisation dans ${delay}ms (${window.firebaseState.retryCount}/${window.firebaseState.maxRetries})`);
            setTimeout(initializeFirebaseSecure, delay);
        } else {
            console.error('❌ Échec initialisation Firebase après plusieurs tentatives');
            FirebaseManager.enableFallbackMode();
        }
    }
}

// Configuration des écouteurs Firebase
function setupFirebaseListeners() {
    if (!firebase.apps.length) return;
    
    const database = firebase.database();
    
    // Vérifier la connexion à la base de données
    database.ref('.info/connected').on('value', (snapshot) => {
        const connected = snapshot.val();
        window.firebaseState.connected = connected;
        
        if (connected) {
            console.log('✅ Database connectée');
            window.firebaseState.retryCount = 0;
        } else {
            console.log('❌ Database déconnectée');
        }
        
        updateConnectionStatus(connected);
        
        // Émettre événement
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('firebaseConnectionChanged', { 
                detail: { connected } 
            }));
        }
    });
    
    // Gestion des erreurs de permissions
    database.ref('.info/connected').on('value', () => {}, (error) => {
        if (error.code === 'PERMISSION_DENIED') {
            FirebaseManager.logError(error, 'Permissions Database');
            console.warn('⚠️ Permissions limitées - Vérifiez les règles Firebase');
        }
    });
}

// Configuration de l'authentification
function setupAuthListeners() {
    if (!firebase.apps.length) return;
    
    const auth = firebase.auth();
    
    // Configurer la persistance
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error => {
        FirebaseManager.logError(error, 'Persistance Auth');
    });
    
    // Écouter les changements d'état d'authentification
    auth.onAuthStateChanged((user) => {
        window.firebaseState.authReady = true;
        
        if (user) {
            console.log('✅ Utilisateur connecté:', user.displayName || user.email);
            
            // Mettre à jour l'activité utilisateur
            updateUserActivity(user.uid);
        } else {
            console.log('ℹ️ Aucun utilisateur connecté');
        }
        
        // Émettre événement
        if (typeof window !== 'undefined' && window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('authStateChanged', { 
                detail: { user, isReady: true } 
            }));
        }
    });
}

// Mettre à jour l'activité utilisateur
async function updateUserActivity(uid) {
    if (!window.firebaseState.connected) return;
    
    try {
        await firebase.database()
            .ref(`users/${uid}/lastActivity`)
            .set(firebase.database.ServerValue.TIMESTAMP);
    } catch (error) {
        FirebaseManager.logError(error, 'Mise à jour activité');
    }
}

// Mettre à jour le statut de connexion dans l'UI
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (connected && !window.firebaseState.fallbackMode) {
            statusElement.className = 'connection-status status-connected';
            statusElement.textContent = '🟢 Connecté';
        } else if (window.firebaseState.fallbackMode) {
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
    if (!window.firebaseState.connected || window.firebaseState.fallbackMode) return;
    
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
            FirebaseManager.logError(error, 'Nettoyage rooms');
        }
    }, cleanupInterval);
}

// Utilitaires Firebase
window.FirebaseUtils = {
    // Vérifier si Firebase est prêt
    isReady() {
        return window.firebaseState.initialized && window.firebaseState.authReady;
    },
    
    // Attendre que Firebase soit prêt
    waitForReady(timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            const checkReady = () => {
                if (this.isReady()) {
                    resolve();
                    return;
                }
                
                if (Date.now() - startTime > timeout) {
                    reject(new Error('Timeout: Firebase non prêt'));
                    return;
                }
                
                setTimeout(checkReady, 100);
            };
            
            checkReady();
        });
    },
    
    // Opération sécurisée avec fallback
    async safeOperation(operation, fallback = null) {
        if (window.firebaseState.fallbackMode && fallback) {
            return fallback();
        }
        
        try {
            return await operation();
        } catch (error) {
            FirebaseManager.logError(error, 'Opération sécurisée');
            if (fallback) {
                return fallback();
            }
            throw error;
        }
    },
    
    // Obtenir l'état Firebase
    getState() {
        return {
            ...window.firebaseState,
            hasUser: firebase.auth && firebase.auth().currentUser !== null
        };
    },
    
    // Forcer le mode fallback
    enableFallback() {
        FirebaseManager.enableFallbackMode();
    },
    
    // Tester la connexion Firebase
    async testConnection() {
        if (window.firebaseState.fallbackMode) {
            return { status: 'fallback', message: 'Mode fallback actif' };
        }
        
        try {
            const snapshot = await firebase.database().ref('.info/connected').once('value');
            const connected = snapshot.val();
            return { 
                status: connected ? 'connected' : 'disconnected',
                message: connected ? 'Connexion OK' : 'Connexion échouée'
            };
        } catch (error) {
            return { 
                status: 'error',
                message: error.message
            };
        }
    }
};

// Gestion des événements de réseau
if (typeof window !== 'undefined') {
    window.addEventListener('offline', () => {
        console.warn('📱 Connexion internet perdue');
        if (!window.firebaseState.fallbackMode) {
            FirebaseManager.enableFallbackMode();
        }
    });
    
    window.addEventListener('online', () => {
        console.log('📱 Connexion internet rétablie');
        if (window.firebaseState.fallbackMode) {
            window.firebaseState.retryCount = 0;
            setTimeout(() => {
                location.reload();
            }, 2000);
        }
    });
}

// Initialisation automatique
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initializeFirebaseSecure, 100);
        });
    } else {
        setTimeout(initializeFirebaseSecure, 100);
    }
}
// CORRECTIF IMMÉDIAT - À ajouter à la fin de firebase-config.js

// Protection contre les appels Firebase prématurés
(function() {
    console.log('🛡️ Activation de la protection Firebase...');
    
    // Sauvegarder le Firebase original
    let originalFirebase = window.firebase;
    
    // Créer un proxy Firebase qui attend l'initialisation
    const firebaseProxy = {
        get apps() {
            if (originalFirebase && originalFirebase.apps) {
                return originalFirebase.apps;
            }
            return [];
        },
        
        auth() {
            if (originalFirebase && originalFirebase.apps && originalFirebase.apps.length > 0) {
                return originalFirebase.auth();
            }
            
            // Attendre l'initialisation
            return new Promise((resolve, reject) => {
                const maxWait = 10000;
                const startTime = Date.now();
                
                const checkAuth = () => {
                    if (originalFirebase && originalFirebase.apps && originalFirebase.apps.length > 0) {
                        resolve(originalFirebase.auth());
                    } else if (Date.now() - startTime > maxWait) {
                        reject(new Error('Firebase auth timeout'));
                    } else {
                        setTimeout(checkAuth, 100);
                    }
                };
                
                checkAuth();
            });
        },
        
        database() {
            if (originalFirebase && originalFirebase.apps && originalFirebase.apps.length > 0) {
                return originalFirebase.database();
            }
            
            // Attendre l'initialisation
            return new Promise((resolve, reject) => {
                const maxWait = 10000;
                const startTime = Date.now();
                
                const checkDatabase = () => {
                    if (originalFirebase && originalFirebase.apps && originalFirebase.apps.length > 0) {
                        resolve(originalFirebase.database());
                    } else if (Date.now() - startTime > maxWait) {
                        reject(new Error('Firebase database timeout'));
                    } else {
                        setTimeout(checkDatabase, 100);
                    }
                };
                
                checkDatabase();
            });
        }
    };
    
    // Remplacer Firebase par le proxy temporairement
    window.firebase = firebaseProxy;
    
    // Restaurer Firebase une fois initialisé
    function restoreFirebase() {
        if (originalFirebase && originalFirebase.apps && originalFirebase.apps.length > 0) {
            window.firebase = originalFirebase;
            console.log('✅ Firebase restauré après initialisation');
            return true;
        }
        return false;
    }
    
    // Vérifier périodiquement si Firebase est prêt
    const checkInterval = setInterval(() => {
        if (restoreFirebase()) {
            clearInterval(checkInterval);
        }
    }, 100);
    
    // Nettoyer après 15 secondes maximum
    setTimeout(() => {
        clearInterval(checkInterval);
        if (window.firebase === firebaseProxy) {
            console.warn('⚠️ Timeout protection Firebase, restauration forcée');
            window.firebase = originalFirebase;
        }
    }, 15000);
    
    console.log('✅ Protection Firebase activée');
})();

// Fonction helper pour les autres fichiers
window.waitForFirebase = async function() {
    const maxWait = 10000; // 10 secondes
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
                resolve();
            } else if (Date.now() - startTime > maxWait) {
                reject(new Error('Firebase timeout'));
            } else {
                setTimeout(checkFirebase, 100);
            }
        };
        
        checkFirebase();
    });
};

// Auto-correction pour les fichiers existants
window.addEventListener('load', () => {
    setTimeout(() => {
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            console.log('🔧 Auto-correction Firebase...');
            
            // Réinitialiser les listeners qui ont pu échouer
            if (typeof database !== 'undefined' && database) {
                try {
                    database.ref('.info/connected').on('value', (snapshot) => {
                        console.log('📡 Connexion Firebase:', snapshot.val() ? 'OK' : 'KO');
                    });
                } catch (error) {
                    console.warn('⚠️ Erreur listener connexion:', error.message);
                }
            }
            
            if (typeof auth !== 'undefined' && auth) {
                try {
                    auth.onAuthStateChanged((user) => {
                        console.log('👤 État auth:', user ? 'Connecté' : 'Déconnecté');
                    });
                } catch (error) {
                    console.warn('⚠️ Erreur listener auth:', error.message);
                }
            }
        }
    }, 2000);
});

console.log('🎰 Correctif Firebase appliqué - Rechargez maintenant votre page');

// Exports globaux
window.initializeFirebaseSecure = initializeFirebaseSecure;
window.FirebaseManager = FirebaseManager;

console.log('🎰 SIO Casino - Firebase Config Complet chargé');