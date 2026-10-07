import React, { useState, useEffect } from 'react';
import { Mail, User as UserIcon, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const GoogleAuthPopupPage: React.FC = () => {
  const [step, setStep] = useState<'choose' | 'input-email' | 'input-name' | 'loading' | 'success'>('choose');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [oauthCode, setOauthCode] = useState<string | null>(null);

  // Parse query params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      setOauthCode(code);
      setStep('loading');
      
      // Dispatch real oauth success message to the parent iframe
      if (window.opener) {
        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', code }, '*');
        setTimeout(() => {
          setStep('success');
          setTimeout(() => {
            window.close();
          }, 1200);
        }, 1000);
      }
    }
  }, []);

  const mockAccounts = [
    { name: 'Alex Miller', email: 'alex.miller@gmail.com', avatar: 'AM' },
    { name: 'Sarah Connor', email: 'sarah.c@gmail.com', avatar: 'SC' },
    { name: 'Brivu Merchant', email: 'merchant.brivu@gmail.com', avatar: 'BM' },
  ];

  const handleAccountSelect = (selectedEmail: string, selectedName: string) => {
    setStep('loading');
    if (window.opener) {
      window.opener.postMessage({
        type: 'SIMULATED_GOOGLE_SIGNIN_SUCCESS',
        email: selectedEmail,
        name: selectedName,
      }, '*');
      
      setTimeout(() => {
        setStep('success');
        setTimeout(() => {
          window.close();
        }, 1200);
      }, 1000);
    } else {
      // Fallback if not inside a popup
      alert(`Simulated sign-in: ${selectedName} (${selectedEmail})`);
    }
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStep('input-name');
  };

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    handleAccountSelect(email.trim(), name.trim());
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center space-y-6">
          {/* Official Google colored spinner */}
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-4 border-slate-200/80 dark:border-slate-700" />
            <div className="absolute inset-0 rounded-full border-4 border-t-blue-500 border-r-red-500 border-b-yellow-500 border-l-green-500 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Connecting Google Account...</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Securely completing authentication</p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200/60 dark:border-slate-700/60 flex flex-col items-center space-y-6">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-950/50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-200/50 dark:border-emerald-800/50 shadow-xs">
            <CheckCircle2 className="w-6 h-6 animate-scaleUp" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Signed In Successfully</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">You can close this window now</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4 font-sans select-none">
      <div className="w-full max-w-[440px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-3xl p-8 sm:p-10 shadow-2xl flex flex-col">
        {/* Google Iconic Logo Header */}
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="flex items-center gap-0.5 text-xl font-bold tracking-tight">
            <span className="text-blue-500">G</span>
            <span className="text-red-500">o</span>
            <span className="text-yellow-500">o</span>
            <span className="text-blue-500">g</span>
            <span className="text-green-500">l</span>
            <span className="text-red-500">e</span>
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              {step === 'choose' ? 'Choose an account' : step === 'input-email' ? 'Sign in' : 'Confirm your name'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              to continue to <span className="font-extrabold text-indigo-600 dark:text-indigo-400">Brivu</span>
            </p>
          </div>
        </div>

        {/* STEP 1: CHOOSE MOCK ACCOUNT */}
        {step === 'choose' && (
          <div className="space-y-4">
            <div className="border border-slate-100 dark:border-slate-800/80 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/80">
              {mockAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => handleAccountSelect(acc.email, acc.name)}
                  className="w-full px-4 py-3.5 flex items-center gap-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 text-left transition cursor-pointer group"
                >
                  <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                    {acc.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {acc.email}
                    </div>
                  </div>
                </button>
              ))}

              <button
                type="button"
                onClick={() => setStep('input-email')}
                className="w-full px-4 py-4 flex items-center gap-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/60 text-left transition cursor-pointer"
              >
                <div className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                  <UserIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Use another account
                </span>
              </button>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed pt-2">
              To continue, Google will share your name, email address, language preference, and profile picture with Brivu.
            </p>
          </div>
        )}

        {/* STEP 2: ENTER EMAIL */}
        {step === 'input-email' && (
          <form onSubmit={handleEmailSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your-google-account@gmail.com"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Don't have a Google Account? You can enter any mock email to simulate Google registration instantly.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/15 flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <span>Next</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: ENTER NAME */}
        {step === 'input-name' && (
          <form onSubmit={handleNameSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sarah Connor"
                  className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  autoFocus
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserIcon className="w-4 h-4" />
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Enter your name to appear on your Google Profile synced to Cloud.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('input-email')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs shadow-md shadow-blue-500/15 flex items-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <span>Complete Sign In</span>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
