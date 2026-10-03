import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  Share2,
  Download,
  Copy,
  Check,
  Printer,
  ExternalLink,
  Plus,
  Trash2,
  Edit3,
  Save,
  X,
  Sparkles,
  Smartphone,
  Globe,
  MapPin,
  CheckCircle2,
  Palette,
  PlusCircle,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { BusinessProfile } from '../types';
import { QRHostingService } from '../services/qrHostingService';
import { saveFile, shareContent, saveJsPdf } from '../services/fileSaver';
import { jsPDF } from 'jspdf';

export type SocialPlatformType =
  | 'whatsapp'
  | 'instagram'
  | 'tiktok'
  | 'facebook'
  | 'youtube'
  | 'telegram'
  | 'twitter'
  | 'linkedin'
  | 'snapchat'
  | 'pinterest'
  | 'google_maps'
  | 'threads'
  | 'discord'
  | 'twitch'
  | 'reddit'
  | 'wechat'
  | 'spotify'
  | 'yelp'
  | 'patreon'
  | 'github'
  | 'custom';

export interface SocialQrItem {
  id: string;
  platform: SocialPlatformType;
  customPlatformName?: string;
  title: string;
  usernameOrPhone: string;
  prefilledMessage?: string;
  fullUrl: string;
  ctaText: string;
  darkColor: string;
  lightColor: string;
  eyeColor?: string;
  createdAt: string;
}

const STORAGE_KEY = 'quickreceipt_socials_qr_v1';

export const PLATFORMS_CONFIG: Record<
  SocialPlatformType,
  {
    name: string;
    brandColor: string;
    lightColor: string;
    prefix: string;
    placeholder: string;
    defaultCta: string;
    helperText: string;
    buildUrl: (value: string, message?: string) => string;
  }
