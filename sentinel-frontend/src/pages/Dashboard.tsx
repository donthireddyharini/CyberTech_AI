import { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Flag, Clock, AlertTriangle,
  TrendingUp, RefreshCw, CheckCircle, Eye,
  Activity, Cpu, Zap, Scale, Upload, CheckCircle2,
  Play, Globe, Calendar, Layers, ShieldCheck, Sparkles,
  ArrowRight, ShieldAlert, Check, X, FileText, Send,
  Youtube, Instagram, Key, ExternalLink, Share2, Sliders, Settings,
  RotateCcw
} from 'lucide-react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Sector
} from 'recharts';
import { dashboardApi, monitoringApi, socialApi } from '../api/client';
import type {
  DashboardSummary, DistributionData, RecentActivity,
  SocialConnectorStatus, SocialSyncLog, SocialIngestionResult
} from '../types';
import { useToast } from '../App';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/I18nContext';
import { useDashboard } from '../context/DashboardContext';

// Color schemes matching Courseu light design system
const SEVERITY_COLORS: Record<string, string> = {
  low: '#00B894',      // Fresh emerald
  medium: '#FDCB6E',   // Warm amber
  high: '#FF7675',     // Soft coral/rose
  uncertain: '#A29BFE' // Soft lavender
};
const CATEGORY_COLORS: Record<string, string> = {
  hate_speech: '#FF7675',   // Coral
  harassment: '#6C5CE7',    // Vibrant violet/purple
  cyberbullying: '#00CEC9', // Cyan/teal
  legitimate: '#00B894',    // Green
};
const LANG_COLORS = ['#6C5CE7', '#00CEC9', '#00B894', '#FDCB6E', '#FD79A8', '#0984E3'];
const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  instagram: '#E1306C',
  manual: '#6C5CE7',
  csv_upload: '#00CEC9',
};

// ─── Platform Badge Component ────────────────────────────────────────────────
function PlatformBadge({ platform, sourceUrl }: { platform?: string | null; sourceUrl?: string | null }) {
  const p = (platform || 'manual').toLowerCase();
  let badgeClass = 'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]';
  let label = 'Direct Text';
  let Icon = FileText;

  if (p === 'youtube') {
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
    label = 'YouTube';
    Icon = Youtube;
  } else if (p === 'instagram' || p === 'ig') {
    badgeClass = 'bg-pink-50 text-pink-700 border-pink-200';
    label = 'Instagram';
    Icon = Instagram;
  } else if (p.includes('csv') || p.includes('batch')) {
    badgeClass = 'bg-cyan-50 text-cyan-700 border-cyan-200';
    label = 'CSV Import';
    Icon = Upload;
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${badgeClass}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{label}</span>
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:opacity-75 transition-opacity ml-0.5 text-current"
          title="Open original source"
        >
          <ExternalLink className="w-2.5 h-2.5 inline" />
        </a>
      )}
    </span>
  );
}

// ─── Smooth Animated Number Counter ──────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const start = prevValue.current;
    const end = value;
    if (start === end) return;

    const duration = 650;
    const startTime = performance.now();

    const updateCounter = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        prevValue.current = end;
      }
    };

    requestAnimationFrame(updateCounter);
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
}

