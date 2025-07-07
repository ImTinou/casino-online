// ========== BLACKJACK CASINO ROYAL - GAME ENGINE ==========

// Variables globales du jeu
let gameServer;
let currentRoom = null;
let playerName = '';
let isDealer = false;
let roomListener = null;
let animationQueue = [];
let isAnimating = false;

// Configuration du jeu
const GAME_CONFIG = {
    maxPlayers: 5,
    roomCodeLength: 6,
    dealerStandValue: 17,
    blackjackValue: 21,
    cardAnimationDuration: 1000,
    autoCleanupTime: 30 * 60 * 1000 // 30 minutes
};

// ========== CLASSE PRINCIPALE DU JEU ==========
class BlackjackGameServer {
    constructor() {
        this.db = window.dbWrapper;
        this.initComplete = false;
        this.init();
    }

    async init() {
        // Attendre que la base de données soit initialisée
        await new Promise(resolve => {
            const checkDB = () => {
                if (this.db.useFirebase !== undefined) {
                    resolve();
                } else {
                    setTimeout(checkDB, 100);
                }
            };
            checkDB();
        });
        
        this.initComplete = true;
        console.log('🎮 GameServer initialisé');
    }

    // Génération d'un code de room aléatoire
    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < GAME_CONFIG.roomCodeLength; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Création d'une nouvelle room
    async createRoom(dealerName) {
        const code = this.generateRoomCode();
        const room = {
            code: code,
            dealer: dealerName,
            players: [],
            gameState: 'waiting', // waiting, dealing, playing, dealer_turn, dealer_playing, finished
            deck: this.createDeck(),
            dealerCards: [],
            dealerScore: 0,
            currentPlayerIndex: 0,
            handNumber: 0,
            created: Date.now(),
            lastUpdate: Date.now(),
            settings: {
                autoAdvance: true,
                showCards: true,
                dealerSpeed: 1000
            }
        };
        
        const success = await this.db.setRoom(code, room);
        if (success) {
            console.log(`✅ Room ${code} créée par ${dealerName}`);
            window.history.pushState({}, '', `?roomid=${code}`);
            return code;
        }
        
        console.error(`❌ Échec création room ${code}`);
        return null;
    }

    // Rejoindre une room existante
    async joinRoom(code, playerName) {
        try {
            const room = await this.db.getRoom(code);
            
            if (!room) {
                console.log(`❌ Room ${code} inexistante`);
                return { success: false, reason: 'Room inexistante' };
            }
            
            // CORRECTION : Réparer automatiquement la room si nécessaire
            await this.repairRoom(code);
            
            // Recharger la room après réparation
            const repairedRoom = await this.db.getRoom(code);
            if (!repairedRoom) {
                return { success: false, reason: 'Erreur de réparation' };
            }
            
            // Vérifications de sécurité (maintenant garanties après réparation)
            if (repairedRoom.players.find(p => p && p.name === playerName)) {
                return { success: false, reason: 'Nom déjà pris' };
            }
            
            if (repairedRoom.players.length >= GAME_CONFIG.maxPlayers) {
                return { success: false, reason: 'Table pleine' };
            }

            // Ajouter le joueur
            const newPlayer = {
                name: playerName,
                cards: [],
                score: 0,
                status: 'waiting', // waiting, playing, stand, bust
                isActive: false,
                position: repairedRoom.players.length + 1,
                joinedAt: Date.now(),
                handsPlayed: 0,
                handsWon: 0
            };

            repairedRoom.players.push(newPlayer);
            repairedRoom.lastUpdate = Date.now();
            
            const success = await this.db.setRoom(code, repairedRoom);
            if (success) {
                console.log(`✅ ${playerName} a rejoint ${code} (room réparée)`);
                window.history.pushState({}, '', `?roomid=${code}`);
                return { success: true };
            }
            
            return { success: false, reason: 'Erreur technique' };
        } catch (error) {
            console.error(`❌ Erreur rejoindre room ${code}:`, error);
            return { success: false, reason: 'Erreur de connexion' };
        }
    }

