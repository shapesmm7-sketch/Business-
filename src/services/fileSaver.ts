import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { jsPDF } from 'jspdf';

export interface SaveFileOptions {
  /** Blob, ArrayBuffer, text string (JSON/CSV), or base64 Data URI */
  data: Blob | ArrayBuffer | string;
  filename: string;
  mimeType?: string;
  title?: string;
  /** Whether to open the Android native share sheet after saving to Downloads (default: true on native) */
  openShareSheet?: boolean;
}

/**
 * Saves and exports files securely on both Web and Native Android (via MediaStore / Public Downloads).
 */
export async function saveFile(options: SaveFileOptions): Promise<{ success: boolean; uri?: string; message: string }> {
  const { filename, mimeType = 'application/octet-stream', title = filename, openShareSheet = true } = options;
  const { data } = options;

  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // 1. Check and request storage permissions if required
      try {
        const permResult = await Filesystem.checkPermissions();
        if (permResult.publicStorage !== 'granted') {
          await Filesystem.requestPermissions();
        }
      } catch (permErr) {
        console.warn('Filesystem permission check/request note:', permErr);
      }

      // 2. Convert input data to clean base64 string
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

      // 3. Save file using Capacitor Filesystem to Directory.Documents (Android Public Documents / Storage)
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

      // 4. Optionally trigger native Android share sheet for instant opening or sharing
      if (openShareSheet) {
        try {
          await Share.share({
            title: title || filename,
            text: `${title || filename} saved successfully.`,
            url: fileUri,
          });
        } catch (shareErr) {
          // Share sheet dismissed by user or unavailable
          console.log('Native share sheet dismissed:', shareErr);
        }
      }

      return {
        success: true,
        uri: fileUri,
        message: `Saved to Downloads: ${filename}`,
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Native Android file save error, using web fallback:', errMsg);
      return fallbackWebDownload(data, filename, mimeType);
    }
  } else {
    // Web Browser fallback
    return fallbackWebDownload(data, filename, mimeType);
  }
}

/**
 * Convenience helper to export a jsPDF document to native Downloads or web file download.
 */
export async function saveJsPdf(doc: jsPDF, filename: string, title?: string): Promise<{ success: boolean; uri?: string; message: string }> {
  if (Capacitor.isNativePlatform()) {
    const arrayBuffer = doc.output('arraybuffer');
    return saveFile({
      data: arrayBuffer,
      filename,
      mimeType: 'application/pdf',
      title: title || filename,
    });
  } else {
    doc.save(filename);
    return { success: true, message: `Downloaded ${filename}` };
  }
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
