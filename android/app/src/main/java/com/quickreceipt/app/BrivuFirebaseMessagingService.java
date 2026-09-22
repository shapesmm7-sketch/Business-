package com.quickreceipt.app;

import android.app.ActivityManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * True Android Push Notification Service for Brivu
 * Handles FCM messages across Foreground, Background, and Killed/Closed states.
 * Guarantees system tray delivery with Android NotificationChannel and prevents duplicates.
 */
public class BrivuFirebaseMessagingService extends MessagingService {
    private static final String TAG = "BrivuFCMService";

    public static final String CHANNEL_ID = "brivu_notifications_channel";
    public static final String CHANNEL_NAME = "Brivu Notifications";
    public static final String CHANNEL_DESC = "Business receipts, sales, low stock alerts, and customer orders";

    private static final String PREFS_NAME = "brivu_fcm_prefs";
    private static final String KEY_FCM_TOKEN = "fcm_token";
    private static final String KEY_LAST_TOKEN_SYNC = "token_synced_at";

    // Deduplication cache for recent message IDs (max 50)
    private static final Set<String> processedMessageIds = Collections.synchronizedSet(new LinkedHashSet<String>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Boolean> eldest) {
            return size() > 50;
        }
    });

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel(this);
    }

    /**
     * Called whenever a new FCM token is generated or refreshed by Google.
     */
    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.d(TAG, "Firebase Cloud Messaging token updated: " + token);

        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(KEY_FCM_TOKEN, token)
                .putLong(KEY_LAST_TOKEN_SYNC, System.currentTimeMillis())
                .apply();
        } catch (Exception e) {
            Log.w(TAG, "Error saving FCM token locally", e);
        }
    }

    /**
     * Called when an FCM message is received.
     * Fires for:
     * - Data messages in all states (Foreground, Background, Killed/Swiped away)
     * - Notification messages in Foreground
     */
    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        // 1. Let Capacitor PushNotifications plugin handle in-app listeners
        try {
            super.onMessageReceived(remoteMessage);
        } catch (Exception e) {
            Log.w(TAG, "Error in super.onMessageReceived", e);
        }

        // 2. Check if user disabled notifications in system settings
        NotificationManagerCompat notificationManagerCompat = NotificationManagerCompat.from(this);
        if (!notificationManagerCompat.areNotificationsEnabled()) {
            Log.d(TAG, "Notifications are disabled by user in Android settings. Skipping.");
            return;
        }

        // 3. Deduplicate message by MessageId if present
        String messageId = remoteMessage.getMessageId();
        if (messageId != null && !messageId.isEmpty()) {
            if (processedMessageIds.contains(messageId)) {
                Log.d(TAG, "Duplicate FCM message detected, skipping: " + messageId);
                return;
            }
            processedMessageIds.add(messageId);
        }

        // 4. Parse title, body, and data payload
        String title = null;
        String body = null;
        String actionUrl = null;
        String alertType = "system";

        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            title = notification.getTitle();
            body = notification.getBody();
        }

        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            if (title == null || title.trim().isEmpty()) {
                title = data.get("title");
            }
            if (body == null || body.trim().isEmpty()) {
                body = data.get("body");
                if (body == null) body = data.get("message");
            }
            if (data.containsKey("actionUrl")) {
                actionUrl = data.get("actionUrl");
            } else if (data.containsKey("url")) {
                actionUrl = data.get("url");
            }
            if (data.containsKey("type")) {
                alertType = data.get("type");
            }
        }

        if (title == null || title.trim().isEmpty()) {
            title = "Brivu Alert";
        }
        if (body == null) {
            body = "";
        }

        // 5. If it's a notification payload delivered while backgrounded, Google Play Services
        // automatically created a system tray notification. We do not create a duplicate.
        // However, DATA-ONLY messages (which is standard for server/Firestore triggers)
        // or messages received while the app is closed/swiped away MUST be displayed explicitly!
        boolean isDataOnly = (notification == null);
        boolean isForeground = isAppInForeground(this);

        if (isDataOnly || !isForeground) {
            postSystemNotification(messageId, title, body, alertType, actionUrl, data);
        }
    }

    /**
     * Builds and posts the Android system tray notification.
     */
    private void postSystemNotification(
        String messageId,
        String title,
        String body,
        String alertType,
        String actionUrl,
        Map<String, String> data
    ) {
        createNotificationChannel(this);

        int notificationId = (messageId != null && !messageId.isEmpty())
            ? Math.abs(messageId.hashCode())
            : (int) (System.currentTimeMillis() % Integer.MAX_VALUE);

        // Prepare Intent to launch MainActivity when tapped
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("notification_id", messageId != null ? messageId : String.valueOf(notificationId));
        intent.putExtra("notification_title", title);
        intent.putExtra("notification_body", body);
        intent.putExtra("notification_type", alertType);
        if (actionUrl != null && !actionUrl.isEmpty()) {
            intent.putExtra("action_url", actionUrl);
        }
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra("data_" + entry.getKey(), entry.getValue());
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            notificationId,
            intent,
            flags
        );

        Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setSound(defaultSoundUri)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(pendingIntent)
            .setDefaults(Notification.DEFAULT_ALL);

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (notificationManager != null) {
            notificationManager.notify(notificationId, builder.build());
            Log.d(TAG, "System tray notification posted successfully with ID: " + notificationId);
        }
    }

    /**
     * Check if Brivu app process is in foreground.
     */
    private static boolean isAppInForeground(Context context) {
        try {
            ActivityManager activityManager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) return false;

            List<ActivityManager.RunningAppProcessInfo> appProcesses = activityManager.getRunningAppProcesses();
            if (appProcesses == null) return false;

            final String packageName = context.getPackageName();
            for (ActivityManager.RunningAppProcessInfo appProcess : appProcesses) {
                if (appProcess.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
                    && appProcess.processName.equals(packageName)) {
                    return true;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Error checking foreground state", e);
        }
        return false;
    }

    /**
     * Creates Notification Channel for Android 8.0+ (Oreo and higher).
     */
    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
            if (existing == null) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription(CHANNEL_DESC);
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#10B981")); // Emerald brand color
                channel.enableVibration(true);
                channel.setShowBadge(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                AudioAttributes audioAttributes = new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                    .build();
                channel.setSound(soundUri, audioAttributes);

                manager.createNotificationChannel(channel);
                Log.d(TAG, "Created Android Notification Channel: " + CHANNEL_ID);
            }
        }
    }
}
