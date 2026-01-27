/**
 * Murder My Friends - Multiplayer Logic with Firebase
 */

class MultiplayerGame {
    constructor() {
        this.db = null;
        this.gameRef = null;
        this.gameCode = null;
        this.playerId = null;
        this.isHost = false;
        this.unsubscribe = null;
        this.gameState = null;
    }

    /**
     * Initialize Firebase
     */
    init() {
        if (!isFirebaseConfigured()) {
            console.warn('Firebase not configured - running in local mode');
            return false;
        }

        try {
            // Initialize Firebase
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            this.db = firebase.database();
            return true;
        } catch (error) {
            console.error('Firebase init error:', error);
            return false;
        }
    }

    /**
     * Get player ID from Firebase Auth
     */
    getPlayerId() {
        const uid = firebase.auth().currentUser?.uid;
        if (!uid) throw new Error('No hay sesión activa');
        return uid;
    }

    /**
     * Generate game code
     */
    generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Create a new game as host
     */
    async createGame(weapons) {
        if (!this.db) {
            throw new Error('Firebase no inicializado');
        }

        this.gameCode = this.generateGameCode();
        this.playerId = this.getPlayerId();
        this.isHost = true;

        localStorage.setItem('mmf_gameCode', this.gameCode);

        const gameData = {
            code: this.gameCode,
            hostId: this.playerId,
            status: 'waiting', // waiting, playing, finished
            weapons: weapons,
            players: {},
            assignments: {},
            killedPlayers: [],
            killOrder: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        this.gameRef = this.db.ref('games/' + this.gameCode);
        await this.gameRef.set(gameData);

        this.subscribeToGame();
        return this.gameCode;
    }

    /**
     * Join an existing game
     */
    async joinGame(gameCode, playerName, playerPhoto) {
        if (!this.db) {
            throw new Error('Firebase no inicializado');
        }

        this.gameCode = gameCode.toUpperCase();
        this.gameRef = this.db.ref('games/' + this.gameCode);

        // Check if game exists
        const snapshot = await this.gameRef.once('value');
        if (!snapshot.exists()) {
            throw new Error('Partida no encontrada');
        }

        const gameData = snapshot.val();

        // Check game status
        if (gameData.status !== 'waiting') {
            throw new Error('La partida ya ha comenzado');
        }

        this.playerId = this.getPlayerId();

        if (gameData.players && gameData.players[this.playerId]) {
            // Rejoining existing game
            this.isHost = gameData.hostId === this.playerId;
        } else {
            // New player
            this.isHost = false;

            await this.gameRef.child('players/' + this.playerId).set({
                id: this.playerId,
                name: playerName,
                photo: playerPhoto || null,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                ready: true
            });
        }

        localStorage.setItem('mmf_gameCode', this.gameCode);

        this.subscribeToGame();
        return this.playerId;
    }

    /**
     * Host joins their own game with their profile
     */
    async hostJoinGame(playerName, playerPhoto) {
        if (!this.gameRef) {
            throw new Error('No hay partida activa');
        }

        await this.gameRef.child('players/' + this.playerId).set({
            id: this.playerId,
            name: playerName,
            photo: playerPhoto || null,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            ready: true,
            isHost: true
        });
    }

    /**
     * Subscribe to real-time game updates
     */
    subscribeToGame() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }

