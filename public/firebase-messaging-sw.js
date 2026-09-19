// Firebase Cloud Messaging Service Worker for Brivu Business Manager
// Handles background push notifications when the app or tab is closed

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the config
firebase.initializeApp({
  projectId: 'poised-rainfall-1sjh2',
  appId: '1:578733074269:web:ee89a8dc2d2bda7ed46ab4',
  apiKey: 'AIzaSyA_LinprTf-yqU29IwOoDkL7W96cdA2l5A',
  authDomain: 'poised-rainfall-1sjh2.firebaseapp.com',
  storageBucket: 'poised-rainfall-1sjh2.firebasestorage.app',
  messagingSenderId: '578733074269'
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Brivu Alert';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update from Brivu.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.data?.tag || 'brivu-alert',
    data: {
      url: payload.data?.url || '/',
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'open_app',
        title: 'Open Brivu'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click to focus or open Brivu
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
