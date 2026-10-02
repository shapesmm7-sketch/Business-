import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './components/HomeScreen';
import { CreateReceiptScreen } from './components/CreateReceiptScreen';
import { CreateInvoiceScreen } from './components/CreateInvoiceScreen';
import { ReceiptPreviewScreen } from './components/ReceiptPreviewScreen';
import { ReceiptsHistoryScreen } from './components/ReceiptsHistoryScreen';
import { BusinessProfileScreen } from './components/BusinessProfileScreen';
import { TemplatesScreen } from './components/TemplatesScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { InventoryScreen } from './components/InventoryScreen';
import { QRCodeHostingScreen } from './components/QRCodeHostingScreen';
import { QRCustomerViewScreen } from './components/QRCustomerViewScreen';
import { ReceiptsInvoicesScreen } from './components/ReceiptsInvoicesScreen';
import { UpgradeScreen } from './components/UpgradeScreen';
import { AppLockScreen } from './components/AppLockScreen';
import { AppLockSetupScreen } from './components/AppLockSetupScreen';
import { CloudBackupScreen } from './components/CloudBackupScreen';
import { DownloadSuccessModal } from './components/DownloadSuccessModal';
import { AdMobBanner } from './components/AdMobBanner';
import { AdMobModalOverlay } from './components/AdMobModalOverlay';
import { AdMobService, ADMOB_TEST_UNITS } from './services/admobService';
import { StorageService } from './services/storage';
import { CloudflareService } from './services/cloudflareService';
import { PdfGenerator } from './services/pdfGenerator';
import { PushNotificationService } from './services/pushNotificationService';
import { App as CapApp } from '@capacitor/app';
import { AlertCircle } from 'lucide-react';
import {
  ActiveScreen,
  AppSettings,
  BusinessProfile,
  Receipt,
  ReceiptTemplateId,
  InventoryTab,
  QRCodeHostedPage,
  AppLockConfig,
} from './types';