        this.unsubscribe = this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();
            if (this.onGameUpdate) {
                this.onGameUpdate(this.gameState);
            }
        });
    }

    /**
     * Unsubscribe from game updates
     */
    unsubscribeFromGame() {
        if (this.unsubscribe && this.gameRef) {
            this.gameRef.off('value', this.unsubscribe);
            this.unsubscribe = null;
        }
    }

    /**
     * Fisher-Yates shuffle
     */
    shuffle(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Start the game (host only)
     */
    async startGame() {
        if (!this.isHost) {
            throw new Error('Solo el anfitrión puede iniciar la partida');
        }

        const players = Object.values(this.gameState.players || {});
        const weapons = this.gameState.weapons || [];

        if (players.length < 3) {
            throw new Error('Se necesitan al menos 3 jugadores');
        }

        if (weapons.length < players.length) {
            throw new Error('Se necesitan más armas que jugadores');
        }

        // Shuffle players for random cyclic order
        const shuffledPlayers = this.shuffle(players);
        const shuffledWeapons = this.shuffle(weapons);

        // Create cyclic assignments
        const assignments = {};
        for (let i = 0; i < shuffledPlayers.length; i++) {
            const killer = shuffledPlayers[i];
            const targetIndex = (i + 1) % shuffledPlayers.length;
            const target = shuffledPlayers[targetIndex];
            const weapon = shuffledWeapons[i];

            assignments[killer.id] = {
                targetId: target.id,
                weaponIndex: weapons.indexOf(weapon.name !== undefined ? weapon.name : weapon)
            };
        }

        // Update game state
        await this.gameRef.update({
            status: 'playing',
            assignments: assignments,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    /**
     * Get current player's mission
     */
    getMyMission() {
        if (!this.gameState || this.gameState.status !== 'playing') {
            return null;
        }

        const assignment = this.gameState.assignments[this.playerId];
        if (!assignment) {
            return null;
        }

        // Follow the chain if target is dead
        let targetId = assignment.targetId;
        const killedPlayers = this.gameState.killedPlayers || [];
        const visited = new Set([this.playerId]);

        while (killedPlayers.includes(targetId) && !visited.has(targetId)) {
            visited.add(targetId);
            const nextAssignment = this.gameState.assignments[targetId];
            if (nextAssignment) {
                targetId = nextAssignment.targetId;
            } else {
                break;
            }
        }

        const target = this.gameState.players[targetId];
        const weaponIndex = assignment.weaponIndex;
        const weapon = this.gameState.weapons[weaponIndex];
        const isInherited = targetId !== assignment.targetId;

        return {
            target,
            weapon: typeof weapon === 'object' ? weapon.name : weapon,
            isInherited
        };
    }

    /**
     * Report a kill
     */
    async reportKill(victimId) {
        const killedPlayers = this.gameState.killedPlayers || [];

        if (killedPlayers.includes(victimId)) {
            throw new Error('Este jugador ya está eliminado');
        }

        const newKilledPlayers = [...killedPlayers, victimId];
        const killOrder = this.gameState.killOrder || [];

        killOrder.push({
            victimId,
            timestamp: Date.now()
        });

        // Check for winner
        const players = Object.keys(this.gameState.players || {});
        const alivePlayers = players.filter(id => !newKilledPlayers.includes(id));

        const updates = {
            killedPlayers: newKilledPlayers,
            killOrder: killOrder
        };

        if (alivePlayers.length === 1) {
            updates.status = 'finished';
            updates.winnerId = alivePlayers[0];
            updates.finishedAt = firebase.database.ServerValue.TIMESTAMP;
        }

        await this.gameRef.update(updates);

        return {
            isGameOver: alivePlayers.length === 1,
            winnerId: alivePlayers.length === 1 ? alivePlayers[0] : null
        };
    }

    /**
     * Get alive players
     */
    getAlivePlayers() {
        if (!this.gameState || !this.gameState.players) return [];
        const killedPlayers = this.gameState.killedPlayers || [];
        return Object.values(this.gameState.players).filter(p => !killedPlayers.includes(p.id));
    }

    /**
     * Get all players
     */
    getAllPlayers() {
        if (!this.gameState || !this.gameState.players) return [];
        return Object.values(this.gameState.players);
    }

    /**
     * Check if player is alive
     */
    isAlive(playerId) {
        const killedPlayers = this.gameState?.killedPlayers || [];
        return !killedPlayers.includes(playerId);
    }

    /**
     * Get winner
     */
    getWinner() {
        if (!this.gameState || this.gameState.status !== 'finished') return null;
        return this.gameState.players[this.gameState.winnerId];
    }

    /**
     * Leave game
     */
    async leaveGame() {
        this.unsubscribeFromGame();
        localStorage.removeItem('mmf_gameCode');
        this.gameCode = null;
        this.playerId = null;
        this.isHost = false;
        this.gameState = null;
    }

    /**
     * Try to reconnect to previous game
     */
    async tryReconnect() {
        const savedGameCode = localStorage.getItem('mmf_gameCode');
        const currentUid = firebase.auth().currentUser?.uid;

        if (!currentUid || !savedGameCode || !this.db) {
            return false;
        }

        try {
            this.gameRef = this.db.ref('games/' + savedGameCode);
            const snapshot = await this.gameRef.once('value');

            if (!snapshot.exists()) {
                this.leaveGame();
                return false;
            }

            const gameData = snapshot.val();

            if (!gameData.players || !gameData.players[currentUid]) {
                this.leaveGame();
                return false;
            }

            this.gameCode = savedGameCode;
            this.playerId = currentUid;
            this.isHost = gameData.hostId === currentUid;
            this.subscribeToGame();

            return true;
        } catch (error) {
            console.error('Reconnect error:', error);
            return false;
        }
    }
}

// Export
window.MultiplayerGame = MultiplayerGame;
