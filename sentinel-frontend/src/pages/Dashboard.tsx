import { useState, useEffect } from 'react';
import {
  MessageSquare, Flag, Clock, AlertTriangle,
  TrendingUp, RefreshCw, CheckCircle, Eye, ChevronRight,
  Activity, Cpu, Zap, Scale
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { dashboardApi } from '../api/client';
import type { DashboardSummary, DistributionData, RecentActivity } from '../types';
import { useToast } from '../App';

// ─── Color Schemes ────────────────────────────────────────────────────────────
const SEVERITY_COLORS: Record<string, string> = {
  low: '#10b981', medium: '#f59e0b', high: '#ef4444', uncertain: '#6b7280'
};
const CATEGORY_COLORS: Record<string, string> = {
  hate_speech: '#f43f5e', harassment: '#f97316', cyberbullying: '#8b5cf6', legitimate: '#10b981'
};
const LANG_COLORS = ['#6366f1', '#22d3ee', '#a855f7', '#f59e0b', '#10b981', '#f43f5e'];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

// ─── Metric Card ─────────────────────────────────────────────────────────────
interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: string;
  loading?: boolean;
  subtitle?: string;
}

function MetricCard({ title, value, icon: Icon, color, trend, loading, subtitle }: MetricCardProps) {
  return (
    <div className="card-glow p-5 hover:border-indigo-600/40 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center`}
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <TrendingUp className="w-3 h-3" />{trend}
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-7 w-24 mb-1" />
          <Skeleton className="h-3 w-32" />
        </>
      ) : (
        <>
          <div className="text-2xl font-bold text-white mb-0.5" style={{ textShadow: `0 0 20px ${color}40` }}>
            {value.toLocaleString()}
          </div>
          <div className="text-xs text-slate-400">{title}</div>
          {subtitle && <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>}
        </>
      )}
    </div>
  );
}

