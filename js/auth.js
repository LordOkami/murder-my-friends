/**
 * Murder My Friends - Authentication (PIN + Google)
 */

const auth = firebase.auth();
const googleProvider = new firebase.auth.GoogleAuthProvider();

function pinEmail(username) {
    return username.toLowerCase().trim() + '@murdermyfriends.pin';
}

function pinPassword(pin) {
    return pin + '00'; // min 6 chars for Firebase
}

async function registerWithPIN(username, pin) {
    const email = pinEmail(username);
    const password = pinPassword(pin);

    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        await firebase.database().ref('users/' + cred.user.uid).set({
            username: username.trim(),
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        return cred.user;
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
            throw new Error('Ese nombre ya está en uso');
        }
        throw error;
    }
}

async function loginWithPIN(username, pin) {
    const email = pinEmail(username);
    const password = pinPassword(pin);

    try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        return cred.user;
    } catch (error) {
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            throw new Error('PIN incorrecto');
        }
        if (error.code === 'auth/user-not-found') {
            throw new Error('No existe ese usuario');
        }
        throw error;
    }
}

async function loginWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        // Save username from Google display name if no record exists
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

async function linkGoogle() {
    const user = auth.currentUser;
    if (!user) throw new Error('No hay sesión activa');

    try {
        await user.linkWithPopup(googleProvider);
        showToast('Cuenta de Google vinculada', 'success');
    } catch (error) {
        if (error.code === 'auth/credential-already-in-use') {
            throw new Error('Esa cuenta de Google ya está vinculada a otro usuario');
        }
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Vinculación cancelada');
        }
        throw error;
    }
}

function logout() {
    return auth.signOut();
}

function getCurrentUid() {
    return auth.currentUser ? auth.currentUser.uid : null;
}

async function getStoredUsername() {
    const uid = getCurrentUid();
    if (!uid) return null;
    const snap = await firebase.database().ref('users/' + uid + '/username').once('value');
    return snap.val();
}

function hasGoogleLinked() {
    const user = auth.currentUser;
    if (!user) return false;
    return user.providerData.some(p => p.providerId === 'google.com');
}

// Exports
window.registerWithPIN = registerWithPIN;
window.loginWithPIN = loginWithPIN;
window.loginWithGoogle = loginWithGoogle;
window.linkGoogle = linkGoogle;
window.logout = logout;
window.getCurrentUid = getCurrentUid;
window.getStoredUsername = getStoredUsername;
window.hasGoogleLinked = hasGoogleLinked;
