// Firebase Cloud Messaging & Web Push Service Worker for QuickReceipt
// Handles background OS push notifications when the app is closed, minimized, or in background

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  projectId: 'poised-rainfall-1sjh2',
  appId: '1:578733074269:web:ee89a8dc2d2bda7ed46ab4',
  apiKey: 'AIzaSyA_LinprTf-yqU29IwOoDkL7W96cdA2l5A',
  authDomain: 'poised-rainfall-1sjh2.firebaseapp.com',
  storageBucket: 'poised-rainfall-1sjh2.firebasestorage.app',
  messagingSenderId: '578733074269'
});

const messaging = firebase.messaging();

// Helper to render OS system notification on phone status bar / lockscreen
function displayOSNotification(title, body, data, tag) {
  const options = {
    body: body || 'New business update.',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: tag || 'quickreceipt-alert-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: data || { url: '/', timestamp: Date.now() },
    actions: [
      {
        action: 'open_app',
        title: 'Open App'
      }
    ]
  };

  return self.registration.showNotification(title || 'QuickReceipt Alert', options);
}

// 1. Firebase Cloud Messaging background handler
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background FCM message:', payload);
  const title = payload.notification?.title || payload.data?.title || 'QuickReceipt Alert';
  const body = payload.notification?.body || payload.data?.body || 'New business update.';
  const data = { url: payload.data?.url || '/', timestamp: Date.now() };
  const tag = payload.data?.tag || 'quickreceipt-alert';

  displayOSNotification(title, body, data, tag);
});

// 2. Standard Web Push background handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      payload = { title: 'QuickReceipt Alert', body: event.data.text() };
    }
  }

  const title = payload.notification?.title || payload.title || 'QuickReceipt Alert';
  const body = payload.notification?.body || payload.body || 'New business update.';
  const data = payload.data || { url: '/' };
  const tag = payload.tag || 'quickreceipt-push-' + Date.now();

  event.waitUntil(displayOSNotification(title, body, data, tag));
});

// 3. PostMessage handler from main app thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, options } = event.data;
    event.waitUntil(
      displayOSNotification(
        title,
        body || options?.body,
        options?.data || { url: '/' },
        options?.tag
      )
    );
  }
});

// 4. Notification click event -> Focuses or opens QuickReceipt
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

// Immediate claim service worker control
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
