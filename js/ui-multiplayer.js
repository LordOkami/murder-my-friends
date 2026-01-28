/**
 * Murder My Friends - UI Functions for Multiplayer
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
 * Render profile summary on welcome screen
 */
function renderProfileSummary(profile) {
    const nameEl = document.getElementById('profileSummaryName');
    const avatarEl = document.getElementById('profileSummaryAvatar');
    if (!nameEl || !avatarEl) return;

    nameEl.textContent = profile.username || 'Jugador';
    if (profile.photo) {
        avatarEl.innerHTML = `<img src="${profile.photo}" alt="avatar">`;
    } else {
        avatarEl.textContent = getInitials(profile.username || 'J');
    }
}

/**
 * Render my games list
 */
function renderMyGamesList(games) {
    const container = document.getElementById('myGamesList');
    if (!container) return;

    if (!games || games.length === 0) {
        container.innerHTML = '<div class="empty-games">No tienes partidas aún</div>';
        return;
    }

    container.innerHTML = games.map(g => {
        const statusLabels = { waiting: 'Esperando', playing: 'En curso', finished: 'Terminada' };
        const statusClass = g.status || 'waiting';
        const label = statusLabels[statusClass] || statusClass;
        const playerCount = g.playerCount != null ? g.playerCount : '?';

        return `
            <div class="game-list-item" onclick="enterGame('${escapeHtml(g.code)}')">
                <div class="game-list-item-left">
                    <span class="game-list-item-code">${escapeHtml(g.code)}</span>
                    <span class="game-list-item-players">👥 ${playerCount}</span>
                </div>
                <span class="game-status-badge ${statusClass}">${label}</span>
            </div>
        `;
    }).join('');
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
    setTimeout(() => toast.remove(), 3000);
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
    document.getElementById('modalOverlay').classList.add('hidden');
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
 * Escape HTML
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
        particle.style.width = `${Math.random() * 10 + 5}px`;
        particle.style.height = particle.style.width;
        particle.style.left = `${Math.random() * 100}%`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.animationDelay = `${Math.random() * 20}s`;
        particle.style.animationDuration = `${15 + Math.random() * 10}s`;
        container.appendChild(particle);
    }
}

/**
 * Update weapons list
 */
function updateWeaponsList() {
    const list = document.getElementById('weaponsList');
    const counter = document.getElementById('weaponCounter');

    if (!list) return;

    list.innerHTML = weapons.map((weapon, index) => `
        <div class="item-card" data-index="${index}">
            <div class="item-avatar">🔪</div>
            <span class="item-name">${escapeHtml(weapon)}</span>
            <button class="item-remove" onclick="removeWeapon(${index})" title="Eliminar">×</button>
        </div>
    `).join('');

    if (counter) counter.textContent = weapons.length;
}

/**
 * Render weapons grid
 */
function renderWeaponsGrid(weaponsList, containerId = 'weaponsGrid') {
    const grid = document.getElementById(containerId);
    if (!grid || !weaponsList) return;

    grid.innerHTML = weaponsList.map(weapon => {
        const name = typeof weapon === 'object' ? weapon.name : weapon;
        return `<span class="weapon-tag">${escapeHtml(name)}</span>`;
    }).join('');
}

/**
 * Render players grid for lobby
 */
function renderPlayersGridLobby(players, containerId = 'playersGrid') {
    const grid = document.getElementById(containerId);
    const countEl = document.getElementById('playerCount');

    if (!grid) return;

    const playerList = Object.values(players || {});
    if (countEl) countEl.textContent = playerList.length;

    grid.innerHTML = playerList.map(player => {
        const photoHtml = player.photo
            ? `<img src="${player.photo}" alt="${player.name}" class="player-photo">`
            : `<div class="player-avatar">${getInitials(player.name)}</div>`;

        const hostBadge = player.isHost ? '<span class="host-badge">👑</span>' : '';

        return `
            <div class="player-card alive">
                ${hostBadge}
                ${photoHtml}
                <div class="player-name">${escapeHtml(player.name)}</div>
                <div class="player-status">Listo</div>
            </div>
        `;
    }).join('');
}

