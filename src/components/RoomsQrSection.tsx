import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble,
  Users,
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
  Image as ImageIcon,
  Upload,
  Loader2,
  Palette,
  MessageCircle,
  Layers,
  Eye,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { BusinessProfile, RoomQrItem, QRCodeHostedPage } from '../types';
import { QRHostingService } from '../services/qrHostingService';
import { saveFile, shareContent } from '../services/fileSaver';
import { compressImageFile } from '../utils/imageCompressor';
import { QRCodeColorEditorScreen } from './QRCodeColorEditorScreen';
import { PhoneInputField } from './PhoneInputField';
import { StorageService } from '../services/storage';
import { CloudflareService } from '../services/cloudflareService';
import { QrDeleteConfirmModal } from './QrDeleteConfirmModal';
import { t, formatNumber } from '../utils/i18n';

interface RoomsQrSectionProps {
  business: BusinessProfile;
  hostedPageId?: string;
  showToast: (msg: string) => void;
  onOpenCustomerView?: (page: QRCodeHostedPage) => void;
}

const PRESET_AMENITIES = [
  'Free WiFi',
  'Air Conditioning',
  'Breakfast Included',
];

const resolveOnlinePhotoUrl = (rawUrl?: string): string => {
  if (!rawUrl) return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/api/files/')) {
    return `https://brivu.shapesmm.com${trimmed}`;
  }
  return trimmed;
};

