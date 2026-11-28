import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Upload,
  Download,
  Printer,
  Image as ImageIcon,
  QrCode,
  Move,
  Maximize2,
  Sparkles,
  Trash2,
  Check,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { QRHostingService } from '../services/qrHostingService';
import { saveFile, saveJsPdf } from '../services/fileSaver';

export interface PosterSizePreset {
  id: string;
  label: string;
  shortLabel: string;
  category: 'wall' | 'table' | 'sheet';
  widthMm: number;
  heightMm: number;
  desc: string;
  copiesPerSheet?: 1 | 2 | 4;
  fixedOrientation?: 'portrait' | 'landscape';
}

export const POSTER_SIZE_PRESETS: PosterSizePreset[] = [
  // Wall Posters
  {
    id: 'a4',
    label: 'A4 Poster (210 × 297 mm)',
    shortLabel: 'A4',
    category: 'wall',
    widthMm: 210,
    heightMm: 297,
    desc: 'Standard wall, counter & reception poster',
    copiesPerSheet: 1,
  },
  {
    id: 'a3',
    label: 'A3 Wall Poster (297 × 420 mm)',
    shortLabel: 'A3',
    category: 'wall',
    widthMm: 297,
    heightMm: 420,
    desc: 'Popular large indoor shop & restaurant wall poster',
    copiesPerSheet: 1,
  },
  {
    id: 'a2',
    label: 'A2 Large Wall Poster (420 × 594 mm)',
    shortLabel: 'A2',
    category: 'wall',
    widthMm: 420,
    heightMm: 594,
    desc: 'Big window, entrance & dining wall poster',
    copiesPerSheet: 1,
  },
  {
    id: 'a1',
    label: 'A1 Extra-Large Wall Poster (594 × 841 mm)',
    shortLabel: 'A1',
    category: 'wall',
    widthMm: 594,
    heightMm: 841,
    desc: 'Giant storefront & hall display poster',
    copiesPerSheet: 1,
  },
  {
    id: 'letter',
    label: 'US Letter (8.5 × 11 in)',
    shortLabel: 'Letter',
    category: 'wall',
    widthMm: 215.9,
    heightMm: 279.4,
    desc: 'North American standard wall & desk print',
    copiesPerSheet: 1,
  },
  {
    id: 'tabloid',
    label: 'US Tabloid / Ledger (11 × 17 in)',
    shortLabel: '11×17"',
    category: 'wall',
    widthMm: 279.4,
    heightMm: 431.8,
    desc: 'Large American wall & menu board poster',
    copiesPerSheet: 1,
  },
  {
    id: 'poster_18x24',
    label: '18 × 24 in Wall Poster',
    shortLabel: '18×24"',
    category: 'wall',
    widthMm: 457.2,
    heightMm: 609.6,
    desc: 'Standard commercial medium-large poster',
    copiesPerSheet: 1,
  },
  {
    id: 'poster_24x36',
    label: '24 × 36 in Wall Poster',
    shortLabel: '24×36"',
    category: 'wall',
    widthMm: 609.6,
    heightMm: 914.4,
    desc: 'Large billboard & shopfront window poster',
    copiesPerSheet: 1,
  },

  // Table Stands & Stickers
  {
    id: 'a5',
    label: 'A5 Table Tent / Counter (148 × 210 mm)',
    shortLabel: 'A5',
    category: 'table',
    widthMm: 148,
    heightMm: 210,
    desc: 'Classic acrylic table stand & reception card',
    copiesPerSheet: 1,
  },
  {
    id: 'a6',
    label: 'A6 Table Sticker / Card (105 × 148 mm)',
    shortLabel: 'A6',
    category: 'table',
    widthMm: 105,
    heightMm: 148,
    desc: 'Compact table-top sticker & menu card',
    copiesPerSheet: 1,
  },
  {
    id: 'card_5x7',
    label: '5 × 7 in Table Stand Card',
    shortLabel: '5×7"',
    category: 'table',
    widthMm: 127,
    heightMm: 177.8,
    desc: 'Table frame & counter display card',
    copiesPerSheet: 1,
  },
  {
    id: 'card_4x6',
    label: '4 × 6 in Mini Table Sticker',
    shortLabel: '4×6"',
    category: 'table',
    widthMm: 101.6,
    heightMm: 152.4,
    desc: 'Compact table & wall sticker',
    copiesPerSheet: 1,
  },
  {
    id: 'square_150',
    label: '15 × 15 cm Square Sticker',
    shortLabel: '15cm Sq',
    category: 'table',
    widthMm: 150,
    heightMm: 150,
    desc: 'Square counter, door & table sticker',
    copiesPerSheet: 1,
  },
  {
    id: 'square_100',
    label: '10 × 10 cm Mini Square Sticker',
    shortLabel: '10cm Sq',
    category: 'table',
    widthMm: 100,
    heightMm: 100,
    desc: 'Small table corner & packaging sticker',
    copiesPerSheet: 1,
  },

  // Multi-Sticker A4 Print Sheets
  {
    id: 'a4_2up',
    label: 'A4 Sheet: 2× Table Cards (A5)',
    shortLabel: '2-Up A4',
    category: 'sheet',
    widthMm: 297,
    heightMm: 210,
    desc: 'Prints 2 table cards side-by-side on A4 with cut lines',
    copiesPerSheet: 2,
    fixedOrientation: 'landscape',
  },
  {
    id: 'a4_4up',
    label: 'A4 Sheet: 4× Table Stickers (A6)',
    shortLabel: '4-Up A4',
    category: 'sheet',
    widthMm: 210,
    heightMm: 297,
    desc: 'Prints 4 stickers on one A4 page with cut guides',
    copiesPerSheet: 4,
    fixedOrientation: 'portrait',
  },
];

