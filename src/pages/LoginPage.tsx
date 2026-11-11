import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Lock, Mail, User as UserIcon, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import { BrandMark } from '../components/BrandLogo';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, name, password });
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5 group mb-3">
            <BrandMark size={40} />
            <div className="text-left">
              <div className="text-lg font-black text-[#20212B] tracking-tight">CyberTech AI</div>
              <div className="text-[10px] text-[#858795] font-semibold uppercase tracking-wider">
                Trust &amp; Safety Platform
              </div>
            </div>
          </Link>
          <h1 className="text-xl font-bold text-[#20212B]">
            {mode === 'login' ? 'Sign in to Command Center' : 'Create Moderator Account'}
          </h1>
          <p className="text-xs text-[#858795] mt-1">
            Multilingual comment intelligence &amp; real-time ML moderation
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-[#E9EAF1] p-7 shadow-xs space-y-5">
          {/* Google Sign-In Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#20212B]">
                Secure Google Authentication
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                OAuth 2.0 Verified
              </span>
            </div>
            <GoogleLoginButton
              buttonText={mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
              onSuccess={() => navigate('/', { replace: true })}
              onError={(err) => setError(err)}
            />
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-[#E9EAF1] w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-[#858795] uppercase tracking-wider relative">
              Or continue with email
            </span>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#20212B] mb-1">Full Name</label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-[#858795] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#20212B] mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#858795] absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="moderator@cybertech.ai"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#20212B] mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#858795] absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#6C5CE7]/25 transition-all mt-2 cursor-pointer"
            >
              {loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Mode Switcher */}
          <div className="text-center text-xs text-[#858795]">
            {mode === 'login' ? (
              <span>
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('register');
                  }}
                  className="text-[#6C5CE7] hover:underline font-semibold cursor-pointer"
                >
                  Register here
                </button>
              </span>
            ) : (
              <span>
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('login');
                  }}
                  className="text-[#6C5CE7] hover:underline font-semibold cursor-pointer"
                >
                  Sign In
                </button>
              </span>
            )}
          </div>
        </div>

        {/* Back to landing */}
        <div className="mt-6 text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#858795] hover:text-[#6C5CE7] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Public Overview</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
