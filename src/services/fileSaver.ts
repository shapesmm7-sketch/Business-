import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';

interface MediaStorePluginInterface {
  saveToMediaStore(options: {
    filename: string;
    data: string;
    mimeType?: string;
    destination?: 'documents' | 'photos';
  }): Promise<{ success: boolean; uri: string; savedLocation: string; message: string }>;
  checkStoragePermission?(): Promise<{ granted: boolean }>;
  requestStoragePermission?(): Promise<{ granted: boolean }>;
  share(options: {
    filename?: string;
    data?: string;
    mimeType?: string;
    text?: string;
    title?: string;
    url?: string;
  }): Promise<{ success: boolean; message: string }>;
}

const MediaStore = registerPlugin<MediaStorePluginInterface>('MediaStore');

/**
 * Ensures storage permission is granted on Android devices (especially older Android versions
 * where direct file writing requires WRITE_EXTERNAL_STORAGE).
 */
export async function ensureStoragePermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    if (MediaStore.checkStoragePermission) {
      const status = await MediaStore.checkStoragePermission();
      if (status && status.granted) return true;
      if (MediaStore.requestStoragePermission) {
        const req = await MediaStore.requestStoragePermission();
        return !!req?.granted;
      }
    }
    const permResult = await Filesystem.checkPermissions();
    if (permResult.publicStorage !== 'granted') {
      const req = await Filesystem.requestPermissions();
      return req.publicStorage === 'granted';
    }
    return true;
  } catch (err) {
    console.warn('Storage permission check note:', err);
    return true;
  }
}

export interface SaveFileOptions {
  /** Blob, ArrayBuffer, text string (JSON/CSV), or base64 Data URI */
  data: Blob | ArrayBuffer | string;
  filename: string;
  mimeType?: string;
  title?: string;
  /**
   * Whether to open the Android native share sheet after saving.
   * Default is false to ensure files save directly into phone storage without opening share.
   */
  openShareSheet?: boolean;
  /** Destination folder type in phone storage ('documents' -> Download/QuickReceipt, 'photos' -> Pictures/QuickReceipt) */
  destination?: 'documents' | 'photos';
}

/**
 * Saves and exports files directly into device phone storage via Android MediaStore API
 * (Pictures/QuickReceipt for photos, Download/QuickReceipt for documents/PDFs/data).
 * Does NOT pop open the Android share sheet unless explicitly requested.
 */
export async function saveFile(options: SaveFileOptions): Promise<{ success: boolean; uri?: string; message: string }> {
  const {
    filename,
    mimeType = 'application/octet-stream',
    title = filename,
    openShareSheet = false,
    destination,
  } = options;
  const { data } = options;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // 1. Convert input data to clean base64 string
      let base64Data = '';
      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          base64Data = data.split(',')[1] || '';
        } else {
          // Plain text string (JSON, CSV, etc.)
          base64Data = btoa(unescape(encodeURIComponent(data)));
        }
      } else if (data instanceof Blob) {
        base64Data = await blobToBase64(data);
      } else if (data instanceof ArrayBuffer) {
        base64Data = arrayBufferToBase64(data);
      }

      const isPhoto =
        destination === 'photos' ||
        mimeType.startsWith('image/') ||
        /\.(png|jpg|jpeg|webp|svg)$/i.test(filename);
      const destType: 'documents' | 'photos' = isPhoto ? 'photos' : 'documents';

      // 2. Primary native storage route: Save directly to Android phone storage via MediaStore API
      try {
        const mediaStoreResult = await MediaStore.saveToMediaStore({
          filename,
          data: base64Data,
          mimeType,
          destination: destType,
        });

        if (mediaStoreResult && mediaStoreResult.success) {
          const fileUri = mediaStoreResult.uri;
          const locationNote = mediaStoreResult.savedLocation || (isPhoto ? 'Pictures/QuickReceipt' : 'Download/QuickReceipt');

          // Only open share sheet if explicitly requested
          if (openShareSheet && fileUri) {
            try {
              await Share.share({
                title: title || filename,
                text: `${title || filename} saved successfully.`,
                url: fileUri,
              });
            } catch (shareErr) {
              console.log('Share sheet dismissed:', shareErr);
            }
          }

          return {
            success: true,
            uri: fileUri,
            message: `Saved directly to ${locationNote}`,
          };
        }
      } catch (mediaStoreErr) {
        console.warn('Native MediaStore plugin call note, falling back to Filesystem:', mediaStoreErr);
      }

      // 3. Fallback: Save using Capacitor Filesystem to Public Documents / Downloads
      try {
        const permResult = await Filesystem.checkPermissions();
        if (permResult.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn('Filesystem permission note:', permErr);
      }

      let savedFile;
      try {
        savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true,
        });
      } catch (writeErr) {
        console.warn('Writing to Directory.Documents failed, trying Directory.Cache:', writeErr);
        savedFile = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });
      }

      const fileUri = savedFile.uri;

      // Only open share sheet if explicitly requested
      if (openShareSheet) {
        try {
          await Share.share({
            title: title || filename,
            text: `${title || filename} saved successfully.`,
            url: fileUri,
          });
        } catch (shareErr) {
          console.log('Native share sheet dismissed:', shareErr);
        }
      }

      return {
        success: true,
        uri: fileUri,
        message: `Saved to phone storage: ${filename}`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Native Android file save error, using web fallback:', errMsg);
      return fallbackWebDownload(data, filename, mimeType);
    }
  } else {
    // Web Browser fallback (direct file download without opening any share sheet)
    return fallbackWebDownload(data, filename, mimeType);
  }
}

