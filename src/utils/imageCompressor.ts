/**
 * Client-side image compression utility for mobile camera photos and gallery uploads.
 * Reduces 5MB-15MB phone camera photos down to ~15KB-30KB compact thumbnails
 * so they easily fit inside browser storage without exceeding quota.
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

export function compressImageFile(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 320, quality = 0.68, mimeType = 'image/jpeg' } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Failed to read image file'));
    };

    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        reject(new Error('Empty image data'));
        return;
      }

      compressDataUrl(src, { maxDimension, quality, mimeType })
        .then(resolve)
        .catch(reject);
    };

    reader.readAsDataURL(file);
  });
}

export function compressDataUrl(
  dataUrl: string,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 320, quality = 0.68, mimeType = 'image/jpeg' } = options;

  return new Promise((resolve) => {
    // If not a data URL or already very small (< 10KB), return as is
    if (!dataUrl.startsWith('data:image/')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();

    img.onerror = () => {
      // If error loading image, fallback to original
      resolve(dataUrl);
    };

    img.onload = () => {
      try {
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width <= 0 || height <= 0) {
          resolve(dataUrl);
          return;
        }

        // Calculate proportional scale
        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        // Fill background with white for JPEG transparency compatibility
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        // Use high quality image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';

        ctx.drawImage(img, 0, 0, width, height);

        const compressed = canvas.toDataURL(mimeType, quality);
        resolve(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        resolve(dataUrl);
      }
    };

    img.src = dataUrl;
  });
}
