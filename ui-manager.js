// ========== UI MANAGER ========== //
class UIManager {
    constructor() {
        this.currentRoom = null;
        this.playerName = '';
        this.isDealer = false;
        this.timerUpdateInterval = null;
    }

    // ========== LOBBY FUNCTIONS ========== //
    showJoinRoom() {
        document.getElementById('joinRoomCard').style.display = 'block';
        document.getElementById('roomCode').focus();
    }

    hideJoinRoom() {
        document.getElementById('joinRoomCard').style.display = 'none';
    }

    showGameInterface(roomCode) {
        this.currentRoom = roomCode;
        document.getElementById('lobby').style.display = 'none';
        document.getElementById('gameInterface').style.display = 'block';
        document.getElementById('gameRoomCode').textContent = roomCode;
        
        this.setupPlayerPositions();
        this.setupChatHandlers();
        
        if (this.isDealer) {
            document.getElementById('dealerControls').style.display = 'flex';
        } else {
            document.getElementById('waitingControls').style.display = 'flex';
        }
    }

    setupPlayerPositions() {
        const container = document.getElementById('playerPositions');
        if (!container) return;
        
        container.innerHTML = '';
        
        for (let i = 1; i <= 5; i++) {
            const spot = document.createElement('div');
            spot.className = `player-spot spot-${i}`;
            spot.id = `spot-${i}`;
            spot.innerHTML = `
                <div class="player-avatar"></div>
                <div class="player-name">Position ${i}</div>
                <div class="player-score">--</div>
                <div class="player-hands"></div>
                <div class="player-streak">🏆 <span>0</span></div>
                <div class="player-status"></div>
            `;
            container.appendChild(spot);
        }
    }

    // ========== GAME DISPLAY UPDATES ========== //
    updateGameDisplay(room) {
        if (!room) return;

        if (!room.players || !Array.isArray(room.players)) {
            room.players = [];
        }

        this.updatePlayerCount(room);
        this.updatePlayerPositions(room);
        this.updateDealerDisplay(room);
        this.updateControls(room);
        this.updateTimer(room);
        this.renderChat(room);
    }

    updatePlayerCount(room) {
        const playerCountElement = document.getElementById('playerCount');
        if (playerCountElement) {
            playerCountElement.textContent = room.players.length;
        }
    }

    updatePlayerPositions(room) {
        // Réinitialiser toutes les positions
        for (let i = 1; i <= 5; i++) {
            const spot = document.getElementById(`spot-${i}`);
            if (!spot) continue;
            
            const avatar = spot.querySelector('.player-avatar');
            const name = spot.querySelector('.player-name');
            const score = spot.querySelector('.player-score');
            const status = spot.querySelector('.player-status');
            const hands = spot.querySelector('.player-hands');
            const streak = spot.querySelector('.player-streak span');
            
            if (!avatar || !name || !score || !status || !hands) continue;
            
            // Reset
            spot.className = `player-spot spot-${i}`;
            avatar.textContent = '';
            name.textContent = `Position ${i}`;
            score.textContent = '--';
            status.textContent = '';
            status.className = 'player-status';
            hands.innerHTML = '';
            if (streak) streak.textContent = '0';
        }

        // Placer les joueurs
        room.players.forEach((player, idx) => {
            const position = player.position || (idx + 1);
            const spot = document.getElementById(`spot-${position}`);
            if (!spot) return;

            const avatar = spot.querySelector('.player-avatar');
            const name = spot.querySelector('.player-name');
            const score = spot.querySelector('.player-score');
            const status = spot.querySelector('.player-status');
            const hands = spot.querySelector('.player-hands');
            const streak = spot.querySelector('.player-streak span');

            if (!avatar || !name || !score || !status || !hands) return;

            // Vérifier si une main est active
            const hasActiveHand = player.hands && player.hands.some(hand => hand.isActive);
            if (hasActiveHand) {
                spot.classList.add('active');
            }

            avatar.textContent = player.name.charAt(0).toUpperCase();
            name.textContent = player.name;
            
            // Afficher les mains du joueur
            this.renderPlayerHands(player, hands, score, status);
            
            // Win streak
            if (streak) streak.textContent = player.winStreak || 0;
        });
    }

