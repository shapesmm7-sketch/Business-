package com.quickreceipt.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            registerPlugin(MediaStorePlugin.class);
        } catch (Throwable t) {
            Log.w(TAG, "MediaStorePlugin registration note: " + t.getMessage());
        }

        super.onCreate(savedInstanceState);

        // Safe FirebaseApp initialization check
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                // First try initializing from google-services resources if available
                try {
                    FirebaseApp.initializeApp(this);
                    Log.d(TAG, "FirebaseApp initialized from resources");
                } catch (Throwable resErr) {
                    Log.d(TAG, "Resource-based FirebaseApp init note: " + resErr.getMessage());
                }

                // If still not initialized, initialize with explicit credentials from config so FCM never throws IllegalStateException
                if (FirebaseApp.getApps(this).isEmpty()) {
                    FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("1:578733074269:android:2d2bda7ed46ab4comquick")
                        .setApiKey("AIzaSyA_LinprTf-yqU29IwOoDkL7W96cdA2l5A")
                        .setProjectId("poised-rainfall-1sjh2")
                        .setGcmSenderId("578733074269")
                        .setStorageBucket("poised-rainfall-1sjh2.firebasestorage.app")
                        .build();
                    FirebaseApp.initializeApp(this, options);
                    Log.d(TAG, "FirebaseApp initialized with explicit fallback options");
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "FirebaseApp initialization handled safely: " + t.getMessage());
        }

        // Initialize Android notification channel on launch
        try {
            BrivuFirebaseMessagingService.createNotificationChannel(this);
        } catch (Throwable t) {
            Log.w(TAG, "Could not initialize notification channel", t);
        }

        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        try {
            if (intent == null || intent.getExtras() == null) return;
            Bundle extras = intent.getExtras();
            if (extras.containsKey("notification_id") || extras.containsKey("google.message_id") || extras.containsKey("action_url")) {
                Log.d(TAG, "Notification tapped. Extras present.");
            }
        } catch (Throwable t) {
            Log.w(TAG, "Error handling notification intent", t);
        }
    }
}
