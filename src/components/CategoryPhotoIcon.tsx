import React, { useState } from 'react';
import {
  Layers,
  TrendingUp,
  Users,
  ShoppingCart,
  Calendar,
  BedDouble,
  UserCheck,
  Wallet,
  FileText,
  BarChart2,
  Briefcase,
  Receipt,
  QrCode,
  Utensils,
  Globe,
  MessageCircle,
} from 'lucide-react';

import {
  STOCK_BOXES_PHOTO,
  SALES_POS_PHOTO,
  CLIENTS_DIRECTORY_PHOTO,
  HOTEL_MENU_PHOTO,
  SHOPPING_LIST_PHOTO,
  EXPENSES_WALLET_PHOTO,
  DEBTS_DOCUMENT_PHOTO,
  STAFF_TEAM_PHOTO,
  HOTEL_ROOM_PHOTO,
} from '../assets/images/photoIconsData';

export type CategoryPhotoKind =
  | 'stock'
  | 'inventory'
  | 'sales'
  | 'clients'
  | 'shopping-list'
  | 'events'
  | 'hotel-menu'
  | 'hotel-rooms'
  | 'menu-photos'
  | 'staff'
  | 'expenses'
  | 'debts'
  | 'report'
  | 'agent'
  | 'receipts-invoices'
  | 'qr-host'
  | 'websites'
  | 'socials';

interface CategoryPhotoIconProps {
  kind: CategoryPhotoKind;
  className?: string;
  alt?: string;
}

const PHOTO_MAP: Partial<Record<CategoryPhotoKind, { src: string; label: string; fit?: 'contain' | 'cover' }>> = {
  stock: { src: STOCK_BOXES_PHOTO, label: 'Stock inventory boxes', fit: 'contain' },
  inventory: { src: STOCK_BOXES_PHOTO, label: 'Inventory stock boxes', fit: 'contain' },
  sales: { src: SALES_POS_PHOTO, label: 'Sales payment terminal', fit: 'cover' },
  clients: { src: CLIENTS_DIRECTORY_PHOTO, label: 'Clients business team', fit: 'contain' },
  'hotel-menu': { src: HOTEL_MENU_PHOTO, label: 'Hotel and menu building', fit: 'contain' },
  'hotel-rooms': { src: HOTEL_ROOM_PHOTO, label: 'Hotel room interior', fit: 'cover' },
  'menu-photos': { src: HOTEL_MENU_PHOTO, label: 'Digital menu hotel', fit: 'contain' },
  'shopping-list': { src: SHOPPING_LIST_PHOTO, label: 'Shopping list cart', fit: 'contain' },
  expenses: { src: EXPENSES_WALLET_PHOTO, label: 'Expenses wallet and calculator', fit: 'cover' },
  debts: { src: DEBTS_DOCUMENT_PHOTO, label: 'Debt document and pen', fit: 'contain' },
  staff: { src: STAFF_TEAM_PHOTO, label: 'Staff team', fit: 'contain' },
};

const FallbackLucide: React.FC<{ kind: CategoryPhotoKind }> = ({ kind }) => {
  const cls = 'w-6 h-6 text-[#0E6A33] dark:text-emerald-400 stroke-[2]';
  switch (kind) {
    case 'stock':
    case 'inventory':
      return <Layers className={cls} />;
    case 'sales':
      return <TrendingUp className={cls} />;
    case 'clients':
      return <Users className={cls} />;
    case 'shopping-list':
      return <ShoppingCart className={cls} />;
    case 'events':
      return <Calendar className={cls} />;
    case 'hotel-menu':
    case 'hotel-rooms':
      return <BedDouble className={cls} />;
    case 'menu-photos':
      return <Utensils className={cls} />;
    case 'staff':
      return <UserCheck className={cls} />;
    case 'expenses':
      return <Wallet className={cls} />;
    case 'debts':
      return <FileText className={cls} />;
    case 'report':
      return <BarChart2 className={cls} />;
    case 'agent':
      return <Briefcase className={cls} />;
    case 'receipts-invoices':
      return <Receipt className={cls} />;
    case 'qr-host':
      return <QrCode className={cls} />;
    case 'websites':
      return <Globe className={cls} />;
    case 'socials':
      return <MessageCircle className={cls} />;
  }
};

