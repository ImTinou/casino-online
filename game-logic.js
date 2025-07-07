// ========== GAME LOGIC MANAGER ========== //
class GameLogic {
    constructor(firebaseManager) {
        this.firebase = firebaseManager;
        this.PLAYER_TIMEOUT = 30; // 30 secondes par joueur
        this.timerInterval = null;
    }

    async startNewHand(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room || room.players.length === 0) return false;

        console.log("🎴 Début nouvelle main SIO Casino");

        // Reset complet de tous les joueurs
        room.players.forEach(player => {
            player.hands = [{
                cards: [],
                score: 0,
                isActive: false,
                canSplit: false,
                canDouble: false,
                result: null
            }];
            player.currentHandIndex = 0;
            player.status = 'playing';
        });

        // Reset croupier
        room.dealerCards = [];
        room.dealerScore = 0;
        room.deck = this.firebase.createDeck();
        room.currentPlayerIndex = 0;
        room.gameState = 'dealing';
        room.pendingAction = null;

        await this.firebase.updateRoom(roomCode, room);

        // Distribution automatique avec délai
        setTimeout(() => {
            this.distributeInitialCards(roomCode);
        }, 500);

        return true;
    }

    async distributeInitialCards(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return;

        console.log("🎯 Distribution des cartes initiales");

        // 2 cartes pour chaque joueur + croupier
        for (let round = 0; round < 2; round++) {
            // Cartes pour les joueurs
            for (let playerIndex = 0; playerIndex < room.players.length; playerIndex++) {
                await this.dealCardToPlayer(roomCode, playerIndex, 0); // main principale
            }
            
            // Carte pour le croupier
            const card = room.deck.pop();
            if (round === 1) {
                card.hidden = true; // 2ème carte cachée
            }
            room.dealerCards.push(card);
            room.dealerScore = this.firebase.calculateScore(room.dealerCards.filter(c => !c.hidden));
            await this.firebase.updateRoom(roomCode, room);
        }

        // Vérifier les blackjacks et activer le premier joueur
        await this.checkInitialBlackjacks(roomCode);
        await this.activateNextPlayer(roomCode);
    }

    async checkInitialBlackjacks(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return;

        // Vérifier blackjacks naturels
        room.players.forEach(player => {
            const hand = player.hands[0];
            if (hand.cards.length === 2 && hand.score === 21) {
                hand.hasBlackjack = true;
                player.status = 'blackjack';
            }
        });

        // Blackjack croupier (on vérifie même si caché)
        const dealerBlackjack = room.dealerCards.length === 2 && 
                               this.firebase.calculateScore(room.dealerCards) === 21;
        if (dealerBlackjack) {
            room.dealerHasBlackjack = true;
        }

        room.gameState = 'playing';
        await this.firebase.updateRoom(roomCode, room);
    }

    async activateNextPlayer(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return;

        // Désactiver le joueur actuel
        room.players.forEach(player => {
            player.hands.forEach(hand => hand.isActive = false);
        });

        // Trouver le prochain joueur actif
        let activated = false;
        for (let i = room.currentPlayerIndex; i < room.players.length; i++) {
            const player = room.players[i];
            
            if (player.status === 'playing') {
                // Activer la première main non terminée
                for (let handIndex = 0; handIndex < player.hands.length; handIndex++) {
                    const hand = player.hands[handIndex];
                    if (!hand.result && hand.score < 21) {
                        hand.isActive = true;
                        player.currentHandIndex = handIndex;
                        room.currentPlayerIndex = i;
                        
                        // Mettre à jour les options (double, split)
                        this.updateHandOptions(hand);
                        
                        activated = true;
                        
                        // Démarrer le timer
                        await this.firebase.startPlayerTimer(roomCode, player.name, this.PLAYER_TIMEOUT);
                        this.startPlayerTimeout(roomCode, player.name);
                        
                        break;
                    }
                }
            }
            
            if (activated) break;
        }

        if (!activated) {
            // Tous les joueurs ont terminé
            await this.startDealerTurn(roomCode);
        }

        await this.firebase.updateRoom(roomCode, room);
    }

    updateHandOptions(hand) {
        // Peut doubler si 2 cartes et score entre 9-11 idéalement
        hand.canDouble = hand.cards.length === 2 && hand.score >= 9 && hand.score <= 11;
        
        // Peut split si 2 cartes identiques
        hand.canSplit = hand.cards.length === 2 && 
                       hand.cards[0].value === hand.cards[1].value;
    }

    async playerAction(roomCode, playerName, action) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room || room.gameState !== 'playing') return false;

        const player = room.players.find(p => p.name === playerName);
        if (!player) return false;

        const hand = player.hands[player.currentHandIndex];
        if (!hand || !hand.isActive) return false;

        console.log(`🎯 ${playerName} - Action: ${action}`);

        // Arrêter le timer
        this.clearPlayerTimeout();
        await this.firebase.clearTimer(roomCode);

        switch (action) {
            case 'hit':
                await this.playerHit(roomCode, player, hand);
                break;
            case 'stand':
                await this.playerStand(roomCode, player, hand);
                break;
            case 'double':
                await this.playerDouble(roomCode, player, hand);
                break;
            case 'split':
                await this.playerSplit(roomCode, player, hand);
                break;
            default:
                return false;
        }

        return true;
    }

    async playerHit(roomCode, player, hand) {
        await this.dealCardToPlayerHand(roomCode, player, hand);
        
        const room = await this.firebase.getRoom(roomCode);
        
        if (hand.score > 21) {
            hand.result = 'bust';
            hand.isActive = false;
            await this.moveToNextHand(roomCode, player);
        } else if (hand.score === 21) {
            hand.result = 'stand';
            hand.isActive = false;
            await this.moveToNextHand(roomCode, player);
        }
        // Sinon le joueur continue
    }

    async playerStand(roomCode, player, hand) {
        hand.result = 'stand';
        hand.isActive = false;
        await this.moveToNextHand(roomCode, player);
    }

    async playerDouble(roomCode, player, hand) {
        if (!hand.canDouble) return false;
        
        hand.doubled = true;
        await this.dealCardToPlayerHand(roomCode, player, hand);
        
        // Forcer stand après double
        hand.result = 'stand';
        hand.isActive = false;
        await this.moveToNextHand(roomCode, player);
    }

    async playerSplit(roomCode, player, hand) {
        if (!hand.canSplit) return false;

        console.log(`🃏 ${player.name} effectue un split`);

        // Créer la nouvelle main avec la 2ème carte
        const secondCard = hand.cards.pop();
        const newHand = {
            cards: [secondCard],
            score: this.firebase.calculateScore([secondCard]),
            isActive: false,
            canSplit: false,
            canDouble: false,
            result: null,
            isSplitHand: true
        };

        // Mettre à jour la main originale
        hand.score = this.firebase.calculateScore(hand.cards);
        hand.canSplit = false;
        hand.isSplitHand = true;

        // Ajouter la nouvelle main
        player.hands.push(newHand);

        // Distribuer une carte à chaque main
        await this.dealCardToPlayerHand(roomCode, player, hand);
        await this.dealCardToPlayerHand(roomCode, player, newHand);

        // Continuer avec la main actuelle
        this.updateHandOptions(hand);
    }

    async moveToNextHand(roomCode, player) {
        const room = await this.firebase.getRoom(roomCode);
        
        // Chercher la prochaine main active du même joueur
        let nextHandFound = false;
        for (let i = player.currentHandIndex + 1; i < player.hands.length; i++) {
            const hand = player.hands[i];
            if (!hand.result && hand.score < 21) {
                hand.isActive = true;
                player.currentHandIndex = i;
                this.updateHandOptions(hand);
                nextHandFound = true;
                
                // Redémarrer le timer
                await this.firebase.startPlayerTimer(roomCode, player.name, this.PLAYER_TIMEOUT);
                this.startPlayerTimeout(roomCode, player.name);
                break;
            }
        }

        if (!nextHandFound) {
            // Plus de mains pour ce joueur, passer au suivant
            player.status = 'finished';
            room.currentPlayerIndex++;
            await this.activateNextPlayer(roomCode);
        }

        await this.firebase.updateRoom(roomCode, room);
    }

    async dealCardToPlayer(roomCode, playerIndex, handIndex) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room || room.deck.length === 0) return null;

        const card = room.deck.pop();
        const player = room.players[playerIndex];
        const hand = player.hands[handIndex];
        
        hand.cards.push(card);
        hand.score = this.firebase.calculateScore(hand.cards);
        
        await this.firebase.updateRoom(roomCode, room);
        return card;
    }

    async dealCardToPlayerHand(roomCode, player, hand) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room || room.deck.length === 0) return null;

        const card = room.deck.pop();
        hand.cards.push(card);
        hand.score = this.firebase.calculateScore(hand.cards);
        
        await this.firebase.updateRoom(roomCode, room);
        return card;
    }

    async startDealerTurn(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return;

        console.log("🎩 Tour du croupier");

        room.gameState = 'dealer_turn';
        
        // Révéler la carte cachée
        room.dealerCards.forEach(card => card.hidden = false);
        room.dealerScore = this.firebase.calculateScore(room.dealerCards);

        await this.firebase.updateRoom(roomCode, room);
    }

    async dealerPlay(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return false;

        room.gameState = 'dealer_playing';
        await this.firebase.updateRoom(roomCode, room);

        // Le croupier tire tant qu'il a moins de 17
        // CORRECTION: S'arrêter à 17 (pas tirer à 17)
        while (room.dealerScore < 17) {
            console.log(`🎯 Croupier tire (score: ${room.dealerScore})`);
            
            const card = room.deck.pop();
            room.dealerCards.push(card);
            room.dealerScore = this.firebase.calculateScore(room.dealerCards);
            
            await this.firebase.updateRoom(roomCode, room);
            
            // Délai pour l'animation
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log(`🎩 Croupier s'arrête à ${room.dealerScore}`);
        await this.finishGame(roomCode);
        return true;
    }

    async finishGame(roomCode) {
        const room = await this.firebase.getRoom(roomCode);
        if (!room) return;

        console.log("🏁 Fin de partie - Calcul des résultats");

        // Calculer les résultats pour chaque main de chaque joueur
        room.players.forEach(player => {
            player.hands.forEach(hand => {
                if (hand.result === 'bust') {
                    hand.finalResult = 'lose';
                } else if (hand.hasBlackjack && !room.dealerHasBlackjack) {
                    hand.finalResult = 'blackjack'; // Paye 3:2
                } else if (room.dealerHasBlackjack && !hand.hasBlackjack) {
                    hand.finalResult = 'lose';
                } else if (room.dealerScore > 21) {
                    hand.finalResult = 'win';
                } else if (hand.score > room.dealerScore) {
                    hand.finalResult = 'win';
                } else if (hand.score === room.dealerScore) {
                    hand.finalResult = 'tie';
                } else {
                    hand.finalResult = 'lose';
                }
            });

            // Calculer le résultat global du joueur
            const wins = player.hands.filter(h => h.finalResult === 'win' || h.finalResult === 'blackjack').length;
            const losses = player.hands.filter(h => h.finalResult === 'lose').length;
            
            if (wins > losses) {
                player.gameResult = 'win';
                player.winStreak = (player.winStreak || 0) + 1;
                player.totalWins = (player.totalWins || 0) + 1;
            } else if (losses > wins) {
                player.gameResult = 'lose';
                player.winStreak = 0;
                player.totalLosses = (player.totalLosses || 0) + 1;
            } else {
                player.gameResult = 'tie';
            }
        });

        room.gameState = 'finished';
        await this.firebase.updateRoom(roomCode, room);
        
        console.log("✅ Résultats calculés");
    }

    // Gestion du timeout des joueurs
    startPlayerTimeout(roomCode, playerName) {
        this.clearPlayerTimeout();
        
        this.timerInterval = setInterval(async () => {
            const room = await this.firebase.getRoom(roomCode);
            if (!room || !room.timer) {
                this.clearPlayerTimeout();
                return;
            }

            const remaining = this.firebase.calculateTimeRemaining(room);
            
            if (remaining <= 0) {
                console.log(`⏰ Timeout pour ${playerName} - Stand automatique`);
                this.clearPlayerTimeout();
                await this.playerAction(roomCode, playerName, 'stand');
            }
        }, 1000);
    }

    clearPlayerTimeout() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
}

// Export pour utilisation
window.GameLogic = GameLogic;