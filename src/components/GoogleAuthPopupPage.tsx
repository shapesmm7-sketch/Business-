import React, { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';

export const GoogleAuthPopupPage: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

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
      setStatus('loading');
      if (window.opener) {
        // Send the real code back to Brivu main window
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code }, '*');
        
        setTimeout(() => {
          setStatus('success');
          setTimeout(() => {
            window.close();
          }, 1200);
        }, 1000);
      } else {
        setStatus('error');
        setErrorMsg('Opener window not found. Please try opening Google Sign-In again.');
      }
    } else {
      // If there is no code in the query params, show loading spinner
      setStatus('loading');
    }
  }, []);

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center space-y-4">
          <div className="text-red-500 font-extrabold text-lg">Google Sign-In Error</div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {errorMsg || 'Could not parse callback code. Make sure to complete the login on Google.'}
          </p>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center space-y-6">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-200/50 dark:border-emerald-800/50 shadow-xs">
            <CheckCircle2 className="w-6 h-6 animate-scaleUp" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Google Sign-In Successful</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Syncing with Brivu... Closing window</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center space-y-6">
        {/* Official Google colored spinner */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200/80 dark:border-slate-700" />
          <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-red-500 border-b-yellow-500 border-l-green-500 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Connecting Google Sign-In...</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Verifying secure OAuth credentials</p>
        </div>
      </div>
    </div>
  );
};