    // Quitter une room
    async leaveRoom(code, playerName) {
        try {
            const room = await this.db.getRoom(code);
            if (!room) return false;

            // CORRECTION : Vérifier et initialiser players
            if (!room.players || !Array.isArray(room.players)) {
                room.players = [];
                console.log(`🔧 Initialisation de room.players lors du leave pour ${code}`);
            }
            
            // Retirer le joueur (avec vérification de sécurité)
            room.players = room.players.filter(p => p && p.name !== playerName);
            
            if (room.players.length === 0) {
                // Supprimer la room si vide
                await this.db.removeRoom(code);
                console.log(`🗑️ Room ${code} supprimée (vide)`);
            } else {
                // Réorganiser les positions
                room.players.forEach((player, index) => {
                    if (player) {
                        player.position = index + 1;
                    }
                });
                
                // Si c'était le joueur actif, passer au suivant
                if (room.gameState === 'playing') {
                    this.checkAndAdvancePlayer(room);
                }
                
                await this.db.setRoom(code, room);
                console.log(`👋 ${playerName} a quitté ${code}`);
            }
            
            return true;
        } catch (error) {
            console.error(`❌ Erreur quitter room ${code}:`, error);
            return false;
        }
    }

    // Créer et mélanger un deck de cartes
    createDeck() {
        const suits = ['♠', '♥', '♦', '♣'];
        const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
        const deck = [];

        for (let suit of suits) {
            for (let value of values) {
                deck.push({
                    suit: suit,
                    value: value,
                    numValue: this.getCardValue(value),
                    isRed: suit === '♥' || suit === '♦',
                    id: `${suit}-${value}-${Date.now()}-${Math.random()}`
                });
            }
        }

        return this.shuffleDeck(deck);
    }

    // Mélanger le deck
    shuffleDeck(deck) {
        const shuffled = [...deck];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // Obtenir la valeur numérique d'une carte
    getCardValue(value) {
        if (value === 'A') return 1; // L'As sera géré dans calculateScore
        if (['J', 'Q', 'K'].includes(value)) return 10;
        return parseInt(value);
    }

    // Calculer le score d'une main
    calculateScore(cards) {
        if (!cards || cards.length === 0) return 0;
        
        let score = 0;
        let aces = 0;

        // Compter les cartes normales et les As
        for (let card of cards) {
            if (card.value === 'A') {
                aces++;
                score += 11; // Compter l'As comme 11 initialement
            } else {
                score += card.numValue;
            }
        }

        // Ajuster la valeur des As si nécessaire
        while (score > GAME_CONFIG.blackjackValue && aces > 0) {
            score -= 10; // Transformer un As de 11 à 1
            aces--;
        }

        return score;
    }

    // Distribuer une carte
    async dealCard(roomCode, target) {
        const room = await this.db.getRoom(roomCode);
        if (!room || !room.deck || room.deck.length === 0) return null;

        const card = room.deck.pop();
        
        if (target === 'dealer') {
            if (!room.dealerCards) room.dealerCards = [];
            room.dealerCards.push(card);
            room.dealerScore = this.calculateScore(room.dealerCards);
        } else if (typeof target === 'number') {
            const player = room.players[target];
            if (player) {
                if (!player.cards) player.cards = [];
                player.cards.push(card);
                player.score = this.calculateScore(player.cards);
            }
        }

        await this.db.setRoom(roomCode, room);
        console.log(`🃏 Carte distribuée à ${target === 'dealer' ? 'croupier' : `joueur ${target}`}:`, card);
        return card;
    }

    // Démarrer une nouvelle main
    async startNewHand(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room) return false;

        if (!room.players) room.players = [];
        
        // Reset des données de la main
        room.players.forEach(player => {
            player.cards = [];
            player.score = 0;
            player.status = 'playing';
            player.isActive = false;
            delete player.result;
            player.handsPlayed++;
        });

        room.dealerCards = [];
        room.dealerScore = 0;
        room.deck = this.createDeck();
        room.currentPlayerIndex = 0;
        room.gameState = 'dealing';
        room.handNumber++;

        await this.db.setRoom(roomCode, room);
        console.log(`🎴 Nouvelle main #${room.handNumber} démarrée`);

        // Distribuer les cartes avec animation
        setTimeout(() => {
            this.distributeInitialCards(roomCode);
        }, 500);

        return true;
    }

    // Distribution initiale des cartes (2 par joueur + croupier)
    async distributeInitialCards(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room || !room.players) return;