// ─── Custom Donut Tooltip Component (Courseu Light Theme) ─────────────────────
function CustomDonutTooltip({ active, payload, total }: any) {
  if (active && payload && payload.length) {
    const item = payload[0];
    const fill = item.payload?.fill || item.color || '#6C5CE7';
    const val = Number(item.value) || 0;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0.0';
    const rawName = String(item.name || '');
    const formattedName = rawName.replace(/_/g, ' ');

    return (
      <div className="z-50 px-3.5 py-2.5 rounded-xl bg-white border border-[#E9EAF1] shadow-xl pointer-events-none min-w-[150px] animate-in fade-in duration-150 text-[#20212B]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: fill }} />
          <span className="text-xs font-bold text-[#20212B] capitalize tracking-wide truncate">{formattedName}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[#20212B]">
          <span className="text-sm font-black text-[#6C5CE7] tabular-nums">{val.toLocaleString()}</span>
          <span className="text-[11px] text-[#858795] font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="text-[10px] text-[#858795] font-medium mt-0.5">
          {val === 1 ? '1 record' : `${val.toLocaleString()} records`} ({pct}% of total)
        </div>
      </div>
    );
  }
  return null;
}

// ─── Custom Timeline Area Chart Tooltip ───────────────────────────────────────
function CustomTimelineTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const total = payload.find((p: any) => p.dataKey === 'total')?.value || 0;
    const flagged = payload.find((p: any) => p.dataKey === 'flagged')?.value || 0;
    const approved = payload.find((p: any) => p.dataKey === 'approved')?.value || 0;

    return (
      <div className="z-50 px-4 py-3 rounded-xl bg-white border border-[#E9EAF1] shadow-xl pointer-events-none min-w-[170px] text-[#20212B]">
        <div className="text-xs font-bold text-[#20212B] mb-2 pb-1.5 border-b border-[#E9EAF1] font-mono">
          {label}
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#858795]">
              <span className="w-2 h-2 rounded-full bg-[#6C5CE7]" />
              Total Analyzed:
            </span>
            <span className="font-bold text-[#20212B] tabular-nums">{Number(total).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#858795]">
              <span className="w-2 h-2 rounded-full bg-[#FF7675]" />
              Flagged Violations:
            </span>
            <span className="font-bold text-[#FF7675] tabular-nums">{Number(flagged).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-[#858795]">
              <span className="w-2 h-2 rounded-full bg-[#00B894]" />
              Approved Safe:
            </span>
            <span className="font-bold text-[#00B894] tabular-nums">{Number(approved).toLocaleString()}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

// Active Sector renderer for expanded hover ring
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 4}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

// Interactive Donut Chart Panel
function DonutPanel({
  title,
  icon: Icon,
  data,
  colors,
  loading = false,
}: {
  title: string;
  icon: any;
  data: Array<{ name: string; value: number }>;
  colors: Record<string, string> | string[];
  loading?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = data.reduce((acc, cur) => acc + (cur.value || 0), 0);

  const getColor = (name: string, index: number) => {
    if (Array.isArray(colors)) {
      return colors[index % colors.length];
    }
    return colors[name] || '#858795';
  };

  const activeItem = activeIndex !== null && data[activeIndex] ? data[activeIndex] : null;

  return (
    <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B] flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#6C5CE7]" />
          <span>{title}</span>
        </h3>
        <span className="text-[11px] text-[#858795] font-semibold tabular-nums">
          {total === 1 ? '1 total' : `${total.toLocaleString()} total`}
        </span>
      </div>

      <div className="h-56 relative flex items-center justify-center">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-[#858795]">
            <RefreshCw className="w-5 h-5 animate-spin text-[#6C5CE7]" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-[#858795] text-center px-4">
            <span className="text-sm font-semibold text-[#20212B] mb-1">0 Records</span>
            <span>No data available for this range</span>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  dataKey="value"
                  isAnimationActive={true}
                  animationDuration={600}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                  activeShape={renderActiveShape}
                >
                  {data.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={getColor(entry.name, index)}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                      className="transition-all duration-200 cursor-pointer"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Callout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-black text-[#20212B] tracking-tight tabular-nums">
                {activeItem ? activeItem.value.toLocaleString() : total.toLocaleString()}
              </span>
              <span className="text-[10px] text-[#858795] font-bold uppercase tracking-wider truncate max-w-[100px] text-center">
                {activeItem ? activeItem.name.replace(/_/g, ' ') : 'Total'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Legend Grid */}
      {data.length > 0 && total > 0 && (
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#E9EAF1]">
          {data.slice(0, 6).map((item, idx) => {
            const color = getColor(item.name, idx);
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
            const isHovered = activeIndex === idx;

            return (
              <div
                key={item.name}
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`flex items-center justify-between text-xs p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isHovered ? 'bg-[#F8F9FE]' : 'hover:bg-[#F8F9FE]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[#20212B] capitalize truncate text-[11px] font-medium">
                    {item.name.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-1 tabular-nums text-[11px]">
                  <span className="font-bold text-[#20212B]">{item.value.toLocaleString()}</span>
                  <span className="text-[10px] text-[#858795]">({pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Preset Comment Samples for Instant Ingestion Testing
const INGESTION_PRESETS = [
  {
    label: "Telugu Insult",
    lang: "telugu",
    text: "నువ్వు చాలా పనికిరాని వెధవవి",
    type: "harmful"
  },
  {
    label: "Hindi Hostile",
    lang: "hindi",
    text: "तू बहुत ही घटिया और बदतमीज इंसान है",
    type: "harmful"
  },
  {
    label: "Hinglish Toxic",
    lang: "hinglish",
    text: "ye bilkul bekaar aur wahiyat aadmi hai",
    type: "harmful"
  },
  {
    label: "Kannada Offensive",
    lang: "kannada",
    text: "ನೀನು ತುಂಬಾ ಕೆಟ್ಟವನು ಮತ್ತು ಅಸಹ್ಯ",
    type: "harmful"
  },
  {
    label: "English Civil",
    lang: "english",
    text: "I respectfully disagree with your conclusion, here are the empirical reasons why.",
    type: "civil"
  },
  {
    label: "English Harassment",
    lang: "english",
    text: "You are completely useless and pathetic, stop posting here.",
    type: "harmful"
  }
];

export default function Dashboard() {
  const { t } = useTranslation();
  const { addToast } = useToast();
  const { user } = useAuth();

  // Persistent Workspace & Filter State from DashboardContext
  const {
    ingestMode,
    setIngestMode,
    batchText,
    setBatchText,
    csvFile,
    setCsvFile,
    deduplicate,
    setDeduplicate,
    batchResult,
    setBatchResult,
    sessionBatchCount,
    setSessionBatchCount,
    sessionCommentsProcessed,
    setSessionCommentsProcessed,
    ytVideoInput,
    setYtVideoInput,
    ytMaxComments,
    setYtMaxComments,
    ytIncludeReplies,
    setYtIncludeReplies,
    ytOrder,
    setYtOrder,
    igMediaInput,
    setIgMediaInput,
    igMaxComments,
    setIgMaxComments,
    igIncludeReplies,
    setIgIncludeReplies,
    timeframe,
    setTimeframe,
    showCustomPicker,
    setShowCustomPicker,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    appliedCustomRange,
    setAppliedCustomRange,
    selectedPlatform,
    setSelectedPlatform,
    clearWorkspace,
  } = useDashboard();

  // Component-local transient state
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [distributions, setDistributions] = useState<DistributionData | null>(null);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [queue, setQueue] = useState<RecentActivity[]>([]);
  const [timelineData, setTimelineData] = useState<Array<{ date: string; total: number; flagged: number; approved: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isIngesting, setIsIngesting] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState<any | null>(null);

  // Connectors Status (Server-Configured)
  const [connectorsStatus, setConnectorsStatus] = useState<SocialConnectorStatus[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(false);

  const fetchMonitorStatus = async () => {
    try {
      const resp = await monitoringApi.status();
      setMonitorStatus(resp.data);
    } catch {
      // Background telemetry
    }
  };

  const fetchConnectors = async () => {
    setLoadingConnectors(true);
    try {
      const resp = await socialApi.getConnectors();
      setConnectorsStatus(resp.data);
    } catch {
      // background
    } finally {
      setLoadingConnectors(false);
    }
  };

  useEffect(() => {
    fetchConnectors();
  }, []);

  const fetchData = async (
    selectedTimeframe = timeframe,
    isManualRefresh = false,
    startDate?: string,
    endDate?: string,
    platform = selectedPlatform
  ) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setTimelineLoading(true);
    setError(null);
    try {
      const sDate = startDate || (selectedTimeframe === 'custom' ? appliedCustomRange?.start : undefined);
      const eDate = endDate || (selectedTimeframe === 'custom' ? appliedCustomRange?.end : undefined);

      let days = 7;
      if (selectedTimeframe === 'today') days = 1;
      else if (selectedTimeframe === 'yesterday') days = 1;
      else if (selectedTimeframe === '30d') days = 30;
      else if (selectedTimeframe === 'custom' && sDate && eDate) {
        const diffMs = new Date(eDate).getTime() - new Date(sDate).getTime();
        days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      }

      const platParam = platform === 'all' ? undefined : platform;

      const [summaryResp, distResp, recentResp, queueResp, timelineResp] = await Promise.all([
        dashboardApi.summary(selectedTimeframe, sDate, eDate, platParam),
        dashboardApi.distributions(selectedTimeframe, sDate, eDate, platParam),
        dashboardApi.recent(12, selectedTimeframe, sDate, eDate, platParam),
        dashboardApi.reviewQueue(6, platParam),
        dashboardApi.timeline(days, selectedTimeframe, sDate, eDate, platParam),
      ]);
      setSummary(summaryResp.data);
      setDistributions(distResp.data);
      setRecent(recentResp.data);
      setQueue(queueResp.data);
      setTimelineData(timelineResp.data);

      if (isManualRefresh) {
        addToast('Dashboard analytics refreshed with latest records.', 'success');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve dashboard analytics');
      addToast(err.message || 'Failed to load dashboard data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimelineLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeframe, false, undefined, undefined, selectedPlatform);
  }, [selectedPlatform]);

  const handleApplyCustomRange = () => {
    if (!customStartDate || !customEndDate) {
      addToast('Please select both start and end dates.', 'warning');
      return;
    }
    if (new Date(customStartDate) > new Date(customEndDate)) {
      addToast('Start date cannot be after end date.', 'error');
      return;
    }
    setTimeframe('custom');
    setAppliedCustomRange({ start: customStartDate, end: customEndDate });
    fetchData('custom', false, customStartDate, customEndDate, selectedPlatform);
    addToast('Custom date range applied to analytics.', 'info');
  };

  const handleClearCustomRange = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setAppliedCustomRange(null);
    setShowCustomPicker(false);
    setTimeframe('7d');
    fetchData('7d', false, undefined, undefined, selectedPlatform);
  };

  const handleSelectPreset = (val: 'today' | 'yesterday' | '7d' | '30d' | 'all') => {
    setTimeframe(val);
    setShowCustomPicker(false);
    setAppliedCustomRange(null);
    fetchData(val, false, undefined, undefined, selectedPlatform);
  };

  useEffect(() => {
    fetchData();
    fetchMonitorStatus();
  }, []);

  // ─── Real-Time Comment Ingestion Handlers ───────────────────────────────────
  const handleBatchIngest = async () => {
    if (ingestMode === 'text') {
      const lines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        addToast('Please enter or select at least one comment to analyze.', 'error');
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
        setSessionBatchCount(prev => prev + 1);
        setSessionCommentsProcessed(prev => prev + resp.data.processed_count);

        if (resp.data.items && resp.data.items.length > 0) {
          const formattedNewRecords: RecentActivity[] = resp.data.items.map((it: any) => ({
            id: it.id,
            text_preview: it.text.slice(0, 120),
            severity: it.severity,
            decision: it.decision,
            status: 'pending',
            detected_language: it.detected_language,
            hate_speech_score: typeof it.hate_speech_score === 'number' ? it.hate_speech_score : 0,
            harassment_score: typeof it.harassment_score === 'number' ? it.harassment_score : 0,
            cyberbullying_score: typeof it.cyberbullying_score === 'number' ? it.cyberbullying_score : 0,
            platform: 'manual',
            is_demo: false,
            created_at: new Date().toISOString()
          }));

          setRecent(prev => [...formattedNewRecords, ...prev].slice(0, 15));
          const newFlagged = formattedNewRecords.filter(r => r.decision === 'flag_for_review');
          if (newFlagged.length > 0) {
            setQueue(prev => [...newFlagged, ...prev].slice(0, 10));
          }
        }

        await fetchData(timeframe, false, undefined, undefined, selectedPlatform);
        await fetchMonitorStatus();

        addToast(
          `Successfully processed ${resp.data.processed_count} comments (${resp.data.flagged_count} violations detected). Dashboard updated.`,
          'success'
        );
        setBatchText('');
      } catch (err: any) {
        addToast(err.message || 'Failed to analyze batch comments.', 'error');
      } finally {
        setIsIngesting(false);
      }
    } else if (ingestMode === 'csv') {
      if (!csvFile) {
        addToast('Please select a CSV or text dataset file.', 'error');
        return;
      }
      setIsIngesting(true);
      try {
        const resp = await monitoringApi.uploadCsv(csvFile, deduplicate, 'CSV Import');
        setBatchResult(resp.data);
        setSessionBatchCount(prev => prev + 1);
        setSessionCommentsProcessed(prev => prev + resp.data.processed_count);

        if (resp.data.items && resp.data.items.length > 0) {
          const formattedNewRecords: RecentActivity[] = resp.data.items.map((it: any) => ({
            id: it.id,
            text_preview: it.text.slice(0, 120),
            severity: it.severity,
            decision: it.decision,
            status: 'pending',
            detected_language: it.detected_language,
            hate_speech_score: typeof it.hate_speech_score === 'number' ? it.hate_speech_score : 0,
            harassment_score: typeof it.harassment_score === 'number' ? it.harassment_score : 0,
            cyberbullying_score: typeof it.cyberbullying_score === 'number' ? it.cyberbullying_score : 0,
            platform: 'csv_upload',
            is_demo: false,
            created_at: new Date().toISOString()
          }));

          setRecent(prev => [...formattedNewRecords, ...prev].slice(0, 15));
          const newFlagged = formattedNewRecords.filter(r => r.decision === 'flag_for_review');
          if (newFlagged.length > 0) {
            setQueue(prev => [...newFlagged, ...prev].slice(0, 10));
          }
        }

        await fetchData(timeframe, false, undefined, undefined, selectedPlatform);
        await fetchMonitorStatus();

        addToast(
          `Successfully imported and analyzed ${resp.data.processed_count} comments from '${csvFile.name}'.`,
          'success'
        );
        setCsvFile(null);
      } catch (err: any) {
        addToast(err.message || 'Failed to upload and analyze dataset.', 'error');
      } finally {
        setIsIngesting(false);
      }
    }
  };

  const handleSocialFetch = async (targetPlatform: 'youtube' | 'instagram') => {
    setIsIngesting(true);
    try {
      let resp: any;
      if (targetPlatform === 'youtube') {
        if (!ytVideoInput.trim()) {
          addToast('Please enter a YouTube video URL or 11-char Video ID.', 'error');
          setIsIngesting(false);
          return;
        }
        resp = await socialApi.fetchYouTube({
          video_input: ytVideoInput.trim(),
          max_comments: ytMaxComments,
          include_replies: ytIncludeReplies,
          order: ytOrder,
        });
      } else if (targetPlatform === 'instagram') {
        if (!igMediaInput.trim()) {
          addToast('Please enter an Instagram post/reel URL or Media ID.', 'error');
          setIsIngesting(false);
          return;
        }
        resp = await socialApi.fetchInstagram({
          media_input: igMediaInput.trim(),
          max_comments: igMaxComments,
          include_replies: igIncludeReplies,
        });
      }

      const data: SocialIngestionResult = resp.data;
      setBatchResult({
        total_received: data.total_fetched,
        processed_count: data.newly_ingested,
        duplicate_count: data.duplicate_count,
        flagged_count: data.flagged_count,
        approved_count: data.approved_count,
        processing_time_ms: data.processing_time_ms,
        platform: data.platform,
        items: data.records.map((r: any) => ({
          id: r.id,
          text: r.text,
          detected_language: r.detected_language,
          severity: r.severity,
          decision: r.decision,
          toxicity_score: r.toxicity_score,
          processing_time_ms: data.processing_time_ms / (data.records.length || 1),
          source_url: r.source_url,
          author_name: r.author_name,
        })),
      });

      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + data.newly_ingested);

      if (data.records && data.records.length > 0) {
        const formattedNewRecords: RecentActivity[] = data.records.map((r: any) => ({
          id: r.id,
          text_preview: r.text.slice(0, 120),
          severity: r.severity,
          decision: r.decision,
          status: 'pending',
          detected_language: r.detected_language,
          hate_speech_score: typeof r.hate_speech_score === 'number' ? r.hate_speech_score : 0,
          harassment_score: typeof r.harassment_score === 'number' ? r.harassment_score : 0,
          cyberbullying_score: typeof r.cyberbullying_score === 'number' ? r.cyberbullying_score : 0,
          platform: targetPlatform,
          source_url: r.source_url,
          author_name: r.author_name,
          source_id: r.comment_id,
          is_demo: false,
          created_at: r.published_at || new Date().toISOString()
        }));

        setRecent(prev => [...formattedNewRecords, ...prev].slice(0, 15));
        const newFlagged = formattedNewRecords.filter(r => r.decision !== 'no_action');
        if (newFlagged.length > 0) {
          setQueue(prev => [...newFlagged, ...prev].slice(0, 10));
        }
      }

      await fetchData(timeframe, false, undefined, undefined, selectedPlatform);
      await fetchMonitorStatus();

      addToast(
        `Successfully ingested ${data.newly_ingested} real comments from ${targetPlatform.toUpperCase()} (${data.flagged_count} flagged, ${data.duplicate_count} duplicates skipped).`,
        'success'
      );
    } catch (err: any) {
      const msg = err.message || `Failed to fetch from ${targetPlatform}`;
      addToast(msg, 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  const toChartData = (obj?: Record<string, number> | null) => {
    if (!obj) return [];
    const entries = Object.entries(obj).filter(([_, value]) => value > 0);
    return entries.map(([name, value]) => ({ name, value }));
  };

  return (
    <div className="space-y-6 pb-12 font-sans page-enter">
      {/* ── Top Header Section (Courseu Style) ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black tracking-tight text-[#20212B]">
                Social Content Intelligence Dashboard
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#EEEAFE] text-[#6C5CE7] border border-[#6C5CE7]/20">
                Live Multi-Platform Telemetry
              </span>
            </div>
            <p className="text-xs text-[#858795]">
              Real-time comment monitoring across YouTube and Instagram powered by local multilingual ML models.
            </p>
          </div>

          {/* Right Header Controls: Platform Filter + Timeframe Filter + Refresh */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Platform Filter Dropdown */}
            <div className="flex items-center gap-1.5 bg-[#F5F6FA] p-1 rounded-xl border border-[#E9EAF1]">
              <span className="text-[11px] font-semibold text-[#858795] pl-2 pr-1 flex items-center gap-1">
                <Share2 className="w-3.5 h-3.5 text-[#6C5CE7]" />
                <span>Platform:</span>
              </span>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-white border-0 text-xs font-semibold text-[#20212B] rounded-lg px-2.5 py-1.5 shadow-xs focus:ring-1 focus:ring-[#6C5CE7] cursor-pointer"
              >
                <option value="all">All Sources</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="manual">Manual Direct</option>
                <option value="csv_upload">CSV / Batch</option>
              </select>
            </div>

            {/* Timeframe Presets */}
            <div className="flex items-center gap-1 bg-[#F5F6FA] p-1 rounded-xl border border-[#E9EAF1]">
              {(
                [
                  { key: 'today', label: t('dashboard.filter.today', 'Today') },
                  { key: 'yesterday', label: t('dashboard.filter.yesterday', 'Yesterday') },
                  { key: '7d', label: t('dashboard.filter.7d', '7 Days') },
                  { key: '30d', label: t('dashboard.filter.30d', '30 Days') },
                  { key: 'all', label: t('dashboard.filter.all', 'All Time') },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleSelectPreset(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    timeframe === f.key
                      ? 'bg-[#6C5CE7] text-white shadow-sm'
                      : 'text-[#858795] hover:text-[#20212B] hover:bg-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              {/* Custom Date Range Toggle */}
              <button
                type="button"
                onClick={() => {
                  setShowCustomPicker(!showCustomPicker);
                  if (!customStartDate) {
                    const today = new Date();
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    setCustomEndDate(today.toISOString().split('T')[0]);
                    setCustomStartDate(weekAgo.toISOString().split('T')[0]);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeframe === 'custom' || showCustomPicker
                    ? 'bg-[#6C5CE7] text-white shadow-sm'
                    : 'text-[#858795] hover:text-[#20212B] hover:bg-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Custom Range</span>
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchData(timeframe, true, undefined, undefined, selectedPlatform)}
              disabled={loading || refreshing}
              title={t('action.refresh', 'Refresh')}
              className="p-2.5 rounded-xl bg-white hover:bg-[#F5F6FA] border border-[#E9EAF1] text-[#858795] hover:text-[#20212B] transition-colors shadow-xs"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing || loading ? 'animate-spin text-[#6C5CE7]' : ''}`} />
            </button>
          </div>
        </div>

        {/* Custom Date Range Picker Bar */}
        {showCustomPicker && (
          <div className="mt-4 pt-4 border-t border-[#E9EAF1] flex items-center justify-between flex-wrap gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-[#858795]">Start Date:</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-[#E9EAF1] text-xs text-[#20212B] bg-[#FBFBFE] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[11px] font-semibold text-[#858795]">End Date:</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-[#E9EAF1] text-xs text-[#20212B] bg-[#FBFBFE] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
              <button
                type="button"
                onClick={handleApplyCustomRange}
                className="px-3.5 py-1 rounded-lg bg-[#6C5CE7] hover:bg-[#5B4BC4] text-white font-semibold text-xs transition-colors shadow-xs"
              >
                Apply Range
              </button>
              <button
                type="button"
                onClick={handleClearCustomRange}
                className="px-3 py-1 rounded-lg bg-[#F5F6FA] hover:bg-[#E9EAF1] text-[#858795] font-semibold text-xs transition-colors"
              >
                Clear
              </button>
            </div>
            {appliedCustomRange && (
              <div className="text-[11px] text-[#6C5CE7] font-semibold bg-[#EEEAFE] px-2.5 py-1 rounded-full border border-[#6C5CE7]/20">
                Filtered: {appliedCustomRange.start} to {appliedCustomRange.end}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Key Metrics Cards (Courseu Stat Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Comments Analyzed */}
        <div className="bg-white border border-[#E9EAF1] rounded-2xl p-5 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#858795]">
              {t('dashboard.stats.total_analyzed', 'Total Monitored')}
            </span>
            <div className="text-3xl font-black text-[#20212B] tracking-tight tabular-nums">
              <AnimatedNumber value={summary?.total_analyzed || 0} />
            </div>
            <div className="text-[11px] text-[#858795] flex items-center gap-1 font-medium">
              <span className="text-emerald-600 font-bold">
                +<AnimatedNumber value={summary?.today_analyzed || 0} />
              </span>
              <span>analyzed today</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#EEEAFE] flex items-center justify-center text-[#6C5CE7] shadow-xs">
            <MessageSquare className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Flagged Violations */}
        <div className="bg-white border border-[#E9EAF1] rounded-2xl p-5 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#858795]">
              {t('dashboard.stats.flagged', 'Flagged Violations')}
            </span>
            <div className="text-3xl font-black text-[#FF7675] tracking-tight tabular-nums">
              <AnimatedNumber value={summary?.flagged_comments || 0} />
            </div>
            <div className="text-[11px] text-[#858795] flex items-center gap-1 font-medium">
              <span className="font-bold text-[#FF7675]">
                {summary?.violation_rate !== undefined ? summary.violation_rate : (summary?.total_analyzed ? ((summary.flagged_comments / summary.total_analyzed) * 100).toFixed(1) : 0)}%
              </span>
              <span>violation rate</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FFEAEA] flex items-center justify-center text-[#FF7675] shadow-xs">
            <Flag className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Pending Human Oversight */}
        <div className="bg-white border border-[#E9EAF1] rounded-2xl p-5 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#858795]">
              {t('dashboard.stats.pending', 'Pending Oversight')}
            </span>
            <div className="text-3xl font-black text-[#FDCB6E] tracking-tight tabular-nums">
              <AnimatedNumber value={summary?.pending_review || 0} />
            </div>
            <div className="text-[11px] text-[#858795] flex items-center gap-1 font-medium">
              <span className="font-bold text-[#FF7675]">
                <AnimatedNumber value={summary?.high_priority || 0} />
              </span>
              <span>high-severity items</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#FFF6E5] flex items-center justify-center text-[#FDCB6E] shadow-xs">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Approved Civil Content */}
        <div className="bg-white border border-[#E9EAF1] rounded-2xl p-5 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-[#858795]">
              {t('dashboard.stats.approved', 'Approved Civil')}
            </span>
            <div className="text-3xl font-black text-[#00B894] tracking-tight tabular-nums">
              <AnimatedNumber value={summary?.non_flagged_comments || 0} />
            </div>
            <div className="text-[11px] text-[#858795] flex items-center gap-1 font-medium">
              <span className="font-bold text-[#00B894]">
                {summary?.clean_rate !== undefined ? summary.clean_rate : (summary?.total_analyzed ? (((summary.non_flagged_comments || 0) / summary.total_analyzed) * 100).toFixed(1) : 0)}%
              </span>
              <span>clean content score</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#E6F9F4] flex items-center justify-center text-[#00B894] shadow-xs">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Layout (Courseu 2+1 Layout) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* ── Left 2 Columns: Ingestion Console + Trend Chart + Telemetry ── */}
        <div className="xl:col-span-2 space-y-6">
          
          {/* 1. Real-Time Comment Ingestion & Social Media Feeds Console */}
          <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] space-y-5 relative overflow-hidden card-interactive">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEEAFE] flex items-center justify-center text-[#6C5CE7] shadow-xs">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#20212B] tracking-wide">
                      Real-Time Comment Ingestion &amp; Social Feeds
                    </h2>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Mode Switcher */}
                <div className="flex items-center gap-1 bg-[#F5F6FA] p-1 rounded-xl border border-[#E9EAF1] flex-wrap">
                  <button
                    type="button"
                    onClick={() => setIngestMode('text')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ingestMode === 'text' ? 'bg-white text-[#6C5CE7] shadow-xs' : 'text-[#858795] hover:text-[#20212B]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Direct Text</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngestMode('csv')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ingestMode === 'csv' ? 'bg-white text-[#6C5CE7] shadow-xs' : 'text-[#858795] hover:text-[#20212B]'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>CSV File</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngestMode('youtube')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ingestMode === 'youtube' ? 'bg-white text-rose-600 shadow-xs' : 'text-[#858795] hover:text-[#20212B]'
                    }`}
                  >
                    <Youtube className="w-3.5 h-3.5 text-rose-600" />
                    <span>YouTube</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIngestMode('instagram')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      ingestMode === 'instagram' ? 'bg-white text-pink-600 shadow-xs' : 'text-[#858795] hover:text-[#20212B]'
                    }`}
                  >
                    <Instagram className="w-3.5 h-3.5 text-pink-600" />
                    <span>Instagram</span>
                  </button>
                </div>

                {/* Visible Clear Button for Workspace Form */}
                <button
                  type="button"
                  onClick={() => {
                    clearWorkspace();
                    addToast('Ingestion workspace cleared.', 'info');
                  }}
                  title="Clear inputs and batch results without deleting persisted database records"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] hover:bg-[#F0F1F5] text-[#858795] hover:text-[#20212B] text-xs font-semibold transition-all shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {/* TAB 1: DIRECT TEXT */}
            {ingestMode === 'text' && (
              <div className="space-y-4">
                {/* Quick Presets for 1-Click Testing */}
                <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
                  <span className="text-[#858795] text-[11px] font-semibold mr-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7]" />
                    <span>Click to test instantly:</span>
                  </span>
                  {INGESTION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setBatchText(preset.text)}
                      className="px-2.5 py-1 rounded-lg bg-[#F5F6FA] hover:bg-[#EEEAFE] border border-[#E9EAF1] hover:border-[#6C5CE7]/30 text-[11px] text-[#20212B] transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        preset.type === 'harmful' ? 'bg-[#FF7675]' : preset.type === 'civil' ? 'bg-[#00B894]' : 'bg-[#6C5CE7]'
                      }`} />
                      <span>{preset.label}</span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <textarea
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    placeholder="Paste or type comments to analyze (one per line)...&#10;Example:&#10;నువ్వు చాలా పనికిరాని వెధవవి&#10;ye bilkul bekaar aur wahiyat aadmi hai&#10;तू बहुत ही घटिया और बदतमीज इंसान है&#10;I really appreciate the constructive insights!"
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7] focus:ring-2 focus:ring-[#EEEAFE] leading-relaxed transition-all"
                  />
                  {batchText && (
                    <button
                      type="button"
                      onClick={() => setBatchText('')}
                      className="absolute bottom-3 right-3 text-[11px] text-[#858795] hover:text-[#20212B]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBatchIngest}
                      disabled={isIngesting || !batchText.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4BC4] text-white text-xs font-semibold shadow-sm shadow-[#6C5CE7]/20 transition-all disabled:opacity-50"
                    >
                      {isIngesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing Through Local Engine...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Analyze Comments Locally</span>
                        </>
                      )}
                    </button>

                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deduplicate}
                        onChange={(e) => setDeduplicate(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-[#6C5CE7] focus:ring-0"
                      />
                      <span>Deduplicate in batch</span>
                    </label>
                  </div>


                </div>
              </div>
            )}

            {/* TAB 2: CSV / FILE UPLOAD */}
            {ingestMode === 'csv' && (
              <div className="space-y-4">
                <div className="p-8 rounded-2xl border-2 border-dashed border-[#E9EAF1] bg-[#FBFBFE] flex flex-col items-center justify-center text-center hover:border-[#6C5CE7]/50 hover:bg-[#F5F6FA] transition-colors">
                  <Upload className="w-10 h-10 text-[#6C5CE7] mb-2 opacity-80" />
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="text-xs text-[#858795] file:mr-3 file:py-1.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-[#6C5CE7] file:text-white hover:file:bg-[#5B4BC4] cursor-pointer"
                  />
                  <p className="text-[11px] text-[#858795] mt-2">
                    Auto-detects columns: <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E9EAF1]">comment</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E9EAF1]">text</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E9EAF1]">content</code>, <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-[#E9EAF1]">body</code>.
                  </p>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleBatchIngest}
                      disabled={isIngesting || !csvFile}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4BC4] text-white text-xs font-semibold shadow-sm shadow-[#6C5CE7]/20 transition-all disabled:opacity-50"
                    >
                      {isIngesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing Dataset...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Analyze Dataset File</span>
                        </>
                      )}
                    </button>

                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={deduplicate}
                        onChange={(e) => setDeduplicate(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-[#6C5CE7] focus:ring-0"
                      />
                      <span>Deduplicate in file</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: YOUTUBE INGESTION */}
            {ingestMode === 'youtube' && (
              <div className="space-y-4">


                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-bold text-[#20212B] uppercase tracking-wide">
                      YouTube Video URL or Video ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                      value={ytVideoInput}
                      onChange={(e) => setYtVideoInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-rose-500 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#20212B] uppercase tracking-wide">
                      Fetch Limit
                    </label>
                    <select
                      value={ytMaxComments}
                      onChange={(e) => setYtMaxComments(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:bg-white focus:border-rose-500 cursor-pointer"
                    >
                      <option value={20}>20 comments</option>
                      <option value={50}>50 comments (Recommended)</option>
                      <option value={100}>100 comments</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleSocialFetch('youtube')}
                      disabled={isIngesting || !ytVideoInput.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      {isIngesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching &amp; Ingesting YouTube Comments...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Fetch &amp; Moderate YouTube Comments</span>
                        </>
                      )}
                    </button>

                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ytIncludeReplies}
                        onChange={(e) => setYtIncludeReplies(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-rose-600 focus:ring-0"
                      />
                      <span>Include nested comment replies</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: INSTAGRAM INGESTION */}
            {ingestMode === 'instagram' && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 text-white text-xs flex items-center gap-2 shadow-xs">
                  <Instagram className="w-4 h-4 text-white shrink-0" />
                  <span>Fetch and moderate comments from Instagram posts, reels, or media IDs via official Instagram Graph API.</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-bold text-[#20212B] uppercase tracking-wide">
                      Instagram Post / Reel URL or Media ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://www.instagram.com/p/C1xYz... or https://www.instagram.com/reel/C1xYz... or 17989355321012345"
                      value={igMediaInput}
                      onChange={(e) => setIgMediaInput(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-pink-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#20212B] uppercase tracking-wide">
                      Max Comments
                    </label>
                    <select
                      value={igMaxComments}
                      onChange={(e) => setIgMaxComments(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:bg-white focus:border-pink-500 cursor-pointer"
                    >
                      <option value={10}>10 comments</option>
                      <option value={25}>25 comments (Recommended)</option>
                      <option value={50}>50 comments</option>
                      <option value={100}>100 comments</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleSocialFetch('instagram')}
                      disabled={isIngesting || !igMediaInput.trim()}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                    >
                      {isIngesting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Fetching Instagram Comments...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Fetch &amp; Moderate Instagram Comments</span>
                        </>
                      )}
                    </button>

                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={igIncludeReplies}
                        onChange={(e) => setIgIncludeReplies(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-pink-600 focus:ring-0"
                      />
                      <span>Include nested comment replies</span>
                    </label>
                  </div>
                </div>
              </div>
            )}


            {/* Batch Result Impact Banner */}
            {batchResult && (
              <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-3 page-enter">
                <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-[#E9EAF1]">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#20212B]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Batch Ingestion Completed in {batchResult.processing_time_ms ? `${batchResult.processing_time_ms.toFixed(1)} ms` : '0 ms'}
                    </span>
                    <span className="text-[10px] text-[#6C5CE7] bg-[#EEEAFE] border border-[#6C5CE7]/20 px-2 py-0.5 rounded-full font-semibold">
                      Telemetry &amp; Charts Synchronized
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] tabular-nums">
                    <span className="px-2 py-0.5 rounded bg-white text-[#20212B] border border-[#E9EAF1]">
                      Total: {batchResult.total_received ?? batchResult.total_fetched}
                    </span>
                    {batchResult.duplicate_count > 0 && (
                      <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Duplicates: {batchResult.duplicate_count}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                      Flagged Harmful: {batchResult.flagged_count}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Approved Safe: {batchResult.approved_count}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-52 overflow-y-auto rounded-lg border border-[#E9EAF1] divide-y divide-[#E9EAF1] bg-white">
                  {(batchResult.items || batchResult.records || []).map((it: any) => (
                    <div key={it.id} className="p-2.5 text-xs flex items-center justify-between gap-3 hover:bg-[#F8F9FE]">
                      <div className="min-w-0 flex-1">
                        <p className="text-[#20212B] font-medium truncate">{it.text}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#858795] mt-0.5">
                          {it.author_name && (
                            <span className="font-semibold text-[#20212B]">@{it.author_name}</span>
                          )}
                          <span className="text-[#6C5CE7] capitalize font-semibold">{it.detected_language}</span>
                          <span>•</span>
                          <span className="tabular-nums">{it.processing_time_ms ? `${it.processing_time_ms.toFixed(1)}ms` : '< 3ms'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {it.toxicity_score !== null && (
                          <span className={`text-[11px] font-bold tabular-nums ${
                            it.toxicity_score >= 0.4 ? 'text-rose-600' : 'text-emerald-600'
                          }`}>
                            {(it.toxicity_score * 100).toFixed(0)}%
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          it.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          it.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {it.severity}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          it.decision === 'no_action'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          {it.decision.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Detection Volume & Incident Trends Area Chart */}
          <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#6C5CE7]" />
                  <span>Detection Volume &amp; Incident Trends</span>
                </h3>
                <p className="text-[11px] text-[#858795] mt-0.5">
                  Continuous timeline monitoring of total vs. flagged violations across all feeds.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6C5CE7]" />
                  <span className="text-[#858795] text-[11px]">Total Monitored</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#FF7675]" />
                  <span className="text-[#858795] text-[11px]">Flagged Violations</span>
                </div>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6C5CE7" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6C5CE7" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="flaggedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF7675" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#FF7675" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F1F5" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#858795"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#E9EAF1' }}
                    tickFormatter={(val) => {
                      try {
                        const d = new Date(val);
                        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      } catch {
                        return val;
                      }
                    }}
                  />
                  <YAxis
                    stroke="#858795"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTimelineTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#6C5CE7"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#totalGrad)"
                    name="Total Monitored"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                  <Area
                    type="monotone"
                    dataKey="flagged"
                    stroke="#FF7675"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#flaggedGrad)"
                    name="Flagged Violations"
                    isAnimationActive={true}
                    animationDuration={500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 3. Live Comment Telemetry Stream */}
          <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#6C5CE7]" />
                  <span>Live Comment Telemetry Stream</span>
                </h3>
                <p className="text-[11px] text-[#858795] mt-0.5">
                  Streaming model decisions for recently ingested comments and social monitoring feeds.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#6C5CE7] bg-[#EEEAFE] border border-[#6C5CE7]/20 px-2.5 py-1 rounded-full font-semibold">
                  {recent.length} Active Records
                </span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[#E9EAF1]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] uppercase font-semibold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Comment Text</th>
                    <th className="py-2.5 px-3">Platform</th>
                    <th className="py-2.5 px-3">Language</th>
                    <th className="py-2.5 px-3">Severity</th>
                    <th className="py-2.5 px-3">Decision</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E9EAF1]">
                  {recent.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#858795]">
                        No comments recorded yet. Use the Real-Time Ingestion Console above to analyze comments!
                      </td>
                    </tr>
                  ) : (
                    recent.map((rec) => (
                      <tr key={rec.id} className="hover:bg-[#F8F9FE] transition-colors">
                        <td className="py-2.5 px-3 max-w-xs truncate font-medium text-[#20212B]">
                          {rec.text_preview}
                          {rec.author_name && (
                            <span className="block text-[10px] text-[#858795] font-normal">by @{rec.author_name}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <PlatformBadge platform={rec.platform} sourceUrl={rec.source_url} />
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="capitalize px-2 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#6C5CE7]/20 text-[10px] font-semibold">
                            {rec.detected_language}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                            rec.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            rec.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            rec.severity === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {rec.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold capitalize text-[#20212B]">
                          {rec.decision.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                            rec.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            rec.status === 'escalated' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {rec.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#858795] tabular-nums text-[10px]">
                          {new Date(rec.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right 1 Column: Statistical Breakdowns & Review Queue (Courseu Right Rail) ── */}
        <div className="space-y-6">
          
          {/* Language Distribution Donut */}
          <DonutPanel
            title={t('dashboard.dist.language', 'Language Distribution')}
            icon={Globe}
            data={toChartData(distributions?.language_distribution)}
            colors={LANG_COLORS}
            loading={loading}
          />

          {/* Platform Distribution Donut */}
          <DonutPanel
            title="Platform Distribution"
            icon={Share2}
            data={toChartData(distributions?.platform_distribution)}
            colors={PLATFORM_COLORS}
            loading={loading}
          />

          {/* Severity Distribution Donut */}
          <DonutPanel
            title={t('dashboard.dist.severity', 'Severity Distribution')}
            icon={AlertTriangle}
            data={toChartData(distributions?.severity_distribution)}
            colors={SEVERITY_COLORS}
            loading={loading}
          />

          {/* Violation Categories Donut */}
          <DonutPanel
            title={t('dashboard.dist.category', 'Violation Categories')}
            icon={Layers}
            data={toChartData(distributions?.category_distribution)}
            colors={CATEGORY_COLORS}
            loading={loading}
          />

          {/* Pending Review Action Queue */}
          <div className="bg-white border border-[#E9EAF1] rounded-2xl p-6 shadow-[0_2px_12px_rgba(32,33,43,0.03)] card-interactive">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#20212B] flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-500" />
                  <span>Pending Review Queue</span>
                </h3>
                <p className="text-[11px] text-[#858795] mt-0.5">
                  Flagged items awaiting consequential human oversight.
                </p>
              </div>
              <a
                href="/moderation"
                className="text-xs text-[#6C5CE7] hover:text-[#5B4BC4] font-semibold flex items-center gap-1"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="space-y-2.5">
              {queue.length === 0 ? (
                <div className="p-6 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-center text-xs text-[#858795]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-70" />
                  No pending items in queue. All clear!
                </div>
              ) : (
                queue.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] hover:border-[#6C5CE7]/40 transition-colors text-xs space-y-1.5"
                  >
                    <p className="text-[#20212B] font-medium line-clamp-1">{item.text_preview}</p>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="capitalize text-[#858795]">{item.detected_language}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase border ${
                        item.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {item.severity}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}
