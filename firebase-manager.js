// ========== FIREBASE MANAGER V9+ ========== //
class FirebaseManager {
    constructor() {
        this.useLocalStorage = true;
        this.database = null;
        this.pollInterval = null;
        this.listeners = new Map();
        this.initFirebase();
    }

    async initFirebase() {
        // Détecter l'environnement Claude.ai
        const isClaudeArtifact = window.location.hostname.includes('claudeusercontent.com') || 
                                window.location.hostname.includes('claude.ai');
        
        if (isClaudeArtifact) {
            console.log("🎮 Mode DEMO SIO Casino (localStorage)");
            console.log("ℹ️ Pour le multijoueur en ligne, hébergez ce code sur votre serveur");
            this.useLocalStorage = true;
            this.database = null;
            return;
        }

        try {
            // Attendre que Firebase soit disponible
            await this.waitForFirebase();
            
            if (window.firebaseDatabase) {
                this.database = window.firebaseDatabase;
                console.log("🔥 SIO Casino - Firebase v9+ connecté!");
                this.useLocalStorage = false;
            } else {
                throw new Error("Firebase non disponible");
            }
        } catch (error) {
            console.log("🔄 SIO Casino - Fallback vers localStorage");
            this.useLocalStorage = true;
            this.database = null;
        }
    }