    renderPlayerHands(player, handsContainer, scoreElement, statusElement) {
        handsContainer.innerHTML = '';
        
        if (!player.hands || player.hands.length === 0) {
            scoreElement.textContent = '--';
            return;
        }

        // Si une seule main, affichage simple
        if (player.hands.length === 1) {
            const hand = player.hands[0];
            scoreElement.textContent = hand.score || '--';
            this.renderHandCards(hand, handsContainer);
            this.updatePlayerStatus(hand, player, statusElement);
        } else {
            // Plusieurs mains (split) - affichage compact
            scoreElement.textContent = `${player.hands.length} mains`;
            
            player.hands.forEach((hand, index) => {
                const handDiv = document.createElement('div');
                handDiv.className = 'split-hand';
                handDiv.style.cssText = `
                    margin: 2px 0;
                    padding: 2px 4px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 4px;
                    font-size: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                `;
                
                if (hand.isActive) {
                    handDiv.style.borderLeft = '3px solid #00ff88';
                }
                
                const cardsDiv = document.createElement('div');
                cardsDiv.style.display = 'flex';
                cardsDiv.style.gap = '1px';
                
                this.renderHandCards(hand, cardsDiv, true); // mode mini
                
                const scoreDiv = document.createElement('div');
                scoreDiv.textContent = hand.score;
                scoreDiv.style.fontWeight = 'bold';
                
                handDiv.appendChild(cardsDiv);
                handDiv.appendChild(scoreDiv);
                handsContainer.appendChild(handDiv);
            });
            
            // Status global
            if (player.gameResult) {
                statusElement.textContent = player.gameResult === 'win' ? '🎉 Gagne' : 
                                          player.gameResult === 'lose' ? '💀 Perd' : '🤝 Égalité';
                statusElement.className = `player-status ${player.gameResult}`;
            }
        }
    }

