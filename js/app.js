/**
 * Murder My Friends - Main Application
 */

// Global game instance
let game;
let pendingPhoto = null;

/**
 * Initialize application
 */
function init() {
    // Create game instance
    game = new Game();

    // Create particles
    createParticles();

    // Setup event listeners
    setupEventListeners();

    // Check for existing game
    if (game.load()) {
        if (game.isActive) {
            showScreen('lobbyScreen');
            updateLobbyUI();

            // Check if game is over
            const winner = game.getWinner();
            if (winner) {
                showGameOver(winner);
            }
        }
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Player name input - Enter key
    const playerInput = document.getElementById('playerNameInput');
    playerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addPlayer();
        }
    });

    // Weapon name input - Enter key
    const weaponInput = document.getElementById('weaponNameInput');
    weaponInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addWeapon();
        }
    });

    // Photo upload handler
    const photoInput = document.getElementById('playerPhotoInput');
    photoInput.addEventListener('change', handlePhotoUpload);

    // Mission card click
    const missionCard = document.getElementById('missionCard');
    missionCard.addEventListener('click', toggleMissionCard);

    // Modal overlay click to close
    const modalOverlay = document.getElementById('modalOverlay');
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            hideModal();
        }
    });

    // Game code input - auto uppercase
    const codeInput = document.getElementById('gameCodeInput');
    codeInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.toUpperCase();
    });
}

/**
 * Handle photo upload
 */
function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Por favor selecciona una imagen', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('La imagen es demasiado grande (máx 5MB)', 'error');
        return;
    }

    // Read and resize image
    const reader = new FileReader();
    reader.onload = (event) => {
        resizeImage(event.target.result, 200, 200, (resizedImage) => {
            pendingPhoto = resizedImage;

            // Show preview
            const preview = document.getElementById('photoPreview');
            preview.innerHTML = `<img src="${resizedImage}" alt="Preview">`;
            preview.classList.add('active');

            // Update upload button style
            document.querySelector('.photo-upload-btn').classList.add('has-photo');

            showToast('Foto lista', 'success');
        });
    };
    reader.readAsDataURL(file);
}

/**
 * Resize image to fit within max dimensions
 */
function resizeImage(dataUrl, maxWidth, maxHeight, callback) {
    const img = new Image();
    img.onload = () => {
        let { width, height } = img;

        // Calculate new dimensions
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
        }

        // Create canvas and draw resized image
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Get compressed data URL
        callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
}

/**
 * Add a player
 */
function addPlayer() {
    const input = document.getElementById('playerNameInput');
    const name = input.value.trim();

    if (!name) {
        showToast('Introduce un nombre', 'error');
        return;
    }

    // Check for duplicate
    if (game.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        showToast('Ya existe un jugador con ese nombre', 'error');
        return;
    }

    // Add player with optional photo
    game.addPlayer(name, pendingPhoto);

    // Clear inputs
    input.value = '';
    pendingPhoto = null;
    document.getElementById('photoPreview').classList.remove('active');
    document.getElementById('photoPreview').innerHTML = '';
    document.querySelector('.photo-upload-btn').classList.remove('has-photo');
    document.getElementById('playerPhotoInput').value = '';

    // Update UI
    updatePlayersList();
    showToast(`${name} añadido`, 'success');

    // Focus back on input
    input.focus();
}

/**
 * Remove a player
 */
function removePlayer(playerId) {
    const player = game.players.find(p => p.id === playerId);
    game.removePlayer(playerId);
    updatePlayersList();
    showToast(`${player.name} eliminado`, 'info');
}

/**
 * Add a weapon
 */
function addWeapon() {
    const input = document.getElementById('weaponNameInput');
    const name = input.value.trim();

    if (!name) {
        showToast('Introduce un nombre de arma', 'error');
        return;
    }

    // Check for duplicate
    if (game.weapons.some(w => w.name.toLowerCase() === name.toLowerCase())) {
        showToast('Ya existe esa arma', 'error');
        return;
    }

    game.addWeapon(name);

    // Clear input
    input.value = '';

    // Update UI
    updateWeaponsList();
    showToast(`${name} añadido`, 'success');

    // Focus back on input
    input.focus();
}

/**
 * Remove a weapon
 */
function removeWeapon(weaponId) {
    const weapon = game.weapons.find(w => w.id === weaponId);
    game.removeWeapon(weaponId);
    updateWeaponsList();
    showToast(`${weapon.name} eliminado`, 'info');
}

/**
 * Add default weapons
 */
function addDefaultWeapons() {
    const existingNames = game.weapons.map(w => w.name.toLowerCase());
    let added = 0;

    for (const weapon of DEFAULT_WEAPONS) {
        if (!existingNames.includes(weapon.toLowerCase())) {
            game.addWeapon(weapon);
            added++;
        }
    }

    updateWeaponsList();
    showToast(`${added} armas añadidas`, 'success');
}

/**
 * Start the game
 */
function startGame() {
    try {
        const gameCode = game.startGame();
        showToast(`Partida iniciada: ${gameCode}`, 'success');
        showScreen('lobbyScreen');
        updateLobbyUI();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Join an existing game
 */
function joinGame() {
    const input = document.getElementById('gameCodeInput');
    const code = input.value.trim().toUpperCase();

    if (!code) {
        showToast('Introduce un código', 'error');
        return;
    }

    if (game.load(code)) {
        showToast('Unido a la partida', 'success');
        showScreen('lobbyScreen');
        updateLobbyUI();

        // Check if game is over
        const winner = game.getWinner();
        if (winner) {
            showGameOver(winner);
        }
    } else {
        showToast('Partida no encontrada', 'error');
    }
}

/**
 * Reset game and start over
 */
function resetGame() {
    localStorage.removeItem('murderMyFriends_game');
    localStorage.removeItem('murderMyFriends_gameCode');
    game.reset();
    showScreen('welcomeScreen');
    showToast('Nueva partida', 'info');
}

// Export functions
window.addPlayer = addPlayer;
window.removePlayer = removePlayer;
window.addWeapon = addWeapon;
window.removeWeapon = removeWeapon;
window.addDefaultWeapons = addDefaultWeapons;
window.startGame = startGame;
window.joinGame = joinGame;
window.resetGame = resetGame;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);
