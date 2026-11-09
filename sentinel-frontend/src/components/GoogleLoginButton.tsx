import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api/client';
import { AlertCircle, Loader2 } from 'lucide-react';
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

const DEFAULT_GOOGLE_CLIENT_ID =
  '883218263318-89148rbi3f69lmc28mrchja5vdhltp27.apps.googleusercontent.com';

export const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  className = '',
  buttonText = 'Continue with Google',
}) => {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gsiLoaded, setGsiLoaded] = useState(false);

  // Client ID is wired internally — no configuration UI shown to users
  const [clientId, setClientId] = useState<string>(() => {
    const envId = ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '').trim();
    return envId || DEFAULT_GOOGLE_CLIENT_ID;
  });

  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  // Retrieve client ID from backend if present, ensuring internal sync
  useEffect(() => {
    let isMounted = true;
    const fetchBackendConfig = async () => {
      try {
        const resp = await authApi.getOAuthConfig();
        if (resp.data?.client_id && isMounted) {
          setClientId(resp.data.client_id.trim());
        }
      } catch {
        // Backend offline or fallback to default client ID
      }
    };
    fetchBackendConfig();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCredentialResponse = useCallback(
    async (response: { credential?: string }) => {
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
        const detail =
          err.response?.data?.detail ||
          err.message ||
          'Google authentication failed. Please verify your Google account.';
        setErrorMsg(detail);
        onError?.(detail);
      } finally {
        setLoading(false);
      }
    },
    [loginWithGoogle, onSuccess, onError]
  );

  // Render Google Identity Services button
  const renderGoogleButton = useCallback(() => {
    if (!window.google?.accounts?.id || !clientId || !googleBtnContainerRef.current) {
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      googleBtnContainerRef.current.innerHTML = '';
      const containerWidth = googleBtnContainerRef.current.offsetWidth || 340;
      const buttonWidth = Math.min(380, Math.max(220, containerWidth));

      window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'rectangular',
        text: buttonText.toLowerCase().includes('sign up') ? 'signup_with' : 'continue_with',
        logo_alignment: 'left',
        width: buttonWidth,
      });
      setGsiLoaded(true);
    } catch (err) {
      console.warn('Google Identity Services button render error:', err);
    }
  }, [clientId, buttonText, handleCredentialResponse]);

  // Inject Google Identity Services script
  useEffect(() => {
    if (!clientId) return;

    if (window.google?.accounts?.id) {
      renderGoogleButton();
      return;
    }

    const scriptId = 'google-gsi-client';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', renderGoogleButton);
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      renderGoogleButton();
    };
    script.onerror = () => {
      console.warn('Google Identity Services script failed to load.');
    };
    document.head.appendChild(script);
  }, [clientId, renderGoogleButton]);

  const handleFallbackClick = () => {
    setErrorMsg(null);
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt();
      } catch (err) {
        console.warn('Google prompt error:', err);
      }
    } else {
      setErrorMsg('Connecting to Google Identity Services... Please ensure you are online.');
    }
  };

  return (
    <div className={`w-full ${className} space-y-2`}>
      {/* Official Google Identity Services Rendered Button */}
      <div
        ref={googleBtnContainerRef}
        className={`w-full flex items-center justify-center min-h-[44px] ${
          gsiLoaded ? 'block' : 'hidden'
        }`}
      />

      {/* Styled Fallback / Placeholder Button while GSI loads */}
      {!gsiLoaded && (
        <button
          type="button"
          onClick={handleFallbackClick}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] hover:border-[#6C5CE7]/40 text-[#20212B] text-xs font-semibold shadow-xs hover:shadow-sm transition-all duration-200 disabled:opacity-60 cursor-pointer"
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
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span className="flex-1">{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