export const RoomsQrSection: React.FC<RoomsQrSectionProps> = ({
  business,
  showToast,
  onOpenCustomerView,
}) => {
  const [rooms, setRooms] = useState<RoomQrItem[]>(() => StorageService.getRoomsQrItems());
  const [selectedRoomId, setSelectedRoomId] = useState<string>(() => {
    const stored = StorageService.getRoomsQrItems();
    return stored.length > 0 ? 'all' : '';
  });

  const [activeQrDataUrl, setActiveQrDataUrl] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<RoomQrItem | null>(null);

  // Form State
  const [formName, setFormName] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formOccupancy, setFormOccupancy] = useState<string>('');
  const [formBedType, setFormBedType] = useState<string>('');
  const [formAmenities, setFormAmenities] = useState<string[]>([]);
  const [customAmenityInput, setCustomAmenityInput] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formWhatsappPhone, setFormWhatsappPhone] = useState<string>('');
  const [formIsAvailable, setFormIsAvailable] = useState<boolean>(true);
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);

  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [qrLabelForPrint, setQrLabelForPrint] = useState<string>('');
  const [isEditingQrColors, setIsEditingQrColors] = useState<boolean>(false);
  const [pendingDelete, setPendingDelete] = useState<
    | { type: 'room'; item: RoomQrItem }
    | { type: 'photo'; index: number }
    | null
  >(null);

  const [allQrColors, setAllQrColors] = useState<{
    darkColor: string;
    eyeColor: string;
    lightColor: string;
    boxBgColor: string;
    boxBorderColor: string;
  }>({
    darkColor: '#059669',
    eyeColor: '#047857',
    lightColor: '#ffffff',
    boxBgColor: '#ffffff',
    boxBorderColor: '#cbd5e1',
  });

  const [ownerEmail, setOwnerEmail] = useState<string>(
    () => StorageService.getAuthenticatedEmail() || business.email || ''
  );

  const isAllSelected = selectedRoomId === 'all';
  const activeRoom = rooms.find((r) => r.id === selectedRoomId) || null;
  const currency = business.currency || StorageService.getProfile().currency || 'UGX';

  useEffect(() => {
    const authEmail = StorageService.getAuthenticatedEmail() || business.email || '';
    if (authEmail !== ownerEmail) {
      setOwnerEmail(authEmail);
    }
  }, [business.email]);

  const roomsHubUrl = useMemo(() => {
    return QRHostingService.getCustomerRoomsHubUrl(business.name, ownerEmail || business.email);
  }, [business.name, business.email, ownerEmail]);

  const activeUrl = isAllSelected
    ? roomsHubUrl
    : activeRoom
    ? QRHostingService.getCustomerRoomUrl(activeRoom.id, ownerEmail || business.email)
    : '';

  const activeDarkColor = isAllSelected ? allQrColors.darkColor : activeRoom?.darkColor || '#059669';
  const activeLightColor = isAllSelected ? allQrColors.lightColor : activeRoom?.lightColor || '#ffffff';
  const activeEyeColor = isAllSelected ? allQrColors.eyeColor : activeRoom?.eyeColor || activeDarkColor;
  const activeBoxBgColor = isAllSelected ? allQrColors.boxBgColor : activeRoom?.boxBgColor || '#ffffff';
  const activeBoxBorderColor = isAllSelected ? allQrColors.boxBorderColor : activeRoom?.boxBorderColor || '#cbd5e1';

  const shouldPersistRef = React.useRef(false);

  const handleUpdateRoomColors = (
    itemId: string,
    updates: {
      qrDarkColor: string;
      qrEyeColor: string;
      qrLightColor: string;
      qrBoxBgColor: string;
      qrBoxBorderColor: string;
    }
  ) => {
    if (itemId === 'all') {
      setAllQrColors({
        darkColor: updates.qrDarkColor,
        eyeColor: updates.qrEyeColor,
        lightColor: updates.qrLightColor,
        boxBgColor: updates.qrBoxBgColor,
        boxBorderColor: updates.qrBoxBorderColor,
      });
      return;
    }
    shouldPersistRef.current = true;
    setRooms((prev) =>
      prev.map((rm) =>
        rm.id === itemId
          ? {
              ...rm,
              darkColor: updates.qrDarkColor,
              eyeColor: updates.qrEyeColor,
              lightColor: updates.qrLightColor,
              boxBgColor: updates.qrBoxBgColor,
              boxBorderColor: updates.qrBoxBorderColor,
            }
          : rm
      )
    );
  };

  useEffect(() => {
    const syncFromStorage = () => {
      const fresh = StorageService.getRoomsQrItems();
      setRooms(fresh);
      const nextEmail = StorageService.getAuthenticatedEmail() || business.email || '';
      setOwnerEmail(nextEmail);
      setSelectedRoomId((prev) => {
        if (prev === 'all' && fresh.length > 0) return 'all';
        if (prev && fresh.some((r) => r.id === prev)) return prev;
        return fresh.length > 0 ? 'all' : '';
      });
    };
    window.addEventListener('brivu_data_refreshed', syncFromStorage);
    window.addEventListener('brivu_auth_changed', syncFromStorage);
    window.addEventListener('storage', syncFromStorage);

    const authEmail = StorageService.getAuthenticatedEmail();
    if (authEmail && StorageService.getRoomsQrItems().length === 0) {
      CloudflareService.pullFromCloudflare(authEmail)
        .then((res) => {
          if (res?.success && StorageService.getRoomsQrItems().length === 0) {
            syncFromStorage();
          }
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('brivu_data_refreshed', syncFromStorage);
      window.removeEventListener('brivu_auth_changed', syncFromStorage);
      window.removeEventListener('storage', syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (!shouldPersistRef.current) return;
    shouldPersistRef.current = false;
    StorageService.saveRoomsQrItems(rooms);
  }, [rooms]);

  useEffect(() => {
    if (!activeUrl) {
      setActiveQrDataUrl('');
      return;
    }
    QRHostingService.generateQrCodeDataUrl(activeUrl, {
      width: 600,
      margin: 1.5,
      color: {
        dark: activeDarkColor,
        light: activeLightColor,
        eyeColor: activeEyeColor,
      },
    })
      .then((data) => setActiveQrDataUrl(data))
      .catch((err) => console.error(err));
  }, [activeUrl, activeDarkColor, activeLightColor, activeEyeColor]);

  const MAX_ROOMS = 10;

  const handleOpenCreateModal = () => {
    if (rooms.length >= MAX_ROOMS) {
      showToast(`Limit reached: Maximum ${MAX_ROOMS} rooms allowed. Please delete a room to add a new one.`);
      return;
    }
    setEditingRoom(null);
    setFormName('');
    setFormPrice('');
    setFormOccupancy('');
    setFormBedType('');
    setFormAmenities([]);
    setCustomAmenityInput('');
    setFormDescription('');
    setFormWhatsappPhone((business.whatsapp || business.phone || '').trim());
    setFormIsAvailable(true);
    setFormPhotos([]);
    setShowModal(true);
  };

  const handleOpenEditModal = (room: RoomQrItem) => {
    setEditingRoom(room);
    setFormName(room.name || '');
    setFormPrice(room.pricePerNight ? String(room.pricePerNight) : '');
    setFormOccupancy(room.occupancy || '2 Guests');
    setFormBedType(room.bedType || '');
    setFormAmenities(Array.isArray(room.amenities) ? room.amenities : []);
    setCustomAmenityInput('');
    setFormDescription(room.description || '');
    setFormWhatsappPhone(room.whatsappPhone || business.whatsapp || business.phone || '');
    setFormIsAvailable(room.isAvailable !== false);
    setFormPhotos(Array.isArray(room.photos) ? room.photos : []);
    setShowModal(true);
  };

  const toggleAmenity = (amenity: string) => {
    setFormAmenities((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  const handleAddCustomAmenity = () => {
    const val = customAmenityInput.trim();
    if (!val) return;
    if (!formAmenities.some((a) => a.toLowerCase() === val.toLowerCase())) {
      setFormAmenities((prev) => [...prev, val]);
    }
    setCustomAmenityInput('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const availableSlots = 3 - formPhotos.length;
    if (availableSlots <= 0) {
      showToast('Maximum of 3 photos per room allowed.');
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const filesToProcess = files.slice(0, availableSlots);
      const uploadedUrls: string[] = [];
      let cloudUploadedCount = 0;

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        let finalUrl = '';
        const slotId = `room_photo_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`;

        try {
          const uploadRes = await CloudflareService.uploadFile({
            data: file,
            filename: `${slotId}.webp`,
            mimeType: file.type || 'image/jpeg',
            folder: 'photos',
            force: true,
            slotId,
          });
          if (uploadRes.success && uploadRes.url) {
            finalUrl = resolveOnlinePhotoUrl(uploadRes.url) || uploadRes.url;
            cloudUploadedCount++;
          } else if (uploadRes.requiresSubscription) {
            showToast(uploadRes.message || 'Subscribe to Pro to upload room photos.');
            break;
          }
        } catch (err) {
          console.warn('Room photo Cloudflare upload fallback:', err);
        }

        if (!finalUrl) {
          finalUrl = await compressImageFile(file, {
            maxDimension: 960,
            mimeType: 'image/webp',
            quality: 0.8,
            maxBytes: 120 * 1024,
          });
        }

        if (finalUrl) {
          uploadedUrls.push(finalUrl);
        }
      }

      if (uploadedUrls.length > 0) {
        setFormPhotos((prev) => [...prev, ...uploadedUrls].slice(0, 3));
        showToast(
          cloudUploadedCount > 0
            ? `${uploadedUrls.length} room photo(s) uploaded online!`
            : `${uploadedUrls.length} room photo(s) added!`
        );
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to process room photo.');
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  const confirmPendingPhotoRemove = (index: number) => {
    const targetUrl = formPhotos[index];
    if (targetUrl) {
      CloudflareService.deleteFile(targetUrl).catch(() => {});
    }
    setFormPhotos((prev) => prev.filter((_, i) => i !== index));
    showToast('Room photo removed.');
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Please enter a Room Name');
      return;
    }
    const parsedPrice = Number(String(formPrice).replace(/[^0-9.]/g, '')) || 0;
    if (parsedPrice <= 0) {
      showToast('Please enter the Price per Night');
      return;
    }

    const cleanWaPhone = formWhatsappPhone.trim() || (business.whatsapp || business.phone || '').trim();
    const pendingCustomAmenity = customAmenityInput.trim();
    const finalAmenities =
      pendingCustomAmenity && !formAmenities.some((a) => a.toLowerCase() === pendingCustomAmenity.toLowerCase())
        ? [...formAmenities, pendingCustomAmenity]
        : formAmenities;
    const finalOccupancy = formOccupancy.trim() || '2';

    if (editingRoom) {
      const updatedRoom: RoomQrItem = {
        ...editingRoom,
        name: formName.trim(),
        pricePerNight: parsedPrice,
        currency,
        occupancy: finalOccupancy,
        bedType: formBedType.trim() || undefined,
        amenities: finalAmenities,
        description: formDescription.trim() || undefined,
        photos: formPhotos.slice(0, 3),
        isAvailable: formIsAvailable,
        whatsappPhone: cleanWaPhone || undefined,
      };
      const nextRooms = rooms.map((r) => (r.id === editingRoom.id ? updatedRoom : r));
      StorageService.saveRoomsQrItemsLocalOnly(nextRooms);
      setRooms(nextRooms);
      showToast('Updating room & publishing online...');
      QRHostingService.syncRoomPage(updatedRoom, business, nextRooms).then((res) => {
        if (res.success) {
          showToast('Room updated & live online!');
        } else {
          showToast(`Room saved on device, but online sync failed: ${res.message || 'check connection'}`);
        }
      });
    } else {
      if (rooms.length >= MAX_ROOMS) {
        showToast(`Limit reached: Maximum ${MAX_ROOMS} rooms allowed. Please delete a room to add a new one.`);
        return;
      }
      const newRoom: RoomQrItem = {
        id: `room-qr-${Date.now()}`,
        name: formName.trim(),
        pricePerNight: parsedPrice,
        currency,
        occupancy: finalOccupancy,
        bedType: formBedType.trim() || undefined,
        amenities: finalAmenities,
        description: formDescription.trim() || undefined,
        photos: formPhotos.slice(0, 3),
        isAvailable: formIsAvailable,
        whatsappPhone: cleanWaPhone || undefined,
        ctaText: 'Book',
        darkColor: '#059669',
        lightColor: '#ffffff',
        eyeColor: '#047857',
        createdAt: new Date().toISOString(),
      };
      const nextRooms = [newRoom, ...rooms];
      StorageService.saveRoomsQrItemsLocalOnly(nextRooms);
      setRooms(nextRooms);
      setSelectedRoomId('all');
      showToast('Publishing new room online...');
      QRHostingService.syncRoomPage(newRoom, business, nextRooms).then((res) => {
        if (res.success) {
          showToast('New room added & live online!');
        } else {
          showToast(`Room saved on device, but online sync failed: ${res.message || 'check connection'}`);
        }
      });
    }
    setShowModal(false);
  };

  const confirmPendingRoomDelete = (roomToDelete: RoomQrItem) => {
    const id = roomToDelete.id;
    if (Array.isArray(roomToDelete.photos)) {
      for (const ph of roomToDelete.photos) {
        if (ph) CloudflareService.deleteFile(ph).catch(() => {});
      }
    }
    const remaining = rooms.filter((r) => r.id !== id);
    StorageService.saveRoomsQrItemsLocalOnly(remaining);
    setRooms(remaining);
    QRHostingService.removeRoomPage(id, business, remaining);
    if (selectedRoomId === id) {
      setSelectedRoomId(remaining.length > 0 ? 'all' : '');
    }
    showToast('Room deleted.');
  };

  const handleCopyLink = async () => {
    if (!activeUrl) return;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(activeUrl);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        showToast(isAllSelected ? 'Rooms link copied!' : 'Room link copied!');
      }
    } catch {
      showToast('Failed to copy link.');
    }
  };

  const handleShare = async () => {
    if (!activeUrl) return;
    const title = isAllSelected ? 'Rooms' : activeRoom?.name || 'Room Booking';
    await shareContent({
      title,
      text: `${title}: ${activeUrl}`,
      url: activeUrl,
      dialogTitle: `Share ${title}`,
    });
  };

  const handleDownloadPng = async () => {
    if (!activeQrDataUrl) return;
    const defaultTitle = isAllSelected ? 'Rooms' : activeRoom?.name || 'Room_QR';
    const customName = qrLabelForPrint.trim();
    const bizName = (business.name || '').trim();

    const finalPngUrl = await QRHostingService.generateNamedQrPng({
      qrDataUrl: activeQrDataUrl,
      name: customName,
      businessName: customName && bizName && bizName !== customName ? bizName : undefined,
      boxBgColor: activeBoxBgColor,
      boxBorderColor: activeBoxBorderColor,
      darkColor: activeDarkColor,
      lightColor: activeLightColor,
      accentColor: activeDarkColor,
    });

    const fileLabel = customName || defaultTitle;
    const safeName = fileLabel.replace(/[^a-zA-Z0-9]/g, '_');
    await saveFile({
      data: finalPngUrl,
      filename: `${safeName}_Rooms_QRCode.png`,
      mimeType: 'image/png',
      title: customName ? `${customName} QR Code` : 'Rooms QR Code',
      destination: 'photos',
    });
    showToast('Rooms QR code image saved!');
  };

  const handleDownloadStandPdf = async () => {
    if (!activeQrDataUrl) return;
    setIsGeneratingPdf(true);
    try {
      const headline = isAllSelected ? 'Rooms' : activeRoom?.name || 'Room Details';
      const safeName = headline.replace(/[^a-zA-Z0-9]/g, '_');
      const subline = isAllSelected
        ? `View rooms, photos, nightly rates & book on WhatsApp`
        : `${currency} ${formatNumber(activeRoom?.pricePerNight || 0)} / night • ${activeRoom?.occupancy || ''}`;

      const res = await QRHostingService.downloadGenericTableStand({
        businessName: business.name || 'Hospitality & Rooms',
        headline,
        subline,
        qrNameOrTableNumber: qrLabelForPrint || undefined,
        qrDataUrl: activeQrDataUrl,
        calloutText: 'SCAN TO VIEW ROOMS & BOOK ON WHATSAPP',
        urlOrHandleText: activeUrl,
        description: isAllSelected
          ? `Browse ${rooms.length} room${rooms.length === 1 ? '' : 's'}, photos, occupancy & amenities`
          : activeRoom?.amenities?.slice(0, 5).join(' • '),
        accentColor: activeDarkColor,
        filename: `${safeName}_Table_Wall_Poster.pdf`,
        documentTitle: `${headline} Table & Wall Poster`,
      });
      if (res.success) {
        showToast('Table & Wall QR Code Poster (PDF) downloaded!');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to generate poster PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isEditingQrColors) {
    const editorTitle = isAllSelected ? 'Rooms' : activeRoom?.name || 'Room QR';
    return (
      <QRCodeColorEditorScreen
        title={editorTitle}
        url={activeUrl}
        initialDarkColor={activeDarkColor}
        initialEyeColor={activeEyeColor}
        initialLightColor={activeLightColor}
        initialBoxBgColor={activeBoxBgColor}
        initialBoxBorderColor={activeBoxBorderColor}
        accentColor={activeDarkColor}
        language={business?.language}
        onSave={(updates) => {
          handleUpdateRoomColors(isAllSelected ? 'all' : activeRoom?.id || '', updates);
          showToast('QR Code & Box colors saved!');
        }}
        onBack={() => setIsEditingQrColors(false)}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-5 sm:p-6 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/30 shadow-md">
              <BedDouble className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight">Rooms</h1>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-white border border-white/25">
                  {rooms.length}/{MAX_ROOMS} Max
                </span>
              </div>
              <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5 leading-snug">
                Add up to {MAX_ROOMS} rooms with photos, price per night, occupancy & amenities. Guests view online and book straight to your WhatsApp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            disabled={rooms.length >= MAX_ROOMS}
            className={`px-4 py-2.5 rounded-xl font-black text-xs shadow-md active:scale-95 transition inline-flex items-center justify-center gap-1.5 shrink-0 ${
              rooms.length >= MAX_ROOMS
                ? 'bg-white/30 text-white/75 cursor-not-allowed shadow-none'
                : 'bg-white text-emerald-700 hover:bg-emerald-50 cursor-pointer'
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>{rooms.length >= MAX_ROOMS ? `Limit Reached (${MAX_ROOMS}/${MAX_ROOMS})` : 'Add Room'}</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher: ALL Rooms vs Single Room */}
      <div className="p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl flex items-center gap-1.5 border border-slate-200/80 dark:border-slate-700/80">
        <button
          type="button"
          onClick={() => setSelectedRoomId('all')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
            isAllSelected
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>All Rooms</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              isAllSelected
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            {rooms.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isAllSelected) {
              setSelectedRoomId(rooms.length > 0 ? rooms[0].id : '');
            }
          }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
            !isAllSelected
              ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-700/60'
          }`}
        >
          <BedDouble className="w-4 h-4" />
          <span>Single Room QR</span>
        </button>
      </div>

      {/* Single Room Selector */}
      {!isAllSelected && rooms.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Room ({rooms.length}/{MAX_ROOMS})
            </span>
            <button
              type="button"
              onClick={handleOpenCreateModal}
              disabled={rooms.length >= MAX_ROOMS}
              className={`text-xs font-extrabold flex items-center gap-1 ${
                rooms.length >= MAX_ROOMS
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{rooms.length >= MAX_ROOMS ? `Limit (${MAX_ROOMS}/${MAX_ROOMS})` : 'Add Room'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 min-w-0 w-full">
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              className="flex-1 min-w-0 w-full truncate px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              {rooms.map((rm) => (
                <option key={rm.id} value={rm.id}>
                  {rm.name} — {currency} {formatNumber(rm.pricePerNight)} / night
                </option>
              ))}
            </select>

            {activeRoom && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(activeRoom)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  title="Edit Room"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDelete({ type: 'room', item: activeRoom })}
                  className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                  title="Delete Room"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Active QR & Rooms Showcase */}
      {rooms.length > 0 && (isAllSelected || activeRoom) ? (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
              {/* Live QR Box */}
              <div className="flex flex-col items-center gap-2.5 shrink-0 w-full sm:w-auto">
                <div className="w-full max-w-[240px] sm:max-w-[260px] text-left mb-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                    <span>{t('qr_code_name', business?.language) || 'QR Code Name'}</span>
                    {qrLabelForPrint && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">
                        {t('included_on_downloads', business?.language) || 'Included on downloads'}
                      </span>
                    )}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="e.g. Reception Desk, Room 101"
                      value={qrLabelForPrint}
                      onChange={(e) => setQrLabelForPrint(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                    />
                    {qrLabelForPrint && (
                      <button
                        type="button"
                        onClick={() => setQrLabelForPrint('')}
                        className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div
                  className="p-3.5 rounded-2xl shadow-xl transition-all flex flex-col items-center justify-center"
                  style={{
                    backgroundColor: activeBoxBgColor,
                    borderColor:
                      activeBoxBorderColor && activeBoxBorderColor !== 'transparent'
                        ? activeBoxBorderColor
                        : `${activeDarkColor}40`,
                    borderWidth: activeBoxBorderColor === 'transparent' ? '0px' : '4px',
                    borderStyle: 'solid',
                  }}
                >
                  {qrLabelForPrint && (
                    <span className="mb-2 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                      {qrLabelForPrint}
                    </span>
                  )}
                  {activeQrDataUrl ? (
                    <img
                      src={activeQrDataUrl}
                      alt={isAllSelected ? 'All Rooms & Prices QR' : activeRoom?.name || 'Room QR'}
                      className="w-48 h-48 sm:w-56 sm:h-56 object-contain rounded-lg"
                      style={{
                        backgroundColor: activeLightColor,
                        padding: '4px',
                        borderRadius: '12px',
                      }}
                    />
                  ) : (
                    <div className="w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center text-slate-400 text-xs">
                      Generating QR...
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditingQrColors(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer"
                >
                  <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{t('qr_box_editor', business?.language) || 'Customize QR Colors'}</span>
                </button>
              </div>

              {/* Right Column: Info & Actions */}
              <div className="flex-1 min-w-0 space-y-4 w-full text-left">
                {isAllSelected ? (
                  <div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 mb-1.5">
                      <Layers className="w-3 h-3" />
                      Rooms Directory ({rooms.length})
                    </span>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      All Rooms
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      One QR code for all your rooms. Guests tap photos to zoom in, see prices, occupancy & amenities, and tap Book to send their order to WhatsApp.
                    </p>
                  </div>
                ) : activeRoom ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                          activeRoom.isAvailable
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        <BedDouble className="w-3 h-3" />
                        {activeRoom.isAvailable ? 'Available' : 'Currently Booked'}
                      </span>
                      <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {currency} {formatNumber(activeRoom.pricePerNight)} / night
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
                      {activeRoom.name}
                    </h2>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-semibold">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        {/^\d+$/.test((activeRoom.occupancy || '').trim())
                          ? `${activeRoom.occupancy.trim()} ${activeRoom.occupancy.trim() === '1' ? 'Guest' : 'Guests'}`
                          : activeRoom.occupancy}
                      </span>
                      {activeRoom.bedType && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <BedDouble className="w-3.5 h-3.5 text-emerald-600" />
                          {activeRoom.bedType}
                        </span>
                      )}
                    </div>
                    {activeRoom.photos && activeRoom.photos.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        {activeRoom.photos.slice(0, 3).map((ph, idx) => (
                          <div
                            key={idx}
                            className="aspect-video sm:aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900"
                          >
                            <img src={ph} alt={`${activeRoom.name} ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                    {activeRoom.amenities && activeRoom.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {activeRoom.amenities.map((am, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 text-[11px] font-semibold text-emerald-800 dark:text-emerald-200"
                          >
                            {am}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}

                {activeUrl && (
                  <a
                    href={activeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 font-medium break-all"
                  >
                    <span>Online Link: {activeUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('download_png', business?.language) || 'Download PNG'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copied' : 'Copy Link'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Link</span>
                  </button>

                  {onOpenCustomerView && (
                    <button
                      type="button"
                      onClick={() => {
                        const page =
                          isAllSelected || !activeRoom
                            ? QRHostingService.convertRoomsHubToHostedPage(rooms, business)
                            : QRHostingService.convertRoomToHostedPage(activeRoom, business);
                        onOpenCustomerView(page);
                      }}
                      className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview Online</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownloadStandPdf}
                    disabled={isGeneratingPdf}
                    className="col-span-2 sm:col-span-2 p-2.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Table & Wall Poster (PDF)'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* All Added Rooms List */}
          <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BedDouble className="w-4 h-4 text-emerald-600" />
                <span>Your Rooms ({rooms.length}/{MAX_ROOMS})</span>
              </h3>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                disabled={rooms.length >= MAX_ROOMS}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition ${
                  rooms.length >= MAX_ROOMS
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{rooms.length >= MAX_ROOMS ? `Limit (${MAX_ROOMS}/${MAX_ROOMS})` : 'Add Room'}</span>
              </button>
            </div>

            <div className="space-y-3">
              {rooms.map((rm) => (
                <div
                  key={rm.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col sm:flex-row gap-3.5 justify-between"
                >
                  <div className="flex gap-3 min-w-0">
                    {rm.photos && rm.photos.length > 0 ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800">
                        <img src={rm.photos[0]} alt={rm.name} className="w-full h-full object-cover" />
                        {rm.photos.length > 1 && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-bold">
                            +{rm.photos.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-200/70 dark:border-emerald-800/50">
                        <BedDouble className="w-7 h-7" />
                      </div>
                    )}

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-black text-slate-900 dark:text-white truncate">{rm.name}</h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            rm.isAvailable
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                          }`}
                        >
                          {rm.isAvailable ? 'Available' : 'Booked'}
                        </span>
                      </div>

                      <div className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                        {currency} {formatNumber(rm.pricePerNight)} / night
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {/^\d+$/.test((rm.occupancy || '').trim())
                            ? `${rm.occupancy.trim()} ${rm.occupancy.trim() === '1' ? 'Guest' : 'Guests'}`
                            : rm.occupancy}
                        </span>
                        {rm.bedType && <span>• {rm.bedType}</span>}
                      </div>

                      {rm.amenities && rm.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {rm.amenities.slice(0, 4).map((am, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                            >
                              {am}
                            </span>
                          ))}
                          {rm.amenities.length > 4 && (
                            <span className="text-[10px] font-bold text-slate-400">
                              +{rm.amenities.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center justify-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(rm)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete({ type: 'room', item: rm })}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800/60 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-1 hover:bg-rose-100 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl sm:rounded-3xl p-8 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <BedDouble className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Rooms Added Yet</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Add your hotel, lodge, or apartment rooms with photos, nightly prices, occupancy & amenities so guests can view and book via WhatsApp.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add First Room</span>
          </button>
        </div>
      )}

      {/* CREATE / EDIT ROOM MODAL */}
      {showModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[88dvh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-slate-900 dark:text-white my-auto">
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <BedDouble className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black">{editingRoom ? 'Edit Room' : 'Add Room'}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Room photos open online with direct WhatsApp booking
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

              <form id="room-qr-form" onSubmit={handleSaveForm} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
                {/* Room Name */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Room Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Deluxe Double Room, Executive Suite"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                  />
                </div>

                {/* Price per Night & Availability */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Price / Night ({currency}) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      required
                      placeholder="e.g. 150000"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                      Status
                    </label>
                    <button
                      type="button"
                      onClick={() => setFormIsAvailable((v) => !v)}
                      className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                        formIsAvailable
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{formIsAvailable ? 'Available' : 'Booked / Full'}</span>
                    </button>
                  </div>
                </div>

                {/* Occupancy & Bed Type */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                    Occupancy & Bed Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Occupancy (e.g. 2)"
                      value={formOccupancy}
                      onChange={(e) => setFormOccupancy(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <input
                      type="text"
                      placeholder="Bed type (e.g. 1 King Bed)"
                      value={formBedType}
                      onChange={(e) => setFormBedType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* Room Photos Upload (Up to 3) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Room Photos (Up to 3)</span>
                    </label>
                    <span className="text-[11px] font-bold text-slate-400">{formPhotos.length} / 3</span>
                  </div>

                  {formPhotos.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {formPhotos.map((ph, idx) => (
                        <div
                          key={idx}
                          className="relative group aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
                        >
                          <img src={ph} alt={`Room Photo ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ type: 'photo', index: idx })}
                            className="absolute top-1 right-1 p-1 rounded-full bg-rose-600 text-white shadow-sm cursor-pointer"
                            title="Remove Photo"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {formPhotos.length < 3 && (
                    <label className="flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold cursor-pointer transition">
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Uploading Room Photo Online...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          <span>Upload Room Photos ({3 - formPhotos.length} left)</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingPhoto}
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Amenities */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Amenities ({formAmenities.length})</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_AMENITIES.map((am) => {
                      const active = formAmenities.includes(am);
                      return (
                        <button
                          key={am}
                          type="button"
                          onClick={() => toggleAmenity(am)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer flex items-center gap-1 ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {active && <Check className="w-3 h-3" />}
                          <span>{am}</span>
                        </button>
                      );
                    })}
                    {formAmenities
                      .filter((am) => !PRESET_AMENITIES.includes(am))
                      .map((am) => (
                        <button
                          key={am}
                          type="button"
                          onClick={() => toggleAmenity(am)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold border bg-emerald-600 text-white border-emerald-600 transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{am}</span>
                          <X className="w-3 h-3" />
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add custom amenity (e.g. Ocean View)"
                      value={customAmenityInput}
                      onChange={(e) => setCustomAmenityInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomAmenity();
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomAmenity}
                      className="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* WhatsApp Booking Phone */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>WhatsApp Number for Bookings</span>
                  </label>
                  <PhoneInputField
                    value={formWhatsappPhone}
                    onChange={(val) => setFormWhatsappPhone(val)}
                    placeholder="e.g. +256700000000"
                  />
                </div>

                {/* Room Description */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Room Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="View, floor details, check-in/out policy..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-hidden resize-none"
                  />
                </div>
              </form>

              <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-50/70 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="room-qr-form"
                  disabled={isUploadingPhoto}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRoom ? 'Save Changes' : 'Save Room'}</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      <QrDeleteConfirmModal
        isOpen={Boolean(pendingDelete)}
        title={pendingDelete?.type === 'photo' ? 'Remove Room Photo?' : 'Delete Room?'}
        description={
          pendingDelete?.type === 'photo'
            ? 'Remove this room photo from the listing?'
            : `Are you sure you want to delete "${pendingDelete?.type === 'room' ? pendingDelete.item.name : ''}"?`
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          if (pendingDelete.type === 'photo') {
            confirmPendingPhotoRemove(pendingDelete.index);
          } else {
            confirmPendingRoomDelete(pendingDelete.item);
          }
          setPendingDelete(null);
        }}
      />
    </div>
  );
};
