package com.brivu.myapp;

import android.app.Activity;
import android.os.CancellationSignal;
import android.util.Log;

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
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

@CapacitorPlugin(name = "BrivuAuthPlugin")
public class BrivuAuthPlugin extends Plugin {
    private static final String TAG = "BrivuAuthPlugin";

    private String resolveServerClientId(PluginCall call) {
        String fromCall = call.getString("serverClientId");
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
                credentialManager.getCredentialAsync(
                    activity,
                    request,
                    cancellationSignal,
                    ContextCompat.getMainExecutor(activity),
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override
                        public void onResult(@NonNull GetCredentialResponse result) {
                            handleCredentialResult(call, result);
                        }

                        @Override
                        public void onError(@NonNull GetCredentialException e) {
                            handleCredentialError(call, e);
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
        Activity activity = getActivity();
        if (activity == null) {
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            return;
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
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    }

                    @Override
                    public void onError(@NonNull ClearCredentialException e) {
                        Log.w(TAG, "clearCredentialStateAsync note: " + e.getMessage());
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    }
                }
            );
        } catch (Exception e) {
            Log.w(TAG, "signOut note: " + e.getMessage());
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        }
    }
}