    renderHandCards(hand, container, miniMode = false) {
        if (!hand.cards || hand.cards.length === 0) return;
        
        hand.cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = `card ${card.isRed ? 'red' : 'black'}`;
            
            if (miniMode) {
                cardEl.style.cssText = `
                    position: static;
                    width: 16px;
                    height: 24px;
                    font-size: 8px;
                    padding: 1px;
                `;
            } else {
                cardEl.style.cssText = `
                    position: static;
                    width: 28px;
                    height: 40px;
                    font-size: 9px;
                    margin: 1px;
                `;
            }
            
            cardEl.innerHTML = `
                <div class='card-value'>${card.value}</div>
                <div class='card-suit'>${card.suit}</div>
            `;
            container.appendChild(cardEl);
        });
    }

    updatePlayerStatus(hand, player, statusElement) {
        if (hand.finalResult) {
            statusElement.textContent = hand.finalResult === 'win' ? '🎉 Gagne' : 
                                      hand.finalResult === 'lose' ? '💀 Perd' : 
                                      hand.finalResult === 'blackjack' ? '🔥 Blackjack!' : '🤝 Égalité';
            statusElement.className = `player-status ${hand.finalResult === 'blackjack' ? 'win' : hand.finalResult}`;
        } else if (hand.result === 'bust') {
            statusElement.textContent = '💥 Bust';
            statusElement.className = 'player-status lose';
        } else if (hand.result === 'stand') {
            statusElement.textContent = '✋ Reste';
        } else if (player.status === 'blackjack') {
            statusElement.textContent = '🔥 Blackjack!';
            statusElement.className = 'player-status win';
        } else if (hand.isActive) {
            statusElement.textContent = '▶️ Joue';
        }
    }

    updateDealerDisplay(room) {
        const container = document.getElementById('dealerCards');
        const scoreElement = document.getElementById('dealerScore');
        
        if (!container || !scoreElement) return;
        
        container.innerHTML = '';
        
        if (room.dealerCards && room.dealerCards.length > 0) {
            room.dealerCards.forEach(card => {
                const el = document.createElement('div');
                
                if (card.hidden) {
                    el.className = 'card hidden';
                    el.innerHTML = `<div class='card-value'>?</div><div class='card-suit'>🂠</div>`;
                } else {
                    el.className = `card ${card.isRed ? 'red' : 'black'}`;
                    el.innerHTML = `<div class='card-value'>${card.value}</div><div class='card-suit'>${card.suit}</div>`;
                }
                
                el.style.position = 'static';
                el.style.margin = '2px';
                container.appendChild(el);
            });
        }
        
        // Score du croupier
        const hasHiddenCard = room.dealerCards && room.dealerCards.some(card => card.hidden);
        if (hasHiddenCard && room.gameState === 'playing') {
            scoreElement.textContent = '?';
        } else {
            scoreElement.textContent = room.dealerScore || '--';
        }
    }

    updateControls(room) {
        const dealerControls = document.getElementById('dealerControls');
        const playerControls = document.getElementById('playerControls');
        const waitingControls = document.getElementById('waitingControls');
        const dealerPlayBtn = document.getElementById('dealerPlayBtn');
        const doubleBtn = document.getElementById('playerDoubleBtn');
        const splitBtn = document.getElementById('playerSplitBtn');

        // Cacher tous les contrôles
        [dealerControls, playerControls, waitingControls].forEach(el => {
            if (el) el.style.display = 'none';
        });

        if (!room.players || !Array.isArray(room.players)) {
            room.players = [];
        }

        if (this.isDealer) {
            if (dealerControls) dealerControls.style.display = 'flex';
            
            const distributeBtn = dealerControls?.querySelector('button[onclick="startNewHand()"]');
            
            if (room.gameState === 'waiting' || room.gameState === 'finished') {
                if (distributeBtn) distributeBtn.style.display = 'inline-block';
                if (dealerPlayBtn) dealerPlayBtn.style.display = 'none';
            } else if (room.gameState === 'dealer_turn') {
                if (distributeBtn) distributeBtn.style.display = 'none';
                if (dealerPlayBtn) {
                    dealerPlayBtn.style.display = 'inline-block';
                    dealerPlayBtn.textContent = '🎲 Tour croupier';
                    dealerPlayBtn.disabled = false;
                }
            } else {
                if (distributeBtn) distributeBtn.style.display = 'none';
                if (dealerPlayBtn) dealerPlayBtn.style.display = 'none';
            }
        } else {
            const player = room.players.find(p => p.name === this.playerName);
            
            if (player && player.hands) {
                const activeHand = player.hands.find(hand => hand.isActive);
                
                if (activeHand && room.gameState === 'playing') {
                    if (playerControls) playerControls.style.display = 'flex';
                    
                    // Options de jeu
                    if (doubleBtn) {
                        doubleBtn.style.display = activeHand.canDouble ? 'inline-block' : 'none';
                    }
                    if (splitBtn) {
                        splitBtn.style.display = activeHand.canSplit ? 'inline-block' : 'none';
                    }
                } else {
                    if (waitingControls) waitingControls.style.display = 'flex';
                }
            } else {
                if (waitingControls) waitingControls.style.display = 'flex';
            }
        }
    }

    // ========== TIMER MANAGEMENT ========== //
    updateTimer(room) {
        const timerElement = document.getElementById('playerTimer');
        const timerFill = document.getElementById('timerFill');
        const timerText = document.getElementById('timerText');
        
        if (!timerElement || !timerFill || !timerText) return;
        
        if (room.timer && room.gameState === 'playing') {
            timerElement.style.display = 'block';
            
            // Démarrer la mise à jour du timer si pas déjà fait
            if (!this.timerUpdateInterval) {
                this.timerUpdateInterval = setInterval(() => {
                    this.updateTimerDisplay(room);
                }, 100);
            }
        } else {
            timerElement.style.display = 'none';
            this.clearTimerInterval();
        }
    }

    updateTimerDisplay(room) {
        const timerFill = document.getElementById('timerFill');
        const timerText = document.getElementById('timerText');
        
        if (!room.timer || !timerFill || !timerText) return;
        
        const remaining = window.firebaseManager.calculateTimeRemaining(room);
        const percentage = (remaining / (room.timer.duration / 1000)) * 100;
        
        timerFill.style.width = Math.max(0, percentage) + '%';
        timerText.textContent = Math.max(0, remaining);
        
        if (remaining <= 0) {
            this.clearTimerInterval();
        }
    }

    clearTimerInterval() {
        if (this.timerUpdateInterval) {
            clearInterval(this.timerUpdateInterval);
            this.timerUpdateInterval = null;
        }
    }

    // ========== CHAT FUNCTIONS ========== //
    setupChatHandlers() {
        const chatForm = document.getElementById('chatForm');
        const chatInput = document.getElementById('chatInput');
        
        if (chatForm && chatInput) {
            chatForm.onsubmit = async (e) => {
                e.preventDefault();
                const message = chatInput.value.trim();
                if (!message || !this.currentRoom) return;
                
                chatInput.value = '';
                await window.firebaseManager.addChatMessage(this.currentRoom, this.playerName, message);
            };
        }
    }

    renderChat(room) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;
        
        chatMessages.innerHTML = '';
        
        if (room.chat && Array.isArray(room.chat)) {
            room.chat.slice(-50).forEach(msg => {
                const div = document.createElement('div');
                div.style.marginBottom = '4px';
                div.style.fontSize = '12px';
                
                const time = new Date(msg.time).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                div.innerHTML = `
                    <span style='color:#FFD700;font-weight:bold;'>${this.escapeHtml(msg.name)}</span> 
                    <span style='color:#aaa;font-size:10px;'>${time}</span> : 
                    <span style='color:#fff;'>${this.escapeHtml(msg.text)}</span>
                `;
                chatMessages.appendChild(div);
            });
            
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========== NOTIFICATIONS ========== //
    showNotification(message, type = 'info') {
        // Supprimer notification existante
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

    // ========== PARTICLES ANIMATION ========== //
    createParticles() {
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

    // ========== UTILITIES ========== //
    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showNotification('📋 Lien copié!', 'success');
        }).catch(() => {
            this.showNotification('❌ Erreur copie', 'error');
        });
    }

    downloadHTML() {
        const htmlContent = document.documentElement.outerHTML;
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sio-casino-blackjack.html';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('💾 SIO Casino téléchargé!', 'success');
    }

    showShareableLink(roomCode) {
        const url = `${window.location.origin}${window.location.pathname}?roomid=${roomCode}`;
        
        const linkPopup = document.createElement('div');
        linkPopup.style.cssText = `
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
        
        const isDemo = window.firebaseManager.useLocalStorage;
        
        linkPopup.innerHTML = `
            <h3>🎉 SIO Casino - Table créée!</h3>
            <p style="margin: 15px 0; color: #FFD700;">Code: <strong>${roomCode}</strong></p>
            
            ${isDemo ? `
                <div style="background: rgba(255, 165, 0, 0.2); padding: 15px; border-radius: 10px; margin: 15px 0;">
                    <h4>🎮 Mode DEMO SIO</h4>
                    <p style="font-size: 14px; margin: 10px 0;">
                        Actuellement en mode local. Pour un vrai multijoueur :
                    </p>
                    <ol style="text-align: left; font-size: 13px; margin: 10px 0;">
                        <li>Téléchargez tous les fichiers</li>
                        <li>Hébergez-les sur votre serveur</li>
                        <li>Firebase fonctionnera automatiquement !</li>
                    </ol>
                </div>
            ` : ''}
            
            <p style="margin: 10px 0;">Lien de la table :</p>
            <input type="text" value="${url}" style="width: 100%; padding: 10px; border: none; border-radius: 5px; margin: 10px 0; font-family: monospace; font-size: 12px;" readonly onclick="this.select()">
            
            <div style="margin-top: 20px;">
                <button onclick="window.uiManager.copyToClipboard('${url}'); this.parentElement.parentElement.remove();" style="background: #FFD700; color: black; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">📋 Copier</button>
                <button onclick="window.uiManager.downloadHTML()" style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">💾 Télécharger</button>
                <button onclick="this.parentElement.parentElement.remove();" style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin: 5px; cursor: pointer;">Fermer</button>
            </div>
        `;
        
        document.body.appendChild(linkPopup);
        
        setTimeout(() => {
            if (linkPopup.parentElement) {
                linkPopup.remove();
            }
        }, 20000);
    }
}

// Export global
window.UIManager = UIManager;