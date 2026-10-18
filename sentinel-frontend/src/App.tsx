import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import {
  Shield, LayoutDashboard, FlaskConical, ShieldAlert, Scale,
  Database, MessageSquareWarning, Info, Bell, Search, User,
  ChevronLeft, ChevronRight, Wifi, WifiOff, AlertCircle, X, CheckCircle
} from 'lucide-react';
import { healthApi } from './api/client';
import type { Toast } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import ContextLab from './pages/ContextLab';
import ModerationCenter from './pages/ModerationCenter';
import FairnessEvaluation from './pages/FairnessEvaluation';
import DatasetModelLab from './pages/DatasetModelLab';
import FeedbackAnalysis from './pages/FeedbackAnalysis';
import ProjectOverview from './pages/ProjectOverview';

// ─── Toast Context ────────────────────────────────────────────────────────────
interface ToastContextType {
  addToast: (message: string, type?: Toast['type']) => void;
}
export const ToastContext = createContext<ToastContextType>({ addToast: () => {} });
export const useToast = () => useContext(ToastContext);

// ─── Toast Component ─────────────────────────────────────────────────────────
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`slide-in-right flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm ${
            toast.type === 'success' ? 'bg-emerald-900/90 border border-emerald-700 text-emerald-200' :
            toast.type === 'error' ? 'bg-red-900/90 border border-red-700 text-red-200' :
            toast.type === 'warning' ? 'bg-amber-900/90 border border-amber-700 text-amber-200' :
            'bg-indigo-900/90 border border-indigo-700 text-indigo-200'
          }`}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{toast.message}</span>
          <button onClick={() => removeToast(toast.id)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/context-lab', label: 'Context Intelligence Lab', icon: FlaskConical },
  { path: '/moderation', label: 'Moderator Command Center', icon: ShieldAlert },
  { path: '/fairness', label: 'Fairness & Evaluation', icon: Scale },
  { path: '/dataset-lab', label: 'Dataset & Model Lab', icon: Database },
  { path: '/feedback', label: 'Feedback & Error Analysis', icon: MessageSquareWarning },
  { path: '/overview', label: 'Project Overview', icon: Info },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  modelOnline: boolean;
}

function Sidebar({ collapsed, setCollapsed, modelOnline }: SidebarProps) {
  const location = useLocation();

  return (
    <aside
      className={`fixed left-0 top-0 h-screen flex flex-col bg-navy-900 border-r border-indigo-900/40 transition-all duration-300 z-40 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
      style={{ background: 'linear-gradient(180deg, #070d1f 0%, #050a1a 100%)' }}
    >
      {/* Brand */}
      <div className="p-4 border-b border-indigo-900/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-glow-purple">
            <Shield className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-bold text-white glow-text-purple">Sentinel AI</div>
              <div className="text-xs text-slate-500">Content Moderation</div>
            </div>
          )}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white hover:bg-indigo-500 transition-colors z-50"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-widest px-2 mb-2 mt-1">Navigation</div>
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
              title={collapsed ? item.label : undefined}
              className={isActive ? 'nav-item-active' : 'nav-item'}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Brand Card matching exact reference design */}
      <div className="p-3 border-t border-indigo-900/40">
        {!collapsed && (
          <div className="relative rounded-2xl overflow-hidden p-4 text-center border border-indigo-500/30 bg-gradient-to-b from-[#13113d] via-[#0d1542] to-[#080d24] shadow-glow-purple">
            {/* Glowing Shield with Checkmark */}
            <div className="relative mx-auto w-14 h-14 mb-3 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md animate-pulse" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 p-0.5 shadow-lg">
                <div className="w-full h-full bg-[#0d1435] rounded-[10px] flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_#34d399]" />
                </div>
              </div>
            </div>

            <h4 className="text-xs font-bold text-white leading-tight">
              Safer Social Media.<br />
              <span className="text-slate-200">Healthier Conversations.</span>
            </h4>
            <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
              AI-powered moderation for a kinder and more inclusive online community.
            </p>

            {/* Glowing violet/blue decorative waves at bottom */}
            <div className="mt-3 -mx-4 -mb-4 h-8 overflow-hidden relative opacity-70">
              <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="w-full h-full">
                <path d="M0,25 C50,5 150,35 200,15 L200,40 L0,40 Z" fill="url(#brandGrad1)" />
                <path d="M0,15 C70,35 130,5 200,25 L200,40 L0,40 Z" fill="url(#brandGrad2)" opacity="0.6" />
                <defs>
                  <linearGradient id="brandGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                  <linearGradient id="brandGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Top Navigation ───────────────────────────────────────────────────────────
function TopNav({ collapsed, modelOnline, modelVersion }: {
  collapsed: boolean; modelOnline: boolean; modelVersion: string;
}) {
  const [search, setSearch] = useState('');
  const location = useLocation();

  const pageTitle = navItems.find(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )?.label || 'Dashboard';

  return (
    <header
      className={`fixed top-0 right-0 h-16 flex items-center justify-between px-6 border-b border-indigo-900/40 z-30 transition-all duration-300 ${
        collapsed ? 'left-16' : 'left-64'
      }`}
      style={{ background: 'rgba(5,10,26,0.92)', backdropFilter: 'blur(16px)' }}
    >
      {/* Global Search with (Ctrl + K) */}
      <div className="relative flex-1 max-w-md hidden md:block">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search comments, users, or IDs...    (Ctrl + K)"
          className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-navy-800/90 border border-indigo-900/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/70 focus:ring-1 focus:ring-purple-500/30 transition-all"
        />
      </div>

      <div className="flex items-center gap-4 ml-auto">
        {/* Model Status Pill matching image */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
            <span>Model Online</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">v{modelVersion}</span>
        </div>

        <div className="h-4 w-px bg-indigo-900/60 mx-1" />

        {/* Notifications with red 3 badge */}
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            3
          </span>
        </button>

        {/* User Avatar with S letter matching image */}
        <div className="flex items-center gap-2 cursor-pointer pl-1">
          <div className="w-8 h-8 rounded-full bg-indigo-600 border border-indigo-400 flex items-center justify-center text-white font-bold text-xs shadow-glow-purple">
            S
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function AppInner() {
  const [collapsed, setCollapsed] = useState(false);
  const [modelOnline, setModelOnline] = useState(false);
  const [modelVersion, setModelVersion] = useState('1.0.0');
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
        setModelVersion(resp.data.model_version);
      } catch {
        setModelOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      <div className="min-h-screen bg-navy-900 text-slate-200">
        <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} modelOnline={modelOnline} />
        <TopNav collapsed={collapsed} modelOnline={modelOnline} modelVersion={modelVersion} />

        <main
          className={`pt-14 transition-all duration-300 min-h-screen ${collapsed ? 'pl-16' : 'pl-64'}`}
        >
          <div className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/context-lab" element={<ContextLab />} />
              <Route path="/moderation" element={<ModerationCenter />} />
              <Route path="/fairness" element={<FairnessEvaluation />} />
              <Route path="/dataset-lab" element={<DatasetModelLab />} />
              <Route path="/feedback" element={<FeedbackAnalysis />} />
              <Route path="/overview" element={<ProjectOverview />} />
            </Routes>
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
      <AppInner />
    </BrowserRouter>
  );
}
