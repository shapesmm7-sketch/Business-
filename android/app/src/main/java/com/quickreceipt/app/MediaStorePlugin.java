package com.quickreceipt.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(
    name = "MediaStore",
    permissions = {
        @Permission(
            alias = "storage",
            strings = {
                Manifest.permission.READ_EXTERNAL_STORAGE,
                Manifest.permission.WRITE_EXTERNAL_STORAGE
            }
        )
    }
)
public class MediaStorePlugin extends Plugin {
    private static final String TAG = "MediaStorePlugin";
    private static final String STORAGE_ALIAS = "storage";

    /**
     * Checks whether storage permission is granted on this device.
     * On Android 10+ (API 29+), modern MediaStore does not require runtime storage permissions.
     * On older Android versions (API 28 and below) or when falling back from MediaStore,
     * WRITE_EXTERNAL_STORAGE is required to write directly into phone storage.
     */
    private boolean isStoragePermissionGranted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10-12
            return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED ||
                   getPermissionState(STORAGE_ALIAS) == PermissionState.GRANTED;
        }
        // Android 9 and older: strictly check WRITE_EXTERNAL_STORAGE
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.WRITE_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isStoragePermissionGranted());
        call.resolve(ret);
    }

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        if (isStoragePermissionGranted()) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
        } else {
            requestPermissionForAlias(STORAGE_ALIAS, call, "permissionStatusCallback");
        }
    }

    @PermissionCallback
    private void permissionStatusCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", isStoragePermissionGranted());
        call.resolve(ret);
    }

    private boolean isPhotoDestination(String filename, String mimeType, String destination) {
        String lowerName = filename != null ? filename.toLowerCase() : "";
        return "photos".equalsIgnoreCase(destination) ||
                (mimeType != null && mimeType.startsWith("image/")) ||
                lowerName.endsWith(".png") ||
                lowerName.endsWith(".jpg") ||
                lowerName.endsWith(".jpeg") ||
                lowerName.endsWith(".webp") ||
                lowerName.endsWith(".svg");
    }

    @PluginMethod
    public void saveToMediaStore(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String destination = call.getString("destination", "documents");

        if (filename == null || filename.trim().isEmpty()) {
            call.reject("Filename is required");
            return;
        }
        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("Data is required");
            return;
        }

        boolean isPhoto = isPhotoDestination(filename, mimeType, destination);

        // 1. Try modern MediaStore API on Android 10+ (API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                saveViaModernMediaStore(call, filename, base64Data, mimeType, isPhoto);
                return;
            } catch (Exception e) {
                Log.w(TAG, "Modern MediaStore API failed, falling back to direct storage with permission check: " + e.getMessage());
                // Fall through to legacy direct storage save with permission request
            }
        }

        // 2. Older Android versions (< API 29) or when MediaStore is not working:
        // Request storage permission if not yet granted
        if (!isStoragePermissionGranted()) {
            requestPermissionForAlias(STORAGE_ALIAS, call, "storageSavePermissionCallback");
            return;
        }

        // Permission already granted, save directly
        saveDirectToStorage(call, filename, base64Data, mimeType, isPhoto);
    }

    @PermissionCallback
    private void storageSavePermissionCallback(PluginCall call) {
        if (call == null) {
            return;
        }
        if (isStoragePermissionGranted()) {
            String filename = call.getString("filename");
            String base64Data = call.getString("data");
            String mimeType = call.getString("mimeType", "application/octet-stream");
            String destination = call.getString("destination", "documents");
            boolean isPhoto = isPhotoDestination(filename, mimeType, destination);

            saveDirectToStorage(call, filename, base64Data, mimeType, isPhoto);
        } else {
            call.reject("Storage permission was denied. Permission is required to save files directly to phone storage on this Android version.");
        }
    }

    private void saveViaModernMediaStore(PluginCall call, String filename, String base64Data, String mimeType, boolean isPhoto) throws Exception {
        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }
        base64Data = base64Data.replaceAll("\\s+", "");
        byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

        ContentResolver resolver = getContext().getContentResolver();
        ContentValues contentValues = new ContentValues();
        contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
        contentValues.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);

        Uri targetUri;
        String savedLocation;

        if (isPhoto) {
            contentValues.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/QuickReceipt");
            targetUri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues);
            savedLocation = "Pictures/QuickReceipt/" + filename;
        } else {
            contentValues.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/QuickReceipt");
            targetUri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, contentValues);
            savedLocation = "Download/QuickReceipt/" + filename;
        }

        if (targetUri == null) {
            throw new Exception("Unable to create MediaStore entry for " + filename);
        }

        OutputStream outputStream = resolver.openOutputStream(targetUri);
        if (outputStream == null) {
            throw new Exception("Unable to open output stream for " + filename);
        }
        outputStream.write(fileBytes);
        outputStream.flush();
        outputStream.close();

        // Finish writing: clear IS_PENDING
        contentValues.clear();
        contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
        resolver.update(targetUri, contentValues, null, null);

        JSObject result = new JSObject();
        result.put("success", true);
        result.put("uri", targetUri.toString());
        result.put("savedLocation", savedLocation);
        result.put("message", "File saved directly to phone storage: " + savedLocation);
        call.resolve(result);
    }

    private void saveDirectToStorage(PluginCall call, String filename, String base64Data, String mimeType, boolean isPhoto) {
        try {
            if (base64Data.contains(",")) {
                base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
            }
            base64Data = base64Data.replaceAll("\\s+", "");
            byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

            File targetDir;
            String savedLocation;
            if (isPhoto) {
                targetDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "QuickReceipt");
                savedLocation = "Pictures/QuickReceipt/" + filename;
            } else {
                targetDir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "QuickReceipt");
                savedLocation = "Download/QuickReceipt/" + filename;
            }

            if (!targetDir.exists()) {
                boolean created = targetDir.mkdirs();
                if (!created && !targetDir.exists()) {
                    targetDir = Environment.getExternalStoragePublicDirectory(isPhoto ? Environment.DIRECTORY_PICTURES : Environment.DIRECTORY_DOWNLOADS);
                    if (!targetDir.exists()) {
                        targetDir.mkdirs();
                    }
                    savedLocation = (isPhoto ? "Pictures/" : "Download/") + filename;
                }
            }

            File file = new File(targetDir, filename);
            FileOutputStream outputStream = new FileOutputStream(file);
            outputStream.write(fileBytes);
            outputStream.flush();
            outputStream.close();

            Uri targetUri = Uri.fromFile(file);

            // Notify media scanner so the file shows up immediately in Files / Gallery / Downloads
            android.media.MediaScannerConnection.scanFile(
                    getContext(),
                    new String[]{file.getAbsolutePath()},
                    new String[]{mimeType},
                    null
            );

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", targetUri.toString());
            result.put("savedLocation", savedLocation);
            result.put("message", "File saved directly to phone storage: " + savedLocation);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("Direct storage save failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "application/octet-stream");
        String text = call.getString("text", "");
        String title = call.getString("title", "Share");
        String url = call.getString("url", "");

        try {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);

            if (base64Data != null && !base64Data.trim().isEmpty() && filename != null && !filename.trim().isEmpty()) {
                if (base64Data.contains(",")) {
                    base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
                }
                base64Data = base64Data.replaceAll("\\s+", "");
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                File shareDir = new File(getContext().getCacheDir(), "shared");
                if (!shareDir.exists()) {
                    shareDir.mkdirs();
                }
                File shareFile = new File(shareDir, filename);
                FileOutputStream fos = new FileOutputStream(shareFile);
                fos.write(fileBytes);
                fos.flush();
                fos.close();

                Uri contentUri = FileProvider.getUriForFile(
                        getContext(),
                        getContext().getPackageName() + ".fileprovider",
                        shareFile
                );

                shareIntent.setType(mimeType);
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } else {
                shareIntent.setType("text/plain");
            }

            String combinedText = text != null ? text : "";
            if (url != null && !url.trim().isEmpty()) {
                if (!combinedText.isEmpty()) {
                    combinedText = combinedText + "\n" + url;
                } else {
                    combinedText = url;
                }
            }
            if (!combinedText.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, combinedText);
            }
            if (title != null && !title.trim().isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title);
            }

            Intent chooser = Intent.createChooser(shareIntent, title != null && !title.isEmpty() ? title : "Share via");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            getContext().startActivity(chooser);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("message", "Android share sheet opened");
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Share failed: " + e.getMessage(), e);
        }
    }
}
