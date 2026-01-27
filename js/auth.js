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

async function loginWithGoogle() {
    try {
        const result = await getAuth().signInWithPopup(getGoogleProvider());
        const user = result.user;
        const snap = await firebase.database().ref('users/' + user.uid + '/username').once('value');
        if (!snap.exists()) {
            await firebase.database().ref('users/' + user.uid).set({
                username: user.displayName || 'Jugador',
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
        }
        return user;
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Inicio cancelado');
        }
        throw error;
    }
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