        // Distribuer 2 cartes à chaque joueur et au croupier
        for (let round = 0; round < 2; round++) {
            // D'abord aux joueurs
            for (let index = 0; index < room.players.length; index++) {
                await this.dealCard(roomCode, index);
                await new Promise(resolve => setTimeout(resolve, 300)); // Délai pour l'animation
            }
            
            // Puis au croupier
            await this.dealCard(roomCode, 'dealer');
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Activer le premier joueur
        const updatedRoom = await this.db.getRoom(roomCode);
        if (updatedRoom.players && updatedRoom.players.length > 0) {
            updatedRoom.players[0].isActive = true;
            updatedRoom.gameState = 'playing';
            await this.db.setRoom(roomCode, updatedRoom);
            console.log(`▶️ ${updatedRoom.players[0].name} commence à jouer`);
        }
    }

    // Action d'un joueur (hit ou stand)
    async playerAction(roomCode, playerName, action) {
        const room = await this.db.getRoom(roomCode);
        if (!room || !room.players) return false;

        const playerIndex = room.players.findIndex(p => p.name === playerName);
        const player = room.players[playerIndex];
        
        if (!player || !player.isActive || room.gameState !== 'playing') {
            console.log(`❌ Action refusée pour ${playerName}:`, { active: player?.isActive, gameState: room.gameState });
            return false;
        }

        if (action === 'hit') {
            await this.dealCard(roomCode, playerIndex);
            const updatedRoom = await this.db.getRoom(roomCode);
            const updatedPlayer = updatedRoom.players[playerIndex];
            
            if (updatedPlayer.score > GAME_CONFIG.blackjackValue) {
                updatedPlayer.status = 'bust';
                console.log(`💥 ${playerName} fait bust avec ${updatedPlayer.score}`);
                await this.nextPlayer(roomCode);
            } else if (updatedPlayer.score === GAME_CONFIG.blackjackValue) {
                updatedPlayer.status = 'stand';
                console.log(`🎯 ${playerName} fait 21!`);
                await this.nextPlayer(roomCode);
            } else {
                await this.db.setRoom(roomCode, updatedRoom);
                console.log(`🃏 ${playerName} tire une carte (score: ${updatedPlayer.score})`);
            }
        } else if (action === 'stand') {
            player.status = 'stand';
            await this.db.setRoom(roomCode, room);
            console.log(`✋ ${playerName} reste avec ${player.score}`);
            await this.nextPlayer(roomCode);
        }

        return true;
    }

    // Passer au joueur suivant
    async nextPlayer(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room || !room.players) return;

        // Désactiver le joueur actuel
        if (room.players[room.currentPlayerIndex]) {
            room.players[room.currentPlayerIndex].isActive = false;
        }

        // Chercher le prochain joueur actif
        let nextIndex = room.currentPlayerIndex + 1;
        while (nextIndex < room.players.length) {
            const nextPlayer = room.players[nextIndex];
            if (nextPlayer && nextPlayer.status === 'playing') {
                nextPlayer.isActive = true;
                room.currentPlayerIndex = nextIndex;
                await this.db.setRoom(roomCode, room);
                console.log(`▶️ Tour de ${nextPlayer.name}`);
                return;
            }
            nextIndex++;
        }

