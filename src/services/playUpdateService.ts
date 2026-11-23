import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { StorageService } from './storage';

export const PLAY_UPDATE_AVAILABILITY = {
  UNKNOWN: 0,
  UPDATE_NOT_AVAILABLE: 1,
  UPDATE_AVAILABLE: 2,
  DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS: 3,
} as const;

export const PLAY_INSTALL_STATUS = {
  UNKNOWN: 0,
  PENDING: 1,
  DOWNLOADING: 2,
  INSTALLING: 3,
  INSTALLED: 4,
  FAILED: 5,
  CANCELED: 6,
  DOWNLOADED: 11,
} as const;

export interface PlayUpdateInfo {
  apiAvailable: boolean;
  updateAvailable: boolean;
  developerTriggeredUpdateInProgress?: boolean;
  updateAvailability?: number;
  availableVersionCode?: number;
  installStatus?: number;
  downloaded?: boolean;
  updatePriority?: number;
  clientVersionStalenessDays?: number | null;
  immediateAllowed?: boolean;
  flexibleAllowed?: boolean;
  totalBytesToDownload?: number;
  bytesDownloaded?: number;
  packageName?: string;
  errorCode?: number;
  error?: string;
}

export interface PlayStartUpdateResult {
  started: boolean;
  resultCode?: number;
  accepted?: boolean;
  cancelled?: boolean;
  failed?: boolean;
  updateType?: 'flexible' | 'immediate';
  errorCode?: number;
  error?: string;
}

export interface PlayUpdateStateEvent {
  installStatus?: number;
  bytesDownloaded?: number;
  totalBytesToDownload?: number;
  installErrorCode?: number;
  downloaded?: boolean;
  downloading?: boolean;
  installing?: boolean;
  installed?: boolean;
  failed?: boolean;
  canceled?: boolean;
  developerTriggeredUpdateInProgress?: boolean;
  availableVersionCode?: number;
}

export interface AppVersionInfo {
  packageName: string;
  versionName: string;
  versionCode: number;
}

interface PlayAppUpdatePluginInterface {
  getAppVersionInfo(): Promise<AppVersionInfo>;
  checkForUpdate(): Promise<PlayUpdateInfo>;
  startUpdate(options?: { type?: 'flexible' | 'immediate' }): Promise<PlayStartUpdateResult>;
  completeUpdate(): Promise<{ success: boolean; error?: string }>;
  openPlayStore(): Promise<{ success: boolean; error?: string }>;
  addListener(
    eventName: 'updateStateChanged',
    listenerFunc: (event: PlayUpdateStateEvent) => void
  ): Promise<PluginListenerHandle>;
}

const PlayAppUpdatePlugin = registerPlugin<PlayAppUpdatePluginInterface>('PlayAppUpdatePlugin', {
  web: () => ({
    getAppVersionInfo: async () => ({
      packageName: 'com.brivu.myapp',
      versionName: '1.8.0',
      versionCode: 10,
    }),
    checkForUpdate: async () => ({
      apiAvailable: false,
      updateAvailable: false,
      developerTriggeredUpdateInProgress: false,
      error: 'Google Play In-App Updates are only available on Android devices.',
    }),
    startUpdate: async () => ({
      started: false,
      error: 'Google Play In-App Updates are only available on Android devices.',
    }),
    completeUpdate: async () => ({
      success: false,
      error: 'Only available on Android devices.',
    }),
    openPlayStore: async () => {
      if (typeof window !== 'undefined') {
        window.open('https://play.google.com/store/apps/details?id=com.brivu.myapp', '_blank');
      }
      return { success: true };
    },
    addListener: async () => ({
      remove: async () => {},
    }),
  }),
});

const SNOOZE_STORAGE_KEY = 'brivu_play_update_snooze_v1';
const FLEXIBLE_SNOOZE_HOURS = 12;

