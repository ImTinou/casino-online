// ========== MAIN CONTROLLER SIO CASINO ========== //

// Variables globales
let firebaseManager;
let gameLogic;
let uiManager;
let currentRoom = null;
let playerName = '';
let isDealer = false;

// ========== INITIALIZATION ========== //
async function initializeSIOCasino() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeSIOCasino);
        return;
    }
    
    console.log("🎰 Initialisation de SIO Casino...");
    
    // Initialiser les managers
    firebaseManager = new FirebaseManager();
    gameLogic = new GameLogic(firebaseManager);
    uiManager = new UIManager();
    
    // Attendre l'initialisation Firebase
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Démarrer les systèmes
    uiManager.createParticles();
    setupEventListeners();
    checkURLForRoom();
    
    // Afficher le statut
    if (firebaseManager.useLocalStorage) {
        console.log("✅ SIO Casino initialisé en mode DEMO");
        uiManager.showNotification('🎮 SIO Casino - Mode DEMO actif', 'info');
    } else {
        console.log("✅ SIO Casino initialisé avec Firebase");
        uiManager.showNotification('🔥 SIO Casino - Multijoueur en ligne!', 'success');
    }
    
    // Exposer globalement pour les handlers HTML
    window.firebaseManager = firebaseManager;
    window.gameLogic = gameLogic;
    window.uiManager = uiManager;
}

// ========== EVENT LISTENERS ========== //
function setupEventListeners() {
    const roomCodeInput = document.getElementById('roomCode');
    const playerNameInput = document.getElementById('playerName');
    
    if (roomCodeInput) {
        roomCodeInput.addEventListener('input', function(e) {
            e.target.value = e.target.value.toUpperCase();
        });
        
        roomCodeInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                joinRoom();
            }
        });
    }

    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                createRoom();
            }
        });
        
        playerNameInput.focus();
    }

    // Gérer la fermeture de page
    window.addEventListener('beforeunload', function() {
        if (currentRoom && playerName) {
            firebaseManager.leaveRoom(currentRoom, playerName);
        }
    });
}

// ========== ROOM MANAGEMENT ========== //
async function createRoom() {
    const nameInput = document.getElementById('playerName');
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        uiManager.showNotification('Veuillez entrer votre nom', 'error');
        return;
    }

    if (name.length > 12) {
        uiManager.showNotification('Le nom ne peut pas dépasser 12 caractères', 'error');
        return;
    }

    uiManager.showNotification('🔄 Création de la table SIO Casino...', 'info');

    playerName = name;
    isDealer = true;
    uiManager.playerName = playerName;
    uiManager.isDealer = isDealer;
    
    currentRoom = await firebaseManager.createRoom(name);
    
    if (currentRoom) {
        uiManager.showNotification('🎰 Table SIO Casino créée!', 'success');
        uiManager.showShareableLink(currentRoom);
        uiManager.showGameInterface(currentRoom);
        setupRoomListener();
        
        // Mettre à jour l'URL
        window.history.pushState({}, '', `?roomid=${currentRoom}`);
    } else {
        uiManager.showNotification('❌ Erreur lors de la création', 'error');
    }
}

function showJoinRoom() {
    uiManager.showJoinRoom();
}

function hideJoinRoom() {
    uiManager.hideJoinRoom();
}

async function joinRoom() {
    const nameInput = document.getElementById('playerName');
    const codeInput = document.getElementById('roomCode');
    
    if (!nameInput || !codeInput) return;
    
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    
    if (!name || !code) {
        uiManager.showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }

    if (name.length > 12) {
        uiManager.showNotification('Le nom ne peut pas dépasser 12 caractères', 'error');
        return;
    }

    if (code.length !== 6) {
        uiManager.showNotification('Le code doit faire 6 caractères', 'error');
        return;
    }

    uiManager.showNotification('🔄 Connexion à SIO Casino...', 'info');

    const success = await firebaseManager.joinRoom(code, name);
    
    if (!success) {
        uiManager.showNotification('❌ Impossible de rejoindre cette table', 'error');
        return;
    }

    playerName = name;
    isDealer = false;
    currentRoom = code;
    uiManager.playerName = playerName;
    uiManager.isDealer = isDealer;
    
    uiManager.showNotification('🎉 Bienvenue à SIO Casino!', 'success');
    uiManager.showGameInterface(currentRoom);
    setupRoomListener();
    
    // Mettre à jour l'URL
    window.history.pushState({}, '', `?roomid=${currentRoom}`);
}

