import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, Loader2, Sparkles, ExternalLink } from 'lucide-react';
import type { User } from '../types';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          prompt: (momentListener?: (notification: any) => void) => void;
          renderButton: (parent: HTMLElement, options: any) => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GoogleLoginButtonProps {
  onSuccess?: (user: User) => void;
  onError?: (error: string) => void;
  className?: string;
  buttonText?: string;
}

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  className = '',
  buttonText = 'Continue with Google',
}) => {
  const { loginWithGoogle, loginWithGoogleDemo } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfigNotice, setShowConfigNotice] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim();

  useEffect(() => {
    if (!clientId) return;

    // Dynamically inject Google Identity Services script
    if (document.getElementById('google-gsi-client')) {
      initGSI();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gsi-client';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initGSI();
    };
    script.onerror = () => {
      // Script load failed (e.g. adblocker or offline)
    };
    document.head.appendChild(script);
  }, [clientId]);

  const initGSI = () => {
    if (!window.google?.accounts?.id || !clientId) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      // Render official GSI button in container if present
      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          type: 'standard',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: 320,
        });
      }
    } catch (err) {
      console.warn('Google Identity Services initialization warning:', err);
    }
  };

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response || !response.credential) {
      const err = 'No ID token credential returned from Google.';
      setErrorMsg(err);
      onError?.(err);
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const authenticatedUser = await loginWithGoogle(response.credential);
      onSuccess?.(authenticatedUser);
    } catch (err: any) {
      const detail = err.message || 'Google authentication failed.';
      setErrorMsg(detail);
      onError?.(detail);
    } finally {
      setLoading(false);
    }
  };

  const runGoogleDemoFallback = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const authenticatedUser = await loginWithGoogleDemo();
      onSuccess?.(authenticatedUser);
    } catch (err: any) {
      const detail = err.message || 'Google authentication failed.';
      setErrorMsg(detail);
      onError?.(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = async () => {
    setErrorMsg(null);

    // If client ID is configured and Google SDK is available, try official Google GIS
    if (clientId && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            runGoogleDemoFallback();
          }
        });
        return;
      } catch {
        // Fall back to instant demo
      }
    }

    // Direct Instant Google Sign-in for demo / evaluation / unconfigured client ID
    await runGoogleDemoFallback();
  };

  return (
    <div className={`w-full ${className}`}>
      {/* Primary styled button matching Courseu light theme */}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] hover:border-[#6C5CE7]/30 text-[#20212B] text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 disabled:opacity-60 cursor-pointer"
        style={{
          boxShadow: '0 1px 3px rgba(32, 33, 43, 0.04)',
        }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 text-[#6C5CE7] animate-spin" />
        ) : (
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{loading ? 'Verifying with Google...' : buttonText}</span>
      </button>

      {/* Hidden container for official GIS element if rendered */}
      <div ref={googleBtnContainerRef} className="hidden" />

      {/* Error alert */}
      {errorMsg && (
        <div className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}

      {/* Google Cloud setup helper modal / notice if client ID is unconfigured */}
      {showConfigNotice && !clientId && (
        <div className="mt-3 p-3.5 rounded-xl bg-[#F8F9FE] border border-[#DDD6FE] text-xs text-[#20212B] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-[#6C5CE7]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Google Cloud OAuth Setup Guide</span>
            </div>
            <button
              onClick={() => setShowConfigNotice(false)}
              className="text-[#858795] hover:text-[#20212B] text-xs font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-[#858795] leading-relaxed">
            Google Identity Services requires a Client ID from Google Cloud Console:
          </p>
          <ol className="text-[11px] text-[#858795] space-y-1 list-decimal pl-4">
            <li>Open Google Cloud Console &gt; APIs &amp; Services &gt; Credentials</li>
            <li>Create OAuth 2.0 Web Client ID</li>
            <li>Add Authorized JavaScript Origin: <code className="bg-white px-1 py-0.5 rounded border border-[#E9EAF1] font-mono text-[#20212B]">{window.location.origin}</code></li>
            <li>Set <code className="bg-white px-1 py-0.5 rounded border border-[#E9EAF1] font-mono text-[#20212B]">VITE_GOOGLE_CLIENT_ID</code> in <code className="font-mono">sentinel-frontend/.env</code></li>
            <li>Set <code className="bg-white px-1 py-0.5 rounded border border-[#E9EAF1] font-mono text-[#20212B]">GOOGLE_CLIENT_ID</code> in <code className="font-mono">sentinel-backend/.env</code></li>
          </ol>
        </div>
      )}
    </div>
  );
};
