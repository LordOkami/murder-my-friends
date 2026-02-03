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
let pendingAction = null;
let pendingAuthPhoto = null;
let webcamStream = null;
let webcamTarget = null;

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

    // Handle Google redirect result (fallback when popup is blocked)
    try {
        const result = await getAuth().getRedirectResult();
        if (result && result.user) {
            await ensureUserCreated(result.user);
        }
    } catch (e) { /* handled by onAuthStateChanged */ }

    // Detect ?code= in URL for direct join links
    try {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get('code');
        if (urlCode) {
            // Clean URL without reloading
            window.history.replaceState({}, '', window.location.pathname);
            pendingAction = { type: 'joinGame', code: urlCode.toUpperCase() };
        }
    } catch (e) { /* ignore */ }

    // Restore pendingAction from sessionStorage (Google redirect on mobile)
    try {
        const stored = sessionStorage.getItem('pendingAction');
        if (stored) {
            pendingAction = JSON.parse(stored);
            sessionStorage.removeItem('pendingAction');
        }
        const storedWeapons = sessionStorage.getItem('pendingWeapons');
        if (storedWeapons) {
            weapons = JSON.parse(storedWeapons);
            sessionStorage.removeItem('pendingWeapons');
        }
    } catch (e) { /* ignore */ }

    getAuth().onAuthStateChanged(async (user) => {
        if (user) {
            document.getElementById('headerLoggedIn').style.display = 'flex';
            document.getElementById('headerLoggedOut').style.display = 'none';

            // Ensure user DB record exists (covers redirect login)
            await ensureUserCreated(user);

            // Load profile
            userProfile = await getUserProfile();

            // Update welcome screen for logged-in state
            updateWelcomeForLoggedIn();

            // Execute pending action if any (e.g. after auth redirect)
            if (pendingAction) {
                executePendingAction();
            }
        } else {
            document.getElementById('headerLoggedIn').style.display = 'none';
            document.getElementById('headerLoggedOut').style.display = '';
            userProfile = null;

            // Update welcome screen for logged-out state
            updateWelcomeForLoggedOut();
        }
    });
}

/**
 * Refresh home screen: profile summary + games list
 */
async function refreshHomeScreen() {
    if (!getCurrentUid()) return;
    if (userProfile) {
        renderProfileSummary(userProfile);
    }
    await loadMyGames();
}

/**
 * Update welcome screen for logged-in user
 */
function updateWelcomeForLoggedIn() {
    document.getElementById('profileSummary').style.display = '';
    document.getElementById('myGamesSection').style.display = '';
    if (userProfile) {
        renderProfileSummary(userProfile);
    }
    loadMyGames();
}

/**
 * Update welcome screen for logged-out user
 */
function updateWelcomeForLoggedOut() {
    document.getElementById('profileSummary').style.display = 'none';
    document.getElementById('myGamesSection').style.display = 'none';
}

/**
 * Show auth screen, optionally storing a pending action to resume after login
 */
