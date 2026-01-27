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
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function loginWithGoogle() {
    if (isMobile()) {
        // Mobile: use redirect (popup is unreliable on mobile browsers)
        // The page will navigate to Google, then back.
        // onAuthStateChanged will fire on return.
        getAuth().signInWithRedirect(getGoogleProvider());
        return null;
    }

    // Desktop: use popup
    try {
        const result = await getAuth().signInWithPopup(getGoogleProvider());
        await ensureUserCreated(result.user);
        return result.user;
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Inicio cancelado');
        }
        throw error;
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
window.ensureUserCreated = ensureUserCreated;
