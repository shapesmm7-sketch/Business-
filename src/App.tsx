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
import { StorageService } from './services/storage';
import { PdfGenerator } from './services/pdfGenerator';
import { PushNotificationService } from './services/pushNotificationService';
import { App as CapApp } from '@capacitor/app';
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

  // Initialize Push Notifications and handle notification click navigation
  useEffect(() => {
    const notifSettings = PushNotificationService.getSettings();
    let timer: any = null;
    if (notifSettings.pushEnabled !== false) {
      if (PushNotificationService.isNative()) {
        // Defer native registration slightly so app UI mounts and renders smoothly first
        timer = setTimeout(() => {
          PushNotificationService.registerPushToken().catch((err) => {
            console.warn('[App] Native push initialization deferred:', err);
          });
        }, 1500);
      }
    }

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
      if (timer) clearTimeout(timer);
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

    // 3. Window focus / blur / pagehide / beforeunload listeners
    const handleWindowFocus = () => {
      handleAppResuming();
    };
    const handleWindowBlur = () => {
      handleAppGoingBackground();
    };
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
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    document.addEventListener('click', handleFileInputClick, true);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      document.removeEventListener('click', handleFileInputClick, true);
      if (capListenerHandle && typeof capListenerHandle.remove === 'function') {
        capListenerHandle.remove();
      }
    };
  }, []);

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
    }
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigateToInventory = (tab: InventoryTab = 'stock', showAddInline: boolean = false) => {
    setInventoryInitialTab(tab);
    setInventoryShowAddInline(showAddInline);
    setSelectedReceipt(null);
    setDuplicateSeed(null);
    setActiveScreen('inventory');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler when user creates or updates a receipt or invoice
  const handleReceiptSaved = (savedReceipt: Receipt) => {
    refreshData();
    setSelectedReceipt(savedReceipt);
    setDuplicateSeed(null);
    setActiveScreen('preview-receipt');
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
      await PdfGenerator.downloadPdf(receipt);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Delete receipt or invoice
  const handleDeleteReceipt = (id: string) => {
    StorageService.deleteReceipt(id);
    refreshData();
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
                await PdfGenerator.downloadPdf(rcpt);
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
                await PdfGenerator.downloadPdf(inv);
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

        {activeScreen === 'preview-receipt' && selectedReceipt && (
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
      </main>

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
    </div>
  );
}

export default App;
