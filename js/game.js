/**
 * Murder My Friends - Game Logic
 */

class Game {
    constructor() {
        this.reset();
    }

    reset() {
        this.gameCode = null;
        this.players = [];
        this.weapons = [];
        this.assignments = new Map(); // playerId -> { targetId, weaponId }
        this.killedPlayers = new Set();
        this.killOrder = []; // History of kills: [{ killerId, victimId, weapon, timestamp }]
        this.isActive = false;
    }

    /**
     * Generate a unique game code
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
     * Add a player to the game
     */
    addPlayer(name, photo = null) {
        const id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const player = {
            id,
            name: name.trim(),
            photo, // Base64 string or null
            createdAt: Date.now()
        };
        this.players.push(player);
        return player;
    }

    /**
     * Remove a player by ID
     */
    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    /**
     * Add a weapon to the game
     */
    addWeapon(name) {
        const id = 'weapon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const weapon = {
            id,
            name: name.trim(),
            createdAt: Date.now()
        };
        this.weapons.push(weapon);
        return weapon;
    }

    /**
     * Remove a weapon by ID
     */
    removeWeapon(weaponId) {
        this.weapons = this.weapons.filter(w => w.id !== weaponId);
    }

    /**
     * Validate game setup before starting
     */
    validate() {
        const errors = [];

        if (this.players.length < 3) {
            errors.push('Se necesitan al menos 3 jugadores');
        }

        if (this.weapons.length < this.players.length) {
            errors.push(`Se necesitan al menos ${this.players.length} armas (tienes ${this.weapons.length})`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Fisher-Yates shuffle algorithm
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
     * Start the game - create cyclic assignments
     */
    startGame() {
        const validation = this.validate();
        if (!validation.valid) {
            throw new Error(validation.errors.join(', '));
        }

        // Generate game code
        this.gameCode = this.generateGameCode();

        // Shuffle players to create random cyclic order
        const shuffledPlayers = this.shuffle(this.players);

        // Shuffle weapons
        const shuffledWeapons = this.shuffle(this.weapons);

        // Create cyclic assignments
        // Player 0 kills Player 1, Player 1 kills Player 2, ..., Player N kills Player 0
        this.assignments.clear();

        for (let i = 0; i < shuffledPlayers.length; i++) {
            const killer = shuffledPlayers[i];
            const targetIndex = (i + 1) % shuffledPlayers.length;
            const target = shuffledPlayers[targetIndex];
            const weapon = shuffledWeapons[i];

            this.assignments.set(killer.id, {
                targetId: target.id,
                weaponId: weapon.id
            });
        }

        this.isActive = true;
        this.killedPlayers.clear();
        this.killOrder = [];

        // Save to localStorage
        this.save();

        return this.gameCode;
    }

    /**
     * Get a player's assignment (their mission)
     */
    getAssignment(playerId) {
        const assignment = this.assignments.get(playerId);
        if (!assignment) return null;

        const target = this.players.find(p => p.id === assignment.targetId);
        const weapon = this.weapons.find(w => w.id === assignment.weaponId);

        return {
            target,
            weapon
        };
    }

    /**
     * Get current valid target for a player (follows the chain if target is dead)
     */
    getCurrentTarget(playerId) {
        let assignment = this.assignments.get(playerId);
        if (!assignment) return null;

        // Follow the chain until we find a living target
        let targetId = assignment.targetId;
        let visited = new Set([playerId]);

        while (this.killedPlayers.has(targetId) && !visited.has(targetId)) {
            visited.add(targetId);
            const nextAssignment = this.assignments.get(targetId);
            if (nextAssignment) {
                targetId = nextAssignment.targetId;
            } else {
                break;
            }
        }

        const target = this.players.find(p => p.id === targetId);
        const weapon = this.weapons.find(w => w.id === assignment.weaponId);

        return { target, weapon };
    }

    /**
     * Report a kill
     */
    reportKill(victimId) {
        if (this.killedPlayers.has(victimId)) {
            throw new Error('Este jugador ya está muerto');
        }

        const victim = this.players.find(p => p.id === victimId);
        if (!victim) {
            throw new Error('Jugador no encontrado');
        }

        // Find who killed this victim
        let killerId = null;
        for (const [pId, assignment] of this.assignments) {
            if (!this.killedPlayers.has(pId)) {
                const currentTarget = this.getCurrentTarget(pId);
                if (currentTarget && currentTarget.target && currentTarget.target.id === victimId) {
                    killerId = pId;
                    break;
                }
            }
        }

        // Mark as killed
        this.killedPlayers.add(victimId);

        // Record kill
        this.killOrder.push({
            killerId,
            victimId,
            timestamp: Date.now()
        });

        // Check for winner
        const alivePlayers = this.players.filter(p => !this.killedPlayers.has(p.id));

        if (alivePlayers.length === 1) {
            this.isActive = false;
        }

        this.save();

        return {
            victim,
            alivePlayers,
            isGameOver: alivePlayers.length === 1,
            winner: alivePlayers.length === 1 ? alivePlayers[0] : null
        };
    }

    /**
     * Get alive players
     */
    getAlivePlayers() {
        return this.players.filter(p => !this.killedPlayers.has(p.id));
    }

    /**
     * Get dead players
     */
    getDeadPlayers() {
        return this.players.filter(p => this.killedPlayers.has(p.id));
    }

    /**
     * Check if a player is alive
     */
    isAlive(playerId) {
        return !this.killedPlayers.has(playerId);
    }

    /**
     * Get the winner (if game is over)
     */
    getWinner() {
        const alivePlayers = this.getAlivePlayers();
        if (alivePlayers.length === 1) {
            return alivePlayers[0];
        }
        return null;
    }

    /**
     * Save game state to localStorage
     */
    save() {
        const state = {
            gameCode: this.gameCode,
            players: this.players,
            weapons: this.weapons,
            assignments: Array.from(this.assignments.entries()),
            killedPlayers: Array.from(this.killedPlayers),
            killOrder: this.killOrder,
            isActive: this.isActive
        };
        localStorage.setItem('murderMyFriends_game', JSON.stringify(state));
        localStorage.setItem('murderMyFriends_gameCode', this.gameCode);
    }

    /**
     * Load game state from localStorage
     */
    load(gameCode = null) {
        const codeToLoad = gameCode || localStorage.getItem('murderMyFriends_gameCode');
        if (!codeToLoad) return false;

        const saved = localStorage.getItem('murderMyFriends_game');
        if (!saved) return false;

        try {
            const state = JSON.parse(saved);
            if (state.gameCode !== codeToLoad) return false;

            this.gameCode = state.gameCode;
            this.players = state.players || [];
            this.weapons = state.weapons || [];
            this.assignments = new Map(state.assignments || []);
            this.killedPlayers = new Set(state.killedPlayers || []);
            this.killOrder = state.killOrder || [];
            this.isActive = state.isActive;

            return true;
        } catch (e) {
            console.error('Error loading game:', e);
            return false;
        }
    }

    /**
     * Export game state for sharing
     */
    export() {
        return {
            gameCode: this.gameCode,
            players: this.players,
            weapons: this.weapons,
            assignments: Array.from(this.assignments.entries()),
            killedPlayers: Array.from(this.killedPlayers),
            killOrder: this.killOrder,
            isActive: this.isActive
        };
    }

    /**
     * Import game state
     */
    import(state) {
        this.gameCode = state.gameCode;
        this.players = state.players || [];
        this.weapons = state.weapons || [];
        this.assignments = new Map(state.assignments || []);
        this.killedPlayers = new Set(state.killedPlayers || []);
        this.killOrder = state.killOrder || [];
        this.isActive = state.isActive;
        this.save();
    }
}

// Default weapons suggestions
const DEFAULT_WEAPONS = [
    'Cuchillo de cocina',
    'Sartén',
    'Almohada',
    'Cuerda',
    'Veneno',
    'Tijeras',
    'Martillo',
    'Lámpara',
    'Cable USB',
    'Libro pesado',
    'Zapatilla',
    'Paraguas',
    'Corbata',
    'Calcetín mojado',
    'Taza de café',
    'Control remoto',
    'Pelota de tenis',
    'Espátula',
    'Regla metálica',
    'Botella de vino'
];

// Export for use
window.Game = Game;
window.DEFAULT_WEAPONS = DEFAULT_WEAPONS;
