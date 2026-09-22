package com.quickreceipt.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaStorePlugin.class);
        super.onCreate(savedInstanceState);

        // Safe FirebaseApp initialization check
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
                Log.d(TAG, "FirebaseApp successfully initialized");
            }
        } catch (Throwable t) {
            Log.w(TAG, "FirebaseApp initialization check: " + t.getMessage());
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
