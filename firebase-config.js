// Fichier: firebase-config.js
// Configuration Firebase centralisée pour SIO Casino

// Configuration Firebase (votre vraie configuration)
const firebaseConfig = {
    apiKey: "AIzaSyBlF0Rv-vaLHlopMYNbs7JnLyiqi-HUnn4",
    authDomain: "blackjack-casino-royal.firebaseapp.com",
    databaseURL: "https://blackjack-casino-royal-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "blackjack-casino-royal",
    storageBucket: "blackjack-casino-royal.firebasestorage.app",
    messagingSenderId: "554706185893",
    appId: "1:554706185893:web:847eefcd131c6a929f674c",
    measurementId: "G-8XTRFPR9VQ"
};

// Initialisation Firebase
let app, auth, database;

function initializeFirebase() {
    try {
        // Initialiser Firebase si pas déjà fait
        if (!firebase.apps.length) {
            app = firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase initialisé avec succès');
        } else {
            app = firebase.app();
        }
        
        // Initialiser les services
        auth = firebase.auth();
        database = firebase.database();
        
        // Test de connexion
        database.ref('.info/connected').on('value', (snapshot) => {
            if (snapshot.val() === true) {
                console.log('✅ Database connectée');
                updateConnectionStatus(true);
            } else {
                console.log('❌ Database déconnectée');
                updateConnectionStatus(false);
            }
        });
        
        return { auth, database, app };
        
    } catch (error) {
        console.error('❌ Erreur initialisation Firebase:', error);
        throw error;
    }
}

// Mettre à jour le statut de connexion dans l'UI
function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        if (connected) {
            statusElement.className = 'connection-status status-connected';
            statusElement.textContent = '🟢 Connecté';
        } else {
            statusElement.className = 'connection-status status-disconnected';
            statusElement.textContent = '🔴 Déconnecté';
        }
    }
}

// Gestion des erreurs d'authentification
function handleAuthError(error) {
    console.error('Erreur auth:', error);
    
    let message = 'Une erreur est survenue';
    
    switch (error.code) {
        case 'auth/user-not-found':
            message = 'Aucun compte trouvé avec cet email';
            break;
        case 'auth/wrong-password':
            message = 'Mot de passe incorrect';
            break;
        case 'auth/invalid-email':
            message = 'Format d\'email invalide';
            break;
        case 'auth/email-already-in-use':
            message = 'Cet email est déjà utilisé';
            break;
        case 'auth/weak-password':
            message = 'Mot de passe trop faible';
            break;
        case 'auth/too-many-requests':
            message = 'Trop de tentatives. Réessayez plus tard.';
            break;
        case 'auth/network-request-failed':
            message = 'Erreur de connexion. Vérifiez votre internet.';
            break;
        case 'auth/popup-closed-by-user':
            message = 'Connexion annulée';
            break;
        case 'auth/configuration-not-found':
            message = 'Configuration Firebase invalide';
            break;
        case 'permission-denied':
            message = 'Accès refusé. Vérifiez les règles de sécurité.';
            break;
        default:
            message = error.message || 'Erreur de connexion';
    }
    
    return message;
}

// Utilitaires pour les utilisateurs
const UserUtils = {
    // Créer un profil utilisateur par défaut
    createDefaultProfile: (user, additionalData = {}) => ({
        email: user.email,
        displayName: user.displayName || 'Joueur',
        balance: 1000,
        level: 1,
        experience: 0,
        gamesPlayed: 0,
        totalWinnings: 0,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastLogin: firebase.database.ServerValue.TIMESTAMP,
        ...additionalData
    }),
    
    // Mettre à jour la dernière connexion
    updateLastLogin: async (uid) => {
        if (database) {
            await database.ref(`users/${uid}/lastLogin`).set(firebase.database.ServerValue.TIMESTAMP);
        }
    },
    
    // Mettre à jour la balance
    updateBalance: async (uid, newBalance) => {
        if (database) {
            await database.ref(`users/${uid}/balance`).set(newBalance);
        }
    },
    
    // Ajouter de l'expérience
    addExperience: async (uid, xp) => {
        if (database) {
            const userRef = database.ref(`users/${uid}`);
            const snapshot = await userRef.once('value');
            const userData = snapshot.val();
            
            if (userData) {
                const newXP = (userData.experience || 0) + xp;
                const newLevel = Math.floor(newXP / 100) + 1;
                
                await userRef.update({
                    experience: newXP,
                    level: newLevel
                });
                
                return { newXP, newLevel, levelUp: newLevel > (userData.level || 1) };
            }
        }
        return null;
    }
};

