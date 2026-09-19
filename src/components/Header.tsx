import React, { useState, useEffect, useRef } from 'react';
import {
  Menu as MenuIcon,
  X,
  Receipt as ReceiptIcon,
  Store,
  LayoutTemplate,
  Settings as SettingsIcon,
  Home,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { ActiveScreen, BusinessProfile } from '../types';
import { PWAInstallButton } from './PWAInstallButton';
import { NotificationModal } from './NotificationModal';
import { PushNotificationService } from '../services/pushNotificationService';

interface HeaderProps {
  business: BusinessProfile;
  darkMode: boolean;
  isOnline: boolean;
  currentScreen?: ActiveScreen;
  receiptsCount?: number;
  activeTemplate?: string;
  onToggleDarkMode: () => void;
  onNavigateHome: () => void;
  onNavigate: (screen: ActiveScreen) => void;
}

export const Header: React.FC<HeaderProps> = ({
  business,
  darkMode,
  isOnline,
  currentScreen = 'home',
  receiptsCount = 0,
  activeTemplate = 'modern',
  onToggleDarkMode,
  onNavigateHome,
  onNavigate,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(() => {
    return PushNotificationService.getLocalAlerts().filter((a) => !a.isRead).length;
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Keep unread count fresh
  useEffect(() => {
    const alerts = PushNotificationService.getLocalAlerts();
    setUnreadCount(alerts.filter((a) => !a.isRead).length);
  }, [isNotificationOpen]);

  // Close menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  const handleMenuSelect = (screen: ActiveScreen) => {
    setIsMenuOpen(false);
    onNavigate(screen);
  };

  const menuSections = [
    {
      id: 'profile' as ActiveScreen,
      title: 'Business Profile',
      shortTitle: 'Profile',
      subtitle: 'Store name, logo, description, phone & address',
      icon: Store,
      iconBg: 'bg-emerald-600 text-white shadow-emerald-500/20',
      activeBorder: 'border-emerald-500/40 dark:border-emerald-500/40',
    },
    {
      id: 'templates' as ActiveScreen,
      title: 'Designs & Templates',
      shortTitle: 'Designs',
      subtitle: '5 styles: Modern Slate, Classic, Minimal, Tax & Thermal',
      icon: LayoutTemplate,
      iconBg: 'bg-purple-600 text-white shadow-purple-500/20',
      activeBorder: 'border-purple-500/40 dark:border-purple-500/40',
    },
    {
      id: 'settings' as ActiveScreen,
      title: 'Settings',
      shortTitle: 'Settings',
      subtitle: 'Appearance, dark mode & JSON backup/restore',
      icon: SettingsIcon,
      iconBg: 'bg-amber-600 text-white shadow-amber-500/20',
      activeBorder: 'border-amber-500/40 dark:border-amber-500/40',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-2xl mx-auto px-4 py-2.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
          {/* Brand & Business Identity on the Left */}
          <button
            id="btn-header-home"
            onClick={onNavigateHome}
            className="flex items-center gap-3 text-left focus:outline-hidden group min-w-0"
          >
            {/* Business Logo or High-End Receipt Monogram */}
            <div className="relative w-9 h-9 shrink-0 rounded-xl overflow-hidden bg-slate-900 dark:bg-slate-800 text-emerald-400 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs transition-transform group-hover:scale-105">
              {business.logo ? (
                <img
                  src={business.logo}
                  alt="Business Logo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <ReceiptIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400 stroke-[2.2]" />
              )}
            </div>

            {/* Typography with clean visual hierarchy */}
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                Brivu
              </span>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>Business Manager</span>
              </div>
            </div>
          </button>

          {/* Right Action Tools: PWA, Notifications, & 3-line Hamburger Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />

            {/* Notifications Button */}
            <button
              id="btn-header-notifications"
              onClick={() => setIsNotificationOpen(true)}
              className="w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all shadow-xs border active:scale-95 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 stroke-[2.5]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 border border-white dark:border-slate-900 animate-pulse" />
              )}
            </button>

            {/* 3-line Hamburger Menu Button */}
            <button
              id="btn-top-menu-toggle"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-label="Open menu"
              className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all shadow-xs border active:scale-95 relative ${
                isMenuOpen
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {isMenuOpen ? (
                <X className="w-4 h-4 stroke-[2.5]" />
              ) : (
                <MenuIcon className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* TOP MENU SECTION DROPDOWN / OVERLAY (When Menu is clicked) */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-[53px] z-50 bg-slate-950/60 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div
            ref={menuRef}
            className="w-full max-w-2xl mx-auto bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-2xl rounded-b-3xl overflow-hidden max-h-[85vh] flex flex-col animate-slideDown"
          >
            {/* Menu Header */}
            <div className="px-5 pt-4 pb-3.5 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
                  B
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Application Menu
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    Brivu Hub
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  id="btn-menu-close"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  aria-label="Close menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Menu Sections List */}
            <div className="p-4 space-y-2.5 overflow-y-auto">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                Sections & Management
              </div>

              {menuSections.map((sec) => {
                const Icon = sec.icon;
                const isSelected = currentScreen === sec.id;
                return (
                  <button
                    key={sec.id}
                    id={`menu-item-${sec.id}`}
                    onClick={() => handleMenuSelect(sec.id)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center gap-3.5 group active:scale-[0.99] ${
                      isSelected
                        ? `bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 shadow-xs ${sec.activeBorder}`
                        : 'bg-white dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800/90 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-300'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform ${sec.iconBg}`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {sec.title}
                      </span>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>

            {/* Menu Footer */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <button
                id="btn-menu-home"
                onClick={() => handleMenuSelect('home')}
                className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition"
              >
                <Home className="w-4 h-4" />
                <span>Return to Home</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Center & Push Setup Modal */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onAlertCountChange={(cnt) => setUnreadCount(cnt)}
      />
    </header>
  );
};
