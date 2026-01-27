/**
 * Murder My Friends - UI Functions
 */

/**
 * Show a specific screen
 */
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }
}

/**
 * Go to home screen
 */
function goToHome() {
    showScreen('welcomeScreen');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️'
    };

    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Show modal dialog
 */
function showModal(content) {
    const overlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = content;
    overlay.classList.remove('hidden');
}

/**
 * Hide modal dialog
 */
function hideModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.add('hidden');
}

/**
 * Get initials from name
 */
function getInitials(name) {
    return name.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

/**
 * Render player item in list
 */
function renderPlayerItem(player) {
    const photoHtml = player.photo
        ? `<img src="${player.photo}" alt="${player.name}" class="item-photo">`
        : `<div class="item-avatar">${getInitials(player.name)}</div>`;

    return `
        <div class="item-card" data-id="${player.id}">
            ${photoHtml}
            <span class="item-name">${escapeHtml(player.name)}</span>
            <button class="item-remove" onclick="removePlayer('${player.id}')" title="Eliminar">×</button>
        </div>
    `;
}

/**
 * Render weapon item in list
 */
function renderWeaponItem(weapon) {
    return `
        <div class="item-card" data-id="${weapon.id}">
            <div class="item-avatar">🔪</div>
            <span class="item-name">${escapeHtml(weapon.name)}</span>
            <button class="item-remove" onclick="removeWeapon('${weapon.id}')" title="Eliminar">×</button>
        </div>
    `;
}

/**
 * Update players list UI
 */
function updatePlayersList() {
    const list = document.getElementById('playersList');
    const counter = document.getElementById('playerCounter');

    list.innerHTML = game.players.map(renderPlayerItem).join('');
    counter.textContent = game.players.length;

    updateValidation();
}

/**
 * Update weapons list UI
 */
function updateWeaponsList() {
    const list = document.getElementById('weaponsList');
    const counter = document.getElementById('weaponCounter');

    list.innerHTML = game.weapons.map(renderWeaponItem).join('');
    counter.textContent = game.weapons.length;

    updateValidation();
}

/**
 * Update validation message and start button
 */
function updateValidation() {
    const validation = game.validate();
    const messageEl = document.getElementById('validationMessage');
    const startBtn = document.getElementById('startGameBtn');

    if (validation.valid) {
        messageEl.className = 'validation-message success';
        messageEl.textContent = '✅ ¡Todo listo para empezar!';
        startBtn.disabled = false;
    } else {
        messageEl.className = 'validation-message error';
        messageEl.textContent = '⚠️ ' + validation.errors.join('. ');
        startBtn.disabled = true;
    }
}

/**
 * Render weapons grid in lobby
 */
function renderWeaponsGrid() {
    const grid = document.getElementById('weaponsGrid');
    grid.innerHTML = game.weapons.map(weapon => `
        <span class="weapon-tag">${escapeHtml(weapon.name)}</span>
    `).join('');
}

/**
 * Render players grid in lobby
 */
function renderPlayersGrid() {
    const grid = document.getElementById('playersGrid');
    const aliveCounter = document.getElementById('aliveCounter');

    const alivePlayers = game.getAlivePlayers();
    aliveCounter.textContent = `${alivePlayers.length}/${game.players.length} vivos`;

    grid.innerHTML = game.players.map(player => {
        const isAlive = game.isAlive(player.id);
        const statusClass = isAlive ? 'alive' : 'dead';
        const statusText = isAlive ? 'Vivo' : 'Eliminado';

        const photoHtml = player.photo
            ? `<img src="${player.photo}" alt="${player.name}" class="player-photo">`
            : `<div class="player-avatar">${getInitials(player.name)}</div>`;

        return `
            <div class="player-card ${statusClass}">
                ${photoHtml}
                <div class="player-name">${escapeHtml(player.name)}</div>
                <div class="player-status">${statusText}</div>
            </div>
        `;
    }).join('');
}

/**
 * Render player selection grid for mission reveal
 */
function renderPlayerSelectGrid() {
    const grid = document.getElementById('playerSelectGrid');

    grid.innerHTML = game.players.map(player => {
        const isAlive = game.isAlive(player.id);
        const disabled = !isAlive ? 'disabled' : '';

        const photoHtml = player.photo
            ? `<img src="${player.photo}" alt="${player.name}" class="select-photo">`
            : `<div class="select-avatar">${getInitials(player.name)}</div>`;

        return `
            <button class="player-select-btn" onclick="selectPlayerForMission('${player.id}')" ${disabled}>
                ${photoHtml}
                <span class="select-name">${escapeHtml(player.name)}</span>
            </button>
        `;
    }).join('');
}

/**
 * Render kill selection grid
 */
function renderKillSelectGrid() {
    const grid = document.getElementById('killSelectGrid');
    const alivePlayers = game.getAlivePlayers();

    grid.innerHTML = alivePlayers.map(player => {
        const photoHtml = player.photo
            ? `<img src="${player.photo}" alt="${player.name}" class="kill-photo">`
            : `<div class="kill-avatar">${getInitials(player.name)}</div>`;

        return `
            <button class="kill-select-btn" onclick="confirmKill('${player.id}')">
                ${photoHtml}
                <span class="kill-name">${escapeHtml(player.name)}</span>
            </button>
        `;
    }).join('');
}

/**
 * Show mission reveal screen
 */
function showMissionReveal() {
    showScreen('missionScreen');
    document.getElementById('missionSelect').classList.remove('hidden');
    document.getElementById('missionReveal').classList.add('hidden');
    renderPlayerSelectGrid();
}

/**
 * Select player to reveal their mission
 */
function selectPlayerForMission(playerId) {
    const player = game.players.find(p => p.id === playerId);
    if (!player || !game.isAlive(playerId)) {
        showToast('Este jugador está eliminado', 'error');
        return;
    }

    const mission = game.getCurrentTarget(playerId);
    if (!mission || !mission.target) {
        showToast('No se encontró la misión', 'error');
        return;
    }

    // Update mission card content
    const targetPhotoEl = document.getElementById('targetPhoto');
    const targetNameEl = document.getElementById('targetName');
    const weaponNameEl = document.getElementById('weaponName');

    if (mission.target.photo) {
        targetPhotoEl.innerHTML = `<img src="${mission.target.photo}" alt="${mission.target.name}">`;
    } else {
        targetPhotoEl.innerHTML = `<span class="target-initial">${getInitials(mission.target.name)}</span>`;
    }

    targetNameEl.textContent = mission.target.name;
    weaponNameEl.textContent = mission.weapon.name;

    // Show mission card
    document.getElementById('missionSelect').classList.add('hidden');
    document.getElementById('missionReveal').classList.remove('hidden');

    // Reset card to front
    const missionCard = document.getElementById('missionCard');
    missionCard.classList.remove('flipped');
}

/**
 * Toggle mission card flip
 */
function toggleMissionCard() {
    const card = document.getElementById('missionCard');
    card.classList.toggle('flipped');
}

/**
 * Hide mission and go back
 */
function hideMission() {
    const card = document.getElementById('missionCard');
    card.classList.remove('flipped');

    setTimeout(() => {
        document.getElementById('missionSelect').classList.remove('hidden');
        document.getElementById('missionReveal').classList.add('hidden');
    }, 400);
}

/**
 * Show kill confirmation screen
 */
function showKillConfirm() {
    showScreen('killScreen');
    renderKillSelectGrid();
}

/**
 * Confirm kill of a player
 */
function confirmKill(victimId) {
    const victim = game.players.find(p => p.id === victimId);

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
function executeKill(victimId) {
    hideModal();

    try {
        const result = game.reportKill(victimId);

        if (result.isGameOver) {
            showGameOver(result.winner);
        } else {
            showToast(`${result.victim.name} ha sido eliminado`, 'success');
            showScreen('lobbyScreen');
            updateLobbyUI();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Show game over screen
 */
function showGameOver(winner) {
    showScreen('gameOverScreen');

    const winnerCard = document.getElementById('winnerCard');
    const photoHtml = winner.photo
        ? `<img src="${winner.photo}" alt="${winner.name}" class="winner-photo">`
        : `<div class="winner-avatar">${getInitials(winner.name)}</div>`;

    winnerCard.innerHTML = `
        ${photoHtml}
        <div class="winner-name">${escapeHtml(winner.name)}</div>
    `;

    // Show stats
    const stats = document.getElementById('gameStats');
    stats.innerHTML = `
        <h4>📊 Estadísticas de la partida</h4>
        <div class="stat-item">
            <span>Jugadores totales</span>
            <span>${game.players.length}</span>
        </div>
        <div class="stat-item">
            <span>Eliminaciones</span>
            <span>${game.killOrder.length}</span>
        </div>
    `;

    // Launch confetti!
    launchConfetti();
}

/**
 * Launch confetti celebration
 */
function launchConfetti() {
    const colors = ['#ff3366', '#9333ea', '#fbbf24', '#22c55e', '#3b82f6'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            confetti.style.transform = `rotate(${Math.random() * 360}deg)`;

            document.body.appendChild(confetti);

            setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
    }
}

/**
 * Update lobby UI
 */
function updateLobbyUI() {
    document.getElementById('gameCodeDisplay').textContent = game.gameCode;
    renderWeaponsGrid();
    renderPlayersGrid();
}

/**
 * Copy game code to clipboard
 */
function copyGameCode() {
    const code = game.gameCode;
    navigator.clipboard.writeText(code).then(() => {
        showToast('Código copiado: ' + code, 'success');
    }).catch(() => {
        showToast('No se pudo copiar', 'error');
    });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Create floating particles
 */
function createParticles() {
    const container = document.getElementById('particles');
    const particleCount = 20;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';

        const size = Math.random() * 10 + 5;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;

        container.appendChild(particle);
    }
}

// Export functions
window.showScreen = showScreen;
window.goToHome = goToHome;
window.showToast = showToast;
window.showModal = showModal;
window.hideModal = hideModal;
window.getInitials = getInitials;
window.updatePlayersList = updatePlayersList;
window.updateWeaponsList = updateWeaponsList;
window.updateValidation = updateValidation;
window.renderWeaponsGrid = renderWeaponsGrid;
window.renderPlayersGrid = renderPlayersGrid;
window.renderPlayerSelectGrid = renderPlayerSelectGrid;
window.renderKillSelectGrid = renderKillSelectGrid;
window.showMissionReveal = showMissionReveal;
window.selectPlayerForMission = selectPlayerForMission;
window.toggleMissionCard = toggleMissionCard;
window.hideMission = hideMission;
window.showKillConfirm = showKillConfirm;
window.confirmKill = confirmKill;
window.executeKill = executeKill;
window.showGameOver = showGameOver;
window.updateLobbyUI = updateLobbyUI;
window.copyGameCode = copyGameCode;
window.escapeHtml = escapeHtml;
window.createParticles = createParticles;
window.launchConfetti = launchConfetti;