export function App() {
  const [lockConfig, setLockConfig] = useState<AppLockConfig | null>(() =>
    StorageService.getAppLockConfig()
  );
  const [isAppLocked, setIsAppLocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('qr') ||
        params.get('photoId') ||
        params.get('photo') ||
        params.get('itemId') ||
        params.get('item')
      ) {
        return false;
      }
    }
    return StorageService.isAppLocked();
  });

  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qr') || params.get('photoId') || params.get('photo') || params.get('itemId') || params.get('item')) {
        return 'qr-customer-view';
      }
    }
    return 'home';
  });
  const [previousScreen, setPreviousScreen] = useState<ActiveScreen>('home');
  const [appLockInitialMode, setAppLockInitialMode] = useState<'view' | 'form'>('view');
  const [inventoryInitialTab, setInventoryInitialTab] = useState<InventoryTab>('stock');
  const [inventoryShowAddInline, setInventoryShowAddInline] = useState<boolean>(false);
  const [inventoryCategory, setInventoryCategory] = useState<'products' | 'money' | 'people' | null>(null);
  const [activeCustomerPage, setActiveCustomerPage] = useState<QRCodeHostedPage | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qrPageId = params.get('qr');
      if (qrPageId) {
        const found = StorageService.getHostedQRPage(qrPageId);
        if (found) return found;
      }
      if (params.get('photoId') || params.get('photo') || params.get('itemId') || params.get('item')) {
        const pages = StorageService.getHostedQRPages();
        if (pages[0]) return pages[0];
      }
    }
    return null;
  });
  const [customerInitialTab, setCustomerInitialTab] = useState<'menu' | 'photos' | 'about'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('photo') || params.get('photoId')) return 'photos';
      if (params.get('item') || params.get('itemId')) return 'menu';
      const tabParam = params.get('tab');
      if (tabParam === 'photos' || tabParam === 'gallery') return 'photos';
      if (tabParam === 'about' || tabParam === 'info') return 'about';
      if (tabParam === 'menu' || tabParam === 'items') return 'menu';
    }
    return 'menu';
  });
  const [customerInitialItemId, setCustomerInitialItemId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('item') || params.get('itemId') || undefined;
    }
    return undefined;
  });
  const [customerInitialPhotoId, setCustomerInitialPhotoId] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('photo') || params.get('photoId') || undefined;
    }
    return undefined;
  });
  const [isCustomerViewMode, setIsCustomerViewMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('qr') || params.get('photoId') || params.get('photo') || params.get('itemId') || params.get('item')) {
        return true;
      }
    }
    return false;
  });
  const [lifecycleAlert, setLifecycleAlert] = useState<{
    title: string;
    message: string;
    type: 'trial' | 'grace' | 'expired';
  } | null>(null);
  const [business, setBusiness] = useState<BusinessProfile>(() => StorageService.getProfile());
  const [settings, setSettings] = useState<AppSettings>(() => StorageService.getSettings());
  const [receipts, setReceipts] = useState<Receipt[]>(() => StorageService.getReceipts());
  const [stats, setStats] = useState(() => StorageService.getStats());
  const [inventoryCount, setInventoryCount] = useState<number>(() => StorageService.getInventoryProducts().length);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // Current receipt or invoice for preview or editing
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [duplicateSeed, setDuplicateSeed] = useState<Receipt | null>(null);
  const [appDownloadModal, setAppDownloadModal] = useState<{
    isOpen: boolean;
    fileName?: string;
    folderName?: string;
    documentType?: 'receipt' | 'invoice';
    documentNumber?: string;
  }>({ isOpen: false });

  // Check URL params for QR Code scanning (e.g. ?qr=page-id&tab=photos&photoId=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const qrPageId = params.get('qr');
      const photoIdParam = params.get('photo') || params.get('photoId');
      const itemIdParam = params.get('item') || params.get('itemId');
      const tabParam = params.get('tab');

      const hasCustomerParam = qrPageId || photoIdParam || itemIdParam || tabParam;

      if (hasCustomerParam) {
        if (photoIdParam) {
          setCustomerInitialPhotoId(photoIdParam);
          setCustomerInitialTab('photos');
        } else if (itemIdParam) {
          setCustomerInitialItemId(itemIdParam);
          setCustomerInitialTab('menu');
        } else if (tabParam === 'photos' || tabParam === 'gallery') {
          setCustomerInitialTab('photos');
        } else if (tabParam === 'about' || tabParam === 'info') {
          setCustomerInitialTab('about');
        } else if (tabParam === 'menu' || tabParam === 'items') {
          setCustomerInitialTab('menu');
        }

        let found: QRCodeHostedPage | undefined;
        if (qrPageId) {
          found = StorageService.getHostedQRPage(qrPageId);
        }
        if (!found) {
          const pages = StorageService.getHostedQRPages();
          found = pages[0];
        }

        if (found) {
          setActiveCustomerPage(found);
          setIsCustomerViewMode(true);
          setActiveScreen('qr-customer-view');
        } else if (qrPageId) {
          setIsCustomerViewMode(true);
          setActiveScreen('qr-customer-view');
          CloudflareService.getHostedQrPage(qrPageId).then((remotePage) => {
            if (remotePage) {
              StorageService.saveHostedQRPage(remotePage);
              setActiveCustomerPage(remotePage);
            }
          }).catch(() => {});
        }
      }
    }
  }, []);

  // Sync dark mode class on <html> and <body>
  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [settings.darkMode]);

  // Online / Offline listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-restore receipts, invoices, profile & data from Cloudflare D1 on launch (especially after reinstall)
  useEffect(() => {
    let isCancelled = false;
    const autoRestoreFromCloud = async () => {
      try {
        const config = StorageService.getCloudflareConfig();
        if (!config.workerUrl) return;

        // Pull full database state from Cloudflare D1
        const res = await CloudflareService.pullFromCloudflare();
        if (!isCancelled && res.success && res.data) {
          const freshReceipts = StorageService.getReceipts();
          setReceipts(freshReceipts);
          setBusiness(StorageService.getProfile());
          setSettings(StorageService.getSettings());
          setStats(StorageService.getStats());
          setInventoryCount(StorageService.getInventoryProducts().length);
        }
      } catch (err) {
        console.warn('Startup Cloudflare sync note:', err);
      }
    };

    // Slight delay so the initial frame mounts immediately
    const timer = setTimeout(() => {
      autoRestoreFromCloud();
    }, 600);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Free Trial and Grace Period lifecycle management
  useEffect(() => {
    const handleSubscriptionLifecycle = async () => {
      try {
        const status = StorageService.getTrialStatus();
        
        // 1. If subscribed, nothing to restrict or alert about
        if (status.subscribed) return;

        // 2. Handle Grace Period Expiry (wipe cloud completely)
        if (status.isGracePeriodExpired) {
          const alreadyWiped = localStorage.getItem('quickreceipt_cloud_wiped_v1') === 'true';
          if (!alreadyWiped) {
            console.warn('Grace Period Expired! Purging all Cloudflare database records and backups...');
            await StorageService.purgeAllCloudData();
            
            // Trigger a business alert notification
            PushNotificationService.triggerBusinessAlert({
              title: '⚠️ Grace Period Expired: Files Deleted',
              body: 'Your grace period is over. All files have been safely wiped from Cloud but remain secure on your phone local storage!',
              type: 'debt_reminder',
            }).catch(() => {});

            // Set state to display the warning modal
            setLifecycleAlert({
              title: 'Grace Period Expired!',
              message: 'Your 1-month grace period has ended. All your backups and hosted pages have been permanently deleted from the cloud. However, they remain 100% safe in your phone\'s local storage inside the app. Please subscribe to restore cloud features.',
              type: 'expired',
            });
          }
          return;
        }

        // 3. Handle 3-day reminder triggers for active free trial or grace period
        const daysSinceInstall = status.daysSinceInstall;
        // Trigger reminder on day 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30 (Trial)
        // and day 33, 36, 39, 42, 45, 48, 51, 54, 57, 60 (Grace Period)
        if (daysSinceInstall % 3 === 0) {
          const lastAlertDay = localStorage.getItem('quickreceipt_last_alert_day_v1');
          if (lastAlertDay !== String(daysSinceInstall)) {
            // Mark alert shown for this day
            localStorage.setItem('quickreceipt_last_alert_day_v1', String(daysSinceInstall));

            if (status.isFreeTrial) {
              const remaining = status.remainingTrialDays;
              const title = 'Free Trial Remaining';
              const message = `Your Brivu Free Trial is remaining with ${remaining} days! Subscribe to a paid plan to keep your automatic cloud backup and keep qr code and business info hosting working.`;

              // Send native local notification alert
              PushNotificationService.triggerBusinessAlert({
                title: `🎁 ${title}: ${remaining} Days Left`,
                body: message,
                type: 'sale',
              }).catch(() => {});

              // Show beautiful in-app warning modal
              setLifecycleAlert({
                title,
                message,
                type: 'trial',
              });
            } else if (status.isGracePeriod) {
              const remaining = status.remainingGraceDays;
              const title = 'Grace Period Warning';
              const message = `You have ${remaining} remaining days for your grace period. If you don't subscribe, all your files will be deleted from the cloud, but they will stay perfectly safe in your local storage in the app.`;

              // Send native local notification alert
              PushNotificationService.triggerBusinessAlert({
                title: `⚠️ ${title}: ${remaining} Days Left`,
                body: message,
                type: 'debt_reminder',
              }).catch(() => {});

              // Show beautiful in-app warning modal
              setLifecycleAlert({
                title,
                message,
                type: 'grace',
              });
            }
          }
        }
      } catch (err) {
        console.warn('Subscription lifecycle handler error:', err);
      }
    };

    // Delay checking slightly to ensure smooth main UI load
    const timer = setTimeout(() => {
      handleSubscriptionLifecycle();
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  // Handle notification click navigation
  useEffect(() => {
    const handleAlertNavigate = (e: Event) => {
      try {
        const customEvent = e as CustomEvent<string>;
        const url = customEvent.detail;
        if (!url) return;

        if (url.includes('inventory')) {
          handleNavigate('inventory');
        } else if (url.includes('receipt') || url.includes('invoice')) {
          handleNavigate('receipts');
        } else if (url.includes('upgrade') || url.includes('pro')) {
          handleNavigate('upgrade');
        } else if (url.includes('setting')) {
          handleNavigate('settings');
        } else if (url.includes('qr')) {
          handleNavigate('qr-hosting');
        }
      } catch (err) {
        console.warn('[App] Error navigating from notification event:', err);
      }
    };

    window.addEventListener('brivu_navigate_alert', handleAlertNavigate);
    return () => {
      window.removeEventListener('brivu_navigate_alert', handleAlertNavigate);
    };
  }, []);

  // Reload data from storage
  const refreshData = useCallback(() => {
    setBusiness(StorageService.getProfile());
    setSettings(StorageService.getSettings());
    const all = StorageService.getReceipts();
    setReceipts(all);
    setStats(StorageService.getStats());
    setInventoryCount(StorageService.getInventoryProducts().length);
    setLockConfig(StorageService.getAppLockConfig());
  }, []);

  // App Lock Lifecycle: automatically enforce auto-lock on app launch, background/resume, reload, or visibility change
  useEffect(() => {
    let lastBackgroundTimestamp = 0;

    const handleAppGoingBackground = () => {
      lastBackgroundTimestamp = Date.now();
      const currentCfg = StorageService.getAppLockConfig();
      if (currentCfg?.isEnabled && currentCfg?.autoLockOnExit !== false) {
        StorageService.setAppLocked(true);
      }
    };

    const handleAppResuming = () => {
      const currentCfg = StorageService.getAppLockConfig();
      setLockConfig(currentCfg);

      // Check if the customer QR public view is active
      const isPublic = typeof window !== 'undefined' && (() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(
          params.get('qr') ||
          params.get('photoId') ||
          params.get('photo') ||
          params.get('itemId') ||
          params.get('item')
        );
      })();

      if (isPublic) return;

      if (currentCfg?.isEnabled && currentCfg.pin && currentCfg.autoLockOnExit !== false) {
        // If returning from system dialog (e.g. file picker / share sheet), do not lock
        if (StorageService.consumeSystemActionActive()) {
          return;
        }

        // If the app was backgrounded for more than 300ms or resumed
        if (lastBackgroundTimestamp > 0 && Date.now() - lastBackgroundTimestamp > 300) {
          StorageService.setAppLocked(true);
          setIsAppLocked(true);
        }
      }
    };

    // 1. Web visibility change (works across browsers, PWAs, WebViews)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAppGoingBackground();
      } else if (document.visibilityState === 'visible') {
        handleAppResuming();
      }
    };

    // 2. Native Capacitor App State Change
    let capListenerHandle: any = null;
    try {
      CapApp.addListener('appStateChange', (state) => {
        if (!state.isActive) {
          handleAppGoingBackground();
        } else {
          handleAppResuming();
        }
      }).then((handle) => {
        capListenerHandle = handle;
      }).catch((err) => {
        console.warn('[AppLock] CapApp listener note:', err);
      });
    } catch (capErr) {
      console.warn('[AppLock] CapApp setup note:', capErr);
    }

    // 3. Pagehide / beforeunload listeners (clean web unload)
    const handlePageHide = () => {
      handleAppGoingBackground();
    };

    // 4. File input click interceptor to prevent file picking from triggering app lock on return
    const handleFileInputClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'file' ||
         target.closest('input[type="file"]') ||
         target.getAttribute('type') === 'file')
      ) {
        StorageService.markSystemActionActive(60000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    document.addEventListener('click', handleFileInputClick, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      document.removeEventListener('click', handleFileInputClick, true);
      if (capListenerHandle && typeof capListenerHandle.remove === 'function') {
        capListenerHandle.remove();
      }
    };
  }, []);

  // Hardware Back Button handling on Android / Capacitor devices
  useEffect(() => {
    let backListenerHandle: any = null;
    try {
      CapApp.addListener('backButton', () => {
        if (activeScreen === 'home') {
          CapApp.exitApp();
        } else if (
          [
            'create-receipt',
            'create-invoice',
            'preview-receipt',
            'templates',
            'settings',
            'profile',
            'inventory',
            'qr-hosting',
            'upgrade',
            'app-lock-setup',
            'cloud-backup',
            'receipts-invoices',
          ].includes(activeScreen)
        ) {
          handleNavigate('home');
        } else if (previousScreen && previousScreen !== activeScreen) {
          handleNavigate(previousScreen);
        } else {
          handleNavigate('home');
        }
      }).then((handle) => {
        backListenerHandle = handle;
      }).catch((err) => {
        console.warn('[App] BackButton listener note:', err);
      });
    } catch (err) {
      console.warn('[App] BackButton setup note:', err);
    }

    return () => {
      if (backListenerHandle && typeof backListenerHandle.remove === 'function') {
        backListenerHandle.remove();
      }
    };
  }, [activeScreen, previousScreen]);

  // Handler to navigate
  const handleNavigate = (screen: ActiveScreen) => {
    if (activeScreen !== screen && activeScreen !== 'upgrade') {
      setPreviousScreen(activeScreen);
    }
    if (screen !== 'preview-receipt') {
      setSelectedReceipt(null);
      setDuplicateSeed(null);
    }
    if (screen === 'inventory') {
      setInventoryInitialTab('stock');
      setInventoryShowAddInline(false);
      setInventoryCategory(null);
    }
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToInventory = (tab: InventoryTab = 'stock', showAddInline: boolean = false) => {
    setInventoryInitialTab(tab);
    setInventoryShowAddInline(showAddInline);
    setSelectedReceipt(null);
    setDuplicateSeed(null);
    if (tab === 'expense' || tab === 'debts' || tab === 'report') {
      setInventoryCategory('money');
    } else if (tab === 'customers' || tab === 'agents' || tab === 'workers') {
      setInventoryCategory('people');
    } else if (tab === 'sales' || tab === 'shoppingList') {
      setInventoryCategory('products');
    } else {
      setInventoryCategory(null);
    }
    setActiveScreen('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler when user creates or updates a receipt or invoice
  const handleReceiptSaved = (savedReceipt: Receipt) => {
    refreshData();
    setSelectedReceipt(savedReceipt);
    setDuplicateSeed(null);
    setActiveScreen('preview-receipt');
    // Pop up AdMob Interstitial Ad immediately after save
    AdMobService.showInterstitial('receipt_or_invoice_saved');
  };

  // Handler to open an existing receipt/invoice in preview
  const handleOpenReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setActiveScreen('preview-receipt');
  };

  // Handler to edit a receipt or invoice
  const handleEditReceipt = (receipt: Receipt) => {
    setSelectedReceipt(receipt);
    setDuplicateSeed(null);
    if (receipt.documentType === 'invoice') {
      setActiveScreen('create-invoice');
    } else {
      setActiveScreen('create-receipt');
    }
  };

  // Handler to duplicate a receipt or invoice
  const handleDuplicateReceipt = (receipt: Receipt) => {
    setDuplicateSeed(receipt);
    setSelectedReceipt(null);
    if (receipt.documentType === 'invoice') {
      setActiveScreen('create-invoice');
    } else {
      setActiveScreen('create-receipt');
    }
  };

  // Direct share from history or preview
  const handleShareReceipt = async (receipt: Receipt) => {
    try {
      await PdfGenerator.shareReceiptPdf(receipt);
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  // Direct download from history
  const handleDownloadReceipt = async (receipt: Receipt) => {
    try {
      const res = await PdfGenerator.downloadPdf(receipt);
      setAppDownloadModal({
        isOpen: true,
        fileName: res.filename,
        folderName: res.folder || 'Documents/Brivu',
        documentType: receipt.documentType === 'invoice' ? 'invoice' : 'receipt',
        documentNumber: receipt.receiptNumber,
      });
      // Pop up AdMob Interstitial Ad immediately on download
      AdMobService.showInterstitial('receipt_downloaded');
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Delete receipt or invoice permanently from local & cloud
  const handleDeleteReceipt = async (id: string) => {
    // 1. Delete locally & immediately update UI state
    StorageService.deleteReceipt(id);
    refreshData();

    // 2. Await cloud wipe
    try {
      await StorageService.deleteReceiptAsync(id);
      refreshData();
    } catch (err) {
      console.warn('Cloud delete background note:', err);
    }
  };

  // Business profile updated
  const handleUpdateBusiness = (updated: BusinessProfile) => {
    StorageService.saveProfile(updated);
    setBusiness(updated);
    refreshData();
  };

  // Settings updated
  const handleUpdateSettings = (updated: AppSettings) => {
    StorageService.saveSettings(updated);
    setSettings(updated);
    refreshData();
  };

  // Template set as default
  const handleSetDefaultTemplate = (templateId: ReceiptTemplateId) => {
    const updated = { ...settings, defaultTemplate: templateId };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  // Dark mode toggle in Header
  const handleToggleDarkMode = () => {
    const updated = { ...settings, darkMode: !settings.darkMode };
    setSettings(updated);
    StorageService.saveSettings(updated);
  };

  const isPublicCustomerView = typeof window !== 'undefined' && (() => {
    const params = new URLSearchParams(window.location.search);
    return Boolean(
      params.get('qr') ||
      params.get('photoId') ||
      params.get('photo') ||
      params.get('itemId') ||
      params.get('item')
    );
  })();

  // If App PIN is active and app is locked, lock the WHOLE APP completely
  if (!isPublicCustomerView && isAppLocked && lockConfig && lockConfig.isEnabled) {
    return (
      <AppLockScreen
        business={business}
        lockConfig={lockConfig}
        onUnlock={() => {
          setIsAppLocked(false);
          StorageService.setAppLocked(false);
        }}
        onResetPinRequested={() => {
          setIsAppLocked(false);
          setAppLockInitialMode('form');
          setActiveScreen('app-lock-setup');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Header - shown on all screens except Inventory and QR Customer View */}
      {activeScreen !== 'inventory' && activeScreen !== 'qr-customer-view' && (
        <Header
          business={business}
          darkMode={settings.darkMode}
          isOnline={isOnline}
          currentScreen={activeScreen}
          receiptsCount={receipts.length}
          activeTemplate={settings.defaultTemplate}
          onToggleDarkMode={handleToggleDarkMode}
          onNavigateHome={() => handleNavigate('home')}
          onNavigate={handleNavigate}
          onUpdateBusiness={handleUpdateBusiness}
          onLockApp={() => {
            setLockConfig(StorageService.getAppLockConfig());
            setIsAppLocked(true);
          }}
        />
      )}

      {/* Main Screen Content */}
      <main className={`flex-1 w-full ${activeScreen === 'inventory' || activeScreen === 'qr-customer-view' ? 'max-w-none p-0' : 'max-w-2xl mx-auto px-4 pt-4 sm:pt-6'}`}>
        {activeScreen === 'home' && (
          <HomeScreen
            business={business}
            stats={stats}
            activeTemplate={settings.defaultTemplate}
            onNavigate={handleNavigate}
            onNavigateToInventory={handleNavigateToInventory}
            onSelectReceipt={handleOpenReceipt}
            onShareReceipt={handleShareReceipt}
            onOpenCustomerView={(page) => {
              setActiveCustomerPage(page);
              setIsCustomerViewMode(false);
              setActiveScreen('qr-customer-view');
            }}
          />
        )}

        {activeScreen === 'receipts-invoices' && (
          <ReceiptsInvoicesScreen
            business={business}
            stats={stats}
            onNavigate={handleNavigate}
            onNavigateHome={() => handleNavigate('home')}
          />
        )}

        {activeScreen === 'create-receipt' && (
          <CreateReceiptScreen
            business={business}
            defaultTemplate={settings.defaultTemplate}
            defaultPaymentMethod={settings.defaultPaymentMethod}
            editingReceipt={selectedReceipt}
            duplicateFromReceipt={duplicateSeed}
            onCancel={() => handleNavigate('home')}
            onSaveOnly={() => {
              refreshData();
              setSelectedReceipt(null);
              setDuplicateSeed(null);
              setActiveScreen('receipts');
            }}
            onSaveAndPreview={handleReceiptSaved}
            onQuickDownload={async (rcpt) => {
              handleReceiptSaved(rcpt);
              try {
                const res = await PdfGenerator.downloadPdf(rcpt);
                setAppDownloadModal({
                  isOpen: true,
                  fileName: res.filename,
                  folderName: res.folder || 'Documents/Brivu',
                  documentType: 'receipt',
                  documentNumber: rcpt.receiptNumber,
                });
              } catch (err) {
                console.error('Download error:', err);
              }
            }}
            onQuickShare={async (rcpt) => {
              handleReceiptSaved(rcpt);
              await handleShareReceipt(rcpt);
            }}
          />
        )}

        {activeScreen === 'create-invoice' && (
          <CreateInvoiceScreen
            business={business}
            defaultTemplate={settings.defaultTemplate}
            defaultPaymentMethod={settings.defaultPaymentMethod}
            editingInvoice={selectedReceipt}
            duplicateFromInvoice={duplicateSeed}
            onCancel={() => handleNavigate('home')}
            onSaveOnly={() => {
              refreshData();
              setSelectedReceipt(null);
              setDuplicateSeed(null);
              setActiveScreen('invoices');
            }}
            onSaveAndPreview={handleReceiptSaved}
            onQuickDownload={async (inv) => {
              handleReceiptSaved(inv);
              try {
                const res = await PdfGenerator.downloadPdf(inv);
                setAppDownloadModal({
                  isOpen: true,
                  fileName: res.filename,
                  folderName: res.folder || 'Documents/Brivu',
                  documentType: 'invoice',
                  documentNumber: inv.receiptNumber,
                });
              } catch (err) {
                console.error('Download error:', err);
              }
            }}
            onQuickShare={async (inv) => {
              handleReceiptSaved(inv);
              await handleShareReceipt(inv);
            }}
          />
        )}

        {activeScreen === 'preview-receipt' && (
          selectedReceipt ? (
            <ReceiptPreviewScreen
              receipt={selectedReceipt}
              onBack={() =>
                handleNavigate(
                  selectedReceipt.documentType === 'invoice' ? 'invoices' : 'receipts'
                )
              }
              onEdit={handleEditReceipt}
              onDuplicate={handleDuplicateReceipt}
            />
          ) : (
            <ReceiptsHistoryScreen
              receipts={receipts}
              business={business}
              mode="receipts"
              onOpenReceipt={handleOpenReceipt}
              onEditReceipt={handleEditReceipt}
              onShareReceipt={handleShareReceipt}
              onDuplicateReceipt={handleDuplicateReceipt}
              onDownloadReceipt={handleDownloadReceipt}
              onDeleteReceipt={handleDeleteReceipt}
              onOpenTemplates={() => handleNavigate('templates')}
              onCreateNew={() => {
                setSelectedReceipt(null);
                setDuplicateSeed(null);
                setActiveScreen('create-receipt');
              }}
              onEditProfile={() => handleNavigate('profile')}
            />
          )
        )}

        {activeScreen === 'receipts' && (
          <ReceiptsHistoryScreen
            receipts={receipts}
            business={business}
            mode="receipts"
            onOpenReceipt={handleOpenReceipt}
            onEditReceipt={handleEditReceipt}
            onShareReceipt={handleShareReceipt}
            onDuplicateReceipt={handleDuplicateReceipt}
            onDownloadReceipt={handleDownloadReceipt}
            onDeleteReceipt={handleDeleteReceipt}
            onOpenTemplates={() => handleNavigate('templates')}
            onCreateNew={() => {
              setSelectedReceipt(null);
              setDuplicateSeed(null);
              setActiveScreen('create-receipt');
            }}
            onEditProfile={() => handleNavigate('profile')}
          />
        )}

        {activeScreen === 'invoices' && (
          <ReceiptsHistoryScreen
            receipts={receipts}
            business={business}
            mode="invoices"
            onOpenReceipt={handleOpenReceipt}
            onEditReceipt={handleEditReceipt}
            onShareReceipt={handleShareReceipt}
            onDuplicateReceipt={handleDuplicateReceipt}
            onDownloadReceipt={handleDownloadReceipt}
            onDeleteReceipt={handleDeleteReceipt}
            onOpenTemplates={() => handleNavigate('templates')}
            onCreateNew={() => {
              setSelectedReceipt(null);
              setDuplicateSeed(null);
              setActiveScreen('create-invoice');
            }}
            onCreateInvoice={() => {
              setSelectedReceipt(null);
              setDuplicateSeed(null);
              setActiveScreen('create-invoice');
            }}
            onEditProfile={() => handleNavigate('profile')}
          />
        )}

        {activeScreen === 'profile' && (
          <BusinessProfileScreen
            initialProfile={business}
            onSave={handleUpdateBusiness}
            onBack={() => handleNavigate('home')}
          />
        )}

        {activeScreen === 'inventory' && (
          <InventoryScreen
            business={business}
            initialTab={inventoryInitialTab}
            initialShowAddInline={inventoryShowAddInline}
            onNavigateHome={() => handleNavigate('home')}
            onCategoryChange={setInventoryCategory}
            onCreateReceiptWithItem={(item) => {
              const draftReceipt: Partial<Receipt> = {
                items: [
                  {
                    id: `item-${Date.now()}`,
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.unitPrice * item.quantity,
                  },
                ],
                subtotal: item.unitPrice * item.quantity,
                total: item.unitPrice * item.quantity,
              };
              setDuplicateSeed(draftReceipt as Receipt);
              setActiveScreen('create-receipt');
            }}
            onCreateInvoiceWithItem={(item) => {
              const draftInvoice: Partial<Receipt> = {
                items: [
                  {
                    id: `item-${Date.now()}`,
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    subtotal: item.unitPrice * item.quantity,
                  },
                ],
                subtotal: item.unitPrice * item.quantity,
                total: item.unitPrice * item.quantity,
              };
              setDuplicateSeed(draftInvoice as Receipt);
              setActiveScreen('create-invoice');
            }}
          />
        )}

        {activeScreen === 'templates' && (
          <TemplatesScreen
            currentDefault={settings.defaultTemplate}
            onSetDefault={handleSetDefaultTemplate}
            onBack={() => handleNavigate('home')}
            business={business}
            onUpdateBusiness={handleUpdateBusiness}
          />
        )}

        {activeScreen === 'settings' && (
          <SettingsScreen
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onNavigate={handleNavigate}
            onDataRestored={refreshData}
            onLockApp={() => {
              setLockConfig(StorageService.getAppLockConfig());
              setIsAppLocked(true);
            }}
          />
        )}

        {activeScreen === 'qr-hosting' && (
          <QRCodeHostingScreen
            business={business}
            onNavigateHome={() => handleNavigate('home')}
            onOpenCustomerView={(page, initialTab, initialItemId, initialPhotoId) => {
              setActiveCustomerPage(page);
              setCustomerInitialTab(initialTab || 'menu');
              setCustomerInitialItemId(initialItemId);
              setCustomerInitialPhotoId(initialPhotoId);
              setIsCustomerViewMode(false);
              setActiveScreen('qr-customer-view');
            }}
          />
        )}

        {activeScreen === 'qr-customer-view' && (
          <QRCustomerViewScreen
            page={activeCustomerPage || StorageService.getHostedQRPages()[0]}
            initialTab={customerInitialTab}
            initialItemId={customerInitialItemId}
            initialPhotoId={customerInitialPhotoId}
            onBackToApp={() => {
              if (isCustomerViewMode) {
                if (typeof window !== 'undefined' && window.history) {
                  window.history.replaceState({}, document.title, window.location.pathname);
                }
                setIsCustomerViewMode(false);
                handleNavigate('home');
              } else {
                handleNavigate('qr-hosting');
              }
            }}
            isMerchantPreview={!isCustomerViewMode}
          />
        )}

        {activeScreen === 'upgrade' && (
          <UpgradeScreen
            onBack={() => handleNavigate(previousScreen !== 'upgrade' ? previousScreen : 'home')}
          />
        )}

        {activeScreen === 'app-lock-setup' && (
          <AppLockSetupScreen
            initialMode={appLockInitialMode}
            onBack={() => {
              setAppLockInitialMode('view');
              handleNavigate(previousScreen !== 'app-lock-setup' ? previousScreen : 'home');
            }}
            onLockNow={() => {
              setLockConfig(StorageService.getAppLockConfig());
              setIsAppLocked(true);
            }}
            onConfigChange={(newCfg) => {
              setLockConfig(newCfg);
            }}
          />
        )}

        {activeScreen === 'cloud-backup' && (
          <CloudBackupScreen
            onBack={() => handleNavigate('settings')}
            onDataRestored={refreshData}
          />
        )}

        {/* Safety Catch-All Screen: Guarantees the UI never renders empty white space */}
        {![
          'home',
          'receipts-invoices',
          'create-receipt',
          'create-invoice',
          'preview-receipt',
          'receipts',
          'invoices',
          'profile',
          'inventory',
          'templates',
          'settings',
          'qr-hosting',
          'qr-customer-view',
          'upgrade',
          'app-lock-setup',
          'cloud-backup',
        ].includes(activeScreen) && (
          <HomeScreen
            business={business}
            stats={stats}
            activeTemplate={settings.defaultTemplate}
            onNavigate={handleNavigate}
            onNavigateToInventory={handleNavigateToInventory}
            onSelectReceipt={handleOpenReceipt}
            onShareReceipt={handleShareReceipt}
            onOpenCustomerView={(page) => {
              setActiveCustomerPage(page);
              setIsCustomerViewMode(false);
              setActiveScreen('qr-customer-view');
            }}
          />
        )}
      </main>

      {/* Google AdMob Bottom Banner Placeholder - Only displayed on bottom of home page and the main inventory overview screen */}
      {(activeScreen === 'home' || (activeScreen === 'inventory' && inventoryCategory === null)) && (
        <AdMobBanner
          placement="bottom_sticky"
          hasBottomNav={true}
          unitId={ADMOB_TEST_UNITS.ADAPTIVE_BANNER}
        />
      )}

      {/* Google AdMob Modal Overlays (Interstitial, Rewarded, App Open) */}
      <AdMobModalOverlay />

      {/* Android Bottom Navigation - Only displayed on primary tabs, hidden during creation/preview/customer view */}
      {!['create-receipt', 'create-invoice', 'preview-receipt', 'qr-customer-view', 'app-lock-setup'].includes(activeScreen) && (
        <BottomNav
          currentScreen={activeScreen}
          onNavigate={handleNavigate}
          receiptsCount={receipts.filter((r) => (r.documentType || 'receipt') === 'receipt').length}
          invoicesCount={receipts.filter((r) => r.documentType === 'invoice').length}
          inventoryCount={inventoryCount}
        />
      )}

      <DownloadSuccessModal
        isOpen={appDownloadModal.isOpen}
        onClose={() => setAppDownloadModal({ isOpen: false })}
        fileName={appDownloadModal.fileName}
        folderName={appDownloadModal.folderName}
        documentType={appDownloadModal.documentType}
        documentNumber={appDownloadModal.documentNumber}
      />

      {/* Subscription / Lifecycle warning alert modal */}
      {lifecycleAlert && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-scaleUp">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              lifecycleAlert.type === 'trial' 
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400'
                : 'bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
            }`}>
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              {lifecycleAlert.title}
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lifecycleAlert.message}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setLifecycleAlert(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setLifecycleAlert(null);
                  handleNavigate('upgrade');
                }}
                className="flex-1.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs font-extrabold shadow-md shadow-amber-500/10 transition active:scale-95 cursor-pointer"
              >
                Upgrade Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
