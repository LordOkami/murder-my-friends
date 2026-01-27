/**
 * Murder My Friends - Authentication (Google only)
 */

// Lazy-init to avoid "no Firebase App" errors
let _auth = null;
let _googleProvider = null;

function getAuth() {
    if (!_auth) {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        _auth = firebase.auth();
        _googleProvider = new firebase.auth.GoogleAuthProvider();
    }
    return _auth;
}

function getGoogleProvider() {
    getAuth();
    return _googleProvider;
}

function isMobile() {
    return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function loginWithGoogle() {
    try {
        // Try popup first (works on desktop and some mobile browsers)
        const result = await getAuth().signInWithPopup(getGoogleProvider());
        await ensureUserCreated(result.user);
        return result.user;
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Inicio cancelado');
        }
        // Popup blocked or failed on mobile — fall back to redirect
        if (error.code === 'auth/popup-blocked' ||
            error.code === 'auth/cancelled-popup-request' ||
            error.code === 'auth/operation-not-supported-in-this-environment') {
            await getAuth().signInWithRedirect(getGoogleProvider());
            return null;
        }
        throw error;
    }
}

async function handleRedirectResult() {
    try {
        const result = await getAuth().getRedirectResult();
        if (result && result.user) {
            await ensureUserCreated(result.user);
        }
    } catch (error) {
        console.error('Redirect login error:', error);
    }
}

async function ensureUserCreated(user) {
    const snap = await firebase.database().ref('users/' + user.uid + '/username').once('value');
    if (!snap.exists()) {
        await firebase.database().ref('users/' + user.uid).set({
            username: user.displayName || 'Jugador',
            photo: null,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
    }
}

async function getUserProfile() {
    const uid = getCurrentUid();
    if (!uid) return null;
    const snap = await firebase.database().ref('users/' + uid).once('value');
    if (!snap.exists()) return null;
    const data = snap.val();
    return { username: data.username || 'Jugador', photo: data.photo || null };
}

async function saveUserProfile(name, photo) {
    const uid = getCurrentUid();
    if (!uid) throw new Error('No hay sesión activa');
    await firebase.database().ref('users/' + uid).update({
        username: name,
        photo: photo || null
    });
}

function logout() {
    return getAuth().signOut();
}

function getCurrentUid() {
    const user = getAuth().currentUser;
    return user ? user.uid : null;
}

async function getStoredUsername() {
    const uid = getCurrentUid();
    if (!uid) return null;
    const snap = await firebase.database().ref('users/' + uid + '/username').once('value');
    return snap.val();
}

function hasGoogleLinked() {
    const user = getAuth().currentUser;
    if (!user) return false;
    return user.providerData.some(p => p.providerId === 'google.com');
}

// Exports
window.loginWithGoogle = loginWithGoogle;
window.logout = logout;
window.getCurrentUid = getCurrentUid;
window.getStoredUsername = getStoredUsername;
window.hasGoogleLinked = hasGoogleLinked;
window.getAuth = getAuth;
window.getUserProfile = getUserProfile;
window.saveUserProfile = saveUserProfile;
window.handleRedirectResult = handleRedirectResult;
window.ensureUserCreated = ensureUserCreated;