export interface FlyerQrPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrValue?: string;
  qrDataUrl: string;
  title: string;
  defaultLabel?: string;
  accentColor?: string;
  qrColor?: {
    dark?: string;
    light?: string;
    eyeColor?: string;
  };
  onToast?: (message: string) => void;
}

type FrameStyle = 'rounded' | 'square' | 'none';
type FitMode = 'cover' | 'contain';
type OrientationMode = 'auto' | 'portrait' | 'landscape';

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export const FlyerQrPosterModal: React.FC<FlyerQrPosterModalProps> = ({
  isOpen,
  onClose,
  qrValue,
  qrDataUrl,
  title,
  defaultLabel = '',
  accentColor = '#059669',
  qrColor,
  onToast,
}) => {
  const [flyerDataUrl, setFlyerDataUrl] = useState<string>('');
  const [flyerDims, setFlyerDims] = useState<{ w: number; h: number }>({ w: 1000, h: 1414 });
  const [sizeCategory, setSizeCategory] = useState<'wall' | 'table' | 'sheet'>('wall');
  const [selectedSizeId, setSelectedSizeId] = useState<string>('a4');
  const [orientation, setOrientation] = useState<OrientationMode>('auto');
  const [fitMode, setFitMode] = useState<FitMode>('cover');

  // QR position as center percentages (0..100) relative to single poster canvas
  const [qrPosX, setQrPosX] = useState<number>(50);
  const [qrPosY, setQrPosY] = useState<number>(58);
  const [qrScalePct, setQrScalePct] = useState<number>(44); // % of poster shorter side
  const [frameStyle, setFrameStyle] = useState<FrameStyle>('rounded');
  const [badgeLabel, setBadgeLabel] = useState<string>(defaultLabel);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    active: boolean;
    offsetX: number;
    offsetY: number;
  }>({ active: false, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
      setBadgeLabel(defaultLabel || '');
    }
  }, [isOpen, defaultLabel]);

  const selectedPreset = useMemo(
    () => POSTER_SIZE_PRESETS.find((p) => p.id === selectedSizeId) || POSTER_SIZE_PRESETS[0],
    [selectedSizeId]
  );

  // Dimensions of a single flyer slot (for preview & single-poster export)
  const effectiveSingleSlotMm = useMemo(() => {
    if (selectedPreset.id === 'a4_2up') {
      return { widthMm: 148.5, heightMm: 210 };
    }
    if (selectedPreset.id === 'a4_4up') {
      return { widthMm: 105, heightMm: 148.5 };
    }
    const baseW = Math.min(selectedPreset.widthMm, selectedPreset.heightMm);
    const baseH = Math.max(selectedPreset.widthMm, selectedPreset.heightMm);
    if (selectedPreset.widthMm === selectedPreset.heightMm) {
      return { widthMm: baseW, heightMm: baseH };
    }
    const useLandscape =
      orientation === 'landscape' ||
      (orientation === 'auto' && flyerDataUrl && flyerDims.w > flyerDims.h * 1.05);
    return useLandscape ? { widthMm: baseH, heightMm: baseW } : { widthMm: baseW, heightMm: baseH };
  }, [selectedPreset, orientation, flyerDataUrl, flyerDims]);

  // Dimensions of the output PDF page
  const effectivePageMm = useMemo(() => {
    if (selectedPreset.copiesPerSheet && selectedPreset.copiesPerSheet > 1) {
      return {
        widthMm: selectedPreset.widthMm,
        heightMm: selectedPreset.heightMm,
      };
    }
    return effectiveSingleSlotMm;
  }, [selectedPreset, effectiveSingleSlotMm]);

  const handleSelectFlyerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLocalError('Please choose an image file (PNG, JPG, WEBP).');
      return;
    }
    setLocalError(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) return;
      try {
        const img = await loadHtmlImage(dataUrl);
        setFlyerDims({
          w: img.naturalWidth || img.width || 1000,
          h: img.naturalHeight || img.height || 1414,
        });
        setFlyerDataUrl(dataUrl);
      } catch {
        setLocalError('Could not read this image. Please try another flyer file.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Drag-to-move QR overlay inside preview container
  const updateQrPositionFromClient = (clientX: number, clientY: number) => {
    const box = previewContainerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const rawX = ((clientX - draggingRef.current.offsetX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - draggingRef.current.offsetY - rect.top) / rect.height) * 100;
    setQrPosX(Math.max(8, Math.min(92, rawX)));
    setQrPosY(Math.max(8, Math.min(92, rawY)));
  };

  const handleQrPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const box = previewContainerRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    const currentCenterX = rect.left + (qrPosX / 100) * rect.width;
    const currentCenterY = rect.top + (qrPosY / 100) * rect.height;
    draggingRef.current = {
      active: true,
      offsetX: e.clientX - currentCenterX,
      offsetY: e.clientY - currentCenterY,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleQrPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current.active) return;
    e.preventDefault();
    updateQrPositionFromClient(e.clientX, e.clientY);
  };

  const handleQrPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current.active) return;
    draggingRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const renderCompositePosterDataUrl = async (maxEdgePx = 2200): Promise<string> => {
    if (!flyerDataUrl) {
      throw new Error('Please upload your business flyer image first.');
    }

    const slotW = effectiveSingleSlotMm.widthMm;
    const slotH = effectiveSingleSlotMm.heightMm;
    const aspect = slotW / slotH;

    let canvasW: number;
    let canvasH: number;
    if (aspect >= 1) {
      canvasW = maxEdgePx;
      canvasH = Math.round(maxEdgePx / aspect);
    } else {
      canvasH = maxEdgePx;
      canvasW = Math.round(maxEdgePx * aspect);
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    // Fill clean white base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 1. Draw uploaded flyer (kept 100% local, never uploaded)
    const flyerImg = await loadHtmlImage(flyerDataUrl);
    const imgW = flyerImg.naturalWidth || flyerImg.width;
    const imgH = flyerImg.naturalHeight || flyerImg.height;
    const imgAspect = imgW / imgH;
    const canvasAspect = canvasW / canvasH;

    let drawW: number;
    let drawH: number;
    if (fitMode === 'cover') {
      if (imgAspect > canvasAspect) {
        drawH = canvasH;
        drawW = canvasH * imgAspect;
      } else {
        drawW = canvasW;
        drawH = canvasW / imgAspect;
      }
    } else {
      if (imgAspect > canvasAspect) {
        drawW = canvasW;
        drawH = canvasW / imgAspect;
      } else {
        drawH = canvasH;
        drawW = canvasH * imgAspect;
      }
    }
    const drawX = (canvasW - drawW) / 2;
    const drawY = (canvasH - drawH) / 2;
    ctx.drawImage(flyerImg, drawX, drawY, drawW, drawH);

    // 2. Render crisp high-resolution QR code
    let highResQrUrl = qrDataUrl;
    if (qrValue) {
      try {
        highResQrUrl = await QRHostingService.generateQrCodeDataUrl(qrValue, {
          width: 1100,
          margin: 2,
          color: {
            dark: qrColor?.dark || '#000000',
            light: qrColor?.light || '#ffffff',
            eyeColor: qrColor?.eyeColor || qrColor?.dark || '#000000',
          },
        });
      } catch {
        highResQrUrl = qrDataUrl;
      }
    }
    const qrImg = await loadHtmlImage(highResQrUrl);

    const shortSide = Math.min(canvasW, canvasH);
    const qrBoxSize = Math.round((qrScalePct / 100) * shortSide);
    const padding = frameStyle === 'none' ? 0 : Math.round(qrBoxSize * 0.09);
    const trimmedLabel = badgeLabel.trim();
    const labelFontPx = Math.max(18, Math.round(qrBoxSize * 0.1));
    const labelHeight = trimmedLabel ? Math.round(labelFontPx * 1.65) : 0;

    const cardW = qrBoxSize + padding * 2;
    const cardH = qrBoxSize + padding * 2 + (trimmedLabel ? labelHeight + Math.round(padding * 0.35) : 0);

    const centerX = (qrPosX / 100) * canvasW;
    const centerY = (qrPosY / 100) * canvasH;
    const cardX = Math.max(8, Math.min(canvasW - cardW - 8, Math.round(centerX - cardW / 2)));
    const cardY = Math.max(8, Math.min(canvasH - cardH - 8, Math.round(centerY - cardH / 2)));

    if (frameStyle !== 'none') {
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.28)';
      ctx.shadowBlur = Math.round(qrBoxSize * 0.08);
      ctx.shadowOffsetY = Math.round(qrBoxSize * 0.025);
      ctx.fillStyle = qrColor?.light || '#ffffff';
      const radius = frameStyle === 'rounded' ? Math.round(qrBoxSize * 0.1) : 0;
      drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, radius);
      ctx.fill();
      ctx.restore();

      ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
      ctx.lineWidth = Math.max(2, Math.round(qrBoxSize * 0.008));
      drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, radius);
      ctx.stroke();
    }

    const qrDrawX = cardX + padding;
    const qrDrawY = cardY + padding;
    ctx.drawImage(qrImg, qrDrawX, qrDrawY, qrBoxSize, qrBoxSize);

    if (trimmedLabel) {
      const labelY = qrDrawY + qrBoxSize + Math.round(padding * 0.25);
      const pillW = Math.min(cardW - padding, Math.max(qrBoxSize * 0.65, ctx.measureText(trimmedLabel).width + 36));
      const pillX = cardX + (cardW - pillW) / 2;
      ctx.fillStyle = accentColor || '#0f172a';
      drawRoundedRectPath(ctx, pillX, labelY, pillW, labelHeight, labelHeight / 2);
      ctx.fill();

      ctx.font = `900 ${labelFontPx}px system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(trimmedLabel.toUpperCase(), cardX + cardW / 2, labelY + labelHeight / 2 + 1, cardW - padding * 1.4);
    }

    return canvas.toDataURL('image/png', 0.96);
  };

  const handleDownloadPng = async () => {
    if (!flyerDataUrl) {
      setLocalError('Please upload your business flyer image first.');
      return;
    }
    setIsExporting(true);
    setLocalError(null);
    try {
      const compositeUrl = await renderCompositePosterDataUrl(2200);
      const safeTitle = (title || 'Business').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeTitle}_${selectedPreset.id.toUpperCase()}_QR_Poster.png`;
      const res = await saveFile({
        data: compositeUrl,
        filename,
        mimeType: 'image/png',
        title: `${title} QR Poster (${selectedPreset.shortLabel})`,
        destination: 'photos',
      });
      if (res.success && onToast) {
        onToast(res.message);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to generate poster image.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!flyerDataUrl) {
      setLocalError('Please upload your business flyer image first.');
      return;
    }
    setIsExporting(true);
    setLocalError(null);
    try {
      const compositeUrl = await renderCompositePosterDataUrl(
        selectedPreset.copiesPerSheet && selectedPreset.copiesPerSheet > 1 ? 1600 : 2400
      );

      const pageW = effectivePageMm.widthMm;
      const pageH = effectivePageMm.heightMm;
      const doc = new jsPDF({
        orientation: pageW > pageH ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageW, pageH],
      });

      const realPageW = doc.internal.pageSize.getWidth();
      const realPageH = doc.internal.pageSize.getHeight();

      if (selectedPreset.id === 'a4_2up') {
        const halfW = realPageW / 2;
        doc.addImage(compositeUrl, 'PNG', 0, 0, halfW, realPageH);
        doc.addImage(compositeUrl, 'PNG', halfW, 0, halfW, realPageH);
        // Subtle cut guide down center
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.line(halfW, 0, halfW, realPageH);
      } else if (selectedPreset.id === 'a4_4up') {
        const halfW = realPageW / 2;
        const halfH = realPageH / 2;
        doc.addImage(compositeUrl, 'PNG', 0, 0, halfW, halfH);
        doc.addImage(compositeUrl, 'PNG', halfW, 0, halfW, halfH);
        doc.addImage(compositeUrl, 'PNG', 0, halfH, halfW, halfH);
        doc.addImage(compositeUrl, 'PNG', halfW, halfH, halfW, halfH);
        // Subtle cut guides
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.line(halfW, 0, halfW, realPageH);
        doc.line(0, halfH, realPageW, halfH);
      } else {
        doc.addImage(compositeUrl, 'PNG', 0, 0, realPageW, realPageH);
      }

      const safeTitle = (title || 'Business').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${safeTitle}_${selectedPreset.id.toUpperCase()}_QR_Poster.pdf`;
      const res = await saveJsPdf(doc, filename, `${title} QR Poster (${selectedPreset.shortLabel})`);
      if (res.success && onToast) {
        onToast(res.message);
      }
    } catch (err: any) {
      setLocalError(err?.message || 'Failed to generate poster PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredPresets = useMemo(
    () => POSTER_SIZE_PRESETS.filter((p) => p.category === sizeCategory),
    [sizeCategory]
  );

  if (!isOpen || typeof document === 'undefined') return null;

  const slotAspect = effectiveSingleSlotMm.widthMm / effectiveSingleSlotMm.heightMm;

  return createPortal(
    <div className="fixed inset-0 z-[10000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl max-h-[93dvh] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">
                Custom Business Flyer & Poster Builder
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Upload your flyer, place your QR code & download for tables or walls
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Privacy / On-Device Note */}
          <div className="px-3 py-2 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>Your flyer stays strictly on your device—never uploaded to cloud storage.</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleSelectFlyerFile}
            className="hidden"
          />

          {/* Step 1: Upload Flyer OR Live Interactive Canvas */}
          {!flyerDataUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-10 px-6 rounded-3xl border-2 border-dashed border-emerald-300 dark:border-emerald-700/80 bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition flex flex-col items-center justify-center text-center gap-3 cursor-pointer"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  Upload Your Business Flyer / Poster Design
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  Pick any PNG, JPG, or WEBP flyer from your device, then drag your QR code onto it and download in A4, A3, A2, A5, A6, or sticker sheets.
                </p>
              </div>
              <span className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold shadow-xs">
                Choose Flyer Image
              </span>
            </button>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
              {/* Left: Live Drag-to-Place Preview */}
              <div className="md:col-span-6 space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Move className="w-3.5 h-3.5 text-emerald-600" />
                    Drag QR code anywhere on flyer
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Change Flyer
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setFlyerDataUrl('')}
                      className="text-rose-500 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex items-center justify-center">
                  <div
                    ref={previewContainerRef}
                    style={{
                      aspectRatio: `${slotAspect}`,
                      maxHeight: '360px',
                      width: slotAspect >= 1 ? '100%' : 'auto',
                      height: slotAspect < 1 ? '340px' : 'auto',
                    }}
                    className="relative bg-white rounded-xl overflow-hidden shadow-lg border border-slate-300 dark:border-slate-700 select-none"
                  >
                    <img
                      src={flyerDataUrl}
                      alt="Uploaded Business Flyer"
                      className={`w-full h-full pointer-events-none ${
                        fitMode === 'cover' ? 'object-cover' : 'object-contain'
                      }`}
                    />

                    {/* Draggable QR Overlay */}
                    <div
                      onPointerDown={handleQrPointerDown}
                      onPointerMove={handleQrPointerMove}
                      onPointerUp={handleQrPointerUp}
                      onPointerCancel={handleQrPointerUp}
                      style={{
                        left: `${qrPosX}%`,
                        top: `${qrPosY}%`,
                        transform: 'translate(-50%, -50%)',
                        width:
                          slotAspect >= 1
                            ? `${(qrScalePct / slotAspect).toFixed(2)}%`
                            : `${qrScalePct}%`,
                      }}
                      className={`absolute touch-none cursor-grab active:cursor-grabbing flex flex-col items-center ${
                        frameStyle === 'rounded'
                          ? 'bg-white rounded-xl p-1.5 sm:p-2 shadow-xl border border-slate-900/10'
                          : frameStyle === 'square'
                          ? 'bg-white p-1.5 sm:p-2 shadow-xl border border-slate-900/10'
                          : 'p-0'
                      }`}
                    >
                      <img
                        src={qrDataUrl}
                        alt="QR Overlay"
                        className="w-full aspect-square object-contain pointer-events-none"
                      />
                      {badgeLabel.trim() && (
                        <div
                          style={{ backgroundColor: accentColor || '#0f172a' }}
                          className="mt-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wide text-white truncate max-w-full pointer-events-none"
                        >
                          {badgeLabel.trim()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Align Presets */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Snap:</span>
                  {[
                    { label: 'Center', x: 50, y: 50 },
                    { label: 'Mid-Low', x: 50, y: 60 },
                    { label: 'Bottom', x: 50, y: 76 },
                    { label: 'Top', x: 50, y: 26 },
                    { label: 'Bot-Right', x: 76, y: 76 },
                  ].map((pos) => (
                    <button
                      key={pos.label}
                      type="button"
                      onClick={() => {
                        setQrPosX(pos.x);
                        setQrPosY(pos.y);
                      }}
                      className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-emerald-950 text-[10px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer transition"
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Poster Sizes & QR Customization Controls */}
              <div className="md:col-span-6 space-y-3.5">
                {/* Paper Size Category Tabs */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Poster / Table Size</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                    {[
                      { id: 'wall', label: 'Wall Posters' },
                      { id: 'table', label: 'Table & Cards' },
                      { id: 'sheet', label: 'Sticker Sheets' },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          const nextCat = cat.id as 'wall' | 'table' | 'sheet';
                          setSizeCategory(nextCat);
                          const first = POSTER_SIZE_PRESETS.find((p) => p.category === nextCat);
                          if (first) setSelectedSizeId(first.id);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          sizeCategory === cat.id
                            ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Size Select List */}
                  <select
                    value={selectedSizeId}
                    onChange={(e) => setSelectedSizeId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {filteredPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                    {selectedPreset.desc}
                  </p>
                </div>

                {/* Orientation & Fit */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                      Orientation
                    </label>
                    <select
                      value={orientation}
                      disabled={
                        Boolean(selectedPreset.fixedOrientation) ||
                        selectedPreset.widthMm === selectedPreset.heightMm
                      }
                      onChange={(e) => setOrientation(e.target.value as OrientationMode)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 disabled:opacity-50"
                    >
                      <option value="auto">Auto (Match Flyer)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                      Flyer Fit
                    </label>
                    <select
                      value={fitMode}
                      onChange={(e) => setFitMode(e.target.value as FitMode)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                    >
                      <option value="cover">Fill Page (Edge-to-Edge)</option>
                      <option value="contain">Fit Whole Flyer</option>
                    </select>
                  </div>
                </div>

                {/* QR Size Slider */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    <span className="flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      QR Code Size
                    </span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{qrScalePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={18}
                    max={72}
                    value={qrScalePct}
                    onChange={(e) => setQrScalePct(Number(e.target.value))}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>

                {/* QR Box Frame Style */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                    QR Background Box
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'rounded', label: 'Rounded Card' },
                      { id: 'square', label: 'Square Card' },
                      { id: 'none', label: 'No Border' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFrameStyle(opt.id as FrameStyle)}
                        className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border transition cursor-pointer flex items-center justify-center gap-1 ${
                          frameStyle === opt.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {frameStyle === opt.id && <Check className="w-3 h-3 shrink-0" />}
                        <span className="truncate">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Tag / Table Number */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block mb-1">
                    Optional Table / Badge Label
                  </label>
                  <input
                    type="text"
                    value={badgeLabel}
                    onChange={(e) => setBadgeLabel(e.target.value)}
                    placeholder="Leave blank or enter e.g. Table 1, Scan Menu"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {localError && (
            <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-600 dark:text-rose-300">
              {localError}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Selected: <span className="font-bold text-slate-800 dark:text-slate-200">{selectedPreset.label}</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={!flyerDataUrl || isExporting}
              className="py-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              <span>Download Image</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!flyerDataUrl || isExporting}
              className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Download Print PDF</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
