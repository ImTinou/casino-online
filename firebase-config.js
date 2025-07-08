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

// Initialisation Firebase au chargement
try {
    // Initialiser Firebase si pas déjà fait
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialisé avec succès');
    }
} catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
}

// Test de connexion automatique
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        try {
            const database = firebase.database();
            
            // Test de connexion avec un délai pour éviter les messages multiples
            let connectionLogged = false;
            database.ref('.info/connected').on('value', (snapshot) => {
                if (snapshot.val() === true && !connectionLogged) {
                    console.log('✅ Database connectée');
                    connectionLogged = true;
                    updateConnectionStatus(true);
                } else if (!snapshot.val()) {
                    console.log('❌ Database déconnectée');
                    connectionLogged = false;
                    updateConnectionStatus(false);
                }
            });
            
        } catch (error) {
            console.error('❌ Erreur test connexion:', error);
        }
    });
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

// Nettoyage automatique des rooms toutes les 30 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        try {
            const database = firebase.database();
            const cutoff = Date.now() - (2 * 60 * 60 * 1000); // 2 heures
            
            database.ref('rooms').orderByChild('lastActivity').endAt(cutoff).once('value', (snapshot) => {
                const oldRooms = snapshot.val();
                if (oldRooms) {
                    Object.keys(oldRooms).forEach(roomId => {
                        database.ref('rooms/' + roomId).remove();
                    });
                    console.log(`🧹 ${Object.keys(oldRooms).length} rooms inactives supprimées`);
                }
            });
        } catch (error) {
            console.error('Erreur nettoyage rooms:', error);
        }
    }, 30 * 60 * 1000);
}

console.log('🎰 SIO Casino - Firebase Config chargé');