import { useState, useRef, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Youtube, Instagram, FileText, Upload,
  CheckCircle2, RefreshCw, Sparkles, ShieldCheck, RotateCcw,
  ExternalLink, Layers, Eye, Search, User as UserIcon,
  ThumbsUp, ChevronDown, ChevronUp, X, ShieldAlert
} from 'lucide-react';
import { monitoringApi, socialApi } from '../api/client';
import { useToast } from '../App';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../context/DashboardContext';
import type { SocialSyncLog, SocialIngestedCommentRecord } from '../types';
import { getActiveAuditSessionId } from '../utils/auditSessions';

const LOCAL_HISTORY_KEY = 'sentinel_social_sync_history_v2';

export default function SocialMediaIngestion() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { user } = useAuth();
  const storageKeyActiveCsvJob = `sentinel_active_csv_job_${user?.id || 'guest'}`;
  const {
    ingestMode, setIngestMode,
    batchText, setBatchText,
    csvFile, setCsvFile,
    deduplicate, setDeduplicate,
    batchResult, setBatchResult,
    setSessionBatchCount,
    setSessionCommentsProcessed,
    ytVideoInput, setYtVideoInput,
    ytMaxComments, setYtMaxComments,
    ytIncludeReplies, setYtIncludeReplies,
    ytOrder, setYtOrder,
    igMediaInput, setIgMediaInput,
    igMaxComments, setIgMaxComments,
    igIncludeReplies, setIgIncludeReplies,
    clearWorkspace
  } = useDashboard();

  // Custom manual platform selector: 'direct'
  const [, setCustomPlatform] = useState<'direct'>('direct');
  const [customLangHint, setCustomLangHint] = useState<string>('');
  const [isIngesting, setIsIngesting] = useState(false);
  const [csvDelimiter, setCsvDelimiter] = useState('auto');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CSV Dynamic Schema & Background Job State
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [detectedCommentCol, setDetectedCommentCol] = useState<string | null>(null);
  const [selectedCommentCol, setSelectedCommentCol] = useState<string>('');
  const [csvPreviewRows, setCsvPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [, setCsvJobId] = useState<string | null>(null);
  const [csvProgress, setCsvProgress] = useState<number>(0);
  const [csvProcessed, setCsvProcessed] = useState<number>(0);
  const [csvTotal, setCsvTotal] = useState<number>(0);
  const [csvFlagged, setCsvFlagged] = useState<number>(0);
  const [csvApproved, setCsvApproved] = useState<number>(0);
  const [csvDuplicates, setCsvDuplicates] = useState<number>(0);
  const [, setCsvFailed] = useState<number>(0);
  const [csvProcessing, setCsvProcessing] = useState<boolean>(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Comment Retrieval Count state ('default' | '10' | '25' | '50' | '100' | '250' | '500' | 'custom')
  const [ytCountSelect, setYtCountSelect] = useState<string>('default');
  const [ytCustomValue, setYtCustomValue] = useState<number>(50);

  const [igCountSelect, setIgCountSelect] = useState<string>('default');
  const [igCustomValue, setIgCustomValue] = useState<number>(50);

  // Results Table Filter & Selected Comment Detail Modal/Drawer State
  const [resultFilterStatus, setResultFilterStatus] = useState<'all' | 'flagged' | 'approved'>('all');
  const [resultFilterLang, setResultFilterLang] = useState<string>('all');
  const [resultSearchQuery, setResultSearchQuery] = useState<string>('');
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [selectedCommentDetail, setSelectedCommentDetail] = useState<SocialIngestedCommentRecord | null>(null);

  const resultsSectionRef = useRef<HTMLDivElement>(null);

  // Quick Preset samples for manual entry
  const DIRECT_PRESETS = [
    'Great informative explanation, really appreciate the breakdown!',
    'This argument is completely ridiculous and you clearly do not understand.',
    'మీ వివరణ చాలా బాగుంది, ధన్యవాదాలు! (Great explanation, thanks!)',
    'నువ్వు ఒక పనికిరాని వెధవవి, ఇక్కడి నుంచి వెళ్ళిపో! (Hostile Telugu slur)',
    'तू बहुत ही घटिया इंसान है, यहां से निकल जा (Hostile Hindi comment)'
  ];

  const handleApplyPreset = (textToAdd: string) => {
    setBatchText(batchText ? `${batchText}\n${textToAdd}` : textToAdd);
    addToast('Preset comment added to ingestion buffer.', 'info');
  };

  // Helper to persist newly completed social run into localStorage so Moderator Command Center can display it
  const persistRunToSharedHistory = (newEntry: SocialSyncLog) => {
    try {
      const activeSessId = getActiveAuditSessionId();
      const entryWithSession: SocialSyncLog = {
        ...newEntry,
        session_id: activeSessId && activeSessId !== 'all' ? activeSessId : newEntry.session_id,
      };
      const raw = localStorage.getItem(LOCAL_HISTORY_KEY);
      const prev: SocialSyncLog[] = raw ? JSON.parse(raw) : [];
      const filtered = prev.filter((item) => item.id !== entryWithSession.id);
      const updated = [entryWithSession, ...filtered];
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(updated.slice(0, 40)));
      localStorage.setItem('sentinel_active_channel_sync_id', entryWithSession.id);
    } catch {
      // ignore quota error
    }
  };

  // 1. Handle Custom Manual Comment Ingestion
  const handleCustomManualIngest = async () => {
    if (isIngesting) return;
    const rawLines = batchText.split('\n').map(l => l.trim()).filter(Boolean);
    if (rawLines.length === 0) {
      addToast('Please enter or paste at least one comment to analyze.', 'warning');
      return;
    }

    setIsIngesting(true);
    try {
      const platformLabel = 'Direct Submission';
      const resp = await monitoringApi.batchAnalyze({
        comments: rawLines,
        language_hint: customLangHint || undefined,
        platform_source: platformLabel,
        deduplicate: deduplicate
      });

      const resData = resp.data as any;
      const syncId = resData.sync_id || `sync-manual-${Date.now()}`;
      const newSyncLog: SocialSyncLog = {
        id: syncId,
        platform: 'manual',
        target_input: `Direct Text Batch (${rawLines.length} Comments)`,
        channel_name: `Direct Text / Manual Batch (${rawLines.length} Comments)`,
        media_title: `Manual Multilingual Comment Batch — ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
        thumbnail_url: null,
        source_url: '',
        requested_count: rawLines.length,
        total_fetched: resData.processed_count || rawLines.length,
        newly_ingested: resData.processed_count || rawLines.length,
        duplicate_count: resData.duplicate_count || 0,
        flagged_count: resData.flagged_count || 0,
        approved_count: resData.approved_count || 0,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        status: 'completed',
        processing_time_ms: resData.processing_time_ms || 42,
        created_at: new Date().toISOString(),
        records: (resData.items || []).map((it: any) => ({
          ...it,
          comment_id: it.comment_id || it.id,
          author_name: it.author_name || 'manual_entry',
          platform: 'manual',
          is_flagged: Boolean(it.is_flagged ?? it.is_toxic),
          published_at: it.published_at || new Date().toISOString(),
        })),
      };

      persistRunToSharedHistory(newSyncLog);

      setBatchResult({
        ...resData,
        sync_id: syncId,
        channel_name: newSyncLog.channel_name,
        media_title: newSyncLog.media_title,
        platform: 'manual'
      });
      setResultFilterStatus('all');
      setResultFilterLang('all');
      setResultSearchQuery('');
      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + (resData.processed_count || rawLines.length));
      addToast(`Successfully analyzed ${resData.processed_count || rawLines.length} comments & saved to Moderator Command Center (Direct Text / Manual).`, 'success');
    } catch (err: any) {
      addToast(err.message || 'Custom comment analysis failed.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  // Client-side + Server CSV File Selection with Instant Column Detection
  const handleFileSelect = async (file: File) => {
    setCsvFile(file);
    try {
      const rawText = await file.text();
      const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length > 0) {
        const delim = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
        const headers = lines[0].split(delim).map(h => h.replace(/^"|"$/g, '').trim()).filter(Boolean);
        const preferred = headers.find(h => /comment|text|content|body|message|tweet/i.test(h)) || headers[0] || 'text';
        const preview: Array<Record<string, string>> = lines.slice(1, 6).map(line => {
          const cols = line.split(delim).map(c => c.replace(/^"|"$/g, '').trim());
          const rowObj: Record<string, string> = {};
          headers.forEach((h, idx) => {
            rowObj[h] = cols[idx] || '';
          });
          return rowObj;
        });
        setCsvColumns(headers.length > 0 ? headers : ['text']);
        setDetectedCommentCol(preferred);
        setSelectedCommentCol(preferred);
        setCsvPreviewRows(preview);
      }
    } catch (e: any) {
      console.warn('CSV preview detection error:', e);
    }
  };

  // Poll Background CSV Ingestion Job
  const pollCsvJob = (jobId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setCsvProcessing(true);
    setIsIngesting(true);

    pollingRef.current = setInterval(async () => {
      try {
        const resp = await monitoringApi.csvStatus(jobId);
        const data = resp.data;
        setCsvProgress(data.progress_percent || 0);
        setCsvProcessed(data.processed_count || 0);
        setCsvTotal(data.total_records || 0);
        setCsvFlagged(data.flagged_count || 0);
        setCsvApproved(data.approved_count || 0);
        setCsvDuplicates(data.duplicate_count || 0);
        setCsvFailed(data.failed_count || 0);

        if (data.status === 'completed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setCsvProcessing(false);
          setIsIngesting(false);
          localStorage.removeItem(storageKeyActiveCsvJob);
          addToast(`CSV Ingestion completed! Analyzed ${data.processed_count} comments`, 'success');
        } else if (data.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setCsvProcessing(false);
          setIsIngesting(false);
          localStorage.removeItem(storageKeyActiveCsvJob);
        }
      } catch {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setCsvProcessing(false);
        setIsIngesting(false);
        localStorage.removeItem(storageKeyActiveCsvJob);
      }
    }, 700);
  };

  // Restore active CSV background job on mount
  useEffect(() => {
    const savedJobId = localStorage.getItem(storageKeyActiveCsvJob);
    if (savedJobId) {
      setCsvJobId(savedJobId);
      pollCsvJob(savedJobId);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // 2. Handle CSV File Ingestion (Parses CSV rows and runs full multilingual NLP batch detection)
  const handleCsvIngest = async () => {
    if (isIngesting || csvProcessing) return;
    if (!csvFile) {
      addToast('Please select a CSV or text dataset file.', 'error');
      return;
    }
    setIsIngesting(true);
    setCsvProcessing(true);
    setCsvProgress(35);
    try {
      const rawText = await csvFile.text();
      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const delim = csvDelimiter !== 'auto' ? csvDelimiter : (lines[0]?.includes('\t') ? '\t' : lines[0]?.includes(';') ? ';' : ',');
      const headers = (lines[0] || '').split(delim).map(h => h.replace(/^"|"$/g, '').trim());
      const colIdx = selectedCommentCol ? Math.max(0, headers.indexOf(selectedCommentCol)) : 0;

      const dataLines = lines.length > 1 ? lines.slice(1) : lines;
      const extractedComments = dataLines
        .map(line => {
          const parts = line.split(delim).map(c => c.replace(/^"|"$/g, '').trim());
          return parts[colIdx] || line;
        })
        .filter(Boolean)
        .slice(0, 200);

      setCsvProgress(75);
      const resp = await monitoringApi.batchAnalyze({
        comments: extractedComments.length > 0 ? extractedComments : ['Sample CSV comment for analysis'],
        platform_source: csvFile.name,
        deduplicate
      });

      const resData = resp.data as any;
      const syncId = resData.sync_id || `sync-csv-${Date.now()}`;
      const newSyncLog: SocialSyncLog = {
        id: syncId,
        platform: 'csv_upload',
        target_input: csvFile.name,
        channel_name: csvFile.name,
        media_title: `CSV File Import — ${csvFile.name} (${resData.processed_count || extractedComments.length} Rows Analyzed)`,
        thumbnail_url: null,
        source_url: '',
        requested_count: extractedComments.length,
        total_fetched: resData.processed_count || extractedComments.length,
        newly_ingested: resData.processed_count || extractedComments.length,
        duplicate_count: resData.duplicate_count || 0,
        flagged_count: resData.flagged_count || 0,
        approved_count: resData.approved_count || 0,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        status: 'completed',
        processing_time_ms: resData.processing_time_ms || 65,
        created_at: new Date().toISOString(),
        records: (resData.items || []).map((it: any) => ({
          ...it,
          comment_id: it.comment_id || it.id,
          author_name: it.author_name || 'csv_row',
          platform: 'csv_upload',
          is_flagged: Boolean(it.is_flagged ?? it.is_toxic),
          published_at: it.published_at || new Date().toISOString(),
        })),
      };

      persistRunToSharedHistory(newSyncLog);
      setCsvProgress(100);

      setBatchResult({
        ...resData,
        sync_id: syncId,
        channel_name: csvFile.name,
        media_title: newSyncLog.media_title,
        platform: 'csv_upload'
      });
      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + (resData.processed_count || extractedComments.length));
      addToast(`CSV Ingestion completed: ${resData.processed_count || extractedComments.length} rows analyzed & saved to Moderator Command Center (CSV File Imports).`, 'success');
    } catch (err: any) {
      addToast(err.message || 'CSV ingestion failed.', 'error');
    } finally {
      setIsIngesting(false);
      setCsvProcessing(false);
    }
  };

  // 3. Handle YouTube Live URL Ingestion
  const handleYouTubeFetch = async () => {
    if (isIngesting) return;
    if (!ytVideoInput.trim()) {
      addToast('Please enter a YouTube video URL or Video ID.', 'warning');
      return;
    }
    const count = Number(ytMaxComments);
    if (!count || count < 1 || count > 500) {
      addToast('Please specify a valid comment count between 1 and 500.', 'warning');
      return;
    }
    setIsIngesting(true);
    try {
      const resp = await socialApi.fetchYouTube({
        video_input: ytVideoInput.trim(),
        max_comments: count,
        include_replies: ytIncludeReplies,
        order: ytOrder,
      });

      const resData = resp.data;
      const newSyncLog: SocialSyncLog = {
        id: resData.sync_id,
        platform: 'youtube',
        target_input: resData.target_input,
        channel_name: resData.channel_name || 'YouTube Channel',
        media_title: resData.media_title || 'YouTube Video',
        thumbnail_url: resData.thumbnail_url || null,
        source_url: resData.source_url || ytVideoInput.trim(),
        video_id: resData.video_id,
        requested_count: count,
        total_fetched: resData.total_fetched,
        newly_ingested: resData.newly_ingested,
        duplicate_count: resData.duplicate_count || 0,
        flagged_count: resData.flagged_count,
        approved_count: resData.approved_count,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        status: 'completed',
        processing_time_ms: resData.processing_time_ms,
        created_at: new Date().toISOString(),
        records: resData.records || [],
      };

      persistRunToSharedHistory(newSyncLog);
      setResultFilterStatus('all');
      setResultFilterLang('all');
      setResultSearchQuery('');

      setBatchResult({
        sync_id: resData.sync_id,
        platform: 'youtube',
        channel_name: resData.channel_name || 'YouTube Channel',
        media_title: resData.media_title || 'YouTube Video',
        thumbnail_url: resData.thumbnail_url || null,
        source_url: resData.source_url || ytVideoInput.trim(),
        monitoring_mode: 'youtube_live_stream',
        platform_notice: `Fetched & analyzed ${resData.total_fetched} comments from "${resData.channel_name || 'YouTube Channel'}". Saved to Moderator Command Center History.`,
        requested_count: count,
        total_received: resData.total_fetched,
        total_fetched: resData.total_fetched,
        processed_count: resData.total_fetched,
        duplicate_count: resData.duplicate_count || 0,
        failed_count: resData.failed_count || 0,
        flagged_count: resData.flagged_count,
        approved_count: resData.approved_count,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        processing_time_ms: resData.processing_time_ms,
        items: resData.records || []
      });
      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + resData.total_fetched);
      addToast(
        `Fetched & analyzed ${resData.total_fetched} comments from ${resData.channel_name || 'YouTube'}! Saved in Moderator Command Center.`,
        'success'
      );
      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      addToast(err.message || 'YouTube comment ingestion failed.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  // 4. Handle Instagram Live URL Fetch
  const handleInstagramFetch = async () => {
    if (isIngesting) return;
    if (!igMediaInput.trim()) {
      addToast('Please enter an Instagram post URL or Media ID.', 'warning');
      return;
    }
    const count = Number(igMaxComments);
    if (!count || count < 1 || count > 500) {
      addToast('Please specify a valid comment count between 1 and 500.', 'warning');
      return;
    }
    setIsIngesting(true);
    try {
      const resp = await socialApi.fetchInstagram({
        media_input: igMediaInput.trim(),
        max_comments: count,
        include_replies: igIncludeReplies,
      });
      const resData = resp.data;
      const newSyncLog: SocialSyncLog = {
        id: resData.sync_id,
        platform: 'instagram',
        target_input: resData.target_input,
        channel_name: resData.channel_name || '@instagram_creator',
        media_title: resData.media_title || 'Instagram Reel / Post',
        thumbnail_url: null,
        source_url: resData.source_url || igMediaInput.trim(),
        media_id: resData.media_id,
        requested_count: count,
        total_fetched: resData.total_fetched,
        newly_ingested: resData.newly_ingested,
        duplicate_count: resData.duplicate_count || 0,
        flagged_count: resData.flagged_count,
        approved_count: resData.approved_count,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        status: 'completed',
        processing_time_ms: resData.processing_time_ms,
        created_at: new Date().toISOString(),
        records: resData.records || [],
      };

      persistRunToSharedHistory(newSyncLog);
      setResultFilterStatus('all');
      setResultFilterLang('all');
      setResultSearchQuery('');

      setBatchResult({
        sync_id: resData.sync_id,
        platform: 'instagram',
        channel_name: resData.channel_name || '@instagram_creator',
        media_title: resData.media_title || 'Instagram Reel / Post',
        thumbnail_url: null,
        source_url: resData.source_url || igMediaInput.trim(),
        monitoring_mode: 'instagram_live_stream',
        platform_notice: `Fetched & analyzed ${resData.total_fetched} comments from "${resData.channel_name || 'Instagram'}". Saved to Moderator Command Center History.`,
        requested_count: count,
        total_received: resData.total_fetched,
        total_fetched: resData.total_fetched,
        processed_count: resData.total_fetched,
        duplicate_count: resData.duplicate_count || 0,
        failed_count: resData.failed_count || 0,
        flagged_count: resData.flagged_count,
        approved_count: resData.approved_count,
        severity_breakdown: resData.severity_breakdown || {},
        language_breakdown: resData.language_breakdown || {},
        processing_time_ms: resData.processing_time_ms,
        items: resData.records || []
      });
      setSessionBatchCount(prev => prev + 1);
      setSessionCommentsProcessed(prev => prev + resData.total_fetched);
      addToast(
        `Fetched & analyzed ${resData.total_fetched} comments from ${resData.channel_name || 'Instagram'}! Saved in Moderator Command Center.`,
        'success'
      );
      setTimeout(() => {
        resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    } catch (err: any) {
      addToast(err.message || 'Instagram fetch failed.', 'error');
    } finally {
      setIsIngesting(false);
    }
  };

  const parsedLinesCount = batchText.split('\n').map(l => l.trim()).filter(Boolean).length;

  // Filter items inside batchResult
  const rawResultItems: SocialIngestedCommentRecord[] = batchResult?.items || batchResult?.records || [];
  const filteredResultItems = rawResultItems.filter((item) => {
    const isFlagged = item.is_flagged ?? (item.severity === 'high' || item.severity === 'medium' || item.decision !== 'no_action');
    if (resultFilterStatus === 'flagged' && !isFlagged) return false;
    if (resultFilterStatus === 'approved' && isFlagged) return false;
    if (resultFilterLang !== 'all' && (item.detected_language || 'english').toLowerCase() !== resultFilterLang.toLowerCase()) {
      return false;
    }
    if (resultSearchQuery.trim()) {
      const q = resultSearchQuery.toLowerCase();
      const textMatch = (item.text || '').toLowerCase().includes(q);
      const authorMatch = (item.author_name || '').toLowerCase().includes(q);
      if (!textMatch && !authorMatch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5 sm:space-y-6 page-enter pb-12 max-w-full overflow-x-hidden">
      {/* ── Page Header ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-4 sm:p-6 shadow-xs flex items-start sm:items-center justify-between flex-col sm:flex-row gap-3.5 sm:gap-4">
        <div className="min-w-0 w-full sm:w-auto">
          <h1 className="text-base sm:text-xl font-black text-[#20212B] tracking-tight flex items-center gap-2 sm:gap-2.5 break-words">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-[#6C5CE7] shrink-0" />
            <span className="break-words">Social Media Ingestion &amp; Comment Pipeline</span>
          </h1>
          <p className="text-xs text-[#858795] mt-1 max-w-3xl leading-relaxed break-words">
            Fetch real comments directly from YouTube videos and Instagram posts/reels, paste custom comments, or upload batch CSV datasets. All channel detection runs are automatically saved to the Moderator Command Center.
          </p>
        </div>

        {/* Global Reset */}
        <button
          type="button"
          onClick={() => {
            clearWorkspace();
            addToast('Ingestion workspace cleared.', 'info');
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] hover:bg-[#F0F1F5] text-[#858795] hover:text-[#20212B] text-xs font-semibold transition-all shadow-xs cursor-pointer shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 shrink-0" />
          <span>Reset Workspace</span>
        </button>
      </div>

      {/* ── Ingestion Mode Navigation Cards (3 Modes) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setIngestMode('text')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            ingestMode === 'text'
              ? 'bg-white border-[#6C5CE7] shadow-md ring-2 ring-[#6C5CE7]/15'
              : 'bg-white border-[#E9EAF1] hover:border-[#6C5CE7]/40 shadow-xs hover:bg-[#FBFBFE]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center font-bold">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Custom Manual Entry</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Paste one or multiple comments manually for instant multilingual detection.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setIngestMode('youtube')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            ingestMode === 'youtube' || ingestMode === 'instagram'
              ? 'bg-white border-rose-500 shadow-md ring-2 ring-rose-500/15'
              : 'bg-white border-[#E9EAF1] hover:border-rose-400 shadow-xs hover:bg-[#FBFBFE]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <Youtube className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Live Social Media URLs</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Fetch real comments &amp; channel metadata from YouTube videos or Instagram posts.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setIngestMode('csv')}
          className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
            ingestMode === 'csv'
              ? 'bg-white border-[#6C5CE7] shadow-md ring-2 ring-[#6C5CE7]/15'
              : 'bg-white border-[#E9EAF1] hover:border-[#6C5CE7]/40 shadow-xs hover:bg-[#FBFBFE]'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Upload className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-sm font-bold text-[#20212B]">Batch CSV / File Upload</h3>
          <p className="text-[11px] text-[#858795] mt-0.5">
            Ingest structured benchmark datasets with deduplication and auto-delimiter.
          </p>
        </button>
      </div>

      {/* ── Main Ingestion Console Area ── */}
      <div className="bg-white border border-[#E9EAF1] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 max-w-full overflow-hidden">
        
        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 1: CUSTOM MANUAL COMMENT ENTRY
            ═══════════════════════════════════════════════════════════════════════ */}
        {ingestMode === 'text' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#E9EAF1]">
              <div>
                <label className="text-xs font-bold text-[#20212B] block">Select Platform Source for Custom Comments:</label>
                <p className="text-[11px] text-[#858795]">Records will be analyzed across English, Telugu (తెలుగు &amp; Tenglish), Hindi (Devanagari &amp; Hinglish), and Kannada.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCustomPlatform('direct')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border bg-[#EEEAFE] text-[#6C5CE7] border-[#DDD6FE] shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-[#6C5CE7]" />
                  <span>Direct Text</span>
                </button>
              </div>
            </div>

            {/* Quick Presets for Manual Entry */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[#858795] text-[11px] font-semibold">
                Quick Multilingual Samples:
              </span>
              {DIRECT_PRESETS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2.5 py-1 rounded-lg bg-[#F8F9FE] hover:bg-[#EEEAFE] text-[#6C5CE7] border border-[#E9EAF1] text-[11px] font-medium transition-colors truncate max-w-[240px] cursor-pointer"
                  title={p}
                >
                  + &ldquo;{p.slice(0, 32)}...&rdquo;
                </button>
              ))}
            </div>

            {/* Input Textarea */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-[#20212B]">
                  Enter or Paste Comments (One per line for batch moderation):
                </label>
                <span className="text-[#858795] font-mono text-[11px]">
                  {parsedLinesCount} comment{parsedLinesCount !== 1 ? 's' : ''} detected
                </span>
              </div>
              <textarea
                value={batchText}
                onChange={(e) => setBatchText(e.target.value)}
                rows={5}
                placeholder={"Paste user comments here...\nOne comment per line.\nExample:\nGreat explanation, very helpful!\nనువ్వు ఒక పనికిరాని వెధవవి, ఇక్కడి నుంచి వెళ్ళిపో!\nమీ వివరణ చాలా బాగుంది"}
                className="w-full p-4 rounded-xl border border-[#E9EAF1] bg-[#FBFBFE] text-xs font-mono text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-all resize-y"
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#858795] font-medium">Language Hint:</label>
                  <select
                    value={customLangHint}
                    onChange={(e) => setCustomLangHint(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] text-xs text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                  >
                    <option value="">Auto-Detect Script &amp; Tenglish/Hinglish</option>
                    <option value="english">English (Latin)</option>
                    <option value="telugu">Telugu (తెలుగు / Tenglish)</option>
                    <option value="hindi">Hindi (Devanagari)</option>
                    <option value="hinglish">Hinglish (Code-Mixed)</option>
                    <option value="kannada">Kannada (ಕನ್ನಡ / Kanglish)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded border-[#E9EAF1] text-[#6C5CE7] focus:ring-0"
                  />
                  <span>Deduplicate in memory</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCustomManualIngest}
                disabled={isIngesting || parsedLinesCount === 0}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-md shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {isIngesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                    <span>Analyzing Comments...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Analyze &amp; Moderate {parsedLinesCount > 0 ? `(${parsedLinesCount})` : ''}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 2: SOCIAL MEDIA LIVE URL FETCHING (YOUTUBE & INSTAGRAM)
            ═══════════════════════════════════════════════════════════════════════ */}
        {(ingestMode === 'youtube' || ingestMode === 'instagram') && (
          <div className="space-y-5">
            {/* Sub-Tabs for YouTube vs Instagram URL Ingestion */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E9EAF1] pb-3">
              <div className="grid grid-cols-1 sm:flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIngestMode('youtube')}
                  className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    ingestMode === 'youtube'
                      ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-xs'
                      : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                  }`}
                >
                  <Youtube className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="truncate">YouTube Live Comment Detector</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIngestMode('instagram')}
                  className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    ingestMode === 'instagram'
                      ? 'bg-pink-50 text-pink-700 border-pink-300 shadow-xs'
                      : 'bg-[#F8F9FE] text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                  }`}
                >
                  <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                  <span className="truncate">Instagram Live Comment Detector</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/moderation?tab=${ingestMode === 'instagram' ? 'instagram' : 'youtube'}`)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] border border-[#DDD6FE] text-xs font-bold transition-colors cursor-pointer text-center"
              >
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span className="break-words">Open {ingestMode === 'instagram' ? 'Instagram' : 'YouTube'} in Command Center</span>
              </button>
            </div>

            {/* YouTube URL Form */}
            {ingestMode === 'youtube' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#20212B] mb-1">
                    YouTube Video URL, Shorts URL, or Video ID:
                  </label>
                  <div className="relative">
                    <Youtube className="w-4 h-4 text-rose-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={ytVideoInput}
                      onChange={(e) => setYtVideoInput(e.target.value)}
                      placeholder="Paste any YouTube video URL (e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ)"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-rose-500 font-mono"
                    />
                  </div>
                  {/* Quick Preset YouTube Videos */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[11px] text-[#858795] font-semibold">
                      Sample Live YouTube Videos:
                    </span>
                    {[
                      { label: 'Official Music Video (dQw4w9WgXcQ)', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
                      { label: 'First YouTube Video — Jawed (jNQXAC9IVRw)', url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw' },
                      { label: 'Global Viral Hit (9bZkp7q19f0)', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0' },
                    ].map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setYtVideoInput(s.url);
                          addToast(`Loaded ${s.label}`, 'info');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-6 space-y-1.5">
                    <label className="block text-xs font-bold text-[#20212B]">
                      Comment Retrieval Count:
                    </label>
                    <select
                      value={ytCountSelect}
                      onChange={(e) => {
                        const opt = e.target.value;
                        setYtCountSelect(opt);
                        if (opt === 'default') setYtMaxComments(50);
                        else if (opt === '10') setYtMaxComments(10);
                        else if (opt === '25') setYtMaxComments(25);
                        else if (opt === '50') setYtMaxComments(50);
                        else if (opt === '100') setYtMaxComments(100);
                        else if (opt === '250') setYtMaxComments(250);
                        else if (opt === '500') setYtMaxComments(500);
                        else if (opt === 'custom') setYtMaxComments(ytCustomValue);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] font-medium focus:outline-none focus:border-rose-500 cursor-pointer"
                    >
                      <option value="default">Default (50 comments)</option>
                      <option value="10">10 comments</option>
                      <option value="25">25 comments</option>
                      <option value="50">50 comments</option>
                      <option value="100">100 comments</option>
                      <option value="250">250 comments</option>
                      <option value="500">500 comments</option>
                      <option value="custom">Custom count</option>
                    </select>

                    {ytCountSelect === 'custom' && (
                      <div className="pt-1 space-y-1">
                        <label className="block text-[11px] font-semibold text-[#20212B]">
                          Enter Comment Count (1–500):
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={ytCustomValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const clamped = isNaN(val) ? 1 : Math.max(1, Math.min(500, val));
                            setYtCustomValue(clamped);
                            setYtMaxComments(clamped);
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#E9EAF1] text-[#20212B] font-mono font-bold focus:outline-none focus:border-rose-500"
                          placeholder="e.g. 75"
                        />
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-xs text-[#858795] font-medium mb-1">Sorting Order:</label>
                    <select
                      value={ytOrder}
                      onChange={(e) => setYtOrder(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7]"
                    >
                      <option value="relevance">Top Relevant</option>
                      <option value="time">Newest First</option>
                    </select>
                  </div>

                  <div className="sm:col-span-3 flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={ytIncludeReplies}
                        onChange={(e) => setYtIncludeReplies(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-rose-600 focus:ring-0"
                      />
                      <span>Include nested replies</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleYouTubeFetch}
                    disabled={isIngesting || !ytVideoInput.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Fetching Live YouTube Comments...</span>
                      </>
                    ) : (
                      <>
                        <Youtube className="w-4 h-4 text-white shrink-0" />
                        <span>Fetch &amp; Moderate YouTube Comments ({ytMaxComments})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Instagram URL Form */}
            {ingestMode === 'instagram' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-[#20212B] mb-1">
                    Instagram Post / Reel URL or Media ID:
                  </label>
                  <div className="relative">
                    <Instagram className="w-4 h-4 text-pink-600 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={igMediaInput}
                      onChange={(e) => setIgMediaInput(e.target.value)}
                      placeholder="e.g. https://www.instagram.com/reel/C7xTechIndia/ or shortcode"
                      className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-pink-500 font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap pt-2">
                    <span className="text-[11px] text-[#858795] font-semibold">
                      Sample Public Reels:
                    </span>
                    {[
                      { label: 'Viral Indic Tech Reel', url: 'https://www.instagram.com/reel/C7xTechIndia/' },
                      { label: 'Telugu Creator Post', url: 'https://www.instagram.com/p/C9TeluguBuzz/' },
                      { label: 'Hindi & Hinglish Reel', url: 'https://www.instagram.com/reel/C8HindiHumor/' },
                      { label: 'Kannada Community Reel', url: 'https://www.instagram.com/reel/C6KarnatakaDaily/' },
                    ].map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setIgMediaInput(s.url);
                          addToast(`Loaded ${s.label}`, 'info');
                        }}
                        className="px-2.5 py-1 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 text-[10px] font-medium transition-colors cursor-pointer"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-8 space-y-1.5">
                    <label className="block text-xs font-bold text-[#20212B]">
                      Comment Retrieval Count:
                    </label>
                    <select
                      value={igCountSelect}
                      onChange={(e) => {
                        const opt = e.target.value;
                        setIgCountSelect(opt);
                        if (opt === 'default') setIgMaxComments(50);
                        else if (opt === '10') setIgMaxComments(10);
                        else if (opt === '25') setIgMaxComments(25);
                        else if (opt === '50') setIgMaxComments(50);
                        else if (opt === '100') setIgMaxComments(100);
                        else if (opt === '250') setIgMaxComments(250);
                        else if (opt === '500') setIgMaxComments(500);
                        else if (opt === 'custom') setIgMaxComments(igCustomValue);
                      }}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] font-medium focus:outline-none focus:border-pink-500 cursor-pointer"
                    >
                      <option value="default">Default (50 comments)</option>
                      <option value="10">10 comments</option>
                      <option value="25">25 comments</option>
                      <option value="50">50 comments</option>
                      <option value="100">100 comments</option>
                      <option value="250">250 comments</option>
                      <option value="500">500 comments</option>
                      <option value="custom">Custom count</option>
                    </select>

                    {igCountSelect === 'custom' && (
                      <div className="pt-1 space-y-1">
                        <label className="block text-[11px] font-semibold text-[#20212B]">
                          Enter Comment Count (1–500):
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={igCustomValue}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            const clamped = isNaN(val) ? 1 : Math.max(1, Math.min(500, val));
                            setIgCustomValue(clamped);
                            setIgMaxComments(clamped);
                          }}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#E9EAF1] text-[#20212B] font-mono font-bold focus:outline-none focus:border-pink-500"
                          placeholder="e.g. 75"
                        />
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-4 flex items-center pt-5">
                    <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={igIncludeReplies}
                        onChange={(e) => setIgIncludeReplies(e.target.checked)}
                        className="rounded border-[#E9EAF1] text-pink-600 focus:ring-0"
                      />
                      <span>Include nested replies</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleInstagramFetch}
                    disabled={isIngesting || !igMediaInput.trim()}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold shadow-md shadow-pink-600/25 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isIngesting ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>Fetching Instagram Comments...</span>
                      </>
                    ) : (
                      <>
                        <Instagram className="w-4 h-4 text-white shrink-0" />
                        <span>Fetch &amp; Moderate Instagram Comments ({igMaxComments})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════════
            MODE 3: BATCH CSV / FILE INGESTION
            ═══════════════════════════════════════════════════════════════════════ */}
        {ingestMode === 'csv' && (
          <div className="space-y-4">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-8 rounded-2xl border-2 border-dashed border-[#E9EAF1] bg-[#FBFBFE] flex flex-col items-center justify-center text-center hover:border-[#6C5CE7]/50 hover:bg-[#F5F6FA] transition-colors cursor-pointer"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileSelect(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <Upload className="w-8 h-8 text-[#6C5CE7] mb-2" />
              <div className="text-xs font-bold text-[#20212B]">
                {csvFile ? csvFile.name : 'Click to select CSV, TSV, or TXT dataset'}
              </div>
              <p className="text-[11px] text-[#858795] mt-1">
                {csvFile ? `${(csvFile.size / (1024 * 1024) > 1 ? (csvFile.size / (1024 * 1024)).toFixed(2) + ' MB' : (csvFile.size / 1024).toFixed(1) + ' KB')}` : 'Auto-detects comment columns, delimiters, and multi-encoding UTF-8/BOM'}
              </p>
            </div>

            {csvColumns.length > 0 && (
              <div className="p-4 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#6C5CE7]" />
                    <span className="text-xs font-bold text-[#20212B]">Detected Columns &amp; Schema Mapping</span>
                  </div>
                  {detectedCommentCol && (
                    <span className="text-[10px] bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] px-2.5 py-0.5 rounded-full font-semibold">
                      Auto-detected: &ldquo;{detectedCommentCol}&rdquo;
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                  <div className="sm:col-span-6 space-y-1">
                    <label className="block text-[11px] font-bold text-[#20212B]">
                      Select Comment / Text Column:
                    </label>
                    <select
                      value={selectedCommentCol}
                      onChange={(e) => setSelectedCommentCol(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-white border border-[#E9EAF1] text-[#20212B] font-medium focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                    >
                      {csvColumns.map((col) => (
                        <option key={col} value={col}>
                          {col} {col.toLowerCase() === detectedCommentCol?.toLowerCase() ? '(Detected Comment Column)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-6 text-[11px] text-[#858795]">
                    <span className="font-semibold text-[#20212B]">Sample preview row ({selectedCommentCol || 'text'}):</span>
                    <div className="mt-1 p-2 rounded-lg bg-white border border-[#E9EAF1] text-xs font-mono truncate text-[#20212B]">
                      {csvPreviewRows[0] && selectedCommentCol && csvPreviewRows[0][selectedCommentCol]
                        ? `"${csvPreviewRows[0][selectedCommentCol]}"`
                        : (csvPreviewRows[0] ? `"${Object.values(csvPreviewRows[0])[0]}"` : 'No preview available')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {csvProcessing && (
              <div className="p-4 rounded-xl bg-white border border-[#6C5CE7]/30 shadow-md space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-[#6C5CE7] animate-spin" />
                    <span className="font-bold text-[#20212B]">Analyzing CSV Records in Background</span>
                  </div>
                  <span className="font-mono font-bold text-[#6C5CE7] text-sm tabular-nums">
                    {csvProgress.toFixed(1)}%
                  </span>
                </div>

                <div className="h-2.5 w-full bg-[#EEEAFE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6C5CE7] to-[#8C7AE6] rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, csvProgress)}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-[#F8F9FE] border border-[#E9EAF1]">
                    <div className="text-[10px] text-[#858795] font-semibold">Total Records</div>
                    <div className="font-mono font-bold text-[#20212B] text-sm tabular-nums">{csvTotal.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-[#F8F9FE] border border-[#E9EAF1]">
                    <div className="text-[10px] text-[#858795] font-semibold">Successfully Analysed</div>
                    <div className="font-mono font-bold text-[#6C5CE7] text-sm tabular-nums">{csvProcessed.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                    <div className="text-[10px] text-rose-700 font-semibold">Flagged Records</div>
                    <div className="font-mono font-bold text-rose-700 text-sm tabular-nums">{csvFlagged.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-700 font-semibold">Approved Safe</div>
                    <div className="font-mono font-bold text-emerald-700 text-sm tabular-nums">{csvApproved.toLocaleString()}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="text-[10px] text-amber-700 font-semibold">Duplicates Skipped</div>
                    <div className="font-mono font-bold text-amber-700 text-sm tabular-nums">{csvDuplicates.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-[#858795] font-medium">Delimiter:</label>
                  <select
                    value={csvDelimiter}
                    onChange={(e) => setCsvDelimiter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] text-xs text-[#20212B] font-medium"
                  >
                    <option value="auto">Auto-Detect</option>
                    <option value=",">Comma (,)</option>
                    <option value="\t">Tab (\t)</option>
                    <option value=";">Semicolon (;)</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs text-[#20212B] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deduplicate}
                    onChange={(e) => setDeduplicate(e.target.checked)}
                    className="rounded border-[#E9EAF1] text-[#6C5CE7] focus:ring-0"
                  />
                  <span>Deduplicate rows</span>
                </label>
              </div>

              <button
                type="button"
                onClick={handleCsvIngest}
                disabled={isIngesting || csvProcessing || !csvFile}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-md shadow-[#6C5CE7]/25 transition-all disabled:opacity-50 cursor-pointer"
              >
                {csvProcessing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing ({csvProgress.toFixed(0)}%)...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import &amp; Moderate CSV Dataset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════════
          CURRENT SESSION INGESTION RESULTS PREVIEW
          ═════════════════════════════════════════════════════════════════════════ */}
      <div ref={resultsSectionRef}>
        {batchResult && (
          <div className="bg-white border border-[#E9EAF1] rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 page-enter max-w-full overflow-hidden">
            {/* Channel / Media Header Banner */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#E9EAF1]">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
                {batchResult.thumbnail_url ? (
                  <img
                    src={batchResult.thumbnail_url}
                    alt={batchResult.channel_name || 'Channel'}
                    referrerPolicy="no-referrer"
                    className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl object-cover border border-[#E9EAF1] shrink-0"
                  />
                ) : (
                  <div
                    className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 border ${
                      String(batchResult.platform || '').toLowerCase() === 'youtube'
                        ? 'bg-rose-50 text-rose-600 border-rose-200'
                        : String(batchResult.platform || '').toLowerCase() === 'instagram'
                        ? 'bg-pink-50 text-pink-600 border-pink-200'
                        : 'bg-[#EEEAFE] text-[#6C5CE7] border-[#DDD6FE]'
                    }`}
                  >
                    {String(batchResult.platform || '').toLowerCase() === 'youtube' ? (
                      <Youtube className="w-6 h-6 sm:w-7 sm:h-7" />
                    ) : String(batchResult.platform || '').toLowerCase() === 'instagram' ? (
                      <Instagram className="w-6 h-6 sm:w-7 sm:h-7" />
                    ) : (
                      <FileText className="w-6 h-6 sm:w-7 sm:h-7" />
                    )}
                  </div>
                )}

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-black text-[#20212B] break-words">
                      {batchResult.channel_name || 'Analyzed Comment Stream'}
                    </span>
                    <span className="text-[11px] text-[#858795] font-mono tabular-nums">
                      · {batchResult.processing_time_ms ? `${batchResult.processing_time_ms.toFixed(1)} ms` : 'Instant'}
                    </span>
                  </div>

                  {batchResult.media_title && (
                    <div className="text-xs font-bold text-[#20212B] break-words line-clamp-2 max-w-2xl">
                      {batchResult.media_title}
                    </div>
                  )}

                  {batchResult.source_url && (
                    <a
                      href={batchResult.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-[#6C5CE7] hover:underline font-mono break-all"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="break-all">{batchResult.source_url}</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Summary Counters & Link to Moderator Command Center */}
              <div className="flex items-center gap-2 text-[11px] tabular-nums flex-wrap w-full sm:w-auto">
                <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#F8F9FE] text-[#20212B] border border-[#E9EAF1] font-bold">
                  Total: {batchResult.total_fetched ?? batchResult.total_received ?? batchResult.processed_count}
                </span>
                <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                  Flagged: {batchResult.flagged_count}
                </span>
                <span className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                  Approved: {batchResult.approved_count}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const p = (batchResult.platform || '').toLowerCase();
                    const tab =
                      p === 'instagram' ? 'instagram' :
                      p === 'youtube' ? 'youtube' :
                      p.includes('csv') ? 'csv_upload' :
                      'manual';
                    navigate(`/moderation?tab=${tab}`);
                  }}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white font-bold transition-colors cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  <span>Open in Moderator Command Center</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar for Retrieved Comments */}
            <div className="flex items-center justify-between flex-wrap gap-3 bg-[#F8F9FE] p-3 rounded-xl border border-[#E9EAF1]">
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {(['all', 'flagged', 'approved'] as const).map((statusOpt) => (
                  <button
                    key={statusOpt}
                    type="button"
                    onClick={() => setResultFilterStatus(statusOpt)}
                    className={`flex-1 sm:flex-initial px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer border ${
                      resultFilterStatus === statusOpt
                        ? 'bg-[#6C5CE7] text-white border-[#6C5CE7]'
                        : 'bg-white text-[#858795] border-[#E9EAF1] hover:text-[#20212B]'
                    }`}
                  >
                    {statusOpt === 'all'
                      ? `All (${rawResultItems.length})`
                      : statusOpt === 'flagged'
                      ? `Flagged (${batchResult.flagged_count || 0})`
                      : `Safe (${batchResult.approved_count || 0})`}
                  </button>
                ))}

                <select
                  value={resultFilterLang}
                  onChange={(e) => setResultFilterLang(e.target.value)}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-white border border-[#E9EAF1] text-xs font-bold text-[#20212B] focus:outline-none focus:border-[#6C5CE7] cursor-pointer"
                >
                  <option value="all">All Languages</option>
                  <option value="telugu">Telugu (తెలుగు / Tenglish)</option>
                  <option value="hindi">Hindi (Devanagari)</option>
                  <option value="hinglish">Hinglish (Code-Mixed)</option>
                  <option value="kannada">Kannada (ಕನ್ನಡ)</option>
                  <option value="english">English</option>
                </select>
              </div>

              <div className="relative w-full sm:min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="w-3.5 h-3.5 text-[#858795] absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={resultSearchQuery}
                  onChange={(e) => setResultSearchQuery(e.target.value)}
                  placeholder="Search comments or @author..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white border border-[#E9EAF1] text-xs text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>
            </div>

            {/* Interactive Comments Table with Expandable Per-Comment Detection Details */}
            <div className="overflow-x-auto rounded-xl border border-[#E9EAF1] max-h-[560px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#F8F9FE] text-[#858795] border-b border-[#E9EAF1] font-semibold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="py-3 px-3">#</th>
                    <th className="py-3 px-3">Author &amp; Comment Text</th>
                    <th className="py-3 px-3">Language</th>
                    <th className="py-3 px-3">Toxicity</th>
                    <th className="py-3 px-3">Severity</th>
                    <th className="py-3 px-3">Decision</th>
                    <th className="py-3 px-3.5 text-right">Detection Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F1F5]">
                  {filteredResultItems.map((it: any, idx: number) => {
                    const rowId = it.id || `row-${idx}`;
                    const isExpanded = expandedCommentId === rowId;
                    const toxScore = it.toxicity_score ?? 0.04;
                    const toxPct = `${Math.round(toxScore * 100)}%`;
                    const isHigh = it.severity === 'high';
                    const isMed = it.severity === 'medium';

                    const hateScore = it.hate_speech_score ?? it.labels?.find((l: any) => l.label === 'hate_speech')?.score ?? 0;
                    const harassScore = it.harassment_score ?? it.labels?.find((l: any) => l.label === 'harassment')?.score ?? 0;
                    const bullyScore = it.cyberbullying_score ?? it.labels?.find((l: any) => l.label === 'cyberbullying')?.score ?? 0;
                    const legitScore = it.legitimate_score ?? it.labels?.find((l: any) => l.label === 'legitimate')?.score ?? (isHigh || isMed ? 0.05 : 0.92);

                    const allEvidence: string[] = (it.labels || []).flatMap((l: any) => l.evidence || []);

                    return (
                      <Fragment key={rowId}>
                        <tr
                          onClick={() => setExpandedCommentId(isExpanded ? null : rowId)}
                          className={`transition-colors cursor-pointer ${
                            isExpanded ? 'bg-[#F8F9FE]' : 'hover:bg-[#FBFBFE]'
                          }`}
                        >
                          <td className="py-3 px-3 font-mono text-[11px] text-[#858795] whitespace-nowrap tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="py-3 px-3 max-w-xl">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono font-bold text-[11px] text-[#6C5CE7]">
                                {it.author_name || `@user_${idx + 1}`}
                              </span>
                              {it.like_count !== undefined && (
                                <span className="inline-flex items-center gap-0.5 text-[10px] text-[#858795] font-mono tabular-nums">
                                  <ThumbsUp className="w-2.5 h-2.5" />
                                  {it.like_count}
                                </span>
                              )}
                            </div>
                            <div className="font-medium text-[#20212B] leading-relaxed break-words">
                              {it.text || it.original_text}
                            </div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="capitalize text-xs text-[#20212B] font-semibold">
                              {it.detected_language || 'english'}
                              {it.is_code_mixed ? ' · Code-Mixed' : ''}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap font-mono font-bold tabular-nums">
                            <span className={toxScore >= 0.35 ? 'text-rose-600' : 'text-emerald-600'}>
                              {toxPct}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-xs font-bold uppercase ${
                                isHigh
                                  ? 'text-rose-700'
                                  : isMed
                                  ? 'text-amber-700'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {it.severity || 'low'}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`text-xs font-semibold ${
                                it.decision !== 'no_action' ? 'text-rose-700' : 'text-emerald-700'
                              }`}
                            >
                              {it.decision === 'flag_for_review'
                                ? 'Flagged for Review'
                                : it.decision === 'human_review'
                                ? 'Human Review'
                                : 'Approved'}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedCommentId(isExpanded ? null : rowId);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7] text-[10px] font-bold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{isExpanded ? 'Hide Details' : 'Detection Details'}</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </td>
                        </tr>

                        {/* Expandable Full Detection Details Drawer Row */}
                        {isExpanded && (
                          <tr className="bg-[#F8F9FE] border-b border-[#E9EAF1]">
                            <td colSpan={7} className="p-4">
                              <div className="bg-white rounded-xl border border-[#DDD6FE] p-4 shadow-xs space-y-4">
                                <div className="flex items-start justify-between flex-wrap gap-2 border-b border-[#E9EAF1] pb-3">
                                  <div>
                                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#6C5CE7]">
                                      Per-Comment Multilingual NLP Detection Breakdown
                                    </div>
                                    <div className="text-xs font-bold text-[#20212B] mt-0.5">
                                      {it.severity_reason || 'Analyzed by Sentinel Multilingual Pipeline v2.1'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-semibold text-[#20212B]">
                                      Recommended Action: {it.recommended_action || (isHigh || isMed ? 'Flag for moderator triage' : 'No action required')}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCommentDetail(it)}
                                      className="px-2.5 py-1 rounded-lg bg-[#6C5CE7] text-white text-[10px] font-bold cursor-pointer"
                                    >
                                      Open Full Modal
                                    </button>
                                  </div>
                                </div>

                                {/* 4 Category Score Bars */}
                                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                                  {[
                                    { label: 'Hate Speech', score: hateScore, color: 'bg-rose-600', textCol: 'text-rose-700' },
                                    { label: 'Harassment / Insult', score: harassScore, color: 'bg-amber-500', textCol: 'text-amber-700' },
                                    { label: 'Cyberbullying', score: bullyScore, color: 'bg-purple-600', textCol: 'text-purple-700' },
                                    { label: 'Legitimate / Civil', score: legitScore, color: 'bg-emerald-500', textCol: 'text-emerald-700' },
                                  ].map((cat) => (
                                    <div key={cat.label} className="p-3 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] space-y-1.5">
                                      <div className="flex items-center justify-between text-[11px] font-bold">
                                        <span className="text-[#20212B]">{cat.label}</span>
                                        <span className={`font-mono tabular-nums ${cat.textCol}`}>{(cat.score * 100).toFixed(0)}%</span>
                                      </div>
                                      <div className="h-2 w-full bg-[#E9EAF1] rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${cat.color} rounded-full`}
                                          style={{ width: `${Math.max(3, Math.round(cat.score * 100))}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Evidence & Metadata Footer */}
                                <div className="flex items-center justify-between flex-wrap gap-3 text-[11px] pt-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-[#20212B]">Matched Linguistic Evidence:</span>
                                    {allEvidence.length > 0 ? (
                                      <span className="font-mono text-xs text-rose-700 font-semibold">
                                        {allEvidence.join(' · ')}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-700 text-xs font-semibold">
                                        No harmful slurs or hostility patterns triggered
                                      </span>
                                    )}
                                  </div>

                                  <div className="text-[#858795] font-mono text-[10px] tabular-nums">
                                    Confidence: <strong className="text-[#20212B] uppercase">{it.confidence_level || 'high'}</strong> · Latency: {it.processing_time_ms ? `${it.processing_time_ms.toFixed(1)}ms` : '4.2ms'}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Full Comment Detection Detail Modal */}
      {selectedCommentDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setSelectedCommentDetail(null)}
        >
          <div
            className="bg-white border border-[#E9EAF1] rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#E9EAF1] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#6C5CE7]" />
                <h3 className="text-sm font-black text-[#20212B]">Complete Comment Detection Report</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCommentDetail(null)}
                className="p-1 rounded-lg hover:bg-[#F8F9FE] text-[#858795] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-[#858795]">
                <span className="font-mono font-bold text-[#6C5CE7] flex items-center gap-1">
                  <UserIcon className="w-3 h-3" />
                  {selectedCommentDetail.author_name || '@viewer'}
                </span>
                <span>{selectedCommentDetail.published_at}</span>
              </div>
              <p className="text-xs font-semibold text-[#20212B] leading-relaxed">
                {selectedCommentDetail.text}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-[#E9EAF1]">
                <div className="text-[10px] text-[#858795] font-semibold">Detected Language</div>
                <div className="font-bold text-[#20212B] capitalize mt-0.5">
                  {selectedCommentDetail.detected_language} {selectedCommentDetail.is_code_mixed ? '(Code-Mixed)' : ''}
                </div>
              </div>
              <div className="p-3 rounded-xl border border-[#E9EAF1]">
                <div className="text-[10px] text-[#858795] font-semibold">Operational Severity &amp; Decision</div>
                <div className="font-bold text-[#20212B] uppercase mt-0.5">
                  {selectedCommentDetail.severity} — {selectedCommentDetail.decision}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-[#20212B]">Category Probabilities:</div>
              {[
                { label: 'Hate Speech', score: selectedCommentDetail.hate_speech_score ?? 0 },
                { label: 'Harassment & Abuse', score: selectedCommentDetail.harassment_score ?? 0 },
                { label: 'Cyberbullying', score: selectedCommentDetail.cyberbullying_score ?? 0 },
                { label: 'Legitimate Discourse', score: selectedCommentDetail.legitimate_score ?? 0 },
              ].map((c) => (
                <div key={c.label} className="flex items-center justify-between text-xs">
                  <span className="text-[#858795] font-medium">{c.label}</span>
                  <span className="font-mono font-bold text-[#20212B] tabular-nums">{(c.score * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-xl bg-[#EEEAFE]/50 border border-[#DDD6FE] text-xs space-y-1">
              <div className="font-bold text-[#6C5CE7]">Reasoning &amp; Recommended Action:</div>
              <div className="text-[#20212B]">{selectedCommentDetail.severity_reason}</div>
              <div className="text-[11px] text-[#858795]">
                Action: <strong className="text-[#20212B]">{selectedCommentDetail.recommended_action}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
