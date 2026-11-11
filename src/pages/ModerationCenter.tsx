import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShieldAlert, Search, Filter, AlertTriangle,
  Clock, Download, ChevronLeft, ChevronRight, X, ExternalLink,
  RefreshCw, Youtube, Instagram, FileText, FileSpreadsheet,
  Layers, PlusCircle, Eye, Trash2, ChevronDown, ChevronUp,
  Sparkles, Globe, User, ArrowRight
} from 'lucide-react';
import { moderationApi, feedbackApi, socialApi } from '../api/client';
import type {
  ModerationRecord,
  ModerationDetail,
  SocialSyncLog,
  SocialIngestedCommentRecord
} from '../types';
import {
  loadAuditSessions,
  saveAuditSessions,
  getActiveAuditSessionId,
  setActiveAuditSessionId,
  createNewAuditSession,
  filterSyncLogsForSession,
  filterSyncLogsForSessionAndTab,
  getTabCountsForSession,
  buildQueueRecordsForSession,
  matchesPlatformTab,
  type AuditSession
} from '../utils/auditSessions';
import { useToast } from '../App';
import { useAuth } from '../context/AuthContext';

const LOCAL_HISTORY_KEY = 'sentinel_social_sync_history_v2';
const ACTIVE_SYNC_KEY = 'sentinel_active_channel_sync_id';

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

function saveLocalSyncHistory(items: SocialSyncLog[]) {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // ignore storage errors
  }
}