        // Plus de joueurs → tour du croupier
        room.gameState = 'dealer_turn';
        await this.db.setRoom(roomCode, room);
        console.log(`🎩 Tour du croupier`);
    }

    // Logique du croupier
    async dealerPlay(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room) return false;

        room.gameState = 'dealer_playing';
        await this.db.setRoom(roomCode, room);
        console.log(`🎲 Croupier joue...`);
        
        // Le croupier tire des cartes jusqu'à 17 ou plus
        const dealerPlayLoop = async () => {
            const currentRoom = await this.db.getRoom(roomCode);
            
            if (currentRoom.dealerScore < GAME_CONFIG.dealerStandValue) {
                await this.dealCard(roomCode, 'dealer');
                console.log(`🃏 Croupier tire (score: ${currentRoom.dealerScore})`);
                
                // Continuer après un délai
                setTimeout(dealerPlayLoop, currentRoom.settings?.dealerSpeed || 1000);
            } else {
                console.log(`✋ Croupier s'arrête à ${currentRoom.dealerScore}`);
                await this.finishGame(roomCode);
            }
        };

        setTimeout(dealerPlayLoop, 500);
        return true;
    }

    // Terminer la partie et déterminer les gagnants
    async finishGame(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room || !room.players) return;

        console.log(`🏁 Fin de partie - Croupier: ${room.dealerScore}`);

        // Déterminer les résultats
        room.players.forEach(player => {
            if (player.status === 'bust') {
                player.result = 'lose';
            } else if (room.dealerScore > GAME_CONFIG.blackjackValue) {
                player.result = 'win';
                player.handsWon++;
            } else if (player.score > room.dealerScore) {
                player.result = 'win';
                player.handsWon++;
            } else if (player.score === room.dealerScore) {
                player.result = 'tie';
            } else {
                player.result = 'lose';
            }
            
            console.log(`${player.name}: ${player.score} → ${player.result}`);
        });

        room.gameState = 'finished';
        await this.db.setRoom(roomCode, room);
        console.log(`✅ Résultats calculés`);
    }

    // Reset complet de la partie
    async resetGame(roomCode) {
        const room = await this.db.getRoom(roomCode);
        if (!room) return false;

        if (!room.players) room.players = [];

        room.players.forEach(player => {
            player.cards = [];
            player.score = 0;
            player.status = 'waiting';
            player.isActive = false;
            delete player.result;
        });

        room.dealerCards = [];
        room.dealerScore = 0;
        room.gameState = 'waiting';
        room.currentPlayerIndex = 0;
        room.deck = this.createDeck();

        await this.db.setRoom(roomCode, room);
        console.log(`🔄 Partie remise à zéro`);
        return true;
    }

    // Vérifier et avancer automatiquement si nécessaire
    checkAndAdvancePlayer(room) {
        if (room.gameState !== 'playing') return;
        
        const activePlayer = room.players.find(p => p.isActive);
        if (!activePlayer) {
            // Aucun joueur actif, chercher le suivant
            for (let i = room.currentPlayerIndex; i < room.players.length; i++) {
                if (room.players[i].status === 'playing') {
                    room.players[i].isActive = true;
                    room.currentPlayerIndex = i;
                    return;
                }
            }
            // Plus de joueurs → tour du croupier
            room.gameState = 'dealer_turn';
        }
    }

    // Obtenir les statistiques d'une room
    getRoomStats(room) {
        if (!room || !room.players) return null;
        
        return {
            totalPlayers: room.players.length,
            activeGame: room.gameState !== 'waiting',
            handsPlayed: room.handNumber || 0,
            playerStats: room.players.map(p => ({
                name: p.name,
                handsPlayed: p.handsPlayed || 0,
                handsWon: p.handsWon || 0,
                winRate: p.handsPlayed > 0 ? Math.round((p.handsWon / p.handsPlayed) * 100) : 0
            }))
        };
    }

    // Fonction de réparation automatique des rooms corrompues
    async repairRoom(roomCode) {
        try {
            const room = await this.db.getRoom(roomCode);
            if (!room) return false;

            let needsRepair = false;

            // Réparer players
            if (!room.players || !Array.isArray(room.players)) {
                room.players = [];
                needsRepair = true;
                console.log(`🔧 Réparation: players initialisé pour ${roomCode}`);
            }

            // Nettoyer les joueurs corrompus
            const originalLength = room.players.length;
            room.players = room.players.filter(p => p && typeof p === 'object' && p.name);
            if (room.players.length !== originalLength) {
                needsRepair = true;
                console.log(`🔧 Réparation: ${originalLength - room.players.length} joueurs corrompus supprimés`);
            }

            // Réparer la structure de base
            if (!room.dealerCards) {
                room.dealerCards = [];
                needsRepair = true;
            }
            if (!room.deck) {
                room.deck = this.createDeck();
                needsRepair = true;
            }
            if (!room.gameState) {
                room.gameState = 'waiting';
                needsRepair = true;
            }

            // Sauvegarder si réparation nécessaire
            if (needsRepair) {
                room.lastUpdate = Date.now();
                await this.db.setRoom(roomCode, room);
                console.log(`✅ Room ${roomCode} réparée`);
                return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ Erreur réparation room ${roomCode}:`, error);
            return false;
        }
    }
}

// ========== FONCTIONS DE L'INTERFACE UTILISATEUR ==========

// Création d'une room
async function createRoom() {
    const nameInput = document.getElementById('playerName');
    if (!nameInput) return;
    
    const name = nameInput.value.trim();
    if (!name) {
        showNotification('Veuillez entrer votre nom', 'error');
        return;
    }

    if (name.length > 12) {
        showNotification('Le nom ne peut pas dépasser 12 caractères', 'error');
        return;
    }

    showNotification('🔄 Création de la table...', 'info');

    playerName = name;
    isDealer = true;
    currentRoom = await gameServer.createRoom(name);
    
    if (currentRoom) {
        showNotification('🎰 Table créée avec succès!', 'success');
        showShareableLink();
        showGameInterface();
        setupRoomListener();
    } else {
        showNotification('❌ Erreur lors de la création', 'error');
    }
}

// Rejoindre une room
async function joinRoom() {
    const nameInput = document.getElementById('playerName');
    const codeInput = document.getElementById('roomCode');
    
    if (!nameInput || !codeInput) return;
    
    const name = nameInput.value.trim();
    const code = codeInput.value.trim().toUpperCase();
    
    if (!name || !code) {
        showNotification('Veuillez remplir tous les champs', 'error');
        return;
    }

    if (name.length > 12) {
        showNotification('Le nom ne peut pas dépasser 12 caractères', 'error');
        return;
    }

    if (code.length !== GAME_CONFIG.roomCodeLength) {
        showNotification(`Le code doit faire ${GAME_CONFIG.roomCodeLength} caractères`, 'error');
        return;
    }

    showNotification('🔄 Connexion à la table...', 'info');

    try {
        const result = await gameServer.joinRoom(code, name);
        
        if (!result.success) {
            let errorMessage;
            switch (result.reason) {
                case 'Room inexistante':
                    errorMessage = 'Cette table n\'existe pas ou a été fermée';
                    break;
                case 'Nom déjà pris':
                    errorMessage = 'Ce nom est déjà utilisé dans cette table';
                    break;
                case 'Table pleine':
                    errorMessage = 'Cette table est complète (5 joueurs max)';
                    break;
                case 'Erreur de connexion':
                    errorMessage = 'Problème de connexion, réessayez';
                    break;
                default:
                    errorMessage = result.reason || 'Erreur inconnue';
            }
            showNotification(`❌ ${errorMessage}`, 'error');
            return;
        }

        playerName = name;
        isDealer = false;
        currentRoom = code;
        
        showNotification('🎉 Bienvenue à la table!', 'success');
        showGameInterface();
        setupRoomListener();
        
    } catch (error) {
        console.error('Erreur joinRoom:', error);
        showNotification('❌ Erreur de connexion, veuillez réessayer', 'error');
    }
}

// Configuration de l'interface de jeu
function showGameInterface() {
    document.getElementById('lobby').style.display = 'none';
    document.getElementById('gameInterface').style.display = 'block';
    document.getElementById('gameRoomCode').textContent = currentRoom;
    document.getElementById('leaveBtn').style.display = 'inline-flex';
    
    updateGameControls();
    setupPlayerPositions();
}

// Fonction de diagnostic pour débugger les problèmes de room
function diagnoseRoom(room, context = '') {
    console.log(`🔍 Diagnostic room ${context}:`, {
        exists: !!room,
        hasPlayers: !!(room && room.players),
        playersType: room && typeof room.players,
        playersLength: room && room.players && room.players.length,
        playersContent: room && room.players,
        gameState: room && room.gameState,
        roomStructure: room && Object.keys(room)
    });
    
    if (room && room.players && Array.isArray(room.players)) {
        room.players.forEach((player, index) => {
            console.log(`  Joueur ${index}:`, {
                exists: !!player,
                name: player && player.name,
                type: typeof player
            });
        });
    }
}

// Configuration des positions de joueurs
function setupPlayerPositions() {
    const container = document.getElementById('playerPositions');
    if (!container) return;
    
    container.innerHTML = '';
    
    for (let i = 1; i <= GAME_CONFIG.maxPlayers; i++) {
        const spot = document.createElement('div');
        spot.className = `player-spot spot-${i}`;
        spot.id = `spot-${i}`;
        spot.innerHTML = `
            <div class="player-avatar"></div>
            <div class="player-name">Position ${i}</div>
            <div class="player-score">--</div>
            <div class="player-status"></div>
        `;
        container.appendChild(spot);
    }
}

// Mise à jour de l'affichage du jeu
function updateGameDisplay(room) {
    if (!room) {
        console.warn('updateGameDisplay appelé avec room null/undefined');
        return;
    }

    try {
        // CORRECTION : Vérification et correction robuste de la structure
        if (!room.players || !Array.isArray(room.players)) {
            console.warn('room.players invalide, initialisation...', room.players);
            room.players = [];
        }

        // Nettoyer les joueurs corrompus
        room.players = room.players.filter(player => {
            return player && typeof player === 'object' && player.name;
        });

        updatePlayerCount(room);
        updatePlayerPositions(room);
        updateDealerDisplay(room);
        updateGameControls(room);
        updateConnectionStatus(room);
        
    } catch (error) {
        console.error('Erreur updateGameDisplay:', error);
        showNotification('❌ Erreur d\'affichage, veuillez rafraîchir', 'error');
    }
}

// Mise à jour du nombre de joueurs
function updatePlayerCount(room) {
    const element = document.getElementById('playerCount');
    if (element) {
        element.textContent = room.players.length;
    }
}

// Mise à jour des positions des joueurs
function updatePlayerPositions(room) {
    // Reset toutes les positions
    for (let i = 1; i <= GAME_CONFIG.maxPlayers; i++) {
        const spot = document.getElementById(`spot-${i}`);
        if (!spot) continue;
        
        const avatar = spot.querySelector('.player-avatar');
        const name = spot.querySelector('.player-name');
        const score = spot.querySelector('.player-score');
        const status = spot.querySelector('.player-status');
        
        if (!avatar || !name || !score || !status) continue;
        
        // Reset
        spot.className = `player-spot spot-${i}`;
        avatar.textContent = '';
        name.textContent = `Position ${i}`;
        score.textContent = '--';
        status.textContent = '';
        status.className = 'player-status';
    }

    // Placer les joueurs
    room.players.forEach((player, index) => {
        const position = index + 1;
        const spot = document.getElementById(`spot-${position}`);
        if (!spot) return;
        
        const avatar = spot.querySelector('.player-avatar');
        const name = spot.querySelector('.player-name');
        const score = spot.querySelector('.player-score');
        const status = spot.querySelector('.player-status');
        
        if (!avatar || !name || !score || !status) return;
        
        // Marquer comme actif si c'est le tour du joueur
        if (player.isActive) {
            spot.classList.add('active');
        }
        
        // Informations du joueur
        avatar.textContent = player.name.charAt(0).toUpperCase();
        name.textContent = player.name;
        score.textContent = player.score || '--';
        
        // Status du joueur
        if (player.result) {
            const resultText = {
                'win': '🎉 Gagne',
                'lose': '💀 Perd', 
                'tie': '🤝 Égalité'
            };
            status.textContent = resultText[player.result] || player.result;
            status.className = `player-status ${player.result}`;
        } else if (player.status === 'bust') {
            status.textContent = '💥 Bust';
            status.className = 'player-status lose';
        } else if (player.status === 'stand') {
            status.textContent = '✋ Reste';
        } else if (player.isActive) {
            status.textContent = '▶️ Joue';
        } else if (player.status === 'playing') {
            status.textContent = '⏳ Attend';
        }
    });
}

// Mise à jour de l'affichage du croupier
function updateDealerDisplay(room) {
    const scoreElement = document.getElementById('dealerScore');
    if (!scoreElement) return;
    
    // Masquer le score du croupier pendant que les joueurs jouent
    if (room.gameState === 'playing' && room.dealerCards && room.dealerCards.length > 0) {
        scoreElement.textContent = '?';
    } else {
        scoreElement.textContent = room.dealerScore || '--';
    }
}

// Mise à jour des contrôles de jeu
function updateGameControls(room) {
    const dealerControls = document.getElementById('dealerControls');
    const playerControls = document.getElementById('playerControls');
    const waitingControls = document.getElementById('waitingControls');
    const dealerPlayBtn = document.getElementById('dealerPlayBtn');
    const waitingMessage = document.getElementById('waitingMessage');
    
    // Cacher tous les contrôles
    [dealerControls, playerControls, waitingControls].forEach(el => {
        if (el) el.style.display = 'none';
    });
    if (dealerPlayBtn) dealerPlayBtn.style.display = 'none';

    if (!room) return;

    // Sécurité
    if (!room.players) room.players = [];

    if (isDealer) {
        // Interface croupier
        if (dealerControls) dealerControls.style.display = 'flex';
        
        if (room.gameState === 'dealer_turn' && dealerPlayBtn) {
            dealerPlayBtn.style.display = 'inline-flex';
        }
    } else {
        // Interface joueur
        const player = room.players.find(p => p.name === playerName);
        
        if (player && player.isActive && room.gameState === 'playing') {
            if (playerControls) playerControls.style.display = 'flex';
        } else {
            if (waitingControls) waitingControls.style.display = 'flex';
            
            // Message d'attente contextuel
            if (waitingMessage) {
                let message = 'En attente...';
                
                if (room.gameState === 'waiting') {
                    message = 'En attente du croupier...';
                } else if (room.gameState === 'dealing') {
                    message = 'Distribution des cartes...';
                } else if (room.gameState === 'playing') {
                    const activePlayer = room.players.find(p => p.isActive);
                    message = activePlayer ? `Tour de ${activePlayer.name}...` : 'En attente...';
                } else if (room.gameState === 'dealer_turn') {
                    message = 'En attente du croupier...';
                } else if (room.gameState === 'dealer_playing') {
                    message = 'Le croupier joue...';
                } else if (room.gameState === 'finished') {
                    message = 'Partie terminée';
                }
                
                waitingMessage.textContent = message;
            }
        }
    }
}

// Mise à jour du statut de connexion
function updateConnectionStatus(room) {
    const dot = document.getElementById('connectionDot');
    const status = document.getElementById('connectionStatus');
    
    if (!dot || !status) return;
    
    const dbInfo = window.dbWrapper.getConnectionInfo();
    
    if (dbInfo.useFirebase) {
        dot.className = 'status-dot connected';
        status.textContent = 'En ligne';
    } else {
        dot.className = 'status-dot waiting';
        status.textContent = 'Mode local';
    }
}

// Configuration du listener temps réel
function setupRoomListener() {
    if (!currentRoom) return;
    
    roomListener = window.dbWrapper.onRoomChange(currentRoom, (room) => {
        if (room) {
            // Diagnostic en cas de problème
            if (!room.players || !Array.isArray(room.players)) {
                diagnoseRoom(room, 'listener update');
            }
            
            updateGameDisplay(room);
        } else {
            // Room supprimée
            console.log('Room supprimée détectée par le listener');
            showNotification('La table a été fermée', 'error');
            leaveGame();
        }
    });
    
    console.log(`👂 Listener configuré pour room ${currentRoom}`);
}

// Actions du jeu
async function startNewHand() {
    if (!isDealer || !currentRoom) return;
    
    const success = await gameServer.startNewHand(currentRoom);
    if (success) {
        showNotification('🎴 Nouvelle main en cours...', 'info');
    }
}

async function hit() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameServer.playerAction(currentRoom, playerName, 'hit');
    if (success) {
        showNotification('🃏 Carte tirée!', 'info');
    }
}

async function stand() {
    if (!currentRoom || !playerName) return;
    
    const success = await gameServer.playerAction(currentRoom, playerName, 'stand');
    if (success) {
        showNotification('✋ Vous restez', 'info');
    }
}

async function dealerPlay() {
    if (!isDealer || !currentRoom) return;
    
    const success = await gameServer.dealerPlay(currentRoom);
    if (success) {
        showNotification('🎲 Tour du croupier...', 'info');
    }
}

async function resetGame() {
    if (!isDealer || !currentRoom) return;
    
    const success = await gameServer.resetGame(currentRoom);
    if (success) {
        showNotification('🔄 Partie remise à zéro', 'info');
    }
}

// Partager la room
function shareRoom() {
    if (!currentRoom) return;
    
    const url = `${window.location.origin}${window.location.pathname}?roomid=${currentRoom}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Casino Royal - Blackjack',
            text: `Rejoignez ma table de blackjack avec le code ${currentRoom}`,
            url: url
        });
    } else {
        copyToClipboard(url);
        showNotification('🔗 Lien copié!', 'success');
    }
}

