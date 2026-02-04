/* eslint-env serviceworker */
/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDbtMcIULW0hh5L0qXJHTnJIRD8K-xlRAg",
    authDomain: "murder-my-friends.firebaseapp.com",
    databaseURL: "https://murder-my-friends-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "murder-my-friends",
    storageBucket: "murder-my-friends.firebasestorage.app",
    messagingSenderId: "504049550535",
    appId: "1:504049550535:web:1d9e9ac7049028f9c4eae2"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    const data = payload.data || {};
    const notification = payload.notification || {};

    const title = notification.title || data.title || 'Murder My Friends';
    const body = notification.body || data.body || '';

    self.registration.showNotification(title, {
        body: body,
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        data: data
    });
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow('/');
        })
    );
});