function showAuthScreen(action) {
    if (action) {
        pendingAction = action;
        // Persist for Google redirect on mobile
        try {
            sessionStorage.setItem('pendingAction', JSON.stringify(action));
            if (weapons.length > 0) {
                sessionStorage.setItem('pendingWeapons', JSON.stringify(weapons));
            }
        } catch (e) { /* ignore */ }
    } else {
        pendingAction = { type: 'headerLogin' };
    }

    // Reset auth form state
    isRegisterMode = false;
    const nameInput = document.getElementById('authDisplayName');
    const photoSection = document.getElementById('authPhotoSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleLink = document.getElementById('authToggleLink');

    nameInput.classList.add('auth-hidden');
    nameInput.required = false;
    photoSection.classList.add('auth-hidden');
    submitBtn.textContent = 'Entrar';
    toggleText.textContent = '¿No tienes cuenta?';
    toggleLink.textContent = 'Regístrate';
    pendingAuthPhoto = null;

    // Clear form values
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
    nameInput.value = '';
    const preview = document.getElementById('authPhotoPreview');
    preview.innerHTML = '<span class="profile-photo-placeholder" style="font-size:2rem;">📷</span>';
    preview.classList.remove('has-photo');

    showScreen('authScreen');
}

/**
 * Cancel auth and return to welcome
 */
function cancelAuth() {
    pendingAction = null;
    pendingAuthPhoto = null;
    try {
        sessionStorage.removeItem('pendingAction');
        sessionStorage.removeItem('pendingWeapons');
    } catch (e) { /* ignore */ }
    showScreen('welcomeScreen');
}

/**
 * Execute a pending action after successful auth
 */
function executePendingAction() {
    const action = pendingAction;
    pendingAction = null;
    try {
        sessionStorage.removeItem('pendingAction');
    } catch (e) { /* ignore */ }

    if (!action) return;

    switch (action.type) {
        case 'createGame':
            doCreateMultiplayerGame();
            break;
        case 'joinGame':
            pendingGameCode = action.code;
            pendingPhoto = null;
            prepareProfileScreen();
            showScreen('profileScreen');
            break;
        case 'headerLogin':
            // Just refresh welcome, already handled by onAuthStateChanged
            showScreen('welcomeScreen');
            break;
    }
}

/**
 * Internal: actually create the multiplayer game (after auth is confirmed)
 */
async function doCreateMultiplayerGame() {
    if (weapons.length < 3) {
        showToast('Añade al menos 3 armas', 'error');
        showScreen('createGameScreen');
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
 * Handle auth photo upload
 */
function handleAuthPhoto(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('Selecciona una imagen', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        resizeImage(event.target.result, 200, 200, (resized) => {
            pendingAuthPhoto = resized;
            const preview = document.getElementById('authPhotoPreview');
            preview.innerHTML = `<img src="${resized}" alt="Tu foto">`;
            preview.classList.add('has-photo');
            showToast('Foto lista', 'success');
        });
    };
    reader.readAsDataURL(file);
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
 * Auth mode state
 */
let isRegisterMode = false;

/**
 * Toggle between login and register
 */
function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const nameInput = document.getElementById('authDisplayName');
    const photoSection = document.getElementById('authPhotoSection');
    const submitBtn = document.getElementById('authSubmitBtn');
    const toggleText = document.getElementById('authToggleText');
    const toggleLink = document.getElementById('authToggleLink');

    if (isRegisterMode) {
        nameInput.classList.remove('auth-hidden');
        nameInput.required = true;
        photoSection.classList.remove('auth-hidden');
        submitBtn.textContent = 'Crear cuenta';
        toggleText.textContent = '¿Ya tienes cuenta?';
        toggleLink.textContent = 'Inicia sesión';
    } else {
        nameInput.classList.add('auth-hidden');
        nameInput.required = false;
        photoSection.classList.add('auth-hidden');
        pendingAuthPhoto = null;
        submitBtn.textContent = 'Entrar';
        toggleText.textContent = '¿No tienes cuenta?';
        toggleLink.textContent = 'Regístrate';
    }
}

/**
 * Handle email login or register
 */
async function handleEmailLogin() {
    const btn = document.getElementById('authSubmitBtn');
    if (btn.disabled) return;

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!email || !password) {
        showToast('Introduce email y contraseña', 'error');
        return;
    }

    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Cargando...';

    try {
        if (isRegisterMode) {
            const name = document.getElementById('authDisplayName').value.trim();
            if (!name) {
                showToast('Introduce tu nombre', 'error');
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }
            await registerWithEmail(email, password, name, pendingAuthPhoto);
            showToast('Cuenta creada', 'success');
        } else {
            await loginWithEmail(email, password);
            showToast('Bienvenido', 'success');
        }
    } catch (error) {
        if (error.notRegistered) {
            showToast('Este email no está registrado', 'error');
            if (!isRegisterMode) toggleAuthMode();
            document.getElementById('authEmail').value = email;
        } else {
            showToast(error.message, 'error');
        }
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

/**
 * Handle Google login
 */
async function handleGoogleLogin() {
    try {
        const user = await loginWithGoogle();
        if (user) {
            showToast('Bienvenido', 'success');
        }
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
    showScreen('welcomeScreen');
    showToast('Sesión cerrada', 'info');
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    document.getElementById('weaponNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWeapon();
    });

    document.getElementById('lobbyWeaponInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addLobbyWeapon();
    });

    document.getElementById('lobbySuggestInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') suggestWeaponFromLobby();
    });

    document.getElementById('gameCodeInput')?.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });

    document.getElementById('profileNameInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinWithProfile();
    });

    document.getElementById('profilePhotoInput')?.addEventListener('change', handleProfilePhoto);

    document.getElementById('editProfilePhotoInput')?.addEventListener('change', handleEditProfilePhoto);

    document.getElementById('authPhotoInput')?.addEventListener('change', handleAuthPhoto);

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

    // Require auth
    if (!getCurrentUid()) {
        showAuthScreen({ type: 'createGame' });
        return;
    }

    await doCreateMultiplayerGame();
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

    const upperCode = code.toUpperCase();

    // Require auth
    if (!getCurrentUid()) {
        showAuthScreen({ type: 'joinGame', code: upperCode });
        return;
    }

    pendingGameCode = upperCode;
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

    renderLobbyWeapons(gameState.weapons, activeGame.isHost);
    renderPlayersGridLobby(gameState.players, 'playersGrid');

    if (activeGame.isHost) {
        renderWeaponSuggestions(gameState.weaponSuggestions || null);
    } else {
        const section = document.getElementById('suggestionsSection');
        if (section) section.style.display = 'none';
    }

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

/**
 * Add weapon from lobby (host)
 */
