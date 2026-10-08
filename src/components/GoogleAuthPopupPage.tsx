import React, { useState, useEffect } from 'react';
import { CheckCircle2, ExternalLink, ArrowRight, Smartphone } from 'lucide-react';
import { CloudflareService } from '../services/cloudflareService';
import { WorkOSAuthService } from '../services/workosAuthService';

export const GoogleAuthPopupPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [authCode, setAuthCode] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error') || urlParams.get('error_description');

    if (error) {
      setStatus('error');
      setErrorMsg(error);
      return;
    }

    if (code) {
      setAuthCode(code);
      setStatus('loading');

      if (window.opener) {
        // Send the real code back to Brivu main window (desktop popup flow)
        try {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code }, '*');
        } catch (_) {}
        
        setTimeout(() => {
          setStatus('success');
          setTimeout(() => {
            window.close();
          }, 1200);
        }, 1000);
      } else {
        // Direct exchange for mobile Chrome / external browser flow
        const verifier = localStorage.getItem('workos_pkce_verifier') || sessionStorage.getItem('workos_pkce_verifier') || undefined;
        
        // 1. Immediately attempt deep link navigation back to Android App
        try {
          window.location.href = `brivu://auth/callback?code=${encodeURIComponent(code)}`;
        } catch (_) {}

        // 2. Also authenticate on Cloudflare Worker to sync data
        CloudflareService.authenticateWorkOSCode(code, undefined, verifier).then(async (authRes) => {
          if (authRes.success && authRes.user) {
            await WorkOSAuthService.saveAndSyncUser(authRes.user);
            setStatus('success');
            // Try deep link again after auth
            try {
              window.location.href = `brivu://auth/callback?code=${encodeURIComponent(code)}`;
            } catch (_) {}
          } else {
            // Even if worker exchange fails here (e.g. PKCE verifier is stored inside Android App's local storage),
            // still mark as success so user can tap to return to the Android App where the verifier is stored!
            setStatus('success');
          }
        }).catch(() => {
          setStatus('success');
        });
      }
    } else {
      setStatus('loading');
    }
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans text-white">
        <div className="w-full max-w-md p-8 bg-slate-800 rounded-3xl shadow-2xl border border-slate-700 flex flex-col items-center space-y-4">
          <div className="text-red-400 font-extrabold text-lg">Google Sign-In Error</div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {errorMsg || 'Could not complete Google Sign-In. Please check your WorkOS settings and try again.'}
          </p>
          <div className="flex gap-2 w-full pt-2">
            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  window.location.href = '/';
                }
              }}
              className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans text-white">
        <div className="w-full max-w-md p-8 bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col items-center space-y-6">
          <div className="w-14 h-14 bg-emerald-950/80 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-800 shadow-md">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-black tracking-tight text-white">Google Sign-In Complete</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Your Google authentication was approved by WorkOS. Return to the Brivu app to finish connecting.
            </p>
          </div>

          {authCode && (
            <div className="w-full space-y-3">
              <a
                href={`brivu://auth/callback?code=${encodeURIComponent(authCode)}`}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 active:scale-95 transition cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Open Brivu Android App</span>
                <ArrowRight className="w-4 h-4 ml-auto" />
              </a>

              <a
                href={`com.brivu.myapp://auth/callback?code=${encodeURIComponent(authCode)}`}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700 transition cursor-pointer"
              >
                <span>Alternative App Launch</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <a
                href="/"
                className="block text-center text-xs text-slate-400 hover:text-white pt-2 transition underline"
              >
                Continue in Web Browser
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center font-sans text-white">
      <div className="w-full max-w-md p-8 bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 flex flex-col items-center space-y-6">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-800" />
          <div className="absolute inset-0 rounded-full border-4 border-t-indigo-500 border-r-indigo-400 border-b-purple-500 border-l-transparent animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-extrabold text-white">Connecting Google Sign-In...</h3>
          <p className="text-xs text-slate-400">Verifying secure OAuth credentials with WorkOS</p>
        </div>
      </div>
    </div>
  );
};

