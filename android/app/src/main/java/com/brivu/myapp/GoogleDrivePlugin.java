package com.brivu.myapp;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.google.android.gms.auth.GoogleAuthUtil;
import com.google.android.gms.auth.UserRecoverableAuthException;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GoogleDrivePlugin")
public class GoogleDrivePlugin extends Plugin {
    private static final String SCOPE_FILE = "https://www.googleapis.com/auth/drive.file";
    private static final String OAUTH_SCOPES_STRING = "oauth2:" + SCOPE_FILE + " https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

    private GoogleSignInClient googleSignInClient;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private GoogleSignInClient getClient() {
        if (googleSignInClient == null) {
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestScopes(new Scope(SCOPE_FILE))
                .build();
            googleSignInClient = GoogleSignIn.getClient(getActivity(), gso);
        }
        return googleSignInClient;
    }

    @PluginMethod
    public void connectGoogleDrive(PluginCall call) {
        try {
            GoogleSignInClient client = getClient();
            // Sign out first to ensure the Google Play Services account chooser bottom sheet always displays
            client.signOut().addOnCompleteListener(task -> {
                try {
                    Intent signInIntent = client.getSignInIntent();
                    startActivityForResult(call, signInIntent, "handleSignInResult");
                } catch (Exception ex) {
                    Log.e(TAG, "Error starting sign in intent", ex);
                    call.reject("Failed to open Google account chooser: " + ex.getMessage());
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "Error launching Google Account Chooser", e);
            call.reject("Failed to open Google account chooser: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            call.reject("Google account selection was canceled by user");
            return;
        }

        Intent data = result.getData();
        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);

        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account == null) {
                call.reject("No Google account selected");
                return;
            }

            fetchTokenAndResolve(call, account);
        } catch (ApiException e) {
            Log.e(TAG, "Google sign in failed code: " + e.getStatusCode(), e);
            call.reject("Google Account selection failed (code " + e.getStatusCode() + "): " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error parsing account", e);
            call.reject("Unexpected error: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleConsentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("Google Drive permission was not granted");
            return;
        }

        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
        if (account == null) {
            call.reject("No active Google account found after consent");
            return;
        }

        fetchTokenAndResolve(call, account);
    }

    private void fetchTokenAndResolve(PluginCall call, GoogleSignInAccount account) {
        executor.execute(() -> {
            try {
                String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), OAUTH_SCOPES_STRING);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("connected", true);
                ret.put("email", account.getEmail());
                ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : account.getEmail());
                ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
                ret.put("accessToken", token);
                call.resolve(ret);
            } catch (UserRecoverableAuthException ure) {
                Log.i(TAG, "User consent needed for Google Drive scopes, launching consent intent...");
                getActivity().runOnUiThread(() -> {
                    try {
                        startActivityForResult(call, ure.getIntent(), "handleConsentResult");
                    } catch (Exception ex) {
                        call.reject("Failed to request Drive permissions: " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed retrieving Google Drive OAuth token", e);
                // Return account details so user sees connection status, with error note
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("connected", false);
                ret.put("email", account.getEmail());
                ret.put("error", e.getMessage());
                call.reject("Failed to get Google Drive authorization token: " + e.getMessage(), e);
            }
        });
    }

    @PluginMethod
    public void getConnectedAccount(PluginCall call) {
        try {
            GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
            if (account == null) {
                JSObject ret = new JSObject();
                ret.put("connected", false);
                call.resolve(ret);
                return;
            }

            executor.execute(() -> {
                try {
                    String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), OAUTH_SCOPES_STRING);
                    JSObject ret = new JSObject();
                    ret.put("connected", true);
                    ret.put("email", account.getEmail());
                    ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : account.getEmail());
                    ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
                    ret.put("accessToken", token);
                    call.resolve(ret);
                } catch (Exception e) {
                    JSObject ret = new JSObject();
                    ret.put("connected", true);
                    ret.put("email", account.getEmail());
                    ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : account.getEmail());
                    ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
                    ret.put("tokenError", e.getMessage());
                    call.resolve(ret);
                }
            });
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("connected", false);
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getAccessToken(PluginCall call) {
        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
        if (account == null) {
            call.reject("No Google account currently signed in");
            return;
        }

        executor.execute(() -> {
            try {
                String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), OAUTH_SCOPES_STRING);
                JSObject ret = new JSObject();
                ret.put("accessToken", token);
                call.resolve(ret);
            } catch (UserRecoverableAuthException ure) {
                getActivity().runOnUiThread(() -> {
                    try {
                        startActivityForResult(call, ure.getIntent(), "handleConsentResult");
                    } catch (Exception ex) {
                        call.reject("Failed requesting token consent: " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                call.reject("Could not get access token: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void disconnectGoogleDrive(PluginCall call) {
        try {
            GoogleSignInClient client = getClient();
            client.signOut().addOnCompleteListener(task -> {
                client.revokeAccess().addOnCompleteListener(revokeTask -> {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("connected", false);
                    call.resolve(ret);
                });
            });
        } catch (Exception e) {
            Log.w(TAG, "Error disconnecting Google Drive: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("connected", false);
            call.resolve(ret);
        }
    }
}
