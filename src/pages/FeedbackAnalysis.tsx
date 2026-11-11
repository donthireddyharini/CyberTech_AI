import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Sparkles, Search, Filter, Check, X, Copy, Download, ChevronRight,
  ShieldAlert, Clock, Globe, RefreshCw, CheckCircle2, AlertOctagon,
  AlertTriangle, HelpCircle, Flame, FileSpreadsheet, Eye
} from 'lucide-react';
import { feedbackApi, moderationApi, socialApi } from '../api/client';
import type { FeedbackRecord, SocialSyncLog } from '../types';
import { useToast } from '../App';
import { useTranslation } from '../i18n/I18nContext';

const LOCAL_HISTORY_KEY = 'sentinel_social_sync_history_v2';
const LOCAL_REVIEW_MAP_KEY = 'sentinel_investigation_reviews_v1';

export interface HighRiskInvestigationCase {
  id: string;
  record_id: string;
  comment_text: string;
  language: string;
  platform: string;
  severity: string;
  decision: string;
  status: string;
  hate_speech_score: number;
  harassment_score: number;
  cyberbullying_score: number;
  legitimate_score: number;
  is_confirmed?: boolean;
  is_false_positive?: boolean;
  is_false_negative?: boolean;
  is_ambiguous?: boolean;
  explanation?: string;
  human_review?: string | null;
  created_at: string;
  source_title?: string;
  model_version?: string;
}

interface UserReviewEntry {
  decision: 'correct' | 'false_positive' | 'false_negative' | 'ambiguous';
  explanation: string;
  updated_at: string;
}

