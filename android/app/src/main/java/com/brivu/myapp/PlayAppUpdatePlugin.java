package com.brivu.myapp;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.activity.ComponentActivity;
import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallException;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

@CapacitorPlugin(name = "PlayAppUpdatePlugin")
public class PlayAppUpdatePlugin extends Plugin {
    private static final String TAG = "PlayAppUpdatePlugin";
    private static final String EVENT_UPDATE_STATE = "updateStateChanged";

    private AppUpdateManager appUpdateManager;
    private ActivityResultLauncher<IntentSenderRequest> updateFlowLauncher;
    private PluginCall pendingUpdateCall;
    private boolean isInstallListenerRegistered = false;
    private int activeUpdateType = AppUpdateType.FLEXIBLE;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final InstallStateUpdatedListener installStateUpdatedListener = new InstallStateUpdatedListener() {
        @Override
        public void onStateUpdate(@NonNull InstallState state) {
            int status = state.installStatus();
            JSObject payload = new JSObject();
            payload.put("installStatus", status);
            payload.put("bytesDownloaded", state.bytesDownloaded());
            payload.put("totalBytesToDownload", state.totalBytesToDownload());
            payload.put("installErrorCode", state.installErrorCode());
            payload.put("downloaded", status == InstallStatus.DOWNLOADED);
            payload.put("downloading", status == InstallStatus.DOWNLOADING || status == InstallStatus.PENDING);
            payload.put("installing", status == InstallStatus.INSTALLING);
            payload.put("installed", status == InstallStatus.INSTALLED);
            payload.put("failed", status == InstallStatus.FAILED);
            payload.put("canceled", status == InstallStatus.CANCELED);

            Log.d(TAG, "InstallState update: status=" + status +
                ", bytes=" + state.bytesDownloaded() + "/" + state.totalBytesToDownload());

            notifyListeners(EVENT_UPDATE_STATE, payload);

            if (status == InstallStatus.INSTALLED || status == InstallStatus.FAILED || status == InstallStatus.CANCELED) {
                unregisterInstallListener();
            }
        }
    };

    @Override
    public void load() {
        super.load();
        appUpdateManager = AppUpdateManagerFactory.create(getContext().getApplicationContext());
        ensureUpdateFlowLauncher();
    }

    private synchronized void ensureUpdateFlowLauncher() {
        if (updateFlowLauncher != null) return;
        Activity activity = getActivity();
        if (activity instanceof ComponentActivity) {
            try {
                updateFlowLauncher = ((ComponentActivity) activity)
                    .getActivityResultRegistry()
                    .register(
                        "brivu_play_app_update",
                        new ActivityResultContracts.StartIntentSenderForResult(),
                        this::handleUpdateFlowResult
                    );
            } catch (Exception e) {
                Log.w(TAG, "Failed to register updateFlowLauncher: " + e.getMessage());
            }
        }
    }

    private AppUpdateManager getManager() {
        if (appUpdateManager == null) {
            appUpdateManager = AppUpdateManagerFactory.create(getContext().getApplicationContext());
        }
        return appUpdateManager;
    }

    private synchronized void registerInstallListener() {
        if (isInstallListenerRegistered) return;
        try {
            getManager().registerListener(installStateUpdatedListener);
            isInstallListenerRegistered = true;
        } catch (Exception e) {
            Log.w(TAG, "Failed to register InstallStateUpdatedListener: " + e.getMessage());
        }
    }

    private synchronized void unregisterInstallListener() {
        if (!isInstallListenerRegistered) return;
        try {
            getManager().unregisterListener(installStateUpdatedListener);
        } catch (Exception e) {
            Log.w(TAG, "Failed to unregister InstallStateUpdatedListener: " + e.getMessage());
        } finally {
            isInstallListenerRegistered = false;
        }
    }

