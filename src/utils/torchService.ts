import { Capacitor, registerPlugin } from '@capacitor/core';
import { Html5Qrcode } from 'html5-qrcode';

interface TorchPluginInterface {
  hasTorch(): Promise<{ available: boolean }>;
  setTorch(options: { enabled: boolean }): Promise<{
    success: boolean;
    enabled?: boolean;
    reason?: string;
    message?: string;
  }>;
}

const TorchPlugin = registerPlugin<TorchPluginInterface>('Torch');

function getVideoTrack(containerId: string): MediaStreamTrack | null {
  if (typeof document === 'undefined') return null;
  const video = document.querySelector(`#${containerId} video`) as HTMLVideoElement | null;
  const stream = video?.srcObject as MediaStream | null;
  if (!stream) return null;
  const tracks = stream.getVideoTracks();
  return tracks.length > 0 ? tracks[0] : null;
}

function getTrackTorchCapable(scanner: Html5Qrcode | null, containerId: string): boolean | undefined {
  try {
    if (scanner && scanner.isScanning) {
      const caps = scanner.getRunningTrackCapabilities() as { torch?: boolean } | undefined;
      if (caps && typeof caps.torch === 'boolean') return caps.torch;
    }
  } catch {
    // ignore
  }
  try {
    const track = getVideoTrack(containerId);
    const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
    if (caps && typeof caps.torch === 'boolean') return caps.torch;
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Checks whether the current scanner track or native device exposes a torch/flashlight.
 */
export async function detectTorchAvailability(
  scanner: Html5Qrcode | null,
  containerId: string
): Promise<boolean> {
  if (getTrackTorchCapable(scanner, containerId)) {
    return true;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await TorchPlugin.hasTorch();
      if (res?.available) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

/**
 * Toggles the device flashlight/torch using WebRTC active track constraints first
 * (required when Chromium/WebView holds the camera stream), with direct MediaStreamTrack
 * and native Android CameraManager.setTorchMode fallbacks.
 */
export async function setScannerTorch(
  enabled: boolean,
  scanner: Html5Qrcode | null,
  containerId: string
): Promise<{ success: boolean; error?: string }> {
  const torchCapable = getTrackTorchCapable(scanner, containerId);

  // 1. Try Html5Qrcode active camera track constraints
  if (scanner && scanner.isScanning && torchCapable !== false) {
    try {
      await scanner.applyVideoConstraints({
        advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet],
      });
      if (torchCapable === true) {
        return { success: true };
      }
    } catch {
      // Fall through to direct track or native plugin
    }
  }

  // 2. Try direct <video> MediaStreamTrack constraints
  const track = getVideoTrack(containerId);
  if (track && typeof track.applyConstraints === 'function' && torchCapable !== false) {
    try {
      await track.applyConstraints({
        advanced: [{ torch: enabled } as unknown as MediaTrackConstraintSet],
      });
      if (torchCapable === true) {
        return { success: true };
      }
    } catch {
      // Fall through to native plugin
    }
  }

  // 3. Try native Capacitor Android CameraManager.setTorchMode
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await TorchPlugin.setTorch({ enabled });
      if (res?.success) {
        return { success: true };
      }
      // If native CameraManager reports CAMERA_IN_USE while track was live and applyConstraints succeeded above, treat as active
      if (res?.reason === 'CAMERA_IN_USE' && track) {
        return { success: true };
      }
      if (res?.reason === 'NO_FLASH') {
        return { success: false, error: 'This device does not have a camera flashlight.' };
      }
      return {
        success: false,
        error: 'Flashlight is unavailable on this camera.',
      };
    } catch {
      if (track) return { success: true };
      return { success: false, error: 'Could not toggle flashlight on this device.' };
    }
  }

  if (torchCapable === true || (track && torchCapable !== false)) {
    return { success: true };
  }

  return {
    success: false,
    error: 'Torch is not available on this browser camera.',
  };
}
