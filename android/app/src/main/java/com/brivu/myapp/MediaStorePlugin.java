package com.brivu.myapp;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "MediaStore")
public class MediaStorePlugin extends Plugin {
    private static final String TAG = "MediaStorePlugin";

    @PluginMethod
    public void checkStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestStoragePermission(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void saveToMediaStore(PluginCall call) {
        String filename = call.getString("filename");
        String base64Data = call.getString("data");
        String mimeType = call.getString("mimeType", "image/png");
        String destination = call.getString("destination", "photos");

        if (filename == null || filename.isEmpty()) {
            call.reject("Filename is required");
            return;
        }
        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Base64 data is required");
            return;
        }

        // Strip data URI prefix if present (e.g. data:image/png;base64,)
        if (base64Data.contains(",")) {
            base64Data = base64Data.substring(base64Data.indexOf(",") + 1);
        }

        byte[] fileBytes;
        try {
            fileBytes = Base64.decode(base64Data, Base64.DEFAULT);
        } catch (Exception e) {
            Log.e(TAG, "Error decoding base64 data", e);
            call.reject("Invalid base64 data: " + e.getMessage());
            return;
        }

        boolean isPhoto = "photos".equalsIgnoreCase(destination) || mimeType.startsWith("image/");
        Context context = getContext();
        ContentResolver resolver = context.getContentResolver();

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+ (API 29+) Scoped Storage via MediaStore API
                ContentValues contentValues = new ContentValues();
                contentValues.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                contentValues.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);

                Uri collectionUri;
                String relativeFolder;

                if (isPhoto) {
                    collectionUri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    relativeFolder = Environment.DIRECTORY_PICTURES + "/Brivu";
                } else {
                    collectionUri = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                    relativeFolder = Environment.DIRECTORY_DOWNLOADS + "/Brivu";
                }

                contentValues.put(MediaStore.MediaColumns.RELATIVE_PATH, relativeFolder);
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 1);

                Uri itemUri = resolver.insert(collectionUri, contentValues);
                if (itemUri == null) {
                    call.reject("Failed to create MediaStore entry");
                    return;
                }

                try (OutputStream os = resolver.openOutputStream(itemUri)) {
                    if (os != null) {
                        os.write(fileBytes);
                        os.flush();
                    } else {
                        call.reject("Failed to open output stream for MediaStore item");
                        return;
                    }
                }

                contentValues.clear();
                contentValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(itemUri, contentValues, null, null);

                String locationNote = isPhoto ? "Pictures/Brivu" : "Downloads/Brivu";
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", itemUri.toString());
                ret.put("savedLocation", locationNote);
                ret.put("message", "Saved to " + locationNote);
                call.resolve(ret);

            } else {
                // Legacy Android (API < 29)
                File storageDir = isPhoto
                    ? new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Brivu")
                    : new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Brivu");

                if (!storageDir.exists()) {
                    storageDir.mkdirs();
                }

                File targetFile = new File(storageDir, filename);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                // Scan file so Gallery / Photo view instantly indexes it
                MediaScannerConnection.scanFile(context, new String[]{targetFile.getAbsolutePath()}, new String[]{mimeType}, null);

                String locationNote = isPhoto ? "Pictures/Brivu" : "Downloads/Brivu";
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("uri", Uri.fromFile(targetFile).toString());
                ret.put("savedLocation", locationNote);
                ret.put("message", "Saved to " + locationNote);
                call.resolve(ret);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error saving to MediaStore", e);
            call.reject("Error saving file to MediaStore: " + e.getMessage());
        }
    }
}
