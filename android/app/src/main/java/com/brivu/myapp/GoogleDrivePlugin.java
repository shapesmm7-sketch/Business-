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
import com.google.android.gms.auth.api.identity.AuthorizationClient;
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.tasks.Task;

import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "GoogleDrivePlugin")
public class GoogleDrivePlugin extends Plugin {
    private static final String TAG = "GoogleDrivePlugin";
    private static final String SCOPE_FILE = "https://www.googleapis.com/auth/drive.file";
    private static final String OAUTH_SCOPES_STRING = "oauth2:" + SCOPE_FILE + " https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile";

    private GoogleSignInClient googleSignInClient;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static final String WEB_CLIENT_ID = "678983214298-hdd6pm80q4kdsvb7roti9rhu9260v75g.apps.googleusercontent.com";

    private GoogleSignInClient getClient() {
        if (googleSignInClient == null) {
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                .requestEmail()
                .requestIdToken(WEB_CLIENT_ID)
                .build();
            googleSignInClient = GoogleSignIn.getClient(getActivity(), gso);
        }
        return googleSignInClient;
    }

    @PluginMethod
    public void connectGoogleDrive(PluginCall call) {
        try {
            Log.i(TAG, "Launching Google Account Chooser interface...");
            GoogleSignInClient client = getClient();
            Intent signInIntent = client.getSignInIntent();
            startActivityForResult(call, signInIntent, "handleSignInResult");
        } catch (Exception e) {
            Log.e(TAG, "Error launching Google Account Chooser", e);
            call.reject("Failed to open Google account chooser: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void handleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        int resultCode = result.getResultCode();
        Intent data = result.getData();
        Log.i(TAG, "Google Account Chooser activity callback returned with resultCode: " + resultCode);

        // 1. Try parsing Google Identity Services (GIS) AuthorizationResult from intent data
        if (data != null) {
            try {
                AuthorizationResult authorizationResult = Identity.getAuthorizationClient(getActivity())
                    .getAuthorizationResultFromIntent(data);
                if (authorizationResult != null) {
                    if (authorizationResult.hasResolution()) {
                        Log.i(TAG, "AuthorizationResult contains pending resolution");
                        if (authorizationResult.getPendingIntent() != null) {
                            try {
                                getActivity().startIntentSenderForResult(
                                    authorizationResult.getPendingIntent().getIntentSender(),
                                    1001,
                                    null,
                                    0,
                                    0,
                                    0
                                );
                                return;
                            } catch (Exception ex) {
                                Log.e(TAG, "Failed launching resolution IntentSender", ex);
                            }
                        }
                    } else {
                        String accessToken = authorizationResult.getAccessToken();
                        if (accessToken != null && !accessToken.isEmpty()) {
                            GoogleSignInAccount lastAcc = GoogleSignIn.getLastSignedInAccount(getContext());
                            String email = lastAcc != null && lastAcc.getEmail() != null ? lastAcc.getEmail() : null;
                            if (email != null) {
                                Log.i(TAG, "Successfully retrieved access token via Identity AuthorizationClient for: " + email);
                                resolveWithToken(
                                    call,
                                    email,
                                    lastAcc.getDisplayName() != null ? lastAcc.getDisplayName() : email,
                                    lastAcc.getPhotoUrl() != null ? lastAcc.getPhotoUrl().toString() : "",
                                    accessToken
                                );
                                return;
                            }
                        }
                    }
                }
            } catch (Exception e) {
                Log.d(TAG, "Intent data was not GIS AuthorizationResult: " + e.getMessage());
            }
        }

        // 2. Try parsing GoogleSignInAccount task from intent data
        if (data != null) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null && account.getEmail() != null) {
                    Log.i(TAG, "Successfully selected Google account from intent: " + account.getEmail());
                    fetchTokenAndResolve(call, account);
                    return;
                }
            } catch (ApiException e) {
                int statusCode = e.getStatusCode();
                String statusMsg = e.getMessage() != null ? e.getMessage() : "No status message";
                Log.e(TAG, "Google Account Chooser ApiException - Code: " + statusCode + ", Message: " + statusMsg, e);

                if (statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                    Log.w(TAG, "Google Sign-In returned status code 12501 SIGN_IN_CANCELLED.");
                    call.reject("Google Sign-In authorization error (Code 12501). Google Play Services refused scope authorization. Please verify OAuth Client ID and SHA-1 certificate in Google Cloud Console.");
                    return;
                } else if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) {
                    Log.e(TAG, "Google Sign-In DEVELOPER_ERROR (10): Package name (com.brivu.myapp) or SHA-1 key mismatch in Google Cloud Console.");
                    call.reject("Google OAuth configuration error (Code 10 DEVELOPER_ERROR). Package name com.brivu.myapp or SHA-1 key mismatch in Google Cloud Console.");
                    return;
                } else if (statusCode == GoogleSignInStatusCodes.SIGN_IN_FAILED) {
                    Log.e(TAG, "Google Sign-In failed (Code 12500 SIGN_IN_FAILED). Check Google Play Services and connection.");
                    call.reject("Google Sign-In error (Code 12500 SIGN_IN_FAILED). Please check network connection and Google Play Services.");
                    return;
                } else if (statusCode == GoogleSignInStatusCodes.SIGN_IN_REQUIRED) {
                    call.reject("Google Sign-In required (Code 4). Please re-select a valid Google account.");
                    return;
                } else {
                    call.reject("Google Play Services error (Code " + statusCode + "): " + statusMsg);
                    return;
                }
            } catch (Exception e) {
                Log.e(TAG, "Unexpected error parsing account intent", e);
                call.reject("Failed to process Google account selection: " + e.getMessage());
                return;
            }
        }

        // 3. Fallback check if user previously signed in or chooser updated session
        GoogleSignInAccount lastAccount = GoogleSignIn.getLastSignedInAccount(getContext());
        if (lastAccount != null && lastAccount.getEmail() != null) {
            Log.i(TAG, "Found last active signed-in account: " + lastAccount.getEmail());
            fetchTokenAndResolve(call, lastAccount);
            return;
        }

        // 4. If user dismissed the account chooser without selecting
        if (resultCode == Activity.RESULT_CANCELED) {
            Log.i(TAG, "User explicitly dismissed Google Account selection dialog.");
            call.reject("Google account chooser was dismissed by user");
            return;
        }

        call.reject("Google account selection completed without valid account credentials.");
    }

    @ActivityCallback
    private void handleConsentResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        int resultCode = result.getResultCode();
        if (resultCode != Activity.RESULT_OK) {
            Log.w(TAG, "Google Drive consent request denied or canceled with resultCode: " + resultCode);
            call.reject("Google Drive permission was denied by user");
            return;
        }

        GoogleSignInAccount account = GoogleSignIn.getLastSignedInAccount(getContext());
        if (account == null) {
            call.reject("No active Google account found after consent prompt");
            return;
        }

        Log.i(TAG, "User granted consent. Re-fetching OAuth token for: " + account.getEmail());
        fetchTokenAndResolve(call, account);
    }

    private void fetchTokenAndResolve(PluginCall call, GoogleSignInAccount account) {
        executor.execute(() -> {
            try {
                String token = GoogleAuthUtil.getToken(getContext(), account.getAccount(), OAUTH_SCOPES_STRING);
                if (token != null && !token.isEmpty()) {
                    Log.i(TAG, "Successfully retrieved Google Drive OAuth access token for: " + account.getEmail());
                    resolveWithToken(
                        call,
                        account.getEmail(),
                        account.getDisplayName() != null ? account.getDisplayName() : account.getEmail(),
                        account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "",
                        token
                    );
                } else {
                    Log.e(TAG, "GoogleAuthUtil returned an empty access token for: " + account.getEmail());
                    call.reject("Google authorization returned an empty access token");
                }
            } catch (UserRecoverableAuthException ure) {
                Log.i(TAG, "User consent needed for Google Drive scope, launching consent intent...");
                getActivity().runOnUiThread(() -> {
                    try {
                        startActivityForResult(call, ure.getIntent(), "handleConsentResult");
                    } catch (Exception ex) {
                        Log.e(TAG, "Failed launching consent intent", ex);
                        call.reject("Failed to request Drive permissions: " + ex.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed retrieving Google Drive OAuth token for " + account.getEmail(), e);
                if (e instanceof ApiException) {
                    ApiException apiEx = (ApiException) e;
                    int statusCode = apiEx.getStatusCode();
                    String statusMsg = apiEx.getMessage() != null ? apiEx.getMessage() : "Google API Error";
                    if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) {
                        call.reject("Google OAuth setup error (Code 10 DEVELOPER_ERROR). Please register Android SHA-1 fingerprint in Google Cloud Console.");
                    } else {
                        call.reject("Google Drive token retrieval error (Code " + statusCode + "): " + statusMsg);
                    }
                } else {
                    call.reject("Failed to get Google Drive access token: " + e.getMessage());
                }
            }
        });
    }

    private void resolveWithToken(PluginCall call, String email, String displayName, String photoUrl, String accessToken) {
        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("connected", true);
        ret.put("email", email);
        ret.put("displayName", displayName);
        ret.put("photoUrl", photoUrl);
        ret.put("accessToken", accessToken);
        call.resolve(ret);
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
                    if (token != null && !token.isEmpty()) {
                        JSObject ret = new JSObject();
                        ret.put("connected", true);
                        ret.put("email", account.getEmail());
                        ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : account.getEmail());
                        ret.put("photoUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
                        ret.put("accessToken", token);
                        call.resolve(ret);
                    } else {
                        JSObject ret = new JSObject();
                        ret.put("connected", false);
                        call.resolve(ret);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "getConnectedAccount token check note: " + e.getMessage());
                    JSObject ret = new JSObject();
                    ret.put("connected", false);
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
                if (token != null && !token.isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("accessToken", token);
                    call.resolve(ret);
                } else {
                    call.reject("Retrieved empty access token");
                }
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

