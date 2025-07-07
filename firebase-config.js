// ========== CONFIGURATION FIREBASE ==========

// 🔥 Configuration Firebase pour Casino Royal
// IMPORTANT : Remplacez par votre vraie configuration Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBlF0Rv-vaLHlopMYNbs7JnLyiqi-HUnn4",
    authDomain: "blackjack-casino-royal.firebaseapp.com", 
    databaseURL: "https://blackjack-casino-royal-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "blackjack-casino-royal",
    storageBucket: "blackjack-casino-royal.firebasestorage.app",
    messagingSenderId: "554706185893",
    appId: "1:554706185893:web:847eefcd131c6a929f674c"
};

// Variables globales pour Firebase
let database = null;
let isFirebaseInitialized = false;

// Détection de l'environnement
function detectEnvironment() {
    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
    const isClaudeArtifact = hostname.includes('claudeusercontent.com') || hostname.includes('claude.ai');
    const isGitHubPages = hostname.includes('github.io');
    const isNetlify = hostname.includes('netlify.app');
    const isVercel = hostname.includes('vercel.app');
    
    return {
        isLocalhost,
        isClaudeArtifact,
        isGitHubPages,
        isNetlify,
        isVercel,
        canUseFirebase: !isClaudeArtifact // Firebase fonctionne partout sauf sur Claude.ai
    };
}

// Initialisation Firebase intelligente
async function initializeFirebase() {
    const env = detectEnvironment();
    
    console.log('🌍 Environnement détecté:', {
        hostname: window.location.hostname,
        canUseFirebase: env.canUseFirebase
    });
    
    if (!env.canUseFirebase) {
        console.log('📱 Mode DEMO activé (localStorage)');
        console.log('ℹ️ Pour le multijoueur en ligne, hébergez ce code sur votre serveur');
        return false;
    }
    
    try {
        // Vérifier si Firebase est disponible
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK non chargé');
            return false;
        }
        
        // Initialiser Firebase
        firebase.initializeApp(firebaseConfig);
        database = firebase.database();
        
        // Test de connexion
        const testRef = database.ref('.info/connected');
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Timeout'));
            }, 5000);
            
            testRef.once('value', (snapshot) => {
                clearTimeout(timeout);
                if (snapshot.val() === true) {
                    resolve();
                } else {
                    reject(new Error('Not connected'));
                }
            }, reject);
        });
        
        console.log('🔥 Firebase connecté avec succès!');
        console.log('✅ Base de données en ligne active');
        isFirebaseInitialized = true;
        return true;
        
    } catch (error) {
        console.warn('⚠️ Erreur Firebase:', error.message);
        console.log('🔄 Fallback vers localStorage');
        database = null;
        isFirebaseInitialized = false;
        return false;
    }
}

// Wrapper pour les opérations de base de données
class DatabaseWrapper {
    constructor() {
        this.useFirebase = false;
        this.init();
    }
    
    async init() {
        this.useFirebase = await initializeFirebase();
    }
    
    // Lecture d'une room
    async getRoom(roomCode) {
        try {
            if (this.useFirebase && database) {
                const snapshot = await database.ref(`rooms/${roomCode}`).once('value');
                return snapshot.val();
            } else {
                const data = localStorage.getItem(`blackjack_room_${roomCode}`);
                return data ? JSON.parse(data) : null;
            }
        } catch (error) {
            console.error('Erreur lecture room:', error);
            return null;
        }
    }
    
    // Écriture d'une room
    async setRoom(roomCode, data) {
        try {
            data.lastUpdate = Date.now();
            
            if (this.useFirebase && database) {
                await database.ref(`rooms/${roomCode}`).set(data);
                return true;
            } else {
                localStorage.setItem(`blackjack_room_${roomCode}`, JSON.stringify(data));
                return true;
            }
        } catch (error) {
            console.error('Erreur écriture room:', error);
            return false;
        }
    }
    
    // Suppression d'une room
    async removeRoom(roomCode) {
        try {
            if (this.useFirebase && database) {
                await database.ref(`rooms/${roomCode}`).remove();
            } else {
                localStorage.removeItem(`blackjack_room_${roomCode}`);
            }
            return true;
        } catch (error) {
            console.error('Erreur suppression room:', error);
            return false;
        }
    }
    
    // Listener pour les changements
    onRoomChange(roomCode, callback) {
        if (this.useFirebase && database) {
            // Listener Firebase temps réel
            const ref = database.ref(`rooms/${roomCode}`);
            ref.on('value', (snapshot) => {
                callback(snapshot.val());
            });
            
            return () => ref.off();
        } else {
            // Polling pour localStorage
            const pollInterval = setInterval(async () => {
                const room = await this.getRoom(roomCode);
                callback(room);
            }, 500);
            
            return () => clearInterval(pollInterval);
        }
    }
    
    // Nettoyage des anciennes rooms (utile pour localStorage)
    cleanupOldRooms() {
        if (!this.useFirebase) {
            const keys = Object.keys(localStorage);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 heures
            
            keys.forEach(key => {
                if (key.startsWith('blackjack_room_')) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data && data.lastUpdate && (now - data.lastUpdate) > maxAge) {
                            localStorage.removeItem(key);
                            console.log(`🧹 Room supprimée: ${key}`);
                        }
                    } catch (e) {
                        // Données corrompues, supprimer
                        localStorage.removeItem(key);
                    }
                }
            });
        }
    }
    
    // Statistiques de connexion
    getConnectionInfo() {
        return {
            useFirebase: this.useFirebase,
            isInitialized: isFirebaseInitialized,
            environment: detectEnvironment(),
            database: database ? 'Active' : 'Inactive'
        };
    }
}

// Instance globale
window.dbWrapper = new DatabaseWrapper();

// Nettoyage automatique au démarrage
setTimeout(() => {
    window.dbWrapper.cleanupOldRooms();
}, 1000);

// Export des configurations pour debug
window.firebaseConfig = firebaseConfig;
window.detectEnvironment = detectEnvironment;