/**
 * Convenience helper to export a jsPDF document directly to native phone storage (MediaStore) or web download.
 */
export async function saveJsPdf(
  doc: jsPDF,
  filename: string,
  title?: string,
  options?: { openShareSheet?: boolean }
): Promise<{ success: boolean; uri?: string; message: string }> {
  if (Capacitor.isNativePlatform()) {
    const arrayBuffer = doc.output('arraybuffer');
    return saveFile({
      data: arrayBuffer,
      filename,
      mimeType: 'application/pdf',
      title: title || filename,
      openShareSheet: options?.openShareSheet || false,
      destination: 'documents',
    });
  } else {
    doc.save(filename);
    return { success: true, message: `Downloaded ${filename}` };
  }
}

export interface ShareContentOptions {
  filename?: string;
  data?: Blob | ArrayBuffer | string;
  mimeType?: string;
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Explicitly triggers the native Android Share Sheet (via MediaStorePlugin or @capacitor/share),
 * or Web Share API on modern browsers.
 * ONLY triggered when the user explicitly taps a dedicated "Share" button.
 */
export async function shareContent(
  options: ShareContentOptions
): Promise<{ shared: boolean; method: string; message: string }> {
  const {
    filename,
    data,
    mimeType = 'application/octet-stream',
    title = 'Share',
    text = '',
    url = '',
    dialogTitle = 'Share via',
  } = options;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // 1. Process base64 file data if attached
    let base64Data = '';
    if (data) {
      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          base64Data = data.split(',')[1] || '';
        } else {
          base64Data = btoa(unescape(encodeURIComponent(data)));
        }
      } else if (data instanceof Blob) {
        base64Data = await blobToBase64(data);
      } else if (data instanceof ArrayBuffer) {
        base64Data = arrayBufferToBase64(data);
      }
    }

    // Direct Intent.ACTION_SEND chooser with FileProvider via native MediaStorePlugin
    try {
      const res = await MediaStore.share({
        filename: filename || (data ? 'document.pdf' : undefined),
        data: base64Data || undefined,
        mimeType,
        text,
        title,
        url,
      });
      if (res && res.success) {
        return { shared: true, method: 'android_native_share_sheet', message: 'Shared via Android Share Sheet' };
      }
    } catch (pluginErr) {
      console.warn('MediaStore native share note, trying @capacitor/share fallback:', pluginErr);
    }

    // Secondary fallback: @capacitor/share
    try {
      if (base64Data && filename) {
        const savedCache = await Filesystem.writeFile({
          path: filename,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true,
        });
        await Share.share({
          title,
          text: text || undefined,
          files: [savedCache.uri],
          dialogTitle: dialogTitle || title,
        });
      } else {
        await Share.share({
          title,
          text: text || undefined,
          url: url || undefined,
          dialogTitle: dialogTitle || title,
        });
      }
      return { shared: true, method: 'capacitor_share_sheet', message: 'Shared via Android Share Sheet' };
    } catch (shareErr: unknown) {
      const errMsg = shareErr instanceof Error ? shareErr.message : String(shareErr);
      if (errMsg.toLowerCase().includes('cancel')) {
        return { shared: false, method: 'cancelled', message: 'Share sheet dismissed' };
      }
      console.warn('Capacitor Share fallback note:', errMsg);
    }
  }

  // Web Browser flow
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      if (data && filename) {
        let blob: Blob;
        if (data instanceof Blob) {
          blob = data;
        } else if (data instanceof ArrayBuffer) {
          blob = new Blob([data], { type: mimeType });
        } else {
          blob = new Blob([data], { type: mimeType });
        }
        const file = new File([blob], filename, { type: mimeType });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title,
            text,
            files: [file],
          });
          return { shared: true, method: 'web_share_file', message: 'Shared via Share Sheet' };
        }
      }

      await navigator.share({
        title,
        text,
        url: url || undefined,
      });
      return { shared: true, method: 'web_share_text', message: 'Shared via Share Sheet' };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { shared: false, method: 'cancelled', message: 'Share sheet dismissed' };
      }
      console.warn('Web navigator.share note:', err);
    }
  }

  // Web fallback if navigator.share is unavailable
  if (url) {
    try {
      await navigator.clipboard.writeText(url);
      return { shared: true, method: 'clipboard_copy', message: 'Link copied to clipboard!' };
    } catch (copyErr) {
      console.warn('Clipboard write note:', copyErr);
    }
  }

  return { shared: false, method: 'fallback', message: 'Sharing not supported on this browser' };
}

/**
 * Web anchor tag fallback download.
 */
function fallbackWebDownload(data: Blob | ArrayBuffer | string, filename: string, mimeType: string) {
  try {
    let blob: Blob;
    if (data instanceof Blob) {
      blob = data;
    } else if (data instanceof ArrayBuffer) {
      blob = new Blob([data], { type: mimeType });
    } else if (typeof data === 'string') {
      if (data.startsWith('data:')) {
        const parts = data.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || mimeType;
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        blob = new Blob([u8arr], { type: mime });
      } else {
        blob = new Blob([data], { type: mimeType });
      }
    } else {
      blob = new Blob([data], { type: mimeType });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);

    return { success: true, message: `Downloaded ${filename}` };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Web download failed:', errMsg);
    return { success: false, message: `Download failed: ${errMsg}` };
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = reader.result as string;
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
