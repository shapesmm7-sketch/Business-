import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Utensils,
  Wifi,
  Mail,
  MapPin,
  Upload,
  Trash2,
  Download,
  Share2,
  Copy,
  Check,
  Palette,
  Loader2,
  Navigation,
  ExternalLink,
  Maximize2,
  Save,
  QrCode,
  X,
  Phone,
  MessageCircle,
  Lock,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { BusinessProfile, QRBusinessPhoto, QRCodeHostedPage } from '../types';
import { QRHostingService } from '../services/qrHostingService';
import { CloudflareService } from '../services/cloudflareService';
import { compressImageFile } from '../utils/imageCompressor';
import { saveFile, shareContent } from '../services/fileSaver';
import { StorageService } from '../services/storage';
import { QRCodeColorEditorScreen } from './QRCodeColorEditorScreen';
import { PhoneInputField } from './PhoneInputField';
import { TouchZoomLightbox } from './TouchZoomLightbox';
import { QrDeleteConfirmModal } from './QrDeleteConfirmModal';
import { t } from '../utils/i18n';

export type QuickSectionMode = 'menu' | 'wifi' | 'contacts' | 'location';

interface QrQuickSectionsProps {
  mode: QuickSectionMode;
  activePage: QRCodeHostedPage;
  business: BusinessProfile;
  ownerEmail: string;
  onUpdatePage: (updates: Partial<QRCodeHostedPage>, immediateSync?: boolean) => void;
  showToast: (msg: string) => void;
}

