import React, { useState, useEffect, useMemo } from 'react';
import {
  Globe,
  Smartphone,
  Plus,
  Trash2,
  Edit3,
  Download,
  Share2,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Sparkles,
  Save,
  X,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Palette,
  Eye,
  Link2,
  AppWindow,
} from 'lucide-react';
import { BusinessProfile } from '../types';
import { QRHostingService } from '../services/qrHostingService';
import { saveFile, shareContent } from '../services/fileSaver';
import { jsPDF } from 'jspdf';
import { saveJsPdf } from '../services/fileSaver';

export interface WebsiteAppQrItem {
  id: string;
  title: string;
  url: string;
  type: 'website' | 'android_app' | 'ios_app' | 'web_app' | 'custom_link';
  ctaText: string;
  darkColor: string;
  lightColor: string;
  eyeColor?: string;
  description?: string;
  createdAt: string;
}

const STORAGE_KEY = 'quickreceipt_websites_apps_qr_v1';

const COLOR_PRESETS = [
  { name: 'Royal Blue', dark: '#2563eb', light: '#ffffff', eye: '#1d4ed8' },
  { name: 'Emerald Green', dark: '#059669', light: '#ffffff', eye: '#047857' },
  { name: 'Indigo Purple', dark: '#4f46e5', light: '#ffffff', eye: '#4338ca' },
  { name: 'Midnight Slate', dark: '#0f172a', light: '#ffffff', eye: '#0f172a' },
  { name: 'Amber Gold', dark: '#d97706', light: '#ffffff', eye: '#b45309' },
  { name: 'Crimson Rose', dark: '#e11d48', light: '#ffffff', eye: '#be123c' },
];

const TYPE_OPTIONS = [
  { id: 'website', label: 'Website / Landing Page', icon: Globe, defaultCta: 'Scan to Visit Website' },
  { id: 'android_app', label: 'Android App (Google Play)', icon: Smartphone, defaultCta: 'Get on Google Play' },
  { id: 'ios_app', label: 'iOS App (App Store)', icon: AppWindow, defaultCta: 'Download on App Store' },
  { id: 'web_app', label: 'Web App / Portal', icon: Link2, defaultCta: 'Open Online App' },
  { id: 'custom_link', label: 'Custom Booking / Order Link', icon: ExternalLink, defaultCta: 'Scan to Order / Book' },
] as const;

interface WebsitesAppsQrSectionProps {
  business: BusinessProfile;
  showToast: (msg: string) => void;
}

