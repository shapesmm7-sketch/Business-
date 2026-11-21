package com.brivu.myapp;

import android.app.Activity;
import android.content.Intent;
import android.os.CancellationSignal;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.activity.result.ActivityResult;
import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "BrivuAuthPlugin")
public class BrivuAuthPlugin extends Plugin {
    private static final String TAG = "BrivuAuthPlugin";
    private static final long CREDENTIAL_MANAGER_TIMEOUT_MS = 30000L;

    private String resolveServerClientId(PluginCall call) {
        String fromCall = call != null ? call.getString("serverClientId") : null;
        if (fromCall != null && !fromCall.trim().isEmpty()) {
            return fromCall.trim();
        }
        try {
            String fromResources = getContext().getString(R.string.google_web_client_id);
            if (fromResources != null && !fromResources.trim().isEmpty()) {
                return fromResources.trim();
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private GoogleSignInClient buildGoogleSignInClient(Activity activity, String serverClientId) {
        GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(serverClientId)
            .requestEmail()
            .build();
        return GoogleSignIn.getClient(activity, gso);
    }

    @PluginMethod
    public void signInWithGoogle(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is not available for Google Sign-In.", "ACTIVITY_UNAVAILABLE");
            return;
        }

        String serverClientId = resolveServerClientId(call);
        if (serverClientId.isEmpty()) {
            call.reject(
                "Google Web Client ID is not configured. Configure your Web application OAuth 2.0 Client ID from Google Cloud project Brivu (97897075021).",
                "MISSING_WEB_CLIENT_ID"
            );
            return;
        }

        String nonce = call.getString("nonce");

        // Primary fast path: GoogleSignInClient opens the native account chooser and returns
        // the OpenID ID token directly via Play Services in ~1s without CredentialManager delays.
        try {
            GoogleSignInClient signInClient = buildGoogleSignInClient(activity, serverClientId);
            GoogleSignInAccount lastAccount = GoogleSignIn.getLastSignedInAccount(activity);
            if (lastAccount != null) {
                signInClient.signOut().addOnCompleteListener(activity, task -> {
                    try {
                        startActivityForResult(call, signInClient.getSignInIntent(), "handleGoogleSignInResult");
                    } catch (Exception launchErr) {
                        Log.w(TAG, "GoogleSignInClient launch after signOut failed, falling back to CredentialManager", launchErr);
                        launchCredentialManagerSignIn(call, serverClientId, nonce);
                    }
                });
            } else {
                startActivityForResult(call, signInClient.getSignInIntent(), "handleGoogleSignInResult");
            }
        } catch (Exception e) {
            Log.w(TAG, "GoogleSignInClient setup failed, falling back to CredentialManager", e);
            launchCredentialManagerSignIn(call, serverClientId, nonce);
        }
    }

    @ActivityCallback
    private void handleGoogleSignInResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        int resultCode = result.getResultCode();
        Intent data = result.getData();

        if (data != null) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null && account.getIdToken() != null && !account.getIdToken().trim().isEmpty()) {
                    JSObject ret = new JSObject();
                    ret.put("success", true);
                    ret.put("idToken", account.getIdToken());
                    ret.put("email", account.getEmail() != null ? account.getEmail() : "");
                    ret.put("displayName", account.getDisplayName() != null ? account.getDisplayName() : "");
                    ret.put("givenName", account.getGivenName() != null ? account.getGivenName() : "");
                    ret.put("familyName", account.getFamilyName() != null ? account.getFamilyName() : "");
                    ret.put("profilePictureUrl", account.getPhotoUrl() != null ? account.getPhotoUrl().toString() : "");
                    call.resolve(ret);
                    return;
                }
            } catch (ApiException e) {
                int statusCode = e.getStatusCode();
                if (resultCode == Activity.RESULT_CANCELED &&
                    (statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED || statusCode == CommonStatusCodes.CANCELED)) {
                    Log.i(TAG, "User cancelled Google account chooser.");
                    JSObject ret = new JSObject();
                    ret.put("success", false);
                    ret.put("cancelled", true);
                    ret.put("message", "Sign-in was cancelled.");
                    call.resolve(ret);
                    return;
                }
                Log.w(TAG, "GoogleSignInClient returned status " + statusCode + ", falling back to CredentialManager", e);
                launchCredentialManagerSignIn(call, resolveServerClientId(call), call.getString("nonce"));
                return;
            } catch (Exception e) {
                Log.w(TAG, "GoogleSignInClient unexpected error, falling back to CredentialManager", e);
                launchCredentialManagerSignIn(call, resolveServerClientId(call), call.getString("nonce"));
                return;
            }
        }

        if (resultCode == Activity.RESULT_CANCELED) {
            Log.i(TAG, "User cancelled Google account chooser.");
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            ret.put("message", "Sign-in was cancelled.");
            call.resolve(ret);
            return;
        }

        launchCredentialManagerSignIn(call, resolveServerClientId(call), call.getString("nonce"));
    }

    private void launchCredentialManagerSignIn(PluginCall call, String serverClientId, String nonce) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Android activity is not available for Google Sign-In.", "ACTIVITY_UNAVAILABLE");
            return;
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(activity);

            GetSignInWithGoogleOption.Builder optionBuilder = new GetSignInWithGoogleOption.Builder(serverClientId);
            if (nonce != null && !nonce.trim().isEmpty()) {
                optionBuilder.setNonce(nonce.trim());
            }

            GetCredentialRequest request = new GetCredentialRequest.Builder()
                .addCredentialOption(optionBuilder.build())
                .build();

            activity.runOnUiThread(() -> {
                CancellationSignal cancellationSignal = new CancellationSignal();
                AtomicBoolean settled = new AtomicBoolean(false);
                Handler timeoutHandler = new Handler(Looper.getMainLooper());
                Runnable timeoutRunnable = () -> {
                    if (settled.compareAndSet(false, true)) {
                        try {
                            cancellationSignal.cancel();
                        } catch (Exception ignored) {
                        }
                        call.reject(
                            "Google Sign-In timed out. Please check your internet connection and try again.",
                            "SIGN_IN_TIMEOUT"
                        );
                    }
                };
                timeoutHandler.postDelayed(timeoutRunnable, CREDENTIAL_MANAGER_TIMEOUT_MS);

                credentialManager.getCredentialAsync(
                    activity,
                    request,
                    cancellationSignal,
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(@NonNull GetCredentialResponse result) {
                            timeoutHandler.removeCallbacks(timeoutRunnable);
                            if (settled.compareAndSet(false, true)) {
                                handleCredentialResult(call, result);
                            }
                        }

                        @Override
                        public void onError(@NonNull GetCredentialException e) {
                            timeoutHandler.removeCallbacks(timeoutRunnable);
                            if (settled.compareAndSet(false, true)) {
                                handleCredentialError(call, e);
                            }
                        }
                    }
                );
            });
        } catch (Exception e) {
            Log.e(TAG, "Failed initializing Android Credential Manager Google Sign-In", e);
            call.reject("Could not start Google Sign-In: " + e.getMessage(), "INIT_FAILED", e);
        }
    }

    private void handleCredentialResult(PluginCall call, GetCredentialResponse result) {
        Credential credential = result.getCredential();
        if (credential instanceof CustomCredential &&
            GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
            try {
                GoogleIdTokenCredential googleCred = GoogleIdTokenCredential.createFrom(credential.getData());
                String idToken = googleCred.getIdToken();
                if (idToken == null || idToken.trim().isEmpty()) {
                    call.reject("Google returned an empty ID token.", "EMPTY_ID_TOKEN");
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("idToken", idToken);
                ret.put("email", googleCred.getId());
                ret.put("displayName", googleCred.getDisplayName() != null ? googleCred.getDisplayName() : "");
                ret.put("givenName", googleCred.getGivenName() != null ? googleCred.getGivenName() : "");
                ret.put("familyName", googleCred.getFamilyName() != null ? googleCred.getFamilyName() : "");
                ret.put("profilePictureUrl", googleCred.getProfilePictureUri() != null ? googleCred.getProfilePictureUri().toString() : "");
                call.resolve(ret);
            } catch (Exception e) {
                Log.e(TAG, "Failed parsing GoogleIdTokenCredential", e);
                call.reject("Invalid Google ID token credential received.", "TOKEN_PARSE_ERROR", e);
            }
        } else {
            Log.w(TAG, "Unexpected credential type returned: " + credential.getType());
            call.reject("Unsupported credential type returned by Android Credential Manager.", "UNEXPECTED_CREDENTIAL");
        }
    }

    private void handleCredentialError(PluginCall call, GetCredentialException e) {
        if (e instanceof GetCredentialCancellationException) {
            Log.i(TAG, "User cancelled Google account chooser.");
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("cancelled", true);
            ret.put("message", "Sign-in was cancelled.");
            call.resolve(ret);
            return;
        }

        if (e instanceof NoCredentialException) {
            Log.w(TAG, "No Google credential available: " + e.getMessage());
            call.reject(
                "No Google account available for sign-in on this device, or OAuth configuration (Web Client ID / SHA-1 fingerprint) does not match. Check device Google accounts and Google Cloud Console.",
                "NO_CREDENTIAL",
                e
            );
            return;
        }

        String msg = e.getMessage() != null ? e.getMessage() : "Google Sign-In failed.";
        Log.e(TAG, "Credential Manager error [" + e.getType() + "]: " + msg, e);
        call.reject("Google Sign-In failed: " + msg, e.getType(), e);
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        // Resolve immediately so UI sign-out has zero IPC delay
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);

        Activity activity = getActivity();
        if (activity == null) {
            return;
        }

        String serverClientId = resolveServerClientId(null);
        if (!serverClientId.isEmpty()) {
            try {
                buildGoogleSignInClient(activity, serverClientId).signOut();
            } catch (Exception e) {
                Log.w(TAG, "GoogleSignInClient background signOut note: " + e.getMessage());
            }
        }

        try {
            CredentialManager credentialManager = CredentialManager.create(activity);
            ClearCredentialStateRequest clearRequest = new ClearCredentialStateRequest();
            credentialManager.clearCredentialStateAsync(
                clearRequest,
                new CancellationSignal(),
                ContextCompat.getMainExecutor(activity),
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override
                    public void onResult(Void unused) {
                    }

                    @Override
                    public void onError(@NonNull ClearCredentialException e) {
                        Log.w(TAG, "clearCredentialStateAsync note: " + e.getMessage());
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "signOut note: " + e.getMessage());
        }
    }
}
