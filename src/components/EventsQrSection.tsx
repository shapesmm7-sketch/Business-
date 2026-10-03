import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Download,
  Share2,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Save,
  X,
  Sparkles,
  Ticket,
  Image as ImageIcon,
  Camera,
  Upload,
  Loader2,
} from 'lucide-react';
import { BusinessProfile } from '../types';
import { QRHostingService } from '../services/qrHostingService';
import { saveFile, shareContent, saveJsPdf } from '../services/fileSaver';
import { compressImageFile } from '../utils/imageCompressor';
import { jsPDF } from 'jspdf';

export interface EventQrItem {
  id: string;
  title: string;
  eventDate?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  location: string;
  rsvpUrl: string;
  description?: string;
  ctaText: string;
  photos?: string[];
  darkColor: string;
  lightColor: string;
  eyeColor?: string;
  createdAt: string;
}

const STORAGE_KEY = 'quickreceipt_events_qr_v1';

interface EventsQrSectionProps {
  business: BusinessProfile;
  showToast: (msg: string) => void;
}

export const EventsQrSection: React.FC<EventsQrSectionProps> = ({
  business,
  showToast,
}) => {
  const [items, setItems] = useState<EventQrItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.error(e);
    }

    const defaultContact = business.whatsapp || business.phone || business.website || 'https://brivu.app';
    return [
      {
        id: 'event-default-1',
        title: `${business.name || 'Our Business'} Special Event / Showcase`,
        startDate: '2026-10-25',
        endDate: '2026-10-26',
        startTime: '10:00',
        endTime: '20:00',
        location: business.address || 'Main Venue / City Center',
        rsvpUrl: defaultContact.startsWith('http') || defaultContact.startsWith('+') ? defaultContact : `https://wa.me/${defaultContact.replace(/[^0-9]/g, '')}`,
        description: 'Join us for our upcoming exclusive event! Scan to RSVP, view details, and save to calendar.',
        ctaText: 'Scan to RSVP & Join Event',
        darkColor: '#7c3aed',
        lightColor: '#ffffff',
        eyeColor: '#6d28d9',
        createdAt: new Date().toISOString(),
      },
    ];
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => items[0]?.id || '');
  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<EventQrItem | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formStartTime, setFormStartTime] = useState<string>('');
  const [formEndTime, setFormEndTime] = useState<string>('');
  const [formLocation, setFormLocation] = useState<string>('');
  const [formRsvp, setFormRsvp] = useState<string>('');
  const [formCta, setFormCta] = useState<string>('Scan to RSVP & Join Event');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Persistence
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error(err);
    }
  }, [items]);

  const activeItem = items.find((i) => i.id === selectedItemId) || items[0];

  // Generate QR
  useEffect(() => {
    if (!activeItem || !activeItem.rsvpUrl) return;
    QRHostingService.generateQrCodeDataUrl(activeItem.rsvpUrl, {
      width: 600,
      margin: 1.5,
      color: {
        dark: activeItem.darkColor || '#7c3aed',
        light: activeItem.lightColor || '#ffffff',
        eyeColor: activeItem.eyeColor || '#6d28d9',
      },
    })
      .then((data) => setActiveQrDataUrl(data))
      .catch((err) => console.error(err));
  }, [activeItem]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle(`${business.name || 'Business'} Event`);
    setFormStartDate('');
    setFormEndDate('');
    setFormStartTime('');
    setFormEndTime('');
    setFormLocation(business.address || '');
    setFormRsvp(business.whatsapp || business.phone || business.website || '');
    setFormCta('Scan to RSVP & Join Event');
    setFormDesc('');
    setFormPhotos([]);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: EventQrItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormStartDate(item.startDate || (item.eventDate ? item.eventDate.split('T')[0] : ''));
    setFormEndDate(item.endDate || '');
    setFormStartTime(item.startTime || (item.eventDate && item.eventDate.includes('T') ? item.eventDate.split('T')[1] : ''));
    setFormEndTime(item.endTime || '');
    setFormLocation(item.location);
    setFormRsvp(item.rsvpUrl);
    setFormCta(item.ctaText);
    setFormDesc(item.description || '');
    setFormPhotos(item.photos || []);
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 3 - formPhotos.length;
    if (availableSlots <= 0) {
      showToast('Maximum of 3 photos allowed.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const filesToProcess = Array.from(files).slice(0, availableSlots);
      const newPhotoUrls: string[] = [];
      for (const file of filesToProcess) {
        const compressed = await compressImageFile(file, {
          maxDimension: 800,
          quality: 0.8,
        });
        newPhotoUrls.push(compressed);
      }
      setFormPhotos((prev) => [...prev, ...newPhotoUrls].slice(0, 3));
      showToast(`${newPhotoUrls.length} photo(s) added!`);
    } catch (err) {
      console.error(err);
      showToast('Failed to process image.');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleRemovePhoto = (index: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formRsvp.trim()) {
      showToast('Please fill in Event Title and RSVP / Location info');
      return;
    }

    let cleanRsvp = formRsvp.trim();
    if (!/^https?:\/\//i.test(cleanRsvp) && !/^\+?[0-9]+$/i.test(cleanRsvp)) {
      cleanRsvp = `https://${cleanRsvp}`;
    } else if (/^\+?[0-9]+$/i.test(cleanRsvp)) {
      const cleanPhone = cleanRsvp.replace(/[^0-9]/g, '');
      cleanRsvp = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hello, I would like to RSVP for ${formTitle.trim()}!`)}`;
    }

    if (editingItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? {
                ...i,
                title: formTitle.trim(),
                startDate: formStartDate,
                endDate: formEndDate,
                startTime: formStartTime,
                endTime: formEndTime,
                eventDate: formStartDate || i.eventDate || '',
                location: formLocation.trim() || 'Venue Location',
                rsvpUrl: cleanRsvp,
                ctaText: formCta.trim() || 'Scan to RSVP',
                description: formDesc.trim(),
                photos: formPhotos,
              }
            : i
        )
      );
      showToast('Event QR updated!');
    } else {
      const newItem: EventQrItem = {
        id: `event-qr-${Date.now()}`,
        title: formTitle.trim(),
        startDate: formStartDate,
        endDate: formEndDate,
        startTime: formStartTime,
        endTime: formEndTime,
        eventDate: formStartDate || '',
        location: formLocation.trim() || 'Venue Location',
        rsvpUrl: cleanRsvp,
        ctaText: formCta.trim() || 'Scan to RSVP',
        description: formDesc.trim(),
        photos: formPhotos,
        darkColor: '#7c3aed',
        lightColor: '#ffffff',
        eyeColor: '#6d28d9',
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      setSelectedItemId(newItem.id);
      showToast('New Event QR created!');
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
    showToast('Event QR deleted.');
  };

  const handleCopyLink = async () => {
    if (!activeItem) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeItem.rsvpUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        showToast('RSVP link copied to clipboard!');
      }
    } catch {
      showToast('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!activeItem) return;
    await shareContent({
      title: activeItem.title,
      text: `${activeItem.title} - ${activeItem.location}: ${activeItem.rsvpUrl}`,
      url: activeItem.rsvpUrl,
      dialogTitle: 'Share Event QR',
    });
  };

  const handleDownloadPng = async () => {
    if (!activeQrDataUrl || !activeItem) return;
    const safeName = activeItem.title.replace(/[^a-zA-Z0-9]/g, '_');
    await saveFile({
      data: activeQrDataUrl,
      filename: `${safeName}_EventQR.png`,
      mimeType: 'image/png',
      title: `${activeItem.title} Event QR Code`,
      destination: 'photos',
      folder: 'qr_codes',
    });
    showToast('Event QR code image saved!');
  };

  const formatEventDateTime = (item: EventQrItem) => {
    const parts: string[] = [];

    // Date range
    if (item.startDate) {
      try {
        const startStr = new Date(item.startDate).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        if (item.endDate && item.endDate !== item.startDate) {
          const endStr = new Date(item.endDate).toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          parts.push(`${startStr} - ${endStr}`);
        } else {
          parts.push(startStr);
        }
      } catch {
        parts.push(item.startDate);
      }
    } else if (item.eventDate) {
      try {
        parts.push(new Date(item.eventDate).toLocaleDateString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }));
      } catch {
        parts.push(item.eventDate);
      }
    }

    // Time range
    if (item.startTime) {
      if (item.endTime) {
        parts.push(`${item.startTime} - ${item.endTime}`);
      } else {
        parts.push(`Starts at ${item.startTime}`);
      }
    } else if (item.endTime) {
      parts.push(`Ends at ${item.endTime}`);
    }

    return parts.length > 0 ? parts.join(' • ') : null;
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

      // Header Banner
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, pageWidth, 48, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(business.name || 'Official Event', pageWidth / 2, 22, { align: 'center' });

      doc.setFontSize(13);
      doc.setFont('helvetica', 'normal');
      doc.text(activeItem.title, pageWidth / 2, 36, { align: 'center' });

      // Call to action title
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(activeItem.ctaText || 'Scan to Join Event', pageWidth / 2, 68, { align: 'center' });

      const dtFormatted = formatEventDateTime(activeItem);
      if (dtFormatted) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Date & Time: ${dtFormatted}`, pageWidth / 2, 78, { align: 'center' });
      }

      if (activeItem.location) {
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Venue: ${activeItem.location}`, pageWidth / 2, 86, { align: 'center' });
      }

      // QR Frame box
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(1);
      doc.roundedRect(45, 96, 120, 120, 8, 8, 'S');

      // Add QR Code
      doc.addImage(activeQrDataUrl, 'PNG', 50, 101, 110, 110);

      // Handle or Link below QR
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(activeItem.rsvpUrl, pageWidth / 2, 232, { align: 'center' });

      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text(`Powered by Brivu • ${new Date().toLocaleDateString()}`, pageWidth / 2, 275, { align: 'center' });

      const safeName = activeItem.title.replace(/[^a-zA-Z0-9]/g, '_');
      await saveJsPdf(doc, `${safeName}_Event_Flyer.pdf`, `${activeItem.title} Event Stand`, {
        folder: 'qr_codes',
      });
      showToast('Event Flyer PDF downloaded!');
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
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-purple-700 via-indigo-800 to-slate-900 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-md">
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-purple-400/30 border border-purple-300/40 text-purple-100">
                  Host Events & Invitations
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight">Host Events QR</h1>
              <p className="text-xs sm:text-sm text-purple-100/90 font-medium mt-1 leading-snug">
                Host conferences, sales events, parties & meetups. Generate scannable QR codes for invitations & flyers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-white text-purple-900 font-extrabold text-xs shadow-lg hover:bg-purple-50 active:scale-95 transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Event QR</span>
          </button>
        </div>
      </div>

      {/* Active Events Cards Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Your Active Event QR Codes ({items.length})
          </span>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Event</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {items.map((item) => {
            const isSelected = item.id === (activeItem?.id || '');
            return (
              <div
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/20 shadow-md'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.photos && item.photos[0] ? (
                    <img
                      src={item.photos[0]}
                      alt={item.title}
                      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-purple-200 dark:border-purple-800"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0 shadow-xs font-bold">
                      <Ticket className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-purple-500 shrink-0" />
                      <span>{item.location}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                    title="Edit"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteItem(item.id, e)}
                    className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-600 dark:text-rose-400 transition cursor-pointer"
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

      {/* Active Event Showcase Card */}
      {activeItem ? (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
            {/* Live QR Image Box */}
            <div className="flex flex-col items-center gap-2.5 shrink-0">
              <div
                className="p-3.5 rounded-2xl shadow-xl border-2 transition-all flex items-center justify-center bg-white border-purple-200 dark:border-purple-800"
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
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-3 py-1 rounded-full border border-purple-200 dark:border-purple-800/60">
                {activeItem.ctaText}
              </span>
            </div>

            {/* Info & Action Controls */}
            <div className="flex-1 min-w-0 space-y-4 w-full text-left">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 mb-1.5">
                  <Calendar className="w-3 h-3" />
                  Event Invitation
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                  {activeItem.title}
                </h2>

                {/* Event Photos Showcase Gallery */}
                {activeItem.photos && activeItem.photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 my-3">
                    {activeItem.photos.map((photo, pIdx) => (
                      <div key={pIdx} className="aspect-video sm:aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-xs bg-slate-100 dark:bg-slate-900">
                        <img src={photo} alt={`Event Photo ${pIdx + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2.5 space-y-1.5">
                  {formatEventDateTime(activeItem) && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>{formatEventDateTime(activeItem)}</span>
                    </div>
                  )}

                  {activeItem.location && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 shrink-0" />
                      <span>{activeItem.location}</span>
                    </div>
                  )}
                </div>

                <a
                  href={activeItem.rsvpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-medium mt-2 break-all"
                >
                  <span>RSVP / Link: {activeItem.rsvpUrl}</span>
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
                  className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
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
                  href={activeItem.rsvpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open RSVP</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeItem)}
                  className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Event</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-5 h-5 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              No Event QR Codes Created
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Tap "Create Event QR" above to add your first event invitation and RSVP QR code.
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
                <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/70 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {editingItem ? 'Edit Event QR' : 'Create Event QR'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Configure event title, dates, photos & RSVP details
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

            <form id="event-qr-form" onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
              {/* Event Title */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Event Title / Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Tech Summit, Grand Opening, Wedding"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* Event Dates (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Event Dates (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-medium">Start Date</span>
                    <input
                      type="date"
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-medium">End Date</span>
                    <input
                      type="date"
                      value={formEndDate}
                      onChange={(e) => setFormEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Event Times (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Event Times (Optional)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-medium">Start Time</span>
                    <input
                      type="time"
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-medium">End Time</span>
                    <input
                      type="time"
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Event Photos Upload (Up to 3 Photos, Optional) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Event Photos (Up to 3 Photos, Optional)
                  </label>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {formPhotos.length}/3 photos
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {formPhotos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 group bg-slate-100 dark:bg-slate-800">
                      <img src={photo} alt={`Event Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1.5 right-1.5 p-1 rounded-full bg-rose-600 text-white shadow-md hover:bg-rose-700 transition cursor-pointer"
                        title="Remove photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {formPhotos.length < 3 && (
                    <label className={`aspect-square rounded-2xl border-2 border-dashed border-purple-300 dark:border-purple-800/60 hover:border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 flex flex-col items-center justify-center gap-1 cursor-pointer transition text-purple-600 dark:text-purple-400 ${isUploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handlePhotoUpload}
                        disabled={isUploadingPhoto}
                      />
                      {isUploadingPhoto ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Camera className="w-5 h-5" />
                          <span className="text-[10px] font-bold">Add Photo</span>
                        </>
                      )}
                    </label>
                  )}
                </div>
              </div>

              {/* Venue / Location */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium, City Center, Kampala"
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* RSVP Link / Phone */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  RSVP Phone, WhatsApp, or Registration URL *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. +256700000000 or https://event.com/rsvp"
                  value={formRsvp}
                  onChange={(e) => setFormRsvp(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* Call-To-Action Text */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Call-To-Action Text
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scan to RSVP & Join Event"
                  value={formCta}
                  onChange={(e) => setFormCta(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>

              {/* Description / Agenda */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Optional Description / Agenda
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Join us for guest speakers, live demos, and networking."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                />
              </div>
            </form>

            {/* Sticky Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-2.5 shrink-0 z-10">
              <button
                type="submit"
                form="event-qr-form"
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{editingItem ? 'Save Changes' : 'Create Event QR'}</span>
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