    async waitForFirebase() {
        // Attendre que Firebase soit chargé
        for (let i = 0; i < 50; i++) {
            if (window.firebaseDatabase) {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        throw new Error("Timeout Firebase");
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async createRoom(dealerName) {
        const code = this.generateRoomCode();
        const room = {
            code: code,
            dealer: dealerName,
            players: [],
            gameState: 'waiting',
            deck: this.createDeck(),
            dealerCards: [],
            dealerScore: 0,
            currentPlayerIndex: 0,
            created: Date.now(),
            lastUpdate: Date.now(),
            chat: [],
            timer: null
        };
        
        try {
            if (this.database && !this.useLocalStorage) {
                await this.database.ref(`sio_rooms/${code}`).set(room);
                console.log(`✅ SIO Room ${code} créée dans Firebase`);
            } else {
                localStorage.setItem(`sio_blackjack_room_${code}`, JSON.stringify(room));
                console.log(`✅ SIO Room ${code} créée dans localStorage`);
            }
            
            return code;
        } catch (error) {
            console.error("❌ Erreur création SIO room:", error);
            return null;
        }
    }

    async joinRoom(code, playerName) {
        try {
            let room = await this.getRoom(code);
            
            if (!room) {
                console.log(`❌ SIO Room ${code} n'existe pas`);
                return false;
            }
            
            if (!Array.isArray(room.players)) {
                room.players = [];
            }
            
            if (room.players.find(p => p.name === playerName)) {
                console.log(`❌ Nom ${playerName} déjà pris dans SIO Room`);
                return false;
            }
            
            if (room.players.length >= 5) {
                console.log(`❌ SIO Room ${code} pleine`);
                return false;
            }

            room.players.push({
                name: playerName,
                hands: [{ // Changement: support pour split
                    cards: [],
                    score: 0,
                    isActive: false,
                    canSplit: false,
                    canDouble: false
                }],
                currentHandIndex: 0,
                status: 'waiting',
                position: room.players.length + 1,
                joinedAt: Date.now(),
                winStreak: 0,
                totalWins: 0,
                totalLosses: 0
            });

            room.lastUpdate = Date.now();
            
            const updateSuccess = await this.updateRoom(code, room);
            if (!updateSuccess) {
                console.log(`❌ Erreur mise à jour room ${code}`);
                return false;
            }
            
            console.log(`✅ ${playerName} a rejoint SIO Room ${code}`);
            return true;
        } catch (error) {
            console.error("❌ Erreur rejoindre SIO room:", error);
            
            // Si erreur de permission, informer l'utilisateur
            if (error.code === 'PERMISSION_DENIED' || error.message.includes('permission')) {
                if (window.uiManager) {
                    window.uiManager.showNotification('⚠️ Erreur Firebase - Consultez FIREBASE_SETUP.md', 'error');
                }
            }
            
            return false;
        }
    }

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

    shuffleDeck(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        return deck;
    }

    getCardValue(value) {
        if (value === 'A') return 1; // L'As sera géré spécialement
        if (['J', 'Q', 'K'].includes(value)) return 10;
        return parseInt(value);
    }

    calculateScore(cards) {
        let score = 0;
        let aces = 0;

        for (let card of cards) {
            if (card.value === 'A') {
                aces++;
                score += 11;
            } else {
                score += card.numValue;
            }
        }

        // Optimisation des As
        while (score > 21 && aces > 0) {
            score -= 10;
            aces--;
        }

        return score;
    }

    async updateRoom(roomCode, room) {
        try {
            room.lastUpdate = Date.now();
            
            if (this.database && !this.useLocalStorage) {
                const roomRef = window.firebaseRef(this.database, `sio_rooms/${roomCode}`);
                await window.firebaseSet(roomRef, room);
            } else {
                localStorage.setItem(`sio_blackjack_room_${roomCode}`, JSON.stringify(room));
            }
            return true;
        } catch (error) {
            console.error("❌ Erreur mise à jour SIO room:", error);
            
            // Si erreur Firebase, basculer vers localStorage
            if (error.code === 'PERMISSION_DENIED' || error.message.includes('permission')) {
                console.log("🔄 Basculement vers localStorage pour mise à jour");
                this.useLocalStorage = true;
                this.database = null;
                
                try {
                    localStorage.setItem(`sio_blackjack_room_${roomCode}`, JSON.stringify(room));
                    console.log("✅ Room mise à jour dans localStorage (fallback)");
                    return true;
                } catch (localError) {
                    console.error("❌ Erreur localStorage:", localError);
                    return false;
                }
            }
            
            return false;
        }
    }

    async getRoom(code) {
        try {
            if (this.database && !this.useLocalStorage) {
                const roomRef = window.firebaseRef(this.database, `sio_rooms/${code}`);
                const snapshot = await window.firebaseGet(roomRef);
                return snapshot.exists() ? snapshot.val() : null;
            } else {
                return JSON.parse(localStorage.getItem(`sio_blackjack_room_${code}`) || 'null');
            }
        } catch (error) {
            console.error("❌ Erreur récupération SIO room:", error);
            return null;
        }
    }

    async leaveRoom(code, playerName) {
        try {
            const room = await this.getRoom(code);
            if (!room) return false;

            room.players = room.players.filter(p => p.name !== playerName);
            
            // Supprimer la room si vide
            if (room.players.length === 0) {
                if (this.database && !this.useLocalStorage) {
                    const roomRef = window.firebaseRef(this.database, `sio_rooms/${code}`);
                    await window.firebaseRemove(roomRef);
                } else {
                    localStorage.removeItem(`sio_blackjack_room_${code}`);
                }
            } else {
                // Réorganiser les positions
                room.players.forEach((player, index) => {
                    player.position = index + 1;
                });
                await this.updateRoom(code, room);
            }

            return true;
        } catch (error) {
            console.error("❌ Erreur quitter SIO room:", error);
            return false;
        }
    }

    // Listener temps réel optimisé pour Firebase v9+
    setupRoomListener(roomCode, callback) {
        if (this.database && !this.useLocalStorage) {
            const roomRef = window.firebaseRef(this.database, `sio_rooms/${roomCode}`);
            const unsubscribe = window.firebaseOnValue(roomRef, (snapshot) => {
                const room = snapshot.exists() ? snapshot.val() : null;
                callback(room);
            });
            
            // Stocker la fonction de désinscription
            this.listeners.set(roomCode, unsubscribe);
        } else {
            // Polling optimisé pour localStorage
            this.pollInterval = setInterval(async () => {
                const room = await this.getRoom(roomCode);
                callback(room);
            }, 300); // Plus fréquent pour une meilleure réactivité
        }
    }

    removeRoomListener(roomCode) {
        if (this.database && !this.useLocalStorage) {
            const unsubscribe = this.listeners.get(roomCode);
            if (unsubscribe) {
                unsubscribe();
                this.listeners.delete(roomCode);
            }
        } else if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
    }

    // Ajouter un message au chat
    async addChatMessage(roomCode, playerName, message) {
        try {
            const room = await this.getRoom(roomCode);
            if (!room) return false;

            if (!room.chat) room.chat = [];
            
            room.chat.push({
                name: playerName,
                text: message.trim(),
                time: Date.now()
            });

            // Limiter à 50 messages
            if (room.chat.length > 50) {
                room.chat = room.chat.slice(-50);
            }

            await this.updateRoom(roomCode, room);
            return true;
        } catch (error) {
            console.error("❌ Erreur ajout message chat:", error);
            return false;
        }
    }

    // Gestion du timer
    async startPlayerTimer(roomCode, playerName, duration = 30) {
        const room = await this.getRoom(roomCode);
        if (!room) return false;

        room.timer = {
            playerName: playerName,
            startTime: Date.now(),
            duration: duration * 1000, // en millisecondes
            remaining: duration * 1000
        };

        await this.updateRoom(roomCode, room);
        return true;
    }

    async clearTimer(roomCode) {
        const room = await this.getRoom(roomCode);
        if (!room) return false;

        room.timer = null;
        await this.updateRoom(roomCode, room);
        return true;
    }

    // Calculer le temps restant du timer
    calculateTimeRemaining(room) {
        if (!room.timer) return 0;
        
        const elapsed = Date.now() - room.timer.startTime;
        const remaining = Math.max(0, room.timer.duration - elapsed);
        return Math.ceil(remaining / 1000);
    }
}

// Export pour utilisation dans d'autres fichiers
window.FirebaseManager = FirebaseManager;