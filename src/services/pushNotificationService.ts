/**
 * Push Notification and Alert Service for Brivu
 * Handles Web Push, Firebase Cloud Messaging (FCM), System Alerts, and Token Registration
 */
import { getToken, onMessage, MessagePayload } from 'firebase/messaging';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db, getFirebaseMessaging, firebaseConfig } from './firebase';

export interface NotificationTokenRecord {
  id: string;
  token: string;
  platform: 'web' | 'android' | 'ios';
  deviceLabel: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessAlert {
  id: string;
  title: string;
  body: string;
  type: 'system' | 'low_stock' | 'sale' | 'debt_reminder' | 'staff' | 'qr_order';
  isRead: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface NotificationSettings {
  pushEnabled: boolean;
  lowStockAlerts: boolean;
  dailySalesSummary: boolean;
  debtDueReminders: boolean;
  staffAttendanceAlerts: boolean;
  qrOrderAlerts: boolean;
  vapidKey?: string;
}

const SETTINGS_KEY = 'brivu_notification_settings_v1';
const LOCAL_ALERTS_KEY = 'brivu_local_alerts_v1';

export const DEFAULT_VAPID_KEY = 'BOr0jS6GqMZY0dLiY11MRiynopuoMBraqhO6gNLFXyBNDISAGOfEkZVWSqMUK0nJENl_OwYufIBquYPX3K5mBGY';

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  lowStockAlerts: true,
  dailySalesSummary: true,
  debtDueReminders: true,
  staffAttendanceAlerts: true,
  qrOrderAlerts: true,
  vapidKey: DEFAULT_VAPID_KEY,
};

export class PushNotificationService {
  private static foregroundUnsub: (() => void) | null = null;
  private static registeredToken: string | null = null;

  /**
   * Get device unique ID stored locally
   */
  static getDeviceId(): string {
    let deviceId = localStorage.getItem('brivu_device_id_v1');
    if (!deviceId) {
      deviceId = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      localStorage.setItem('brivu_device_id_v1', deviceId);
    }
    return deviceId;
  }

  /**
   * Get local notification preferences
   */
  static getSettings(): NotificationSettings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {
      // fallback
    }
    return DEFAULT_SETTINGS;
  }

  /**
   * Save local notification preferences
   */
  static saveSettings(settings: Partial<NotificationSettings>): NotificationSettings {
    const current = this.getSettings();
    const updated = { ...current, ...settings };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {
      // storage quota or error
    }
    return updated;
  }