const escapeWifiField = (val: string): string =>
  val.replace(/([\\;,:"])/g, '\\$1');

const escapeVCardField = (val: string): string =>
  val.replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');

export const QrQuickSections: React.FC<QrQuickSectionsProps> = ({
  mode,
  activePage,
  business,
  ownerEmail: _ownerEmail,
  onUpdatePage,
  showToast,
}) => {
  const menuFileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const replacingTargetRef = useRef<QRBusinessPhoto | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [qrLabel, setQrLabel] = useState<string>('');
  const [selectedMenuImgId, setSelectedMenuImgId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isUploadingMenu, setIsUploadingMenu] = useState<boolean>(false);
  const [reuploadingId, setReuploadingId] = useState<string | null>(null);
  const [previewCacheBust, setPreviewCacheBust] = useState<Record<string, number>>({});
  const [isEditingColors, setIsEditingColors] = useState<boolean>(false);
  const [isGettingGps, setIsGettingGps] = useState<boolean>(false);
  const [lightboxImg, setLightboxImg] = useState<{ url: string; title: string } | null>(null);
  const [menuImageToDelete, setMenuImageToDelete] = useState<QRBusinessPhoto | null>(null);
  const [tableNumberForPrint, setTableNumberForPrint] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Local editable drafts synced cleanly with activePage
  const [wifiName, setWifiName] = useState<string>(activePage.wifiName || '');
  const [wifiPassword, setWifiPassword] = useState<string>(activePage.wifiPassword || '');
  const [wifiSecurity, setWifiSecurity] = useState<'WPA' | 'WEP' | 'nopass'>(
    activePage.wifiSecurity || 'WPA'
  );

  const [contactName, setContactName] = useState<string>(activePage.title || business.name || '');
  const [contactEmail, setContactEmail] = useState<string>(activePage.email || business.email || '');
  const [contactPhone, setContactPhone] = useState<string>(activePage.phone || business.phone || '');
  const [contactWhatsapp, setContactWhatsapp] = useState<string>(
    activePage.whatsapp || business.whatsapp || ''
  );

  const [address, setAddress] = useState<string>(activePage.address || business.address || '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState<string>(activePage.googleMapsUrl || '');

  // Keep drafts updated if user switches mode or activePage updates externally
  useEffect(() => {
    setWifiName(activePage.wifiName || '');
    setWifiPassword(activePage.wifiPassword || '');
    setWifiSecurity(activePage.wifiSecurity || 'WPA');
    setContactName(activePage.title || business.name || '');
    setContactEmail(activePage.email || business.email || '');
    setContactPhone(activePage.phone || business.phone || '');
    setContactWhatsapp(activePage.whatsapp || business.whatsapp || '');
    setAddress(activePage.address || business.address || '');
    setGoogleMapsUrl(activePage.googleMapsUrl || '');
  }, [
    mode,
    activePage.id,
    activePage.wifiName,
    activePage.wifiPassword,
    activePage.wifiSecurity,
    activePage.title,
    activePage.email,
    activePage.phone,
    activePage.whatsapp,
    activePage.address,
    activePage.googleMapsUrl,
    business.name,
    business.email,
    business.phone,
    business.whatsapp,
    business.address,
  ]);

  const menuImages: QRBusinessPhoto[] = useMemo(
    () => (Array.isArray(activePage.menuImages) ? activePage.menuImages : []),
    [activePage.menuImages]
  );

  const activeMenuImage: QRBusinessPhoto | undefined = useMemo(() => {
    if (menuImages.length === 0) return undefined;
    if (selectedMenuImgId) {
      const found = menuImages.find((img) => img.id === selectedMenuImgId);
      if (found) return found;
    }
    return (
      menuImages.find((img) => img.badge === 'active') ||
      menuImages.find((img) => /^https?:\/\//i.test(img.url)) ||
      menuImages[0]
    );
  }, [menuImages, selectedMenuImgId]);

  const PUBLIC_QR_BASE_URL = 'https://brivu.shapesmm.com';

  const resolvePublicImageUrl = (rawUrl?: string): string => {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed.replace(
        /^https?:\/\/brivu\.shapesmm7\.workers\.dev(?=\/|$)/i,
        PUBLIC_QR_BASE_URL
      );
    }
    if (trimmed.startsWith('/api/files/')) {
      return `${PUBLIC_QR_BASE_URL}${trimmed}`;
    }
    return '';
  };

  const configuredWorkerUrl = (CloudflareService.getConfig().workerUrl || '').trim();
  const workerBaseUrl = (
    !configuredWorkerUrl ||
    configuredWorkerUrl.includes('localhost') ||
    configuredWorkerUrl.includes('127.0.0.1') ||
    configuredWorkerUrl.includes('brivu.shapesmm7.workers.dev') ||
    configuredWorkerUrl.includes('brivu.shapesmm.com') ||
    configuredWorkerUrl.includes('.workers.dev')
      ? PUBLIC_QR_BASE_URL
      : configuredWorkerUrl
  ).replace(/\/+$/, '');
  const resolvedAuthEmail = (CloudflareService.getUserEmail() || _ownerEmail || '')
    .toLowerCase()
    .trim();
  const hasAuthenticatedEmail = Boolean(
    resolvedAuthEmail && resolvedAuthEmail.includes('@') && !resolvedAuthEmail.startsWith('brivu-usr-')
  );
  const cleanMenuOwnerKey =
    String(activePage.id || 'page')
      .replace(/[^a-zA-Z0-9_.-]/g, '')
      .slice(0, 64) || 'page';

  const defaultMenuImageUrl = useMemo(() => {
    const expectedKey = hasAuthenticatedEmail
      ? `users/${encodeURIComponent(resolvedAuthEmail)}/menu/menu_main.webp`
      : `menu-public/${cleanMenuOwnerKey}/menu_main.webp`;
    return `${workerBaseUrl}/api/files/${expectedKey}`;
  }, [workerBaseUrl, hasAuthenticatedEmail, resolvedAuthEmail, cleanMenuOwnerKey]);

  const hostedMenuImageUrl = resolvePublicImageUrl(activeMenuImage?.url);
  const hasHostedMenuImage = Boolean(hostedMenuImageUrl);

  const effectiveWifiSsid = useMemo(
    () => (wifiName || '').trim() || (activePage.title || business.name || 'Hotel_Guest_WiFi').trim(),
    [wifiName, activePage.title, business.name]
  );

  // Compute the QR payload based on active mode (never opening Cloudflare hosted HTML pages)
  const qrPayload = useMemo(() => {
    if (mode === 'menu') {
      const baseMenuUrl = hostedMenuImageUrl || defaultMenuImageUrl;
      const ver = activeMenuImage?.version;
      if (ver && hostedMenuImageUrl) {
        return `${baseMenuUrl}${baseMenuUrl.includes('?') ? '&' : '?'}v=${ver}`;
      }
      return baseMenuUrl;
    }

    if (mode === 'wifi') {
      const pass = wifiSecurity === 'nopass' ? '' : (wifiPassword || '').trim();
      const sec = wifiSecurity === 'nopass' ? 'nopass' : wifiSecurity;
      return `WIFI:T:${sec};S:${escapeWifiField(effectiveWifiSsid)};P:${escapeWifiField(pass)};;`;
    }

    if (mode === 'contacts') {
      const fn = (contactName || business.name || activePage.title || 'Contact').trim();
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${escapeVCardField(fn)}`,
        `ORG:${escapeVCardField(fn)}`,
      ];
      if (contactPhone.trim()) lines.push(`TEL;TYPE=CELL,VOICE:${contactPhone.trim()}`);
      if (contactWhatsapp.trim() && contactWhatsapp.trim() !== contactPhone.trim()) {
        lines.push(`TEL;TYPE=WORK,MSG:${contactWhatsapp.trim()}`);
      }
      if (contactEmail.trim()) lines.push(`EMAIL;TYPE=INTERNET:${contactEmail.trim()}`);
      if (address.trim()) lines.push(`ADR;TYPE=WORK:;;${escapeVCardField(address.trim())};;;;`);
      if (business.website?.trim()) lines.push(`URL:${business.website.trim()}`);
      lines.push('END:VCARD');
      return lines.join('\n');
    }

    // Location
    const rawMaps = (googleMapsUrl || '').trim();
    if (rawMaps) {
      return /^https?:\/\//i.test(rawMaps) ? rawMaps : `https://${rawMaps}`;
    }
    const queryLoc = (address || activePage.title || business.name || '').trim();
    if (!queryLoc) return '';
    return `https://maps.google.com/?q=${encodeURIComponent(queryLoc)}`;
  }, [
    mode,
    hostedMenuImageUrl,
    defaultMenuImageUrl,
    activeMenuImage?.version,
    effectiveWifiSsid,
    activePage.title,
    wifiPassword,
    wifiSecurity,
    contactName,
    contactEmail,
    contactPhone,
    contactWhatsapp,
    address,
    googleMapsUrl,
    business.name,
    business.website,
  ]);

  const activeDarkColor = activePage.qrDarkColor || '#0f172a';
  const activeLightColor = activePage.qrLightColor || '#ffffff';
  const activeEyeColor = activePage.qrEyeColor || activeDarkColor;
  const activeBoxBgColor = activePage.qrBoxBgColor || '#ffffff';
  const activeBoxBorderColor = activePage.qrBoxBorderColor || '#e2e8f0';

  // Generate QR image whenever payload or colors change
  useEffect(() => {
    if (!qrPayload) {
      setQrDataUrl('');
      return;
    }
    QRHostingService.generateQrCodeDataUrl(qrPayload, {
      width: 600,
      margin: 1.5,
      color: {
        dark: activeDarkColor,
        light: activeLightColor,
        eyeColor: activeEyeColor,
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('[QrQuickSections] QR generation error:', err));
  }, [qrPayload, activeDarkColor, activeLightColor, activeEyeColor]);

  const extractR2KeyFromUrl = (rawUrl?: string): string | undefined => {
    if (!rawUrl || !rawUrl.includes('/api/files/')) return undefined;
    const rawPart = rawUrl.split('/api/files/')[1]?.split('?')[0]?.split('#')[0];
    if (!rawPart) return undefined;
    try {
      return decodeURIComponent(rawPart);
    } catch {
      return rawPart;
    }
  };

  const normalizeR2KeyForCompare = (raw?: string): string => {
    if (!raw) return '';
    let decoded = raw.trim();
    try {
      decoded = decodeURIComponent(decoded);
    } catch {}
    return decoded.replace(/%40/gi, '@').toLowerCase().trim();
  };

  const extractMenuSlotIdFromKey = (key?: string): string | undefined => {
    if (!key) return undefined;
    if (!key.includes('/menu/') && !key.startsWith('menu-public/')) return undefined;
    const lastPart = key.split('/').pop() || '';
    const cleanSlot = lastPart.replace(/\.(webp|png|jpe?g|gif)$/i, '').trim();
    return cleanSlot || undefined;
  };

  const getMenuPreviewSrc = (img: QRBusinessPhoto): string => {
    const bust = previewCacheBust[img.id] || img.version;
    if (!bust || !/^https?:\/\//i.test(img.url)) return img.url;
    return `${img.url}${img.url.includes('?') ? '&' : '?'}v=${bust}`;
  };

  const handleSelectActiveMenuImage = (imgId: string) => {
    setSelectedMenuImgId(imgId);
    if (menuImages.length > 1) {
      const updated = menuImages.map((m) => ({
        ...m,
        badge: m.id === imgId ? 'active' : undefined,
      }));
      onUpdatePage({ menuImages: updated }, true);
    }
  };

  const MAX_MENU_IMAGES = 5;

  // Upload one or more Hotel Menu Images directly to online image hosting so QR encodes the image URL itself
  const handleMenuImagesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;

    const remainingSlots = MAX_MENU_IMAGES - menuImages.length;
    if (remainingSlots <= 0) {
      showToast(`Limit reached: Maximum ${MAX_MENU_IMAGES} menu photos allowed. Delete or replace an existing menu photo.`);
      e.target.value = '';
      return;
    }

    const filesToProcess = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      showToast(`Only ${remainingSlots} more menu photo${remainingSlots === 1 ? '' : 's'} allowed (Max ${MAX_MENU_IMAGES}).`);
    }

    setIsUploadingMenu(true);
    const newlyUploaded: QRBusinessPhoto[] = [];
    let lastUploadError = '';
    const uploadTs = Date.now();

    try {
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        let imageUrl = '';
        const slotId =
          menuImages.length === 0 && i === 0
            ? 'menu_main'
            : `menu_${uploadTs}_${i}`;

        try {
          const uploadRes = await CloudflareService.uploadFile({
            data: file,
            filename: `${slotId}.webp`,
            mimeType: file.type || 'image/jpeg',
            folder: 'menu',
            force: true,
            slotId,
            ownerKey: activePage.id,
          });
          if (uploadRes.success && uploadRes.url) {
            imageUrl = resolvePublicImageUrl(uploadRes.url) || uploadRes.url;
          } else if (uploadRes.requiresSubscription) {
            lastUploadError = uploadRes.message || 'Subscribe to Pro to upload menu photos.';
            showToast(lastUploadError);
            break;
          } else if (uploadRes.message) {
            lastUploadError = uploadRes.message;
          }
        } catch (err: any) {
          lastUploadError = err?.message || 'Upload failed';
        }

        if (!imageUrl) {
          imageUrl = await compressImageFile(file, {
            maxDimension: 1400,
            mimeType: 'image/webp',
            maxBytes: 320 * 1024,
          });
        }

        if (imageUrl) {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
          newlyUploaded.push({
            id: `menu-img-${uploadTs}-${i}`,
            url: imageUrl,
            title: cleanName || `Menu Page ${menuImages.length + newlyUploaded.length + 1}`,
            version: uploadTs,
          });
        }
      }

      if (newlyUploaded.length > 0) {
        const lastUploadedId = newlyUploaded[newlyUploaded.length - 1].id;
        const updatedList = [...menuImages, ...newlyUploaded].slice(0, MAX_MENU_IMAGES).map((m) => ({
          ...m,
          badge: m.id === lastUploadedId ? 'active' : undefined,
        }));
        onUpdatePage({ menuImages: updatedList }, true);
        setSelectedMenuImgId(lastUploadedId);
        setPreviewCacheBust((prev) => ({
          ...prev,
          ...Object.fromEntries(newlyUploaded.map((img) => [img.id, uploadTs])),
        }));
        const hasPublicLink = newlyUploaded.some((img) => /^https?:\/\//i.test(img.url));
        if (hasPublicLink) {
          showToast(
            newlyUploaded.length === 1
              ? 'Menu photo hosted & direct image QR ready!'
              : `${newlyUploaded.length} menu photos hosted!`
          );
        } else {
          const isAuthErr = /auth|sign in|logged/i.test(lastUploadError);
          showToast(
            isAuthErr
              ? 'Sign in with Google at the top bar to host & get your menu image QR link.'
              : lastUploadError || 'Saved locally. Connect to internet & tap Host Online to get QR link.'
          );
        }
      }
    } catch (err) {
      console.error('Menu image upload failed:', err);
      showToast('Could not process the selected image. Please try again.');
    } finally {
      setIsUploadingMenu(false);
      e.target.value = '';
    }
  };

  // Replace an existing menu photo: deletes old photo (or overwrites exact slot) & shows new photo immediately
  const handleReplaceMenuImageSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetImg = replacingTargetRef.current;
    e.target.value = '';
    if (!file || !targetImg) return;

    setReuploadingId(targetImg.id);
    try {
      const existingKey = extractR2KeyFromUrl(targetImg.url);
      const slotId = extractMenuSlotIdFromKey(existingKey) || 'menu_main';

      const uploadRes = await CloudflareService.uploadFile({
        data: file,
        filename: `${slotId}.webp`,
        mimeType: file.type || 'image/jpeg',
        folder: 'menu',
        force: true,
        customKey: existingKey,
        slotId,
        ownerKey: activePage.id,
      });

      if (uploadRes.success && uploadRes.url) {
        const returnedUrl = resolvePublicImageUrl(uploadRes.url) || uploadRes.url;
        const returnedKey = uploadRes.key || extractR2KeyFromUrl(returnedUrl);
        const sameKey =
          Boolean(existingKey && returnedKey) &&
          normalizeR2KeyForCompare(existingKey) === normalizeR2KeyForCompare(returnedKey);

        // If the replacement landed on a different R2 key (or legacy path), delete the old photo from R2/D1 immediately
        if (!sameKey && targetImg.url && (/^https?:\/\//i.test(targetImg.url) || targetImg.url.includes('/api/files/'))) {
          await CloudflareService.deleteFile(targetImg.url).catch(() => {});
        }

        const newPublicUrl = sameKey ? targetImg.url : returnedUrl;
        const replaceTs = Date.now();
        const updated = menuImages.map((m) =>
          m.id === targetImg.id
            ? {
                ...m,
                url: newPublicUrl,
                version: replaceTs,
                badge: 'active',
              }
            : {
                ...m,
                badge: undefined,
              }
        );

        onUpdatePage({ menuImages: updated }, true);
        setSelectedMenuImgId(targetImg.id);
        setPreviewCacheBust((prev) => ({ ...prev, [targetImg.id]: replaceTs }));
        showToast(
          sameKey
            ? 'Menu photo replaced! Your QR code & link stayed the same.'
            : 'Menu photo replaced & old photo deleted!'
        );
      } else {
        const isAuthErr = /auth|sign in|logged/i.test(uploadRes.message || '');
        showToast(
          isAuthErr
            ? 'Sign in with Google at the top bar to replace the hosted menu photo.'
            : uploadRes.message || 'Could not replace menu photo. Check internet connection.'
        );
      }
    } catch {
      showToast('Could not replace menu photo. Please try again.');
    } finally {
      setReuploadingId(null);
      replacingTargetRef.current = null;
    }
  };

  const handleHostLocalMenuImageOnline = async (img: QRBusinessPhoto) => {
    if (!img.url || /^https?:\/\//i.test(img.url)) return;
    setReuploadingId(img.id);
    try {
      const uploadRes = await CloudflareService.uploadFile({
        data: img.url,
        filename: `${(img.title || 'menu').replace(/[^a-zA-Z0-9]/g, '_')}.webp`,
        mimeType: 'image/webp',
        folder: 'menu',
        force: true,
        slotId: img.id || 'menu_main',
        ownerKey: activePage.id,
      });
      if (uploadRes.success && uploadRes.url) {
        const publicUrl = resolvePublicImageUrl(uploadRes.url) || uploadRes.url;
        const hostTs = Date.now();
        const updated = menuImages.map((m) =>
          m.id === img.id ? { ...m, url: publicUrl, version: hostTs, badge: 'active' } : { ...m, badge: undefined }
        );
        onUpdatePage({ menuImages: updated }, true);
        setSelectedMenuImgId(img.id);
        setPreviewCacheBust((prev) => ({ ...prev, [img.id]: hostTs }));
        showToast('Menu photo hosted online! Direct image QR is ready.');
      } else {
        const isAuthErr = /auth|sign in|logged/i.test(uploadRes.message || '');
        showToast(
          isAuthErr
            ? 'Sign in with Google at the top bar to host & get your menu image QR link.'
            : uploadRes.message || 'Connect to internet to host photo online.'
        );
      }
    } catch {
      showToast('Could not upload image. Please check internet connection.');
    } finally {
      setReuploadingId(null);
    }
  };

  const handleRenameMenuImage = (id: string, title: string) => {
    const updated = menuImages.map((img) => (img.id === id ? { ...img, title } : img));
    onUpdatePage({ menuImages: updated }, false);
  };

  const handleSaveMenuImageTitle = () => {
    onUpdatePage({ menuImages }, true);
    showToast('Menu saved!');
  };

  const handleDeleteMenuImage = (id: string) => {
    const target = menuImages.find((img) => img.id === id);
    if (!target) return;
    setMenuImageToDelete(target);
  };

  const handleConfirmDeleteMenuImage = () => {
    if (!menuImageToDelete) return;
    const id = menuImageToDelete.id;
    if (menuImageToDelete.url && (/^https?:\/\//i.test(menuImageToDelete.url) || menuImageToDelete.url.includes('/api/files/'))) {
      CloudflareService.deleteFile(menuImageToDelete.url).catch(() => {});
    }
    const remaining = menuImages.filter((img) => img.id !== id);
    const updated = remaining.map((m, idx) => ({
      ...m,
      badge: idx === 0 ? 'active' : m.badge === 'active' ? undefined : m.badge,
    }));
    onUpdatePage({ menuImages: updated }, true);
    if (selectedMenuImgId === id) {
      setSelectedMenuImgId(updated[0]?.id || null);
    }
    setMenuImageToDelete(null);
    showToast('Menu image deleted');
  };

  const handleSaveWifi = () => {
    onUpdatePage(
      {
        wifiName: wifiName.trim(),
        wifiPassword: wifiSecurity === 'nopass' ? '' : wifiPassword.trim(),
        wifiSecurity,
      },
      false
    );
    showToast('WiFi details saved!');
  };

  const handleSaveContacts = () => {
    onUpdatePage(
      {
        title: contactName.trim() || activePage.title,
        email: contactEmail.trim(),
        phone: contactPhone.trim(),
        whatsapp: contactWhatsapp.trim(),
      },
      false
    );
    showToast('Email & contact details saved!');
  };

  const handleSaveLocation = () => {
    onUpdatePage(
      {
        address: address.trim(),
        googleMapsUrl: googleMapsUrl.trim() || undefined,
      },
      false
    );
    showToast('Location saved!');
  };

  const handleUseCurrentGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('GPS location is not available on this device.');
      return;
    }
    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        setGoogleMapsUrl(mapsUrl);
        onUpdatePage({ googleMapsUrl: mapsUrl, address: address.trim() }, false);
        setIsGettingGps(false);
        showToast('GPS location captured & saved!');
      },
      (err) => {
        setIsGettingGps(false);
        showToast(err?.message || 'Could not get GPS location. Please allow permission or paste link.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleDownloadQrPng = async () => {
    if (!qrDataUrl) {
      showToast('Generating QR code, please try again in a moment.');
      return;
    }
    const customQrName = qrLabel.trim();
    const bizName = (business.name || '').trim();
    const finalPngUrl = await QRHostingService.generateNamedQrPng({
      qrDataUrl,
      name: customQrName,
      businessName: customQrName && bizName && bizName !== customQrName ? bizName : undefined,
      boxBgColor: activeBoxBgColor,
      boxBorderColor: activeBoxBorderColor,
      darkColor: activeDarkColor,
      lightColor: activeLightColor,
      accentColor: activePage.accentColor || '#059669',
    });

    const filename = `${(customQrName || mode).replace(/[^a-zA-Z0-9]/g, '_')}_QRCode.png`;
    const res = await saveFile({
      data: finalPngUrl,
      filename,
      mimeType: 'image/png',
      title: customQrName ? `${customQrName} QR Code` : 'QR Code',
      destination: 'photos',
    });
    if (res.success) {
      if (mode === 'menu' && !hasHostedMenuImage) {
        showToast('QR downloaded! Upload your menu photo above so scanning opens your photo.');
      } else {
        showToast(res.message);
      }
    }
  };

  const handleCopyPayload = async () => {
    if (!qrPayload) return;
    try {
      await navigator.clipboard.writeText(qrPayload);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      showToast('Copied to clipboard');
    } catch {
      showToast('Could not copy to clipboard');
    }
  };

  const handleShare = async () => {
    if (!qrPayload) return;
    const isUrl = /^https?:\/\//i.test(qrPayload);
    const shareTitle = qrLabel.trim() || `${activePage.title || business.name || 'Business'} ${mode.toUpperCase()}`;
    const res = await shareContent({
      title: shareTitle,
      text: isUrl ? `${shareTitle}:` : `${shareTitle}\n${qrPayload}`,
      url: isUrl ? qrPayload : undefined,
      dialogTitle: `Share ${shareTitle}`,
    });
    if (res.method === 'clipboard_copy') {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownloadTableStandPdf = async () => {
    if (!qrDataUrl) {
      showToast('Generating QR code, please try again in a moment.');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const bizName = business.name || StorageService.getProfile().name || '';
      const customName = tableNumberForPrint.trim() || qrLabel.trim() || undefined;

      let headline = 'Scan QR Code';
      let calloutText = 'SCAN WITH YOUR PHONE CAMERA';
      let urlOrHandleText: string | undefined = '';
      let description: string | undefined = '';

      if (mode === 'menu') {
        headline = '';
        calloutText = 'SCAN TO VIEW OUR MENU';
        urlOrHandleText = undefined;
        description = undefined;
      } else if (mode === 'wifi') {
        headline = '';
        calloutText = 'SCAN TO CONNECT TO WI-FI';
        urlOrHandleText = undefined;
        description = undefined;
      } else if (mode === 'contacts') {
        headline = '';
        calloutText = 'SCAN TO SAVE CONTACT DETAILS';
        urlOrHandleText = undefined;
        description = undefined;
      } else {
        headline = '';
        calloutText = 'SCAN FOR DIRECTIONS';
        urlOrHandleText = undefined;
        description = undefined;
      }

      const safeFilePrefix = (customName || `${bizName || 'Business'}_${mode}`).replace(/[^a-zA-Z0-9]/g, '_');
      const res = await QRHostingService.downloadGenericTableStand({
        businessName: bizName,
        headline,
        qrNameOrTableNumber: customName,
        qrDataUrl,
        calloutText,
        urlOrHandleText,
        description,
        accentColor: activePage.accentColor || activeDarkColor || '#059669',
        filename: `${safeFilePrefix}_Table_Wall_Poster.pdf`,
        documentTitle:
          mode === 'menu'
            ? 'Menu Table & Wall Poster'
            : mode === 'wifi'
            ? 'WiFi Table & Wall Poster'
            : mode === 'contacts'
            ? 'Contact Table & Wall Poster'
            : 'Location Table & Wall Poster',
      });

      if (res.success) {
        if (mode === 'menu' && !hasHostedMenuImage) {
          showToast('Poster PDF downloaded! Upload your menu photo above so scanning opens your photo.');
        } else {
          showToast('Table & Wall QR Code Poster (PDF) downloaded!');
        }
      } else {
        showToast('Saved Table & Wall QR Code Poster.');
      }
    } catch (err) {
      console.error('Failed to generate poster PDF:', err);
      showToast('Failed to generate poster PDF.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isEditingColors) {
    return (
      <QRCodeColorEditorScreen
        page={activePage}
        title={qrLabel}
        url={qrPayload}
        initialDarkColor={activeDarkColor}
        initialEyeColor={activeEyeColor}
        initialLightColor={activeLightColor}
        initialBoxBgColor={activeBoxBgColor}
        initialBoxBorderColor={activeBoxBorderColor}
        language={business?.language}
        onSave={(updates) => {
          onUpdatePage(updates, true);
          setIsEditingColors(false);
          showToast('QR colors updated!');
        }}
        onBack={() => setIsEditingColors(false)}
      />
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Hidden file inputs for Menu Images (upload & single-link replacement) */}
      <input
        ref={menuFileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleMenuImagesSelected}
      />
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleReplaceMenuImageSelected}
      />

      {/* MENU SECTION: Upload Hotel Menu Image */}
      {mode === 'menu' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Utensils className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                  Menu
                </h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {menuImages.length}/{MAX_MENU_IMAGES} Max
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload up to {MAX_MENU_IMAGES} hotel or restaurant menu photos so guests can view them from a QR scan
              </p>
            </div>
          </div>

          {/* Clickable Upload Zone */}
          <button
            type="button"
            onClick={() => {
              if (menuImages.length >= MAX_MENU_IMAGES) {
                showToast(`Limit reached: Maximum ${MAX_MENU_IMAGES} menu photos allowed. Delete or replace a menu photo below.`);
                return;
              }
              menuFileInputRef.current?.click();
            }}
            disabled={isUploadingMenu || menuImages.length >= MAX_MENU_IMAGES}
            className={`w-full p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center gap-2 text-center ${
              menuImages.length >= MAX_MENU_IMAGES
                ? 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 opacity-70 cursor-not-allowed'
                : 'border-amber-300 dark:border-amber-800/80 bg-amber-50/50 dark:bg-amber-950/20 hover:bg-amber-50 dark:hover:bg-amber-950/35 hover:border-amber-500 cursor-pointer disabled:opacity-60'
            }`}
          >
            <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md ${
              menuImages.length >= MAX_MENU_IMAGES
                ? 'bg-slate-400 dark:bg-slate-700 shadow-none'
                : 'bg-amber-500 shadow-amber-500/20'
            }`}>
              {isUploadingMenu ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Upload className="w-6 h-6" />
              )}
            </div>
            <span className="text-sm font-black text-slate-900 dark:text-white">
              {isUploadingMenu
                ? 'Uploading menu image...'
                : menuImages.length >= MAX_MENU_IMAGES
                  ? `Menu Limit Reached (${MAX_MENU_IMAGES}/${MAX_MENU_IMAGES})`
                  : menuImages.length > 0
                    ? `Upload Another Menu Image (${MAX_MENU_IMAGES - menuImages.length} left)`
                    : 'Click to Upload Hotel Menu Image'}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {menuImages.length >= MAX_MENU_IMAGES
                ? `Maximum ${MAX_MENU_IMAGES} menu photos reached. Delete or replace an existing menu photo below.`
                : `Supports PNG, JPG or WEBP · Upload up to ${MAX_MENU_IMAGES} menu photos`}
            </span>
          </button>

          {/* Uploaded Menu Images List */}
          {menuImages.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Uploaded Menu ({menuImages.length}/{MAX_MENU_IMAGES})
                </span>
                <button
                  type="button"
                  onClick={handleSaveMenuImageTitle}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {menuImages.map((img, idx) => {
                  const isSelectedForQr = activeMenuImage?.id === img.id;
                  const isHostedLink = /^https?:\/\//i.test(img.url || '');
                  return (
                    <div
                      key={img.id}
                      onClick={() => handleSelectActiveMenuImage(img.id)}
                      className={`p-2.5 rounded-2xl border space-y-2 transition cursor-pointer ${
                        isSelectedForQr
                          ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30'
                          : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 group">
                        <img
                          src={getMenuPreviewSrc(img)}
                          alt={img.title || `Menu ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isSelectedForQr && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-xs">
                            Active QR
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setLightboxImg({
                              url: getMenuPreviewSrc(img),
                              title: img.title || `Menu Page ${idx + 1}`,
                            });
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white backdrop-blur-xs cursor-pointer"
                          title="Zoom image"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                        <input
                          type="text"
                          value={img.title || ''}
                          placeholder={`Menu Page ${idx + 1}`}
                          onChange={(e) => handleRenameMenuImage(img.id, e.target.value)}
                          onBlur={handleSaveMenuImageTitle}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteMenuImage(img.id)}
                          className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                          title="Delete menu image"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Replace photo while keeping the same single QR link */}
                      <div className="flex flex-col gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                        {!isHostedLink && (
                          <button
                            type="button"
                            onClick={() => handleHostLocalMenuImageOnline(img)}
                            disabled={reuploadingId === img.id}
                            className="w-full py-1.5 px-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                          >
                            {reuploadingId === img.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Upload className="w-3.5 h-3.5" />
                            )}
                            <span>Host Photo Online for Image Link QR</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            replacingTargetRef.current = img;
                            replaceFileInputRef.current?.click();
                          }}
                          disabled={reuploadingId === img.id}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-60"
                        >
                          {reuploadingId === img.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          )}
                          <span>
                            {isHostedLink ? 'Replace Photo (Keep Same Link)' : 'Replace Photo'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WIFI SECTION */}
      {mode === 'wifi' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                WiFi
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Guests scan the QR code to join your hotel or business Wi-Fi automatically
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {t('wifi_ssid', business?.language) || 'Wi-Fi Name (SSID)'}
              </label>
              <input
                type="text"
                placeholder="e.g. Hotel_Guest_WiFi"
                value={wifiName}
                onChange={(e) => setWifiName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  {t('wifi_pass', business?.language) || 'Wi-Fi Password'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    disabled={wifiSecurity === 'nopass'}
                    placeholder={wifiSecurity === 'nopass' ? 'Open network (no password)' : 'Password123'}
                    value={wifiSecurity === 'nopass' ? '' : wifiPassword}
                    onChange={(e) => setWifiPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                  Security Type
                </label>
                <select
                  value={wifiSecurity}
                  onChange={(e) => setWifiSecurity(e.target.value as 'WPA' | 'WEP' | 'nopass')}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="WPA">WPA / WPA2 (Recommended)</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">None (Open Wi-Fi)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveWifi}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Wi-Fi Details</span>
            </button>
          </div>
        </div>
      )}

      {/* EMAIL AND CONTACTS SECTION */}
      {mode === 'contacts' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Email and Contacts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share your official email, phone number &amp; WhatsApp via QR code
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Business / Contact Name
              </label>
              <input
                type="text"
                placeholder="e.g. Grand Horizon Hotel"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Email Address
              </label>
              <input
                type="email"
                placeholder="reservations@hotel.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PhoneInputField
                id="quick-contact-phone"
                label={t('phone_number', business?.language) || 'Phone Number'}
                icon={Phone}
                value={contactPhone}
                onChange={setContactPhone}
                placeholder="700 123 456"
              />

              <PhoneInputField
                id="quick-contact-whatsapp"
                label={t('whatsapp_number', business?.language) || 'WhatsApp Number'}
                icon={MessageCircle}
                value={contactWhatsapp}
                onChange={setContactWhatsapp}
                placeholder="700 123 456"
              />
            </div>

            <button
              type="button"
              onClick={handleSaveContacts}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Save Email &amp; Contacts</span>
            </button>
          </div>
        </div>
      )}

      {/* LOCATION SECTION */}
      {mode === 'location' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Location
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Let guests scan to open your exact address or Google Maps pin
              </p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-slate-600 dark:text-slate-400 block mb-1">
                {t('physical_address', business?.language) || 'Physical Address / Street'}
              </label>
              <input
                type="text"
                placeholder="e.g. Plot 22 Kampala Road, Kampala"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">
                  Google Maps Link (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleUseCurrentGps}
                  disabled={isGettingGps}
                  className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-60"
                >
                  {isGettingGps ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Navigation className="w-3 h-3" />
                  )}
                  <span>{isGettingGps ? 'Locating...' : 'Use Current GPS'}</span>
                </button>
              </div>
              <input
                type="url"
                placeholder="https://maps.google.com/?q=..."
                value={googleMapsUrl}
                onChange={(e) => setGoogleMapsUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveLocation}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Location</span>
              </button>

              {qrPayload && (
                <a
                  href={qrPayload}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Maps</span>
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QR CODE PREVIEW CARD FOR ALL 4 QUICK SECTIONS */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-3.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
          <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>
            {mode === 'menu'
              ? 'Hotel Menu Image Link QR'
              : mode === 'wifi'
                ? 'Instant Guest WiFi QR Code'
                : mode === 'contacts'
                  ? 'Instant Contact Card QR Code'
                  : 'Google Maps Location QR Code'}
          </span>
        </div>

        {/* QR Code Label Input */}
        <div className="max-w-xs mx-auto text-left">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            QR Code Name (Optional)
          </label>
          <div className="relative flex items-center">
            <input
              type="text"
              placeholder="e.g. Reception, Table 1, Lobby"
              value={qrLabel}
              onChange={(e) => setQrLabel(e.target.value)}
              className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
            />
            {qrLabel && (
              <button
                type="button"
                onClick={() => setQrLabel('')}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Rendered QR Box (always visible for download & editing) */}
        <div
          className="inline-block p-4 rounded-3xl shadow-xl transition-all"
          style={{
            backgroundColor: activeBoxBgColor,
            borderColor: activeBoxBorderColor === 'transparent' ? 'transparent' : activeBoxBorderColor,
            borderWidth: activeBoxBorderColor === 'transparent' ? '0px' : '4px',
            borderStyle: 'solid',
          }}
        >
          {qrLabel && (
            <div className="mb-2 text-center">
              <span className="inline-block px-3 py-0.5 rounded-full bg-slate-900/90 text-white text-[11px] font-black uppercase tracking-wider">
                {qrLabel}
              </span>
            </div>
          )}

          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={qrLabel || 'QR Code'}
              className="w-44 h-44 sm:w-52 sm:h-52 mx-auto object-contain rounded-2xl p-2"
              style={{ backgroundColor: activeLightColor }}
            />
          ) : (
            <div
              className="w-44 h-44 sm:w-52 sm:h-52 mx-auto rounded-2xl flex flex-col items-center justify-center gap-2 px-3 text-center"
              style={{ backgroundColor: activeLightColor }}
            >
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span className="text-[11px] font-semibold text-slate-400">
                Generating QR...
              </span>
            </div>
          )}
        </div>

        {/* Helpful status / direct image link preview below the real QR box */}
        {mode === 'menu' && hasHostedMenuImage && (
          <div className="max-w-xs mx-auto text-[11px] text-slate-500 dark:text-slate-400 truncate px-2">
            Opens directly:{' '}
            <a
              href={qrPayload}
              target="_blank"
              rel="noreferrer"
              className="text-amber-600 dark:text-amber-400 font-semibold underline"
            >
              {qrPayload}
            </a>
          </div>
        )}

        {mode === 'menu' && !hasHostedMenuImage && (
          <div className="max-w-xs mx-auto flex flex-col items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 px-2">
            <span>
              {activeMenuImage
                ? 'Tap Host Online so this QR opens your uploaded menu photo.'
                : 'Upload your menu photo above to link it to this QR code.'}
            </span>
            {activeMenuImage && (
              <button
                type="button"
                onClick={() => handleHostLocalMenuImageOnline(activeMenuImage)}
                disabled={reuploadingId === activeMenuImage.id}
                className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {reuploadingId === activeMenuImage.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Upload className="w-3 h-3" />
                )}
                <span>Host Online</span>
              </button>
            )}
          </div>
        )}

        {mode === 'wifi' && !wifiName.trim() && (
          <div className="max-w-xs mx-auto text-[11px] text-slate-500 dark:text-slate-400 px-2">
            Showing preview for <span className="font-bold">{effectiveWifiSsid}</span> — enter your Wi-Fi Name above to update.
          </div>
        )}

        {/* Color Editor trigger */}
        <div>
          <button
            type="button"
            onClick={() => setIsEditingColors(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            <span>QR Code &amp; Box Editor</span>
          </button>
        </div>

        {/* Actions (Download, Copy, Share + optional Open Image / Maps) */}
        <div
          className={`grid gap-2 max-w-md mx-auto pt-1 ${
            (mode === 'menu' && hasHostedMenuImage) || mode === 'location'
              ? 'grid-cols-2 sm:grid-cols-4'
              : 'grid-cols-3'
          }`}
        >
          <button
            type="button"
            onClick={handleDownloadQrPng}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPayload}
            disabled={!qrPayload}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-45"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            disabled={!qrPayload}
            className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-45"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          {mode === 'menu' && hasHostedMenuImage && (
            <a
              href={qrPayload}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Image</span>
            </a>
          )}

          {mode === 'location' && (
            qrPayload ? (
              <a
                href={qrPayload}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Maps</span>
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="py-2.5 px-3 rounded-xl bg-emerald-600/45 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Maps</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Printable Table Stand / Wall Poster Generator Card (for Menu, WiFi, Contacts & Location) */}
      <div className="bg-emerald-50/70 dark:bg-emerald-950/30 rounded-3xl p-5 border border-emerald-200 dark:border-emerald-800/80 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Printer className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              {t('print_poster_title', business?.language) || 'Print Table & Wall QR Code Poster (PDF)'}
            </h3>
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              {t('print_poster_desc', business?.language) || 'Download a high-resolution A4 poster with your business name & QR code.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
              {t('qr_code_name', business?.language) || 'QR Code Name'}
            </label>
            <input
              type="text"
              placeholder={t('qr_name_placeholder', business?.language) || 'e.g. Reception, Table 1, Lobby, Entrance'}
              value={tableNumberForPrint}
              onChange={(e) => setTableNumberForPrint(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleDownloadTableStandPdf}
              disabled={isGeneratingPdf || !qrDataUrl}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {isGeneratingPdf
                  ? t('generating_pdf', business?.language) || 'Generating PDF...'
                  : t('download_poster_pdf', business?.language) || 'Download Table & Wall Poster (PDF)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox for Menu Image preview */}
      {lightboxImg && (
        <TouchZoomLightbox
          image={{
            url: lightboxImg.url,
            title: lightboxImg.title,
          }}
          onClose={() => setLightboxImg(null)}
        />
      )}

      {/* Delete Menu Photo Warning Modal */}
      <QrDeleteConfirmModal
        isOpen={Boolean(menuImageToDelete)}
        title="Delete Menu Photo?"
        description={`Are you sure you want to delete "${menuImageToDelete?.title || 'this menu photo'}"?`}
        warningText="Warning: Deleting this menu photo will stop your live QR code from working. Customers scanning your printed or shared Menu QR code will no longer be able to view this menu."
        confirmLabel="Delete Menu Photo"
        onConfirm={handleConfirmDeleteMenuImage}
        onCancel={() => setMenuImageToDelete(null)}
      />
    </div>
  );
};
