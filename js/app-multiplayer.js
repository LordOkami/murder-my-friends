/**
 * Murder My Friends - Multiplayer App
 */

// Global state
let mpGame;
let weapons = [];
let pendingPhoto = null;
let pendingGameCode = null;

// Default weapons
const DEFAULT_WEAPONS = [
    'Cuchillo de cocina', 'Sartén', 'Almohada', 'Cuerda', 'Veneno',
    'Tijeras', 'Martillo', 'Lámpara', 'Cable USB', 'Libro pesado',
    'Zapatilla', 'Paraguas', 'Corbata', 'Calcetín mojado', 'Taza de café',
    'Control remoto', 'Pelota de tenis', 'Espátula', 'Regla metálica', 'Botella de vino'
];

/**
 * Initialize app
 */
async function init() {
    createParticles();
    setupEventListeners();

    // Initialize multiplayer game
    mpGame = new MultiplayerGame();
    const firebaseReady = mpGame.init();

    if (!firebaseReady) return;

    // Listen for auth state
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            // Logged in
            document.getElementById('headerActions').style.display = 'flex';
            // Pre-fill profile name
            const username = await getStoredUsername();
            const profileInput = document.getElementById('profileNameInput');
            if (profileInput && username) {
                profileInput.value = username;
            }

            // Try reconnect to existing game
            const reconnected = await mpGame.tryReconnect();
            if (reconnected) {
                mpGame.onGameUpdate = handleGameUpdate;
            } else {
                showScreen('welcomeScreen');
            }
        } else {
            // Not logged in
            document.getElementById('headerActions').style.display = 'none';
            showScreen('authScreen');
        }
    });
}

/**
 * Handle Google login
 */
async function handleGoogleLogin() {
    try {
        await loginWithGoogle();
        showToast('Bienvenido', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Handle logout
 */
async function handleLogout() {
    if (mpGame && mpGame.gameState) {
        await mpGame.leaveGame();
        mpGame.gameState = null;
    }
    await logout();
    showToast('Sesión cerrada', 'info');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Weapon input enter key
    document.getElementById('weaponNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWeapon();
    });

    // Game code input
    document.getElementById('gameCodeInput')?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    // Profile name input enter key
    document.getElementById('profileNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinWithProfile();
    });

    // Profile photo upload
    document.getElementById('profilePhotoInput')?.addEventListener('change', handleProfilePhoto);

    // Mission card click
    document.getElementById('missionCard')?.addEventListener('click', toggleMissionCard);

    // Modal overlay click
    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') hideModal();
    });
}

/**
 * Handle profile photo upload
 */
function handleProfilePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Selecciona una imagen', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        resizeImage(event.target.result, 200, 200, (resized) => {
            pendingPhoto = resized;
            const preview = document.getElementById('profilePhotoPreview');
            preview.innerHTML = `<img src="${resized}" alt="Tu foto">`;
            preview.classList.add('has-photo');
            showToast('Foto lista', 'success');
        });
    };
    reader.readAsDataURL(file);
}

/**
 * Resize image
 */
function resizeImage(dataUrl, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
}

/**
 * Add weapon
 */
function addWeapon() {
    const input = document.getElementById('weaponNameInput');
    const name = input.value.trim();

    if (!name) {
        showToast('Introduce un nombre', 'error');
        return;
    }

    if (weapons.includes(name)) {
        showToast('Ya existe esa arma', 'error');
        return;
    }

    weapons.push(name);
    input.value = '';
    updateWeaponsList();
    showToast(`${name} añadido`, 'success');
    input.focus();
}

/**
 * Remove weapon
 */
function removeWeapon(index) {
    const name = weapons[index];
    weapons.splice(index, 1);
    updateWeaponsList();
    showToast(`${name} eliminado`, 'info');
}

/**
 * Add default weapons
 */
function addDefaultWeapons() {
    let added = 0;
    for (const weapon of DEFAULT_WEAPONS) {
        if (!weapons.includes(weapon)) {
            weapons.push(weapon);
            added++;
        }
    }
    updateWeaponsList();
    showToast(`${added} armas añadidas`, 'success');
}