> = {
  whatsapp: {
    name: 'WhatsApp',
    brandColor: '#25D366',
    lightColor: '#ffffff',
    prefix: '+',
    placeholder: '256700000000',
    defaultCta: 'Chat on WhatsApp',
    helperText: 'Enter phone number with country code (e.g. 256700123456)',
    buildUrl: (val, msg) => {
      const cleanPhone = val.replace(/[^0-9]/g, '');
      const textParam = msg ? `?text=${encodeURIComponent(msg)}` : '';
      return `https://wa.me/${cleanPhone}${textParam}`;
    },
  },
  instagram: {
    name: 'Instagram',
    brandColor: '#E1306C',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourbusiness',
    defaultCta: 'Follow on Instagram',
    helperText: 'Enter your Instagram username handle or profile link',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://instagram.com/${clean}`;
    },
  },
  tiktok: {
    name: 'TikTok',
    brandColor: '#000000',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourbusiness',
    defaultCta: 'Watch on TikTok',
    helperText: 'Enter your TikTok username or profile link',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://tiktok.com/@${clean}`;
    },
  },
  facebook: {
    name: 'Facebook',
    brandColor: '#1877F2',
    lightColor: '#ffffff',
    prefix: '/',
    placeholder: 'yourpagename',
    defaultCta: 'Like us on Facebook',
    helperText: 'Enter your Facebook page name or profile URL',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://facebook.com/${clean}`;
    },
  },
  youtube: {
    name: 'YouTube',
    brandColor: '#FF0000',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourchannel',
    defaultCta: 'Subscribe on YouTube',
    helperText: 'Enter your YouTube handle (@channel) or link',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://youtube.com/${clean.startsWith('@') ? clean : `@${clean}`}`;
    },
  },
  telegram: {
    name: 'Telegram',
    brandColor: '#229ED9',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourchannel',
    defaultCta: 'Join our Telegram',
    helperText: 'Enter Telegram username or channel link',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://t.me/${clean}`;
    },
  },
  twitter: {
    name: 'X (Twitter)',
    brandColor: '#0f172a',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourhandle',
    defaultCta: 'Follow us on X',
    helperText: 'Enter your X / Twitter handle',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://x.com/${clean}`;
    },
  },
  linkedin: {
    name: 'LinkedIn',
    brandColor: '#0A66C2',
    lightColor: '#ffffff',
    prefix: 'in/',
    placeholder: 'company/yourbusiness',
    defaultCta: 'Connect on LinkedIn',
    helperText: 'Enter LinkedIn profile name or full URL',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://linkedin.com/in/${clean}`;
    },
  },
  snapchat: {
    name: 'Snapchat',
    brandColor: '#FFFC00',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourusername',
    defaultCta: 'Add on Snapchat',
    helperText: 'Enter your Snapchat username',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://snapchat.com/add/${clean}`;
    },
  },
  pinterest: {
    name: 'Pinterest',
    brandColor: '#BD081C',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourusername',
    defaultCta: 'Follow on Pinterest',
    helperText: 'Enter your Pinterest username',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://pinterest.com/${clean}`;
    },
  },
  google_maps: {
    name: 'Google Maps / Reviews',
    brandColor: '#EA4335',
    lightColor: '#ffffff',
    prefix: 'https://',
    placeholder: 'g.page/r/yourbusiness',
    defaultCta: 'Review us on Google',
    helperText: 'Enter Google Maps business link or review URL',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://${clean}`;
    },
  },
  threads: {
    name: 'Threads',
    brandColor: '#000000',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourhandle',
    defaultCta: 'Follow on Threads',
    helperText: 'Enter your Threads username or link',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://threads.net/@${clean}`;
    },
  },
  discord: {
    name: 'Discord',
    brandColor: '#5865F2',
    lightColor: '#ffffff',
    prefix: 'invite/',
    placeholder: 'discord.gg/yourserver',
    defaultCta: 'Join our Discord',
    helperText: 'Enter your Discord server invite link or code',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://discord.gg/${clean.replace(/^discord\.gg\//, '')}`;
    },
  },
  twitch: {
    name: 'Twitch',
    brandColor: '#9146FF',
    lightColor: '#ffffff',
    prefix: '/',
    placeholder: 'yourchannel',
    defaultCta: 'Watch on Twitch',
    helperText: 'Enter your Twitch channel name or link',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://twitch.tv/${clean}`;
    },
  },
  reddit: {
    name: 'Reddit',
    brandColor: '#FF4500',
    lightColor: '#ffffff',
    prefix: 'r/',
    placeholder: 'r/yourcommunity',
    defaultCta: 'Join on Reddit',
    helperText: 'Enter subreddit (e.g. r/community) or username (u/user)',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://reddit.com/${clean}`;
    },
  },
  wechat: {
    name: 'WeChat',
    brandColor: '#07C160',
    lightColor: '#ffffff',
    prefix: 'ID:',
    placeholder: 'yourwechatid',
    defaultCta: 'Connect on WeChat',
    helperText: 'Enter your WeChat ID or link',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `weixin://dl/chat?${clean}`;
    },
  },
  spotify: {
    name: 'Spotify',
    brandColor: '#1DB954',
    lightColor: '#ffffff',
    prefix: 'https://',
    placeholder: 'open.spotify.com/artist/...',
    defaultCta: 'Listen on Spotify',
    helperText: 'Enter your Spotify artist, playlist, or show link',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://${clean}`;
    },
  },
  yelp: {
    name: 'Yelp',
    brandColor: '#D32323',
    lightColor: '#ffffff',
    prefix: 'biz/',
    placeholder: 'yelp.com/biz/yourbusiness',
    defaultCta: 'Review on Yelp',
    helperText: 'Enter your Yelp business URL or page name',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://${clean}`;
    },
  },
  patreon: {
    name: 'Patreon',
    brandColor: '#FF424D',
    lightColor: '#ffffff',
    prefix: '/',
    placeholder: 'patreon.com/yourpage',
    defaultCta: 'Support on Patreon',
    helperText: 'Enter your Patreon profile link or page handle',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http') ? clean : `https://patreon.com/${clean.replace(/^patreon\.com\//, '')}`;
    },
  },
  github: {
    name: 'GitHub',
    brandColor: '#24292e',
    lightColor: '#ffffff',
    prefix: '@',
    placeholder: 'yourusername',
    defaultCta: 'Follow on GitHub',
    helperText: 'Enter your GitHub username or repository link',
    buildUrl: (val) => {
      const clean = val.replace(/^@/, '').trim();
      return clean.startsWith('http') ? clean : `https://github.com/${clean}`;
    },
  },
  custom: {
    name: 'Other / Custom Platform',
    brandColor: '#0f766e',
    lightColor: '#ffffff',
    prefix: 'https://',
    placeholder: 'https://yourplatform.com/profile',
    defaultCta: 'Visit Our Page',
    helperText: 'Enter full web address or custom profile link',
    buildUrl: (val) => {
      const clean = val.trim();
      return clean.startsWith('http://') || clean.startsWith('https://') ? clean : `https://${clean}`;
    },
  },
};