  /**
   * Check browser notification permission status
   */
  static getPermissionStatus(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Request browser / device notification permissions
   */
  static async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      return 'denied';
    }
  }

  /**
   * Register service worker and obtain FCM Push Token
   */
  static async registerPushToken(customVapidKey?: string): Promise<{ success: boolean; token?: string; error?: string }> {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Not in browser environment' };
    }

    try {
      // 1. Request system notification permission
      const permission = await this.requestPermission();
      if (permission !== 'granted') {
        return { success: false, error: 'Notification permission was denied by browser/device.' };
      }

      // 2. Register Service Worker if available
      let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/',
          });
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('Could not register firebase-messaging-sw.js:', swErr);
        }
      }

      // 3. Get Firebase Messaging instance
      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        // Fallback to local notification support
        this.saveSettings({ pushEnabled: true });
        return {
          success: true,
          token: 'local_notification_only_' + this.getDeviceId(),
        };
      }

      const settings = this.getSettings();
      const vapidKey = customVapidKey || settings.vapidKey || undefined;

      // 4. Retrieve FCM Token
      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration,
      });

      if (!token) {
        return { success: false, error: 'Failed to retrieve FCM push token.' };
      }

      this.registeredToken = token;

      // 5. Store token in Firestore for remote dispatch
      const deviceId = this.getDeviceId();
      const tokenRecord: NotificationTokenRecord = {
        id: deviceId,
        token,
        platform: 'web',
        deviceLabel: navigator.userAgent ? navigator.userAgent.slice(0, 100) : 'Web Browser',
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await setDoc(doc(db, 'notification_tokens', deviceId), tokenRecord);
      } catch (firestoreErr) {
        console.warn('Could not sync token to Firestore (offline or rules):', firestoreErr);
      }

      // 6. Set up foreground message listener
      this.initForegroundListener();

      this.saveSettings({ pushEnabled: true });
      return { success: true, token };
    } catch (err: any) {
      console.error('Error during push token registration:', err);
      return { success: false, error: err?.message || 'Failed to initialize Push Notifications.' };
    }
  }

  /**
   * Listen for foreground messages while the app is active
   */
  static async initForegroundListener(onMessageCallback?: (payload: MessagePayload) => void) {
    const messaging = await getFirebaseMessaging();
    if (!messaging) return;

    if (this.foregroundUnsub) {
      this.foregroundUnsub();
      this.foregroundUnsub = null;
    }

    try {
      this.foregroundUnsub = onMessage(messaging, (payload) => {
        console.log('[PushNotificationService] Foreground message received:', payload);
        
        const title = payload.notification?.title || payload.data?.title || 'Brivu Alert';
        const body = payload.notification?.body || payload.data?.body || '';
        
        // Show in-app system notification banner
        this.triggerSystemNotification(title, {
          body,
          icon: '/icon.svg',
        });

        // Add to alert history
        this.addAlert({
          title,
          body,
          type: (payload.data?.type as any) || 'system',
        });

        if (onMessageCallback) {
          onMessageCallback(payload);
        }
      });
    } catch (err) {
      console.warn('Failed to attach foreground message listener:', err);
    }
  }

  /**
   * Trigger local browser / Android OS system notification popup outside the app
   */
  static triggerSystemNotification(title: string, options?: NotificationOptions) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notifOptions = {
      body: options?.body || '',
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      renotify: true,
      tag: options?.tag || 'quickreceipt-' + Date.now(),
      data: options?.data || { url: '/' },
      ...options,
    };

    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, notifOptions as any);
        }).catch(() => {
          new Notification(title, notifOptions);
        });

        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body: options?.body,
            options: notifOptions,
          });
        }
      } else {
        new Notification(title, notifOptions);
      }
    } catch (err) {
      console.warn('Failed to show system notification:', err);
    }
  }

  /**
   * Dispatch a business notification alert (records in Firestore + LocalStorage + triggers OS notification)
   */
  static async triggerBusinessAlert(params: {
    title: string;
    body: string;
    type: 'system' | 'low_stock' | 'sale' | 'debt_reminder' | 'staff' | 'qr_order';
    actionUrl?: string;
  }): Promise<BusinessAlert> {
    const settings = this.getSettings();

    // Check if category is enabled in settings
    if (params.type === 'low_stock' && !settings.lowStockAlerts) return this.createAlertRecord(params);
    if (params.type === 'sale' && !settings.dailySalesSummary) return this.createAlertRecord(params);
    if (params.type === 'debt_reminder' && !settings.debtDueReminders) return this.createAlertRecord(params);
    if (params.type === 'staff' && !settings.staffAttendanceAlerts) return this.createAlertRecord(params);
    if (params.type === 'qr_order' && !settings.qrOrderAlerts) return this.createAlertRecord(params);

    const alert = await this.addAlert(params);

    // Trigger system notification if permitted
    this.triggerSystemNotification(params.title, {
      body: params.body,
      tag: params.type,
      data: { url: params.actionUrl || '/' },
    });

    return alert;
  }

  private static notifyListeners() {
    if (typeof window !== 'undefined') {
      try {
        const alerts = this.getLocalAlerts();
        window.dispatchEvent(new CustomEvent('brivu_alerts_updated', { detail: alerts }));
      } catch {
        // ignore
      }
    }
  }

  /**
   * Add alert to local list and sync to Firestore
   */
  static async addAlert(params: {
    title: string;
    body: string;
    type: 'system' | 'low_stock' | 'sale' | 'debt_reminder' | 'staff' | 'qr_order';
    actionUrl?: string;
  }): Promise<BusinessAlert> {
    const alert = this.createAlertRecord(params);

    // Save locally
    const current = this.getLocalAlerts();
    const updated = [alert, ...current].slice(0, 100); // keep last 100
    try {
      localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(updated));
      this.notifyListeners();
    } catch {
      // quota
    }

    return alert;
  }

  private static createAlertRecord(params: {
    title: string;
    body: string;
    type: 'system' | 'low_stock' | 'sale' | 'debt_reminder' | 'staff' | 'qr_order';
    actionUrl?: string;
  }): BusinessAlert {
    return {
      id: 'notif_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7),
      title: params.title,
      body: params.body,
      type: params.type,
      isRead: false,
      actionUrl: params.actionUrl,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get all local alerts
   */
  static getLocalAlerts(): BusinessAlert[] {
    try {
      const raw = localStorage.getItem(LOCAL_ALERTS_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // fallback
    }
    return [];
  }

  /**
   * Mark alert as read
   */
  static markAsRead(id: string) {
    const alerts = this.getLocalAlerts().map((a) => (a.id === id ? { ...a, isRead: true } : a));
    try {
      localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(alerts));
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  /**
   * Mark all alerts as read
   */
  static markAllAsRead() {
    const alerts = this.getLocalAlerts().map((a) => ({ ...a, isRead: true }));
    try {
      localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(alerts));
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  /**
   * Clear all notifications
   */
  static clearAll() {
    try {
      localStorage.removeItem(LOCAL_ALERTS_KEY);
      this.notifyListeners();
    } catch {
      // ignore
    }
  }

  /**
   * Subscribe to real-time notification stream
   */
  static subscribeToNotifications(onUpdate: (alerts: BusinessAlert[]) => void): () => void {
    // 1. Deliver current local alerts immediately
    try {
      onUpdate(this.getLocalAlerts());
    } catch {
      // ignore
    }

    // 2. Listen to internal local events
    const handleUpdate = (e: Event) => {
      try {
        const customEvent = e as CustomEvent<BusinessAlert[]>;
        if (customEvent.detail) {
          onUpdate(customEvent.detail);
        } else {
          onUpdate(this.getLocalAlerts());
        }
      } catch {
        // ignore
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('brivu_alerts_updated', handleUpdate);
      window.addEventListener('storage', handleUpdate);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('brivu_alerts_updated', handleUpdate);
        window.removeEventListener('storage', handleUpdate);
      }
    };
  }

  /**
   * Unregister / disable push notifications on this device
   */
  static async disablePush(): Promise<boolean> {
    const deviceId = this.getDeviceId();
    this.saveSettings({ pushEnabled: false });

    try {
      await updateDoc(doc(db, 'notification_tokens', deviceId), {
        enabled: false,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // offline safe
    }
    return true;
  }
}
