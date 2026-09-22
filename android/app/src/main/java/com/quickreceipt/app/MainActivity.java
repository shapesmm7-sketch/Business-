package com.quickreceipt.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MediaStorePlugin.class);
        super.onCreate(savedInstanceState);

        // Initialize Android notification channel on launch
        try {
            BrivuFirebaseMessagingService.createNotificationChannel(this);
        } catch (Exception e) {
            Log.w(TAG, "Could not initialize notification channel", e);
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
        if (intent == null || intent.getExtras() == null) return;
        Bundle extras = intent.getExtras();
        if (extras.containsKey("notification_id") || extras.containsKey("google.message_id") || extras.containsKey("action_url")) {
            Log.d(TAG, "Notification tapped. Extras: " + extras.getString("notification_title"));
        }
    }
}