/**
 * Create multiplayer game (host)
 */
async function createMultiplayerGame() {
    if (!isFirebaseConfigured()) {
        showScreen('firebaseErrorScreen');
        return;
    }

    if (weapons.length < 3) {
        showToast('Añade al menos 3 armas', 'error');
        return;
    }

    try {
        showToast('Creando partida...', 'info');
        const gameCode = await mpGame.createGame(weapons);

        // Setup game update handler
        mpGame.onGameUpdate = handleGameUpdate;

        // Show profile screen for host to join
        pendingGameCode = gameCode;
        showScreen('profileScreen');
        showToast('Partida creada. Ahora crea tu perfil.', 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Show join profile screen
 */
function showJoinProfile() {
    const code = document.getElementById('gameCodeInput').value.trim();
    if (!code) {
        showToast('Introduce el código', 'error');
        return;
    }

    if (!isFirebaseConfigured()) {
        showScreen('firebaseErrorScreen');
        return;
    }

    pendingGameCode = code.toUpperCase();
    pendingPhoto = null;

    // Reset profile form
    document.getElementById('profileNameInput').value = '';
    document.getElementById('profilePhotoPreview').innerHTML = '<span class="profile-photo-placeholder">📷</span>';
    document.getElementById('profilePhotoPreview').classList.remove('has-photo');

    showScreen('profileScreen');
}

/**
 * Join game with profile
 */
async function joinWithProfile() {
    const name = document.getElementById('profileNameInput').value.trim();

    if (!name) {
        showToast('Introduce tu nombre', 'error');
        return;
    }

    try {
        showToast('Uniéndose a la partida...', 'info');

        if (mpGame.isHost) {
            // Host joining their own game
            await mpGame.hostJoinGame(name, pendingPhoto);
        } else {
            // Regular player joining
            await mpGame.joinGame(pendingGameCode, name, pendingPhoto);
        }

        // Setup game update handler
        mpGame.onGameUpdate = handleGameUpdate;

        showScreen('lobbyScreen');
        showToast('¡Te has unido!', 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Handle real-time game updates
 */
function handleGameUpdate(gameState) {
    if (!gameState) return;

    // Update game code displays
    const codeDisplays = ['gameCodeDisplay', 'gameCodeDisplay2'];
    codeDisplays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = gameState.code;
    });

    // Handle different game states
    switch (gameState.status) {
        case 'waiting':
            handleWaitingState(gameState);
            break;
        case 'playing':
            handlePlayingState(gameState);
            break;
        case 'finished':
            handleFinishedState(gameState);
            break;
    }
}

/**
 * Handle waiting state
 */
function handleWaitingState(gameState) {
    // Make sure we're on the lobby screen
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen && currentScreen.id !== 'lobbyScreen' && currentScreen.id !== 'profileScreen') {
        showScreen('lobbyScreen');
    }

    // Render weapons
    renderWeaponsGrid(gameState.weapons, 'weaponsGrid');

    // Render players
    renderPlayersGridLobby(gameState.players, 'playersGrid');

    // Update host controls
    const hostControls = document.getElementById('hostControls');
    const waitingMessage = document.getElementById('waitingMessage');
    const startBtn = document.getElementById('startGameBtn');
    const playerCount = Object.keys(gameState.players || {}).length;

    if (mpGame.isHost) {
        hostControls.style.display = 'block';
        waitingMessage.style.display = 'none';
        startBtn.disabled = playerCount < 3;

        const hint = document.querySelector('.host-hint');
        if (hint) {
            if (playerCount < 3) {
                hint.textContent = `Faltan ${3 - playerCount} jugadores más`;
            } else {
                hint.textContent = '¡Listos para empezar!';
            }
        }
    } else {
        hostControls.style.display = 'none';
        waitingMessage.style.display = 'block';
    }
}

/**
 * Handle playing state
 */
function handlePlayingState(gameState) {
    // Navigate to game screen if not already there
    const currentScreen = document.querySelector('.screen.active');
    const gameScreens = ['gameScreen', 'missionScreen', 'killScreen'];

    if (!currentScreen || !gameScreens.includes(currentScreen.id)) {
        showScreen('gameScreen');
    }

    // Update UI
    renderWeaponsGrid(gameState.weapons, 'weaponsGrid2');
    renderPlayersGridGame(gameState.players, gameState.killedPlayers, 'playersGrid2');

    const totalPlayers = Object.keys(gameState.players || {}).length;
    const killedCount = (gameState.killedPlayers || []).length;
    updateGameProgress(totalPlayers, killedCount);
}

/**
 * Handle finished state
 */
function handleFinishedState(gameState) {
    const winner = gameState.players[gameState.winnerId];
    const totalPlayers = Object.keys(gameState.players || {}).length;
    const killCount = (gameState.killOrder || []).length;

    showGameOverScreen(winner, totalPlayers, killCount);
}

/**
 * Start multiplayer game (host only)
 */
async function startMultiplayerGame() {
    try {
        showToast('Iniciando partida...', 'info');
        await mpGame.startGame();
        showToast('¡La partida ha comenzado!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Show my mission
 */
function showMyMission() {
    // Check if player is dead
    if (!mpGame.isAlive(mpGame.playerId)) {
        showScreen('missionScreen');
        showDeadMessage();
        return;
    }

    const mission = mpGame.getMyMission();
    if (!mission || !mission.target) {
        showToast('No se encontró tu misión', 'error');
        return;
    }

    showScreen('missionScreen');
    showMissionCard(mission.target, mission.weapon, mission.isInherited);
}

/**
 * Show kill select screen
 */
function showKillSelect() {
    if (!mpGame.gameState) return;

    renderKillSelectGrid(mpGame.gameState.players, mpGame.gameState.killedPlayers);
    showScreen('killScreen');
}

/**
 * Confirm kill
 */
function confirmKill(victimId) {
    const victim = mpGame.gameState.players[victimId];

    showModal(`
        <h3>💀 Confirmar Asesinato</h3>
        <p>¿Confirmas que <strong>${escapeHtml(victim.name)}</strong> ha sido eliminado?</p>
        <div class="modal-buttons">
            <button class="btn btn-ghost" onclick="hideModal()">Cancelar</button>
            <button class="btn btn-danger" onclick="executeKill('${victimId}')">Confirmar</button>
        </div>
    `);
}

/**
 * Execute kill
 */
async function executeKill(victimId) {
    hideModal();

    try {
        const result = await mpGame.reportKill(victimId);
        const victim = mpGame.gameState.players[victimId];
        showToast(`${victim.name} ha sido eliminado`, 'success');

        if (!result.isGameOver) {
            showScreen('gameScreen');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Leave game and reset
 */
async function leaveAndReset() {
    hideModal();
    await mpGame.leaveGame();
    weapons = [];
    pendingPhoto = null;
    pendingGameCode = null;

    // Reset UI
    if (document.getElementById('weaponsList')) {
        document.getElementById('weaponsList').innerHTML = '';
    }
    if (document.getElementById('weaponCounter')) {
        document.getElementById('weaponCounter').textContent = '0';
    }

    showScreen('welcomeScreen');
    showToast('Has salido de la partida', 'info');
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

// Export functions
window.addWeapon = addWeapon;
window.removeWeapon = removeWeapon;
window.addDefaultWeapons = addDefaultWeapons;
window.createMultiplayerGame = createMultiplayerGame;
window.showJoinProfile = showJoinProfile;
window.joinWithProfile = joinWithProfile;
window.startMultiplayerGame = startMultiplayerGame;
window.showMyMission = showMyMission;
window.showKillSelect = showKillSelect;
window.confirmKill = confirmKill;
window.executeKill = executeKill;
window.leaveAndReset = leaveAndReset;
window.handleGoogleLogin = handleGoogleLogin;
window.handleLogout = handleLogout;