export const WebsitesAppsQrSection: React.FC<WebsitesAppsQrSectionProps> = ({
  business,
  showToast,
}) => {
  const [items, setItems] = useState<WebsiteAppQrItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }
    // Default initial item using business website or sample
    return [
      {
        id: 'web-default-1',
        title: business.website ? `${business.name || 'Business'} Official Website` : 'Our Official Website',
        url: business.website || 'https://brivu.app',
        type: 'website',
        ctaText: 'Scan to Visit Website',
        darkColor: '#2563eb',
        lightColor: '#ffffff',
        eyeColor: '#1d4ed8',
        description: 'Instant access to our official website, catalogs & online services.',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => items[0]?.id || '');
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<WebsiteAppQrItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formUrl, setFormUrl] = useState<string>('');
  const [formType, setFormType] = useState<WebsiteAppQrItem['type']>('website');
  const [formCta, setFormCta] = useState<string>('Scan to Visit Website');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formDarkColor, setFormDarkColor] = useState<string>('#2563eb');
  const [formLightColor, setFormLightColor] = useState<string>('#ffffff');
  const [formEyeColor, setFormEyeColor] = useState<string>('#1d4ed8');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Save to storage on update
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
    if (!activeItem || !activeItem.url) return;
    QRHostingService.generateQrCodeDataUrl(activeItem.url, {
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

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormUrl('https://');
    setFormType('website');
    setFormCta('Scan to Visit Website');
    setFormDesc('');
    setFormDarkColor('#2563eb');
    setFormLightColor('#ffffff');
    setFormEyeColor('#1d4ed8');
    setShowModal(true);
  };

  const handleOpenEditModal = (item: WebsiteAppQrItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormUrl(item.url);
    setFormType(item.type);
    setFormCta(item.ctaText);
    setFormDesc(item.description || '');
    setFormDarkColor(item.darkColor);
    setFormLightColor(item.lightColor);
    setFormEyeColor(item.eyeColor || item.darkColor);
    setShowModal(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formUrl.trim()) {
      showToast('Please enter both Title and Destination URL');
      return;
    }

    let cleanUrl = formUrl.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                title: formTitle.trim(),
                url: cleanUrl,
                type: formType,
                ctaText: formCta.trim() || 'Scan to Open',
                description: formDesc.trim(),
                darkColor: formDarkColor,
                lightColor: formLightColor,
                eyeColor: formEyeColor,
              }
            : i
        )
      );
      showToast('Website / App QR updated!');
    } else {
      const newItem: WebsiteAppQrItem = {
        id: `web-app-qr-${Date.now()}`,
        title: formTitle.trim(),
        url: cleanUrl,
        type: formType,
        ctaText: formCta.trim() || 'Scan to Open',
        description: formDesc.trim(),
        darkColor: formDarkColor,
        lightColor: formLightColor,
        eyeColor: formEyeColor,
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      setSelectedItemId(newItem.id);
      showToast('New Website / App QR created!');
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
    showToast('QR Code deleted.');
  };

  const handleCopyLink = async () => {
    if (!activeItem) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeItem.url);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        showToast('Link copied to clipboard!');
      }
    } catch {
      showToast('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!activeItem) return;
    await shareContent({
      title: activeItem.title,
      text: `${activeItem.ctaText}: ${activeItem.url}`,
      url: activeItem.url,
      dialogTitle: 'Share Website / App QR',
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
    showToast('High-resolution QR code saved!');
  };

  const handleDownloadFlyerPdf = async () => {
    if (!activeQrDataUrl || !activeItem) return;
    setIsGeneratingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = 210;
      const pageHeight = 297;

      // Clean background
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Top Header Card
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(15, 15, 180, 42, 6, 6, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(business.name || 'Official Online Hub', pageWidth / 2, 32, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);
      doc.text(activeItem.title, pageWidth / 2, 45, { align: 'center' });

      // Main QR Frame Box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(25, 65, 160, 165, 8, 8, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.roundedRect(25, 65, 160, 165, 8, 8, 'S');

      // CTA Badge
      doc.setFillColor(37, 99, 235);
      doc.roundedRect(45, 75, 120, 14, 4, 4, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(activeItem.ctaText.toUpperCase(), pageWidth / 2, 84, { align: 'center' });

      // Embed QR Code
      doc.addImage(activeQrDataUrl, 'PNG', 45, 96, 120, 120);

      // Footer Instructions & URL
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Scan with your smartphone camera', pageWidth / 2, 242, { align: 'center' });

      doc.setTextColor(100, 116, 139);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text(activeItem.url, pageWidth / 2, 252, { align: 'center' });

      doc.setFontSize(9);
      doc.text(`Powered by Brivu • ${new Date().toLocaleDateString()}`, pageWidth / 2, 280, { align: 'center' });

      const safeName = activeItem.title.replace(/[^a-zA-Z0-9]/g, '_');
      await saveJsPdf(doc, `${safeName}_Stand_Flyer.pdf`, `${activeItem.title} Stand Flyer`, {
        folder: 'qr_codes',
      });
      showToast('Printable Stand Flyer PDF downloaded!');
    } catch (err) {
      console.error(err);
      showToast('Failed to generate PDF flyer.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-slate-900 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-md">
              <Globe className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-blue-400/30 border border-blue-300/40 text-blue-100">
                  Websites & Apps QR Hub
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Websites / Apps QR</h1>
              <p className="text-xs sm:text-sm text-blue-100/90 font-medium mt-1 leading-snug">
                Generate high-resolution scannable QR codes for your websites, mobile apps, booking links & web apps.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-white text-blue-700 font-extrabold text-xs shadow-lg hover:bg-blue-50 active:scale-95 transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Website / App QR</span>
          </button>
        </div>
      </div>

      {/* Item Selector List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Website & App QR Codes ({items.length})
          </span>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add New</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => {
            const isSelected = item.id === (activeItem?.id || '');
            const typeObj = TYPE_OPTIONS.find((t) => t.id === item.type) || TYPE_OPTIONS[0];
            const Icon = typeObj.icon;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs"
                    style={{ backgroundColor: `${item.darkColor}15`, color: item.darkColor }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.url}
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

      {/* Active QR Code Showcase Card */}
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
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 mb-1.5">
                  <Globe className="w-3 h-3" />
                  {activeItem.type.replace('_', ' ')}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {activeItem.title}
                </h2>
                <a
                  href={activeItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium mt-1 break-all"
                >
                  <span>{activeItem.url}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                {activeItem.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    {activeItem.description}
                  </p>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                  href={activeItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open URL</span>
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
            <Globe className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              No Website or App QR Codes Created
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Tap "Create Website / App QR" or "+ Add New" above to add your first custom online link.
            </p>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 pb-28 sm:p-4 sm:pb-8 bg-slate-950/75 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[80vh] sm:max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingItem ? 'Edit Website / App QR' : 'Create Website / App QR'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure destination link, call to action & details
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

            <form id="website-qr-form" onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
              {/* Title */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Title / Label *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Official Website, Download App, Book Online"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* URL */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Destination URL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://example.com/myapp"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* CTA Badge Text */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Call-To-Action Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scan to Visit Website, Download App Now"
                  value={formCta}
                  onChange={(e) => setFormCta(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Optional Description / Subtitle
                </label>
                <input
                  type="text"
                  placeholder="e.g. Discover our latest items, products and contact channels"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-2.5 shrink-0 z-10">
              <button
                type="submit"
                form="website-qr-form"
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingItem ? 'Save Changes' : 'Create QR Code'}</span>
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
