// ========== FIREBASE MANAGER ========== //
class FirebaseManager {
    constructor() {
        this.useLocalStorage = true;
        this.database = null;
        this.pollInterval = null;
        this.initFirebase();
    }

    async initFirebase() {
        // Configuration Firebase
        const firebaseConfig = {
            apiKey: "AIzaSyBlF0Rv-vaLHlopMYNbs7JnLyiqi-HUnn4",
            authDomain: "blackjack-casino-royal.firebaseapp.com",
            databaseURL: "https://blackjack-casino-royal-default-rtdb.europe-west1.firebasedatabase.app",
            projectId: "blackjack-casino-royal",
            storageBucket: "blackjack-casino-royal.firebasestorage.app",
            messagingSenderId: "554706185893",
            appId: "1:554706185893:web:847eefcd131c6a929f674c"
        };

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
            // Utiliser Firebase seulement sur un hébergement propre
            if (typeof firebase !== 'undefined') {
                firebase.initializeApp(firebaseConfig);
                this.database = firebase.database();
                console.log("🔥 SIO Casino - Firebase connecté!");
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
            await this.updateRoom(code, room);
            
            console.log(`✅ ${playerName} a rejoint SIO Room ${code}`);
            return true;
        } catch (error) {
            console.error("❌ Erreur rejoindre SIO room:", error);
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
                await this.database.ref(`sio_rooms/${roomCode}`).set(room);
            } else {
                localStorage.setItem(`sio_blackjack_room_${roomCode}`, JSON.stringify(room));
            }
            return true;
        } catch (error) {
            console.error("❌ Erreur mise à jour SIO room:", error);
            return false;
        }
    }

    async getRoom(code) {
        try {
            if (this.database && !this.useLocalStorage) {
                const snapshot = await this.database.ref(`sio_rooms/${code}`).once('value');
                return snapshot.val();
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
                    await this.database.ref(`sio_rooms/${code}`).remove();
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

    // Listener temps réel optimisé
    setupRoomListener(roomCode, callback) {
        if (this.database && !this.useLocalStorage) {
            this.database.ref(`sio_rooms/${roomCode}`).on('value', (snapshot) => {
                const room = snapshot.val();
                callback(room);
            });
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
            this.database.ref(`sio_rooms/${roomCode}`).off();
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