function loadLocalSyncHistory(): SocialSyncLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadLocalReviewMap(): Record<string, UserReviewEntry> {
  try {
    const raw = localStorage.getItem(LOCAL_REVIEW_MAP_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function saveLocalReviewMap(map: Record<string, UserReviewEntry>) {
  try {
    localStorage.setItem(LOCAL_REVIEW_MAP_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export default function FeedbackAnalysis() {
  const [cases, setCases] = useState<HighRiskInvestigationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskType, setSelectedRiskType] = useState<'all' | 'high_severity' | 'high_harassment'>('all');
  const [selectedLangFilter, setSelectedLangFilter] = useState<string>('all');
  const [selectedPlatformFilter, setSelectedPlatformFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'pending' | 'reviewed'>('all');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Drawer / Investigation State
  const [selectedItem, setSelectedItem] = useState<HighRiskInvestigationCase | null>(null);
  const [drawerDecision, setDrawerDecision] = useState<'correct' | 'false_positive' | 'false_negative' | 'ambiguous' | null>(null);
  const [drawerExplanation, setDrawerExplanation] = useState('');
  const [isUpdatingDecision, setIsUpdatingDecision] = useState(false);

  const { addToast } = useToast();
  const { t } = useTranslation();

  // Aggregate only detected comments that have High Harassment OR High Severity
  const fetchAllHighRiskCases = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      // 1. Fetch server sync history, moderation queue, and existing feedback
      const [syncResp, modResp, fbResp] = await Promise.allSettled([
        socialApi.getSyncHistory(undefined, 100),
        moderationApi.list({ page_size: 200 }),
        feedbackApi.list({ page: 1 }),
      ]);

      const localSyncLogs = loadLocalSyncHistory();
      const serverSyncLogs: SocialSyncLog[] =
        syncResp.status === 'fulfilled' && Array.isArray(syncResp.value.data)
          ? syncResp.value.data
          : [];

      // Combine sync logs (avoid duplicate runs)
      const syncLogsMap = new Map<string, SocialSyncLog>();
      for (const log of [...localSyncLogs, ...serverSyncLogs]) {
        if (!log || !log.id) continue;
        if (!syncLogsMap.has(log.id) || ((log.records?.length || 0) > (syncLogsMap.get(log.id)?.records?.length || 0))) {
          syncLogsMap.set(log.id, log);
        }
      }

      // Existing feedback map
      const feedbackItems: FeedbackRecord[] =
        fbResp.status === 'fulfilled' && Array.isArray(fbResp.value.data?.items)
          ? fbResp.value.data.items
          : [];

      const feedbackMap = new Map<string, FeedbackRecord>();
      for (const fb of feedbackItems) {
        if (fb.record_id) feedbackMap.set(fb.record_id, fb);
        feedbackMap.set(fb.id, fb);
      }

      const userReviewMap = loadLocalReviewMap();

      const candidateMap = new Map<string, HighRiskInvestigationCase>();

      // A. Extract from all Social Sync Ingested Comments (YouTube, Instagram, CSV, Manual)
      for (const log of syncLogsMap.values()) {
        if (!log.records || !Array.isArray(log.records)) continue;
        for (const r of log.records) {
          const text = (r.text || '').trim();
          if (!text) continue;

          const sev = (r.severity || 'low').toLowerCase();
          const harassmentScore = r.harassment_score ?? 0;
          const isHighSev = sev === 'high' || sev === 'uncertain';
          const isHighHarassment = harassmentScore >= 0.4 || (r.severity_reason?.toLowerCase().includes('harassment') ?? false);

          // ONLY High Severity OR High Harassment comments belong in this section
          if (!isHighSev && !isHighHarassment) continue;

          const key = text.toLowerCase();
          if (!candidateMap.has(key)) {
            const fbMatch = feedbackMap.get(r.id) || feedbackMap.get(r.comment_id);
            const userReview = userReviewMap[r.id] || userReviewMap[r.comment_id];

            candidateMap.set(key, {
              id: r.id || r.comment_id,
              record_id: r.comment_id || r.id,
              comment_text: text,
              language: r.detected_language || 'english',
              platform: r.platform || log.platform || 'direct',
              severity: isHighSev ? 'high' : sev,
              decision: r.decision || 'flag_for_review',
              status: userReview ? 'reviewed' : (fbMatch?.status || (r.is_flagged ? 'flagged' : 'pending')),
              hate_speech_score: r.hate_speech_score ?? 0,
              harassment_score: harassmentScore,
              cyberbullying_score: r.cyberbullying_score ?? 0,
              legitimate_score: r.legitimate_score ?? 0,
              is_confirmed: userReview ? userReview.decision === 'correct' : fbMatch?.is_confirmed,
              is_false_positive: userReview ? userReview.decision === 'false_positive' : fbMatch?.is_false_positive,
              is_false_negative: userReview ? userReview.decision === 'false_negative' : fbMatch?.is_false_negative,
              is_ambiguous: userReview ? userReview.decision === 'ambiguous' : fbMatch?.is_ambiguous,
              explanation: userReview?.explanation || fbMatch?.explanation || '',
              human_review: userReview ? userReview.decision.replace(/_/g, ' ') : fbMatch?.human_review,
              created_at: r.published_at || log.created_at || new Date().toISOString(),
              source_title: log.media_title || log.channel_name || log.target_input,
              model_version: 'v2.1',
            });
          }
        }
      }

      // B. Extract from Moderation Server Queue
      if (modResp.status === 'fulfilled' && modResp.value.data?.items) {
        for (const m of modResp.value.data.items) {
          const text = (m.original_text || '').trim();
          if (!text) continue;

          const sev = (m.severity || 'low').toLowerCase();
          const harassmentScore = m.harassment_score ?? 0;
          const isHighSev = sev === 'high' || sev === 'uncertain';
          const isHighHarassment = harassmentScore >= 0.4;

          if (!isHighSev && !isHighHarassment) continue;

          const key = text.toLowerCase();
          if (!candidateMap.has(key)) {
            const fbMatch = feedbackMap.get(m.id);
            const userReview = userReviewMap[m.id];

            candidateMap.set(key, {
              id: m.id,
              record_id: m.id,
              comment_text: text,
              language: m.detected_language || 'english',
              platform: m.platform || 'direct',
              severity: isHighSev ? 'high' : sev,
              decision: m.decision || 'flag_for_review',
              status: userReview ? 'reviewed' : (m.status || 'pending'),
              hate_speech_score: m.hate_speech_score ?? 0,
              harassment_score: harassmentScore,
              cyberbullying_score: m.cyberbullying_score ?? 0,
              legitimate_score: m.legitimate_score ?? 0,
              is_confirmed: userReview ? userReview.decision === 'correct' : fbMatch?.is_confirmed,
              is_false_positive: userReview ? userReview.decision === 'false_positive' : fbMatch?.is_false_positive,
              is_false_negative: userReview ? userReview.decision === 'false_negative' : fbMatch?.is_false_negative,
              is_ambiguous: userReview ? userReview.decision === 'ambiguous' : fbMatch?.is_ambiguous,
              explanation: userReview?.explanation || fbMatch?.explanation || '',
              human_review: userReview ? userReview.decision.replace(/_/g, ' ') : fbMatch?.human_review,
              created_at: m.created_at || new Date().toISOString(),
              model_version: m.model_version || 'v2.1',
            });
          }
        }
      }

      // C. Extract from Feedback Items directly if high severity or high harassment
      for (const fb of feedbackItems) {
        const text = (fb.comment_text || fb.explanation || '').trim();
        if (!text) continue;
        const sev = (fb.severity || 'low').toLowerCase();
        const harassmentScore = fb.harassment_score ?? 0;
        const isHighSev = sev === 'high';
        const isHighHarassment = harassmentScore >= 0.4;

        if (isHighSev || isHighHarassment) {
          const key = text.toLowerCase();
          if (!candidateMap.has(key)) {
            const userReview = userReviewMap[fb.id] || (fb.record_id ? userReviewMap[fb.record_id] : null);
            candidateMap.set(key, {
              id: fb.id,
              record_id: fb.record_id || fb.id,
              comment_text: text,
              language: fb.language || 'english',
              platform: fb.platform || 'direct',
              severity: isHighSev ? 'high' : sev,
              decision: fb.decision || 'flag_for_review',
              status: fb.status || 'reviewed',
              hate_speech_score: fb.hate_speech_score ?? 0,
              harassment_score: harassmentScore,
              cyberbullying_score: fb.cyberbullying_score ?? 0,
              legitimate_score: fb.legitimate_score ?? 0,
              is_confirmed: userReview ? userReview.decision === 'correct' : fb.is_confirmed,
              is_false_positive: userReview ? userReview.decision === 'false_positive' : fb.is_false_positive,
              is_false_negative: userReview ? userReview.decision === 'false_negative' : fb.is_false_negative,
              is_ambiguous: userReview ? userReview.decision === 'ambiguous' : fb.is_ambiguous,
              explanation: userReview?.explanation || fb.explanation || '',
              human_review: userReview ? userReview.decision.replace(/_/g, ' ') : fb.human_review,
              created_at: fb.created_at || new Date().toISOString(),
              model_version: fb.model_version || 'v2.1',
            });
          }
        }
      }

      // Sort by newest first
      const allList = Array.from(candidateMap.values()).sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setCases(allList);
      if (isManual) {
        addToast(`Refreshed ${allList.length} high-severity and high-harassment cases from all detected channels.`, 'success');
      }
    } catch (err: any) {
      console.error('Failed to load high-risk detection cases:', err);
      addToast(err.message || 'Failed to load high-risk cases', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchAllHighRiskCases();
  }, [fetchAllHighRiskCases]);

  // Filtered List
  const filteredCases = useMemo(() => {
    return cases.filter(item => {
      // Risk Type Filter
      if (selectedRiskType === 'high_severity' && item.severity !== 'high') return false;
      if (selectedRiskType === 'high_harassment' && (item.harassment_score ?? 0) < 0.4) return false;

      // Platform Filter
      if (selectedPlatformFilter !== 'all') {
        const itemPlat = (item.platform || '').toLowerCase();
        if (!itemPlat.includes(selectedPlatformFilter.toLowerCase())) return false;
      }

      // Language Filter
      if (selectedLangFilter !== 'all') {
        const itemLang = (item.language || '').toLowerCase();
        if (!itemLang.includes(selectedLangFilter.toLowerCase())) return false;
      }

      // Review Status Filter
      if (selectedStatusFilter === 'reviewed') {
        const isReviewed = item.is_confirmed || item.is_false_positive || item.is_false_negative || item.is_ambiguous || item.status === 'reviewed';
        if (!isReviewed) return false;
      } else if (selectedStatusFilter === 'pending') {
        const isReviewed = item.is_confirmed || item.is_false_positive || item.is_false_negative || item.is_ambiguous || item.status === 'reviewed';
        if (isReviewed) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = item.comment_text.toLowerCase().includes(query);
        const matchesId = item.id.toLowerCase().includes(query) || item.record_id.toLowerCase().includes(query);
        const matchesLang = item.language.toLowerCase().includes(query);
        const matchesNotes = (item.explanation || '').toLowerCase().includes(query);
        if (!matchesText && !matchesId && !matchesLang && !matchesNotes) return false;
      }

      return true;
    });
  }, [cases, selectedRiskType, selectedPlatformFilter, selectedLangFilter, selectedStatusFilter, searchQuery]);

  // Summary Metrics for the Banner
  const metrics = useMemo(() => {
    const total = cases.length;
    const highSev = cases.filter(c => c.severity === 'high').length;
    const highHar = cases.filter(c => (c.harassment_score ?? 0) >= 0.4).length;
    const reviewed = cases.filter(c => c.is_confirmed || c.is_false_positive || c.is_false_negative || c.is_ambiguous || c.status === 'reviewed').length;
    const pending = total - reviewed;
    return { total, highSev, highHar, reviewed, pending };
  }, [cases]);

  // Open Drawer for investigation
  const openInvestigation = (item: HighRiskInvestigationCase) => {
    setSelectedItem(item);
    setDrawerExplanation(item.explanation || '');
    if (item.is_confirmed) setDrawerDecision('correct');
    else if (item.is_false_positive) setDrawerDecision('false_positive');
    else if (item.is_false_negative) setDrawerDecision('false_negative');
    else if (item.is_ambiguous) setDrawerDecision('ambiguous');
    else setDrawerDecision(null);
  };

  // Submit decision update
  const handleUpdateDecision = async () => {
    if (!selectedItem || !drawerDecision) return;
    setIsUpdatingDecision(true);
    try {
      await feedbackApi.submit({
        record_id: selectedItem.record_id || selectedItem.id,
        is_confirmed: drawerDecision === 'correct',
        is_false_positive: drawerDecision === 'false_positive',
        is_false_negative: drawerDecision === 'false_negative',
        is_ambiguous: drawerDecision === 'ambiguous',
        explanation: drawerExplanation || `Updated review decision: ${drawerDecision}`,
        language: selectedItem.language || 'english',
        model_version: selectedItem.model_version || 'v2.1',
      });

      // Update local storage review map
      const reviewMap = loadLocalReviewMap();
      reviewMap[selectedItem.id] = {
        decision: drawerDecision,
        explanation: drawerExplanation,
        updated_at: new Date().toISOString(),
      };
      if (selectedItem.record_id) {
        reviewMap[selectedItem.record_id] = reviewMap[selectedItem.id];
      }
      saveLocalReviewMap(reviewMap);

      // Update in-memory state immediately
      setCases(prev => prev.map(c => {
        if (c.id === selectedItem.id || c.record_id === selectedItem.record_id) {
          return {
            ...c,
            is_confirmed: drawerDecision === 'correct',
            is_false_positive: drawerDecision === 'false_positive',
            is_false_negative: drawerDecision === 'false_negative',
            is_ambiguous: drawerDecision === 'ambiguous',
            explanation: drawerExplanation,
            status: 'reviewed',
            human_review: drawerDecision.replace(/_/g, ' '),
          };
        }
        return c;
      }));

      addToast(`Updated review decision to ${drawerDecision.replace(/_/g, ' ')} successfully.`, 'success');
      setSelectedItem(null);
    } catch (err: any) {
      addToast(err.message || 'Failed to update review decision', 'error');
    } finally {
      setIsUpdatingDecision(false);
    }
  };

  // Export filtered high-risk cases to CSV
  const handleExportCsv = () => {
    if (filteredCases.length === 0) {
      addToast('No high-risk records to export', 'info');
      return;
    }

    const headers = [
      'Record ID',
      'Comment Text',
      'Platform',
      'Language',
      'Severity',
      'Harassment Score (%)',
      'Hate Speech Score (%)',
      'Cyberbullying Score (%)',
      'Model Decision',
      'Review Status',
      'Human Review Verdict',
      'Reviewer Notes',
      'Date'
    ];

    const rows = filteredCases.map(item => [
      `"${item.id}"`,
      `"${item.comment_text.replace(/"/g, '""')}"`,
      `"${item.platform}"`,
      `"${item.language}"`,
      `"${item.severity}"`,
      `${((item.harassment_score || 0) * 100).toFixed(1)}`,
      `${((item.hate_speech_score || 0) * 100).toFixed(1)}`,
      `${((item.cyberbullying_score || 0) * 100).toFixed(1)}`,
      `"${item.decision}"`,
      `"${item.status}"`,
      `"${item.is_confirmed ? 'Confirmed Correct' : item.is_false_positive ? 'False Positive' : item.is_false_negative ? 'False Negative' : item.is_ambiguous ? 'Ambiguous' : 'Pending'}"`,
      `"${(item.explanation || '').replace(/"/g, '""')}"`,
      `"${new Date(item.created_at).toLocaleString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cybertech_high_risk_cases_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast(`Exported ${filteredCases.length} high-risk cases to CSV.`, 'success');
  };

  // Paginated records
  const paginatedCases = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCases.slice(start, start + pageSize);
  }, [filteredCases, page, pageSize]);

  return (
    <div className="space-y-6 max-w-screen-2xl page-enter pb-16">
      
      {/* ═══════════════════════════════════════════════════════════════════════
          HUMAN REVIEW ANNOTATIONS & CASE INVESTIGATION WORKSPACE
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-[#E9EAF1] shadow-xs overflow-hidden">
        
        {/* Section Header */}
        <div className="p-4 sm:p-6 border-b border-[#E9EAF1] bg-gradient-to-r from-white via-[#FDFDFF] to-[#FAF8FF]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#6C5CE7] to-[#A29BFE] flex items-center justify-center text-white shadow-md shadow-[#6C5CE7]/20 shrink-0">
                <ShieldAlert className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold text-[#20212B] tracking-tight">
                    Human Review Annotations &amp; Case Investigation
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1 shrink-0">
                    <Flame className="w-3 h-3 text-rose-500 shrink-0" />
                    <span>High Harassment &amp; High Severity Only</span>
                  </span>
                </div>
                <p className="text-xs text-[#858795] mt-1 max-w-3xl leading-relaxed">
                  Dedicated investigation queue consolidating all detected high-severity violations and high-harassment comments across YouTube, Instagram, CSV file imports, and manual chat.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end flex-wrap">
              <button
                onClick={handleExportCsv}
                disabled={filteredCases.length === 0}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                title="Export high-risk investigation records as CSV"
              >
                <Download className="w-3.5 h-3.5 text-[#6C5CE7] shrink-0" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => fetchAllHighRiskCases(true)}
                disabled={refreshing || loading}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Syncing...' : 'Refresh Cases'}</span>
              </button>
            </div>

          </div>

          {/* High-Risk Metric Pill Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 mt-5 pt-4 border-t border-[#E9EAF1]">
            <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1]">
              <span className="text-[10px] uppercase font-bold text-[#858795] block tracking-wider">Total High-Risk Cases</span>
              <div className="text-lg sm:text-2xl font-black text-[#20212B] mt-1 tabular-nums">{metrics.total}</div>
            </div>

            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/80">
              <span className="text-[10px] uppercase font-bold text-rose-700 block tracking-wider">High Severity</span>
              <div className="text-lg sm:text-2xl font-black text-rose-700 mt-1 tabular-nums">{metrics.highSev}</div>
            </div>

            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/80">
              <span className="text-[10px] uppercase font-bold text-amber-700 block tracking-wider">High Harassment (≥40%)</span>
              <div className="text-lg sm:text-2xl font-black text-amber-700 mt-1 tabular-nums">{metrics.highHar}</div>
            </div>

            <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
              <span className="text-[10px] uppercase font-bold text-emerald-700 block tracking-wider">Human Reviewed</span>
              <div className="text-lg sm:text-2xl font-black text-emerald-700 mt-1 tabular-nums">{metrics.reviewed}</div>
            </div>

            <div className="col-span-2 sm:col-span-1 p-3 bg-[#EEEAFE]/60 rounded-xl border border-[#DDD6FE]">
              <span className="text-[10px] uppercase font-bold text-[#6C5CE7] block tracking-wider">Pending Action</span>
              <div className="text-lg sm:text-2xl font-black text-[#6C5CE7] mt-1 tabular-nums">{metrics.pending}</div>
            </div>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E9EAF1] bg-[#FDFDFF] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3">
            
            {/* Search Input */}
            <div className="sm:col-span-4 relative">
              <Search className="w-3.5 h-3.5 text-[#858795] absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search comments, ID, or notes..."
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#E9EAF1] rounded-xl text-xs text-[#20212B] placeholder-[#858795] focus:bg-white focus:outline-none focus:border-[#6C5CE7] transition-colors shadow-2xs"
              />
            </div>

            {/* Risk Criteria Filter */}
            <div className="sm:col-span-3 flex items-center gap-1.5 bg-white border border-[#E9EAF1] rounded-xl px-2.5 py-1 shadow-2xs">
              <Filter className="w-3.5 h-3.5 text-[#858795] shrink-0" />
              <select
                value={selectedRiskType}
                onChange={(e) => {
                  setSelectedRiskType(e.target.value as any);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs text-[#20212B] focus:outline-none cursor-pointer py-1 font-medium"
              >
                <option value="all">All High-Risk Cases</option>
                <option value="high_severity">High Severity Only</option>
                <option value="high_harassment">High Harassment (≥40%)</option>
              </select>
            </div>

            {/* Platform Filter */}
            <div className="sm:col-span-2 flex items-center gap-1.5 bg-white border border-[#E9EAF1] rounded-xl px-2.5 py-1 shadow-2xs">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#858795] shrink-0" />
              <select
                value={selectedPlatformFilter}
                onChange={(e) => {
                  setSelectedPlatformFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs text-[#20212B] focus:outline-none cursor-pointer py-1 font-medium capitalize"
              >
                <option value="all">All Sources</option>
                <option value="youtube">YouTube</option>
                <option value="instagram">Instagram</option>
                <option value="csv">CSV Import</option>
                <option value="manual">Manual Batch</option>
              </select>
            </div>

            {/* Language Filter */}
            <div className="sm:col-span-3 flex items-center gap-1.5 bg-white border border-[#E9EAF1] rounded-xl px-2.5 py-1 shadow-2xs">
              <Globe className="w-3.5 h-3.5 text-[#858795] shrink-0" />
              <select
                value={selectedLangFilter}
                onChange={(e) => {
                  setSelectedLangFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs text-[#20212B] focus:outline-none cursor-pointer py-1 capitalize font-medium"
              >
                <option value="all">All Languages</option>
                <option value="telugu">Telugu</option>
                <option value="hindi">Hindi</option>
                <option value="hinglish">Hinglish</option>
                <option value="kannada">Kannada</option>
                <option value="english">English</option>
              </select>
            </div>

          </div>

          {/* Secondary Filter & Status Strip */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs text-[#858795]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-[#20212B]">Status Filter:</span>
              {[
                { id: 'all', label: `All (${filteredCases.length})` },
                { id: 'pending', label: 'Pending Review' },
                { id: 'reviewed', label: 'Human Reviewed' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedStatusFilter(tab.id as any);
                    setPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedStatusFilter === tab.id
                      ? 'bg-[#6C5CE7] text-white shadow-xs'
                      : 'bg-white hover:bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-semibold text-[#858795] bg-[#F5F6FA] px-2.5 py-1 rounded-lg border border-[#E9EAF1]">
              Showing <strong className="text-[#20212B]">{filteredCases.length}</strong> matching records
            </div>
          </div>
        </div>

        {/* ── Mobile Card View (md:hidden) ── */}
        <div className="md:hidden divide-y divide-[#E9EAF1]">
          {loading ? (
            <div className="p-6 space-y-3">
              {[0, 1, 2].map(i => (
                <div key={i} className="h-28 bg-[#F8F9FE] border border-[#E9EAF1] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : paginatedCases.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center mx-auto">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-[#20212B]">No High-Risk Detection Records Found</h4>
              <p className="text-xs text-[#858795] max-w-sm mx-auto">
                No comments matching high-severity or high-harassment criteria. Run detections in Social Media Ingestion to populate this queue.
              </p>
            </div>
          ) : (
            paginatedCases.map(item => (
              <div
                key={item.id}
                onClick={() => openInvestigation(item)}
                className="p-4 bg-white hover:bg-[#FBFBFE] space-y-2.5 cursor-pointer active:scale-[0.99] transition-all"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] font-bold text-[#6C5CE7]">
                      #{(item.record_id || item.id).slice(0, 8)}
                    </span>
                    <span className="capitalize text-[10px] px-2 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-bold text-[#6C5CE7]">
                      {item.language}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                      {item.platform}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {item.severity === 'high' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-50 text-rose-700 border border-rose-200">
                        High Severity
                      </span>
                    )}
                    {(item.harassment_score ?? 0) >= 0.4 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200">
                        Har: {Math.round((item.harassment_score || 0) * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs font-semibold text-[#20212B] break-words line-clamp-3 leading-relaxed">
                  "{item.comment_text}"
                </p>

                {/* Score indicators */}
                <div className="flex items-center gap-3 text-[10px] font-mono bg-[#F8F9FE] p-2 rounded-lg border border-[#E9EAF1]">
                  <div className="flex items-center gap-1">
                    <span className="text-[#858795]">Harassment:</span>
                    <span className="font-bold text-amber-600">
                      {Math.round((item.harassment_score || 0) * 100)}%
                    </span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#858795]">Hate Speech:</span>
                    <span className="font-bold text-rose-600">
                      {Math.round((item.hate_speech_score || 0) * 100)}%
                    </span>
                  </div>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[#858795]">Cyberbully:</span>
                    <span className="font-bold text-purple-600">
                      {Math.round((item.cyberbullying_score || 0) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div>
                    {item.is_confirmed ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Confirmed
                      </span>
                    ) : item.is_false_positive ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                        <AlertOctagon className="w-3 h-3" /> False Positive
                      </span>
                    ) : item.is_false_negative ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> False Negative
                      </span>
                    ) : item.is_ambiguous ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] inline-flex items-center gap-1">
                        <HelpCircle className="w-3 h-3" /> Ambiguous
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                        Pending Review
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openInvestigation(item);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Investigate</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Desktop Scannable Table (hidden md:block) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-3.5">Record ID</th>
                <th className="py-3 px-3">High-Risk Comment Text</th>
                <th className="py-3 px-3">Source</th>
                <th className="py-3 px-3">Language</th>
                <th className="py-3 px-3">Severity</th>
                <th className="py-3 px-3">Harassment Level</th>
                <th className="py-3 px-3">Model Decision</th>
                <th className="py-3 px-3">Human Review Status</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F1F5] bg-white">
              {loading ? (
                [0, 1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={10} className="py-4 px-4 bg-[#F8F9FE]/40">
                      <div className="h-4 bg-[#E9EAF1] rounded w-full" />
                    </td>
                  </tr>
                ))
              ) : paginatedCases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-14 text-center text-[#858795] text-xs space-y-2">
                    <div className="w-10 h-10 rounded-xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="font-bold text-[#20212B]">No High-Risk Detection Records Found</div>
                    <p className="max-w-md mx-auto text-[11px] text-[#858795]">
                      No comments matching high severity or harassment criteria. Analyze videos, posts, or CSVs in Social Media Ingestion to feed this queue.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCases.map(item => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#F8F9FE]/80 transition-colors group cursor-pointer"
                    onClick={() => openInvestigation(item)}
                  >
                    <td className="py-3 px-3.5 font-mono text-[#6C5CE7] font-semibold whitespace-nowrap">
                      #{(item.record_id || item.id).slice(0, 8)}
                    </td>

                    <td className="py-3 px-3 max-w-[280px] text-[#20212B] font-medium" title={item.comment_text}>
                      <div className="truncate" title={item.comment_text}>
                        "{item.comment_text}"
                      </div>
                      {item.explanation && (
                        <div className="text-[10px] text-[#858795] italic truncate mt-0.5">
                          Notes: {item.explanation}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                        {item.platform}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="capitalize text-[10px] px-2.5 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-bold text-[#6C5CE7]">
                        {item.language}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                        item.severity === 'high'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {item.severity}
                      </span>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-2 bg-[#F0F1F5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              (item.harassment_score || 0) >= 0.7
                                ? 'bg-rose-500'
                                : (item.harassment_score || 0) >= 0.4
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.round((item.harassment_score || 0) * 100)}%` }}
                          />
                        </div>
                        <span className={`font-mono text-[11px] font-bold ${
                          (item.harassment_score || 0) >= 0.4 ? 'text-amber-700' : 'text-[#20212B]'
                        }`}>
                          {Math.round((item.harassment_score || 0) * 100)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap capitalize font-medium text-[#20212B]">
                      {item.decision.replace(/_/g, ' ')}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {item.is_confirmed ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Confirmed
                        </span>
                      ) : item.is_false_positive ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 inline-flex items-center gap-1">
                          <AlertOctagon className="w-3 h-3" /> False Positive
                        </span>
                      ) : item.is_false_negative ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> False Negative
                        </span>
                      ) : item.is_ambiguous ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] inline-flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" /> Ambiguous
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                          Pending Review
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-[#858795] text-[11px] tabular-nums whitespace-nowrap">
                      {new Date(item.created_at).toLocaleDateString()}
                    </td>

                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openInvestigation(item);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Investigate</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {filteredCases.length > 0 && (
          <div className="p-3.5 sm:p-4 bg-[#F8F9FE] border-t border-[#E9EAF1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#858795]">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <span>
                Showing <strong className="text-[#20212B] font-mono">{(page - 1) * pageSize + 1}</strong>–<strong className="text-[#20212B] font-mono">{Math.min(page * pageSize, filteredCases.length)}</strong> of <strong className="text-[#20212B] font-mono">{filteredCases.length}</strong> high-risk cases
              </span>
              <span className="text-[#DDD6FE] hidden sm:inline">•</span>
              <label className="flex items-center gap-1.5 text-[11px]">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-0.5 rounded-lg border border-[#E9EAF1] bg-white text-[#20212B] font-semibold text-[11px] cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </label>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-1.5">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg border border-[#E9EAF1] bg-white hover:bg-[#F0F1F5] text-[#20212B] disabled:opacity-40 cursor-pointer text-xs font-semibold shadow-2xs transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-[11px] font-bold text-[#6C5CE7]">
                Page {page} of {Math.ceil(filteredCases.length / pageSize) || 1}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(Math.ceil(filteredCases.length / pageSize), p + 1))}
                disabled={page >= Math.ceil(filteredCases.length / pageSize)}
                className="px-3 py-1.5 rounded-lg border border-[#E9EAF1] bg-white hover:bg-[#F0F1F5] text-[#20212B] disabled:opacity-40 cursor-pointer text-xs font-semibold shadow-2xs transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SLIDE-OVER CASE INVESTIGATION DRAWER
          ═══════════════════════════════════════════════════════════════════════ */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-white border-l border-[#E9EAF1] h-full p-6 shadow-2xl flex flex-col justify-between overflow-y-auto slide-in-right">
            
            <div className="space-y-5">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#E9EAF1]">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7]">
                    <ShieldAlert className="w-5 h-5 text-[#6C5CE7]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#20212B]">Case Investigation Panel</h3>
                    <p className="text-[11px] text-[#858795] font-mono">
                      Record: {selectedItem.record_id || selectedItem.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 rounded-lg text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target High-Risk Comment */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                    Original High-Risk Comment
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F5F6FA] text-[#858795] border border-[#E9EAF1]">
                      {selectedItem.platform}
                    </span>
                    <span className="capitalize text-[10px] px-2 py-0.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] font-bold text-[#6C5CE7]">
                      {selectedItem.language}
                    </span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-xs text-[#20212B] font-medium leading-relaxed max-h-48 overflow-y-auto break-words select-text shadow-inner">
                  "{selectedItem.comment_text}"
                </div>
              </div>

              {/* Status & Severity Strip */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                  selectedItem.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  Severity: {selectedItem.severity}
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  Harassment: {Math.round((selectedItem.harassment_score || 0) * 100)}%
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-white border border-[#E9EAF1] text-[#858795] capitalize">
                  Decision: {selectedItem.decision.replace(/_/g, ' ')}
                </span>

                {selectedItem.created_at && (
                  <span className="text-[10px] text-[#858795] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#858795]" />
                    {new Date(selectedItem.created_at).toLocaleString()}
                  </span>
                )}
              </div>

              {/* Category Scores Breakdown with Visual Bars */}
              <div className="p-3.5 bg-[#FBFBFE] rounded-xl border border-[#E9EAF1] space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#858795]">
                  <span>Model Category Scores</span>
                  <span className="text-[10px] text-[#6C5CE7] lowercase font-semibold">calibrated multi-category</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  {[
                    { label: 'Harassment', score: selectedItem.harassment_score ?? 0.0, isHarm: (selectedItem.harassment_score ?? 0) >= 0.4 },
                    { label: 'Hate Speech', score: selectedItem.hate_speech_score ?? 0.0, isHarm: (selectedItem.hate_speech_score ?? 0) >= 0.4 },
                    { label: 'Cyberbullying', score: selectedItem.cyberbullying_score ?? 0.0, isHarm: (selectedItem.cyberbullying_score ?? 0) >= 0.4 },
                    { label: 'Legitimate', score: selectedItem.legitimate_score ?? 0.0, isHarm: false },
                  ].map((cat) => {
                    const pct = Math.round((cat.score || 0) * 100);
                    return (
                      <div key={cat.label} className="p-2 bg-white rounded-lg border border-[#E9EAF1] space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[#858795] text-[10px] font-medium">{cat.label}:</span>
                          <span className={`font-mono font-bold ${cat.isHarm ? 'text-rose-600' : 'text-[#20212B]'}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#F0F1F5] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              cat.label === 'Legitimate' ? 'bg-emerald-500' : cat.isHarm ? 'bg-rose-500' : 'bg-amber-400'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Case Metadata Strip */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1]">
                  <span className="text-[10px] uppercase font-semibold text-[#858795] block">Language Domain</span>
                  <span className="font-bold text-[#20212B] capitalize mt-0.5 block">{selectedItem.language}</span>
                </div>
                <div className="p-3 bg-[#F8F9FE] rounded-xl border border-[#E9EAF1]">
                  <span className="text-[10px] uppercase font-semibold text-[#858795] block">Model Pipeline</span>
                  <span className="font-mono text-[#6C5CE7] text-[11px] font-semibold mt-0.5 block">{selectedItem.model_version || 'v2.1'}</span>
                </div>
              </div>

              {/* Linked Record Reference */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                  Linked Record Reference
                </label>
                <div className="p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] font-mono text-[11px] text-[#20212B] flex items-center justify-between">
                  <span className="truncate">{selectedItem.record_id || selectedItem.id}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedItem.record_id || selectedItem.id);
                      addToast('Copied record reference ID to clipboard', 'info');
                    }}
                    className="p-1 rounded hover:bg-[#E9EAF1] text-[#858795] hover:text-[#20212B] cursor-pointer"
                    title="Copy ID"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Decision Workflow Controls */}
              <div className="space-y-2.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B] flex items-center justify-between">
                  <span>Human Ground Truth Decision</span>
                  <span className="text-[10px] text-[#6C5CE7] normal-case">Select to record verdict</span>
                </label>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setDrawerDecision('correct')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      drawerDecision === 'correct'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Confirm Correct</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerDecision('false_positive')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      drawerDecision === 'false_positive'
                        ? 'bg-amber-50 border-amber-600 text-amber-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>False Positive</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerDecision('false_negative')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      drawerDecision === 'false_negative'
                        ? 'bg-rose-50 border-rose-600 text-rose-700 shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>False Negative</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDrawerDecision('ambiguous')}
                    className={`p-3 rounded-xl border font-bold flex items-center gap-2 transition-all cursor-pointer ${
                      drawerDecision === 'ambiguous'
                        ? 'bg-[#EEEAFE] border-[#6C5CE7] text-[#6C5CE7] shadow-xs'
                        : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                    }`}
                  >
                    <HelpCircle className="w-4 h-4 text-[#6C5CE7] shrink-0" />
                    <span>Ambiguous Case</span>
                  </button>
                </div>
              </div>

              {/* Reviewer Explanation / Notes */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#20212B]">
                  Reviewer Rationale &amp; Notes
                </label>
                <textarea
                  rows={3}
                  value={drawerExplanation}
                  onChange={(e) => setDrawerExplanation(e.target.value)}
                  placeholder="Describe linguistic nuances, sarcasm, slang, or justification for this verdict..."
                  className="w-full p-3 bg-[#FBFBFE] border border-[#E9EAF1] rounded-xl text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7] transition-colors"
                />
              </div>

            </div>

            {/* Drawer Action Bar */}
            <div className="pt-4 border-t border-[#E9EAF1] flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                className="flex-1 py-2.5 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateDecision}
                disabled={isUpdatingDecision || !drawerDecision}
                className="flex-1 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {isUpdatingDecision ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isUpdatingDecision ? 'Saving...' : 'Save Decision'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
