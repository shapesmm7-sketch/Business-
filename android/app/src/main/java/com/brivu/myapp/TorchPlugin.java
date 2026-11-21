package com.brivu.myapp;

import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraAccessException;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Torch")
public class TorchPlugin extends Plugin {
    private static final String TAG = "TorchPlugin";

    private String findFlashCameraId(CameraManager cameraManager) {
        if (cameraManager == null) return null;
        try {
            String fallbackId = null;
            for (String id : cameraManager.getCameraIdList()) {
                CameraCharacteristics chars = cameraManager.getCameraCharacteristics(id);
                Boolean hasFlash = chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE);
                if (hasFlash != null && hasFlash) {
                    Integer lensFacing = chars.get(CameraCharacteristics.LENS_FACING);
                    if (lensFacing != null && lensFacing == CameraCharacteristics.LENS_FACING_BACK) {
                        return id;
                    }
                    if (fallbackId == null) {
                        fallbackId = id;
                    }
                }
            }
            return fallbackId;
        } catch (Exception e) {
            Log.w(TAG, "findFlashCameraId error: " + e.getMessage());
            return null;
        }
    }

    @PluginMethod
    public void hasTorch(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            Context ctx = getContext();
            boolean hasFeature = ctx.getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH);
            CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            String cameraId = findFlashCameraId(cm);
            ret.put("available", hasFeature && cameraId != null);
        } catch (Exception e) {
            ret.put("available", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void setTorch(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        JSObject ret = new JSObject();
        try {
            Context ctx = getContext();
            CameraManager cm = (CameraManager) ctx.getSystemService(Context.CAMERA_SERVICE);
            String cameraId = findFlashCameraId(cm);
            if (cm == null || cameraId == null) {
                ret.put("success", false);
                ret.put("reason", "NO_FLASH");
                ret.put("message", "No camera flash hardware found on this device.");
                call.resolve(ret);
                return;
            }
            cm.setTorchMode(cameraId, enabled);
            ret.put("success", true);
            ret.put("enabled", enabled);
            call.resolve(ret);
        } catch (CameraAccessException e) {
            Log.w(TAG, "setTorch CameraAccessException reason=" + e.getReason() + ": " + e.getMessage());
            ret.put("success", false);
            ret.put("reason", e.getReason() == CameraAccessException.CAMERA_IN_USE ? "CAMERA_IN_USE" : "CAMERA_ACCESS_ERROR");
            ret.put("message", e.getMessage());
            call.resolve(ret);
        } catch (Exception e) {
            Log.w(TAG, "setTorch exception: " + e.getMessage());
            ret.put("success", false);
            ret.put("reason", "UNKNOWN_ERROR");
            ret.put("message", e.getMessage());
            call.resolve(ret);
        }
    }
}