const COLOR_PRESETS = [
  { name: 'Emerald', hex: '#059669' },
  { name: 'Teal', hex: '#0d9488' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Dark Slate', hex: '#0f172a' },
  { name: 'Amber Gold', hex: '#d97706' },
];

interface SocialsQrSectionProps {
  business: BusinessProfile;
  showToast: (msg: string) => void;
}

export const SocialsQrSection: React.FC<SocialsQrSectionProps> = ({
  business,
  showToast,
}) => {
  const [items, setItems] = useState<SocialQrItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }

    // Seed initial items with WhatsApp or business phone
    const defaultPhone = business.whatsapp || business.phone || '256700000000';
    return [
      {
        id: 'social-wa-1',
        platform: 'whatsapp',
        title: `${business.name || 'Business'} WhatsApp`,
        usernameOrPhone: defaultPhone,
        prefilledMessage: `Hello ${business.name || 'there'}, I would like to inquire about your products!`,
        fullUrl: PLATFORMS_CONFIG.whatsapp.buildUrl(
          defaultPhone,
          `Hello ${business.name || 'there'}, I would like to inquire about your products!`
        ),
        ctaText: 'Chat on WhatsApp',
        darkColor: '#059669',
        lightColor: '#ffffff',
        eyeColor: '#047857',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'social-ig-1',
        platform: 'instagram',
        title: `${business.name || 'Business'} Instagram`,
        usernameOrPhone: (business.name || 'business').toLowerCase().replace(/\s+/g, ''),
        fullUrl: `https://instagram.com/${(business.name || 'business').toLowerCase().replace(/\s+/g, '')}`,
        ctaText: 'Follow on Instagram',
        darkColor: '#e11d48',
        lightColor: '#ffffff',
        eyeColor: '#be123c',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => items[0]?.id || '');
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SocialQrItem | null>(null);

  // Form State
  const [formPlatform, setFormPlatform] = useState<SocialPlatformType>('whatsapp');
  const [formCustomName, setFormCustomName] = useState<string>('');
  const [formTitle, setFormTitle] = useState<string>('');
  const [formInputVal, setFormInputVal] = useState<string>('');
  const [formMessage, setFormMessage] = useState<string>('');
  const [formCta, setFormCta] = useState<string>('Chat on WhatsApp');
  const [formDarkColor, setFormDarkColor] = useState<string>('#059669');
  const [formLightColor, setFormLightColor] = useState<string>('#ffffff');
  const [formEyeColor, setFormEyeColor] = useState<string>('#047857');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error(err);
    }
  }, [items]);

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];

  // Generate QR for active item
  useEffect(() => {
    if (!activeItem || !activeItem.fullUrl) return;
    QRHostingService.generateQrCodeDataUrl(activeItem.fullUrl, {
      width: 600,
      margin: 1.5,
      color: {
        dark: activeItem.darkColor || '#000000',
        light: activeItem.lightColor || '#ffffff',
        eyeColor: activeItem.eyeColor || activeItem.darkColor || '#000000',
      },
    })
      .then((data) => setActiveQrDataUrl(data))
      .catch((err) => console.error(err));
  }, [activeItem]);

  const handleOpenCreateModal = (platform: SocialPlatformType = 'whatsapp', defaultCustomName?: string) => {
    setEditingItem(null);
    const cfg = PLATFORMS_CONFIG[platform] || PLATFORMS_CONFIG.custom;
    setFormPlatform(platform);
    const customName = defaultCustomName || (platform === 'custom' ? 'Custom Platform' : cfg.name);
    setFormCustomName(customName);
    setFormTitle(`${business.name || 'Our'} ${platform === 'custom' ? customName : cfg.name}`);
    setFormInputVal(platform === 'whatsapp' ? (business.whatsapp || business.phone || '') : '');
    setFormMessage(
      platform === 'whatsapp'
        ? `Hello ${business.name || 'there'}, I would like to inquire about your services!`
        : ''
    );
    setFormCta(cfg.defaultCta);
    const brandCol = cfg.brandColor === '#000000' || cfg.brandColor === '#0f172a' ? '#0f172a' : cfg.brandColor;
    setFormDarkColor(brandCol);
    setFormLightColor('#ffffff');
    setFormEyeColor(brandCol);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: SocialQrItem) => {
    setEditingItem(item);
    setFormPlatform(item.platform);
    setFormCustomName(item.customPlatformName || PLATFORMS_CONFIG[item.platform]?.name || 'Platform');
    setFormTitle(item.title);
    setFormInputVal(item.usernameOrPhone);
    setFormMessage(item.prefilledMessage || '');
    setFormCta(item.ctaText);
    setFormDarkColor(item.darkColor);
    setFormLightColor(item.lightColor);
    setFormEyeColor(item.eyeColor || item.darkColor);
    setShowModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formInputVal.trim()) {
      showToast('Please fill in all required fields');
      return;
    }

    const cfg = PLATFORMS_CONFIG[formPlatform] || PLATFORMS_CONFIG.custom;
    const generatedUrl = cfg.buildUrl(formInputVal.trim(), formMessage.trim());
    const displayPlatformName = formPlatform === 'custom' ? (formCustomName.trim() || 'Custom') : cfg.name;

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                platform: formPlatform,
                customPlatformName: displayPlatformName,
                title: formTitle.trim(),
                usernameOrPhone: formInputVal.trim(),
                prefilledMessage: formMessage.trim(),
                fullUrl: generatedUrl,
                ctaText: formCta.trim() || cfg.defaultCta,
                darkColor: formDarkColor,
                lightColor: formLightColor,
                eyeColor: formEyeColor,
              }
            : i
        )
      );
      showToast('Social QR updated!');
    } else {
      const newItem: SocialQrItem = {
        id: `social-qr-${Date.now()}`,
        platform: formPlatform,
        customPlatformName: displayPlatformName,
        title: formTitle.trim(),
        usernameOrPhone: formInputVal.trim(),
        prefilledMessage: formMessage.trim(),
        fullUrl: generatedUrl,
        ctaText: formCta.trim() || cfg.defaultCta,
        darkColor: formDarkColor,
        lightColor: formLightColor,
        eyeColor: formEyeColor,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      setSelectedItemId(newItem.id);
      showToast(`New ${displayPlatformName} QR created!`);
    }
    setShowModal(false);
  };

  const handleDeleteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = items.filter((i) => i.id !== id);
    setItems(remaining);
    if (selectedItemId === id) {
      if (remaining[0]) {
        setSelectedItemId(remaining[0].id);
      } else {
        setSelectedItemId('');
      }
    }
    showToast('Social QR deleted.');
  };

  const handleCopyLink = async () => {
    if (!activeItem) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeItem.fullUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        showToast('Social link copied to clipboard!');
      }
    } catch {
      showToast('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!activeItem) return;
    await shareContent({
      title: activeItem.title,
      text: `${activeItem.ctaText}: ${activeItem.fullUrl}`,
      url: activeItem.fullUrl,
      dialogTitle: `Share ${activeItem.title}`,
    });
  };

  const handleDownloadPng = async () => {
    if (!activeQrDataUrl || !activeItem) return;
    const safeName = activeItem.title.replace(/[^a-zA-Z0-9]/g, '_');
    await saveFile({
      data: activeQrDataUrl,
      filename: `${safeName}_QRCode.png`,
      mimeType: 'image/png',
      title: `${activeItem.title} QR Code`,
      destination: 'photos',
      folder: 'qr_codes',
    });
    showToast('Social QR code image saved!');
  };

  const handleDownloadFlyerPdf = async () => {
    if (!activeQrDataUrl || !activeItem) return;
    setIsGeneratingPdf(true);
    try {
      const cfg = PLATFORMS_CONFIG[activeItem.platform] || PLATFORMS_CONFIG.custom;
      const platformTitle = activeItem.customPlatformName || cfg.name;
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const primaryHex = activeItem.darkColor || cfg.brandColor || '#059669';

      // Header Banner
      doc.setFillColor(primaryHex);
      doc.rect(0, 0, pageWidth, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(business.name || 'Welcome', pageWidth / 2, 22, { align: 'center' });

      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Official ${platformTitle} Channel`, pageWidth / 2, 34, { align: 'center' });

      // Call to action title
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(activeItem.ctaText || `Connect on ${platformTitle}`, pageWidth / 2, 70, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text('Scan with your smartphone camera to connect instantly', pageWidth / 2, 80, { align: 'center' });

      // QR Frame box
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.roundedRect(45, 95, 120, 120, 8, 8, 'S');

      // Add QR Code
      doc.addImage(activeQrDataUrl, 'PNG', 50, 100, 110, 110);

      // Handle or Link below QR
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(activeItem.title, pageWidth / 2, 235, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(activeItem.fullUrl, pageWidth / 2, 245, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Powered by Brivu • ${new Date().toLocaleDateString()}`, pageWidth / 2, 275, { align: 'center' });

      const safeName = activeItem.title.replace(/[^a-zA-Z0-9]/g, '_');
      await saveJsPdf(doc, `${safeName}_Social_Stand.pdf`, `${activeItem.title} Social Stand`, {
        folder: 'qr_codes',
      });
      showToast('Social Stand Flyer PDF downloaded!');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF flyer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const getPlatformDisplay = (item: SocialQrItem) => {
    const cfg = PLATFORMS_CONFIG[item.platform];
    const name = item.customPlatformName || cfg?.name || 'Platform';
    const color = item.darkColor || cfg?.brandColor || '#059669';
    return { name, color };
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-md">
              <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-400/30 border border-emerald-300/40 text-emerald-100">
                  Social Channels & Chat QR
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Socials QR</h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1 leading-snug">
                Connect customers directly to your WhatsApp, Instagram, TikTok, Facebook & custom social channels with one scan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleOpenCreateModal('whatsapp')}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-800 font-extrabold text-xs shadow-lg hover:bg-emerald-50 active:scale-95 transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Create Social QR</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quick Platform Triggers Bar */}
      <div className="space-y-2">
        <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 block px-1">
          Popular Platforms
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {(
            [
              'whatsapp',
              'instagram',
              'tiktok',
              'facebook',
              'youtube',
              'telegram',
              'twitter',
              'linkedin',
              'snapchat',
              'pinterest',
              'google_maps',
            ] as SocialPlatformType[]
          ).map((pKey) => {
            const cfg = PLATFORMS_CONFIG[pKey];
            return (
              <button
                key={pKey}
                type="button"
                onClick={() => handleOpenCreateModal(pKey)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 hover:bg-slate-50 text-xs font-bold shrink-0 flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cfg.brandColor }}
                />
                <span>{cfg.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Social QR Cards Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Active Social QR Codes ({items.length})
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => {
            const isSelected = item.id === (activeItem?.id || '');
            const { name, color } = getPlatformDisplay(item);
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 shadow-md'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs font-black text-white text-xs"
                    style={{ backgroundColor: color }}
                  >
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                      {item.usernameOrPhone}
                    </p>
                  </div>
                </div>

                 <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Social Showcase */}
      {activeItem ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
            {/* Live QR Image Box */}
            <div className="flex flex-col items-center gap-2.5 shrink-0">
              <div
                className="p-3.5 rounded-2xl shadow-xl border-2 transition-all flex items-center justify-center"
                style={{
                  backgroundColor: activeItem.lightColor || '#ffffff',
                  borderColor: `${activeItem.darkColor}40`,
                }}
              >
                {activeQrDataUrl ? (
                  <img
                    src={activeQrDataUrl}
                    alt={activeItem.title}
                    className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                  />
                ) : (
                  <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400">
                    Generating QR...
                  </div>
                )}
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {activeItem.ctaText}
              </span>
            </div>

            {/* Info & Action Controls */}
            <div className="flex-1 min-w-0 space-y-4 w-full text-left">
              <div>
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full text-white mb-1.5 shadow-2xs"
                  style={{ backgroundColor: activeItem.darkColor || '#059669' }}
                >
                  {activeItem.customPlatformName || PLATFORMS_CONFIG[activeItem.platform]?.name || 'Social'}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {activeItem.title}
                </h2>
                <a
                  href={activeItem.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium mt-1 break-all"
                >
                  <span>{activeItem.fullUrl}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>

                {activeItem.prefilledMessage && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400 block mb-0.5">
                      Prefilled Greeting Message:
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 italic">
                      "{activeItem.prefilledMessage}"
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PNG</span>
                </button>

                <button
                  type="button"
                  disabled={isGeneratingPdf}
                  onClick={handleDownloadFlyerPdf}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{isGeneratingPdf ? 'Generating...' : 'Print Stand PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{isCopied ? 'Copied!' : 'Copy Link'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share</span>
                </button>

                <a
                  href={activeItem.fullUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Link</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeItem)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 flex items-center justify-center mx-auto">
            <MessageCircle className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              No Social QR Codes Created
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Select one of the popular platforms above to create your first scannable social channel QR code.
            </p>
          </div>
        </div>
      )}

      {/* CREATE / EDIT SOCIAL MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 pb-28 sm:p-4 sm:pb-8 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[80vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingItem ? 'Edit Social QR' : 'Create Social Media QR'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Connect customers instantly with direct chat & profiles
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form id="socials-qr-form" onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
              {/* Platform Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Select Platform
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Choose preset or custom
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {(Object.keys(PLATFORMS_CONFIG) as SocialPlatformType[]).map((pKey) => {
                    const cfg = PLATFORMS_CONFIG[pKey];
                    const isSelected = formPlatform === pKey;
                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => {
                          setFormPlatform(pKey);
                          if (!editingItem) {
                            const nameToUse = pKey === 'custom' ? (formCustomName || 'Custom Platform') : cfg.name;
                            setFormCustomName(nameToUse);
                            setFormTitle(`${business.name || 'Our'} ${nameToUse}`);
                            setFormCta(cfg.defaultCta);
                            const bColor = cfg.brandColor === '#000000' || cfg.brandColor === '#0f172a' ? '#0f172a' : cfg.brandColor;
                            setFormDarkColor(bColor);
                            setFormEyeColor(bColor);
                          }
                        }}
                        className={`p-2 rounded-xl border text-left text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cfg.brandColor }}
                        />
                        <span className="truncate">{cfg.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Platform Name if custom or manual */}
              {formPlatform === 'custom' && (
                <div className="p-3 rounded-2xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/60 space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-teal-800 dark:text-teal-300 block">
                    Custom Platform Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Threads, Discord, WeChat, Substack, Yelp"
                    value={formCustomName}
                    onChange={(e) => {
                      setFormCustomName(e.target.value);
                      if (!editingItem && (!formTitle || formTitle.includes(business.name || ''))) {
                        setFormTitle(`${business.name || 'Our'} ${e.target.value}`);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                  />
                  <p className="text-[11px] text-teal-700/80 dark:text-teal-300/80">
                    Type any social network name or community name.
                  </p>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  QR Title / Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chat on WhatsApp, Follow on Instagram"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>

              {/* Username / Phone / Link */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  {formPlatform === 'whatsapp'
                    ? 'Phone Number (with Country Code) *'
                    : formPlatform === 'custom'
                    ? 'Profile URL, Server Link or Username *'
                    : 'Username Handle / Link *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={PLATFORMS_CONFIG[formPlatform]?.placeholder || 'https://...'}
                  value={formInputVal}
                  onChange={(e) => setFormInputVal(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {PLATFORMS_CONFIG[formPlatform]?.helperText || 'Enter full URL or profile link'}
                </p>
              </div>

              {/* Prefilled message for WhatsApp */}
              {formPlatform === 'whatsapp' && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Prefilled Message (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Hello, I want to inquire about..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>
              )}

              {/* CTA Badge Text */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Call-To-Action Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Chat on WhatsApp, Follow on TikTok"
                  value={formCta}
                  onChange={(e) => setFormCta(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-2.5 shrink-0 z-10">
              <button
                type="submit"
                form="socials-qr-form"
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingItem ? 'Save Changes' : 'Create Social QR'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