function setupRoomListener() {
    if (currentRoom) {
        firebaseManager.setupRoomListener(currentRoom, (room) => {
            if (room) {
                uiManager.updateGameDisplay(room);
            }
        });
    }
}

async function leaveGame() {
    if (currentRoom && playerName) {
        await firebaseManager.leaveRoom(currentRoom, playerName);
        firebaseManager.removeRoomListener(currentRoom);
    }
    
    // Nettoyer les timers
    gameLogic.clearPlayerTimeout();
    uiManager.clearTimerInterval();
    
    // Retourner au lobby
    const lobby = document.getElementById('lobby');
    const gameInterface = document.getElementById('gameInterface');
    
    if (lobby) lobby.style.display = 'flex';
    if (gameInterface) gameInterface.style.display = 'none';
    
    // Nettoyer l'URL
    window.history.pushState({}, '', window.location.pathname);
    
    // Reset variables
    currentRoom = null;
    playerName = '';
    isDealer = false;
    uiManager.currentRoom = null;
    uiManager.playerName = '';
    uiManager.isDealer = false;
    
    uiManager.showNotification('👋 Vous avez quitté SIO Casino', 'info');
}

// ========== GAME ACTIONS ========== //
async function startNewHand() {
    if (!isDealer || !currentRoom) return;
    
    const success = await gameLogic.startNewHand(currentRoom);
    if (success) {
        uiManager.showNotification('🎴 Nouvelle main SIO Casino!', 'info');
    }
}

async function hit() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameLogic.playerAction(currentRoom, playerName, 'hit');
    if (success) {
        uiManager.showNotification('🃏 Carte tirée!', 'info');
    }
}

async function stand() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameLogic.playerAction(currentRoom, playerName, 'stand');
    if (success) {
        uiManager.showNotification('✋ Vous restez', 'info');
    }
}

async function doubleDown() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameLogic.playerAction(currentRoom, playerName, 'double');
    if (success) {
        uiManager.showNotification('💰 Mise doublée!', 'info');
    }
}

async function splitHand() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameLogic.playerAction(currentRoom, playerName, 'split');
    if (success) {
        uiManager.showNotification('🃏 Mains séparées!', 'info');
    }
}

async function dealerPlay() {
    if (!isDealer || !currentRoom) return;
    
    const success = await gameLogic.dealerPlay(currentRoom);
    if (success) {
        uiManager.showNotification('🎩 Tour du croupier terminé', 'success');
    }
}

// ========== URL MANAGEMENT ========== //
function checkURLForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomid');
    
    if (roomId && roomId.length === 6) {
        const codeInput = document.getElementById('roomCode');
        if (codeInput) {
            codeInput.value = roomId.toUpperCase();
            showJoinRoom();
            
            const nameInput = document.getElementById('playerName');
            if (nameInput && !nameInput.value.trim()) {
                nameInput.focus();
            }
        }
        
        uiManager.showNotification('🎯 Code SIO Casino détecté!', 'info');
    }
}

// ========== GLOBAL FUNCTIONS FOR HTML ========== //
// Ces fonctions sont accessibles depuis le HTML
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.showJoinRoom = showJoinRoom;
window.hideJoinRoom = hideJoinRoom;
window.leaveGame = leaveGame;
window.startNewHand = startNewHand;
window.hit = hit;
window.stand = stand;
window.doubleDown = doubleDown;
window.splitHand = splitHand;
window.dealerPlay = dealerPlay;

// Fonctions utilitaires pour les popups
window.copyToClipboard = (text) => uiManager.copyToClipboard(text);
window.downloadHTML = () => uiManager.downloadHTML();

// ========== AUTO-START ========== //
// Démarrer automatiquement SIO Casino
initializeSIOCasino();