function mergeSyncHistories(serverItems: SocialSyncLog[], localItems: SocialSyncLog[]): SocialSyncLog[] {
  const byId = new Map<string, SocialSyncLog>();
  for (const item of [...localItems, ...serverItems]) {
    if (!item || !item.id) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      byId.set(item.id, item);
    } else {
      const hasRecords = (existing.records?.length || 0) >= (item.records?.length || 0);
      byId.set(item.id, {
        ...item,
        ...existing,
        records: hasRecords ? existing.records : item.records,
      });
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function PlatformBadge({ platform, sourceUrl }: { platform?: string | null; sourceUrl?: string | null }) {
  const p = (platform || 'manual').toLowerCase();
  let badgeClass = 'bg-indigo-50 text-indigo-700 border-indigo-200';
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
    Icon = FileSpreadsheet;
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

export default function ModerationCenter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Records Table State
  const [records, setRecords] = useState<ModerationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'youtube' || tabParam === 'instagram' || tabParam === 'manual' || tabParam === 'csv_upload') {
      return tabParam;
    }
    return '';
  });

  // Saved Detection Runs Across All Sources (YouTube, Instagram, Direct Text / Manual, CSV File Imports)
  const [syncHistory, setSyncHistory] = useState<SocialSyncLog[]>(() => loadLocalSyncHistory());
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedSyncLog, setSelectedSyncLog] = useState<SocialSyncLog | null>(null);
  const [channelCommentFilter, setChannelCommentFilter] = useState<'all' | 'flagged' | 'safe'>('all');
  const [channelLanguageFilter, setChannelLanguageFilter] = useState<string>('all');
  const [channelSearchQuery, setChannelSearchQuery] = useState('');
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [modalComment, setModalComment] = useState<SocialIngestedCommentRecord | null>(null);

  // Unified Audit Sessions State (Persisted across tabs & Social Media Ingestion)
  const [auditSessions, setAuditSessions] = useState<AuditSession[]>(() => loadAuditSessions());
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedId = getActiveAuditSessionId();
    const loaded = loadAuditSessions();
    if (savedId !== 'all' && !loaded.some(s => s.id === savedId)) {
      return 'all';
    }
    return savedId;
  });

  // Selected record for Slide-over Review Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ModerationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Review Form
  const [reviewAction, setReviewAction] = useState<'approve' | 'dismiss' | 'escalate' | 'further_review'>('approve');
  const [overrideReason, setOverrideReason] = useState('');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [correctedSeverity, setCorrectedSeverity] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const { addToast } = useToast();

  // Keep URL query param ?tab=... in sync
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'youtube' || tabParam === 'instagram' || tabParam === 'manual' || tabParam === 'csv_upload') {
      if (platformFilter !== tabParam) {
        setPlatformFilter(tabParam);
      }
    }
  }, [searchParams, platformFilter]);

  const fetchSyncHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await socialApi.getSyncHistory(undefined, 50);
      const rawData = res.data as unknown;
      const serverItems: SocialSyncLog[] = Array.isArray(rawData)
        ? rawData
        : Array.isArray((rawData as { items?: SocialSyncLog[] })?.items)
        ? (rawData as { items: SocialSyncLog[] }).items
        : [];
      const localItems = loadLocalSyncHistory();
      const merged = mergeSyncHistories(serverItems, localItems);
      setSyncHistory(merged);
      saveLocalSyncHistory(merged);
    } catch {
      const localItems = loadLocalSyncHistory();
      setSyncHistory(localItems);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchSyncHistory();
  }, []);

  // Category-wise tab counts for the currently active Audit Session (or 'all' history)
  const tabCountsForActiveSession = useMemo(() => {
    return getTabCountsForSession(syncHistory, activeSessionId, auditSessions);
  }, [syncHistory, activeSessionId, auditSessions]);

  // Saved detection runs filtered by the active Audit Session AND the active category tab
  const platformSyncHistory = useMemo(() => {
    return filterSyncLogsForSessionAndTab(syncHistory, activeSessionId, auditSessions, platformFilter);
  }, [syncHistory, activeSessionId, auditSessions, platformFilter]);

  // Active Audit Session metadata object (when a specific session is selected)
  const currentAuditSession = useMemo(() => {
    if (activeSessionId === 'all') return null;
    return auditSessions.find(s => s.id === activeSessionId) || null;
  }, [activeSessionId, auditSessions]);

  // Filtered Moderation Queue records for the active Audit Session & tab
  const displayedQueueRecords = useMemo(() => {
    return buildQueueRecordsForSession(
      records,
      syncHistory,
      activeSessionId,
      auditSessions,
      platformFilter,
      {
        status: statusFilter,
        severity: severityFilter,
        language: languageFilter,
        search,
      }
    );
  }, [records, syncHistory, activeSessionId, auditSessions, platformFilter, statusFilter, severityFilter, languageFilter, search]);

  // Auto-select the matching run card when switching tabs or sessions
  useEffect(() => {
    if (platformSyncHistory.length === 0) {
      setSelectedSyncLog(null);
      return;
    }

    if (selectedSyncLog && platformSyncHistory.some(item => item.id === selectedSyncLog.id)) {
      const refreshed = platformSyncHistory.find(item => item.id === selectedSyncLog.id);
      if (refreshed) {
        setSelectedSyncLog(refreshed);
        return;
      }
    }

    const preferredId = localStorage.getItem(ACTIVE_SYNC_KEY);
    const preferredMatch = preferredId ? platformSyncHistory.find(item => item.id === preferredId) : undefined;
    setSelectedSyncLog(preferredMatch || platformSyncHistory[0]);
    setChannelCommentFilter('all');
    setChannelLanguageFilter('all');
    setChannelSearchQuery('');
    setExpandedCommentId(null);
  }, [platformFilter, platformSyncHistory]);

  const handleSelectSyncLog = async (log: SocialSyncLog) => {
    setSelectedSyncLog(log);
    setChannelCommentFilter('all');
    setChannelLanguageFilter('all');
    setChannelSearchQuery('');
    setExpandedCommentId(null);
    try {
      localStorage.setItem(ACTIVE_SYNC_KEY, log.id);
    } catch {}

    if (!log.records || log.records.length === 0) {
      try {
        const detailRes = await socialApi.getSyncDetail(log.id);
        if (detailRes.data && detailRes.data.records) {
          setSelectedSyncLog(detailRes.data);
          setSyncHistory(prev => {
            const next = prev.map(item => (item.id === log.id ? detailRes.data : item));
            saveLocalSyncHistory(next);
            return next;
          });
        }
      } catch {
        // fallback to existing log
      }
    }
  };

  const handleDeleteSyncLog = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await socialApi.deleteSyncLog(id);
    } catch {
      // also remove locally
    }
    const updated = syncHistory.filter(item => item.id !== id);
    setSyncHistory(updated);
    saveLocalSyncHistory(updated);
    if (selectedSyncLog?.id === id) {
      const remainingForTab = filterSyncLogsForSessionAndTab(updated, activeSessionId, auditSessions, platformFilter);
      setSelectedSyncLog(remainingForTab[0] || null);
    }
    addToast('Detection run removed from history.', 'info');
  };

  // Start a fresh, empty Audit Session — only new detections performed after this will appear in this session category-wise
  const handleNewSession = () => {
    const newSess = createNewAuditSession(auditSessions, Date.now());
    const nextSessions = [newSess, ...auditSessions];
    setAuditSessions(nextSessions);
    saveAuditSessions(nextSessions);
    setActiveSessionId(newSess.id);
    setActiveAuditSessionId(newSess.id);
    setSelectedSyncLog(null);
    setPage(1);
    addToast(
      `Started fresh "${newSess.name}". All category tabs are now empty and ready to store new detections!`,
      'success'
    );
  };

  const handleSelectAuditSession = (sessId: string) => {
    setActiveSessionId(sessId);
    setActiveAuditSessionId(sessId);
    setSelectedSyncLog(null);
    setPage(1);
  };

  const handleDeleteAuditSession = (e: React.MouseEvent, sessId: string) => {
    e.stopPropagation();
    const nextSessions = auditSessions.filter(s => s.id !== sessId);
    setAuditSessions(nextSessions);
    saveAuditSessions(nextSessions);
    if (activeSessionId === sessId) {
      const fallbackId = nextSessions[0]?.id || 'all';
      setActiveSessionId(fallbackId);
      setActiveAuditSessionId(fallbackId);
    }
    addToast('Audit session removed.', 'info');
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const resp = await moderationApi.list({
        page,
        page_size: 15,
        status: statusFilter || undefined,
        severity: severityFilter || undefined,
        language: languageFilter || undefined,
        platform: platformFilter || undefined,
        search: search || undefined,
      });
      setRecords(resp.data.items);
      setTotal(resp.data.total);
      setTotalPages(resp.data.total_pages);
    } catch (err: any) {
      addToast(err.message || 'Failed to load moderation records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, statusFilter, severityFilter, languageFilter, platformFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const openDetail = async (id: string, fallbackComment?: SocialIngestedCommentRecord, parentLog?: SocialSyncLog | null) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const resp = await moderationApi.getDetail(id);
      setDetail(resp.data);
      setCorrectedSeverity(resp.data.severity);
      setOverrideReason('');
      setReviewerNotes('');
    } catch (err: any) {
      if (fallbackComment) {
        const fallbackDetail: ModerationDetail = {
          id: fallbackComment.id,
          original_text: fallbackComment.text,
          normalized_text: fallbackComment.text,
          context_before: null,
          context_after: null,
          detected_language: fallbackComment.detected_language,
          hate_speech_score: fallbackComment.hate_speech_score ?? 0,
          harassment_score: fallbackComment.harassment_score ?? 0,
          cyberbullying_score: fallbackComment.cyberbullying_score ?? 0,
          legitimate_score: fallbackComment.legitimate_score ?? (fallbackComment.is_flagged ? 0.15 : 0.92),
          severity: fallbackComment.severity,
          decision: fallbackComment.decision,
          severity_reason: fallbackComment.severity_reason ?? null,
          ambiguity_warning: null,
          recommended_action: fallbackComment.recommended_action ?? null,
          confidence_level: fallbackComment.confidence_level ?? 'high',
          language_hint: null,
          model_name: 'IndicBERT-Sentinel-XLM',
          model_version: '2.4.1',
          status: fallbackComment.is_flagged ? 'pending' : 'reviewed',
          platform: fallbackComment.platform || parentLog?.platform || 'manual',
          source_id: fallbackComment.comment_id || null,
          source_url: fallbackComment.source_url || parentLog?.source_url || null,
          author_name: fallbackComment.author_name || null,
          parent_comment_id: fallbackComment.parent_id || null,
          is_demo: false,
          is_code_mixed: Boolean(fallbackComment.is_code_mixed),
          created_at: fallbackComment.published_at || parentLog?.created_at || new Date().toISOString(),
          inference_timestamp: Date.now(),
          processing_time_ms: fallbackComment.processing_time_ms ?? 18,
          labels: fallbackComment.labels || [],
          reviews: [],
        };
        setDetail(fallbackDetail);
        setCorrectedSeverity(fallbackDetail.severity);
        setOverrideReason('');
        setReviewerNotes('');
      } else {
        addToast(err.message || 'Failed to load details', 'error');
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDecisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setSubmittingReview(true);
    try {
      await moderationApi.submitDecision(selectedId, {
        action: reviewAction,
        corrected_severity: correctedSeverity !== detail?.severity ? correctedSeverity : undefined,
        override_reason: overrideReason || undefined,
        reviewer_notes: reviewerNotes || undefined,
        reviewer_id: user?.id || 'user-01',
        reviewer_name: user?.name || user?.email || 'Account User',
      });

      const isConfirmed = reviewAction === 'approve';
      const isFalsePositive = reviewAction === 'dismiss';
      const isFalseNegative = reviewAction === 'escalate';
      const isAmbiguous = reviewAction === 'further_review';

      await feedbackApi.submit({
        record_id: selectedId,
        is_confirmed: isConfirmed,
        is_false_positive: isFalsePositive,
        is_false_negative: isFalseNegative,
        is_ambiguous: isAmbiguous,
        predicted_severity: detail?.severity,
        corrected_severity: correctedSeverity,
        explanation: overrideReason || reviewerNotes || `Review decision: ${reviewAction}`,
        language: detail?.detected_language,
        model_version: detail?.model_version,
      });

      const newIsFlagged = reviewAction === 'escalate' || reviewAction === 'further_review';
      const newDecision =
        reviewAction === 'approve' || reviewAction === 'dismiss'
          ? 'auto_approve'
          : reviewAction === 'escalate'
          ? 'escalate_high_priority'
          : 'flagged_for_review';

      setSyncHistory(prev => {
        const next = prev.map(log => {
          if (!log.records) return log;
          const hasMatch = log.records.some(r => r.id === selectedId);
          if (!hasMatch) return log;
          return {
            ...log,
            records: log.records.map(r =>
              r.id === selectedId
                ? {
                    ...r,
                    is_flagged: newIsFlagged,
                    decision: newDecision,
                    severity: correctedSeverity || r.severity,
                  }
                : r
            ),
          };
        });
        saveLocalSyncHistory(next);
        return next;
      });

      if (selectedSyncLog?.records?.some(r => r.id === selectedId)) {
        setSelectedSyncLog(prev =>
          prev
            ? {
                ...prev,
                records: prev.records?.map(r =>
                  r.id === selectedId
                    ? {
                        ...r,
                        is_flagged: newIsFlagged,
                        decision: newDecision,
                        severity: correctedSeverity || r.severity,
                      }
                    : r
                ),
              }
            : null
        );
      }

      addToast(`Action '${reviewAction}' recorded successfully`, 'success');
      setSelectedId(null);
      setDetail(null);
      fetchRecords();
    } catch (err: any) {
      addToast(err.message || 'Failed to submit decision', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  const exportCSV = () => {
    if (selectedSyncLog?.records?.length) {
      const headers = ['ID', 'Source / Channel', 'Author', 'Comment Text', 'Language', 'Severity', 'Decision', 'Hate Speech', 'Harassment', 'Cyberbullying'];
      const rows = selectedSyncLog.records.map(r => [
        `"${r.id}"`,
        `"${(selectedSyncLog.channel_name || '').replace(/"/g, '""')}"`,
        `"${(r.author_name || '').replace(/"/g, '""')}"`,
        `"${(r.text || '').replace(/"/g, '""')}"`,
        r.detected_language,
        r.severity,
        r.decision,
        ((r.hate_speech_score ?? 0) * 100).toFixed(0) + '%',
        ((r.harassment_score ?? 0) * 100).toFixed(0) + '%',
        ((r.cyberbullying_score ?? 0) * 100).toFixed(0) + '%',
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `detection_${selectedSyncLog.channel_name || 'export'}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      addToast(`Exported ${selectedSyncLog.records.length} comments to CSV`, 'info');
      return;
    }

    if (records.length === 0) {
      addToast('No records to export', 'warning');
      return;
    }
    const headers = ['ID', 'Original Text', 'Severity', 'Decision', 'Status', 'Language', 'Created At'];
    const rows = records.map(r => [
      `"${r.id}"`,
      `"${r.original_text.replace(/"/g, '""')}"`,
      r.severity,
      r.decision,
      r.status,
      r.detected_language,
      r.created_at
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cybertech_moderation_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Records exported to CSV', 'info');
  };

  // Filtered comments inside the active detection run
  const activeChannelComments = useMemo(() => {
    const list = selectedSyncLog?.records || [];
    return list.filter(c => {
      if (channelCommentFilter === 'flagged' && !c.is_flagged) return false;
      if (channelCommentFilter === 'safe' && c.is_flagged) return false;
      if (channelLanguageFilter !== 'all' && c.detected_language.toLowerCase() !== channelLanguageFilter.toLowerCase()) return false;
      if (channelSearchQuery.trim()) {
        const q = channelSearchQuery.toLowerCase();
        const inText = (c.text || '').toLowerCase().includes(q);
        const inAuthor = (c.author_name || '').toLowerCase().includes(q);
        const inReason = (c.severity_reason || '').toLowerCase().includes(q);
        if (!inText && !inAuthor && !inReason) return false;
      }
      return true;
    });
  }, [selectedSyncLog, channelCommentFilter, channelLanguageFilter, channelSearchQuery]);

  const activeChannelLanguages = useMemo(() => {
    const set = new Set<string>();
    (selectedSyncLog?.records || []).forEach(r => {
      if (r.detected_language) set.add(r.detected_language.toLowerCase());
    });
    return Array.from(set);
  }, [selectedSyncLog]);

  // Dynamic section title & badge per tab
  const tabHistoryMeta = useMemo(() => {
    if (platformFilter === 'youtube') {
      return {
        title: 'Saved YouTube Channel Detection Runs',
        subtitle: 'Click any saved YouTube channel card below to view all retrieved comments (up to 50 comments) and their NLP detection details.',
        badgeLabel: 'Saved YouTube Runs',
        emptyTitle: 'No YouTube channel detection runs saved yet',
        emptySubtitle: 'Fetch any YouTube video in the Social Media Ingestion tab to automatically save its channel name and 50 analyzed comments here.',
        Icon: Youtube,
        iconColor: 'text-rose-600',
      };
    }
    if (platformFilter === 'instagram') {
      return {
        title: 'Saved Instagram Handle / Post Detection Runs',
        subtitle: 'Click any saved Instagram handle card below to view all retrieved comments (up to 50 comments) and their NLP detection details.',
        badgeLabel: 'Saved Instagram Runs',
        emptyTitle: 'No Instagram handle detection runs saved yet',
        emptySubtitle: 'Fetch any Instagram post or reel in the Social Media Ingestion tab to automatically save its handle and 50 analyzed comments here.',
        Icon: Instagram,
        iconColor: 'text-pink-600',
      };
    }
    if (platformFilter === 'manual') {
      return {
        title: 'Saved Direct Text / Manual Detection Runs',
        subtitle: 'Click any saved manual batch card below to inspect all analyzed comments, 4-category NLP scores, and submit review decisions.',
        badgeLabel: 'Saved Manual Runs',
        emptyTitle: 'No Direct Text / Manual detection runs saved yet',
        emptySubtitle: 'Analyze comments in Custom Manual Entry inside Social Media Ingestion to automatically save the batch and detection details here.',
        Icon: FileText,
        iconColor: 'text-indigo-600',
      };
    }
    if (platformFilter === 'csv_upload') {
      return {
        title: 'Saved CSV File & Dataset Detection Runs',
        subtitle: 'Click any saved CSV file import or dataset run card below to inspect all analyzed rows and their NLP detection details.',
        badgeLabel: 'Saved CSV Runs',
        emptyTitle: 'No CSV file detection runs saved yet',
        emptySubtitle: 'Upload a CSV file in Social Media Ingestion to automatically save the file run and all analyzed rows here.',
        Icon: FileSpreadsheet,
        iconColor: 'text-cyan-600',
      };
    }
    return {
      title: 'All Saved Detection Runs (YouTube, Instagram, Direct Text & CSV Imports)',
      subtitle: 'Click any saved channel, handle, manual batch, or CSV import card below to view all retrieved comments and their NLP detection details.',
      badgeLabel: 'Saved Runs Across All Sources',
      emptyTitle: 'No detection runs saved yet',
      emptySubtitle: 'Run YouTube, Instagram, Manual Text, or CSV File detection in Social Media Ingestion to inspect them here.',
      Icon: Layers,
      iconColor: 'text-[#6C5CE7]',
    };
  }, [platformFilter]);

  const HeaderIcon = tabHistoryMeta.Icon;

  return (
    <div className="space-y-5 md:space-y-7 max-w-screen-2xl page-enter pb-12 max-w-full overflow-x-hidden">
      {/* Page Header */}
      <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3.5 sm:gap-4">
        <div className="flex items-start sm:items-center gap-3 min-w-0 w-full sm:w-auto">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shadow-xs shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#6C5CE7]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold text-[#20212B] tracking-tight break-words">
              Moderator Command Center
            </h1>
            <p className="text-xs text-[#858795] mt-0.5 break-words leading-relaxed">
              Inspect saved detection runs across YouTube, Instagram, Direct Text, and CSV imports, view 4-category NLP scores, and verify records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#6C5CE7] shrink-0" />
            <span className="truncate">Export CSV</span>
          </button>
          <button
            onClick={() => {
              fetchRecords();
              fetchSyncHistory();
            }}
            disabled={loading || loadingHistory}
            className="flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-white hover:bg-[#F8F9FE] border border-[#E9EAF1] text-[#20212B] text-xs font-medium shadow-xs transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${(loading || loadingHistory) ? 'animate-spin text-[#6C5CE7]' : ''}`} />
            <span className="truncate">Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* ── Source Navigation Tabs + Audit Session Controls ── */}
      <div className="bg-white rounded-2xl border border-[#E9EAF1] p-3.5 sm:p-4 shadow-xs space-y-3 max-w-full overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[#E9EAF1]">
          {/* 5 Category Tabs — Clean 2-col grid on mobile, inline flex on desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full lg:w-auto">
            {[
              { key: '', label: 'All Sources', shortLabel: 'All Sources', icon: Layers, spanMobile: true },
              { key: 'youtube', label: 'YouTube Comments', shortLabel: 'YouTube', icon: Youtube, spanMobile: false },
              { key: 'instagram', label: 'Instagram Comments', shortLabel: 'Instagram', icon: Instagram, spanMobile: false },
              { key: 'manual', label: 'Direct Text / Manual', shortLabel: 'Direct Text', icon: FileText, spanMobile: false },
              { key: 'csv_upload', label: 'CSV File Imports', shortLabel: 'CSV Imports', icon: FileSpreadsheet, spanMobile: false },
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = platformFilter === tab.key;
              const countForTab = tabCountsForActiveSession[tab.key] ?? 0;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setPlatformFilter(tab.key);
                    setPage(1);
                    if (tab.key) {
                      setSearchParams({ tab: tab.key });
                    } else {
                      setSearchParams({});
                    }
                    fetchSyncHistory();
                  }}
                  className={`${tab.spanMobile ? 'col-span-2 sm:col-span-1' : 'col-span-1'} flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border min-w-0 ${
                    isActive
                      ? 'bg-[#EEEAFE] text-[#6C5CE7] border-[#DDD6FE] shadow-xs'
                      : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="sm:hidden truncate">{tab.shortLabel}</span>
                    <span className="hidden sm:inline truncate">{tab.label}</span>
                  </span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums shrink-0 ${
                    isActive ? 'bg-[#6C5CE7] text-white' : 'bg-[#E9EAF1] text-[#5A5D6D]'
                  }`}>
                    {countForTab}
                  </span>
                </button>
              );
            })}
          </div>

          {/* New Audit Session Action */}
          <button
            type="button"
            onClick={handleNewSession}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/20 transition-all cursor-pointer w-full lg:w-auto shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5 shrink-0" />
            <span>New Audit Session</span>
          </button>
        </div>

        {/* Sessions Filter Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#858795] flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3 text-[#6C5CE7]" />
              <span>Audit Sessions:</span>
            </span>

            <button
              type="button"
              onClick={() => handleSelectAuditSession('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                activeSessionId === 'all'
                  ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                  : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
              }`}
            >
              All History ({syncHistory.length})
            </button>

            {auditSessions.map(sess => {
              const isActive = activeSessionId === sess.id;
              const sessionRunCount = filterSyncLogsForSession(syncHistory, sess.id, auditSessions).length;
              return (
                <div
                  key={sess.id}
                  onClick={() => handleSelectAuditSession(sess.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold cursor-pointer border transition-colors ${
                    isActive
                      ? 'bg-[#6C5CE7] text-white border-[#6C5CE7] shadow-xs'
                      : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                  }`}
                >
                  <span className="truncate max-w-[180px]">{sess.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#E9EAF1] text-[#5A5D6D]'
                    }`}
                  >
                    {sessionRunCount}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteAuditSession(e, sess.id)}
                    title="Delete this audit session"
                    className={`p-0.5 rounded hover:bg-black/10 transition-colors ${
                      isActive ? 'text-white/80 hover:text-white' : 'text-[#858795] hover:text-rose-600'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-semibold shrink-0">
            {currentAuditSession
              ? `Active: ${currentAuditSession.name}`
              : '✓ Preserved in DB & Storage'}
          </span>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          UNIFIED SAVED DETECTION RUNS CARDS + RETRIEVED COMMENTS & DETECTION INSPECTOR
          (Works for All Sources, YouTube Comments, Instagram Comments, Direct Text / Manual, and CSV File Imports)
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-6">
        {/* Saved Detection Run Cards */}
        <div className="bg-white rounded-2xl border border-[#E9EAF1] p-4 sm:p-6 shadow-xs space-y-4 max-w-full overflow-hidden">
          <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-sm sm:text-base font-bold text-[#20212B] flex items-center gap-2 break-words">
                <HeaderIcon className={`w-4 h-4 shrink-0 ${tabHistoryMeta.iconColor}`} />
                <span className="break-words">{tabHistoryMeta.title}</span>
              </h2>
              <p className="text-xs text-[#858795] mt-0.5 break-words leading-relaxed">
                {currentAuditSession
                  ? `Showing detections recorded during ${currentAuditSession.name}. New detections are stored category-wise across tabs.`
                  : tabHistoryMeta.subtitle}
              </p>
            </div>
            <span className="text-xs font-bold text-[#6C5CE7] bg-[#EEEAFE] px-3 py-1 rounded-xl border border-[#DDD6FE] tabular-nums shrink-0">
              {platformSyncHistory.length} {tabHistoryMeta.badgeLabel}
            </span>
          </div>

          {platformSyncHistory.length === 0 ? (
            <div className="p-5 sm:p-8 text-center rounded-2xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-3">
              <div className="w-11 h-11 rounded-2xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center mx-auto border border-[#DDD6FE]">
                <HeaderIcon className="w-5 h-5" />
              </div>
              <div className="space-y-1 max-w-xl mx-auto">
                <p className="text-sm font-bold text-[#20212B] break-words">
                  {currentAuditSession
                    ? `${currentAuditSession.name} — Fresh Empty Session (0 Detections)`
                    : tabHistoryMeta.emptyTitle}
                </p>
                <p className="text-xs text-[#858795] break-words leading-relaxed">
                  {currentAuditSession
                    ? 'No comments have been detected in this new audit session yet. Detect YouTube, Instagram, Direct Text, or CSV comments now — they will automatically be stored here category-wise across all tabs.'
                    : tabHistoryMeta.emptySubtitle}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/social-ingestion')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                >
                  <span>Detect New Comments Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                {currentAuditSession && syncHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSelectAuditSession('all')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-[#F0F1F5] text-[#20212B] border border-[#E9EAF1] text-xs font-semibold transition-all cursor-pointer"
                  >
                    <span>View All Prior History ({syncHistory.length})</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {platformSyncHistory.map(log => {
                const isSelected = selectedSyncLog?.id === log.id;
                const p = (log.platform || 'manual').toLowerCase();
                const isYouTube = p === 'youtube';
                const isInstagram = p === 'instagram' || p === 'ig';
                const isCsv = p === 'csv_upload' || p.includes('csv');
                const retrievedCount = log.total_fetched || log.records?.length || 0;
                const flaggedCount = log.flagged_count || 0;
                const safeCount = log.approved_count ?? Math.max(0, retrievedCount - flaggedCount);
                const langEntries = Object.entries(log.language_breakdown || {});

                const badgeStyle = isYouTube
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isInstagram
                  ? 'bg-pink-50 text-pink-700 border-pink-200'
                  : isCsv
                  ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200';

                const badgeText = isYouTube
                  ? 'YouTube Channel'
                  : isInstagram
                  ? 'Instagram Handle'
                  : isCsv
                  ? 'CSV File Import'
                  : 'Direct Text Batch';

                const BadgeIcon = isYouTube
                  ? Youtube
                  : isInstagram
                  ? Instagram
                  : isCsv
                  ? FileSpreadsheet
                  : FileText;

                return (
                  <div
                    key={log.id}
                    onClick={() => handleSelectSyncLog(log)}
                    className={`group rounded-2xl border p-3.5 sm:p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 min-w-0 max-w-full overflow-hidden ${
                      isSelected
                        ? 'bg-[#F8F7FF] border-[#6C5CE7] ring-2 ring-[#6C5CE7]/15 shadow-sm'
                        : 'bg-white border-[#E9EAF1] hover:border-[#6C5CE7]/50 hover:bg-[#FBFBFE]'
                    }`}
                  >
                    <div className="space-y-3 min-w-0">
                      {/* Top row: Platform & Timestamp + Delete */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${badgeStyle}`}
                        >
                          <BadgeIcon className="w-3 h-3 shrink-0" />
                          <span>{badgeText}</span>
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-[#858795] tabular-nums">
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSyncLog(e, log.id)}
                            title="Remove detection run"
                            className="p-1 rounded-lg text-[#858795] hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Source Title + Thumbnail/Icon + Media Subtitle */}
                      <div className="flex items-start gap-3 min-w-0">
                        {log.thumbnail_url ? (
                          <img
                            src={log.thumbnail_url}
                            alt={log.channel_name || log.target_input}
                            referrerPolicy="no-referrer"
                            className="w-14 h-11 sm:w-16 sm:h-12 rounded-xl object-cover border border-[#E9EAF1] shrink-0 bg-[#F5F6FA]"
                          />
                        ) : (
                          <div
                            className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 border ${badgeStyle}`}
                          >
                            <BadgeIcon className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-[#20212B] break-words line-clamp-1">
                            {log.channel_name || log.target_input}
                          </div>
                          <div className="text-xs text-[#5A5D6D] font-medium line-clamp-2 break-words mt-0.5">
                            {log.media_title || `Source: ${log.target_input}`}
                          </div>
                          {log.source_url && (
                            <a
                              href={log.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-[10px] text-[#6C5CE7] hover:underline font-semibold mt-0.5"
                            >
                              <span>Open Original Post</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Metric Counters: Retrieved / Flagged / Safe */}
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-2 border-t border-[#F0F1F5] text-center">
                        <div className="p-1.5 sm:p-2 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] min-w-0">
                          <div className="text-[9px] sm:text-[10px] font-semibold text-[#858795] uppercase truncate">Analyzed</div>
                          <div className="text-xs sm:text-sm font-extrabold text-[#20212B] tabular-nums mt-0.5">
                            {retrievedCount}
                          </div>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-rose-50/70 border border-rose-200/70 min-w-0">
                          <div className="text-[9px] sm:text-[10px] font-semibold text-rose-700 uppercase truncate">Flagged</div>
                          <div className="text-xs sm:text-sm font-extrabold text-rose-700 tabular-nums mt-0.5">
                            {flaggedCount}
                          </div>
                        </div>
                        <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/70 min-w-0">
                          <div className="text-[9px] sm:text-[10px] font-semibold text-emerald-700 uppercase truncate">Safe / Civil</div>
                          <div className="text-xs sm:text-sm font-extrabold text-emerald-700 tabular-nums mt-0.5">
                            {safeCount}
                          </div>
                        </div>
                      </div>

                      {/* Languages Detected */}
                      {langEntries.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-[#858795]">
                          <Globe className="w-3 h-3 text-[#6C5CE7] shrink-0" />
                          {langEntries.map(([lang, count]) => (
                            <span key={lang} className="capitalize font-semibold text-[#20212B]">
                              {lang}: <span className="tabular-nums text-[#6C5CE7]">{count}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#F0F1F5] flex items-center justify-between gap-2 min-w-0">
                      <span className="text-[11px] font-bold text-[#6C5CE7] flex items-center gap-1.5 min-w-0">
                        <Eye className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {isSelected
                            ? `Showing ${log.records?.length || retrievedCount} Comments`
                            : `View ${log.records?.length || retrievedCount} Comments`}
                        </span>
                      </span>
                      <span className="text-[10px] font-semibold text-[#858795] tabular-nums truncate max-w-[90px] shrink-0">
                        {log.video_id || log.media_id || log.id.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Run Comments & Detection Details Inspector */}
        {selectedSyncLog && matchesPlatformTab(selectedSyncLog.platform, platformFilter) && (
          <div className="bg-white rounded-2xl border border-[#E9EAF1] shadow-xs overflow-hidden space-y-0 max-w-full">
            {/* Run Inspector Banner */}
            <div className="p-3.5 sm:p-6 bg-[#F8F9FE] border-b border-[#E9EAF1] flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 sm:gap-4">
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 w-full xl:w-auto">
                {selectedSyncLog.thumbnail_url ? (
                  <img
                    src={selectedSyncLog.thumbnail_url}
                    alt={selectedSyncLog.channel_name || selectedSyncLog.target_input}
                    referrerPolicy="no-referrer"
                    className="w-14 h-11 sm:w-20 sm:h-14 rounded-xl object-cover border border-[#E9EAF1] shadow-xs shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] shrink-0">
                    {selectedSyncLog.platform === 'youtube' ? (
                      <Youtube className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />
                    ) : selectedSyncLog.platform === 'instagram' ? (
                      <Instagram className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600" />
                    ) : selectedSyncLog.platform.includes('csv') ? (
                      <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-600" />
                    ) : (
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
                    )}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm sm:text-base font-extrabold text-[#20212B] break-words">
                      {selectedSyncLog.channel_name || selectedSyncLog.target_input}
                    </span>
                    <PlatformBadge platform={selectedSyncLog.platform} sourceUrl={selectedSyncLog.source_url} />
                    <span className="text-[11px] text-[#858795] tabular-nums">
                      Synced {new Date(selectedSyncLog.created_at).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-[#5A5D6D] mt-0.5 break-words line-clamp-2">
                    {selectedSyncLog.media_title || `Source: ${selectedSyncLog.target_input}`}
                  </p>
                </div>
              </div>

              {/* Summary Filter Pills */}
              <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setChannelCommentFilter('all')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer tabular-nums text-center ${
                    channelCommentFilter === 'all'
                      ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                      : 'bg-white text-[#20212B] border-[#E9EAF1] hover:bg-[#F5F6FA]'
                  }`}
                >
                  All ({selectedSyncLog.records?.length || selectedSyncLog.total_fetched})
                </button>
                <button
                  type="button"
                  onClick={() => setChannelCommentFilter('flagged')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer tabular-nums text-center ${
                    channelCommentFilter === 'flagged'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  Flagged ({(selectedSyncLog.records || []).filter(r => r.is_flagged).length})
                </button>
                <button
                  type="button"
                  onClick={() => setChannelCommentFilter('safe')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer tabular-nums text-center ${
                    channelCommentFilter === 'safe'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  Safe ({(selectedSyncLog.records || []).filter(r => !r.is_flagged).length})
                </button>
              </div>
            </div>

            {/* Search & Language Filter inside Selected Run */}
            <div className="p-3.5 sm:p-4 bg-white border-b border-[#E9EAF1] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 min-w-0 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858795]" />
                <input
                  type="text"
                  value={channelSearchQuery}
                  onChange={e => setChannelSearchQuery(e.target.value)}
                  placeholder="Search comments, authors, or NLP evidence..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7]"
                />
              </div>

              <div className="flex items-center gap-2 text-xs w-full sm:w-auto justify-between sm:justify-end shrink-0">
                <span className="text-[#858795] font-semibold">Language:</span>
                <select
                  value={channelLanguageFilter}
                  onChange={e => setChannelLanguageFilter(e.target.value)}
                  className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer capitalize"
                >
                  <option value="all">All Languages ({selectedSyncLog.records?.length || 0})</option>
                  {activeChannelLanguages.map(lang => (
                    <option key={lang} value={lang} className="capitalize">
                      {lang.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* MOBILE CARD VIEW (< md): Perfect Fit Comment Cards with Zero Text Overflow */}
            <div className="md:hidden divide-y divide-[#F0F1F5]">
              {activeChannelComments.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#858795]">
                  No comments in this detection run match your current filter criteria.
                </div>
              ) : (
                activeChannelComments.map((item, idx) => {
                  const isExpanded = expandedCommentId === item.id;
                  const hs = item.hate_speech_score ?? 0;
                  const har = item.harassment_score ?? 0;
                  const cb = item.cyberbullying_score ?? 0;
                  const leg = item.legitimate_score ?? (item.is_flagged ? 0.15 : 0.92);

                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 space-y-2.5 ${item.is_flagged ? 'bg-rose-50/15' : 'bg-white'}`}
                    >
                      {/* Top row: # + Author + Language + Severity */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-mono text-[11px] font-bold text-[#858795] tabular-nums">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-xs text-[#20212B] flex items-center gap-1 truncate">
                            <User className="w-3 h-3 text-[#6C5CE7] shrink-0" />
                            <span className="truncate">@{(item.author_name || 'user').replace(/^@+/, '')}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="capitalize px-2 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-semibold">
                            {item.detected_language}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              item.severity === 'high'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : item.severity === 'medium'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {item.severity}
                          </span>
                        </div>
                      </div>

                      {/* Comment Text + Reason (Wrapped cleanly) */}
                      <div className="text-xs text-[#20212B] font-medium leading-relaxed break-words">
                        {item.text}
                      </div>
                      {item.severity_reason && (
                        <div className="text-[11px] text-[#858795] break-words">
                          <span className="font-semibold text-[#5A5D6D]">Reason:</span> {item.severity_reason}
                        </div>
                      )}

                      {/* NLP Scores & Decision Row */}
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-1 text-[11px]">
                        <div className="tabular-nums text-[#858795]">
                          HS: <strong className={hs > 0.4 ? 'text-rose-600' : 'text-[#20212B]'}>{(hs * 100).toFixed(0)}%</strong>
                          {' · '}
                          Har: <strong className={har > 0.4 ? 'text-amber-600' : 'text-[#20212B]'}>{(har * 100).toFixed(0)}%</strong>
                          {' · '}
                          CB: <strong className={cb > 0.4 ? 'text-[#6C5CE7]' : 'text-[#20212B]'}>{(cb * 100).toFixed(0)}%</strong>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                            item.is_flagged
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {(item.decision || (item.is_flagged ? 'flagged_for_review' : 'auto_approve')).replace(/_/g, ' ')}
                        </span>
                      </div>

                      {/* Mobile Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedCommentId(isExpanded ? null : item.id)}
                          className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#F8F9FE] hover:bg-[#EEEAFE] text-[#20212B] hover:text-[#6C5CE7] border border-[#E9EAF1] text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          <span>Detection Details</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => openDetail(item.id, item, selectedSyncLog)}
                          className="flex items-center justify-center px-2.5 py-1.5 rounded-xl bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Review Case
                        </button>
                      </div>

                      {/* Mobile Expanded 4-Category NLP Breakdown */}
                      {isExpanded && (
                        <div className="p-3 rounded-xl bg-[#F8F9FE] border border-[#DDD6FE] space-y-3 mt-2">
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { label: 'Hate Speech', score: hs, bar: 'bg-rose-500', text: 'text-rose-700' },
                              { label: 'Harassment', score: har, bar: 'bg-amber-500', text: 'text-amber-700' },
                              { label: 'Cyberbullying', score: cb, bar: 'bg-[#6C5CE7]', text: 'text-[#6C5CE7]' },
                              { label: 'Legitimate', score: leg, bar: 'bg-emerald-500', text: 'text-emerald-700' },
                            ].map(metric => (
                              <div key={metric.label} className="p-2.5 rounded-xl bg-white border border-[#E9EAF1] space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-semibold text-[#5A5D6D] truncate">{metric.label}</span>
                                  <span className={`font-extrabold tabular-nums ${metric.text}`}>
                                    {(metric.score * 100).toFixed(0)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${metric.bar}`}
                                    style={{ width: `${Math.min(100, Math.round(metric.score * 100))}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1">
                            <button
                              type="button"
                              onClick={() => setModalComment(item)}
                              className="font-bold text-[#6C5CE7] hover:underline cursor-pointer"
                            >
                              Full Inspection Card
                            </button>
                            <button
                              type="button"
                              onClick={() => openDetail(item.id, item, selectedSyncLog)}
                              className="font-bold text-emerald-700 hover:underline cursor-pointer"
                            >
                              Review Action &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE VIEW (md:block): Retrieved Comments & Detection Details Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FE] border-b border-[#E9EAF1] text-[#858795] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 sm:px-4 w-10">#</th>
                    <th className="py-3 px-3">Author</th>
                    <th className="py-3 px-3 sm:px-4 min-w-[240px]">Retrieved Comment &amp; Detection Evidence</th>
                    <th className="py-3 px-3">Language</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">NLP Scores (HS / Har / CB)</th>
                    <th className="py-3 px-3">Decision</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Detection &amp; Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1F5]">
                  {activeChannelComments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-10 text-center text-[#858795]">
                        No comments in this detection run match your current filter criteria.
                      </td>
                    </tr>
                  ) : (
                    activeChannelComments.map((item, idx) => {
                      const isExpanded = expandedCommentId === item.id;
                      const hs = item.hate_speech_score ?? 0;
                      const har = item.harassment_score ?? 0;
                      const cb = item.cyberbullying_score ?? 0;
                      const leg = item.legitimate_score ?? (item.is_flagged ? 0.15 : 0.92);

                      return (
                        <React.Fragment key={item.id}>
                          <tr className={`hover:bg-[#F8F9FE] transition-colors ${item.is_flagged ? 'bg-rose-50/15' : ''}`}>
                            <td className="py-3 px-3 sm:px-4 font-mono text-[11px] text-[#858795] tabular-nums">
                              {idx + 1}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <div className="font-bold text-[#20212B] flex items-center gap-1">
                                <User className="w-3 h-3 text-[#6C5CE7]" />
                                <span>@{(item.author_name || 'user').replace(/^@+/, '')}</span>
                              </div>
                              {item.published_at && (
                                <div className="text-[10px] text-[#858795] tabular-nums mt-0.5">
                                  {new Date(item.published_at).toLocaleDateString('en-IN', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 sm:px-4 max-w-md">
                              <div className="text-[#20212B] font-medium leading-relaxed break-words">
                                {item.text}
                              </div>
                              {item.severity_reason && (
                                <div className="text-[11px] text-[#858795] mt-1 break-words">
                                  <span className="font-semibold text-[#5A5D6D]">Detection Reason:</span> {item.severity_reason}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="capitalize px-2.5 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-semibold">
                                {item.detected_language}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                                  item.severity === 'high'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : item.severity === 'medium'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : item.severity === 'low'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]'
                                }`}
                              >
                                {item.severity}
                              </span>
                            </td>
                            <td className="py-3 px-3 tabular-nums text-[11px] text-[#858795] whitespace-nowrap">
                              <span className={hs > 0.4 ? 'text-rose-600 font-bold' : ''}>
                                {(hs * 100).toFixed(0)}%
                              </span>{' '}
                              /{' '}
                              <span className={har > 0.4 ? 'text-amber-600 font-bold' : ''}>
                                {(har * 100).toFixed(0)}%
                              </span>{' '}
                              /{' '}
                              <span className={cb > 0.4 ? 'text-[#6C5CE7] font-bold' : ''}>
                                {(cb * 100).toFixed(0)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${
                                  item.is_flagged
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {(item.decision || (item.is_flagged ? 'flagged_for_review' : 'auto_approve')).replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setExpandedCommentId(isExpanded ? null : item.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F8F9FE] hover:bg-[#EEEAFE] text-[#20212B] hover:text-[#6C5CE7] border border-[#E9EAF1] text-[11px] font-semibold transition-colors cursor-pointer"
                                >
                                  <span>Detection Details</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openDetail(item.id, item, selectedSyncLog)}
                                  className="px-2.5 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-[11px] font-bold transition-colors cursor-pointer"
                                >
                                  Review
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expandable 4-Category NLP Detection Details Row */}
                          {isExpanded && (
                            <tr className="bg-[#F8F9FE]/90">
                              <td colSpan={8} className="p-4 border-l-4 border-[#6C5CE7]">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-center">
                                  {/* 4-Category Score Bars */}
                                  <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                      { label: 'Hate Speech', score: hs, bar: 'bg-rose-500', text: 'text-rose-700' },
                                      { label: 'Harassment / Insult', score: har, bar: 'bg-amber-500', text: 'text-amber-700' },
                                      { label: 'Cyberbullying', score: cb, bar: 'bg-[#6C5CE7]', text: 'text-[#6C5CE7]' },
                                      { label: 'Legitimate / Civil', score: leg, bar: 'bg-emerald-500', text: 'text-emerald-700' },
                                    ].map(metric => (
                                      <div key={metric.label} className="p-3 rounded-xl bg-white border border-[#E9EAF1] space-y-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-semibold text-[#5A5D6D]">{metric.label}</span>
                                          <span className={`font-extrabold tabular-nums ${metric.text}`}>
                                            {(metric.score * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                        <div className="w-full h-1.5 rounded-full bg-[#F0F1F5] overflow-hidden">
                                          <div
                                            className={`h-full rounded-full ${metric.bar}`}
                                            style={{ width: `${Math.min(100, Math.round(metric.score * 100))}%` }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Explanation & Full Modal Trigger */}
                                  <div className="p-3 rounded-xl bg-white border border-[#E9EAF1] flex flex-col justify-between gap-2">
                                    <div className="text-[11px] text-[#20212B]">
                                      <span className="font-bold text-[#6C5CE7] uppercase tracking-wider block mb-0.5">
                                        Multilingual NLP Explanation
                                      </span>
                                      <span>{item.severity_reason || 'Analyzed by IndicBERT-Sentinel-XLM contextual classifier.'}</span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-[#F0F1F5]">
                                      <span className="text-[10px] text-[#858795] font-mono tabular-nums">
                                        Confidence: {(item.confidence_level || 'high').toUpperCase()}
                                      </span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setModalComment(item)}
                                          className="text-[11px] font-bold text-[#6C5CE7] hover:underline cursor-pointer"
                                        >
                                          Full Inspection Card
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => openDetail(item.id, item, selectedSyncLog)}
                                          className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                                        >
                                          Review Action &rarr;
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          MODERATION QUEUE & AUDIT TRAIL TABLE
          ═════════════════════════════════════════════════════════════════════════ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pt-2">
          <h3 className="text-sm font-bold text-[#20212B] flex items-center gap-2 break-words">
            <Layers className="w-4 h-4 text-[#6C5CE7] shrink-0" />
            <span>
              {platformFilter === 'youtube'
                ? 'YouTube Moderation Queue Records'
                : platformFilter === 'instagram'
                ? 'Instagram Moderation Queue Records'
                : platformFilter === 'manual'
                ? 'Direct Text / Manual Queue Records'
                : platformFilter === 'csv_upload'
                ? 'CSV File Import Queue Records'
                : 'All Moderation Queue & Audit Trail Records'}
            </span>
          </h3>
          {currentAuditSession && (
            <span className="text-[11px] font-semibold text-[#6C5CE7] bg-[#EEEAFE] px-2.5 py-0.5 rounded-full border border-[#DDD6FE]">
              {currentAuditSession.name}: {displayedQueueRecords.length} record{displayedQueueRecords.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-3.5 sm:p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between rounded-2xl border border-[#E9EAF1] shadow-xs">
          <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-0 w-full">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#858795]" />
              <input
                type="text"
                placeholder="Search comments, content or record IDs..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:bg-white focus:border-[#6C5CE7]"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              Search
            </button>
          </form>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs w-full lg:w-auto">
            <div className="col-span-2 sm:col-span-1 flex items-center gap-1 text-[#858795] font-medium">
              <Filter className="w-3.5 h-3.5" />
              <span>Filters:</span>
            </div>

            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="escalated">Escalated</option>
              <option value="dismissed">Dismissed</option>
            </select>

            <select
              value={severityFilter}
              onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">All Severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="uncertain">Uncertain</option>
            </select>

            <select
              value={languageFilter}
              onChange={e => { setLanguageFilter(e.target.value); setPage(1); }}
              className="col-span-2 sm:col-span-1 px-2.5 py-1.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
            >
              <option value="">All Languages</option>
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="telugu">Telugu</option>
              <option value="hinglish">Hinglish</option>
              <option value="kannada">Kannada</option>
            </select>

            {(statusFilter || severityFilter || languageFilter || platformFilter || search) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('');
                  setSeverityFilter('');
                  setLanguageFilter('');
                  setPlatformFilter('');
                  setSearch('');
                  setPage(1);
                  setSearchParams({});
                }}
                className="col-span-2 sm:col-span-1 text-xs text-[#6C5CE7] hover:underline font-medium px-2 py-1 cursor-pointer text-left sm:text-center"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Main Records Card / Table */}
        <div className="bg-white overflow-hidden rounded-2xl border border-[#E9EAF1] shadow-xs">
          {/* Mobile Queue Cards (< md) */}
          <div className="md:hidden divide-y divide-[#F0F1F5]">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <div key={i} className="p-4">
                  <div className="h-12 w-full bg-[#F5F6FA] rounded-xl animate-pulse" />
                </div>
              ))
            ) : displayedQueueRecords.length === 0 ? (
              <div className="py-10 px-4 text-center text-xs text-[#858795]">
                {currentAuditSession
                  ? `No queue records in ${currentAuditSession.name} yet. Newly detected comments will appear here automatically.`
                  : 'No moderation records match your current criteria.'}
              </div>
            ) : (
              displayedQueueRecords.map(rec => (
                <div key={rec.id} className="p-3.5 space-y-2.5 hover:bg-[#F8F9FE] transition-colors">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <PlatformBadge platform={rec.platform} sourceUrl={rec.source_url} />
                    <div className="flex items-center gap-1.5">
                      <span className="capitalize px-2 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-semibold">
                        {rec.detected_language}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        rec.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                        rec.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        rec.severity === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]'
                      }`}>
                        {rec.severity}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-[#20212B] font-medium leading-relaxed break-words">
                    {rec.original_text}
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-[#858795]">
                    <div className="tabular-nums">
                      HS: {(rec.hate_speech_score * 100).toFixed(0)}% · Har: {(rec.harassment_score * 100).toFixed(0)}% · CB: {(rec.cyberbullying_score * 100).toFixed(0)}%
                    </div>
                    <button
                      onClick={() => openDetail(rec.id)}
                      className="px-3 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-bold transition-colors cursor-pointer"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Queue Table (md:block) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#F8F9FE] border-b border-[#E9EAF1] text-[#858795] font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 min-w-[220px]">Comment Text</th>
                  <th className="py-3 px-3">Platform</th>
                  <th className="py-3 px-3">Language</th>
                  <th className="py-3 px-3">Severity</th>
                  <th className="py-3 px-3">Scores (HS / Har / CB)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F1F5]">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="py-4 px-4">
                        <div className="h-5 w-full bg-[#F5F6FA] rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : displayedQueueRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-[#858795]">
                      {currentAuditSession
                        ? `No queue records in ${currentAuditSession.name} yet. Newly detected comments will appear here automatically.`
                        : 'No moderation records match your current criteria.'}
                    </td>
                  </tr>
                ) : (
                  displayedQueueRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-[#F8F9FE] transition-colors">
                      <td className="py-3 px-4 max-w-md">
                        <div className="text-[#20212B] line-clamp-2 font-medium break-words">{rec.original_text}</div>
                        {rec.author_name && (
                          <div className="text-[10px] text-[#858795] font-normal mt-0.5">
                            by @{rec.author_name.replace(/^@+/, '')}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <PlatformBadge platform={rec.platform} sourceUrl={rec.source_url} />
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className="capitalize px-2.5 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-semibold">
                          {rec.detected_language}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          rec.severity === 'high' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          rec.severity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          rec.severity === 'low' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]'
                        }`}>
                          {rec.severity}
                        </span>
                      </td>
                      <td className="py-3 px-3 tabular-nums text-[11px] text-[#858795] whitespace-nowrap">
                        <span className={rec.hate_speech_score > 0.4 ? 'text-rose-600 font-semibold' : ''}>
                          {(rec.hate_speech_score * 100).toFixed(0)}%
                        </span>{' '}/{' '}
                        <span className={rec.harassment_score > 0.4 ? 'text-amber-600 font-semibold' : ''}>
                          {(rec.harassment_score * 100).toFixed(0)}%
                        </span>{' '}/{' '}
                        <span className={rec.cyberbullying_score > 0.4 ? 'text-[#6C5CE7] font-semibold' : ''}>
                          {(rec.cyberbullying_score * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          rec.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          rec.status === 'escalated' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          rec.status === 'dismissed' ? 'bg-[#F5F6FA] text-[#858795] border-[#E9EAF1]' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-[#858795] tabular-nums text-[11px] whitespace-nowrap">
                        {new Date(rec.created_at).toLocaleString('en-IN', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openDetail(rec.id)}
                          className="px-3 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="p-3.5 bg-white border-t border-[#E9EAF1] flex items-center justify-between flex-wrap gap-2 text-xs text-[#858795]">
            <div>
              Showing <span className="text-[#20212B] font-semibold tabular-nums">{displayedQueueRecords.length}</span> of{' '}
              <span className="text-[#20212B] font-semibold tabular-nums">
                {currentAuditSession ? displayedQueueRecords.length : total}
              </span>{' '}
              queue items
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1 || Boolean(currentAuditSession)}
                className="p-1.5 rounded-lg bg-[#F8F9FE] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] disabled:opacity-40 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="tabular-nums">Page {currentAuditSession ? 1 : page} of {currentAuditSession ? 1 : (totalPages || 1)}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || Boolean(currentAuditSession)}
                className="p-1.5 rounded-lg bg-[#F8F9FE] hover:bg-[#E9EAF1] border border-[#E9EAF1] text-[#20212B] disabled:opacity-40 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          COMMENT DETECTION INSPECTION MODAL (FOR SAVED RUN ITEMS)
          ═════════════════════════════════════════════════════════════════════════ */}
      {modalComment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-[#E9EAF1] p-5 sm:p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E9EAF1]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#20212B]">Comment NLP Detection Report</h3>
                  <p className="text-[11px] text-[#858795]">
                    Source: <strong className="text-[#20212B]">{selectedSyncLog?.channel_name || 'Detection Run'}</strong> &bull; Author: @{(modalComment.author_name || 'user').replace(/^@+/, '')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalComment(null)}
                className="p-1.5 rounded-lg text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-sm text-[#20212B] font-medium leading-relaxed">
              {modalComment.text}
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Hate Speech', score: modalComment.hate_speech_score ?? 0, bar: 'bg-rose-500' },
                { label: 'Harassment / Insult', score: modalComment.harassment_score ?? 0, bar: 'bg-amber-500' },
                { label: 'Cyberbullying', score: modalComment.cyberbullying_score ?? 0, bar: 'bg-[#6C5CE7]' },
                { label: 'Neutral / Safe', score: modalComment.legitimate_score ?? (modalComment.is_flagged ? 0.15 : 0.92), bar: 'bg-emerald-500' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#5A5D6D]">{m.label}</span>
                    <span className="text-[#20212B] tabular-nums">{(m.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#E9EAF1] overflow-hidden">
                    <div className={`h-full rounded-full ${m.bar}`} style={{ width: `${Math.min(100, Math.round(m.score * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#858795] font-semibold">Detected Language:</span>
                <span className="font-bold text-[#6C5CE7] uppercase">{modalComment.detected_language}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#858795] font-semibold">Severity Classification:</span>
                <span className="font-bold text-[#20212B] uppercase">{modalComment.severity}</span>
              </div>
              <div className="pt-1 text-[#5A5D6D]">
                <strong className="text-[#20212B]">Evidence:</strong> {modalComment.severity_reason || 'Contextual multilingual analysis completed.'}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalComment(null)}
                className="px-4 py-2 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] text-[#20212B] text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = modalComment;
                  setModalComment(null);
                  openDetail(target.id, target, selectedSyncLog);
                }}
                className="px-4 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold cursor-pointer"
              >
                Open Review Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          SLIDE-OVER REVIEW DRAWER / MODAL
          ═════════════════════════════════════════════════════════════════════════ */}
      {selectedId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white border-l border-[#E9EAF1] h-full overflow-y-auto p-4 sm:p-6 space-y-6 shadow-2xl slide-in-right">
            <div className="flex items-center justify-between pb-4 border-b border-[#E9EAF1]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7]">
                  <ShieldAlert className="w-4 h-4 text-[#6C5CE7]" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#20212B]">Review Case Detail</h2>
                  <p className="text-[11px] text-[#858795] font-mono">ID: {selectedId}</p>
                </div>
              </div>
              <button
                onClick={() => { setSelectedId(null); setDetail(null); }}
                className="text-[#858795] hover:text-[#20212B] p-1.5 rounded-lg hover:bg-[#F5F6FA] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail || !detail ? (
              <div className="space-y-4 py-8">
                <div className="h-8 w-3/4 bg-[#F5F6FA] rounded animate-pulse" />
                <div className="h-24 w-full bg-[#F5F6FA] rounded animate-pulse" />
                <div className="h-16 w-full bg-[#F5F6FA] rounded animate-pulse" />
              </div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* Target Comment */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-[#858795]">Target Comment</h3>
                    <PlatformBadge platform={detail.platform} sourceUrl={detail.source_url} />
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-sm text-[#20212B] font-medium leading-relaxed">
                    {detail.original_text}
                  </div>
                  {(detail.author_name || detail.source_url) && (
                    <div className="flex items-center justify-between text-[11px] text-[#858795] pt-1">
                      {detail.author_name && <span>Author: <strong className="text-[#20212B]">@{detail.author_name.replace(/^@+/, '')}</strong></span>}
                      {detail.source_url && (
                        <a
                          href={detail.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#6C5CE7] hover:underline flex items-center gap-1 font-semibold"
                        >
                          <span>Open original URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                {/* Model Predictions */}
                <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#20212B]">Model Recommendation</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] text-[10px] font-mono">
                      {detail.model_name} v{detail.model_version}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      Severity: <span className="font-bold text-[#20212B] uppercase ml-1">{detail.severity}</span>
                    </div>
                    <div>
                      Decision: <strong className="text-[#6C5CE7] capitalize ml-1">{detail.decision.replace(/_/g, ' ')}</strong>
                    </div>
                  </div>
                  {detail.severity_reason && (
                    <div className="text-[11px] text-[#858795]">Evidence: {detail.severity_reason}</div>
                  )}
                  {detail.ambiguity_warning && (
                    <div className="text-[11px] text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" /> {detail.ambiguity_warning}
                    </div>
                  )}
                </div>

                {/* Action Form */}
                <form onSubmit={handleDecisionSubmit} className="pt-4 border-t border-[#E9EAF1] space-y-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[#20212B]">Review Decision</h3>

                  <div>
                    <label className="block text-[11px] font-medium text-[#858795] mb-2">Consequential Action</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        { id: 'approve', label: 'Approve Content', desc: 'No violation found' },
                        { id: 'dismiss', label: 'Dismiss / False Pos', desc: 'False positive flag' },
                        { id: 'escalate', label: 'Escalate Harm', desc: 'Severe violation' },
                        { id: 'further_review', label: 'Needs Investigation', desc: 'Hold in queue' }
                      ].map(opt => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setReviewAction(opt.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            reviewAction === opt.id
                              ? 'bg-[#EEEAFE] border-[#6C5CE7] text-[#6C5CE7] font-semibold shadow-xs'
                              : 'bg-[#F8F9FE] border-[#E9EAF1] text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA]'
                          }`}
                        >
                          <div className="font-semibold">{opt.label}</div>
                          <div className="text-[10px] opacity-75 mt-0.5">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#858795] mb-1">Override Severity</label>
                    <select
                      value={correctedSeverity}
                      onChange={e => setCorrectedSeverity(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7]"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="uncertain">Uncertain</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#858795] mb-1">Override Rationale</label>
                    <textarea
                      value={overrideReason}
                      onChange={e => setOverrideReason(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7]"
                      placeholder="Explain why this action was selected (recorded into feedback dataset)..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[#858795] mb-1">Internal Notes</label>
                    <input
                      type="text"
                      value={reviewerNotes}
                      onChange={e => setReviewerNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs text-[#20212B] focus:outline-none focus:border-[#6C5CE7]"
                      placeholder="Optional review notes..."
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setSelectedId(null); setDetail(null); }}
                      className="px-4 py-2 rounded-xl bg-[#F5F6FA] hover:bg-[#E9EAF1] text-[#20212B] text-xs font-medium border border-[#E9EAF1] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-5 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-sm shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {submittingReview ? 'Recording...' : 'Submit Decision'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
