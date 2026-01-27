/**
 * Murder My Friends - Multiplayer App
 */

// Global state
let activeGame;
let weapons = [];
let pendingPhoto = null;
let pendingGameCode = null;
let userProfile = null;
let editProfilePhoto = null;

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

    activeGame = new MultiplayerGame();
    const firebaseReady = activeGame.init();

    if (!firebaseReady) return;

    // Handle redirect result from mobile Google login
    await handleRedirectResult();

    getAuth().onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById('headerActions').style.display = 'flex';

            // Load profile
            userProfile = await getUserProfile();

            // Refresh home
            refreshHomeScreen();
            showScreen('welcomeScreen');
        } else {
            document.getElementById('headerActions').style.display = 'none';
            showScreen('authScreen');
        }
    });
}

/**
 * Refresh home screen: profile summary + games list
 */
async function refreshHomeScreen() {
    if (userProfile) {
        renderProfileSummary(userProfile);
    }
    await loadMyGames();
}

/**
 * Load user's games from index
 */
async function loadMyGames() {
    const uid = getCurrentUid();
    if (!uid) return;

    try {
        const snap = await firebase.database().ref('users/' + uid + '/games').once('value');
        const gamesIndex = snap.val();
        if (!gamesIndex) {
            renderMyGamesList([]);
            return;
        }

        const codes = Object.keys(gamesIndex);
        const games = [];

        for (const code of codes) {
            try {
                const gameSnap = await firebase.database().ref('games/' + code).once('value');
                if (gameSnap.exists()) {
                    const data = gameSnap.val();
                    games.push({
                        code: code,
                        status: data.status || 'waiting',
                        playerCount: Object.keys(data.players || {}).length
                    });
                }
            } catch (e) {
                // Game may have been deleted
            }
        }

        // Sort: playing first, then waiting, then finished
        const order = { playing: 0, waiting: 1, finished: 2 };
        games.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));

        renderMyGamesList(games);
    } catch (e) {
        console.error('Error loading games:', e);
        renderMyGamesList([]);
    }
}

/**
 * Enter a game from the list
 */
