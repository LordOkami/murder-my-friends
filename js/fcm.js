/**
 * Murder My Friends - Firebase Cloud Messaging (Push Notifications)
 */

let _messagingInstance = null;
let _swRegistration = null;

// VAPID key — generate in Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'BBxUBoKyHttJKmp9vgqI34dfDke3i-dSMqrlzRjqYCDaqjvvDS9yyENxEanTLDhTbQEzGH5VotSb0dlPCONJ18w';

/**
 * Initialize FCM: register service worker and set up foreground message handler.
 * Call once after Firebase is initialized and user is authenticated.
 */
async function initFCM() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
        console.warn('FCM: Push notifications not supported in this browser');
        return;
    }

    if (VAPID_KEY === 'PASTE_YOUR_VAPID_KEY_HERE') {
        console.warn('FCM: VAPID key not configured — push notifications disabled');
        return;
    }

    try {
        _swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        _messagingInstance = firebase.messaging();

        // Foreground messages: suppress push (in-app modals handle it)
        _messagingInstance.onMessage(() => {
            // Intentionally empty — the real-time DB listener already shows modals
        });
    } catch (err) {
        console.error('FCM: init failed', err);
    }
}

/**
 * Request notification permission and save the FCM token to the database.
 * Best called after the user joins a game (high engagement moment).
 */
async function requestNotificationPermission() {
    if (!_messagingInstance || !_swRegistration) return;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('FCM: Notification permission denied');
            return;
        }

        const token = await _messagingInstance.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: _swRegistration
        });

        if (token) {
            await _saveToken(token);
        }
    } catch (err) {
        console.error('FCM: Failed to get token', err);
    }
}

/**
 * Delete the current FCM token from the database and from FCM.
 * Call on logout so the device stops receiving notifications.
 */
async function deleteFCMToken() {
    if (!_messagingInstance) return;

    try {
        const token = await _messagingInstance.getToken({
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: _swRegistration
        });

        if (token) {
            const uid = getCurrentUid();
            if (uid) {
                const hash = _tokenHash(token);
                await firebase.database().ref('users/' + uid + '/fcmTokens/' + hash).remove();
            }
            await _messagingInstance.deleteToken();
        }
    } catch (err) {
        console.error('FCM: Failed to delete token', err);
    }
}

/**
 * Save token to users/{uid}/fcmTokens/{hash}
 */
async function _saveToken(token) {
    const uid = getCurrentUid();
    if (!uid) return;

    const hash = _tokenHash(token);
    await firebase.database().ref('users/' + uid + '/fcmTokens/' + hash).set({
        token: token,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        userAgent: navigator.userAgent
    });
}

/**
 * Short hash of the token (first 8 chars) used as DB key.
 * Supports multiple devices per user.
 */
function _tokenHash(token) {
    let h = 0;
    for (let i = 0; i < token.length; i++) {
        h = ((h << 5) - h + token.charCodeAt(i)) | 0;
    }
    return Math.abs(h).toString(36).slice(0, 8);
}

// Exports
window.initFCM = initFCM;
window.requestNotificationPermission = requestNotificationPermission;
window.deleteFCMToken = deleteFCMToken;
