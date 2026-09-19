/**
 * Client-side image compression utility for mobile camera photos and gallery uploads.
 * Reduces 5MB-15MB phone camera photos down to ~15KB-30KB compact thumbnails
 * so they easily fit inside browser storage without exceeding quota.
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
  maxBytes?: number; // Maximum target size in bytes (e.g., 500 * 1024 = 512,000 bytes for 500KB)
}

export function compressImageFile(
  file: File | Blob,
  options: CompressOptions = {}
): Promise<string> {
  const { maxDimension = 800, quality = 0.75, mimeType = 'image/jpeg', maxBytes = 500 * 1024 } = options;

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

      compressDataUrl(src, { maxDimension, quality, mimeType, maxBytes })
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
  const { maxDimension = 800, quality = 0.75, mimeType = 'image/jpeg', maxBytes = 500 * 1024 } = options;

  return new Promise((resolve) => {
    // If not a data URL, return as is
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
        ctx.imageSmoothingQuality = 'high';

        ctx.drawImage(img, 0, 0, width, height);

        let currentQuality = quality;
        let compressed = canvas.toDataURL(mimeType, currentQuality);

        // Helper to calculate approximate byte size from data URL
        const getByteSize = (str: string) => {
          const base64Part = str.split(',')[1] || '';
          return Math.round(base64Part.length * 0.75);
        };

        // Iteratively reduce quality and scale if image exceeds maxBytes (e.g. 500KB)
        let attempts = 0;
        while (maxBytes && getByteSize(compressed) > maxBytes && attempts < 5) {
          attempts++;
          currentQuality = Math.max(0.2, currentQuality - 0.12);

          if (attempts >= 2) {
            // Scale dimensions down
            const scale = 0.82;
            width = Math.max(120, Math.round(width * scale));
            height = Math.max(120, Math.round(height * scale));
            canvas.width = width;
            canvas.height = height;

            if (mimeType === 'image/jpeg') {
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }

          compressed = canvas.toDataURL(mimeType, currentQuality);
        }

        resolve(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        resolve(dataUrl);
      }
    };

    img.src = dataUrl;
  });
}