const renderDimensionalObjectSvg = (kind: CategoryPhotoKind): React.ReactElement | null => {
  switch (kind) {
    case 'events':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiCalBody" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E6ECF0" />
            </linearGradient>
            <linearGradient id="cphiCalHeader" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#128341" />
              <stop offset="100%" stopColor="#0B592B" />
            </linearGradient>
            <filter id="cphiObjShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>
          </defs>
          <g filter="url(#cphiObjShadow)">
            <rect x="14" y="18" width="52" height="48" rx="8" fill="url(#cphiCalBody)" stroke="#D1DBE2" strokeWidth="1" />
            <path d="M14 26C14 21.5817 17.5817 18 22 18H58C62.4183 18 66 21.5817 66 26V31H14V26Z" fill="url(#cphiCalHeader)" />
            <rect x="23" y="12" width="4" height="11" rx="2" fill="#475569" />
            <rect x="38" y="12" width="4" height="11" rx="2" fill="#475569" />
            <rect x="53" y="12" width="4" height="11" rx="2" fill="#475569" />
            <circle cx="25" cy="14" r="1.1" fill="#E2E8F0" />
            <circle cx="40" cy="14" r="1.1" fill="#E2E8F0" />
            <circle cx="55" cy="14" r="1.1" fill="#E2E8F0" />
            <text
              x="40"
              y="52"
              textAnchor="middle"
              fill="#0F172A"
              fontSize="20"
              fontWeight="800"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              28
            </text>
            <circle cx="54" cy="57" r="4" fill="#EF4444" />
            <path d="M55 66L66 56V60C66 63.3137 63.3137 66 60 66H55Z" fill="#CBD5E1" />
          </g>
        </svg>
      );

    case 'staff':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiLanyard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#16A34A" />
              <stop offset="100%" stopColor="#0E6A33" />
            </linearGradient>
            <linearGradient id="cphiBadgeCard" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#EBF0F4" />
            </linearGradient>
            <filter id="cphiStaffShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>
          </defs>
          <path d="M31 6L38 22H42L49 6" fill="none" stroke="url(#cphiLanyard)" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="35" y="19" width="10" height="7" rx="2" fill="#94A3B8" stroke="#64748B" strokeWidth="1" />
          <g filter="url(#cphiStaffShadow)">
            <rect x="20" y="25" width="40" height="46" rx="6" fill="url(#cphiBadgeCard)" stroke="#CBD5E1" strokeWidth="1" />
            <rect x="20" y="25" width="40" height="10" rx="4" fill="#0E6A33" />
            <rect x="20" y="31" width="40" height="4" fill="#0E6A33" />
            <rect x="25" y="40" width="14" height="16" rx="2.5" fill="#DCE7DF" />
            <circle cx="32" cy="45.5" r="3" fill="#0E6A33" />
            <path d="M27.5 54C27.5 51.4 29.5 49.8 32 49.8C34.5 49.8 36.5 51.4 36.5 54" fill="#0E6A33" />
            <rect x="42" y="42" width="13" height="3" rx="1.5" fill="#1E293B" />
            <rect x="42" y="48" width="10" height="2.4" rx="1.2" fill="#94A3B8" />
            <rect x="42" y="53" width="11" height="2.4" rx="1.2" fill="#94A3B8" />
            <rect x="25" y="61" width="30" height="5" rx="1.5" fill="#E2E8F0" />
            <path d="M28 62.5V64.5M31 62.5V64.5M33 62.5V64.5M36 62.5V64.5M39 62.5V64.5M41 62.5V64.5M45 62.5V64.5M48 62.5V64.5M51 62.5V64.5" stroke="#334155" strokeWidth="1.4" />
          </g>
        </svg>
      );

    case 'debts':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiWoodBoard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D7A777" />
              <stop offset="100%" stopColor="#B07A4B" />
            </linearGradient>
            <linearGradient id="cphiSteelClip" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#E2E8F0" />
              <stop offset="100%" stopColor="#64748B" />
            </linearGradient>
            <filter id="cphiClipShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.2" />
            </filter>
          </defs>
          <g filter="url(#cphiClipShadow)">
            <rect x="17" y="14" width="46" height="56" rx="6" fill="url(#cphiWoodBoard)" stroke="#8F5E34" strokeWidth="1" />
            <rect x="22" y="20" width="36" height="45" rx="2.5" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.8" />
            <rect x="30" y="10" width="20" height="11" rx="3" fill="url(#cphiSteelClip)" stroke="#475569" strokeWidth="0.9" />
            <circle cx="40" cy="14" r="2" fill="#334155" />
            <rect x="26" y="27" width="16" height="2.6" rx="1.3" fill="#334155" />
            <rect x="26" y="34" width="28" height="2" rx="1" fill="#CBD5E1" />
            <rect x="26" y="39" width="24" height="2" rx="1" fill="#CBD5E1" />
            <rect x="26" y="44" width="28" height="2" rx="1" fill="#CBD5E1" />
            <rect x="26" y="49" width="20" height="2" rx="1" fill="#CBD5E1" />
            <g transform="rotate(-10 46 56)">
              <rect x="37" y="51" width="18" height="9" rx="2" fill="#FEE2E2" stroke="#DC2626" strokeWidth="1.3" />
              <text
                x="46"
                y="57.7"
                textAnchor="middle"
                fill="#DC2626"
                fontSize="6"
                fontWeight="800"
                fontFamily="system-ui, sans-serif"
              >
                DUE
              </text>
            </g>
          </g>
        </svg>
      );

    case 'report':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiSheetBack" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E6EDF2" />
            </linearGradient>
            <filter id="cphiRepShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>
          </defs>
          <g filter="url(#cphiRepShadow)">
            <rect x="16" y="13" width="48" height="54" rx="6" fill="url(#cphiSheetBack)" stroke="#CBD5E1" strokeWidth="1" />
            <rect x="22" y="19" width="22" height="3.2" rx="1.6" fill="#0F172A" />
            <rect x="22" y="24.5" width="14" height="2" rx="1" fill="#94A3B8" />
            <rect x="23" y="46" width="8" height="14" rx="2" fill="#94A3B8" />
            <rect x="35" y="38" width="8" height="22" rx="2" fill="#F59E0B" />
            <rect x="47" y="30" width="8" height="30" rx="2" fill="#0E6A33" />
            <path d="M24 41L36 33L49 24L57 22" fill="none" stroke="#10B981" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="57" cy="22" r="2.5" fill="#10B981" />
          </g>
        </svg>
      );

    case 'agent':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiLeatherBag" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8B4523" />
              <stop offset="100%" stopColor="#5C2810" />
            </linearGradient>
            <linearGradient id="cphiLeatherFlap" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#A0522D" />
              <stop offset="100%" stopColor="#6E3114" />
            </linearGradient>
            <filter id="cphiBagShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.22" />
            </filter>
          </defs>
          <g filter="url(#cphiBagShadow)">
            <path d="M31 23V18C31 15.8 32.8 14 35 14H45C47.2 14 49 15.8 49 18V23" fill="none" stroke="#4A1E0A" strokeWidth="4" strokeLinecap="round" />
            <rect x="13" y="23" width="54" height="41" rx="6" fill="url(#cphiLeatherBag)" stroke="#4A1E0A" strokeWidth="1" />
            <path d="M13 29C13 25.6863 15.6863 23 19 23H61C64.3137 23 67 25.6863 67 29V41C67 43.2091 65.2091 45 63 45H17C14.7909 45 13 43.2091 13 41V29Z" fill="url(#cphiLeatherFlap)" />
            <rect x="16" y="26" width="48" height="16" rx="3.5" fill="none" stroke="#C57B50" strokeOpacity="0.4" strokeWidth="0.9" strokeDasharray="2 1.8" />
            <rect x="35.5" y="40.5" width="9" height="8" rx="2" fill="#FBBF24" stroke="#B45309" strokeWidth="1" />
            <circle cx="40" cy="45" r="1.4" fill="#78350F" />
          </g>
        </svg>
      );

    case 'hotel-rooms':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiKeycard" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0E6A33" />
              <stop offset="100%" stopColor="#083D1D" />
            </linearGradient>
            <linearGradient id="cphiBrassFob" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <filter id="cphiRoomShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.2" />
            </filter>
          </defs>
          <g filter="url(#cphiRoomShadow)">
            <rect x="12" y="22" width="46" height="32" rx="5" fill="url(#cphiKeycard)" />
            <rect x="12" y="28" width="46" height="6" fill="#041F0E" />
            <rect x="18" y="40" width="18" height="3" rx="1.5" fill="#A7F3D0" />
            <rect x="18" y="46" width="12" height="2.4" rx="1.2" fill="#6EE7B7" fillOpacity="0.8" />
            <g transform="rotate(14 55 46)">
              <rect x="46" y="26" width="18" height="36" rx="9" fill="url(#cphiBrassFob)" stroke="#B45309" strokeWidth="1" />
              <circle cx="55" cy="33" r="2.6" fill="#78350F" />
              <text
                x="55"
                y="50"
                textAnchor="middle"
                fill="#78350F"
                fontSize="8"
                fontWeight="900"
                fontFamily="system-ui, sans-serif"
              >
                104
              </text>
            </g>
          </g>
        </svg>
      );

    case 'receipts-invoices':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiRecPaper" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E6EDF2" />
            </linearGradient>
            <filter id="cphiRecShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#000000" floodOpacity="0.28" />
            </filter>
          </defs>
          <g filter="url(#cphiRecShadow)">
            <path
              d="M17 13C17 10.7909 18.7909 9 21 9H55C57.2091 9 59 10.7909 59 13V65L54 61L49 65L44 61L38 65L33 61L28 65L22 61L17 65V13Z"
              fill="url(#cphiRecPaper)"
            />
            <rect x="23" y="17" width="18" height="4" rx="2" fill="#0E6A33" />
            <rect x="23" y="26" width="30" height="2.6" rx="1.3" fill="#94A3B8" />
            <rect x="23" y="32" width="24" height="2.6" rx="1.3" fill="#CBD5E1" />
            <rect x="23" y="38" width="28" height="2.6" rx="1.3" fill="#CBD5E1" />
            <line x1="23" y1="45" x2="53" y2="45" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="2 2" />
            <rect x="23" y="50" width="13" height="3.5" rx="1.5" fill="#0F172A" />
            <rect x="42" y="50" width="11" height="3.5" rx="1.5" fill="#0E6A33" />
            <circle cx="56" cy="52" r="11" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
            <path d="M51.5 52L54.8 55.2L61 48.8" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </svg>
      );

    case 'qr-host':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiQrPlate" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E6F2EB" />
            </linearGradient>
            <filter id="cphiQrShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#042912" floodOpacity="0.3" />
            </filter>
          </defs>
          <g filter="url(#cphiQrShadow)">
            <rect x="12" y="12" width="56" height="56" rx="11" fill="url(#cphiQrPlate)" />
            <rect x="19" y="19" width="16" height="16" rx="3" fill="none" stroke="#0B592B" strokeWidth="3.2" />
            <rect x="24" y="24" width="6" height="6" rx="1" fill="#0B592B" />
            <rect x="45" y="19" width="16" height="16" rx="3" fill="none" stroke="#0B592B" strokeWidth="3.2" />
            <rect x="50" y="24" width="6" height="6" rx="1" fill="#0B592B" />
            <rect x="19" y="45" width="16" height="16" rx="3" fill="none" stroke="#0B592B" strokeWidth="3.2" />
            <rect x="24" y="50" width="6" height="6" rx="1" fill="#0B592B" />
            <rect x="45" y="45" width="6" height="6" rx="1.2" fill="#0E6A33" />
            <rect x="55" y="45" width="6" height="6" rx="1.2" fill="#10B981" />
            <rect x="45" y="55" width="6" height="6" rx="1.2" fill="#10B981" />
            <rect x="55" y="55" width="6" height="6" rx="1.2" fill="#0E6A33" />
            <rect x="39" y="38" width="5" height="5" rx="1" fill="#0E6A33" />
          </g>
        </svg>
      );

    case 'websites':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="cphiWebFrame" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#E6EDF4" />
            </linearGradient>
            <linearGradient id="cphiWebGlobe" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2563EB" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>
            <filter id="cphiWebShadow" x="-15%" y="-15%" width="130%" height="140%">
              <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>
          </defs>
          <g filter="url(#cphiWebShadow)">
            <rect x="11" y="16" width="58" height="48" rx="7" fill="url(#cphiWebFrame)" stroke="#CBD5E1" strokeWidth="1" />
            <path d="M11 23C11 19.134 14.134 16 18 16H62C65.866 16 69 19.134 69 23V27H11V23Z" fill="#0E6A33" />
            <circle cx="18" cy="21.5" r="1.5" fill="#A7F3D0" />
            <circle cx="23.5" cy="21.5" r="1.5" fill="#FDE68A" />
            <circle cx="29" cy="21.5" r="1.5" fill="#FECACA" />
            <circle cx="40" cy="45" r="12.5" fill="url(#cphiWebGlobe)" />
            <ellipse cx="40" cy="45" rx="5.5" ry="12.5" fill="none" stroke="#DBEAFE" strokeWidth="1.5" />
            <line x1="27.5" y1="45" x2="52.5" y2="45" stroke="#DBEAFE" strokeWidth="1.5" />
            <path d="M30.5 39.5C33.5 40.8 36.7 41.4 40 41.4C43.3 41.4 46.5 40.8 49.5 39.5" fill="none" stroke="#DBEAFE" strokeWidth="1.3" />
            <path d="M30.5 50.5C33.5 49.2 36.7 48.6 40 48.6C43.3 48.6 46.5 49.2 49.5 50.5" fill="none" stroke="#DBEAFE" strokeWidth="1.3" />
          </g>
        </svg>
      );

    case 'socials':
      return (
        <svg viewBox="0 0 80 80" className="w-full h-full" aria-hidden="true">
          <defs>
            <filter id="cphiSocShadow" x="-20%" y="-20%" width="140%" height="145%">
              <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#0F172A" floodOpacity="0.22" />
            </filter>
          </defs>
          <g filter="url(#cphiSocShadow)">
            {/* 1. TikTok badge (top-left) */}
            <rect x="7" y="15" width="30" height="30" rx="9" fill="#111827" stroke="#FFFFFF" strokeWidth="1.8" />
            {/* Cyan offset note */}
            <path
              d="M23.5 21.5V31.2C23.5 33.6 21.6 35.4 19.3 35.4C17.1 35.4 15.5 33.8 15.5 31.7C15.5 29.7 17.1 28.2 19.1 28.2C19.6 28.2 20.1 28.3 20.5 28.5V25.9C20 25.8 19.5 25.7 19 25.7C15.7 25.7 13 28.4 13 31.7C13 35.1 15.8 37.8 19.3 37.8C22.9 37.8 25.8 35 25.8 31.4V26.2C26.9 27 28.2 27.5 29.7 27.6V25C27.5 24.8 25.9 23.4 25.6 21.5H23.5Z"
              fill="#25F4EE"
              transform="translate(-0.7, -0.5)"
            />
            {/* Pink offset note */}
            <path
              d="M23.5 21.5V31.2C23.5 33.6 21.6 35.4 19.3 35.4C17.1 35.4 15.5 33.8 15.5 31.7C15.5 29.7 17.1 28.2 19.1 28.2C19.6 28.2 20.1 28.3 20.5 28.5V25.9C20 25.8 19.5 25.7 19 25.7C15.7 25.7 13 28.4 13 31.7C13 35.1 15.8 37.8 19.3 37.8C22.9 37.8 25.8 35 25.8 31.4V26.2C26.9 27 28.2 27.5 29.7 27.6V25C27.5 24.8 25.9 23.4 25.6 21.5H23.5Z"
              fill="#FE2C55"
              transform="translate(0.7, 0.5)"
            />
            {/* Crisp white foreground TikTok note */}
            <path
              d="M23.5 21.5V31.2C23.5 33.6 21.6 35.4 19.3 35.4C17.1 35.4 15.5 33.8 15.5 31.7C15.5 29.7 17.1 28.2 19.1 28.2C19.6 28.2 20.1 28.3 20.5 28.5V25.9C20 25.8 19.5 25.7 19 25.7C15.7 25.7 13 28.4 13 31.7C13 35.1 15.8 37.8 19.3 37.8C22.9 37.8 25.8 35 25.8 31.4V26.2C26.9 27 28.2 27.5 29.7 27.6V25C27.5 24.8 25.9 23.4 25.6 21.5H23.5Z"
              fill="#FFFFFF"
            />

            {/* 2. Facebook badge (top-right) */}
            <circle cx="58" cy="30" r="15" fill="#1877F2" stroke="#FFFFFF" strokeWidth="1.8" />
            <path
              d="M60.6 43.2V31.9H64.2L64.8 27.6H60.6V24.9C60.6 23.7 61 22.8 62.7 22.8H65V19C64.5 18.9 63.1 18.8 61.6 18.8C58.3 18.8 56.1 20.8 56.1 24.5V27.6H52.5V31.9H56.1V43.2H60.6Z"
              fill="#FFFFFF"
            />

            {/* 3. WhatsApp badge (front-center) */}
            <path
              d="M40 33.5C31.2 33.5 24 40.3 24 48.8C24 51.9 25 54.8 26.6 57.2L24.5 64.5L32.1 62.5C34.5 63.8 37.2 64.5 40 64.5C48.8 64.5 56 57.7 56 49.2C56 40.3 48.8 33.5 40 33.5Z"
              fill="#25D366"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M46.4 52.8C46 52.6 44.2 51.7 43.9 51.6C43.5 51.5 43.3 51.4 43 51.8C42.7 52.2 42 53 41.8 53.3C41.6 53.5 41.3 53.6 40.9 53.4C40.5 53.2 39.3 52.8 37.8 51.5C36.6 50.4 35.8 49.1 35.6 48.7C35.4 48.3 35.6 48.1 35.8 47.9C36 47.7 36.2 47.4 36.4 47.2C36.6 47 36.7 46.8 36.8 46.5C36.9 46.2 36.9 46 36.8 45.8C36.7 45.6 35.9 43.7 35.6 43C35.3 42.3 35 42.4 34.7 42.4H33.9C33.6 42.4 33.2 42.5 32.8 42.9C32.4 43.3 31.4 44.2 31.4 46.1C31.4 48 32.8 49.8 33 50C33.2 50.3 35.8 54.3 39.8 56C40.7 56.4 41.5 56.7 42.1 56.9C43 57.2 43.9 57.1 44.6 57C45.4 56.9 46.9 56.1 47.2 55.2C47.5 54.3 47.5 53.6 47.4 53.4C47.3 53.2 46.8 53 46.4 52.8Z"
              fill="#FFFFFF"
            />
          </g>
        </svg>
      );

    default:
      return null;
  }
};

export const CategoryPhotoIcon: React.FC<CategoryPhotoIconProps> = ({
  kind,
  className = 'w-[72px] h-[54px]',
  alt,
}) => {
  const [imgError, setImgError] = useState(false);
  const photo = PHOTO_MAP[kind];
  const isContainPhoto = Boolean(photo && !imgError && photo.fit === 'contain');

  return (
    <div
      className={`rounded-xl flex items-center justify-center overflow-hidden shrink-0 ${
        isContainPhoto
          ? 'bg-white border border-transparent dark:border-slate-700/60'
          : 'bg-[#EFF3F6] dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-none'
      } ${className}`}
    >
      {photo && !imgError ? (
        <img
          src={photo.src}
          alt={alt || photo.label}
          loading="eager"
          decoding="sync"
          onError={() => setImgError(true)}
          className={`w-full h-full select-none ${
            photo.fit === 'contain' ? 'object-contain p-0.5' : 'object-cover'
          }`}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-1">
          {renderDimensionalObjectSvg(kind) || <FallbackLucide kind={kind} />}
        </div>
      )}
    </div>
  );
};