export const PlayUpdateService = {
  isAndroidNative(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  },

  async getAppVersionInfo(): Promise<AppVersionInfo> {
    try {
      return await PlayAppUpdatePlugin.getAppVersionInfo();
    } catch {
      return {
        packageName: 'com.brivu.myapp',
        versionName: '1.8.0',
        versionCode: 10,
      };
    }
  },

  async checkForUpdate(): Promise<PlayUpdateInfo> {
    if (!this.isAndroidNative()) {
      return {
        apiAvailable: false,
        updateAvailable: false,
        developerTriggeredUpdateInProgress: false,
      };
    }
    try {
      return await PlayAppUpdatePlugin.checkForUpdate();
    } catch (err: any) {
      return {
        apiAvailable: false,
        updateAvailable: false,
        developerTriggeredUpdateInProgress: false,
        error: err?.message || 'Failed to check for updates',
      };
    }
  },

  isMandatoryOrImmediate(info: PlayUpdateInfo): boolean {
    if (info.developerTriggeredUpdateInProgress) return true;
    if (info.immediateAllowed && !info.flexibleAllowed) return true;
    if (info.immediateAllowed && (info.updatePriority ?? 0) >= 4) return true;
    if (info.immediateAllowed && (info.clientVersionStalenessDays ?? 0) >= 7) return true;
    return false;
  },

  getPreferredUpdateType(info: PlayUpdateInfo): 'flexible' | 'immediate' {
    if (this.isMandatoryOrImmediate(info)) {
      return 'immediate';
    }
    if (info.flexibleAllowed) {
      return 'flexible';
    }
    return 'immediate';
  },

  shouldAutoPrompt(info: PlayUpdateInfo): boolean {
    if (!info.apiAvailable) return false;
    if (info.downloaded || info.installStatus === PLAY_INSTALL_STATUS.DOWNLOADED) return true;
    if (info.developerTriggeredUpdateInProgress) return true;
    if (!info.updateAvailable) return false;
    if (this.isMandatoryOrImmediate(info)) return true;

    try {
      const raw = localStorage.getItem(SNOOZE_STORAGE_KEY);
      if (!raw) return true;
      const parsed = JSON.parse(raw) as { versionCode?: number; snoozedAt?: number };
      if (parsed.versionCode && info.availableVersionCode && parsed.versionCode !== info.availableVersionCode) {
        return true;
      }
      const elapsedMs = Date.now() - (parsed.snoozedAt || 0);
      return elapsedMs >= FLEXIBLE_SNOOZE_HOURS * 60 * 60 * 1000;
    } catch {
      return true;
    }
  },

  snoozeFlexiblePrompt(availableVersionCode?: number): void {
    try {
      localStorage.setItem(
        SNOOZE_STORAGE_KEY,
        JSON.stringify({
          versionCode: availableVersionCode || 0,
          snoozedAt: Date.now(),
        })
      );
    } catch {
      // Ignore storage errors
    }
  },

  clearSnooze(): void {
    try {
      localStorage.removeItem(SNOOZE_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  },

  async startUpdate(type: 'flexible' | 'immediate' = 'flexible'): Promise<PlayStartUpdateResult> {
    if (!this.isAndroidNative()) {
      return {
        started: false,
        error: 'Google Play In-App Updates are only available on Android devices.',
      };
    }
    try {
      // Prevent App Lock from locking when the user returns from the native Google Play update dialog
      StorageService.markSystemActionActive(120000);
      return await PlayAppUpdatePlugin.startUpdate({ type });
    } catch (err: any) {
      return {
        started: false,
        error: err?.message || 'Unable to launch Google Play update flow',
      };
    }
  },

  async completeUpdate(): Promise<{ success: boolean; error?: string }> {
    try {
      StorageService.markSystemActionActive(60000);
      return await PlayAppUpdatePlugin.completeUpdate();
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to install downloaded update',
      };
    }
  },

  async openPlayStore(): Promise<{ success: boolean; error?: string }> {
    try {
      StorageService.markSystemActionActive(60000);
      return await PlayAppUpdatePlugin.openPlayStore();
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Unable to open Google Play Store',
      };
    }
  },

  async addStateListener(
    callback: (event: PlayUpdateStateEvent) => void
  ): Promise<PluginListenerHandle | null> {
    if (!this.isAndroidNative()) return null;
    try {
      return await PlayAppUpdatePlugin.addListener('updateStateChanged', callback);
    } catch {
      return null;
    }
  },
};
