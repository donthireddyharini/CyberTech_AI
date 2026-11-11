import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import {
  Shield, LayoutDashboard, FlaskConical, ShieldAlert, Scale,
  MessageSquareWarning, ChevronLeft, ChevronRight,
  CheckCircle, Globe, LogOut, Calendar, Check,
  Edit2, AlertCircle, X, Activity, Sparkles, ChevronDown,
  Radio, GitCompare, Menu, Mail, ShieldCheck
} from 'lucide-react';
import { healthApi } from './api/client';
import type { Toast, User } from './types';

// Auth & i18n
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider, useTranslation } from './i18n/I18nContext';
import { DashboardProvider } from './context/DashboardContext';
import { ContextLabProvider } from './context/ContextLabContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';

// Pages
import Dashboard from './pages/Dashboard';
import SocialMediaIngestion from './pages/SocialMediaIngestion';
import ContextLab from './pages/ContextLab';
import CompareContext from './pages/CompareContext';
import ModerationCenter from './pages/ModerationCenter';
import FairnessEvaluation from './pages/FairnessEvaluation';
import FeedbackAnalysis from './pages/FeedbackAnalysis';

// Helper to ensure no "moderator" or "administrator" role labels appear as user display names
function getCleanUserDisplayName(user: User | null): string {
  if (!user) return 'Account User';
  const legacyRoleNames = [
    'lead administrator',
    'administrator',
    'safety moderator',
    'demo moderator',
    'moderator',
    'faculty evaluator',
    'officer',
    'admin',
  ];
  const rawName = (user.name || '').trim();
  if (rawName && !legacyRoleNames.includes(rawName.toLowerCase())) {
    return rawName;
  }
  const emailPrefix = (user.email || '').split('@')[0] || 'User';
  if (emailPrefix.toLowerCase() === 'donthireddyharini' || emailPrefix.toLowerCase() === 'admin') {
    return 'Donthireddy Harini';
  }
  return emailPrefix
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Toast Context ────────────────────────────────────────────────────────────
interface ToastContextType {
  addToast: (message: string, type?: Toast['type']) => void;
}
export const ToastContext = createContext<ToastContextType>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:bottom-5 sm:right-5 z-50 flex flex-col gap-2.5 sm:max-w-sm pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`slide-in-right pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl shadow-xl text-xs font-medium border bg-white/95 backdrop-blur-md ${
            toast.type === 'success' ? 'border-emerald-200 text-emerald-900 shadow-emerald-500/5' :
            toast.type === 'error' ? 'border-rose-200 text-rose-900 shadow-rose-500/5' :
            toast.type === 'warning' ? 'border-amber-200 text-amber-900 shadow-amber-500/5' :
            'border-[#E9EAF1] text-[#20212B] shadow-purple-500/5'
          }`}
        >
          <div className="mt-0.5">
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> :
             toast.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" /> :
             toast.type === 'warning' ? <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /> :
             <Sparkles className="w-4 h-4 text-[#6C5CE7] shrink-0" />}
          </div>
          <span className="flex-1 leading-snug">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 p-0.5 rounded text-[#858795] hover:text-[#20212B] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Navigation Items (Unified Consistent Design System) ────────────────────────
const getNavItems = (t: (key: string, def?: string) => string) => [
  { path: '/', label: t('nav.dashboard', 'Dashboard'), icon: LayoutDashboard },
  { path: '/social-ingestion', label: t('nav.socialIngestion', 'Social Media Ingestion'), icon: Radio },
  { path: '/context-lab', label: t('nav.contextLab', 'Context Intelligence Lab'), icon: FlaskConical },
  { path: '/compare-context', label: t('nav.compareContext', 'Compare Context'), icon: GitCompare },
  { path: '/moderation', label: t('nav.moderation', 'Moderator Command Center'), icon: ShieldAlert },
  { path: '/fairness', label: t('nav.evaluations', 'Fairness & Evaluation'), icon: Scale },
  { path: '/feedback', label: t('nav.feedback', 'Feedback & Error Analysis'), icon: MessageSquareWarning },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
  modelOnline: boolean;
}

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const location = useLocation();
  const { t } = useTranslation();
  const navItems = getNavItems(t);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen flex flex-col border-r border-[#E9EAF1] transition-all duration-300 z-50 md:z-40 bg-white ${
          mobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'md:w-16' : 'md:w-64'}`}
        style={{
          boxShadow: '2px 0 12px rgba(32, 33, 43, 0.03)'
        }}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-[#E9EAF1] flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-[#6C5CE7] flex items-center justify-center text-white shadow-sm shadow-[#6C5CE7]/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            {(!collapsed || mobileOpen) && (
              <div className="truncate">
                <div className="text-sm font-black text-[#20212B] tracking-tight">
                  CyberTech AI
                </div>
                <div className="text-[10px] font-semibold text-[#858795] tracking-wide uppercase">Trust &amp; Safety Ops</div>
              </div>
            )}
          </div>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="md:hidden p-1.5 rounded-lg text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Collapse/Expand Toggle (Desktop Only) */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-[#E9EAF1] items-center justify-center text-[#858795] hover:text-[#6C5CE7] hover:border-[#6C5CE7]/40 transition-all z-50 shadow-md cursor-pointer"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Navigation Links */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {(!collapsed || mobileOpen) && (
            <div className="text-[10px] font-semibold text-[#858795] uppercase tracking-wider px-3 mb-2 mt-2">
              {t('nav.navigation', 'Workspace')}
            </div>
          )}
          {navItems.map(item => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                title={collapsed && !mobileOpen ? item.label : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[12.5px] transition-all duration-200 relative ${
                  collapsed && !mobileOpen ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-[#EEEAFE] text-[#6C5CE7] font-bold shadow-xs border border-[#DDD6FE]'
                    : 'text-[#20212B] hover:text-[#6C5CE7] hover:bg-[#EEEAFE]/50 font-semibold border border-transparent'
                }`}
              >
                <Icon className={`shrink-0 w-4.5 h-4.5 transition-colors ${
                  isActive ? 'text-[#6C5CE7]' : 'text-[#858795] group-hover:text-[#6C5CE7]'
                }`} />
                {(!collapsed || mobileOpen) && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                  </div>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Mission Card */}
        <div className="p-3 border-t border-[#E9EAF1]">
          {(!collapsed || mobileOpen) ? (
            <div className="rounded-2xl p-3.5 border border-[#E9EAF1] bg-[#F8F9FE] shadow-xs relative overflow-hidden">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">SOC Active</span>
              </div>
              <h4 className="text-xs font-bold text-[#20212B] leading-tight">
                {t('brand.title', 'Safer Social Media.')}
              </h4>
              <p className="text-[10px] text-[#858795] mt-1 leading-relaxed">
                Multilingual AI content intelligence for Indian languages.
              </p>
            </div>
          ) : (
            <div className="flex justify-center py-2" title="SOC Active • Real-Time Content Intelligence">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10B981]" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ─── Top Navigation with Breadcrumbs & Clean User Profile Popover ─────
function TopNav({
  collapsed,
  modelOnline,
  onOpenMobileMenu
}: {
  collapsed: boolean;
  modelOnline: boolean;
  onOpenMobileMenu: () => void;
}) {
  const { user, logout, updateProfile } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const displayName = getCleanUserDisplayName(user);
  const [editName, setEditName] = useState(displayName);
  const [savingProfile, setSavingProfile] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close profile popover on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
        setIsEditing(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const handleSaveProfile = async () => {
    if (!editName.trim()) return;
    setSavingProfile(true);
    try {
      await updateProfile({ name: editName.trim() });
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingProfile(false);
    }
  };

  const getPageContext = () => {
    const p = location.pathname;
    if (p === '/') return { section: 'Workspace', page: 'Operational Dashboard' };
    if (p.startsWith('/social-ingestion')) return { section: 'Workspace', page: 'Social Media Ingestion' };
    if (p.startsWith('/context-lab')) return { section: 'Workspace', page: 'Context Intelligence Lab' };
    if (p.startsWith('/compare-context')) return { section: 'Workspace', page: 'Compare Context' };
    if (p.startsWith('/moderation')) return { section: 'Workspace', page: 'Moderator Command Center' };
    if (p.startsWith('/fairness')) return { section: 'Workspace', page: 'Fairness & Evaluation' };
    if (p.startsWith('/feedback')) return { section: 'Workspace', page: 'Feedback & Error Analysis' };
    return { section: 'Workspace', page: 'Trust & Safety Operations' };
  };

  const pageCtx = getPageContext();

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'Active Account';

  const preferredLanguageLabel =
    user?.preferred_language === 'te'
      ? 'Telugu (తెలుగు)'
      : user?.preferred_language === 'hi'
      ? 'Hindi (हिन्दी)'
      : user?.preferred_language === 'kn'
      ? 'Kannada (ಕನ್ನಡ)'
      : 'English';

  return (
    <header
      className={`fixed top-0 right-0 left-0 h-16 flex items-center justify-between px-3.5 sm:px-6 border-b border-[#E9EAF1] z-30 transition-all duration-300 bg-white/95 backdrop-blur-md ${
        collapsed ? 'md:left-16' : 'md:left-64'
      }`}
      style={{
        boxShadow: '0 1px 3px rgba(32, 33, 43, 0.02)'
      }}
    >
      {/* Mobile Menu Trigger + Contextual Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 rounded-xl bg-[#F8F9FE] hover:bg-[#EEEAFE] text-[#20212B] border border-[#E9EAF1] transition-colors cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4 h-4 text-[#6C5CE7]" />
        </button>
        <div className="flex items-center gap-2 text-xs font-medium min-w-0">
          <span className="text-[#20212B] font-bold text-xs sm:text-sm truncate">{pageCtx.page}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3.5 ml-auto shrink-0">
        {/* Engine Status Pill */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold shadow-xs">
          <span className={`w-2 h-2 rounded-full ${modelOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-400'}`} />
          <span className="hidden sm:inline">{t('nav.modelOnline', 'Model Active')}</span>
        </div>

        <div className="h-4 w-px bg-[#E9EAF1] mx-0.5 hidden sm:block" />

        {/* Profile Popover Trigger — Displays ONLY Login Name & Email (No Moderator/Administrator labels) */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 p-1 sm:px-2 sm:py-1 rounded-full hover:bg-[#F5F6FA] transition-colors focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
              {initials}
            </div>
            <div className="hidden sm:block text-left text-xs max-w-[190px]">
              <div className="font-bold text-[#20212B] leading-tight flex items-center gap-1">
                <span className="truncate">{displayName}</span>
                <ChevronDown className="w-3 h-3 text-[#858795] shrink-0" />
              </div>
              <div className="text-[10px] text-[#858795] font-medium truncate">
                {user?.email || 'Active Session'}
              </div>
            </div>
          </button>

          {/* Profile Popover Menu */}
          {profileOpen && (
            <div className="absolute right-0 mt-3 w-72 sm:w-80 rounded-2xl bg-white border border-[#E9EAF1] shadow-2xl p-5 z-50 animate-in fade-in zoom-in-95 duration-150 text-[#20212B]">
              {/* Header: Name & Email Only */}
              <div className="flex items-center gap-3 pb-4 border-b border-[#E9EAF1]">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white font-black text-base shadow-sm shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full text-xs px-2 py-1 bg-white border border-[#6C5CE7] rounded-lg text-[#20212B] focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="p-1 rounded-lg bg-[#6C5CE7] hover:bg-[#5B4BC4] text-white shrink-0 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-1">
                      <div className="font-bold text-sm text-[#20212B] truncate">{displayName}</div>
                      <button
                        onClick={() => {
                          setEditName(displayName);
                          setIsEditing(true);
                        }}
                        className="text-[#858795] hover:text-[#6C5CE7] p-0.5 cursor-pointer shrink-0"
                        title="Edit Name"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="text-xs text-[#858795] truncate mt-0.5">{user?.email}</div>
                </div>
              </div>

              {/* Profile Details (Email, Joined, Language, Auth Method, Status) */}
              <div className="py-3 space-y-2.5 text-xs text-[#20212B] border-b border-[#E9EAF1]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[#858795] shrink-0">
                    <Mail className="w-3.5 h-3.5 text-[#6C5CE7]" />
                    <span>Email:</span>
                  </div>
                  <span className="font-semibold text-[#20212B] text-[11px] truncate">{user?.email}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#858795]">
                    <Calendar className="w-3.5 h-3.5 text-[#6C5CE7]" />
                    <span>{t('profile.joined', 'Joined')}:</span>
                  </div>
                  <span className="font-semibold text-[#20212B] text-[11px]">{memberSince}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#858795]">
                    <Globe className="w-3.5 h-3.5 text-[#6C5CE7]" />
                    <span>{t('profile.preferredLang', 'Preferred Language')}:</span>
                  </div>
                  <span className="font-semibold text-[#6C5CE7]">
                    {preferredLanguageLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#858795]">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sign-In Method:</span>
                  </div>
                  <span className="font-semibold text-[11px] text-[#20212B]">
                    {user?.auth_provider === 'google' ? 'Google Account' : 'Verified Email'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#858795]">
                    <Activity className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Account Status:</span>
                  </div>
                  <span className="font-semibold text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Active &amp; Verified
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <div className="pt-3">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-600 text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>{t('nav.logout', 'Sign Out')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

// ─── Main App Inner ───────────────────────────────────────────────────────────
function AppInner() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [modelOnline, setModelOnline] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await healthApi.modelStatus();
        setModelOnline(resp.data.status === 'ready');
      } catch {
        setModelOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex flex-col items-center justify-center gap-3 text-[#6C5CE7]">
        <div className="w-10 h-10 rounded-full border-2 border-[#E9EAF1] border-t-[#6C5CE7] animate-spin" />
        <span className="text-xs font-semibold text-[#858795] tracking-wider">INITIALIZING CYBERTECH AI...</span>
      </div>
    );
  }

  // Public & unauthenticated views (landing page and dedicated login)
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<LandingPage />} />
      </Routes>
    );
  }

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="min-h-screen bg-[#F5F6FA] text-[#20212B] overflow-x-hidden">
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
          modelOnline={modelOnline}
        />
        <TopNav
          collapsed={collapsed}
          modelOnline={modelOnline}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main
          className={`pt-16 transition-all duration-300 min-h-screen pl-0 ${
            collapsed ? 'md:pl-16' : 'md:pl-64'
          } bg-[#F5F6FA] max-w-full overflow-x-hidden`}
        >
          <div className="p-3 sm:p-6 md:p-8 max-w-[1700px] mx-auto w-full min-w-0">
            <div key={location.pathname} className="page-enter">
              <Routes location={location}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/social-ingestion" element={<SocialMediaIngestion />} />
                <Route path="/context-lab" element={<ContextLab />} />
                <Route path="/compare-context" element={<CompareContext />} />
                <Route path="/moderation" element={<ModerationCenter />} />
                <Route path="/fairness" element={<FairnessEvaluation />} />
                <Route path="/feedback" element={<FeedbackAnalysis />} />
                <Route path="/login" element={<Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </div>
        </main>

        <ToastContainer toasts={toasts} removeToast={removeToast} />
      </div>
    </ToastContext.Provider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
        <AuthProvider>
          <DashboardProvider>
            <ContextLabProvider>
              <AppInner />
            </ContextLabProvider>
          </DashboardProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
