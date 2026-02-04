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
        const uid = getAuth().currentUser?.uid;
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
     * Write user game index entry
     */
    async writeUserGameIndex(uid, gameCode, data) {
        await this.db.ref('users/' + uid + '/games/' + gameCode).set(data);
    }

    /**
     * Connect to an existing game (for re-entry from game list)
     */
    async connectToGame(gameCode) {
        if (!this.db) throw new Error('Firebase no inicializado');

        this.gameCode = gameCode;
        this.gameRef = this.db.ref('games/' + gameCode);

        const snapshot = await this.gameRef.once('value');
        if (!snapshot.exists()) throw new Error('Partida no encontrada');

        const gameData = snapshot.val();
        this.playerId = this.getPlayerId();
        this.isHost = gameData.hostId === this.playerId;
        this.gameState = gameData;

        this.subscribeToGame();
        return gameData;
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

        const gameData = {
            code: this.gameCode,
            hostId: this.playerId,
            status: 'waiting',
            weapons: weapons,
            players: {},
            assignments: {},
            killedPlayers: [],
            killOrder: [],
            createdAt: firebase.database.ServerValue.TIMESTAMP
        };

        this.gameRef = this.db.ref('games/' + this.gameCode);
        await this.gameRef.set(gameData);

        await this.writeUserGameIndex(this.playerId, this.gameCode, {
            status: 'waiting',
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: true
        });

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

        const snapshot = await this.gameRef.once('value');
        if (!snapshot.exists()) {
            throw new Error('Partida no encontrada');
        }

        const gameData = snapshot.val();

        if (gameData.status !== 'waiting') {
            throw new Error('La partida ya ha comenzado');
        }

        this.playerId = this.getPlayerId();

        if (gameData.players && gameData.players[this.playerId]) {
            this.isHost = gameData.hostId === this.playerId;
        } else {
            this.isHost = false;

            await this.gameRef.child('players/' + this.playerId).set({
                id: this.playerId,
                name: playerName,
                photo: playerPhoto || null,
                joinedAt: firebase.database.ServerValue.TIMESTAMP,
                ready: true
            });
        }

        await this.writeUserGameIndex(this.playerId, this.gameCode, {
            status: 'waiting',
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            isHost: this.isHost
        });

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

        const uid = this.playerId;
        const code = this.gameCode;

        this.unsubscribe = this.gameRef.on('value', (snapshot) => {
            this.gameState = snapshot.val();

            // Sync status to user game index
            if (this.gameState && uid && code && this.db) {
                this.db.ref('users/' + uid + '/games/' + code + '/status').set(this.gameState.status);
            }

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

        const shuffledPlayers = this.shuffle(players);
        const shuffledWeapons = this.shuffle(weapons);

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

        await this.gameRef.update({
            status: 'playing',
            assignments: assignments,
            startedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    /**
     * Get current target ID (with inheritance through killed players)
     */
    getMyCurrentTargetId() {
        if (!this.gameState || this.gameState.status !== 'playing') {
            return null;
        }

        const assignment = this.gameState.assignments[this.playerId];
        if (!assignment) return null;

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

        return targetId;
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

        const targetId = this.getMyCurrentTargetId();
        const target = this.gameState.players[targetId];
        const weaponIndex = assignment.weaponIndex;
        const weapon = this.gameState.weapons[weaponIndex];
        const isInherited = targetId !== assignment.targetId;

        return {
            target,
            targetId,
            weapon: typeof weapon === 'object' ? weapon.name : weapon,
            isInherited
        };
    }

    /**
     * Request a kill (creates a pending kill for victim to confirm)
     */
    async requestKill(victimId) {
        const myTargetId = this.getMyCurrentTargetId();
        if (victimId !== myTargetId) {
            throw new Error('No es tu objetivo actual');
        }

        const pending = this.gameState.pendingKills?.[victimId];
        if (pending) {
            throw new Error('Ya hay un asesinato pendiente para este jugador');
        }

        const player = this.gameState.players[this.playerId];
        await this.gameRef.child('pendingKills/' + victimId).set({
            killerId: this.playerId,
            killerName: player.name,
            timestamp: Date.now()
        });
    }

    /**
     * Confirm my own death (victim accepts the pending kill)
     */
    async confirmMyDeath() {
        const pendingKill = this.gameState.pendingKills?.[this.playerId];
        if (!pendingKill) {
            throw new Error('No hay asesinato pendiente');
        }

        const killedPlayers = [...(this.gameState.killedPlayers || []), this.playerId];
        const killOrder = [...(this.gameState.killOrder || []), {
            victimId: this.playerId,
            killerId: pendingKill.killerId,
            timestamp: Date.now()
        }];

        const players = Object.keys(this.gameState.players || {});
        const alivePlayers = players.filter(id => !killedPlayers.includes(id));

        const updates = {
            killedPlayers,
            killOrder,
            ['pendingKills/' + this.playerId]: null
        };

        if (alivePlayers.length === 1) {
            updates.status = 'finished';
            updates.winnerId = alivePlayers[0];
            updates.finishedAt = firebase.database.ServerValue.TIMESTAMP;
        }

        await this.gameRef.update(updates);
    }

    /**
     * Reject the pending kill on me
     */
    async rejectKill() {
        await this.gameRef.child('pendingKills/' + this.playerId).remove();
    }

    /**
     * Get pending kill for current player (if any)
     */
    getPendingKillForMe() {
        return this.gameState?.pendingKills?.[this.playerId] || null;
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
     * Add weapon to game (host only)
     */
    async addWeaponToGame(name) {
        if (!this.isHost) throw new Error('Solo el host puede añadir armas');
        const weapons = this.gameState.weapons || [];
        weapons.push(name);
        await this.gameRef.child('weapons').set(weapons);
    }

    /**
     * Remove weapon from game by index (host only)
     */
    async removeWeaponFromGame(index) {
        if (!this.isHost) throw new Error('Solo el host puede quitar armas');
        const weapons = this.gameState.weapons || [];
        weapons.splice(index, 1);
        await this.gameRef.child('weapons').set(weapons);
    }

    /**
     * Suggest a weapon (any player)
     */
    async suggestWeapon(name, playerName) {
        await this.gameRef.child('weaponSuggestions').push({
            name: name,
            suggestedBy: this.playerId,
            suggestedByName: playerName
        });
    }

    /**
     * Approve a weapon suggestion (host only)
     */
    async approveSuggestion(id, name) {
        if (!this.isHost) throw new Error('Solo el host puede aprobar');
        const weapons = this.gameState.weapons || [];
        weapons.push(name);
        await this.gameRef.update({
            weapons: weapons,
            ['weaponSuggestions/' + id]: null
        });
    }

    /**
     * Reject a weapon suggestion (host only)
     */
    async rejectSuggestion(id) {
        if (!this.isHost) throw new Error('Solo el host puede rechazar');
        await this.gameRef.child('weaponSuggestions/' + id).remove();
    }

    /**
     * Leave game
     */
    async leaveGame() {
        this.unsubscribeFromGame();
        this.gameCode = null;
        this.playerId = null;
        this.isHost = false;
        this.gameState = null;
    }
}

// Export
window.MultiplayerGame = MultiplayerGame;