async function enterGame(gameCode) {
    try {
        showToast('Conectando...', 'info');
        const gameData = await activeGame.connectToGame(gameCode);
        activeGame.onGameUpdate = handleGameUpdate;

        switch (gameData.status) {
            case 'waiting':
                showScreen('lobbyScreen');
                break;
            case 'playing':
                showScreen('gameScreen');
                break;
            case 'finished':
                handleFinishedState(gameData);
                break;
            default:
                showScreen('lobbyScreen');
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Show edit profile screen
 */
function showEditProfile() {
    editProfilePhoto = userProfile?.photo || null;

    const nameInput = document.getElementById('editProfileNameInput');
    const photoPreview = document.getElementById('editProfilePhotoPreview');

    if (nameInput) nameInput.value = userProfile?.username || '';
    if (photoPreview) {
        if (editProfilePhoto) {
            photoPreview.innerHTML = `<img src="${editProfilePhoto}" alt="Tu foto">`;
            photoPreview.classList.add('has-photo');
        } else {
            photoPreview.innerHTML = '<span class="profile-photo-placeholder">📷</span>';
            photoPreview.classList.remove('has-photo');
        }
    }

    showScreen('editProfileScreen');
}

/**
 * Save profile
 */
async function saveProfile() {
    const name = document.getElementById('editProfileNameInput').value.trim();
    if (!name) {
        showToast('Introduce tu nombre', 'error');
        return;
    }

    try {
        await saveUserProfile(name, editProfilePhoto);
        userProfile = { username: name, photo: editProfilePhoto };
        renderProfileSummary(userProfile);
        showToast('Perfil guardado', 'success');
        backToHome();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Toggle custom profile for a game
 */
function toggleCustomProfile() {
    const checked = document.getElementById('customProfileToggle').checked;
    const photoSection = document.getElementById('profilePhotoSection');
    const nameSection = document.getElementById('profileNameSection');
    const nameInput = document.getElementById('profileNameInput');

    if (checked) {
        // Enable custom fields
        photoSection.style.display = '';
        nameSection.style.display = '';
        nameInput.value = '';
        pendingPhoto = null;
        document.getElementById('profilePhotoPreview').innerHTML = '<span class="profile-photo-placeholder">📷</span>';
        document.getElementById('profilePhotoPreview').classList.remove('has-photo');
    } else {
        // Use profile defaults
        photoSection.style.display = 'none';
        nameSection.style.display = 'none';
        if (userProfile) {
            nameInput.value = userProfile.username || '';
            pendingPhoto = userProfile.photo || null;
        }
    }
}

/**
 * Back to home
 */
function backToHome() {
    if (activeGame && activeGame.gameState) {
        activeGame.unsubscribeFromGame();
        activeGame.gameCode = null;
        activeGame.playerId = null;
        activeGame.isHost = false;
        activeGame.gameState = null;
    }
    refreshHomeScreen();
    showScreen('welcomeScreen');
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
    if (activeGame && activeGame.gameState) {
        await activeGame.leaveGame();
        activeGame.gameState = null;
    }
    userProfile = null;
    await logout();
    showToast('Sesión cerrada', 'info');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    document.getElementById('weaponNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWeapon();
    });

    document.getElementById('gameCodeInput')?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    document.getElementById('profileNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinWithProfile();
    });

    document.getElementById('profilePhotoInput')?.addEventListener('change', handleProfilePhoto);

    document.getElementById('editProfilePhotoInput')?.addEventListener('change', handleEditProfilePhoto);

    document.getElementById('missionCard')?.addEventListener('click', toggleMissionCard);

    document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') hideModal();
    });
}

/**
 * Handle profile photo upload (game join)
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
 * Handle edit profile photo upload
 */
function handleEditProfilePhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Selecciona una imagen', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        resizeImage(event.target.result, 200, 200, (resized) => {
            editProfilePhoto = resized;
            const preview = document.getElementById('editProfilePhotoPreview');
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
        const gameCode = await activeGame.createGame(weapons);

        activeGame.onGameUpdate = handleGameUpdate;

        pendingGameCode = gameCode;
        prepareProfileScreen();
        showScreen('profileScreen');
        showToast('Partida creada. Ahora crea tu perfil.', 'success');

    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Prepare profile screen with defaults from user profile
 */
function prepareProfileScreen() {
    const toggle = document.getElementById('customProfileToggle');
    const photoSection = document.getElementById('profilePhotoSection');
    const nameSection = document.getElementById('profileNameSection');
    const nameInput = document.getElementById('profileNameInput');

    // Default: use profile (toggle unchecked)
    if (toggle) toggle.checked = false;

    if (userProfile) {
        nameInput.value = userProfile.username || '';
        pendingPhoto = userProfile.photo || null;

        if (pendingPhoto) {
            const preview = document.getElementById('profilePhotoPreview');
            preview.innerHTML = `<img src="${pendingPhoto}" alt="Tu foto">`;
            preview.classList.add('has-photo');
        }

        // Hide custom fields by default
        photoSection.style.display = 'none';
        nameSection.style.display = 'none';
    } else {
        // No profile yet, show fields
        photoSection.style.display = '';
        nameSection.style.display = '';
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

    prepareProfileScreen();
    showScreen('profileScreen');
}

/**
 * Join game with profile
 */
async function joinWithProfile() {
    const toggle = document.getElementById('customProfileToggle');
    const isCustom = toggle && toggle.checked;

    let name, photo;

    if (isCustom) {
        name = document.getElementById('profileNameInput').value.trim();
        photo = pendingPhoto;
    } else if (userProfile) {
        name = userProfile.username;
        photo = userProfile.photo;
    } else {
        name = document.getElementById('profileNameInput').value.trim();
        photo = pendingPhoto;
    }

    if (!name) {
        showToast('Introduce tu nombre', 'error');
        return;
    }

    try {
        showToast('Uniéndose a la partida...', 'info');

        if (activeGame.isHost) {
            await activeGame.hostJoinGame(name, photo);
        } else {
            await activeGame.joinGame(pendingGameCode, name, photo);
        }

        activeGame.onGameUpdate = handleGameUpdate;

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

    const codeDisplays = ['gameCodeDisplay', 'gameCodeDisplay2'];
    codeDisplays.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = gameState.code;
    });

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
    const currentScreen = document.querySelector('.screen.active');
    if (currentScreen && currentScreen.id !== 'lobbyScreen' && currentScreen.id !== 'profileScreen') {
        showScreen('lobbyScreen');
    }

    renderWeaponsGrid(gameState.weapons, 'weaponsGrid');
    renderPlayersGridLobby(gameState.players, 'playersGrid');

    const hostControls = document.getElementById('hostControls');
    const waitingMessage = document.getElementById('waitingMessage');
    const startBtn = document.getElementById('startGameBtn');
    const playerCount = Object.keys(gameState.players || {}).length;

    if (activeGame.isHost) {
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
    const currentScreen = document.querySelector('.screen.active');
    const gameScreens = ['gameScreen', 'missionScreen', 'killScreen'];

    if (!currentScreen || !gameScreens.includes(currentScreen.id)) {
        showScreen('gameScreen');
    }

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
        await activeGame.startGame();
        showToast('¡La partida ha comenzado!', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Show my mission
 */
function showMyMission() {
    if (!activeGame.isAlive(activeGame.playerId)) {
        showScreen('missionScreen');
        showDeadMessage();
        return;
    }

    const mission = activeGame.getMyMission();
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
    if (!activeGame.gameState) return;

    renderKillSelectGrid(activeGame.gameState.players, activeGame.gameState.killedPlayers);
    showScreen('killScreen');
}

/**
 * Confirm kill
 */
function confirmKill(victimId) {
    const victim = activeGame.gameState.players[victimId];

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
        const result = await activeGame.reportKill(victimId);
        const victim = activeGame.gameState.players[victimId];
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
    await activeGame.leaveGame();
    weapons = [];
    pendingPhoto = null;
    pendingGameCode = null;

    if (document.getElementById('weaponsList')) {
        document.getElementById('weaponsList').innerHTML = '';
    }
    if (document.getElementById('weaponCounter')) {
        document.getElementById('weaponCounter').textContent = '0';
    }

    refreshHomeScreen();
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
window.showEditProfile = showEditProfile;
window.saveProfile = saveProfile;
window.toggleCustomProfile = toggleCustomProfile;
window.backToHome = backToHome;
window.enterGame = enterGame;
window.refreshHomeScreen = refreshHomeScreen;
