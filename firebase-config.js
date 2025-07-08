// Fichier: firebase-config.js
// Configuration Firebase centralisée pour SIO Casino

// Configuration Firebase
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

// Initialisation Firebase sécurisée
try {
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialisé avec succès');
        
        // Vérifier la connexion à la base de données
        const database = firebase.database();
        database.ref('.info/connected').on('value', (snapshot) => {
            const connected = snapshot.val();
            if (connected) {
                console.log('✅ Database connectée');
            } else {
                console.log('❌ Database déconnectée');
            }
            updateConnectionStatus(connected);
        });
        
    } else if (firebase.apps.length > 0) {
        console.log('ℹ️ Firebase déjà initialisé');
    }
} catch (error) {
    console.error('❌ Erreur initialisation Firebase:', error);
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
function setupRoomCleanup() {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
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
}

// Initialiser le nettoyage une fois que la page est chargée
if (typeof window !== 'undefined') {
    window.addEventListener('load', setupRoomCleanup);
}

console.log('🎰 SIO Casino - Firebase Config chargé');