// Utilitaires pour les rooms
const RoomUtils = {
    // Générer un code de room unique
    generateRoomCode: () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    },
    
    // Nettoyer les rooms inactives
    cleanupOldRooms: async () => {
        if (database) {
            const cutoff = Date.now() - (2 * 60 * 60 * 1000); // 2 heures
            const roomsRef = database.ref('rooms');
            
            try {
                const snapshot = await roomsRef.orderByChild('lastActivity').endAt(cutoff).once('value');
                const oldRooms = snapshot.val();
                
                if (oldRooms) {
                    const deletionPromises = Object.keys(oldRooms).map(roomId => 
                        roomsRef.child(roomId).remove()
                    );
                    await Promise.all(deletionPromises);
                    console.log(`🧹 ${Object.keys(oldRooms).length} rooms inactives supprimées`);
                }
            } catch (error) {
                console.error('Erreur nettoyage rooms:', error);
            }
        }
    },
    
    // Créer une room
    createRoom: async (hostUser) => {
        if (!database || !hostUser) return null;
        
        const roomCode = RoomUtils.generateRoomCode();
        const roomData = {
            id: roomCode,
            host: hostUser.uid,
            players: {
                [hostUser.uid]: {
                    id: hostUser.uid,
                    name: hostUser.displayName || 'Joueur',
                    balance: hostUser.balance || 1000,
                    cards: [],
                    bet: 0,
                    score: 0,
                    status: 'waiting',
                    isReady: false,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP
                }
            },
            dealer: { cards: [], score: 0 },
            gamePhase: 'waiting',
            currentPlayerTurn: null,
            deck: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastActivity: firebase.database.ServerValue.TIMESTAMP
        };
        
        try {
            await database.ref(`rooms/${roomCode}`).set(roomData);
            return roomCode;
        } catch (error) {
            console.error('Erreur création room:', error);
            return null;
        }
    }
};

// Utilitaires pour le jeu
const GameUtils = {
    // Créer et mélanger un deck
    createDeck: () => {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];
        
        for (let suit of suits) {
            for (let value of values) {
                deck.push({ suit, value });
            }
        }
        
        // Mélanger (Fisher-Yates)
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        
        return deck;
    },
    
    // Calculer la valeur d'une main
    calculateHandValue: (cards) => {
        let value = 0;
        let aces = 0;

        for (let card of cards) {
            if (card.value === 'A') {
                aces++;
                value += 11;
            } else if (['J', 'Q', 'K'].includes(card.value)) {
                value += 10;
            } else {
                value += parseInt(card.value);
            }
        }

        while (value > 21 && aces > 0) {
            value -= 10;
            aces--;
        }

        return value;
    },
    
    // Enregistrer une partie dans l'historique
    saveGameHistory: async (userId, gameData) => {
        if (!database) return;
        
        const historyRef = database.ref(`gameHistory/${userId}`).push();
        await historyRef.set({
            ...gameData,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
    }
};

// Validation de la configuration
function validateFirebaseConfig() {
    const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId'];
    const missing = requiredFields.filter(field => !firebaseConfig[field]);
    
    if (missing.length > 0) {
        throw new Error(`Configuration Firebase incomplète. Champs manquants: ${missing.join(', ')}`);
    }
    
    return true;
}

// Export global pour utilisation dans les pages HTML
if (typeof window !== 'undefined') {
    window.FirebaseManager = {
        initializeFirebase,
        handleAuthError,
        UserUtils,
        RoomUtils,
        GameUtils,
        validateFirebaseConfig
    };
    
    // Auto-initialisation
    document.addEventListener('DOMContentLoaded', () => {
        try {
            validateFirebaseConfig();
            initializeFirebase();
        } catch (error) {
            console.error('❌ Erreur configuration Firebase:', error);
        }
    });
}

// Nettoyage automatique des rooms toutes les 30 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        RoomUtils.cleanupOldRooms();
    }, 30 * 60 * 1000);
}

console.log('🎰 SIO Casino - Firebase Config chargé');