    private void handleUpdateFlowResult(ActivityResult result) {
        int resultCode = result != null ? result.getResultCode() : Activity.RESULT_CANCELED;
        Log.i(TAG, "Google Play update flow returned resultCode=" + resultCode + ", activeType=" + activeUpdateType);

        boolean accepted = (resultCode == Activity.RESULT_OK);
        boolean cancelled = (resultCode == Activity.RESULT_CANCELED);
        boolean failed = (resultCode == com.google.android.play.core.install.model.ActivityResult.RESULT_IN_APP_UPDATE_FAILED);

        if (!accepted && activeUpdateType == AppUpdateType.FLEXIBLE) {
            unregisterInstallListener();
        }

        if (pendingUpdateCall != null) {
            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("resultCode", resultCode);
            ret.put("accepted", accepted);
            ret.put("cancelled", cancelled);
            ret.put("failed", failed);
            ret.put("updateType", activeUpdateType == AppUpdateType.IMMEDIATE ? "immediate" : "flexible");
            pendingUpdateCall.resolve(ret);
            pendingUpdateCall = null;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        try {
            getManager().getAppUpdateInfo().addOnSuccessListener(appUpdateInfo -> {
                int availability = appUpdateInfo.updateAvailability();
                int installStatus = appUpdateInfo.installStatus();

                if (installStatus == InstallStatus.DOWNLOADED) {
                    JSObject payload = new JSObject();
                    payload.put("installStatus", installStatus);
                    payload.put("downloaded", true);
                    payload.put("availableVersionCode", appUpdateInfo.availableVersionCode());
                    notifyListeners(EVENT_UPDATE_STATE, payload);
                }

                // If an immediate update was interrupted before completion, resume it automatically
                if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    JSObject payload = new JSObject();
                    payload.put("developerTriggeredUpdateInProgress", true);
                    payload.put("updateAvailability", availability);
                    payload.put("availableVersionCode", appUpdateInfo.availableVersionCode());
                    notifyListeners(EVENT_UPDATE_STATE, payload);

                    Activity activity = getActivity();
                    ensureUpdateFlowLauncher();
                    if (activity != null && !activity.isFinishing() && !activity.isDestroyed() && updateFlowLauncher != null) {
                        mainHandler.post(() -> {
                            try {
                                activeUpdateType = AppUpdateType.IMMEDIATE;
                                getManager().startUpdateFlowForResult(
                                    appUpdateInfo,
                                    updateFlowLauncher,
                                    AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build()
                                );
                            } catch (Exception e) {
                                Log.w(TAG, "Resume immediate update note: " + e.getMessage());
                            }
                        });
                    }
                }
            }).addOnFailureListener(e -> Log.d(TAG, "onResume update check note: " + e.getMessage()));
        } catch (Exception e) {
            Log.d(TAG, "onResume update check skipped: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        unregisterInstallListener();
        if (updateFlowLauncher != null) {
            try {
                updateFlowLauncher.unregister();
            } catch (Exception ignored) {
            }
            updateFlowLauncher = null;
        }
        mainHandler.removeCallbacksAndMessages(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getAppVersionInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String pkgName = getContext().getPackageName();
            PackageInfo pInfo = getContext().getPackageManager().getPackageInfo(pkgName, 0);
            long versionCode;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                versionCode = pInfo.getLongVersionCode();
            } else {
                versionCode = pInfo.versionCode;
            }
            ret.put("packageName", pkgName);
            ret.put("versionName", pInfo.versionName != null ? pInfo.versionName : "1.0.0");
            ret.put("versionCode", versionCode);
        } catch (PackageManager.NameNotFoundException e) {
            ret.put("packageName", getContext().getPackageName());
            ret.put("versionName", "1.8.0");
            ret.put("versionCode", 10);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        try {
            getManager().getAppUpdateInfo()
                .addOnSuccessListener(appUpdateInfo -> {
                    JSObject ret = buildUpdateInfoJson(appUpdateInfo);
                    ret.put("apiAvailable", true);
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> {
                    int errorCode = (e instanceof InstallException) ? ((InstallException) e).getErrorCode() : -1;
                    Log.d(TAG, "checkForUpdate note (code=" + errorCode + "): " + e.getMessage());
                    JSObject ret = new JSObject();
                    ret.put("apiAvailable", false);
                    ret.put("updateAvailable", false);
                    ret.put("developerTriggeredUpdateInProgress", false);
                    ret.put("errorCode", errorCode);
                    ret.put("error", e.getMessage() != null ? e.getMessage() : "Play Store In-App Update API unavailable");
                    call.resolve(ret);
                });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("apiAvailable", false);
            ret.put("updateAvailable", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void startUpdate(PluginCall call) {
        final String requestedType = call.getString("type", "flexible");
        Activity activity = getActivity();
        if (activity == null || activity.isFinishing() || activity.isDestroyed()) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("error", "Activity not available");
            call.resolve(ret);
            return;
        }

        ensureUpdateFlowLauncher();
        if (updateFlowLauncher == null) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("error", "ActivityResultLauncher unavailable");
            call.resolve(ret);
            return;
        }

        getManager().getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> {
                int availability = appUpdateInfo.updateAvailability();
                if (availability != UpdateAvailability.UPDATE_AVAILABLE &&
                    availability != UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    JSObject ret = buildUpdateInfoJson(appUpdateInfo);
                    ret.put("started", false);
                    ret.put("error", "No update available on Google Play");
                    call.resolve(ret);
                    return;
                }

                boolean immediateAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE);
                boolean flexibleAllowed = appUpdateInfo.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);

                int chosenType;
                if (availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS) {
                    chosenType = AppUpdateType.IMMEDIATE;
                } else if ("immediate".equalsIgnoreCase(requestedType) && immediateAllowed) {
                    chosenType = AppUpdateType.IMMEDIATE;
                } else if (flexibleAllowed) {
                    chosenType = AppUpdateType.FLEXIBLE;
                } else if (immediateAllowed) {
                    chosenType = AppUpdateType.IMMEDIATE;
                } else {
                    JSObject ret = buildUpdateInfoJson(appUpdateInfo);
                    ret.put("started", false);
                    ret.put("error", "Neither flexible nor immediate update flow is allowed for this release");
                    call.resolve(ret);
                    return;
                }

                final int finalUpdateType = chosenType;
                mainHandler.post(() -> {
                    Activity currentActivity = getActivity();
                    if (currentActivity == null || currentActivity.isFinishing() || currentActivity.isDestroyed()) {
                        JSObject ret = new JSObject();
                        ret.put("started", false);
                        ret.put("error", "Activity closed before starting update flow");
                        call.resolve(ret);
                        return;
                    }

                    if (pendingUpdateCall != null) {
                        JSObject superseded = new JSObject();
                        superseded.put("started", false);
                        superseded.put("cancelled", true);
                        superseded.put("error", "Superseded by newer update request");
                        pendingUpdateCall.resolve(superseded);
                    }

                    pendingUpdateCall = call;
                    activeUpdateType = finalUpdateType;

                    if (finalUpdateType == AppUpdateType.FLEXIBLE) {
                        registerInstallListener();
                    }

                    try {
                        boolean launched = getManager().startUpdateFlowForResult(
                            appUpdateInfo,
                            updateFlowLauncher,
                            AppUpdateOptions.newBuilder(finalUpdateType).build()
                        );
                        if (!launched && pendingUpdateCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("started", false);
                            ret.put("error", "Google Play could not launch the in-app update dialog");
                            pendingUpdateCall.resolve(ret);
                            pendingUpdateCall = null;
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "Error launching startUpdateFlowForResult", e);
                        if (finalUpdateType == AppUpdateType.FLEXIBLE) {
                            unregisterInstallListener();
                        }
                        if (pendingUpdateCall != null) {
                            JSObject ret = new JSObject();
                            ret.put("started", false);
                            ret.put("error", e.getMessage());
                            pendingUpdateCall.resolve(ret);
                            pendingUpdateCall = null;
                        }
                    }
                });
            })
            .addOnFailureListener(e -> {
                int errorCode = (e instanceof InstallException) ? ((InstallException) e).getErrorCode() : -1;
                JSObject ret = new JSObject();
                ret.put("started", false);
                ret.put("errorCode", errorCode);
                ret.put("error", e.getMessage() != null ? e.getMessage() : "Failed to start update");
                call.resolve(ret);
            });
    }

    @PluginMethod
    public void completeUpdate(PluginCall call) {
        try {
            getManager().completeUpdate()
                .addOnSuccessListener(unused -> {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    call.resolve(ret);
                })
                .addOnFailureListener(e -> {
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("error", e.getMessage());
                    call.resolve(ret);
                });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void openPlayStore(PluginCall call) {
        String pkg = getContext().getPackageName();
        try {
            Intent marketIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
            marketIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(marketIntent);
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (ActivityNotFoundException e) {
            try {
                Intent webIntent = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("https://play.google.com/store/apps/details?id=" + pkg)
                );
                webIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(webIntent);
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception ex) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", ex.getMessage());
                call.resolve(ret);
            }
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    private JSObject buildUpdateInfoJson(@NonNull AppUpdateInfo info) {
        JSObject ret = new JSObject();
        int availability = info.updateAvailability();
        int installStatus = info.installStatus();

        ret.put("updateAvailable", availability == UpdateAvailability.UPDATE_AVAILABLE);
        ret.put(
            "developerTriggeredUpdateInProgress",
            availability == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        );
        ret.put("updateAvailability", availability);
        ret.put("availableVersionCode", info.availableVersionCode());
        ret.put("installStatus", installStatus);
        ret.put("downloaded", installStatus == InstallStatus.DOWNLOADED);
        ret.put("updatePriority", info.updatePriority());

        Integer stalenessDays = info.clientVersionStalenessDays();
        if (stalenessDays != null) {
            ret.put("clientVersionStalenessDays", stalenessDays.intValue());
        } else {
            ret.put("clientVersionStalenessDays", JSONObjectNull());
        }

        ret.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
        ret.put("flexibleAllowed", info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE));
        ret.put("totalBytesToDownload", info.totalBytesToDownload());
        ret.put("bytesDownloaded", info.bytesDownloaded());
        ret.put("packageName", info.packageName());
        return ret;
    }

    @Nullable
    private Object JSONObjectNull() {
        return org.json.JSONObject.NULL;
    }
}
