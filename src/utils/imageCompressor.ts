/**
 * Client-side image compression and resizing utility for Brivu.
 * Converts logos to max 512x512 and signatures to max 600x200 as WebP.
 */

export interface ResizeOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
  maxBytes?: number;
}

export async function compressImageToWebP(
  dataUriOrBlob: string | Blob | ArrayBuffer,
  options: ResizeOptions
): Promise<{ dataUri: string; blob: Blob; mimeType: string }> {
  let maxWidth = options.maxWidth || options.maxDimension || 1200;
  let maxHeight = options.maxHeight || options.maxDimension || 1200;
  const quality = options.quality ?? 0.85;
  const mimeType = options.mimeType || 'image/webp';

  return new Promise((resolve, reject) => {
    let srcUrl = '';
    let isCreatedUrl = false;

    if (typeof dataUriOrBlob === 'string') {
      srcUrl = dataUriOrBlob;
    } else if (dataUriOrBlob instanceof ArrayBuffer) {
      srcUrl = URL.createObjectURL(new Blob([dataUriOrBlob]));
      isCreatedUrl = true;
    } else {
      srcUrl = URL.createObjectURL(dataUriOrBlob);
      isCreatedUrl = true;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          if (isCreatedUrl) URL.revokeObjectURL(srcUrl);
          reject(new Error('Canvas context could not be created'));
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first
        let outputDataUri = canvas.toDataURL(mimeType, quality);
        let actualMime = mimeType;
        if (!outputDataUri.startsWith('data:image/webp') && mimeType === 'image/webp') {
          actualMime = 'image/png';
          outputDataUri = canvas.toDataURL(actualMime);
        }

        canvas.toBlob(
          (blob) => {
            if (isCreatedUrl) URL.revokeObjectURL(srcUrl);
            if (blob) {
              resolve({ dataUri: outputDataUri, blob, mimeType: actualMime });
            } else {
              const byteString = atob(outputDataUri.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve({
                dataUri: outputDataUri,
                blob: new Blob([ab], { type: actualMime }),
                mimeType: actualMime,
              });
            }
          },
          actualMime,
          quality
        );
      } catch (err) {
        if (isCreatedUrl) URL.revokeObjectURL(srcUrl);
        reject(err);
      }
    };

    img.onerror = (err) => {
      if (isCreatedUrl) URL.revokeObjectURL(srcUrl);
      reject(err);
    };

    img.src = srcUrl;
  });
}

/**
 * Compresses an image File or Blob and returns a base64 data URI string.
 */
export async function compressImageFile(
  fileOrBlob: File | Blob,
  options: ResizeOptions = {}
): Promise<string> {
  const res = await compressImageToWebP(fileOrBlob, options);
  return res.dataUri;
}

/**
 * Optimizes an image for R2 storage (converts to WebP, limits dimensions).
 */
export async function optimizeImageForR2(
  data: string | Blob | ArrayBuffer,
  folder: string,
  filename: string
): Promise<{ data: string; mimeType: string; filename: string }> {
  const lowerName = filename.toLowerCase();
  const isQrLogo = folder === 'photos' && lowerName.includes('qr_logo');
  const isLogo = folder === 'photos' && !isQrLogo && lowerName.includes('logo');
  const isSignature = folder === 'signatures' || lowerName.includes('signature');

  let maxWidth = 1200;
  let maxHeight = 1200;
  let targetFilename = filename;

  if (isLogo) {
    maxWidth = 512;
    maxHeight = 512;
    targetFilename = 'logo.webp';
  } else if (isQrLogo) {
    maxWidth = 512;
    maxHeight = 512;
    targetFilename = filename.replace(/\.(png|jpe?g|gif|bmp)$/i, '.webp');
  } else if (isSignature) {
    maxWidth = 600;
    maxHeight = 200;
    targetFilename = 'signature.webp';
  }

  const res = await compressImageToWebP(data, {
    maxWidth,
    maxHeight,
    quality: 0.85,
    mimeType: 'image/webp',
  });

  return {
    data: res.dataUri,
    mimeType: res.mimeType,
    filename: targetFilename,
  };
}

export async function compressLogo(dataUriOrBlob: string | Blob) {
  return compressImageToWebP(dataUriOrBlob, {
    maxWidth: 512,
    maxHeight: 512,
    quality: 0.85,
    mimeType: 'image/webp',
  });
}

export async function compressSignature(dataUriOrBlob: string | Blob) {
  return compressImageToWebP(dataUriOrBlob, {
    maxWidth: 600,
    maxHeight: 200,
    quality: 0.85,
    mimeType: 'image/webp',
  });
}

export interface StitchedMenuResult {
  dataUri: string;
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  pageCount: number;
  sizeBytes: number;
}

function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

/**
 * Stitches 2–5 menu page images vertically into ONE scrollable WebP image
 * styled with clean page gaps (like a multi-page document viewer) while
 * keeping total file size comparable to a single compressed photo.
 */