// Quitter le jeu
async function leaveGame() {
    if (currentRoom && playerName) {
        await gameServer.leaveRoom(currentRoom, playerName);
    }
    
    // Nettoyer les listeners
    if (roomListener) {
        roomListener();
        roomListener = null;
    }
    
    // Reset de l'interface
    document.getElementById('lobby').style.display = 'flex';
    document.getElementById('gameInterface').style.display = 'none';
    document.getElementById('leaveBtn').style.display = 'none';
    
    // Nettoyer l'URL
    window.history.pushState({}, '', window.location.pathname);
    
    // Reset des variables
    currentRoom = null;
    playerName = '';
    isDealer = false;
    
    showNotification('👋 Vous avez quitté la table', 'info');
}

// Fonctions utilitaires
function showJoinRoom() {
    document.getElementById('joinRoomCard').style.display = 'block';
}

function hideJoinRoom() {
    document.getElementById('joinRoomCard').style.display = 'none';
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification('📋 Copié!', 'success');
    }).catch(() => {
        // Fallback pour les navigateurs plus anciens
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showNotification('📋 Copié!', 'success');
    });
}

function showShareableLink() {
    const url = `${window.location.origin}${window.location.pathname}?roomid=${currentRoom}`;
    
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        color: white;
        padding: 30px;
        border-radius: 15px;
        z-index: 10000;
        text-align: center;
        border: 2px solid #FFD700;
        max-width: 500px;
        max-height: 80vh;
        overflow-y: auto;
    `;
    
    const dbInfo = window.dbWrapper.getConnectionInfo();
    
    popup.innerHTML = `
        <h3>🎉 Table créée!</h3>
        <p style="margin: 15px 0; color: #FFD700;">Code: <strong>${currentRoom}</strong></p>
        
        ${!dbInfo.useFirebase ? `
            <div style="background: rgba(255, 165, 0, 0.2); padding: 15px; border-radius: 10px; margin: 15px 0;">
                <h4>📱 Mode Local</h4>
                <p style="font-size: 14px;">
                    Multijoueur limité à cet onglet. Pour le vrai multijoueur en ligne, 
                    hébergez ce jeu sur votre serveur.
                </p>
            </div>
        ` : ''}
        
        <p style="margin: 10px 0;">Partagez ce lien :</p>
        <input type="text" value="${url}" style="width: 100%; padding: 10px; border: none; border-radius: 5px; margin: 10px 0; font-family: monospace; font-size: 12px;" readonly onclick="this.select()">
        
        <div style="margin-top: 20px;">
            <button onclick="copyToClipboard('${url}'); this.parentElement.parentElement.remove();" style="background: #FFD700; color: black; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">📋 Copier</button>
            <button onclick="this.parentElement.parentElement.remove();" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">Fermer</button>
        </div>
    `;
    
    document.body.appendChild(popup);
    
    setTimeout(() => {
        if (popup.parentElement) {
            popup.remove();
        }
    }, 15000);
}

// Rejoindre automatiquement via URL
async function joinFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomid');
    
    if (roomId && roomId.length === GAME_CONFIG.roomCodeLength) {
        const codeInput = document.getElementById('roomCode');
        if (codeInput) {
            codeInput.value = roomId.toUpperCase();
            showJoinRoom();
            
            const nameInput = document.getElementById('playerName');
            if (nameInput && !nameInput.value.trim()) {
                nameInput.focus();
            }
        }
        
        showNotification('🎯 Code de table détecté!', 'info');
    }
}

// Système de notifications
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

// Création des particules d'ambiance
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;
    
    setInterval(() => {
        const existingParticles = document.querySelectorAll('.particle');
        if (existingParticles.length < 15) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.animationDuration = (Math.random() * 3 + 3) + 's';
            particle.style.animationDelay = Math.random() * 2 + 's';
            particlesContainer.appendChild(particle);
            
            setTimeout(() => {
                if (particle && particle.parentNode) {
                    particle.remove();
                }
            }, 8000);
        }
    }, 800);
}

// Event listeners
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

    // Nettoyage avant fermeture
    window.addEventListener('beforeunload', function() {
        if (currentRoom && playerName) {
            gameServer.leaveRoom(currentRoom, playerName);
        }
    });
    
    // Raccourcis clavier pour le jeu
    document.addEventListener('keydown', function(e) {
        if (!currentRoom) return;
        
        if (e.key === 'h' || e.key === 'H') {
            hit();
        } else if (e.key === 's' || e.key === 'S') {
            stand();
        } else if (e.key === 'd' || e.key === 'D') {
            if (isDealer) startNewHand();
        }
    });
}

// Initialisation principale
async function initializeGame() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGame);
        return;
    }
    
    console.log('🎮 Initialisation du Blackjack Casino Royal...');
    
    // Initialiser le serveur de jeu
    gameServer = new BlackjackGameServer();
    
    // Attendre l'initialisation
    while (!gameServer.initComplete) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Initialiser l'interface
    createParticles();
    setupEventListeners();
    joinFromURL();
    
    // Message de bienvenue
    const dbInfo = window.dbWrapper.getConnectionInfo();
    if (dbInfo.useFirebase) {
        console.log('✅ Jeu initialisé avec Firebase (multijoueur en ligne)');
        showNotification('🔥 Multijoueur en ligne activé!', 'success');
    } else {
        console.log('✅ Jeu initialisé en mode local');
        showNotification('📱 Mode local - Partagez vos parties!', 'info');
    }
}

// Démarrer l'initialisation
initializeGame();