/**
 * Render players grid for game
 */
function renderPlayersGridGame(players, killedPlayers, containerId = 'playersGrid2') {
    const grid = document.getElementById(containerId);
    const aliveCounter = document.getElementById('aliveCounter');

    if (!grid) return;

    const playerList = Object.values(players || {});
    const killed = killedPlayers || [];
    const aliveCount = playerList.filter(p => !killed.includes(p.id)).length;

    if (aliveCounter) {
        aliveCounter.textContent = `${aliveCount}/${playerList.length} vivos`;
    }

    grid.innerHTML = playerList.map(player => {
        const isAlive = !killed.includes(player.id);
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
 * Render kill select grid
 */
function renderKillSelectGrid(players, killedPlayers) {
    const grid = document.getElementById('killSelectGrid');
    if (!grid) return;

    const playerList = Object.values(players || {});
    const killed = killedPlayers || [];
    const alivePlayers = playerList.filter(p => !killed.includes(p.id));

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
 * Update game progress
 */
function updateGameProgress(totalPlayers, killedCount) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    if (progressFill && progressText) {
        const percentage = totalPlayers > 1 ? (killedCount / (totalPlayers - 1)) * 100 : 0;
        progressFill.style.width = percentage + '%';
        progressText.textContent = `${killedCount} eliminado${killedCount !== 1 ? 's' : ''}`;
    }
}

/**
 * Show mission card
 */
function showMissionCard(target, weapon, isInherited) {
    const targetPhotoEl = document.getElementById('targetPhoto');
    const targetNameEl = document.getElementById('targetName');
    const weaponNameEl = document.getElementById('weaponName');
    const missionLabel = document.getElementById('missionLabel');

    if (target.photo) {
        targetPhotoEl.innerHTML = `<img src="${target.photo}" alt="${target.name}">`;
    } else {
        targetPhotoEl.innerHTML = `<span class="target-initial">${getInitials(target.name)}</span>`;
    }

    targetNameEl.textContent = target.name;
    weaponNameEl.textContent = weapon;

    if (isInherited) {
        missionLabel.innerHTML = 'MISIÓN HEREDADA <span style="font-size: 0.8em;">⚠️</span>';
    } else {
        missionLabel.textContent = 'TU MISIÓN';
    }

    document.getElementById('missionReveal').style.display = 'block';
    document.getElementById('deadMessage').style.display = 'none';

    // Reset card flip
    document.getElementById('missionCard').classList.remove('flipped');
}

/**
 * Show dead message
 */
function showDeadMessage() {
    document.getElementById('missionReveal').style.display = 'none';
    document.getElementById('deadMessage').style.display = 'block';
}

/**
 * Toggle mission card flip
 */
function toggleMissionCard() {
    document.getElementById('missionCard').classList.toggle('flipped');
}

/**
 * Show game over
 */
function showGameOverScreen(winner, totalPlayers, killCount) {
    showScreen('gameOverScreen');

    const winnerCard = document.getElementById('winnerCard');
    const photoHtml = winner.photo
        ? `<img src="${winner.photo}" alt="${winner.name}" class="winner-photo">`
        : `<div class="winner-avatar">${getInitials(winner.name)}</div>`;

    winnerCard.innerHTML = `
        ${photoHtml}
        <div class="winner-name">${escapeHtml(winner.name)}</div>
    `;

    const stats = document.getElementById('gameStats');
    stats.innerHTML = `
        <h4>📊 Estadísticas</h4>
        <div class="stat-item">
            <span>Jugadores totales</span>
            <span>${totalPlayers}</span>
        </div>
        <div class="stat-item">
            <span>Eliminaciones</span>
            <span>${killCount}</span>
        </div>
    `;

    launchConfetti();
}

/**
 * Launch confetti
 */
function launchConfetti() {
    const colors = ['#ff3366', '#9333ea', '#fbbf24', '#22c55e', '#3b82f6'];

    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDuration = (2 + Math.random() * 2) + 's';
            document.body.appendChild(confetti);
            setTimeout(() => confetti.remove(), 4000);
        }, i * 50);
    }
}