async function addLobbyWeapon() {
    const input = document.getElementById('lobbyWeaponInput');
    const name = input.value.trim();
    if (!name) { showToast('Introduce un nombre', 'error'); return; }
    const current = activeGame.gameState.weapons || [];
    if (current.includes(name)) { showToast('Ya existe esa arma', 'error'); return; }
    try {
        await activeGame.addWeaponToGame(name);
        input.value = '';
        showToast(`${name} añadido`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

/**
 * Remove weapon from lobby (host)
 */
async function removeLobbyWeapon(index) {
    try {
        const name = activeGame.gameState.weapons[index];
        await activeGame.removeWeaponFromGame(index);
        showToast(`${name} eliminado`, 'info');
    } catch (e) { showToast(e.message, 'error'); }
}

/**
 * Suggest weapon from lobby (non-host)
 */
async function suggestWeaponFromLobby() {
    const input = document.getElementById('lobbySuggestInput');
    const name = input.value.trim();
    if (!name) { showToast('Introduce un nombre', 'error'); return; }
    try {
        const player = activeGame.gameState.players[activeGame.playerId];
        await activeGame.suggestWeapon(name, player?.name || 'Jugador');
        input.value = '';
        showToast('Sugerencia enviada', 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

/**
 * Approve suggestion (host)
 */
async function approveSuggestion(id, name) {
    try {
        await activeGame.approveSuggestion(id, name);
        showToast(`${name} aprobado`, 'success');
    } catch (e) { showToast(e.message, 'error'); }
}

/**
 * Reject suggestion (host)
 */
async function rejectSuggestion(id) {
    try {
        await activeGame.rejectSuggestion(id);
        showToast('Sugerencia rechazada', 'info');
    } catch (e) { showToast(e.message, 'error'); }
}

/**
 * Open webcam modal for photo capture
 */
function openWebcam(target) {
    webcamTarget = target;
    navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } }
    }).then((stream) => {
        webcamStream = stream;
        showModal(`
            <h3>📹 Tomar Foto</h3>
            <div class="webcam-container">
                <video id="webcamVideo" class="webcam-video" autoplay playsinline muted></video>
            </div>
            <div class="webcam-actions">
                <button class="btn btn-ghost" onclick="stopWebcam()">Cancelar</button>
                <button class="btn btn-primary" onclick="captureWebcam()">📸 Capturar</button>
            </div>
        `);
        const video = document.getElementById('webcamVideo');
        video.srcObject = stream;
        video.play();
    }).catch(() => {
        showToast('No se pudo acceder a la cámara', 'error');
    });
}

/**
 * Capture frame from webcam video
 */
function captureWebcam() {
    const video = document.getElementById('webcamVideo');
    if (!video) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    canvas.getContext('2d').drawImage(video, sx, sy, size, size, 0, 0, size, size);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    resizeImage(dataUrl, 200, 200, (resized) => {
        const targetMap = {
            auth:        { variable: 'pendingAuthPhoto',  previewId: 'authPhotoPreview' },
            editProfile: { variable: 'editProfilePhoto',  previewId: 'editProfilePhotoPreview' },
            gameProfile: { variable: 'pendingPhoto',      previewId: 'profilePhotoPreview' },
        };

        const cfg = targetMap[webcamTarget];
        if (!cfg) return;

        // Store in the correct global variable
        window[cfg.variable] = resized;
        // Also update the module-level variable directly
        if (webcamTarget === 'auth') pendingAuthPhoto = resized;
        else if (webcamTarget === 'editProfile') editProfilePhoto = resized;
        else if (webcamTarget === 'gameProfile') pendingPhoto = resized;

        const preview = document.getElementById(cfg.previewId);
        if (preview) {
            preview.innerHTML = `<img src="${resized}" alt="Tu foto">`;
            preview.classList.add('has-photo');
        }

        showToast('Foto capturada', 'success');
        stopWebcam();
    });
}

/**
 * Stop webcam stream and close modal
 */
function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
    hideModal();
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
window.handleEmailLogin = handleEmailLogin;
window.toggleAuthMode = toggleAuthMode;
window.handleLogout = handleLogout;
window.showEditProfile = showEditProfile;
window.saveProfile = saveProfile;
window.toggleCustomProfile = toggleCustomProfile;
window.backToHome = backToHome;
window.enterGame = enterGame;
window.refreshHomeScreen = refreshHomeScreen;
window.showAuthScreen = showAuthScreen;
window.cancelAuth = cancelAuth;
window.addLobbyWeapon = addLobbyWeapon;
window.removeLobbyWeapon = removeLobbyWeapon;
window.suggestWeaponFromLobby = suggestWeaponFromLobby;
window.approveSuggestion = approveSuggestion;
window.rejectSuggestion = rejectSuggestion;
window.openWebcam = openWebcam;
window.captureWebcam = captureWebcam;
window.stopWebcam = stopWebcam;