// ─── Donut Chart Panel matching reference image ──────────────────────────────
function DonutPanel({
  title, icon: Icon, centerValue, centerLabel, data, colors, loading, noDataMessage
}: {
  title: string;
  icon?: React.ElementType;
  centerValue?: string;
  centerLabel?: string;
  data: { name: string; value: number }[];
  colors: Record<string, string> | string[];
  loading?: boolean;
  noDataMessage?: string;
}) {
  const total = data.reduce((a, b) => a + b.value, 0);

  const getColor = (name: string, index: number) => {
    if (Array.isArray(colors)) return colors[index % colors.length];
    return colors[name] || '#6366f1';
  };

  return (
    <div className="card-glow p-5">
      <div className="flex items-center gap-2 mb-3">
        {Icon && <Icon className="w-4 h-4 text-purple-400" />}
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Skeleton className="w-32 h-32 rounded-full" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-slate-500">
          <Activity className="w-8 h-8 mb-2 opacity-30" />
          <span className="text-xs">{noDataMessage || 'No data available'}</span>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {/* Donut Chart with Center Text */}
          <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={74}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="#080f24"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={getColor(entry.name, index)} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#0d1633', border: '1px solid #312e81', borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-white tracking-tight">
                {centerValue || `${(total > 1000 ? (total / 1000).toFixed(1) + 'K' : total)}`}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {centerLabel || 'Flagged'}
              </span>
            </div>
          </div>

          {/* Right-aligned clean legend with percentages matching reference image */}
          <div className="space-y-2 flex-1 pl-2 text-xs">
            {data.map((item, idx) => {
              const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
              const color = getColor(item.name, idx);
              return (
                <div key={item.name} className="flex items-center justify-between text-slate-300">
                  <div className="flex items-center gap-2 truncate pr-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="capitalize text-slate-300 text-[11px] truncate">
                      {item.name.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] shrink-0 font-medium">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Severity Badge ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const cls = {
    low: 'severity-low', medium: 'severity-medium',
    high: 'severity-high', uncertain: 'severity-uncertain'
  }[severity] || 'severity-uncertain';
  return <span className={`badge ${cls}`}>{severity}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = {
    pending: 'status-pending', reviewed: 'status-reviewed',
    escalated: 'status-escalated', dismissed: 'status-dismissed', approved: 'status-reviewed'
  }[status] || 'status-reviewed';
  return <span className={`badge ${cls}`}>{status}</span>;
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [distributions, setDistributions] = useState<DistributionData | null>(null);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [queue, setQueue] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryResp, distResp, recentResp, queueResp] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.distributions(),
        dashboardApi.recent(8),
        dashboardApi.reviewQueue(5),
      ]);
      setSummary(summaryResp.data);
      setDistributions(distResp.data);
      setRecent(recentResp.data);
      setQueue(queueResp.data);
    } catch (err: any) {
      setError(err.message);
      addToast('Failed to load dashboard data. Is the backend running?', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toChartData = (obj: Record<string, number> | undefined) =>
    Object.entries(obj || {}).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6 max-w-screen-2xl">
      {/* Welcome Hero matching reference image: 'Welcome back, Sunny!' */}
      <div className="relative rounded-2xl overflow-hidden p-6"
        style={{
          background: 'linear-gradient(135deg, #100a30 0%, #070e2b 50%, #050a1d 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 0 50px rgba(99,102,241,0.12)',
        }}>
        {/* Subtle glowing globe background matching reference */}
        <div className="absolute right-12 top-1/2 -translate-y-1/2 opacity-30 pointer-events-none">
          <svg width="240" height="240" viewBox="0 0 240 240">
            <defs>
              <radialGradient id="globeGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#4338ca" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#050a1a" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="120" cy="120" r="100" fill="url(#globeGlow)" />
            <circle cx="120" cy="120" r="90" stroke="#6366f1" strokeWidth="0.8" fill="none" opacity="0.4" />
            <ellipse cx="120" cy="120" rx="55" ry="90" stroke="#818cf8" strokeWidth="0.6" fill="none" opacity="0.3" />
            <ellipse cx="120" cy="120" rx="90" ry="40" stroke="#6366f1" strokeWidth="0.6" fill="none" opacity="0.3" />
            <ellipse cx="120" cy="120" rx="90" ry="15" stroke="#a855f7" strokeWidth="0.6" fill="none" opacity="0.3" />
          </svg>
        </div>

        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-purple-400 fill-purple-400" />
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Welcome back, <span className="text-white">Sunny!</span>
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              Here's how Sentinel AI is keeping our platform safer today.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Last 7 Days Date Selector matching reference image */}
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-navy-800/90 border border-indigo-900/60 text-xs text-slate-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last 7 Days</span>
              <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400 ml-1" />
            </div>

            <button onClick={fetchData} disabled={loading}
              className="p-2 rounded-xl bg-navy-800/90 hover:bg-navy-700 border border-indigo-900/60 text-slate-300 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-xl p-4 bg-red-900/20 border border-red-700/40 text-red-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error} — Make sure the backend is running on port 8000.</span>
        </div>
      )}

      {/* 4 Metric Cards matching the exact figures & sparklines from reference image */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: 48,750 Total Analyzed Comments (Cyan/Blue) */}
        <div className="card-glow p-5 relative overflow-hidden bg-gradient-to-b from-[#0b1335] to-[#070c24] border border-indigo-900/50">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/40 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-cyan-400" />
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <TrendingUp className="w-3 h-3" /> 12%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mb-0.5 tracking-tight">
            {(summary?.total_analyzed ?? 48750).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-medium">Total Analyzed Comments</div>
          {/* Subtle sparkline wave */}
          <div className="mt-3 h-6 w-full opacity-60">
            <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,18 Q20,22 40,10 T80,12 T100,5" fill="none" stroke="#22d3ee" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Card 2: 5,420 Flagged Comments (Coral/Red) */}
        <div className="card-glow p-5 relative overflow-hidden bg-gradient-to-b from-[#160c24] to-[#0a071d] border border-red-950/50">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-400" />
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <TrendingUp className="w-3 h-3" /> 8%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mb-0.5 tracking-tight">
            {(summary?.flagged_comments ?? 5420).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-medium">Flagged Comments</div>
          <div className="mt-3 h-6 w-full opacity-60">
            <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,15 Q30,5 60,20 T100,8" fill="none" stroke="#f43f5e" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Card 3: 892 Pending Review (Amber) */}
        <div className="card-glow p-5 relative overflow-hidden bg-gradient-to-b from-[#18121f] to-[#09071a] border border-amber-950/50">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-800/40 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-800/40">
              ↓ 3%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mb-0.5 tracking-tight">
            {(summary?.pending_review ?? 892).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-medium">Pending Review</div>
          <div className="mt-3 h-6 w-full opacity-60">
            <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,10 Q25,22 50,14 T100,16" fill="none" stroke="#f59e0b" strokeWidth="2" />
            </svg>
          </div>
        </div>

        {/* Card 4: 327 High-Priority Cases (Emerald) */}
        <div className="card-glow p-5 relative overflow-hidden bg-gradient-to-b from-[#091624] to-[#050c18] border border-emerald-950/50">
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-800/40 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-800/40">
              <TrendingUp className="w-3 h-3" /> 15%
            </span>
          </div>
          <div className="text-2xl font-extrabold text-white mb-0.5 tracking-tight">
            {(summary?.high_priority ?? 327).toLocaleString()}
          </div>
          <div className="text-xs text-slate-400 font-medium">High-Priority Cases</div>
          <div className="mt-3 h-6 w-full opacity-60">
            <svg viewBox="0 0 100 25" preserveAspectRatio="none" className="w-full h-full">
              <path d="M0,20 Q30,10 65,18 T100,5" fill="none" stroke="#10b981" strokeWidth="2" />
            </svg>
          </div>
        </div>
      </div>

      {/* 3 Distribution Panels matching exact center labels & donut proportions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Severity Distribution */}
        <DonutPanel
          title="Severity Distribution"
          icon={Activity}
          centerValue="5.4K"
          centerLabel="Flagged"
          data={toChartData(distributions?.severity_distribution)}
          colors={{
            low: '#10b981',
            medium: '#f59e0b',
            high: '#ef4444',
            uncertain: '#8b5cf6',
          }}
          loading={loading}
        />

        {/* Category Distribution */}
        <DonutPanel
          title="Category Distribution"
          icon={Cpu}
          centerValue="5.4K"
          centerLabel="Flagged"
          data={toChartData(distributions?.category_distribution)}
          colors={{
            hate_speech: '#3b82f6',
            harassment: '#a855f7',
            cyberbullying: '#06b6d4',
          }}
          loading={loading}
        />

        {/* Language Distribution */}
        <DonutPanel
          title="Language Distribution"
          icon={Zap}
          centerValue="48.7K"
          centerLabel="Total"
          data={toChartData(distributions?.language_distribution)}
          colors={['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#06b6d4']}
          loading={loading}
        />
      </div>

      {/* Lower Dashboard: Recent Moderation Activity + Review Queue matching reference */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Recent Moderation Activity Table */}
        <div className="xl:col-span-2 card-glow p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
              Recent Moderation Activity
            </h3>
            <a href="/moderation" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold">
              View All →
            </a>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-indigo-900/40 text-slate-400 font-semibold">
                  <th className="pb-2.5 pr-3">Time</th>
                  <th className="pb-2.5 pr-3">Comment Preview</th>
                  <th className="pb-2.5 pr-3">Category</th>
                  <th className="pb-2.5 pr-3">Severity</th>
                  <th className="pb-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-indigo-900/20">
                {[
                  { time: '2 min ago', text: 'This is such a backward mindset...', cat: 'Hate Speech', catColor: 'bg-red-950/60 text-red-400 border border-red-800/40', sev: 'High', sevColor: 'bg-red-950/60 text-red-400', stat: 'Reviewed', statColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' },
                  { time: '5 min ago', text: 'I disagree with your opinion, and...', cat: 'Legit Opinion', catColor: 'bg-blue-950/60 text-blue-400 border border-blue-800/40', sev: 'Low', sevColor: 'bg-emerald-950/60 text-emerald-400', stat: 'Approved', statColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' },
                  { time: '8 min ago', text: 'You people are so dumb...', cat: 'Harassment', catColor: 'bg-purple-950/60 text-purple-400 border border-purple-800/40', sev: 'Medium', sevColor: 'bg-amber-950/60 text-amber-400', stat: 'Escalated', statColor: 'bg-amber-950/60 text-amber-400 border border-amber-800/40' },
                  { time: '12 min ago', text: 'Telugu lo cheppalante... 😂', cat: 'Cyberbullying', catColor: 'bg-cyan-950/60 text-cyan-400 border border-cyan-800/40', sev: 'Medium', sevColor: 'bg-amber-950/60 text-amber-400', stat: 'Reviewed', statColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' },
                  { time: '15 min ago', text: 'Great point! Totally agree.', cat: 'Positive', catColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40', sev: 'None', sevColor: 'bg-slate-800 text-slate-400', stat: 'Approved', statColor: 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-indigo-950/20 transition-colors">
                    <td className="py-3 pr-3 text-slate-400 whitespace-nowrap text-[11px]">{row.time}</td>
                    <td className="py-3 pr-3 max-w-xs font-medium text-slate-200 truncate">{row.text}</td>
                    <td className="py-3 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.catColor}`}>
                        {row.cat}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.sevColor}`}>
                        {row.sev}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${row.statColor}`}>
                        {row.stat}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Review Queue with 24 badge & Review buttons matching reference */}
        <div className="card-glow p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Review Queue</h3>
                <span className="w-5 h-5 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center">
                  24
                </span>
              </div>
              <a href="/moderation" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                View All →
              </a>
            </div>

            <div className="space-y-3">
              {[
                { title: 'This community is so toxic... you should all get a life', lang: 'English', time: '2 min ago', sev: 'High', sevClass: 'bg-red-950 text-red-400 border border-red-800/50' },
                { title: 'మీరు నిజంగా ఏమిటారో... అర్థం కావడం లేదు', lang: 'Telugu', time: '3 min ago', sev: 'Medium', sevClass: 'bg-amber-950 text-amber-400 border border-amber-800/50' },
                { title: 'Stop spreading hate!!!', lang: 'English', time: '5 min ago', sev: 'Medium', sevClass: 'bg-amber-950 text-amber-400 border border-amber-800/50' },
              ].map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-navy-900/60 border border-indigo-900/40 flex items-center justify-between gap-3">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-200 font-medium truncate">{item.title}</p>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold shrink-0 ${item.sevClass}`}>{item.sev}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      {item.lang} • {item.time}
                    </div>
                  </div>
                  <a
                    href="/moderation"
                    className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shrink-0 shadow-glow-purple transition-all"
                  >
                    Review
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Model Performance Strip matching reference image */}
      <div className="rounded-xl px-5 py-3 bg-navy-900/90 border border-indigo-900/40 flex items-center justify-between flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 font-bold text-slate-200">
            <span className="w-2.5 h-2.5 bg-cyan-400 rounded-sm" />
            <span>Model Performance (Last 7 Days):</span>
          </div>
          <div className="flex items-center gap-4 text-slate-300">
            <div>Precision: <span className="font-bold text-white">94.2%</span></div>
            <div className="text-slate-600">|</div>
            <div>Recall: <span className="font-bold text-white">92.8%</span></div>
            <div className="text-slate-600">|</div>
            <div>F1-Score: <span className="font-bold text-white">93.5%</span></div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>System Healthy</span>
          </div>
          <span>•</span>
          <span>Last Updated: 2 min ago</span>
          <button onClick={fetchData} className="hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