/**
 * Copy game code
 */
function copyGameCode() {
    const code = activeGame?.gameCode;
    if (code) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Código copiado: ' + code, 'success');
        }).catch(() => {
            showToast('No se pudo copiar', 'error');
        });
    }
}

/**
 * Render lobby weapons as chips (editable for host, read-only for others)
 */
function renderLobbyWeapons(weapons, isHost) {
    const container = document.getElementById('lobbyWeapons');
    const countEl = document.getElementById('lobbyWeaponCount');
    if (!container) return;

    const list = weapons || [];
    if (countEl) countEl.textContent = list.length;

    container.innerHTML = list.map((weapon, i) => {
        const name = typeof weapon === 'object' ? weapon.name : weapon;
        const removeBtn = isHost
            ? `<button class="weapon-chip-remove" onclick="removeLobbyWeapon(${i})">&times;</button>`
            : '';
        return `<span class="weapon-chip">${escapeHtml(name)}${removeBtn}</span>`;
    }).join('');

    const addRow = document.getElementById('lobbyWeaponAddRow');
    const suggestRow = document.getElementById('lobbySuggestRow');
    if (addRow) addRow.style.display = isHost ? 'flex' : 'none';
    if (suggestRow) suggestRow.style.display = isHost ? 'none' : 'flex';
}

/**
 * Render weapon suggestions for host
 */
function renderWeaponSuggestions(suggestions) {
    const section = document.getElementById('suggestionsSection');
    const list = document.getElementById('suggestionsList');
    if (!section || !list) return;

    if (!suggestions || Object.keys(suggestions).length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    list.innerHTML = Object.entries(suggestions).map(([id, s]) => `
        <div class="suggestion-item">
            <div class="suggestion-info">
                <span class="suggestion-name">${escapeHtml(s.name)}</span>
                <span class="suggestion-author">por ${escapeHtml(s.suggestedByName)}</span>
            </div>
            <div class="suggestion-actions">
                <button class="btn-approve" onclick="approveSuggestion('${escapeHtml(id)}', '${escapeHtml(s.name)}')" title="Aprobar">&#10003;</button>
                <button class="btn-reject" onclick="rejectSuggestion('${escapeHtml(id)}')" title="Rechazar">&times;</button>
            </div>
        </div>
    `).join('');
}

// Export functions
window.showScreen = showScreen;
window.goToHome = goToHome;
window.showToast = showToast;
window.showModal = showModal;
window.hideModal = hideModal;
window.getInitials = getInitials;
window.escapeHtml = escapeHtml;
window.createParticles = createParticles;
window.updateWeaponsList = updateWeaponsList;
window.renderWeaponsGrid = renderWeaponsGrid;
window.renderPlayersGridLobby = renderPlayersGridLobby;
window.renderPlayersGridGame = renderPlayersGridGame;
window.renderKillSelectGrid = renderKillSelectGrid;
window.updateGameProgress = updateGameProgress;
window.showMissionCard = showMissionCard;
window.showDeadMessage = showDeadMessage;
window.toggleMissionCard = toggleMissionCard;
window.showGameOverScreen = showGameOverScreen;
window.launchConfetti = launchConfetti;
window.copyGameCode = copyGameCode;
window.renderProfileSummary = renderProfileSummary;
window.renderMyGamesList = renderMyGamesList;
window.renderLobbyWeapons = renderLobbyWeapons;
window.renderWeaponSuggestions = renderWeaponSuggestions;
