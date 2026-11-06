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
  const isLogo = folder === 'photos' && filename.toLowerCase().includes('logo');
  const isSignature = folder === 'signatures' || filename.toLowerCase().includes('signature');

  let maxWidth = 1200;
  let maxHeight = 1200;
  let targetFilename = filename;

  if (isLogo) {
    maxWidth = 512;
    maxHeight = 512;
    targetFilename = 'logo.webp';
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