export async function stitchMenuImagesToSingleWebP(
  files: (File | Blob)[],
  options: {
    pageWidth?: number;
    gapPx?: number;
    paddingPx?: number;
    targetMaxBytes?: number;
    initialQuality?: number;
    minQuality?: number;
  } = {}
): Promise<StitchedMenuResult> {
  if (!files || files.length === 0) {
    throw new Error('No images provided to stitch');
  }

  // Single photo fallback keeps exact existing single-image compression
  if (files.length === 1) {
    const single = await compressImageToWebP(files[0], {
      maxDimension: 1400,
      mimeType: 'image/webp',
      quality: 0.85,
      maxBytes: 320 * 1024,
    });
    const probe = await loadImageFromFile(single.blob);
    return {
      dataUri: single.dataUri,
      blob: single.blob,
      mimeType: single.mimeType,
      width: probe.naturalWidth || probe.width,
      height: probe.naturalHeight || probe.height,
      pageCount: 1,
      sizeBytes: single.blob.size,
    };
  }

  const loadedImages = await Promise.all(files.map((f) => loadImageFromFile(f)));

  const basePageWidth = options.pageWidth ?? (loadedImages.length <= 3 ? 1040 : 960);
  const basePadding = options.paddingPx ?? 16;
  const baseGap = options.gapPx ?? 24;

  // Calculate raw stacked dimensions
  const rawPageHeights = loadedImages.map((img) => {
    const nw = Math.max(1, img.naturalWidth || img.width);
    const nh = Math.max(1, img.naturalHeight || img.height);
    return Math.round(basePageWidth * (nh / nw));
  });

  const rawCanvasWidth = basePageWidth + basePadding * 2;
  const rawCanvasHeight =
    basePadding * 2 +
    rawPageHeights.reduce((sum, h) => sum + h, 0) +
    baseGap * (loadedImages.length - 1);

  // Stay safely inside iOS Safari & Android Chrome canvas limits (16.7M pixels / 16,384px height)
  const MAX_CANVAS_HEIGHT = 11500;
  const MAX_CANVAS_PIXELS = 11_500_000;
  let safeScale = 1;
  if (rawCanvasHeight > MAX_CANVAS_HEIGHT) {
    safeScale = Math.min(safeScale, MAX_CANVAS_HEIGHT / rawCanvasHeight);
  }
  if (rawCanvasWidth * rawCanvasHeight > MAX_CANVAS_PIXELS) {
    safeScale = Math.min(
      safeScale,
      Math.sqrt(MAX_CANVAS_PIXELS / (rawCanvasWidth * rawCanvasHeight))
    );
  }

  const pageWidth = Math.max(480, Math.round(basePageWidth * safeScale));
  const padding = Math.max(8, Math.round(basePadding * safeScale));
  const gap = Math.max(12, Math.round(baseGap * safeScale));
  const pageHeights = rawPageHeights.map((h) => Math.max(120, Math.round(h * safeScale)));
  const canvasWidth = pageWidth + padding * 2;
  const canvasHeight =
    padding * 2 +
    pageHeights.reduce((sum, h) => sum + h, 0) +
    gap * (loadedImages.length - 1);

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas context could not be created');
  }

  // Subtle warm off-white page backdrop matching clean multi-page document viewer
  ctx.fillStyle = '#F5F1EB';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  let cursorY = padding;
  for (let i = 0; i < loadedImages.length; i++) {
    const img = loadedImages[i];
    const h = pageHeights[i];

    // White sheet background + subtle crisp border around each page
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(padding, cursorY, pageWidth, h);
    ctx.drawImage(img, padding, cursorY, pageWidth, h);
    ctx.strokeStyle = '#E2DDD5';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding + 0.5, cursorY + 0.5, pageWidth - 1, h - 1);

    cursorY += h + gap;
  }

  // Adaptive WebP encoding so 2–5 stitched pages stay compact (comparable to 1 single photo)
  const targetMaxBytes = options.targetMaxBytes ?? (loadedImages.length <= 3 ? 380 * 1024 : 460 * 1024);
  const initialQuality = options.initialQuality ?? 0.78;
  const minQuality = options.minQuality ?? 0.56;

  const encodeWithMime = (mime: string, q: number): Promise<{ dataUri: string; blob: Blob }> =>
    new Promise((resolve) => {
      const dataUri = canvas.toDataURL(mime, q);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({ dataUri, blob });
          } else {
            const byteString = atob(dataUri.split(',')[1] || '');
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let j = 0; j < byteString.length; j++) {
              ia[j] = byteString.charCodeAt(j);
            }
            resolve({ dataUri, blob: new Blob([ab], { type: mime }) });
          }
        },
        mime,
        q
      );
    });

  let chosenMime = 'image/webp';
  const probeUri = canvas.toDataURL('image/webp', initialQuality);
  if (!probeUri.startsWith('data:image/webp')) {
    chosenMime = 'image/jpeg';
  }

  let best = await encodeWithMime(chosenMime, initialQuality);
  let q = initialQuality - 0.06;
  while (best.blob.size > targetMaxBytes && q >= minQuality) {
    best = await encodeWithMime(chosenMime, Number(q.toFixed(2)));
    q -= 0.06;
  }

  return {
    dataUri: best.dataUri,
    blob: best.blob,
    mimeType: chosenMime,
    width: canvasWidth,
    height: canvasHeight,
    pageCount: loadedImages.length,
    sizeBytes: best.blob.size,
  };
}

