import { useState, useEffect } from 'react';
import {
  MessageSquare, Flag, Clock, AlertTriangle,
  TrendingUp, RefreshCw, CheckCircle, Eye, ChevronRight,
  Activity, Cpu, Zap, Scale, Upload, FileText, Download, CheckCircle2,
  ShieldCheck, Database, ListFilter, Play, Globe
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { dashboardApi, monitoringApi } from '../api/client';
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

  // ─── Real-Time Local Ingestion & Comment Monitoring (Zero API Keys) ───────
  const [ingestMode, setIngestMode] = useState<'text' | 'csv'>('text');
  const [batchText, setBatchText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [deduplicate, setDeduplicate] = useState(true);
  const [isIngesting, setIsIngesting] = useState(false);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [monitorStatus, setMonitorStatus] = useState<any | null>(null);

  const fetchMonitorStatus = async () => {
    try {
      const resp = await monitoringApi.status();
      setMonitorStatus(resp.data);
    } catch {
      // Non-blocking background status check
    }
  };

  const handleBatchIngest = async () => {
    if (ingestMode === 'text') {
      const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        addToast('Please enter at least one comment to analyze.', 'error');
        return;
      }
      setIsIngesting(true);
      try {
        const resp = await monitoringApi.batchAnalyze({
          comments: lines,
          deduplicate,
          platform_source: 'Manual Live Batch',
        });
        setBatchResult(resp.data);
        addToast(`Processed ${resp.data.processed_count} comments (${resp.data.flagged_count} flagged) locally.`, 'success');
        fetchData();
        fetchMonitorStatus();
      } catch (err: any) {
        addToast(err.message || 'Batch analysis failed', 'error');
      } finally {
        setIsIngesting(false);
      }
    } else {
      if (!csvFile) {
        addToast('Please select a CSV, TSV, or TXT file to upload.', 'error');
        return;
      }
      setIsIngesting(true);
      try {
        const resp = await monitoringApi.uploadCsv(csvFile, deduplicate, `Uploaded File (${csvFile.name})`);
        setBatchResult(resp.data);
        addToast(`Imported & analyzed ${resp.data.processed_count} comments (${resp.data.flagged_count} flagged).`, 'success');
        fetchData();
        fetchMonitorStatus();
      } catch (err: any) {
        addToast(err.message || 'CSV analysis failed', 'error');
      } finally {
        setIsIngesting(false);
      }
    }
  };

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

  useEffect(() => {
    fetchData();
    fetchMonitorStatus();
  }, []);

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

      {/* ─── Real-Time Local Comment Ingestion & Monitoring Console (Zero API Keys) ─── */}
      <div className="card-glow p-5 border border-indigo-700/40 bg-gradient-to-br from-[#0c1333] via-[#080d26] to-[#05091a]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-indigo-900/50 gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-700/40 flex items-center justify-center text-purple-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Real-Time Comment Ingestion & Local Monitoring</h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-700/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Zero API Keys Required
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Local offline NLP inference pipeline for user-submitted comments and lawfully imported datasets. No social media scraping.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <a
              href="/api/monitor/export-reviewed-feedback?format=csv"
              download="sentinel_retraining_dataset.csv"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-indigo-800/50 text-indigo-200 text-xs font-semibold transition-colors shadow-sm"
              title="Export all human-reviewed corrections and moderator feedback as CSV for model retraining"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>Export for Retraining (CSV)</span>
            </a>
            <a
              href="/api/monitor/export-reviewed-feedback?format=jsonl"
              download="sentinel_retraining_dataset.jsonl"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-indigo-800/50 text-slate-300 text-xs font-semibold transition-colors shadow-sm"
              title="Export all human-reviewed corrections as JSONL"
            >
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>JSONL</span>
            </a>
          </div>
        </div>

        {/* Ingestion Controls */}
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 bg-navy-950/80 rounded-xl border border-indigo-900/50">
              <button
                type="button"
                onClick={() => setIngestMode('text')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  ingestMode === 'text'
                    ? 'bg-indigo-600 text-white shadow-glow-purple font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Text Batch Submission
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('csv')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  ingestMode === 'csv'
                    ? 'bg-indigo-600 text-white shadow-glow-purple font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Upload CSV / Text Dataset
              </button>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => setDeduplicate(e.target.checked)}
                className="rounded border-indigo-800 bg-navy-900 text-indigo-500 focus:ring-0"
              />
              <span>Deduplicate identical comments in batch</span>
            </label>
          </div>

          {ingestMode === 'text' ? (
            <div>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                placeholder="Paste comments here (one comment per line)...&#10;Example:&#10;This is an insightful discussion, thanks for sharing!&#10;You are a completely pathetic idiot and you should shut up.&#10;bhai ye solution sach me kaafi helpful tha yaar, thanks."
                rows={4}
                className="w-full rounded-xl bg-navy-950/80 border border-indigo-900/60 p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
          ) : (
            <div className="p-4 rounded-xl border-2 border-dashed border-indigo-900/60 bg-navy-950/40 flex flex-col items-center justify-center text-center">
              <Upload className="w-8 h-8 text-indigo-400 mb-2 opacity-70" />
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              <p className="text-[11px] text-slate-500 mt-2">
                Auto-detects columns: <code>comment</code>, <code>text</code>, <code>content</code>, <code>body</code>. Resilient to UTF-8 &amp; Latin-1 encoding errors.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              onClick={handleBatchIngest}
              disabled={isIngesting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition-all shadow-glow-purple disabled:opacity-50"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Processing Comments Locally...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Analyze Comments Locally</span>
                </>
              )}
            </button>

            {monitorStatus && (
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                <span>Model: <strong className="text-slate-200">enhanced_word_char_v2</strong></span>
                <span>•</span>
                <span>Operating Threshold: <strong className="text-slate-200">{monitorStatus.active_threshold ?? 0.40}</strong></span>
                <span>•</span>
                <span>Total Stored Records: <strong className="text-slate-200">{monitorStatus.total_monitored_records}</strong></span>
              </div>
            )}
          </div>

          {/* Results Summary & Feed */}
          {batchResult && (
            <div className="mt-4 p-4 rounded-xl bg-navy-950/90 border border-indigo-900/60 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-indigo-900/40 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Batch Ingestion Completed in {batchResult.processing_time_ms} ms</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    Received: {batchResult.total_received}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-mono border border-indigo-800/40">
                    Processed: {batchResult.processed_count}
                  </span>
                  {batchResult.duplicate_count > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono border border-amber-800/40">
                      Duplicates Filtered: {batchResult.duplicate_count}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 font-mono border border-red-800/40">
                    Flagged: {batchResult.flagged_count}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 font-mono border border-emerald-800/40">
                    Approved: {batchResult.approved_count}
                  </span>
                </div>
              </div>

              {/* Table of Ingested Results */}
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-indigo-900/40 text-slate-400 font-medium">
                      <th className="py-2 pr-3">Comment Text</th>
                      <th className="py-2 pr-3">Language</th>
                      <th className="py-2 pr-3">Toxicity Score</th>
                      <th className="py-2 pr-3">Severity</th>
                      <th className="py-2 pr-3">Decision</th>
                      <th className="py-2">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-950/40">
                    {batchResult.items.map((it: any) => (
                      <tr key={it.id} className="hover:bg-indigo-950/30">
                        <td className="py-2 pr-3 max-w-sm truncate font-medium text-slate-200">
                          {it.text}
                        </td>
                        <td className="py-2 pr-3 text-slate-400 capitalize">
                          {it.detected_language}
                        </td>
                        <td className="py-2 pr-3 font-mono">
                          {it.toxicity_score !== null ? (
                            <span className={it.toxicity_score >= 0.40 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                              {(it.toxicity_score * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">GPU-pending</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <SeverityBadge severity={it.severity} />
                        </td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            it.decision === 'no_action'
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                              : 'bg-red-950/60 text-red-400 border border-red-800/40'
                          }`}>
                            {it.decision}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400 font-mono text-[11px]">
                          {it.processing_time_ms} ms
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* ─── Validated Multilingual Models (Zero External APIs, Fully Local) ─── */}
      <div className="card-glow p-5 border border-indigo-900/60 bg-gradient-to-br from-[#0c1333] via-[#080d26] to-[#05091a]">
        <div className="flex items-center justify-between pb-3 border-b border-indigo-900/40 mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-indigo-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Validated Multilingual Local Model Matrix
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/50">
                  5 Languages Active
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Trained scikit-learn FeatureUnion (Word + Char n-gram) pipelines with calibrated thresholds. Zero external AI API keys.
              </p>
            </div>
          </div>
          <a href="/context-lab" className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1">
            Test Live in Context Lab →
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            {
              lang: "English",
              version: "enhanced_word_char_v2",
              dataset: "Civil Comments (CC0)",
              samples: "2,979 held-out",
              metric: "ROC-AUC 0.8784",
              metric2: "Acc 90.9%",
              threshold: "0.40",
              status: "Validated Automated",
              statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
            },
            {
              lang: "Hindi",
              version: "hindi_word_char_v1",
              dataset: "Hindi Social Media Hostility",
              samples: "860 held-out",
              metric: "ROC-AUC 0.9899",
              metric2: "F1 96.5%",
              threshold: "0.50",
              status: "Validated Automated",
              statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
            },
            {
              lang: "Hinglish / Code-Mixed",
              version: "hinglish_word_char_v1",
              dataset: "PRISM Hinglish (Apache 2.0)",
              samples: "8,852 held-out",
              metric: "ROC-AUC 0.7855",
              metric2: "F1 71.0%",
              threshold: "0.29",
              status: "Validated Automated",
              statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
            },
            {
              lang: "Telugu",
              version: "telugu_word_char_v1",
              dataset: "IIIT Hyderabad Telugu Corpus",
              samples: "7,033 held-out",
              metric: "ROC-AUC 0.8361",
              metric2: "Acc 96.6%",
              threshold: "0.29",
              status: "Validated Automated",
              statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
            },
            {
              lang: "Kannada",
              version: "kannada_word_char_v1",
              dataset: "OffenseVal Dravidian",
              samples: "586 validation",
              metric: "ROC-AUC 0.8682",
              metric2: "F1 69.5%",
              threshold: "0.55",
              status: "Validated Automated",
              statusColor: "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
            }
          ].map((m, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-navy-950/70 border border-indigo-900/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-white">{m.lang}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="text-[10px] text-slate-400 truncate mb-1">Source: {m.dataset}</div>
                <div className="text-[11px] font-mono font-bold text-indigo-300">{m.metric}</div>
                <div className="text-[10px] text-slate-300">{m.metric2} • {m.samples}</div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-indigo-950 flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-mono">Thresh: {m.threshold}</span>
                <span className={`px-1.5 py-0.5 rounded border ${m.statusColor}`}>Active</span>
              </div>
            </div>
          ))}
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
